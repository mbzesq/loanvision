import { Pool } from 'pg';
import { SOLCalculationService } from './SOLCalculationService';

interface LoanEvent {
  loan_id: string;
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
        SELECT DISTINCT 
               dmc.loan_id,
               dmc.state as property_state,
               lsc.days_until_expiration,
               lsc.updated_at as last_sol_update
        FROM daily_metrics_current dmc
        LEFT JOIN loan_sol_calculations lsc ON lsc.loan_id = dmc.loan_id
        WHERE dmc.state IS NOT NULL
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
          const loanData = await this.getLoanData(loan.loan_id);
          if (loanData) {
            const solResult = await this.solService.calculateLoanSOL(loanData);
            if (solResult) {
              await this.solService.storeCalculationResult(solResult);
              updated++;
            }
          }
        } catch (error) {
          console.error(`Failed to update loan ${loan.loan_id}:`, error);
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
  private async getLoanData(loanId: string): Promise<any> {
    const query = `
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
        -- Use complaint_filed_date as acceleration_date when loan is in foreclosure
        CASE 
          WHEN fe.complaint_filed_date IS NOT NULL THEN fe.complaint_filed_date
          ELSE NULL
        END as acceleration_date
      FROM daily_metrics_current dmc
      LEFT JOIN foreclosure_events fe ON fe.loan_id = dmc.loan_id
      WHERE dmc.loan_id = $1
    `;

    const result = await this.pool.query(query, [loanId]);
    return result.rows[0] || null;
  }

  /**
   * Log significant SOL changes for audit trail
   */
  private async logSOLChange(loanId: string, event: LoanEvent, solResult: any): Promise<void> {
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
   * Check for loans approaching SOL expiration and return alerts
   */
  async checkExpirationAlerts(): Promise<string[]> {
    const alerts: string[] = [];

    // Get loans expiring in the next 30, 60, and 90 days
    const alertQuery = `
      SELECT 
        lsc.loan_id,
        lsc.property_state,
        lsc.days_until_expiration,
        lsc.adjusted_expiration_date,
        lsc.sol_risk_level
      FROM loan_sol_calculations lsc
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
      
      alerts.push(`${alertLevel}: Loan ${loan.loan_id} (${loan.property_state}) expires in ${days} days`);
    }

    return alerts;
  }

  /**
   * Update SOL calculation when specific loan events occur
   */
  async triggerSOLUpdateForLoan(loanId: string, eventType: string = 'status_change'): Promise<boolean> {
    try {
      await this.handleLoanEvent({
        loan_id: loanId,
        event_type: eventType as any,
        event_date: new Date()
      });
      return true;
    } catch (error) {
      console.error(`Failed to trigger SOL update for loan ${loanId}:`, error);
      return false;
    }
  }

  /**
   * Get SOL summary statistics
   */
  async getSOLSummary(): Promise<{
    total_loans: number;
    expired_count: number;
    high_risk_count: number;
    medium_risk_count: number;
    low_risk_count: number;
    alerts: string[];
  }> {
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_loans,
        SUM(CASE WHEN is_expired THEN 1 ELSE 0 END) as expired_count,
        SUM(CASE WHEN sol_risk_level = 'HIGH' THEN 1 ELSE 0 END) as high_risk_count,
        SUM(CASE WHEN sol_risk_level = 'MEDIUM' THEN 1 ELSE 0 END) as medium_risk_count,
        SUM(CASE WHEN sol_risk_level = 'LOW' THEN 1 ELSE 0 END) as low_risk_count
      FROM loan_sol_calculations
    `;

    const result = await this.pool.query(summaryQuery);
    const summary = result.rows[0];

    // Get current alerts
    const alerts = await this.checkExpirationAlerts();

    return {
      total_loans: parseInt(summary.total_loans),
      expired_count: parseInt(summary.expired_count),
      high_risk_count: parseInt(summary.high_risk_count),
      medium_risk_count: parseInt(summary.medium_risk_count),
      low_risk_count: parseInt(summary.low_risk_count),
      alerts
    };
  }
}