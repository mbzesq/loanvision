import { Router } from 'express';
import ExcelJS from 'exceljs';
import pool from '../db';
import { authenticateToken } from '../middleware/authMiddleware';
import organizationAccessService from '../services/organizationAccessService';

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
      WITH milestone_data AS (
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
          END as sort_order
        FROM foreclosure_events
        WHERE fc_status IS NOT NULL AND fc_status != ''
      )
      SELECT milestone, COUNT(*) as count
      FROM milestone_data
      GROUP BY milestone, sort_order
      ORDER BY sort_order;
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
router.get('/reports/excel', authenticateToken, async (req: any, res) => {
    const filter = req.query.filter as string | undefined;
    try {
        // Build base query with proper filtering
        const searchTerm = filter ? `%${filter}%` : null;
        let baseQuery = 'SELECT * FROM daily_metrics_current';
        const queryParams: string[] = [];
        
        if (searchTerm) {
            baseQuery += ` WHERE (
                loan_id ILIKE $1 OR
                CONCAT(first_name, ' ', last_name) ILIKE $1 OR
                address ILIKE $1 OR
                city ILIKE $1 OR
                state ILIKE $1 OR
                legal_status ILIKE $1
            ) {LOAN_FILTER}`;
            queryParams.push(searchTerm);
        } else {
            baseQuery += ' WHERE 1=1 {LOAN_FILTER}';
        }
        
        baseQuery += ' ORDER BY loan_id ASC';
        
        // Apply organization-based access filtering
        const { query, params } = await organizationAccessService.applyLoanFilter(
            baseQuery,
            req.user.id,
            queryParams
        );
        
        const result = await pool.query(query, params);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'NPLVision';
        workbook.created = new Date();
        
        const worksheet = workbook.addWorksheet('Loans');

        // Updated column mappings to match daily_metrics_current table
        worksheet.columns = [
            { header: 'Loan Number', key: 'loan_id', width: 15 },
            { header: 'Borrower Name', key: 'borrower_name', width: 30 },
            { header: 'Property Address', key: 'address', width: 40 },
            { header: 'City', key: 'city', width: 20 },
            { header: 'State', key: 'state', width: 10 },
            { header: 'ZIP', key: 'zip', width: 12 },
            { header: 'UPB', key: 'prin_bal', width: 15, style: { numFmt: '$#,##0.00' } },
            { header: 'Interest Rate', key: 'int_rate', width: 12, style: { numFmt: '0.00%' } },
            { header: 'Next Due Date', key: 'next_pymt_due', width: 15, style: { numFmt: 'yyyy-mm-dd' } },
            { header: 'Last Paid Date', key: 'last_pymt_received', width: 15, style: { numFmt: 'yyyy-mm-dd' } },
            { header: 'Legal Status', key: 'legal_status', width: 15 },
            { header: 'Loan Type', key: 'loan_type', width: 15 },
            { header: 'Lien Position', key: 'lien_pos', width: 12 },
            { header: 'Investor', key: 'investor_name', width: 25 }
        ];

        // Add rows with proper data transformation
        result.rows.forEach(loan => {
            worksheet.addRow({
                loan_id: loan.loan_id,
                borrower_name: `${loan.first_name || ''} ${loan.last_name || ''}`.trim(),
                address: loan.address,
                city: loan.city,
                state: loan.state,
                zip: loan.zip,
                prin_bal: loan.prin_bal ? parseFloat(loan.prin_bal) : null,
                int_rate: loan.int_rate ? parseFloat(loan.int_rate) : null,
                next_pymt_due: loan.next_pymt_due ? new Date(loan.next_pymt_due) : null,
                last_pymt_received: loan.last_pymt_received ? new Date(loan.last_pymt_received) : null,
                legal_status: loan.legal_status,
                loan_type: loan.loan_type,
                lien_pos: loan.lien_pos,
                investor_name: loan.investor_name
            });
        });

        // Style the header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

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