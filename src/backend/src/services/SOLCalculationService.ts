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
  tolling_events: any[];
  total_tolled_days: number;
  adjusted_expiration_date: Date | null;
  sol_risk_score: number;
  sol_risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  risk_factors: any;
  calculation_date: Date;
}

export class SOLCalculationService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Calculate SOL for a single loan
   */
  async calculateLoanSOL(loanData: LoanSOLData): Promise<SOLCalculationResult | null> {
    try {
      // Get jurisdiction data
      const jurisdictionData = await this.getJurisdictionData(loanData.property_state);
      if (!jurisdictionData) {
        console.error(`No jurisdiction data found for state: ${loanData.property_state}`);
        return null;
      }

      // Get trigger events for this jurisdiction
      const triggerEvents = await this.getTriggerEvents(jurisdictionData.id);

      // Determine the applicable trigger date
      const { triggerEvent, triggerDate } = this.determineTriggerDate(loanData, triggerEvents);

      if (!triggerDate || !triggerEvent) {
        console.log(`No valid trigger date found for loan ${loanData.loan_id}`);
        return null;
      }

      // Calculate base expiration date
      const solPeriodYears = jurisdictionData.foreclosure_years || jurisdictionData.note_years || 6;
      const baseExpirationDate = new Date(triggerDate);
      baseExpirationDate.setFullYear(baseExpirationDate.getFullYear() + solPeriodYears);

      // Get tolling provisions (placeholder for now)
      const tollingData = await this.calculateTolling(loanData.loan_id, jurisdictionData.id, triggerDate);
      const adjustedExpirationDate = new Date(baseExpirationDate);
      adjustedExpirationDate.setDate(adjustedExpirationDate.getDate() + tollingData.totalDays);

      // Calculate days until expiration
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysUntilExpiration = Math.floor((adjustedExpirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const isExpired = daysUntilExpiration < 0;

      // Calculate risk score
      const riskScore = this.calculateRiskScore(
        daysUntilExpiration,
        jurisdictionData,
        loanData.foreclosure_status
      );

      // Determine risk level
      const riskLevel = this.determineRiskLevel(riskScore);

      return {
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
        sol_expiration_date: baseExpirationDate,
        days_until_expiration: daysUntilExpiration,
        is_expired: isExpired,
        tolling_events: tollingData.events,
        total_tolled_days: tollingData.totalDays,
        adjusted_expiration_date: adjustedExpirationDate,
        sol_risk_score: riskScore,
        sol_risk_level: riskLevel,
        risk_factors: {
          days_until_expiration: daysUntilExpiration,
          lien_extinguished: jurisdictionData.lien_extinguished,
          foreclosure_active: loanData.foreclosure_status === 'ACTIVE',
          jurisdiction_risk: jurisdictionData.risk_level
        },
        calculation_date: new Date()
      };
    } catch (error) {
      console.error(`Error calculating SOL for loan ${loanData.loan_id}:`, error);
      return null;
    }
  }

  /**
   * Get jurisdiction data including SOL periods and effects
   */
  private async getJurisdictionData(stateCode: string): Promise<JurisdictionData | null> {
    const query = `
      SELECT 
        j.id,
        j.state_code,
        j.risk_level,
        p.lien_years,
        p.note_years,
        p.foreclosure_years,
        e.lien_extinguished,
        e.foreclosure_barred
      FROM sol_jurisdictions j
      LEFT JOIN sol_periods p ON p.jurisdiction_id = j.id
      LEFT JOIN sol_expiration_effects e ON e.jurisdiction_id = j.id
      WHERE j.state_code = $1
    `;

    const result = await this.pool.query(query, [stateCode]);
    return result.rows[0] || null;
  }

  /**
   * Get trigger events for a jurisdiction
   */
  private async getTriggerEvents(jurisdictionId: number): Promise<TriggerEvent[]> {
    const query = `
      SELECT event_type, description
      FROM sol_trigger_events
      WHERE jurisdiction_id = $1
      ORDER BY id ASC
    `;

    const result = await this.pool.query(query, [jurisdictionId]);
    return result.rows;
  }

  /**
   * Determine which trigger event applies and the trigger date
   */
  private determineTriggerDate(loanData: LoanSOLData, triggerEvents: TriggerEvent[]): { triggerEvent: string | null; triggerDate: Date | null } {
    // Map trigger event types to loan data dates
    const dateMap: { [key: string]: Date | null | undefined } = {
      'acceleration_date': loanData.acceleration_date || loanData.complaint_filed_date,
      'maturity_date': loanData.maturity_date,
      'default_date': loanData.default_date,
      'last_payment_date': loanData.last_payment_date,
      'charge_off_date': loanData.charge_off_date,
      'complaint_filed': loanData.complaint_filed_date
    };

    // Check trigger events in order
    for (const trigger of triggerEvents) {
      const date = dateMap[trigger.event_type];
      if (date) {
        return { triggerEvent: trigger.event_type, triggerDate: date };
      }
    }

    // Fallback: use the most recent date
    const dates = Object.entries(dateMap)
      .filter(([_, date]) => date !== null && date !== undefined)
      .map(([event, date]) => ({ event, date: date as Date }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    if (dates.length > 0) {
      return { triggerEvent: dates[0].event, triggerDate: dates[0].date };
    }

    return { triggerEvent: null, triggerDate: null };
  }

  /**
   * Calculate tolling days (placeholder - would need bankruptcy/military service data)
   */
  private async calculateTolling(loanId: string, jurisdictionId: number, triggerDate: Date): Promise<{ events: any[]; totalDays: number }> {
    // TODO: Implement actual tolling calculation based on:
    // - Bankruptcy filings
    // - Military service
    // - Other jurisdiction-specific tolling events
    
    // For now, return no tolling
    return { events: [], totalDays: 0 };
  }

  /**
   * Calculate risk score (0-100)
   */
  private calculateRiskScore(daysUntilExpiration: number, jurisdiction: JurisdictionData, foreclosureStatus?: string): number {
    let score = 0;

    // Base score from days until expiration
    if (daysUntilExpiration < 0) {
      score = 100; // Already expired
    } else if (daysUntilExpiration < 90) {
      score = 90; // Less than 3 months
    } else if (daysUntilExpiration < 180) {
      score = 75; // Less than 6 months
    } else if (daysUntilExpiration < 365) {
      score = 60; // Less than 1 year
    } else if (daysUntilExpiration < 730) {
      score = 40; // Less than 2 years
    } else {
      score = 20; // More than 2 years
    }

    // Adjust for jurisdiction risk
    if (jurisdiction.risk_level === 'HIGH') {
      score = Math.min(100, score + 10);
    } else if (jurisdiction.risk_level === 'LOW') {
      score = Math.max(0, score - 10);
    }

    // Adjust for lien extinguishment
    if (jurisdiction.lien_extinguished && daysUntilExpiration < 365) {
      score = Math.min(100, score + 15);
    }

    // Reduce risk if foreclosure is already active
    if (foreclosureStatus === 'ACTIVE') {
      score = Math.max(0, score * 0.3); // Reduce by 70%
    }

    return Math.round(score);
  }

  /**
   * Determine risk level based on score
   */
  private determineRiskLevel(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (score >= 70) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Store calculation result in database
   */
  async storeCalculationResult(result: SOLCalculationResult): Promise<void> {
    const query = `
      INSERT INTO loan_sol_calculations (
        loan_id, jurisdiction_id, property_state,
        origination_date, maturity_date, default_date,
        last_payment_date, acceleration_date, charge_off_date,
        sol_trigger_event, sol_trigger_date, sol_expiration_date,
        days_until_expiration, is_expired, tolling_events,
        total_tolled_days, adjusted_expiration_date,
        sol_risk_score, sol_risk_level, risk_factors,
        calculation_date
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20, $21
      )
      ON CONFLICT (loan_id) DO UPDATE SET
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
        updated_at = CURRENT_TIMESTAMP
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
}