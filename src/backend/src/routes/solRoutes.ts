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
 * Get SOL calculation for a specific loan (from pre-calculated data)
 */
router.get('/loan/:loanId', async (req, res) => {
  try {
    const { loanId } = req.params;
    console.log(`🔍 Fetching SOL data for loan: ${loanId}`);
    
    // Get SOL calculation from loan_sol_calculations table
    const solQuery = `
      SELECT 
        lsc.*,
        sj.state_name as jurisdiction_name,
        sj.risk_level as jurisdiction_risk_level
      FROM loan_sol_calculations lsc
      LEFT JOIN sol_jurisdictions sj ON sj.id = lsc.jurisdiction_id
      WHERE lsc.loan_id = $1
    `;
    
    const solResult = await pool.query(solQuery, [loanId]);
    
    if (solResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'SOL calculation not found for this loan',
        message: 'This loan may not have been processed by the SOL system yet. SOL calculations are updated daily.'
      });
    }
    
    const solData = solResult.rows[0];
    
    res.json({
      success: true,
      data: solData
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
 * Manually trigger daily SOL batch processing (detects changes and updates)
 */
router.post('/calculate-portfolio', async (req, res) => {
  try {
    console.log('🔄 Starting manual SOL daily batch processing...');
    
    const result = await solEventService.runDailySOLUpdate();
    
    console.log(`✅ SOL batch processing completed: ${result.updated} updated, ${result.errors} errors`);
    
    res.json({
      success: true,
      data: {
        message: 'SOL daily batch processing completed',
        updated: result.updated,
        errors: result.errors,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error running SOL batch processing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run SOL batch processing',
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

/**
 * POST /api/sol/loans/batch
 * Get SOL calculations for multiple loans at once
 * Body: { loan_ids: string[] }
 */
router.post('/loans/batch', async (req, res) => {
  try {
    const { loan_ids } = req.body;
    
    if (!loan_ids || !Array.isArray(loan_ids)) {
      return res.status(400).json({
        success: false,
        error: 'loan_ids array is required'
      });
    }
    
    if (loan_ids.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    if (loan_ids.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 1000 loan IDs allowed per batch request'
      });
    }
    
    console.log(`🔍 Fetching SOL data for ${loan_ids.length} loans...`);
    
    // Create parameterized query for batch lookup
    const placeholders = loan_ids.map((_, index) => `$${index + 1}`).join(',');
    
    const solQuery = `
      SELECT 
        lsc.loan_id,
        lsc.jurisdiction_id,
        lsc.property_state,
        lsc.origination_date,
        lsc.maturity_date,
        lsc.default_date,
        lsc.last_payment_date,
        lsc.acceleration_date,
        lsc.charge_off_date,
        lsc.sol_trigger_event,
        lsc.sol_trigger_date,
        lsc.sol_expiration_date,
        lsc.adjusted_expiration_date,
        lsc.days_until_expiration,
        lsc.is_expired,
        lsc.sol_risk_level,
        lsc.tolling_provisions,
        lsc.notes,
        lsc.last_calculated_at,
        lsc.created_at,
        lsc.updated_at,
        sj.state_code,
        sj.state_name,
        sj.lien_years,
        sj.note_years,
        sj.foreclosure_years,
        sj.lien_extinguished,
        sj.foreclosure_barred
      FROM loan_sol_calculations lsc
      LEFT JOIN sol_jurisdictions sj ON lsc.jurisdiction_id = sj.id
      WHERE lsc.loan_id IN (${placeholders})
      ORDER BY lsc.loan_id
    `;
    
    const solResult = await pool.query(solQuery, loan_ids);
    
    console.log(`✅ Found SOL data for ${solResult.rows.length} of ${loan_ids.length} loans`);
    
    res.json({
      success: true,
      data: solResult.rows,
      metadata: {
        requested: loan_ids.length,
        found: solResult.rows.length,
        missing: loan_ids.length - solResult.rows.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching batch SOL data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch batch SOL data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;