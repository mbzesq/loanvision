import express from 'express';
import { Pool } from 'pg';
import { SOLCalculationService } from '../services/SOLCalculationService';
import { SOLEventService } from '../services/SOLEventService';
import { authenticateToken } from '../middleware/authMiddleware';
import organizationAccessService from '../services/organizationAccessService';

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
router.get('/summary', authenticateToken, async (req: any, res) => {
  try {
    console.log('📊 Fetching SOL summary...');
    
    // Get accessible loan IDs for the user
    const accessibleLoanIds = await organizationAccessService.getAccessibleLoanIds(req.user.id);
    
    // If user has no accessible loans, return empty summary
    if (accessibleLoanIds.length === 0) {
      res.json({
        success: true,
        data: {
          total_loans: 0,
          expired_count: 0,
          high_risk_count: 0,
          medium_risk_count: 0,
          low_risk_count: 0,
          alerts: []
        }
      });
      return;
    }
    
    const summary = await solEventService.getSOLSummaryForLoans(accessibleLoanIds);
    
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
router.get('/dashboard-data', authenticateToken, async (req: any, res) => {
  try {
    console.log('📊 Fetching SOL dashboard data...');
    
    // Get accessible loan IDs for the user
    const accessibleLoanIds = await organizationAccessService.getAccessibleLoanIds(req.user.id);
    
    // If user has no accessible loans, return empty summary
    if (accessibleLoanIds.length === 0) {
      res.json({
        success: true,
        data: {
          total_loans: 0,
          expired_count: 0,
          high_risk_count: 0,
          medium_risk_count: 0,
          low_risk_count: 0,
          alerts: []
        }
      });
      return;
    }
    
    const summary = await solEventService.getSOLSummaryForLoans(accessibleLoanIds);
    
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
router.get('/loan/:loanId', authenticateToken, organizationAccessService.createLoanAccessMiddleware(), async (req, res) => {
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
router.post('/calculate-portfolio', authenticateToken, async (req: any, res) => {
  try {
    // Check if user has admin or super_user role
    if (req.user.role !== 'admin' && req.user.role !== 'super_user') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only admin users can trigger SOL batch processing'
      });
    }
    
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
router.post('/update-loan/:loanId', authenticateToken, organizationAccessService.createLoanAccessMiddleware('servicer'), async (req, res) => {
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
router.post('/daily-update', authenticateToken, async (req: any, res) => {
  try {
    // Check if user has admin or super_user role
    if (req.user.role !== 'admin' && req.user.role !== 'super_user') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only admin users can trigger daily SOL updates'
      });
    }
    
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
router.get('/alerts', authenticateToken, async (req: any, res) => {
  try {
    console.log('🚨 Fetching SOL expiration alerts...');
    
    // Get accessible loan IDs for the user
    const accessibleLoanIds = await organizationAccessService.getAccessibleLoanIds(req.user.id);
    
    // If user has no accessible loans, return empty alerts
    if (accessibleLoanIds.length === 0) {
      res.json({
        success: true,
        data: {
          alerts: [],
          count: 0,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }
    
    const alerts = await solEventService.checkExpirationAlertsForLoans(accessibleLoanIds);
    
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
router.get('/jurisdictions', authenticateToken, async (req, res) => {
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
router.post('/loans/batch', authenticateToken, async (req: any, res) => {
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
    
    // Get accessible loan IDs for the user
    const accessibleLoanIds = await organizationAccessService.getAccessibleLoanIds(req.user.id);
    
    // Filter requested loan IDs to only include accessible ones
    const accessibleSet = new Set(accessibleLoanIds);
    const filteredLoanIds = loan_ids.filter(id => accessibleSet.has(id));
    
    if (filteredLoanIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        metadata: {
          requested: loan_ids.length,
          found: 0,
          missing: loan_ids.length,
          filtered_for_access: loan_ids.length
        }
      });
    }
    
    console.log(`🔍 Fetching SOL data for ${filteredLoanIds.length} accessible loans (filtered from ${loan_ids.length} requested)...`);
    console.log(`🔍 Sample loan IDs: ${filteredLoanIds.slice(0, 3).join(', ')}${filteredLoanIds.length > 3 ? '...' : ''}`);
    
    // Create parameterized query for batch lookup
    const placeholders = filteredLoanIds.map((_, index) => `$${index + 1}`).join(',');
    console.log(`🔍 Generated ${filteredLoanIds.length} placeholders for query`);
    
    const solQuery = `
      SELECT 
        lsc.*,
        sj.state_name as jurisdiction_name,
        sj.risk_level as jurisdiction_risk_level
      FROM loan_sol_calculations lsc
      LEFT JOIN sol_jurisdictions sj ON sj.id = lsc.jurisdiction_id
      WHERE lsc.loan_id IN (${placeholders})
      ORDER BY lsc.loan_id
    `;
    
    const solResult = await pool.query(solQuery, filteredLoanIds);
    
    console.log(`✅ Found SOL data for ${solResult.rows.length} of ${filteredLoanIds.length} accessible loans`);
    
    res.json({
      success: true,
      data: solResult.rows,
      metadata: {
        requested: loan_ids.length,
        accessible: filteredLoanIds.length,
        found: solResult.rows.length,
        missing: filteredLoanIds.length - solResult.rows.length,
        filtered_for_access: loan_ids.length - filteredLoanIds.length
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