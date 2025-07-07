import { Pool } from 'pg';

interface LoanSOLData {
  loan_id: string;
  property_state: string;
  origination_date: Date | null;
  maturity_date: Date | null;
  default_date: Date | null;
  last_payment_date: Date | null;
  acceleration_date: Date | null;
  charge_off_date: Date | null;
  foreclosure_status?: string;
  complaint_filed_date?: Date | null;
}

interface JurisdictionData {
  id: number;
  state_code: string;
  lien_years: number | null;
  note_years: number | null;
  foreclosure_years: number | null;
  lien_extinguished: boolean;
  foreclosure_barred: boolean;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface TriggerEvent {
  event_type: string;
  description: string;
}

interface TollingProvision {
  provision_name: string;
  description: string;
}

interface SOLCalculationResult {
  loan_id: string;
  jurisdiction_id: number;
  property_state: string;
  origination_date: Date | null;
  maturity_date: Date | null;
  default_date: Date | null;
  last_payment_date: Date | null;
  acceleration_date: Date | null;
  charge_off_date: Date | null;
  sol_trigger_event: string | null;
  sol_trigger_date: Date | null;
  sol_expiration_date: Date | null;
  days_until_expiration: number | null;
  is_expired: boolean;
  tolling_events: TollingProvision[];
  total_tolled_days: number;
  adjusted_expiration_date: Date | null;
  sol_risk_score: number;
  sol_risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  risk_factors: string[];
  calculation_date: Date;
}

export class SOLCalculationService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Calculate SOL for a specific loan
   */
  async calculateLoanSOL(loanData: LoanSOLData): Promise<SOLCalculationResult | null> {
    console.log(`🔍 Calculating SOL for loan ${loanData.loan_id} in ${loanData.property_state}`);

    try {
      // Get jurisdiction data for the property state
      const jurisdictionData = await this.getJurisdictionData(loanData.property_state);
      if (!jurisdictionData) {
        console.warn(`No jurisdiction data found for state: ${loanData.property_state}`);
        return null;
      }

      // Determine trigger date and event
      const { date: triggerDate, event: triggerEvent } = this.determineTriggerDate(loanData);
      
      if (!triggerDate) {
        console.warn(`No valid trigger date found for loan ${loanData.loan_id}`);
        return null;
      }

      // Calculate expiration date
      const solYears = this.getSolPeriod(jurisdictionData, triggerEvent);
      if (!solYears) {
        console.warn(`No SOL period found for jurisdiction ${jurisdictionData.state_code}`);
        return null;
      }

      // Calculate basic expiration date
      const expirationDate = new Date(triggerDate);
      expirationDate.setFullYear(expirationDate.getFullYear() + solYears);

      // Calculate tolling events (future enhancement)
      const tollingEvents: TollingProvision[] = [];
      const totalTolledDays = 0;

      // Adjusted expiration date (including tolling)
      const adjustedExpirationDate = new Date(expirationDate);
      adjustedExpirationDate.setDate(adjustedExpirationDate.getDate() + totalTolledDays);

      // Calculate days until expiration
      const today = new Date();
      const daysUntilExpiration = Math.ceil((adjustedExpirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const isExpired = daysUntilExpiration < 0;

      // Calculate risk score and level
      const riskScore = this.calculateRiskScore(daysUntilExpiration, jurisdictionData.risk_level, isExpired);
      const riskLevel = this.determineRiskLevel(daysUntilExpiration, isExpired);

      // Determine risk factors
      const riskFactors = this.identifyRiskFactors(loanData, jurisdictionData, daysUntilExpiration);

      const result: SOLCalculationResult = {
        loan_id: loanData.loan_id,
        jurisdiction_id: jurisdictionData.id,
        property_state: loanData.property_state,
        origination_date: loanData.origination_date,
        maturity_date: loanData.maturity_date,
        default_date: loanData.default_date,
        last_payment_date: loanData.last_payment_date,
        acceleration_date: loanData.acceleration_date,
        charge_off_date: loanData.charge_off_date,
        sol_trigger_event: triggerEvent,
        sol_trigger_date: triggerDate,
        sol_expiration_date: expirationDate,
        days_until_expiration: daysUntilExpiration,
        is_expired: isExpired,
        tolling_events: tollingEvents,
        total_tolled_days: totalTolledDays,
        adjusted_expiration_date: adjustedExpirationDate,
        sol_risk_score: riskScore,
        sol_risk_level: riskLevel,
        risk_factors: riskFactors,
        calculation_date: new Date()
      };

      console.log(`✅ SOL calculated for loan ${loanData.loan_id}: ${riskLevel} risk, ${daysUntilExpiration} days until expiration`);
      return result;

    } catch (error) {
      console.error(`❌ Error calculating SOL for loan ${loanData.loan_id}:`, error);
      return null;
    }
  }

  /**
   * Calculate SOL for entire portfolio
   */
  async calculatePortfolioSOL(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      // Get all loans with property state
      const loansQuery = `
        SELECT 
          dmc.loan_id,
          dmc.state as property_state,
          dmc.origination_date,
          dmc.maturity_date,
          dmc.next_pymt_due as default_date,
          dmc.last_pymt_received as last_payment_date,
          NULL as charge_off_date,
          fe.fc_status as foreclosure_status,
          fe.complaint_filed_date,
          CASE 
            WHEN fe.complaint_filed_date IS NOT NULL THEN fe.complaint_filed_date
            ELSE NULL
          END as acceleration_date
        FROM daily_metrics_current dmc
        LEFT JOIN foreclosure_events fe ON fe.loan_id = dmc.loan_id
        WHERE dmc.state IS NOT NULL
        ORDER BY dmc.loan_id
      `;

      const loansResult = await this.pool.query(loansQuery);
      
      for (const loan of loansResult.rows) {
        try {
          const result = await this.calculateLoanSOL(loan);
          
          if (result) {
            await this.storeCalculationResult(result);
            processed++;
          }
        } catch (error) {
          console.error(`Error processing loan ${loan.loan_id}:`, error);
          errors++;
        }
      }
    } catch (error) {
      console.error('Fatal error in calculatePortfolioSOL:', error);
      throw error;
    }

    return { processed, errors };
  }

  /**
   * Store SOL calculation result in database
   */
  async storeCalculationResult(result: SOLCalculationResult): Promise<void> {
    const query = `
      INSERT INTO loan_sol_calculations (
        loan_id, jurisdiction_id, property_state, origination_date, maturity_date,
        default_date, last_payment_date, acceleration_date, charge_off_date,
        sol_trigger_event, sol_trigger_date, sol_expiration_date, days_until_expiration,
        is_expired, tolling_events, total_tolled_days, adjusted_expiration_date,
        sol_risk_score, sol_risk_level, risk_factors, calculation_date
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      )
      ON CONFLICT (loan_id) 
      DO UPDATE SET
        jurisdiction_id = EXCLUDED.jurisdiction_id,
        property_state = EXCLUDED.property_state,
        origination_date = EXCLUDED.origination_date,
        maturity_date = EXCLUDED.maturity_date,
        default_date = EXCLUDED.default_date,
        last_payment_date = EXCLUDED.last_payment_date,
        acceleration_date = EXCLUDED.acceleration_date,
        charge_off_date = EXCLUDED.charge_off_date,
        sol_trigger_event = EXCLUDED.sol_trigger_event,
        sol_trigger_date = EXCLUDED.sol_trigger_date,
        sol_expiration_date = EXCLUDED.sol_expiration_date,
        days_until_expiration = EXCLUDED.days_until_expiration,
        is_expired = EXCLUDED.is_expired,
        tolling_events = EXCLUDED.tolling_events,
        total_tolled_days = EXCLUDED.total_tolled_days,
        adjusted_expiration_date = EXCLUDED.adjusted_expiration_date,
        sol_risk_score = EXCLUDED.sol_risk_score,
        sol_risk_level = EXCLUDED.sol_risk_level,
        risk_factors = EXCLUDED.risk_factors,
        calculation_date = EXCLUDED.calculation_date,
        updated_at = NOW()
    `;

    await this.pool.query(query, [
      result.loan_id,
      result.jurisdiction_id,
      result.property_state,
      result.origination_date,
      result.maturity_date,
      result.default_date,
      result.last_payment_date,
      result.acceleration_date,
      result.charge_off_date,
      result.sol_trigger_event,
      result.sol_trigger_date,
      result.sol_expiration_date,
      result.days_until_expiration,
      result.is_expired,
      JSON.stringify(result.tolling_events),
      result.total_tolled_days,
      result.adjusted_expiration_date,
      result.sol_risk_score,
      result.sol_risk_level,
      JSON.stringify(result.risk_factors),
      result.calculation_date
    ]);
  }

  /**
   * Get jurisdiction data for a state
   */
  private async getJurisdictionData(stateCode: string): Promise<JurisdictionData | null> {
    const query = `
      SELECT id, state_code, lien_years, note_years, foreclosure_years, 
             lien_extinguished, foreclosure_barred, risk_level
      FROM sol_jurisdictions 
      WHERE state_code = $1
    `;
    
    const result = await this.pool.query(query, [stateCode.toUpperCase()]);
    return result.rows[0] || null;
  }

  /**
   * Determine the trigger date for SOL calculation
   */
  private determineTriggerDate(loanData: LoanSOLData): { date: Date | null; event: string | null } {
    const candidates = [
      { date: loanData.acceleration_date, event: 'acceleration_date', priority: 1 },
      { date: loanData.default_date, event: 'default_date', priority: 2 },
      { date: loanData.last_payment_date, event: 'last_payment_date', priority: 3 },
      { date: loanData.maturity_date, event: 'maturity_date', priority: 4 },
      { date: loanData.charge_off_date, event: 'charge_off_date', priority: 5 }
    ];

    // Find the highest priority valid date
    for (const candidate of candidates) {
      if (candidate.date && candidate.date instanceof Date && !isNaN(candidate.date.getTime())) {
        return { date: candidate.date, event: candidate.event };
      }
    }

    return { date: null, event: null };
  }

  /**
   * Get SOL period in years for jurisdiction and event type
   */
  private getSolPeriod(jurisdiction: JurisdictionData, eventType: string | null): number | null {
    // Default to note years if available, otherwise lien years
    if (jurisdiction.note_years) {
      return jurisdiction.note_years;
    }
    
    if (jurisdiction.lien_years) {
      return jurisdiction.lien_years;
    }

    return null;
  }

  /**
   * Calculate risk score (0-100) based on days until expiration
   */
  private calculateRiskScore(daysUntilExpiration: number | null, jurisdictionRisk: string, isExpired: boolean): number {
    if (isExpired) {
      return 100; // Maximum risk
    }

    if (daysUntilExpiration === null || daysUntilExpiration < 0) {
      return 100;
    }

    // Base score on days until expiration
    let score = 0;
    
    if (daysUntilExpiration <= 30) {
      score = 90; // Critical
    } else if (daysUntilExpiration <= 90) {
      score = 75; // High
    } else if (daysUntilExpiration <= 180) {
      score = 60; // Medium-High
    } else if (daysUntilExpiration <= 365) {
      score = 40; // Medium
    } else if (daysUntilExpiration <= 730) {
      score = 20; // Low-Medium
    } else {
      score = 10; // Low
    }

    // Adjust based on jurisdiction risk
    if (jurisdictionRisk === 'HIGH') {
      score += 10;
    } else if (jurisdictionRisk === 'LOW') {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine risk level based on days until expiration
   */
  private determineRiskLevel(daysUntilExpiration: number | null, isExpired: boolean): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (isExpired) {
      return 'HIGH';
    }

    if (daysUntilExpiration === null || daysUntilExpiration < 0) {
      return 'HIGH';
    }

    if (daysUntilExpiration <= 365) {
      return 'HIGH';
    } else if (daysUntilExpiration <= 1095) { // 3 years
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  /**
   * Identify risk factors for the loan
   */
  private identifyRiskFactors(loanData: LoanSOLData, jurisdiction: JurisdictionData, daysUntilExpiration: number | null): string[] {
    const factors: string[] = [];

    if (daysUntilExpiration !== null && daysUntilExpiration < 365) {
      factors.push('Expiring within 1 year');
    }

    if (jurisdiction.lien_extinguished) {
      factors.push('Lien may be extinguished on expiration');
    }

    if (jurisdiction.foreclosure_barred) {
      factors.push('Foreclosure may be barred on expiration');
    }

    if (jurisdiction.risk_level === 'HIGH') {
      factors.push('High-risk jurisdiction');
    }

    if (loanData.acceleration_date) {
      factors.push('Loan has been accelerated');
    }

    return factors;
  }
}