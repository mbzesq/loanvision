import axios from '../utils/axios';

export interface SOLJurisdiction {
  state_code: string;
  state_name: string;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  lien_years?: number;
  note_years?: number;
  foreclosure_years?: number;
  lien_extinguished: boolean;
  foreclosure_barred: boolean;
  affected_loans: number;
  expired_loans: number;
  expiring_soon: number;
}

export interface SOLJurisdictionDetail {
  id: number;
  state_code: string;
  state_name: string;
  risk_level: string;
  sol_periods: {
    lien_years?: number;
    note_years?: number;
    foreclosure_years?: number;
    deficiency_years?: number;
    additional_periods?: Record<string, number>;
  };
  trigger_events: string[];
  tolling_provisions: string[];
  special_provisions: string[];
  statute_citations: string[];
  notes: string[];
  effect_of_expiration: {
    lien_extinguished: boolean;
    foreclosure_barred: boolean;
    deficiency_barred: boolean;
    becomes_unsecured: boolean;
    special_effects: string[];
  };
  revival_methods: {
    partial_payment: boolean;
    written_acknowledgment: boolean;
    new_promise: boolean;
    other_methods: string[];
  };
}

export interface SOLCalculation {
  loan_id: number;
  jurisdiction_id: number;
  sol_trigger_date: string;
  sol_trigger_event: string;
  base_expiration_date: string;
  tolling_events: Array<{
    type: string;
    start_date: string;
    end_date?: string;
    days_tolled: number;
  }>;
  total_tolled_days: number;
  adjusted_expiration_date: string;
  days_until_expiration: number;
  is_expired: boolean;
  sol_risk_score: number;
  sol_risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  risk_factors: {
    days_until_expiration: number;
    jurisdiction_risk: string;
    lien_extinguishment_risk: boolean;
    acceleration_risk: boolean;
    in_active_foreclosure: boolean;
    risk_mitigation?: string;
    future_trigger: boolean;
  };
}

export interface SOLPortfolioSummary {
  summary: {
    total_loans: number;
    analyzed_loans: number;
    expired_loans: number;
    expiring_within_1_year: number;
    expiring_within_2_years: number;
    high_risk_loans: number;
    medium_risk_loans: number;
    low_risk_loans: number;
    expired_upb: number;
    expiring_soon_upb: number;
  };
  topStatesAtRisk: Array<{
    property_state: string;
    jurisdiction_risk: string;
    loan_count: number;
    total_upb: number;
    avg_days_until_expiration: number;
    expired_count: number;
  }>;
}

export interface LoanWithSOL {
  id: number;
  loan_number: string;
  borrower_name: string;
  property_state: string;
  current_upb: number;
  loan_status: string;
  sol_trigger_date: string;
  sol_trigger_event: string;
  adjusted_expiration_date: string;
  days_until_expiration: number;
  is_expired: boolean;
  sol_risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  sol_risk_score: number;
  risk_factors: any;
  jurisdiction_risk_level: string;
}

class SOLService {
  /**
   * Get all SOL jurisdictions with summary stats
   */
  async getJurisdictions(): Promise<SOLJurisdiction[]> {
    const response = await axios.get<{success: boolean; data: SOLJurisdiction[]}>('/api/sol/jurisdictions');
    return response.data.data;
  }

  /**
   * Get detailed SOL rules for a specific state
   */
  async getJurisdictionDetail(stateCode: string): Promise<SOLJurisdictionDetail> {
    const response = await axios.get<{success: boolean; data: SOLJurisdictionDetail}>(`/api/sol/jurisdiction/${stateCode}`);
    return response.data.data;
  }

  /**
   * Calculate SOL for a specific loan
   */
  async calculateLoanSOL(loanId: number): Promise<SOLCalculation | null> {
    const response = await axios.post<{success: boolean; data: SOLCalculation | null}>(`/api/sol/calculate/${loanId}`);
    return response.data.data;
  }

  /**
   * Calculate SOL for entire portfolio
   */
  async calculatePortfolioSOL(): Promise<{processed: number; errors: number}> {
    const response = await axios.post<{success: boolean; data: {processed: number; errors: number}}>('/api/sol/calculate-portfolio');
    return response.data.data;
  }

  /**
   * Get SOL risk summary for entire portfolio
   */
  async getPortfolioSummary(): Promise<SOLPortfolioSummary> {
    const response = await axios.get<{success: boolean; data: SOLPortfolioSummary}>('/api/sol/portfolio-summary');
    return response.data.data;
  }

  /**
   * Get loans with SOL calculations
   */
  async getLoansWithSOL(params: {
    risk_level?: 'HIGH' | 'MEDIUM' | 'LOW';
    state?: string;
    expired_only?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    data: LoanWithSOL[];
    pagination: {limit: number; offset: number; total: number};
  }> {
    const searchParams = new URLSearchParams();
    
    if (params.risk_level) searchParams.append('risk_level', params.risk_level);
    if (params.state) searchParams.append('state', params.state);
    if (params.expired_only) searchParams.append('expired_only', 'true');
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());

    const response = await axios.get<{
      success: boolean; 
      data: LoanWithSOL[];
      pagination: {limit: number; offset: number; total: number};
    }>(`/api/sol/loans?${searchParams}`);
    
    return {
      data: response.data.data,
      pagination: response.data.pagination
    };
  }

  /**
   * Format days until expiration for display
   */
  formatDaysUntilExpiration(days: number, isExpired: boolean): string {
    if (isExpired) {
      return `Expired ${Math.abs(days)} days ago`;
    }
    
    if (days < 0) {
      return `Expired ${Math.abs(days)} days ago`;
    }
    
    if (days === 0) {
      return 'Expires today';
    }
    
    if (days === 1) {
      return 'Expires tomorrow';
    }
    
    if (days < 30) {
      return `Expires in ${days} days`;
    }
    
    if (days < 365) {
      const months = Math.floor(days / 30);
      return `Expires in ${months} month${months > 1 ? 's' : ''}`;
    }
    
    const years = Math.floor(days / 365);
    const remainingDays = days % 365;
    const months = Math.floor(remainingDays / 30);
    
    if (months === 0) {
      return `Expires in ${years} year${years > 1 ? 's' : ''}`;
    }
    
    return `Expires in ${years}y ${months}m`;
  }

  /**
   * Get risk level color for UI
   */
  getRiskLevelColor(riskLevel: 'HIGH' | 'MEDIUM' | 'LOW'): string {
    switch (riskLevel) {
      case 'HIGH':
        return '#DC2626'; // Red
      case 'MEDIUM':
        return '#F59E0B'; // Orange
      case 'LOW':
        return '#059669'; // Green
      default:
        return '#6B7280'; // Gray
    }
  }

  /**
   * Get risk level background color for UI
   */
  getRiskLevelBackgroundColor(riskLevel: 'HIGH' | 'MEDIUM' | 'LOW'): string {
    switch (riskLevel) {
      case 'HIGH':
        return 'rgba(239, 68, 68, 0.1)'; // Light red
      case 'MEDIUM':
        return 'rgba(245, 158, 11, 0.1)'; // Light orange
      case 'LOW':
        return 'rgba(16, 185, 129, 0.1)'; // Light green
      default:
        return 'rgba(107, 114, 128, 0.1)'; // Light gray
    }
  }

  /**
   * Check if loan SOL is critical (expiring soon or expired)
   */
  isCritical(calculation: SOLCalculation): boolean {
    return calculation.is_expired || calculation.days_until_expiration <= 365;
  }

  /**
   * Get priority level for SOL management
   */
  getPriorityLevel(calculation: SOLCalculation): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    if (calculation.is_expired) {
      return 'CRITICAL';
    }
    
    if (calculation.days_until_expiration <= 90) {
      return 'CRITICAL';
    }
    
    if (calculation.days_until_expiration <= 365) {
      return 'HIGH';
    }
    
    if (calculation.days_until_expiration <= 730) {
      return 'MEDIUM';
    }
    
    return 'LOW';
  }
}

export default new SOLService();