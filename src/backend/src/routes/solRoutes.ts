import express from 'express';
import { Pool } from 'pg';
import { SOLCalculationService } from '../services/SOLCalculationService';
import { SOLEventService } from '../services/SOLEventService';

const router = express.Router();

// Initialize services
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'nplvision'
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
    
    // Get loan data for SOL calculation
    const loanQuery = `
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
      WHERE dmc.loan_id = $1
    `;
    
    const loanResult = await pool.query(loanQuery, [loanId]);
    
    if (loanResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }
    
    const loanData = loanResult.rows[0];
    
    // Calculate SOL for this loan
    const solResult = await solCalculationService.calculateLoanSOL(loanData);
    
    if (!solResult) {
      return res.status(400).json({
        success: false,
        error: 'Unable to calculate SOL for this loan'
      });
    }
    
    res.json({
      success: true,
      data: solResult
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
        lien_years,
        note_years,
        foreclosure_years,
        lien_extinguished,
        foreclosure_barred,
        risk_level
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