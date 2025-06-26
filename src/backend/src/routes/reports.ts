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