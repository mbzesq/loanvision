import { Pool } from 'pg';
import { SOLCalculationService } from './SOLCalculationService';

interface LoanEvent {
  loan_id: number;
  event_type: 'payment_received' | 'missed_payment' | 'foreclosure_filed' | 'acceleration' | 'maturity_reached' | 'status_change';
  event_date: Date;
  metadata?: any;
}

export class SOLEventService {
  private pool: Pool;
  private solService: SOLCalculationService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.solService = new SOLCalculationService(pool);
  }

  /**
   * Handle loan events that could affect SOL calculations
   */
  async handleLoanEvent(event: LoanEvent): Promise<void> {
    console.log(`🔄 Processing SOL event: ${event.event_type} for loan ${event.loan_id}`);

    try {
      // Get current loan data
      const loanData = await this.getLoanData(event.loan_id);
      if (!loanData) {
        console.warn(`Loan ${event.loan_id} not found`);
        return;
      }

      // Calculate updated SOL
      const solResult = await this.solService.calculateLoanSOL(loanData);
      
      if (solResult) {
        await this.solService.storeCalculationResult(solResult);
        console.log(`✅ Updated SOL for loan ${event.loan_id}`);
        
        // Log significant changes
        await this.logSOLChange(event.loan_id, event, solResult);
      }
    } catch (error) {
      console.error(`❌ Failed to update SOL for loan ${event.loan_id}:`, error);
    }
  }

  /**
   * Daily batch update for time-sensitive SOL calculations
   */
  async runDailySOLUpdate(): Promise<{updated: number; errors: number}> {
    console.log('🕒 Running daily SOL update...');
    
    let updated = 0;
    let errors = 0;

    try {
      // Get loans that need SOL recalculation:
      // 1. Loans with no SOL calculation
      // 2. Loans with SOL calculations older than 24 hours
      // 3. Loans approaching expiration (within 1 year)
      const loansToUpdate = await this.pool.query(`
        SELECT DISTINCT l.id, l.property_state,
               lsc.days_until_expiration,
               lsc.updated_at as last_sol_update
        FROM loans l
        LEFT JOIN loan_sol_calculations lsc ON lsc.loan_id = l.id
        WHERE l.property_state IS NOT NULL
        AND (
          lsc.id IS NULL  -- No SOL calculation
          OR lsc.updated_at < NOW() - INTERVAL '24 hours'  -- Stale calculation
          OR (lsc.days_until_expiration < 365 AND lsc.days_until_expiration > 0)  -- Approaching expiration
        )
        ORDER BY 
          CASE 
            WHEN lsc.days_until_expiration < 90 THEN 1  -- Critical (< 3 months)
            WHEN lsc.days_until_expiration < 365 THEN 2 -- Important (< 1 year)
            WHEN lsc.id IS NULL THEN 3  -- No calculation
            ELSE 4  -- Stale calculations
          END,
          lsc.days_until_expiration ASC NULLS LAST
        LIMIT 1000  -- Process in batches
      `);

      console.log(`📊 Found ${loansToUpdate.rows.length} loans needing SOL updates`);

      for (const loan of loansToUpdate.rows) {
        try {
          const loanData = await this.getLoanData(loan.id);
          if (loanData) {
            const solResult = await this.solService.calculateLoanSOL(loanData);
            if (solResult) {
              await this.solService.storeCalculationResult(solResult);
              updated++;
            }
          }
        } catch (error) {
          console.error(`Failed to update loan ${loan.id}:`, error);
          errors++;
        }
      }

      console.log(`✅ Daily SOL update completed: ${updated} updated, ${errors} errors`);
      
      // Log the batch update
      await this.logBatchUpdate(updated, errors);
      
    } catch (error) {
      console.error('❌ Daily SOL update failed:', error);
      throw error;
    }

    return { updated, errors };
  }

  /**
   * Get current loan data for SOL calculation
   */
  private async getLoanData(loanId: number): Promise<any> {
    const query = `
      SELECT 
        l.id as loan_id,
        l.property_state,
        l.origination_date,
        l.maturity_date,
        ld.first_default_date as default_date,
        ld.last_payment_date,
        ld.acceleration_date,
        ld.charge_off_date,
        fs.status as foreclosure_status,
        fs.complaint_filed_date
      FROM loans l
      LEFT JOIN loan_details ld ON ld.loan_id = l.id
      LEFT JOIN foreclosure_status fs ON fs.loan_id = l.id
      WHERE l.id = $1
    `;

    const result = await this.pool.query(query, [loanId]);
    return result.rows[0] || null;
  }

  /**
   * Log significant SOL changes for audit trail
   */
  private async logSOLChange(loanId: number, event: LoanEvent, solResult: any): Promise<void> {
    // Only log significant changes
    if (solResult.is_expired || solResult.days_until_expiration < 365) {
      await this.pool.query(`
        INSERT INTO sol_audit_log (loan_id, event_type, event_date, sol_data, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT DO NOTHING
      `, [
        loanId,
        event.event_type,
        event.event_date,
        JSON.stringify({
          trigger_event: solResult.sol_trigger_event,
          trigger_date: solResult.sol_trigger_date,
          expiration_date: solResult.adjusted_expiration_date,
          days_until_expiration: solResult.days_until_expiration,
          risk_level: solResult.sol_risk_level,
          is_expired: solResult.is_expired
        })
      ]);
    }
  }

  /**
   * Log batch update results
   */
  private async logBatchUpdate(updated: number, errors: number): Promise<void> {
    await this.pool.query(`
      INSERT INTO sol_batch_log (update_date, loans_updated, errors, created_at)
      VALUES (CURRENT_DATE, $1, $2, NOW())
      ON CONFLICT (update_date) DO UPDATE SET
        loans_updated = EXCLUDED.loans_updated,
        errors = EXCLUDED.errors,
        created_at = EXCLUDED.created_at
    `, [updated, errors]);
  }

  /**
   * Check for loans approaching SOL expiration and send alerts
   */
  async checkExpirationAlerts(): Promise<string[]> {
    const alerts: string[] = [];

    // Get loans expiring in the next 30, 60, and 90 days
    const alertQuery = `
      SELECT 
        l.loan_number,
        l.property_state,
        lsc.days_until_expiration,
        lsc.adjusted_expiration_date,
        lsc.sol_risk_level
      FROM loans l
      JOIN loan_sol_calculations lsc ON lsc.loan_id = l.id
      WHERE lsc.days_until_expiration BETWEEN 0 AND 90
      AND lsc.is_expired = false
      ORDER BY lsc.days_until_expiration ASC
    `;

    const result = await this.pool.query(alertQuery);
    
    for (const loan of result.rows) {
      const days = loan.days_until_expiration;
      let alertLevel = '';
      
      if (days <= 30) alertLevel = 'CRITICAL';
      else if (days <= 60) alertLevel = 'HIGH';
      else alertLevel = 'MEDIUM';
      
      alerts.push(`${alertLevel}: Loan ${loan.loan_number} (${loan.property_state}) expires in ${days} days`);
    }

    return alerts;
  }
}