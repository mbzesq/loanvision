import express from 'express';
import { Pool } from 'pg';
import { SOLCalculationService } from '../services/SOLCalculationService';
import { SOLEventService } from '../services/SOLEventService';

const router = express.Router();

// Initialize services - use same database config as main app
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const solCalculationService = new SOLCalculationService(pool);
const solEventService = new SOLEventService(pool);

/**
 * GET /api/sol/summary
 * Get SOL summary statistics for dashboard
 */
router.get('/summary', async (req, res) => {
  try {
    console.log('📊 Fetching SOL summary...');
    const summary = await solEventService.getSOLSummary();
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('❌ Error fetching SOL summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SOL summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/sol/dashboard-data
 * Alternative endpoint name for dashboard compatibility
 */
router.get('/dashboard-data', async (req, res) => {
  try {
    console.log('📊 Fetching SOL dashboard data...');
    const summary = await solEventService.getSOLSummary();
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('❌ Error fetching SOL dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SOL dashboard data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/sol/loan/:loanId
 * Get SOL calculation for a specific loan
 */
router.get('/loan/:loanId', async (req, res) => {
  try {
    const { loanId } = req.params;
    console.log(`🔍 Fetching SOL data for loan: ${loanId}`);
    
    // Get existing SOL calculation from database
    const solQuery = `
      SELECT 
        loan_id,
        jurisdiction_id,
        property_state,
        origination_date,
        maturity_date,
        default_date,
        last_payment_date,
        acceleration_date,
        charge_off_date,
        sol_trigger_event,
        sol_trigger_date,
        sol_expiration_date,
        days_until_expiration,
        is_expired,
        tolling_events,
        total_tolled_days,
        adjusted_expiration_date,
        sol_risk_score,
        sol_risk_level,
        risk_factors,
        calculation_date,
        created_at,
        updated_at
      FROM loan_sol_calculations 
      WHERE loan_id = $1
    `;
    
    const solResult = await pool.query(solQuery, [loanId]);
    
    if (solResult.rows.length === 0) {
      // No pre-calculated SOL data exists, attempt dynamic calculation
      console.log(`⚡ No pre-calculated SOL found for loan ${loanId}, attempting dynamic calculation...`);
      
      try {
        // Get loan data from daily_metrics_current and foreclosure_events
        const loanDataQuery = `
          SELECT 
            dmc.loan_id,
            dmc.property_state,
            dmc.origination_date,
            dmc.maturity_date,
            dmc.last_pymt_received as last_payment_date,
            dmc.first_pymt_due,
            fe.complaint_filed_date as acceleration_date,
            fe.fc_start_date,
            fe.fc_status as foreclosure_status,
            fe.judgment_date,
            fe.sale_held_date,
            fe.real_estate_owned_date
          FROM daily_metrics_current dmc
          LEFT JOIN foreclosure_events fe ON fe.loan_id = dmc.loan_id
          WHERE dmc.loan_id = $1
        `;
        
        const loanDataResult = await pool.query(loanDataQuery, [loanId]);
        
        if (loanDataResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Loan not found in system'
          });
        }
        
        const loanData = loanDataResult.rows[0];
        
        // Calculate SOL dynamically
        const calculatedSOL = await solCalculationService.calculateLoanSOL(loanData);
        
        if (!calculatedSOL) {
          return res.json({
            success: false,
            error: 'Unable to calculate SOL for this loan',
            data: {
              loan_id: loanData.loan_id,
              property_state: loanData.property_state,
              has_sol_calculation: false,
              message: 'No valid SOL triggers found for this loan'
            }
          });
        }
        
        // Store the calculated result for future use
        await solCalculationService.storeCalculationResult(calculatedSOL);
        
        return res.json({
          success: true,
          data: {
            ...calculatedSOL,
            loan_data: loanData,
            calculated_at: new Date().toISOString(),
            was_calculated_dynamically: true
          }
        });
        
      } catch (calcError) {
        console.error(`❌ Error performing dynamic SOL calculation for loan ${loanId}:`, calcError);
        return res.status(500).json({
          success: false,
          error: 'Unable to calculate SOL for this loan',
          message: calcError instanceof Error ? calcError.message : 'Unknown error'
        });
      }
    }
    
    const solData = solResult.rows[0];
    
    res.json({
      success: true,
      data: {
        ...solData,
        was_calculated_dynamically: false
      }
    });
    
  } catch (error) {
    console.error(`❌ Error fetching SOL for loan ${req.params.loanId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch loan SOL data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/sol/calculate-portfolio
 * Manually trigger portfolio-wide SOL calculation
 */
router.post('/calculate-portfolio', async (req, res) => {
  try {
    console.log('🔄 Starting manual portfolio SOL calculation...');
    
    const result = await solCalculationService.calculatePortfolioSOL();
    
    console.log(`✅ Portfolio SOL calculation completed: ${result.processed} processed, ${result.errors} errors`);
    
    res.json({
      success: true,
      data: {
        message: 'Portfolio SOL calculation completed',
        processed: result.processed,
        errors: result.errors,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error calculating portfolio SOL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate portfolio SOL',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/sol/update-loan/:loanId
 * Trigger SOL update for a specific loan
 */
router.post('/update-loan/:loanId', async (req, res) => {
  try {
    const { loanId } = req.params;
    const { eventType = 'status_change' } = req.body;
    
    console.log(`🔄 Triggering SOL update for loan: ${loanId}`);
    
    const success = await solEventService.triggerSOLUpdateForLoan(loanId, eventType);
    
    if (success) {
      res.json({
        success: true,
        data: {
          message: `SOL updated for loan ${loanId}`,
          loanId,
          eventType,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: `Failed to update SOL for loan ${loanId}`
      });
    }
    
  } catch (error) {
    console.error(`❌ Error updating SOL for loan ${req.params.loanId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update loan SOL',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/sol/daily-update
 * Manually trigger daily SOL update batch
 */
router.post('/daily-update', async (req, res) => {
  try {
    console.log('🕒 Starting manual daily SOL update...');
    
    const result = await solEventService.runDailySOLUpdate();
    
    console.log(`✅ Daily SOL update completed: ${result.updated} updated, ${result.errors} errors`);
    
    res.json({
      success: true,
      data: {
        message: 'Daily SOL update completed',
        updated: result.updated,
        errors: result.errors,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error running daily SOL update:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run daily SOL update',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/sol/alerts
 * Get SOL expiration alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    console.log('🚨 Fetching SOL expiration alerts...');
    
    const alerts = await solEventService.checkExpirationAlerts();
    
    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching SOL alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SOL alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/sol/jurisdictions
 * Get all SOL jurisdictions
 */
router.get('/jurisdictions', async (req, res) => {
  try {
    console.log('📍 Fetching SOL jurisdictions...');
    
    const result = await pool.query(`
      SELECT 
        state_code,
        state_name,
        foreclosure_types,
        risk_level,
        sol_category,
        created_at,
        updated_at
      FROM sol_jurisdictions
      ORDER BY state_name
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('❌ Error fetching SOL jurisdictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SOL jurisdictions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;