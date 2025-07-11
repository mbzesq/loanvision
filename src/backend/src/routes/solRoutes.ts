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
        risk_level,
        lien_years,
        note_years,
        foreclosure_years,
        lien_extinguished,
        foreclosure_barred,
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

/**
 * GET /api/sol/jurisdiction-analysis
 * Get jurisdictions ranked by SOL risk concentration (not by loan count)
 * Shows states with highest SOL risk exposure regardless of portfolio size
 */
router.get('/jurisdiction-analysis', authenticateToken, async (req: any, res) => {
  try {
    console.log('🗺️ Fetching SOL risk analysis by jurisdiction (ranked by risk, not loan count)...');
    
    // Get accessible loan IDs for the user
    const accessibleLoanIds = await organizationAccessService.getAccessibleLoanIds(req.user.id);
    
    if (accessibleLoanIds.length === 0) {
      res.json({
        success: true,
        data: []
      });
      return;
    }
    
    const placeholders = accessibleLoanIds.map((_, index) => `$${index + 1}`).join(',');
    
    const jurisdictionQuery = `
      SELECT 
        lsc.property_state as state,
        COUNT(*) as total_loans,
        COUNT(*) FILTER (WHERE lsc.is_expired = true) as expired_count,
        COUNT(*) FILTER (WHERE lsc.sol_risk_level = 'HIGH') as high_risk_count,
        COUNT(*) FILTER (WHERE lsc.sol_risk_level = 'MEDIUM') as medium_risk_count,
        COUNT(*) FILTER (WHERE lsc.sol_risk_level = 'LOW') as low_risk_count,
        ROUND(AVG(lsc.days_until_expiration)::numeric) as avg_days_to_expiration,
        -- SOL Risk Concentration (expired + high risk as percentage)
        ROUND(
          ((COUNT(*) FILTER (WHERE lsc.is_expired = true OR lsc.sol_risk_level = 'HIGH')::float / COUNT(*)) * 100)::numeric, 
          1
        ) as sol_risk_concentration,
        -- Critical SOL Risk Score (weighted by severity and time proximity)
        ROUND(
          ((COUNT(*) FILTER (WHERE lsc.is_expired = true) * 100 +
           COUNT(*) FILTER (WHERE lsc.sol_risk_level = 'HIGH' AND lsc.days_until_expiration <= 90) * 80 +
           COUNT(*) FILTER (WHERE lsc.sol_risk_level = 'HIGH' AND lsc.days_until_expiration > 90) * 60 +
           COUNT(*) FILTER (WHERE lsc.sol_risk_level = 'MEDIUM' AND lsc.days_until_expiration <= 180) * 40)::float / 
          (COUNT(*) * 100))::numeric, 4
        ) as critical_risk_score,
        -- Jurisdiction inherent risk
        MAX(sj.risk_level) as jurisdiction_risk_level,
        -- Count of loans expiring in next 6 months
        COUNT(*) FILTER (WHERE lsc.days_until_expiration <= 180 AND lsc.is_expired = false) as expiring_soon_count
      FROM loan_sol_calculations lsc
      LEFT JOIN sol_jurisdictions sj ON lsc.property_state = sj.state_code
      WHERE lsc.loan_id IN (${placeholders})
      AND lsc.property_state IS NOT NULL
      GROUP BY lsc.property_state
      ORDER BY 
        critical_risk_score DESC,
        sol_risk_concentration DESC,
        expired_count DESC,
        expiring_soon_count DESC
    `;
    
    const result = await pool.query(jurisdictionQuery, accessibleLoanIds);
    
    const jurisdictionData = result.rows.map(row => ({
      state: row.state,
      totalLoans: parseInt(row.total_loans) || 0,
      expiredCount: parseInt(row.expired_count) || 0,
      highRiskCount: parseInt(row.high_risk_count) || 0,
      mediumRiskCount: parseInt(row.medium_risk_count) || 0,
      lowRiskCount: parseInt(row.low_risk_count) || 0,
      avgDaysToExpiration: parseInt(row.avg_days_to_expiration) || 0,
      solRiskConcentration: parseFloat(row.sol_risk_concentration) || 0,
      criticalRiskScore: parseFloat(row.critical_risk_score) || 0,
      jurisdictionRiskLevel: row.jurisdiction_risk_level || 'UNKNOWN',
      expiringSoonCount: parseInt(row.expiring_soon_count) || 0,
      // Legacy field for compatibility
      highRiskPercentage: parseFloat(row.sol_risk_concentration) || 0
    }));
    
    res.json({
      success: true,
      data: jurisdictionData,
      metadata: {
        sortingCriteria: 'Ranked by SOL risk concentration and critical risk score, not loan count',
        riskMetrics: {
          solRiskConcentration: 'Percentage of expired + high risk loans',
          criticalRiskScore: 'Weighted risk score considering expiration proximity and severity',
          expiringSoonCount: 'Loans expiring within 6 months'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching SOL jurisdiction risk analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SOL jurisdiction risk analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/sol/trend-analysis
 * Get dynamic SOL expiration timeline showing how many loans expire each month
 * Based on current SOL calculations that update daily with new metrics data
 */
router.get('/trend-analysis', authenticateToken, async (req: any, res) => {
  try {
    console.log('📈 Fetching dynamic SOL expiration timeline...');
    
    // Get accessible loan IDs for the user
    const accessibleLoanIds = await organizationAccessService.getAccessibleLoanIds(req.user.id);
    
    if (accessibleLoanIds.length === 0) {
      res.json({
        success: true,
        data: []
      });
      return;
    }
    
    const placeholders = accessibleLoanIds.map((_, index) => `$${index + 1}`).join(',');
    
    // Get current SOL calculations - these are dynamic and update daily
    const solQuery = `
      SELECT 
        loan_id,
        adjusted_expiration_date,
        is_expired,
        calculation_date
      FROM loan_sol_calculations
      WHERE loan_id IN (${placeholders})
      AND adjusted_expiration_date IS NOT NULL
      AND is_expired = false
      ORDER BY adjusted_expiration_date
    `;
    
    const result = await pool.query(solQuery, accessibleLoanIds);
    const loans = result.rows;
    
    console.log(`📊 Processing ${loans.length} loans with current SOL expiration dates`);
    
    // Group loans by expiration month to show how many expire each month
    const expirationCounts = new Map();
    const currentDate = new Date();
    
    // Initialize next 24 months
    for (let i = 0; i < 24; i++) {
      const monthDate = new Date(currentDate);
      monthDate.setMonth(monthDate.getMonth() + i);
      monthDate.setDate(1);
      const monthKey = monthDate.toISOString().substring(0, 7); // YYYY-MM format
      expirationCounts.set(monthKey, {
        month: monthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        expiringCount: 0,
        monthDate: monthDate.toISOString()
      });
    }
    
    // Count loans expiring in each month
    loans.forEach(loan => {
      if (loan.adjusted_expiration_date) {
        const expirationDate = new Date(loan.adjusted_expiration_date);
        const monthKey = expirationDate.toISOString().substring(0, 7); // YYYY-MM format
        
        if (expirationCounts.has(monthKey)) {
          expirationCounts.get(monthKey).expiringCount++;
        }
      }
    });
    
    // Convert to array and filter out months with no expirations for cleaner chart
    const trendData = Array.from(expirationCounts.values())
      .filter(item => item.expiringCount > 0)
      .slice(0, 18); // Show up to 18 months ahead
    
    res.json({
      success: true,
      data: trendData,
      metadata: {
        totalActiveLoans: loans.length,
        calculationBasis: 'Current SOL calculations updated daily with new metrics data',
        note: 'Shows actual SOL expiration dates by month. Updates automatically as daily metrics change SOL calculations.'
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching SOL expiration timeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SOL expiration timeline',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/sol/geographic-heatmap
 * Get SOL risk heat map data for all US states based on jurisdiction rules
 */
router.get('/geographic-heatmap', authenticateToken, async (req: any, res) => {
  try {
    console.log('🗺️ Fetching SOL geographic heat map...');
    
    // Get accessible loan IDs for the user
    const accessibleLoanIds = await organizationAccessService.getAccessibleLoanIds(req.user.id);
    
    // Get all SOL jurisdictions with their inherent risk levels
    const jurisdictionQuery = `
      SELECT 
        sj.state_code,
        sj.state_name,
        sj.risk_level as jurisdiction_risk_level,
        sj.lien_years,
        sj.note_years,
        sj.foreclosure_years,
        sj.lien_extinguished,
        sj.foreclosure_barred
      FROM sol_jurisdictions sj
      ORDER BY sj.state_code
    `;
    
    const jurisdictionResult = await pool.query(jurisdictionQuery);
    
    // Get portfolio exposure by state (if user has accessible loans)
    let portfolioExposure = new Map();
    if (accessibleLoanIds.length > 0) {
      const placeholders = accessibleLoanIds.map((_, index) => `$${index + 1}`).join(',');
      
      const exposureQuery = `
        SELECT 
          lsc.property_state as state,
          COUNT(*) as loan_count,
          COUNT(*) FILTER (WHERE lsc.is_expired = true) as expired_count,
          COUNT(*) FILTER (WHERE lsc.sol_risk_level = 'HIGH') as high_risk_count,
          ROUND(
            ((COUNT(*) FILTER (WHERE lsc.is_expired = true OR lsc.sol_risk_level = 'HIGH')::float / COUNT(*)) * 100)::numeric, 
            1
          ) as portfolio_risk_percentage
        FROM loan_sol_calculations lsc
        WHERE lsc.loan_id IN (${placeholders})
        AND lsc.property_state IS NOT NULL
        GROUP BY lsc.property_state
      `;
      
      const exposureResult = await pool.query(exposureQuery, accessibleLoanIds);
      exposureResult.rows.forEach(row => {
        portfolioExposure.set(row.state, {
          loanCount: parseInt(row.loan_count),
          expiredCount: parseInt(row.expired_count),
          highRiskCount: parseInt(row.high_risk_count),
          portfolioRiskPercentage: parseFloat(row.portfolio_risk_percentage)
        });
      });
    }
    
    // Combine jurisdiction rules with portfolio exposure
    const heatMapData = jurisdictionResult.rows.map(jurisdiction => {
      const exposure = portfolioExposure.get(jurisdiction.state_code) || {
        loanCount: 0,
        expiredCount: 0,
        highRiskCount: 0,
        portfolioRiskPercentage: 0
      };
      
      // Calculate overall risk score (0-100)
      let riskScore = 0;
      
      // Base score from jurisdiction risk level
      switch (jurisdiction.jurisdiction_risk_level) {
        case 'HIGH': riskScore += 40; break;
        case 'MEDIUM': riskScore += 20; break;
        case 'LOW': riskScore += 5; break;
      }
      
      // Adjust for SOL periods (shorter = riskier)
      const minSOLYears = Math.min(
        jurisdiction.lien_years || 10,
        jurisdiction.note_years || 10,
        jurisdiction.foreclosure_years || 10
      );
      if (minSOLYears <= 3) riskScore += 30;
      else if (minSOLYears <= 4) riskScore += 20;
      else if (minSOLYears <= 5) riskScore += 10;
      
      // Adjust for lien extinguishment
      if (jurisdiction.lien_extinguished) riskScore += 15;
      
      // Adjust for foreclosure being barred
      if (jurisdiction.foreclosure_barred) riskScore += 15;
      
      // Cap at 100
      riskScore = Math.min(riskScore, 100);
      
      return {
        stateCode: jurisdiction.state_code,
        stateName: jurisdiction.state_name,
        jurisdictionRiskLevel: jurisdiction.jurisdiction_risk_level,
        riskScore,
        lienYears: jurisdiction.lien_years,
        noteYears: jurisdiction.note_years,
        foreclosureYears: jurisdiction.foreclosure_years,
        lienExtinguished: jurisdiction.lien_extinguished,
        foreclosureBarred: jurisdiction.foreclosure_barred,
        // Portfolio exposure data
        portfolioLoanCount: exposure.loanCount,
        portfolioExpiredCount: exposure.expiredCount,
        portfolioHighRiskCount: exposure.highRiskCount,
        portfolioRiskPercentage: exposure.portfolioRiskPercentage,
        hasPortfolioExposure: exposure.loanCount > 0
      };
    });
    
    res.json({
      success: true,
      data: heatMapData,
      note: 'Geographic heat map showing inherent SOL risk by jurisdiction, with portfolio exposure overlay.'
    });
    
  } catch (error) {
    console.error('❌ Error fetching SOL geographic heat map:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SOL geographic heat map',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;