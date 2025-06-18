import { Router } from 'express';
import ExcelJS from 'exceljs';
import pool from '../db';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

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

// Helper to generate a basic HTML report from loan data
const generateHtmlReport = (loans: any[], filter?: string): string => {
    const tableRows = loans.map(loan => `
        <tr>
            <td>${loan.servicer_loan_id || ''}</td>
            <td>${loan.borrower_name || ''}</td>
            <td>${loan.property_address || ''}</td>
            <td>${loan.unpaid_principal_balance ? parseFloat(loan.unpaid_principal_balance).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : ''}</td>
            <td>${loan.next_due_date ? new Date(loan.next_due_date).toLocaleDateString() : ''}</td>
            <td>${loan.last_paid_date ? new Date(loan.last_paid_date).toLocaleDateString() : ''}</td>
        </tr>
    `).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: sans-serif; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Loan Portfolio Report</h1>
            <p><strong>Generated:</strong> ${new Date().toUTCString()}</p>
            <p><strong>Filter Applied:</strong> ${filter || 'None'}</p>
            <table>
                <thead>
                    <tr>
                        <th>Loan Number</th>
                        <th>Borrower Name</th>
                        <th>Property Address</th>
                        <th>UPB</th>
                        <th>Next Due Date</th>
                        <th>Last Paid Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </body>
        </html>
    `;
};


// --- PDF EXPORT ENDPOINT ---
router.get('/reports/pdf', async (req, res) => {
    const filter = req.query.filter as string | undefined;
    let browser = null;

    try {
        const { whereClause, values } = buildFilter(filter);
        const query = `SELECT * FROM loans ${whereClause} ORDER BY created_at DESC`;
        const result = await pool.query(query, values);

        // Correct, minimal launch configuration
        browser = await puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: true,
        });

        const page = await browser.newPage();
        const htmlContent = generateHtmlReport(result.rows, filter);
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({ format: 'A4', landscape: true });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=loan-report-${Date.now()}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error generating PDF report:', error);
        res.status(500).send('Error generating PDF report');
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});


// --- EXCEL EXPORT ENDPOINT ---
router.get('/reports/excel', async (req, res) => {
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