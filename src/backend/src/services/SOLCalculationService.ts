import { Pool } from 'pg';
import { addDays, differenceInDays, max, isAfter, isBefore } from 'date-fns';

interface LoanSOLData {
  loan_id: string;
  property_state: string;
  origination_date: Date;
  maturity_date?: Date;
  default_date?: Date;
  last_payment_date?: Date;
  acceleration_date?: Date;
  charge_off_date?: Date;
  bankruptcy_dates?: Array<{start: Date, end?: Date}>;
  military_service?: boolean;
  foreclosure_status?: string;
  foreclosure_filing_date?: Date;
  complaint_filed_date?: Date;
}

interface SOLJurisdiction {
  id: number;
  state_code: string;
  risk_level: string;
  sol_periods: {
    lien_years?: number;
    note_years?: number;
    foreclosure_years?: number;
    deficiency_years?: number;
  };
  trigger_events: string[];
  tolling_provisions: string[];
  effect_of_expiration: {
    lien_extinguished: boolean;
    foreclosure_barred: boolean;
  };
}

interface SOLCalculationResult {
  loan_id: string;
  jurisdiction_id: number;
  sol_trigger_date: Date;
  sol_trigger_event: string;
  base_expiration_date: Date;
  tolling_events: Array<{
    type: string;
    start_date: Date;
    end_date?: Date;
    days_tolled: number;
  }>;
  total_tolled_days: number;
  adjusted_expiration_date: Date;
  days_until_expiration: number;
  is_expired: boolean;
  sol_risk_score: number;
  sol_risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  risk_factors: {
    days_until_expiration: number;
    jurisdiction_risk: string;
    lien_extinguishment_risk: boolean;
    acceleration_risk: boolean;
  };
}

export class SOLCalculationService {
  private pool: Pool;
  private jurisdictionCache: Map<string, SOLJurisdiction> = new Map();

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Calculate SOL for a single loan
   */
  async calculateLoanSOL(loanData: LoanSOLData): Promise<SOLCalculationResult | null> {
    // Get jurisdiction rules
    const jurisdiction = await this.getJurisdiction(loanData.property_state);
    if (!jurisdiction) {
      throw new Error(`No SOL rules found for state: ${loanData.property_state}`);
    }

    // Determine trigger date and event
    const { triggerDate, triggerEvent, isFutureTrigger } = this.determineTriggerDate(loanData, jurisdiction);
    
    // If no valid trigger found, we cannot calculate SOL
    if (!triggerDate) {
      console.warn(`No valid SOL trigger found for loan ${loanData.loan_id} in ${loanData.property_state}`);
      return null;
    }

    // Calculate base expiration date
    const solYears = this.getApplicableSOLPeriod(jurisdiction, triggerEvent);
    const baseExpirationDate = addDays(triggerDate, solYears * 365);

    // Calculate tolling events (only for past triggers)
    let tollingEvents: Array<{type: string; start_date: Date; end_date?: Date; days_tolled: number}> = [];
    let totalTolledDays = 0;
    
    if (!isFutureTrigger) {
      tollingEvents = await this.calculateTollingEvents(loanData, triggerDate, baseExpirationDate);
      totalTolledDays = tollingEvents.reduce((sum, event) => sum + event.days_tolled, 0);
    }

    // Calculate adjusted expiration date
    const adjustedExpirationDate = addDays(baseExpirationDate, totalTolledDays);

    // Calculate days until expiration
    const today = new Date();
    const daysUntilExpiration = differenceInDays(adjustedExpirationDate, today);
    
    // For future triggers, loan cannot be expired yet
    const isExpired = !isFutureTrigger && daysUntilExpiration < 0;

    // Check if loan is in active foreclosure
    const isInForeclosure = !!loanData.foreclosure_status && 
                           ['ACTIVE', 'IN_PROCESS', 'FILED'].includes(loanData.foreclosure_status.toUpperCase());

    // Calculate risk score and level
    const { riskScore, riskLevel, riskFactors } = this.calculateRiskAssessment(
      daysUntilExpiration,
      jurisdiction,
      triggerEvent === 'acceleration_date',
      isExpired,
      isInForeclosure
    );

    return {
      loan_id: loanData.loan_id,
      jurisdiction_id: jurisdiction.id,
      sol_trigger_date: triggerDate,
      sol_trigger_event: triggerEvent,
      base_expiration_date: baseExpirationDate,
      tolling_events: tollingEvents,
      total_tolled_days: totalTolledDays,
      adjusted_expiration_date: adjustedExpirationDate,
      days_until_expiration: daysUntilExpiration,
      is_expired: isExpired,
      sol_risk_score: riskScore,
      sol_risk_level: riskLevel,
      risk_factors: {
        ...riskFactors,
        future_trigger: isFutureTrigger || false
      }
    };
  }

  /**
   * Determine the SOL trigger date based on jurisdiction rules and loan events
   * IMPORTANT: We use the EARLIEST trigger date that applies to the jurisdiction
   * 
   * Example: NY loan with 2035 maturity and 6-year SOL:
   * - Without acceleration: SOL expires in 2041 (2035 + 6)
   * - If accelerated in 2025: SOL expires in 2031 (2025 + 6)
   * The acceleration creates an earlier trigger, moving up the SOL expiration
   */
  private determineTriggerDate(loan: LoanSOLData, jurisdiction: SOLJurisdiction): {
    triggerDate: Date | null;
    triggerEvent: string;
    isFutureTrigger?: boolean;
  } {
    const possibleTriggers: Array<{date: Date | undefined, event: string, isFuture?: boolean}> = [];
    const today = new Date();

    // For loans in foreclosure, use complaint filed date as acceleration date
    if (loan.foreclosure_status && loan.complaint_filed_date) {
      if (jurisdiction.trigger_events.includes('acceleration_date')) {
        possibleTriggers.push({ 
          date: loan.complaint_filed_date, 
          event: 'acceleration_date' 
        });
      }
    } else if (jurisdiction.trigger_events.includes('acceleration_date') && loan.acceleration_date) {
      // For non-foreclosure loans, use recorded acceleration date
      possibleTriggers.push({ date: loan.acceleration_date, event: 'acceleration_date' });
    }

    // Check other trigger event types
    if (jurisdiction.trigger_events.includes('maturity_date') && loan.maturity_date) {
      const isFuture = isAfter(loan.maturity_date, today);
      possibleTriggers.push({ 
        date: loan.maturity_date, 
        event: 'maturity_date',
        isFuture 
      });
    }
    
    if (jurisdiction.trigger_events.includes('default_date') && loan.default_date) {
      possibleTriggers.push({ date: loan.default_date, event: 'default_date' });
    }
    
    if (jurisdiction.trigger_events.includes('last_payment_date') && loan.last_payment_date) {
      possibleTriggers.push({ date: loan.last_payment_date, event: 'last_payment_date' });
    }
    
    if (jurisdiction.trigger_events.includes('charge_off_date') && loan.charge_off_date) {
      possibleTriggers.push({ date: loan.charge_off_date, event: 'charge_off_date' });
    }

    // Filter out undefined dates and sort by date (EARLIEST first)
    const validTriggers = possibleTriggers
      .filter(t => t.date !== undefined)
      .sort((a, b) => a.date!.getTime() - b.date!.getTime());

    // Separate past and future triggers
    const pastTriggers = validTriggers.filter(t => !t.isFuture);
    const futureTriggers = validTriggers.filter(t => t.isFuture);

    // Use the earliest PAST trigger if available
    if (pastTriggers.length > 0) {
      const trigger = pastTriggers[0];
      return { 
        triggerDate: trigger.date!, 
        triggerEvent: trigger.event,
        isFutureTrigger: false 
      };
    }

    // If no past triggers, use the earliest FUTURE trigger (e.g., maturity date)
    if (futureTriggers.length > 0) {
      const trigger = futureTriggers[0];
      return { 
        triggerDate: trigger.date!, 
        triggerEvent: trigger.event,
        isFutureTrigger: true 
      };
    }

    // If no valid triggers exist according to jurisdiction rules, return null
    // This means we cannot calculate SOL for this loan in this jurisdiction
    return { 
      triggerDate: null, 
      triggerEvent: 'no_valid_trigger' 
    };
  }

  /**
   * Get the applicable SOL period based on the trigger event
   */
  private getApplicableSOLPeriod(jurisdiction: SOLJurisdiction, triggerEvent: string): number {
    // Different trigger events may have different SOL periods
    if (triggerEvent === 'deficiency_date' && jurisdiction.sol_periods.deficiency_years) {
      return jurisdiction.sol_periods.deficiency_years;
    }
    
    // For mortgage/foreclosure actions
    if (jurisdiction.sol_periods.foreclosure_years) {
      return jurisdiction.sol_periods.foreclosure_years;
    }
    
    // For note-based actions
    if (jurisdiction.sol_periods.note_years) {
      return jurisdiction.sol_periods.note_years;
    }
    
    // For lien-based actions
    if (jurisdiction.sol_periods.lien_years) {
      return jurisdiction.sol_periods.lien_years;
    }
    
    // Default fallback
    return 6; // Most common default
  }

  /**
   * Calculate tolling events that pause the SOL clock
   */
  private async calculateTollingEvents(
    loan: LoanSOLData,
    triggerDate: Date,
    baseExpirationDate: Date
  ): Promise<Array<{type: string; start_date: Date; end_date?: Date; days_tolled: number}>> {
    const tollingEvents = [];

    // Bankruptcy tolling
    if (loan.bankruptcy_dates && loan.bankruptcy_dates.length > 0) {
      for (const bankruptcy of loan.bankruptcy_dates) {
        if (isAfter(bankruptcy.start, triggerDate) && isBefore(bankruptcy.start, baseExpirationDate)) {
          const endDate = bankruptcy.end || new Date(); // If still in bankruptcy
          const daysTolled = differenceInDays(endDate, bankruptcy.start);
          
          tollingEvents.push({
            type: 'bankruptcy_automatic_stay',
            start_date: bankruptcy.start,
            end_date: bankruptcy.end,
            days_tolled: Math.max(0, daysTolled)
          });
        }
      }
    }

    // Military service tolling (simplified)
    if (loan.military_service) {
      // SCRA provides minimum 90 days tolling
      tollingEvents.push({
        type: 'military_service',
        start_date: triggerDate,
        days_tolled: 90
      });
    }

    return tollingEvents;
  }

  /**
   * Calculate risk assessment based on multiple factors
   */
  private calculateRiskAssessment(
    daysUntilExpiration: number,
    jurisdiction: SOLJurisdiction,
    hasAcceleration: boolean,
    isExpired: boolean,
    isInForeclosure: boolean = false
  ): {
    riskScore: number;
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    riskFactors: any;
  } {
    let riskScore = 0;

    // If loan is actively in foreclosure, significantly reduce risk
    // SOL serves to bar foreclosure, so if we've already begun, risk is lower
    const foreclosureReduction = isInForeclosure ? 0.3 : 1.0; // 70% risk reduction

    // Time-based risk (0-40 points)
    if (isExpired && !isInForeclosure) {
      riskScore += 40;
    } else if (daysUntilExpiration < 365) {
      riskScore += Math.floor(35 * foreclosureReduction);
    } else if (daysUntilExpiration < 730) {
      riskScore += Math.floor(25 * foreclosureReduction);
    } else if (daysUntilExpiration < 1095) {
      riskScore += Math.floor(15 * foreclosureReduction);
    } else if (daysUntilExpiration < 1825) {
      riskScore += Math.floor(5 * foreclosureReduction);
    }

    // Jurisdiction risk (0-30 points)
    if (jurisdiction.risk_level === 'HIGH') {
      riskScore += Math.floor(30 * foreclosureReduction);
    } else if (jurisdiction.risk_level === 'MEDIUM') {
      riskScore += Math.floor(15 * foreclosureReduction);
    }

    // Lien extinguishment risk (0-20 points)
    // This risk remains even in foreclosure as it could affect deficiency
    if (jurisdiction.effect_of_expiration.lien_extinguished) {
      riskScore += isInForeclosure ? 10 : 20;
    }

    // Acceleration risk (0-10 points)
    // Less relevant if already in foreclosure
    if (hasAcceleration && !isInForeclosure) {
      riskScore += 10;
    }

    // Determine risk level
    let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    if (riskScore >= 70) {
      riskLevel = 'HIGH';
    } else if (riskScore >= 40) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
    }

    const riskFactors = {
      days_until_expiration: daysUntilExpiration,
      jurisdiction_risk: jurisdiction.risk_level,
      lien_extinguishment_risk: jurisdiction.effect_of_expiration.lien_extinguished,
      acceleration_risk: hasAcceleration,
      in_active_foreclosure: isInForeclosure,
      risk_mitigation: isInForeclosure ? 'Active foreclosure reduces SOL risk' : null
    };

    return { riskScore, riskLevel, riskFactors };
  }

  /**
   * Get jurisdiction rules from cache or database
   */
  private async getJurisdiction(stateCode: string): Promise<SOLJurisdiction | null> {
    // Check cache first
    if (this.jurisdictionCache.has(stateCode)) {
      return this.jurisdictionCache.get(stateCode)!;
    }

    // Query database
    const query = `
      SELECT 
        j.id,
        j.state_code,
        j.risk_level,
        json_build_object(
          'lien_years', p.lien_years,
          'note_years', p.note_years,
          'foreclosure_years', p.foreclosure_years,
          'deficiency_years', p.deficiency_years
        ) as sol_periods,
        array_agg(DISTINCT te.event_type) as trigger_events,
        array_agg(DISTINCT tp.provision_type) as tolling_provisions,
        json_build_object(
          'lien_extinguished', ee.lien_extinguished,
          'foreclosure_barred', ee.foreclosure_barred
        ) as effect_of_expiration
      FROM sol_jurisdictions j
      LEFT JOIN sol_periods p ON p.jurisdiction_id = j.id
      LEFT JOIN sol_trigger_events te ON te.jurisdiction_id = j.id
      LEFT JOIN sol_tolling_provisions tp ON tp.jurisdiction_id = j.id
      LEFT JOIN sol_expiration_effects ee ON ee.jurisdiction_id = j.id
      WHERE j.state_code = $1
      GROUP BY j.id, j.state_code, j.risk_level, p.lien_years, p.note_years, 
               p.foreclosure_years, p.deficiency_years, ee.lien_extinguished, ee.foreclosure_barred
    `;

    const result = await this.pool.query(query, [stateCode]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const jurisdiction = result.rows[0];
    this.jurisdictionCache.set(stateCode, jurisdiction);
    
    return jurisdiction;
  }

  /**
   * Store calculation results in the database
   */
  async storeCalculationResult(result: SOLCalculationResult): Promise<void> {
    const query = `
      INSERT INTO loan_sol_calculations (
        loan_id, jurisdiction_id, property_state,
        sol_trigger_date, sol_trigger_event, sol_expiration_date,
        days_until_expiration, is_expired,
        tolling_events, total_tolled_days, adjusted_expiration_date,
        sol_risk_score, sol_risk_level, risk_factors
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (loan_id) DO UPDATE SET
        jurisdiction_id = EXCLUDED.jurisdiction_id,
        sol_trigger_date = EXCLUDED.sol_trigger_date,
        sol_trigger_event = EXCLUDED.sol_trigger_event,
        sol_expiration_date = EXCLUDED.sol_expiration_date,
        days_until_expiration = EXCLUDED.days_until_expiration,
        is_expired = EXCLUDED.is_expired,
        tolling_events = EXCLUDED.tolling_events,
        total_tolled_days = EXCLUDED.total_tolled_days,
        adjusted_expiration_date = EXCLUDED.adjusted_expiration_date,
        sol_risk_score = EXCLUDED.sol_risk_score,
        sol_risk_level = EXCLUDED.sol_risk_level,
        risk_factors = EXCLUDED.risk_factors,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.pool.query(query, [
      result.loan_id,
      result.jurisdiction_id,
      result.loan_id, // Will need to get property_state from loan
      result.sol_trigger_date,
      result.sol_trigger_event,
      result.base_expiration_date,
      result.days_until_expiration,
      result.is_expired,
      JSON.stringify(result.tolling_events),
      result.total_tolled_days,
      result.adjusted_expiration_date,
      result.sol_risk_score,
      result.sol_risk_level,
      JSON.stringify(result.risk_factors)
    ]);
  }

  /**
   * Calculate SOL for all loans in the portfolio
   */
  async calculatePortfolioSOL(): Promise<{processed: number; errors: number}> {
    console.log('🔄 Starting portfolio-wide SOL calculation...');
    
    let processed = 0;
    let errors = 0;
    const batchSize = 100;
    let offset = 0;

    while (true) {
      // Get batch of loans
      const loansQuery = `
        SELECT 
          l.id as loan_id,
          l.property_state,
          l.origination_date,
          l.maturity_date,
          ld.first_default_date as default_date,
          ld.last_payment_date,
          ld.acceleration_date,
          ld.charge_off_date
        FROM loans l
        LEFT JOIN loan_details ld ON ld.loan_id = l.id
        WHERE l.property_state IS NOT NULL
        ORDER BY l.id
        LIMIT $1 OFFSET $2
      `;

      const loansResult = await this.pool.query(loansQuery, [batchSize, offset]);
      
      if (loansResult.rows.length === 0) {
        break;
      }

      // Process each loan
      for (const loan of loansResult.rows) {
        try {
          const loanData: LoanSOLData = {
            loan_id: loan.loan_id,
            property_state: loan.property_state,
            origination_date: loan.origination_date,
            maturity_date: loan.maturity_date,
            default_date: loan.default_date,
            last_payment_date: loan.last_payment_date,
            acceleration_date: loan.acceleration_date,
            charge_off_date: loan.charge_off_date
          };

          const result = await this.calculateLoanSOL(loanData);
          if (result) {
            await this.storeCalculationResult(result);
            processed++;
          }
          
          if (processed % 100 === 0) {
            console.log(`  Processed ${processed} loans...`);
          }
        } catch (error) {
          console.error(`Error processing loan ${loan.loan_id}:`, error);
          errors++;
        }
      }

      offset += batchSize;
    }

    console.log(`✅ Completed SOL calculation: ${processed} processed, ${errors} errors`);
    return { processed, errors };
  }
}