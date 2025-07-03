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

// --- MONTHLY CASHFLOW ENDPOINT ---
router.get('/reports/monthly-cashflow', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                'January 2025' as month, COALESCE(SUM(january_2025), 0) as cashflow
            FROM daily_metrics_current 
            WHERE january_2025 IS NOT NULL
            UNION ALL
            SELECT 
                'February 2025' as month, COALESCE(SUM(february_2025), 0) as cashflow
            FROM daily_metrics_current 
            WHERE february_2025 IS NOT NULL
            UNION ALL
            SELECT 
                'March 2025' as month, COALESCE(SUM(march_2025), 0) as cashflow
            FROM daily_metrics_current 
            WHERE march_2025 IS NOT NULL
            UNION ALL
            SELECT 
                'April 2025' as month, COALESCE(SUM(april_2025), 0) as cashflow
            FROM daily_metrics_current 
            WHERE april_2025 IS NOT NULL
            UNION ALL
            SELECT 
                'May 2025' as month, COALESCE(SUM(may_2025), 0) as cashflow
            FROM daily_metrics_current 
            WHERE may_2025 IS NOT NULL
            UNION ALL
            SELECT 
                'June 2025' as month, COALESCE(SUM(june_2025), 0) as cashflow
            FROM daily_metrics_current 
            WHERE june_2025 IS NOT NULL
            UNION ALL
            SELECT 
                'July 2025' as month, COALESCE(SUM(july_2025), 0) as cashflow
            FROM daily_metrics_current 
            WHERE july_2025 IS NOT NULL
            UNION ALL
            SELECT 
                'August 2025' as month, COALESCE(SUM(august_2025), 0) as cashflow
            FROM daily_metrics_current 
            WHERE august_2025 IS NOT NULL
            UNION ALL
            SELECT 
                'September 2025' as month, COALESCE(SUM(september_2025), 0) as cashflow
            FROM daily_metrics_current 
            WHERE september_2025 IS NOT NULL
            UNION ALL
            SELECT 
                'October 2025' as month, COALESCE(SUM(october_2025), 0) as cashflow
            FROM daily_metrics_current 
            WHERE october_2025 IS NOT NULL
            UNION ALL
            SELECT 
                'November 2025' as month, COALESCE(SUM(november_2025), 0) as cashflow
            FROM daily_metrics_current 
            WHERE november_2025 IS NOT NULL
            UNION ALL
            SELECT 
                'December 2025' as month, COALESCE(SUM(december_2025), 0) as cashflow
            FROM daily_metrics_current 
            WHERE december_2025 IS NOT NULL
            ORDER BY 
                CASE month
                    WHEN 'January 2025' THEN 1
                    WHEN 'February 2025' THEN 2
                    WHEN 'March 2025' THEN 3
                    WHEN 'April 2025' THEN 4
                    WHEN 'May 2025' THEN 5
                    WHEN 'June 2025' THEN 6
                    WHEN 'July 2025' THEN 7
                    WHEN 'August 2025' THEN 8
                    WHEN 'September 2025' THEN 9
                    WHEN 'October 2025' THEN 10
                    WHEN 'November 2025' THEN 11
                    WHEN 'December 2025' THEN 12
                END
        `;
        
        const result = await pool.query(query);
        
        const data = result.rows.map(row => ({
            month: row.month,
            cashflow: parseFloat(row.cashflow) || 0
        }));
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching monthly cashflow:', error);
        res.status(500).json({ error: 'Failed to fetch monthly cashflow' });
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

// --- MONTHLY CASHFLOW ENDPOINT ---
router.get('/reports/monthly-cashflow', authenticateToken, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    
    // Define months with their database column names
    const monthsData = [
      { abbr: 'Jan', full: 'january', order: 1 },
      { abbr: 'Feb', full: 'february', order: 2 },
      { abbr: 'Mar', full: 'march', order: 3 },
      { abbr: 'Apr', full: 'april', order: 4 },
      { abbr: 'May', full: 'may', order: 5 },
      { abbr: 'Jun', full: 'june', order: 6 },
      { abbr: 'Jul', full: 'july', order: 7 },
      { abbr: 'Aug', full: 'august', order: 8 },
      { abbr: 'Sep', full: 'september', order: 9 },
      { abbr: 'Oct', full: 'october', order: 10 },
      { abbr: 'Nov', full: 'november', order: 11 },
      { abbr: 'Dec', full: 'december', order: 12 }
    ];

    // Build individual queries for each month
    const queries = monthsData.map(month => {
      const columnName = `${month.full}_${year}`;
      return {
        month: month.abbr,
        order: month.order,
        query: `SELECT COALESCE(SUM(${columnName}), 0) as total FROM daily_metrics_current`
      };
    });

    // Execute all queries in parallel for better performance
    const results = await Promise.all(
      queries.map(async (q) => {
        try {
          const result = await pool.query(q.query);
          return {
            month: q.month,
            order: q.order,
            cashflow: parseFloat(result.rows[0].total) || 0
          };
        } catch (err) {
          // If column doesn't exist for this year, return 0
          console.warn(`Column for ${q.month} ${year} might not exist:`, err);
          return {
            month: q.month,
            order: q.order,
            cashflow: 0
          };
        }
      })
    );

    // Sort results by month order
    const sortedResults = results.sort((a, b) => a.order - b.order);

    // Format for frontend
    const formattedData = sortedResults.map(item => ({
      month: item.month,
      cashflow: item.cashflow
    }));

    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching monthly cashflow:', error);
    res.status(500).json({ 
      error: 'Failed to fetch monthly cashflow data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
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