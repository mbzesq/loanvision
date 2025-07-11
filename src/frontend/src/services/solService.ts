import axiosInstance from '../utils/axios';

// SOL Risk Levels
export type SOLRiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

// SOL Jurisdiction Data
export interface SOLJurisdiction {
  state_code: string;
  state_name: string;
  foreclosure_types: string[];
  risk_level: SOLRiskLevel;
  lien_years?: number;
  note_years?: number;
  foreclosure_years?: number;
  lien_extinguished?: boolean;
  foreclosure_barred?: boolean;
  affected_loans?: number;
  expired_loans?: number;
  expiring_soon?: number;
}

// SOL Loan Calculation
export interface SOLCalculation {
  loan_id: string;
  jurisdiction_id: number;
  property_state: string;
  origination_date: string;
  maturity_date?: string;
  default_date?: string;
  last_payment_date?: string;
  acceleration_date?: string;
  sol_trigger_event: string;
  sol_trigger_date: string;
  sol_expiration_date: string;
  days_until_expiration: number;
  is_expired: boolean;
  tolling_events: any[];
  total_tolled_days: number;
  adjusted_expiration_date: string;
  sol_risk_score: number;
  sol_risk_level: SOLRiskLevel;
  risk_factors: {
    days_until_expiration: number;
    jurisdiction_risk: string;
    lien_extinguishment_risk: boolean;
    acceleration_risk: boolean;
    in_active_foreclosure?: boolean;
    risk_mitigation?: string;
  };
  calculation_date: string;
  jurisdiction_name?: string;
  jurisdiction_risk_level?: SOLRiskLevel;
}

// SOL Summary Data
export interface SOLSummary {
  total_loans: number;
  expired_count: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  alerts: string[];
}

// API Response Types
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class SOLService {
  /**
   * Get SOL summary statistics
   */
  async getSOLSummary(): Promise<SOLSummary> {
    try {
      const response = await axiosInstance.get<APIResponse<SOLSummary>>('/api/sol/summary');
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to fetch SOL summary');
    } catch (error) {
      console.error('Error fetching SOL summary:', error);
      throw error;
    }
  }

  /**
   * Get all SOL jurisdictions
   */
  async getJurisdictions(): Promise<SOLJurisdiction[]> {
    try {
      const response = await axiosInstance.get<APIResponse<SOLJurisdiction[]>>('/api/sol/jurisdictions');
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to fetch jurisdictions');
    } catch (error) {
      console.error('Error fetching jurisdictions:', error);
      throw error;
    }
  }

  /**
   * Get SOL calculation for a specific loan
   */
  async getLoanSOL(loanId: string): Promise<SOLCalculation | null> {
    try {
      const response = await axiosInstance.get<APIResponse<SOLCalculation>>(`/api/sol/loan/${loanId}`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching SOL for loan ${loanId}:`, error);
      return null;
    }
  }

  /**
   * Get SOL calculations for multiple loans at once (batch operation)
   */
  async getBatchLoanSOL(loanIds: string[]): Promise<Map<string, SOLCalculation>> {
    try {
      if (loanIds.length === 0) {
        return new Map();
      }

      console.log(`[SOLService] Fetching SOL data for ${loanIds.length} loans in batch...`);
      
      const response = await axiosInstance.post<APIResponse<SOLCalculation[]>>('/api/sol/loans/batch', {
        loan_ids: loanIds
      });
      
      if (response.data.success && response.data.data) {
        const solMap = new Map<string, SOLCalculation>();
        response.data.data.forEach(solCalc => {
          solMap.set(solCalc.loan_id, solCalc);
        });
        
        console.log(`[SOLService] Successfully loaded SOL data for ${solMap.size} loans`);
        return solMap;
      }
      
      console.warn('[SOLService] Batch SOL request failed:', response.data.error);
      return new Map();
    } catch (error) {
      console.error('Error fetching batch SOL data:', error);
      // For debugging - log the full error details
      if (error instanceof Error) {
        console.error('Batch SOL error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      return new Map();
    }
  }

  /**
   * Trigger portfolio SOL recalculation (admin function)
   */
  async triggerPortfolioCalculation(): Promise<{ updated: number; errors: number }> {
    try {
      const response = await axiosInstance.post<APIResponse<{ updated: number; errors: number }>>('/api/sol/calculate-portfolio');
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to trigger portfolio calculation');
    } catch (error) {
      console.error('Error triggering portfolio calculation:', error);
      throw error;
    }
  }

  /**
   * Format risk level for display
   */
  getRiskLevelColor(riskLevel: SOLRiskLevel): string {
    switch (riskLevel) {
      case 'HIGH':
        return 'text-red-600 bg-red-50';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-50';
      case 'LOW':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  }

  /**
   * Format risk level badge color
   */
  getRiskLevelBadgeColor(riskLevel: SOLRiskLevel): string {
    switch (riskLevel) {
      case 'HIGH':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  /**
   * Format days until expiration for display
   */
  formatDaysUntilExpiration(days: number): string {
    if (days < 0) {
      return `Expired ${Math.abs(days)} days ago`;
    } else if (days === 0) {
      return 'Expires today';
    } else if (days === 1) {
      return 'Expires tomorrow';
    } else if (days < 30) {
      return `Expires in ${days} days`;
    } else if (days < 365) {
      const months = Math.floor(days / 30);
      return `Expires in ${months} month${months > 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(days / 365);
      return `Expires in ${years} year${years > 1 ? 's' : ''}`;
    }
  }

  /**
   * Format trigger event for display
   */
  formatTriggerEvent(event: string): string {
    const eventMap: Record<string, string> = {
      'maturity_date': 'Maturity Date',
      'default_date': 'Default Date',
      'acceleration_date': 'Acceleration Date',
      'last_payment_date': 'Last Payment Date',
      'charge_off_date': 'Charge-Off Date',
      'no_valid_trigger': 'No Valid Trigger'
    };
    return eventMap[event] || event;
  }

  /**
   * Get SOL jurisdiction analysis data
   */
  async getJurisdictionAnalysis(): Promise<any[]> {
    try {
      const response = await axiosInstance.get<APIResponse<any[]>>('/api/sol/jurisdiction-analysis');
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to fetch jurisdiction analysis');
    } catch (error) {
      console.error('Error fetching SOL jurisdiction analysis:', error);
      throw error;
    }
  }

  /**
   * Get SOL trend analysis data
   */
  async getTrendAnalysis(): Promise<any[]> {
    try {
      const response = await axiosInstance.get<APIResponse<any[]>>('/api/sol/trend-analysis');
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to fetch trend analysis');
    } catch (error) {
      console.error('Error fetching SOL trend analysis:', error);
      throw error;
    }
  }

  /**
   * Get SOL geographic heat map data
   */
  async getGeographicHeatMap(): Promise<any[]> {
    try {
      const response = await axiosInstance.get<APIResponse<any[]>>('/api/sol/geographic-heatmap');
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to fetch geographic heat map');
    } catch (error) {
      console.error('Error fetching SOL geographic heat map:', error);
      throw error;
    }
  }

  /**
   * Get loans expiring in a specific month for clickable chart interaction
   */
  async getLoansByMonth(month: string): Promise<any[]> {
    try {
      const response = await axiosInstance.post<APIResponse<any[]>>('/api/sol/loans-by-month', {
        month
      });
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to fetch loans by month');
    } catch (error) {
      console.error(`Error fetching loans for month ${month}:`, error);
      throw error;
    }
  }

  /**
   * Get loans in a specific jurisdiction/state for clickable chart interaction
   */
  async getLoansByJurisdiction(state: string): Promise<{data: any[], summary: any, metadata: any}> {
    try {
      const response = await axiosInstance.post('/api/sol/loans-by-jurisdiction', {
        state
      });
      if (response.data.success && response.data.data) {
        return {
          data: response.data.data,
          summary: response.data.summary || {},
          metadata: response.data.metadata || {}
        };
      }
      throw new Error(response.data.error || 'Failed to fetch loans by jurisdiction');
    } catch (error) {
      console.error(`Error fetching loans for jurisdiction ${state}:`, error);
      throw error;
    }
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  }
}

export const solService = new SOLService();