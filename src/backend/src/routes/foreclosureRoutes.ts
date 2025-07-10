import express from 'express';
import { Pool } from 'pg';
import { getForeclosureTimeline } from '../services/foreclosureService';

const router = express.Router();

// Initialize database pool - use same database config as main app
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/foreclosure/summary
 * Get foreclosure summary statistics for dashboard
 */
router.get('/summary', async (req, res) => {
  try {
    console.log('🏠 Fetching foreclosure summary...');
    
    const summaryQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE fe.fc_start_date IS NOT NULL) as total_in_foreclosure,
        COUNT(*) FILTER (WHERE fe.fc_jurisdiction ILIKE '%judicial%') as judicial_count,
        COUNT(*) FILTER (WHERE fe.fc_jurisdiction NOT ILIKE '%judicial%') as non_judicial_count,
        ROUND(AVG(CASE 
          WHEN fe.fc_start_date IS NOT NULL 
          THEN EXTRACT(DAY FROM NOW() - fe.fc_start_date) 
          ELSE NULL 
        END)) as avg_days_in_process,
        COUNT(*) FILTER (WHERE fe.sale_held_date IS NOT NULL OR fe.real_estate_owned_date IS NOT NULL) as completed_foreclosures
      FROM foreclosure_events fe
      WHERE fe.fc_start_date IS NOT NULL
    `;
    
    const summaryResult = await pool.query(summaryQuery);
    const summary = summaryResult.rows[0];
    
    // Get status breakdown
    const statusQuery = `
      SELECT 
        CASE 
          WHEN real_estate_owned_date IS NOT NULL THEN 'REO'
          WHEN sale_held_date IS NOT NULL THEN 'Foreclosure Sale'
          WHEN sale_scheduled_date IS NOT NULL THEN 'Sale Scheduled'
          WHEN judgment_date IS NOT NULL THEN 'Judgment Entered'
          WHEN complaint_filed_date IS NOT NULL THEN 'Complaint Filed'
          WHEN service_completed_date IS NOT NULL THEN 'Service Completed'
          ELSE 'Pre-Legal'
        END as status,
        COUNT(*) as count
      FROM foreclosure_events fe
      WHERE fe.fc_start_date IS NOT NULL
      GROUP BY status
      ORDER BY count DESC
    `;
    
    const statusResult = await pool.query(statusQuery);
    const statusBreakdown = statusResult.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {});
    
    // Calculate risk distribution
    const riskQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE 
          EXTRACT(DAY FROM NOW() - fc_start_date) > 365 
          AND sale_held_date IS NULL 
          AND real_estate_owned_date IS NULL
        ) as overdue,
        COUNT(*) FILTER (WHERE 
          EXTRACT(DAY FROM NOW() - fc_start_date) <= 365 
          AND sale_held_date IS NULL 
          AND real_estate_owned_date IS NULL
        ) as on_track,
        COUNT(*) FILTER (WHERE 
          sale_held_date IS NOT NULL 
          OR real_estate_owned_date IS NOT NULL
        ) as completed
      FROM foreclosure_events fe
      WHERE fe.fc_start_date IS NOT NULL
    `;
    
    const riskResult = await pool.query(riskQuery);
    const riskDistribution = riskResult.rows[0];
    
    const response = {
      totalInForeclosure: parseInt(summary.total_in_foreclosure) || 0,
      judicialCount: parseInt(summary.judicial_count) || 0,
      nonJudicialCount: parseInt(summary.non_judicial_count) || 0,
      avgDaysInProcess: parseInt(summary.avg_days_in_process) || 0,
      completedForeclosures: parseInt(summary.completed_foreclosures) || 0,
      statusBreakdown,
      riskDistribution: {
        overdue: parseInt(riskDistribution.overdue) || 0,
        onTrack: parseInt(riskDistribution.on_track) || 0,
        completed: parseInt(riskDistribution.completed) || 0
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching foreclosure summary:', error);
    res.status(500).json({
      error: 'Failed to fetch foreclosure summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/foreclosure/loans
 * Get active foreclosure loans list
 */
router.get('/loans', async (req, res) => {
  try {
    console.log('📋 Fetching foreclosure loans...');
    
    const loansQuery = `
      SELECT 
        fe.loan_id,
        CONCAT(COALESCE(dmc.first_name, ''), ' ', COALESCE(dmc.last_name, '')) as borrower_name,
        dmc.state,
        fe.fc_jurisdiction as jurisdiction,
        CASE 
          WHEN fe.real_estate_owned_date IS NOT NULL THEN 'REO'
          WHEN fe.sale_held_date IS NOT NULL THEN 'Foreclosure Sale'
          WHEN fe.sale_scheduled_date IS NOT NULL THEN 'Sale Scheduled'
          WHEN fe.judgment_date IS NOT NULL THEN 'Judgment Entered'
          WHEN fe.complaint_filed_date IS NOT NULL THEN 'Complaint Filed'
          WHEN fe.service_completed_date IS NOT NULL THEN 'Service Completed'
          ELSE 'Pre-Legal'
        END as current_milestone,
        fe.fc_start_date,
        EXTRACT(DAY FROM NOW() - fe.fc_start_date) as days_in_process,
        CASE 
          WHEN EXTRACT(DAY FROM NOW() - fe.fc_start_date) > 365 THEN 'overdue'
          WHEN fe.sale_held_date IS NOT NULL OR fe.real_estate_owned_date IS NOT NULL THEN 'completed'
          ELSE 'on_track'
        END as status,
        dmc.prin_bal as principal_balance
      FROM foreclosure_events fe
      LEFT JOIN daily_metrics_current dmc ON fe.loan_id = dmc.loan_id
      WHERE fe.fc_start_date IS NOT NULL
      ORDER BY fe.fc_start_date DESC
      LIMIT 100
    `;
    
    const loansResult = await pool.query(loansQuery);
    
    const loans = loansResult.rows.map(row => ({
      loanId: row.loan_id,
      borrowerName: row.borrower_name?.trim() || 'Unknown',
      state: row.state || 'Unknown',
      jurisdiction: row.jurisdiction || 'Unknown',
      currentMilestone: row.current_milestone,
      fcStartDate: row.fc_start_date ? row.fc_start_date.toISOString().split('T')[0] : null,
      daysInProcess: parseInt(row.days_in_process) || 0,
      expectedCompletionDate: null, // Would need to calculate based on state timelines
      status: row.status,
      principalBalance: parseFloat(row.principal_balance) || 0
    }));
    
    res.json(loans);
  } catch (error) {
    console.error('❌ Error fetching foreclosure loans:', error);
    res.status(500).json({
      error: 'Failed to fetch foreclosure loans',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/foreclosure/by-state
 * Get foreclosure data breakdown by state
 */
router.get('/by-state', async (req, res) => {
  try {
    console.log('🗺️ Fetching foreclosure data by state...');
    
    const stateQuery = `
      SELECT 
        dmc.state,
        COUNT(*) as total_loans,
        COUNT(*) FILTER (WHERE fe.fc_jurisdiction ILIKE '%judicial%') as judicial_count,
        COUNT(*) FILTER (WHERE fe.fc_jurisdiction ILIKE '%non%judicial%' OR fe.fc_jurisdiction NOT ILIKE '%judicial%') as non_judicial_count,
        ROUND(AVG(EXTRACT(DAY FROM NOW() - fe.fc_start_date))) as avg_days_in_process,
        COUNT(*) FILTER (WHERE fe.sale_held_date IS NOT NULL OR fe.real_estate_owned_date IS NOT NULL) as completed_count
      FROM foreclosure_events fe
      LEFT JOIN daily_metrics_current dmc ON fe.loan_id = dmc.loan_id
      WHERE fe.fc_start_date IS NOT NULL AND dmc.state IS NOT NULL
      GROUP BY dmc.state
      ORDER BY total_loans DESC
    `;
    
    const stateResult = await pool.query(stateQuery);
    
    const stateData = stateResult.rows.map(row => ({
      state: row.state,
      totalLoans: parseInt(row.total_loans) || 0,
      judicialCount: parseInt(row.judicial_count) || 0,
      nonJudicialCount: parseInt(row.non_judicial_count) || 0,
      avgDaysInProcess: parseInt(row.avg_days_in_process) || 0,
      completedCount: parseInt(row.completed_count) || 0
    }));
    
    res.json(stateData);
  } catch (error) {
    console.error('❌ Error fetching foreclosure data by state:', error);
    res.status(500).json({
      error: 'Failed to fetch foreclosure data by state',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/foreclosure/timeline/:loanId
 * Get foreclosure timeline for a specific loan
 */
router.get('/timeline/:loanId', async (req, res) => {
  try {
    const { loanId } = req.params;
    console.log(`📅 Fetching foreclosure timeline for loan: ${loanId}`);
    
    const timeline = await getForeclosureTimeline(loanId);
    
    if (!timeline) {
      return res.status(404).json({
        error: 'Foreclosure timeline not found for this loan',
        message: 'This loan may not be in foreclosure or have timeline data available.'
      });
    }
    
    res.json(timeline);
  } catch (error) {
    console.error(`❌ Error fetching foreclosure timeline for loan ${req.params.loanId}:`, error);
    res.status(500).json({
      error: 'Failed to fetch foreclosure timeline',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;