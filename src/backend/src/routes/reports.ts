import { Router } from 'express';
import ExcelJS from 'exceljs';
import pool from '../db';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Helper function to build a WHERE clause and values for filtering
const buildFilter = (filter?: string) => {
  if (!filter || filter.trim() === '') {
    return { whereClause: '', values: [] };
  }

  const searchTerm = `%${filter}%`;
  const whereClause = `
    WHERE
      servicer_loan_id ILIKE $1 OR
      borrower_name ILIKE $1 OR
      property_address ILIKE $1 OR
      property_city ILIKE $1 OR
      property_state ILIKE $1 OR
      legal_status ILIKE $1
  `;
  return { whereClause, values: [searchTerm] };
};

// --- LOAN STATUS DISTRIBUTION ENDPOINT ---
router.get('/reports/loan-status-distribution', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                legal_status as status,
                COUNT(*) as count
            FROM daily_metrics_current 
            WHERE legal_status IS NOT NULL 
            GROUP BY legal_status 
            ORDER BY count DESC
        `;
        
        const result = await pool.query(query);
        
        // Transform the result to ensure count is a number
        const data = result.rows.map(row => ({
            status: row.status || 'Unknown',
            count: parseInt(row.count, 10)
        }));
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching loan status distribution:', error);
        res.status(500).json({ error: 'Failed to fetch loan status distribution' });
    }
});

// --- GEOGRAPHICAL DISTRIBUTION ENDPOINT ---
router.get('/reports/geographical-distribution', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                state,
                COUNT(*) as count
            FROM daily_metrics_current 
            WHERE state IS NOT NULL 
            GROUP BY state 
            ORDER BY count DESC
        `;
        
        const result = await pool.query(query);
        
        const data = result.rows.map(row => ({
            state: row.state || 'Unknown',
            count: parseInt(row.count, 10)
        }));
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching geographical distribution:', error);
        res.status(500).json({ error: 'Failed to fetch geographical distribution' });
    }
});


// --- GEOGRAPHICAL DISTRIBUTION ENDPOINT ---
router.get('/reports/loan-geographical-distribution', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT state, COUNT(*) as count
            FROM daily_metrics_current
            WHERE state IS NOT NULL AND state != ''
            GROUP BY state
            ORDER BY count DESC
        `;
        
        const result = await pool.query(query);
        
        const data = result.rows.map(row => ({
            state: row.state,
            count: parseInt(row.count, 10)
        }));
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching loan geographical distribution:', error);
        res.status(500).json({ error: 'Failed to fetch loan geographical distribution' });
    }
});

// --- DEBUG MONTHLY DATA ENDPOINT ---
router.get('/reports/debug-monthly', authenticateToken, async (req, res) => {
  try {
    // Check if we have any data at all
    const tableCheck = await pool.query('SELECT COUNT(*) as total FROM daily_metrics_current');
    
    // Check column structure
    const columnCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'daily_metrics_current' AND column_name LIKE '%2025%'
      ORDER BY column_name
    `);
    
    // Check actual data in monthly columns
    const dataCheck = await pool.query(`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(january_2025) as jan_count,
        COUNT(february_2025) as feb_count,
        COUNT(march_2025) as mar_count,
        SUM(january_2025) as jan_sum,
        SUM(february_2025) as feb_sum,
        SUM(march_2025) as mar_sum,
        AVG(january_2025) as jan_avg,
        MAX(january_2025) as jan_max,
        MIN(january_2025) as jan_min
      FROM daily_metrics_current
    `);
    
    // Get sample data
    const sampleData = await pool.query(`
      SELECT loan_id, january_2025, february_2025, march_2025
      FROM daily_metrics_current 
      WHERE january_2025 IS NOT NULL OR february_2025 IS NOT NULL OR march_2025 IS NOT NULL
      LIMIT 5
    `);
    
    res.json({
      table_info: tableCheck.rows[0],
      columns: columnCheck.rows,
      data_analysis: dataCheck.rows[0],
      sample_data: sampleData.rows
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error occurred' });
  }
});

// --- MONTHLY CASHFLOW ENDPOINT ---
router.get('/reports/monthly-cashflow', authenticateToken, async (req, res) => {
  try {
    // Default to 2025 if no year is provided in the query
    const year = req.query.year || '2025';
    const investor = req.query.investor as string;

    // Build WHERE clause for investor filter
    const whereClause = investor && investor !== 'all' ? 'WHERE investor_name = $1' : '';
    const queryParams = investor && investor !== 'all' ? [investor] : [];

    // Use a single query to get all monthly data at once, grouped by investor if needed
    const query = `
      SELECT
        'Jan' as month, 
        1 as month_order, 
        ${investor && investor !== 'all' ? 'investor_name as investor,' : ''}
        COALESCE(SUM(january_2025), 0) as cashflow
      FROM daily_metrics_current
      ${whereClause}
      ${investor && investor !== 'all' ? 'GROUP BY investor_name' : ''}
      UNION ALL
      SELECT
        'Feb' as month, 
        2 as month_order, 
        ${investor && investor !== 'all' ? 'investor_name as investor,' : ''}
        COALESCE(SUM(february_2025), 0) as cashflow
      FROM daily_metrics_current
      ${whereClause}
      ${investor && investor !== 'all' ? 'GROUP BY investor_name' : ''}
      UNION ALL
      SELECT
        'Mar' as month, 
        3 as month_order, 
        ${investor && investor !== 'all' ? 'investor_name as investor,' : ''}
        COALESCE(SUM(march_2025), 0) as cashflow
      FROM daily_metrics_current
      ${whereClause}
      ${investor && investor !== 'all' ? 'GROUP BY investor_name' : ''}
      UNION ALL
      SELECT
        'Apr' as month, 
        4 as month_order, 
        ${investor && investor !== 'all' ? 'investor_name as investor,' : ''}
        COALESCE(SUM(april_2025), 0) as cashflow
      FROM daily_metrics_current
      ${whereClause}
      ${investor && investor !== 'all' ? 'GROUP BY investor_name' : ''}
      UNION ALL
      SELECT
        'May' as month, 
        5 as month_order, 
        ${investor && investor !== 'all' ? 'investor_name as investor,' : ''}
        COALESCE(SUM(may_2025), 0) as cashflow
      FROM daily_metrics_current
      ${whereClause}
      ${investor && investor !== 'all' ? 'GROUP BY investor_name' : ''}
      UNION ALL
      SELECT
        'Jun' as month, 
        6 as month_order, 
        ${investor && investor !== 'all' ? 'investor_name as investor,' : ''}
        COALESCE(SUM(june_2025), 0) as cashflow
      FROM daily_metrics_current
      ${whereClause}
      ${investor && investor !== 'all' ? 'GROUP BY investor_name' : ''}
      UNION ALL
      SELECT
        'Jul' as month, 
        7 as month_order, 
        ${investor && investor !== 'all' ? 'investor_name as investor,' : ''}
        COALESCE(SUM(july_2025), 0) as cashflow
      FROM daily_metrics_current
      ${whereClause}
      ${investor && investor !== 'all' ? 'GROUP BY investor_name' : ''}
      UNION ALL
      SELECT
        'Aug' as month, 
        8 as month_order, 
        ${investor && investor !== 'all' ? 'investor_name as investor,' : ''}
        COALESCE(SUM(august_2025), 0) as cashflow
      FROM daily_metrics_current
      ${whereClause}
      ${investor && investor !== 'all' ? 'GROUP BY investor_name' : ''}
      UNION ALL
      SELECT
        'Sep' as month, 
        9 as month_order, 
        ${investor && investor !== 'all' ? 'investor_name as investor,' : ''}
        COALESCE(SUM(september_2025), 0) as cashflow
      FROM daily_metrics_current
      ${whereClause}
      ${investor && investor !== 'all' ? 'GROUP BY investor_name' : ''}
      UNION ALL
      SELECT
        'Oct' as month, 
        10 as month_order, 
        ${investor && investor !== 'all' ? 'investor_name as investor,' : ''}
        COALESCE(SUM(october_2025), 0) as cashflow
      FROM daily_metrics_current
      ${whereClause}
      ${investor && investor !== 'all' ? 'GROUP BY investor_name' : ''}
      UNION ALL
      SELECT
        'Nov' as month, 
        11 as month_order, 
        ${investor && investor !== 'all' ? 'investor_name as investor,' : ''}
        COALESCE(SUM(november_2025), 0) as cashflow
      FROM daily_metrics_current
      ${whereClause}
      ${investor && investor !== 'all' ? 'GROUP BY investor_name' : ''}
      UNION ALL
      SELECT
        'Dec' as month, 
        12 as month_order, 
        ${investor && investor !== 'all' ? 'investor_name as investor,' : ''}
        COALESCE(SUM(december_2025), 0) as cashflow
      FROM daily_metrics_current
      ${whereClause}
      ${investor && investor !== 'all' ? 'GROUP BY investor_name' : ''}
      ORDER BY month_order ASC;
    `;

    const result = await pool.query(query, queryParams);

    const formattedData = result.rows.map(row => ({
      month: row.month,
      cashflow: parseFloat(row.cashflow) || 0,
      ...(investor && investor !== 'all' && { investor: row.investor })
    }));

    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching monthly cashflow:', error);
    res.status(500).json({ error: 'Failed to fetch monthly cashflow' });
  }
});

// --- INVESTORS LIST ENDPOINT ---
router.get('/reports/investors', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT investor_name
      FROM daily_metrics_current
      WHERE investor_name IS NOT NULL AND investor_name != ''
      ORDER BY investor_name ASC;
    `;
    
    const result = await pool.query(query);
    
    const investors = result.rows.map(row => row.investor_name);
    
    res.json(investors);
  } catch (error) {
    console.error('Error fetching investors:', error);
    res.status(500).json({ error: 'Failed to fetch investors' });
  }
});

// --- FORECLOSURE TRACKING ENDPOINT ---
router.get('/reports/foreclosure-tracking', authenticateToken, async (req, res) => {
  try {
    // 1. Total loans in foreclosure
    const totalForeclosureQuery = `
      SELECT COUNT(*) as total_foreclosure_loans
      FROM foreclosure_events 
      WHERE fc_status IS NOT NULL AND fc_status != '';
    `;
    
    // 2. Breakdown by foreclosure status
    const statusBreakdownQuery = `
      SELECT 
        fc_status,
        COUNT(*) as count
      FROM foreclosure_events 
      WHERE fc_status IS NOT NULL AND fc_status != ''
      GROUP BY fc_status
      ORDER BY count DESC;
    `;
    
    // 3. Milestone breakdown - count loans at each major milestone
    const milestoneBreakdownQuery = `
      SELECT 
        CASE 
          WHEN eviction_completed_date IS NOT NULL THEN 'Eviction Completed'
          WHEN real_estate_owned_date IS NOT NULL THEN 'REO'
          WHEN sale_held_date IS NOT NULL THEN 'Sale Held'
          WHEN sale_scheduled_date IS NOT NULL THEN 'Sale Scheduled'
          WHEN judgment_date IS NOT NULL THEN 'Judgment Entered'
          WHEN service_completed_date IS NOT NULL THEN 'Service Completed'
          WHEN complaint_filed_date IS NOT NULL THEN 'Complaint Filed'
          WHEN title_received_date IS NOT NULL THEN 'Title Received'
          WHEN title_ordered_date IS NOT NULL THEN 'Title Ordered'
          WHEN referral_date IS NOT NULL THEN 'Referred to Attorney'
          WHEN fc_start_date IS NOT NULL THEN 'Foreclosure Started'
          ELSE 'Not Started'
        END as milestone,
        COUNT(*) as count
      FROM foreclosure_events
      WHERE fc_status IS NOT NULL AND fc_status != ''
      GROUP BY 
        CASE 
          WHEN eviction_completed_date IS NOT NULL THEN 'Eviction Completed'
          WHEN real_estate_owned_date IS NOT NULL THEN 'REO'
          WHEN sale_held_date IS NOT NULL THEN 'Sale Held'
          WHEN sale_scheduled_date IS NOT NULL THEN 'Sale Scheduled'
          WHEN judgment_date IS NOT NULL THEN 'Judgment Entered'
          WHEN service_completed_date IS NOT NULL THEN 'Service Completed'
          WHEN complaint_filed_date IS NOT NULL THEN 'Complaint Filed'
          WHEN title_received_date IS NOT NULL THEN 'Title Received'
          WHEN title_ordered_date IS NOT NULL THEN 'Title Ordered'
          WHEN referral_date IS NOT NULL THEN 'Referred to Attorney'
          WHEN fc_start_date IS NOT NULL THEN 'Foreclosure Started'
          ELSE 'Not Started'
        END
      ORDER BY 
        CASE 
          WHEN eviction_completed_date IS NOT NULL THEN 12
          WHEN real_estate_owned_date IS NOT NULL THEN 11
          WHEN sale_held_date IS NOT NULL THEN 10
          WHEN sale_scheduled_date IS NOT NULL THEN 9
          WHEN judgment_date IS NOT NULL THEN 8
          WHEN service_completed_date IS NOT NULL THEN 7
          WHEN complaint_filed_date IS NOT NULL THEN 6
          WHEN title_received_date IS NOT NULL THEN 5
          WHEN title_ordered_date IS NOT NULL THEN 4
          WHEN referral_date IS NOT NULL THEN 3
          WHEN fc_start_date IS NOT NULL THEN 2
          ELSE 1
        END;
    `;
    
    // 4. On Track vs Overdue status (simplified logic)
    const timelineStatusQuery = `
      SELECT 
        CASE 
          WHEN fc_start_date IS NULL THEN 'Not in Foreclosure'
          WHEN fc_start_date <= CURRENT_DATE - INTERVAL '365 days' AND eviction_completed_date IS NULL THEN 'Overdue'
          WHEN fc_start_date <= CURRENT_DATE - INTERVAL '270 days' AND sale_held_date IS NULL THEN 'Delayed'
          ELSE 'On Track'
        END as timeline_status,
        COUNT(*) as count
      FROM foreclosure_events
      WHERE fc_status IS NOT NULL AND fc_status != ''
      GROUP BY 
        CASE 
          WHEN fc_start_date IS NULL THEN 'Not in Foreclosure'
          WHEN fc_start_date <= CURRENT_DATE - INTERVAL '365 days' AND eviction_completed_date IS NULL THEN 'Overdue'
          WHEN fc_start_date <= CURRENT_DATE - INTERVAL '270 days' AND sale_held_date IS NULL THEN 'Delayed'
          ELSE 'On Track'
        END;
    `;

    // Execute all queries
    const [totalResult, statusResult, milestoneResult, timelineResult] = await Promise.all([
      pool.query(totalForeclosureQuery),
      pool.query(statusBreakdownQuery),
      pool.query(milestoneBreakdownQuery),
      pool.query(timelineStatusQuery)
    ]);

    res.json({
      total_foreclosure_loans: parseInt(totalResult.rows[0].total_foreclosure_loans, 10),
      status_breakdown: statusResult.rows.map(row => ({
        status: row.fc_status,
        count: parseInt(row.count, 10)
      })),
      milestone_breakdown: milestoneResult.rows.map(row => ({
        milestone: row.milestone,
        count: parseInt(row.count, 10)
      })),
      timeline_status: timelineResult.rows.map(row => ({
        status: row.timeline_status,
        count: parseInt(row.count, 10)
      }))
    });
  } catch (error) {
    console.error('Error fetching foreclosure tracking data:', error);
    res.status(500).json({ error: 'Failed to fetch foreclosure tracking data' });
  }
});

// --- EXCEL EXPORT ENDPOINT ---
router.get('/reports/excel', authenticateToken, async (req, res) => {
    const filter = req.query.filter as string | undefined;
    try {
        const { whereClause, values } = buildFilter(filter);
        const query = `SELECT * FROM loans ${whereClause} ORDER BY created_at DESC`;
        const result = await pool.query(query, values);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'LoanVision';
        workbook.created = new Date();
        
        const worksheet = workbook.addWorksheet('Loans');

        worksheet.columns = [
            { header: 'Loan Number', key: 'servicer_loan_id', width: 15 },
            { header: 'Borrower Name', key: 'borrower_name', width: 30 },
            { header: 'Property Address', key: 'property_address', width: 40 },
            { header: 'UPB', key: 'unpaid_principal_balance', width: 15, style: { numFmt: '$#,##0.00' } },
            { header: 'Interest Rate', key: 'interest_rate', width: 12, style: { numFmt: '0.00%' } },
            { header: 'Next Due Date', key: 'next_due_date', width: 15, style: { numFmt: 'yyyy-mm-dd' } },
            { header: 'Last Paid Date', key: 'last_paid_date', width: 15, style: { numFmt: 'yyyy-mm-dd' } },
            { header: 'Legal Status', key: 'legal_status', width: 15 },
        ];

        result.rows.forEach(loan => {
            worksheet.addRow({
                ...loan,
                unpaid_principal_balance: loan.unpaid_principal_balance ? parseFloat(loan.unpaid_principal_balance) : null,
                interest_rate: loan.interest_rate ? parseFloat(loan.interest_rate) : null,
                next_due_date: loan.next_due_date ? new Date(loan.next_due_date) : null,
                last_paid_date: loan.last_paid_date ? new Date(loan.last_paid_date) : null,
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=loan-report-${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error generating Excel report:', error);
        res.status(500).send('Error generating Excel report');
    }
});

export default router;