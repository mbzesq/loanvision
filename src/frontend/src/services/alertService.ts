import axios from 'axios';
import { solService } from './solService';

// Core Alert Types
export type AlertCategory = 
  | 'performance_degradation' 
  | 'performance_improvement' 
  | 'legal_regulatory' 
  | 'portfolio_level' 
  | 'sol';

export type AlertPriority = 'critical' | 'high' | 'medium' | 'informational';

export type AlertType = 
  // Performance Degradation
  | 'payment_deterioration'
  | 'partial_payments'
  | 'credit_score_drop'
  | 'employment_change'
  | 'geographic_clustering'
  // Performance Improvement
  | 'approaching_securitizable'
  | 'payment_rehabilitation'
  | 'workout_success'
  | 'equity_improvement'
  // Legal & Regulatory
  | 'foreclosure_delay'
  // Portfolio Level
  | 'securitization_opportunity'
  // SOL
  | 'sol_expired'
  | 'sol_expiring_soon'
  | 'sol_high_risk';

export interface UniversalAlert {
  id: string;
  category: AlertCategory;
  priority: AlertPriority;
  alertType: AlertType;
  loanIds: string[];
  borrowerNames: string[];
  message: string;
  detailMessage: string;
  suggestedActions: string[];
  dataSource: 'daily_metrics' | 'foreclosure_events' | 'sol_calculations' | 'external_api' | 'calculated';
  timestamp: Date;
  isPortfolioWide: boolean;
  metadata?: {
    count?: number;
    threshold?: number;
    daysOverdue?: number;
    riskLevel?: string;
    geography?: string;
    [key: string]: any;
  };
}

export interface AlertSettings {
  enabledCategories: AlertCategory[];
  thresholds: {
    creditScoreDropMinimum: number;
    paymentDeteriorationDays: number;
    foreclosureDelayDays: number;
    securitizationMinimumLoans: number;
    geographicClusterMinimum: number;
    partialPaymentThreshold: number;
  };
  notificationFrequency: 'real_time' | 'daily' | 'weekly';
  customRules: Array<{
    id: string;
    name: string;
    condition: string;
    action: string;
  }>;
}

export const defaultAlertSettings: AlertSettings = {
  enabledCategories: ['performance_degradation', 'performance_improvement', 'legal_regulatory', 'portfolio_level', 'sol'],
  thresholds: {
    creditScoreDropMinimum: 50,
    paymentDeteriorationDays: 180,
    foreclosureDelayDays: 30,
    securitizationMinimumLoans: 100,
    geographicClusterMinimum: 3,
    partialPaymentThreshold: 0.8
  },
  notificationFrequency: 'real_time',
  customRules: []
};

// Loan data interface for alert detection
interface LoanData {
  loan_id: string;
  first_name: string;
  last_name: string;
  state: string;
  prin_bal: string;
  last_pymt_received: string | null;
  next_pymt_due: string | null;
  legal_status: string;
  fc_status: string | null;
  complaint_filed_date: string | null;
  complaint_filed_expected_completion_date: string | null;
  // Add other necessary fields as needed
}

export class AlertService {
  private apiUrl: string;
  private settings: AlertSettings;

  constructor() {
    this.apiUrl = import.meta.env.VITE_API_BASE_URL || '';
    this.settings = this.loadSettings();
  }

  private loadSettings(): AlertSettings {
    const stored = localStorage.getItem('alertSettings');
    return stored ? { ...defaultAlertSettings, ...JSON.parse(stored) } : defaultAlertSettings;
  }

  public saveSettings(settings: AlertSettings): void {
    this.settings = settings;
    localStorage.setItem('alertSettings', JSON.stringify(settings));
  }

  public getSettings(): AlertSettings {
    return this.settings;
  }

  /**
   * Main method to generate all alerts
   */
  public async generateAllAlerts(): Promise<UniversalAlert[]> {
    try {
      const [loans, solSummary] = await Promise.all([
        this.fetchLoans(),
        solService.getSOLSummary()
      ]);

      const alerts: UniversalAlert[] = [];

      // Generate alerts by category
      if (this.settings.enabledCategories.includes('performance_degradation')) {
        alerts.push(...await this.generatePerformanceDegradationAlerts(loans));
      }

      if (this.settings.enabledCategories.includes('performance_improvement')) {
        alerts.push(...await this.generatePerformanceImprovementAlerts(loans));
      }

      if (this.settings.enabledCategories.includes('legal_regulatory')) {
        alerts.push(...await this.generateLegalRegulatoryAlerts(loans));
      }

      if (this.settings.enabledCategories.includes('portfolio_level')) {
        alerts.push(...await this.generatePortfolioLevelAlerts(loans));
      }

      if (this.settings.enabledCategories.includes('sol')) {
        alerts.push(...await this.generateSOLAlerts(solSummary));
      }

      return alerts.sort((a, b) => this.getPriorityWeight(a.priority) - this.getPriorityWeight(b.priority));
    } catch (error) {
      console.error('Error generating alerts:', error);
      throw new Error('Failed to generate alerts');
    }
  }

  /**
   * Performance Degradation Alerts
   */
  private async generatePerformanceDegradationAlerts(loans: LoanData[]): Promise<UniversalAlert[]> {
    const alerts: UniversalAlert[] = [];
    const today = new Date();

    // Payment pattern deterioration - First missed payment in 6+ months
    const recentlyDelinquent = loans.filter(loan => {
      if (!loan.next_pymt_due || !loan.last_pymt_received) return false;
      
      const nextDue = new Date(loan.next_pymt_due);
      const lastPaid = new Date(loan.last_pymt_received);
      const daysSinceLastPayment = Math.floor((today.getTime() - lastPaid.getTime()) / (1000 * 60 * 60 * 24));
      const daysPastDue = Math.floor((today.getTime() - nextDue.getTime()) / (1000 * 60 * 60 * 24));
      
      // First missed payment in 6+ months (180 days of good payment history)
      return daysSinceLastPayment >= this.settings.thresholds.paymentDeteriorationDays && 
             daysPastDue > 30 && daysPastDue < 60; // Recently became delinquent
    });

    if (recentlyDelinquent.length > 0) {
      recentlyDelinquent.forEach(loan => {
        alerts.push({
          id: `payment_deterioration_${loan.loan_id}_${Date.now()}`,
          category: 'performance_degradation',
          priority: 'high',
          alertType: 'payment_deterioration',
          loanIds: [loan.loan_id],
          borrowerNames: [`${loan.first_name} ${loan.last_name}`],
          message: 'First missed payment in 6+ months',
          detailMessage: `Loan ${loan.loan_id} has missed its first payment after 6+ months of consistent payments`,
          suggestedActions: [
            'Contact borrower immediately',
            'Review payment history for patterns',
            'Consider early intervention strategies'
          ],
          dataSource: 'daily_metrics',
          timestamp: today,
          isPortfolioWide: false,
          metadata: {
            daysPastDue: Math.floor((today.getTime() - new Date(loan.next_pymt_due!).getTime()) / (1000 * 60 * 60 * 24))
          }
        });
      });
    }

    // Geographic clustering - Multiple loans in same state going delinquent
    const delinquentByState = loans
      .filter(loan => loan.legal_status === 'DL' || loan.legal_status === 'FC')
      .reduce((acc, loan) => {
        acc[loan.state] = (acc[loan.state] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    Object.entries(delinquentByState)
      .filter(([_, count]) => count >= this.settings.thresholds.geographicClusterMinimum)
      .forEach(([state, count]) => {
        alerts.push({
          id: `geographic_clustering_${state}_${Date.now()}`,
          category: 'performance_degradation',
          priority: 'medium',
          alertType: 'geographic_clustering',
          loanIds: loans.filter(loan => loan.state === state && (loan.legal_status === 'DL' || loan.legal_status === 'FC')).map(l => l.loan_id),
          borrowerNames: ['Multiple Borrowers'],
          message: `${count} delinquent loans clustered in ${state}`,
          detailMessage: `Geographic concentration of ${count} delinquent loans in ${state} may indicate regional economic stress`,
          suggestedActions: [
            'Investigate regional economic conditions',
            'Consider geographic-specific collection strategies',
            'Monitor for further clustering'
          ],
          dataSource: 'calculated',
          timestamp: today,
          isPortfolioWide: true,
          metadata: {
            count,
            geography: state
          }
        });
      });

    // Placeholder: Credit score drop (future API integration)
    alerts.push({
      id: `credit_placeholder_${Date.now()}`,
      category: 'performance_degradation',
      priority: 'medium',
      alertType: 'credit_score_drop',
      loanIds: [],
      borrowerNames: ['System Notification'],
      message: 'Credit Bureau API Integration Pending',
      detailMessage: 'Credit score monitoring will be available once credit bureau API is integrated',
      suggestedActions: [
        'Complete credit bureau API setup',
        'Configure credit score drop thresholds',
        'Establish automated monitoring'
      ],
      dataSource: 'external_api',
      timestamp: today,
      isPortfolioWide: true,
      metadata: {
        placeholder: true,
        feature: 'credit_monitoring'
      }
    });

    return alerts;
  }

  /**
   * Performance Improvement Alerts
   */
  private async generatePerformanceImprovementAlerts(loans: LoanData[]): Promise<UniversalAlert[]> {
    const alerts: UniversalAlert[] = [];
    const today = new Date();

    // Loans approaching 12-month current (securitizable status)
    const approachingSecuritizable = loans.filter(loan => {
      if (!loan.last_pymt_received || loan.legal_status !== 'CU') return false;
      
      const lastPaid = new Date(loan.last_pymt_received);
      const daysCurrent = Math.floor((today.getTime() - lastPaid.getTime()) / (1000 * 60 * 60 * 24));
      
      // 30, 60, or 90 days until 365-day mark
      return daysCurrent >= 275 && daysCurrent < 365; // 90 days before 12-month mark
    });

    if (approachingSecuritizable.length > 0) {
      approachingSecuritizable.forEach(loan => {
        const daysCurrent = Math.floor((today.getTime() - new Date(loan.last_pymt_received!).getTime()) / (1000 * 60 * 60 * 24));
        const daysUntilSecuritable = 365 - daysCurrent;
        
        alerts.push({
          id: `approaching_securitizable_${loan.loan_id}_${Date.now()}`,
          category: 'performance_improvement',
          priority: 'informational',
          alertType: 'approaching_securitizable',
          loanIds: [loan.loan_id],
          borrowerNames: [`${loan.first_name} ${loan.last_name}`],
          message: `${daysUntilSecuritable} days until securitizable status`,
          detailMessage: `Loan ${loan.loan_id} will reach 12-month current status in ${daysUntilSecuritable} days`,
          suggestedActions: [
            'Prepare for securitization review',
            'Verify payment documentation',
            'Add to securitization pipeline'
          ],
          dataSource: 'daily_metrics',
          timestamp: today,
          isPortfolioWide: false,
          metadata: {
            daysCurrent,
            daysUntilSecuritable
          }
        });
      });
    }

    // Payment rehabilitation - NPL becomes current after 3+ months delinquent
    // This would require historical data to detect the transition
    // For now, we'll create a placeholder that identifies recently current loans

    return alerts;
  }

  /**
   * Legal & Regulatory Alerts
   */
  private async generateLegalRegulatoryAlerts(loans: LoanData[]): Promise<UniversalAlert[]> {
    const alerts: UniversalAlert[] = [];
    const today = new Date();

    // Foreclosure milestone delays
    const delayedForeclosures = loans.filter(loan => {
      if (!loan.complaint_filed_expected_completion_date || !loan.complaint_filed_date) return false;
      
      const expectedDate = new Date(loan.complaint_filed_expected_completion_date);
      const actualDate = loan.complaint_filed_date ? new Date(loan.complaint_filed_date) : today;
      const delayDays = Math.floor((actualDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      return delayDays > this.settings.thresholds.foreclosureDelayDays;
    });

    delayedForeclosures.forEach(loan => {
      const expectedDate = new Date(loan.complaint_filed_expected_completion_date!);
      const delayDays = Math.floor((today.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      alerts.push({
        id: `foreclosure_delay_${loan.loan_id}_${Date.now()}`,
        category: 'legal_regulatory',
        priority: 'high',
        alertType: 'foreclosure_delay',
        loanIds: [loan.loan_id],
        borrowerNames: [`${loan.first_name} ${loan.last_name}`],
        message: `Foreclosure milestone ${delayDays} days overdue`,
        detailMessage: `Foreclosure process for loan ${loan.loan_id} is ${delayDays} days behind schedule`,
        suggestedActions: [
          'Contact foreclosure attorney',
          'Review process bottlenecks',
          'Update timeline expectations'
        ],
        dataSource: 'foreclosure_events',
        timestamp: today,
        isPortfolioWide: false,
        metadata: {
          daysOverdue: delayDays
        }
      });
    });

    return alerts;
  }

  /**
   * Portfolio-Level Alerts
   */
  private async generatePortfolioLevelAlerts(loans: LoanData[]): Promise<UniversalAlert[]> {
    const alerts: UniversalAlert[] = [];
    const today = new Date();

    // Securitization opportunity - Enough 12+ month current loans for pool
    const securitizableLoans = loans.filter(loan => {
      if (!loan.last_pymt_received || loan.legal_status !== 'CU') return false;
      
      const lastPaid = new Date(loan.last_pymt_received);
      const daysCurrent = Math.floor((today.getTime() - lastPaid.getTime()) / (1000 * 60 * 60 * 24));
      
      return daysCurrent >= 365; // 12+ months current
    });

    if (securitizableLoans.length >= this.settings.thresholds.securitizationMinimumLoans) {
      alerts.push({
        id: `securitization_opportunity_${Date.now()}`,
        category: 'portfolio_level',
        priority: 'informational',
        alertType: 'securitization_opportunity',
        loanIds: securitizableLoans.map(l => l.loan_id),
        borrowerNames: ['Portfolio Wide'],
        message: `${securitizableLoans.length} loans ready for securitization`,
        detailMessage: `Portfolio has ${securitizableLoans.length} loans with 12+ months current payment history, meeting minimum threshold for securitization`,
        suggestedActions: [
          'Prepare securitization documentation',
          'Contact investment bank partners',
          'Review loan pool composition'
        ],
        dataSource: 'calculated',
        timestamp: today,
        isPortfolioWide: true,
        metadata: {
          count: securitizableLoans.length,
          threshold: this.settings.thresholds.securitizationMinimumLoans
        }
      });
    }

    return alerts;
  }

  /**
   * SOL Alerts (migrated from existing SOL system)
   */
  private async generateSOLAlerts(solSummary: any): Promise<UniversalAlert[]> {
    const alerts: UniversalAlert[] = [];
    const today = new Date();

    if (solSummary.expired_count > 0) {
      alerts.push({
        id: `sol_expired_${Date.now()}`,
        category: 'sol',
        priority: 'critical',
        alertType: 'sol_expired',
        loanIds: [], // Would need to fetch specific loan IDs
        borrowerNames: ['Multiple Borrowers'],
        message: `${solSummary.expired_count} loans have expired SOL`,
        detailMessage: `${solSummary.expired_count} loans have passed their Statute of Limitations expiration date`,
        suggestedActions: [
          'Review legal options immediately',
          'Consult with legal counsel',
          'Consider portfolio sale options'
        ],
        dataSource: 'sol_calculations',
        timestamp: today,
        isPortfolioWide: true,
        metadata: {
          count: solSummary.expired_count,
          riskLevel: 'EXPIRED'
        }
      });
    }

    if (solSummary.high_risk_count > 0) {
      alerts.push({
        id: `sol_high_risk_${Date.now()}`,
        category: 'sol',
        priority: 'high',
        alertType: 'sol_high_risk',
        loanIds: [],
        borrowerNames: ['Multiple Borrowers'],
        message: `${solSummary.high_risk_count} loans at high SOL risk`,
        detailMessage: `${solSummary.high_risk_count} loans are at high risk of SOL expiration`,
        suggestedActions: [
          'Prioritize collection efforts',
          'Consider legal action',
          'Review SOL timelines'
        ],
        dataSource: 'sol_calculations',
        timestamp: today,
        isPortfolioWide: true,
        metadata: {
          count: solSummary.high_risk_count,
          riskLevel: 'HIGH'
        }
      });
    }

    return alerts;
  }

  /**
   * Utility methods
   */
  private async fetchLoans(): Promise<LoanData[]> {
    const response = await axios.get(`${this.apiUrl}/api/v2/loans`);
    return response.data;
  }

  private getPriorityWeight(priority: AlertPriority): number {
    const weights = { critical: 1, high: 2, medium: 3, informational: 4 };
    return weights[priority];
  }

  public getAlertIcon(alertType: AlertType): string {
    const iconMap: Record<AlertType, string> = {
      // Performance Degradation
      payment_deterioration: 'trending-down',
      partial_payments: 'alert-triangle',
      credit_score_drop: 'user-x',
      employment_change: 'briefcase',
      geographic_clustering: 'map-pin',
      // Performance Improvement
      approaching_securitizable: 'trending-up',
      payment_rehabilitation: 'heart',
      workout_success: 'check-circle',
      equity_improvement: 'arrow-up',
      // Legal & Regulatory
      foreclosure_delay: 'clock',
      // Portfolio Level
      securitization_opportunity: 'package',
      // SOL
      sol_expired: 'x-circle',
      sol_expiring_soon: 'clock',
      sol_high_risk: 'alert-triangle'
    };
    return iconMap[alertType] || 'bell';
  }

  public getAlertColor(priority: AlertPriority): string {
    const colorMap: Record<AlertPriority, string> = {
      critical: 'red',
      high: 'orange',
      medium: 'yellow',
      informational: 'blue'
    };
    return colorMap[priority];
  }
}

// Export singleton instance
export const alertService = new AlertService();