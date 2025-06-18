import { Router } from 'express';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import ExcelJS from 'exceljs';
import pool from '../db';

const router = Router();

// Helper function to build filter query
const buildFilterQuery = (filter?: string) => {
  if (!filter || filter.trim() === '') {
    return { query: 'SELECT * FROM loans ORDER BY created_at DESC', params: [] };
  }
  
  const searchTerm = `%${filter.toLowerCase()}%`;
  const query = `
    SELECT * FROM loans 
    WHERE 
      LOWER(servicer_loan_id) LIKE $1 OR
      LOWER(borrower_name) LIKE $1 OR
      LOWER(property_address) LIKE $1 OR
      LOWER(property_city) LIKE $1 OR
      LOWER(property_state) LIKE $1 OR
      LOWER(legal_status) LIKE $1
    ORDER BY created_at DESC
  `;
  
  return { query, params: [searchTerm] };
};

// Format currency for display
const formatCurrency = (value: any): string => {
  const num = parseFloat(value || 0);
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

// Format date for display
const formatDate = (value: any): string => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleDateString('en-US');
  } catch {
    return 'N/A';
  }
};

// PDF Export endpoint
router.get('/reports/pdf', async (req, res) => {
  let browser;
  try {
    const filter = req.query.filter as string;
    const { query, params } = buildFilterQuery(filter);
    const result = await pool.query(query, params);
    const loans = result.rows;

    // Generate HTML table
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; font-size: 24px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .info { margin-bottom: 10px; color: #666; }
        </style>
      </head>
      <body>
        <h1>Loan Portfolio Report</h1>
        <div class="info">Generated on: ${new Date().toLocaleDateString('en-US')}</div>
        <div class="info">Total loans: ${loans.length}</div>
        ${filter ? `<div class="info">Filter applied: "${filter}"</div>` : ''}
        
        <table>
          <thead>
            <tr>
              <th>Loan Number</th>
              <th>Borrower Name</th>
              <th>Property Address</th>
              <th>City</th>
              <th>State</th>
              <th>UPB</th>
              <th>Interest Rate</th>
              <th>Next Due Date</th>
              <th>Last Paid Date</th>
              <th>Legal Status</th>
            </tr>
          </thead>
          <tbody>
            ${loans.map(loan => `
              <tr>
                <td>${loan.servicer_loan_id || 'N/A'}</td>
                <td>${loan.borrower_name || 'N/A'}</td>
                <td>${loan.property_address || 'N/A'}</td>
                <td>${loan.property_city || 'N/A'}</td>
                <td>${loan.property_state || 'N/A'}</td>
                <td>${formatCurrency(loan.unpaid_principal_balance)}</td>
                <td>${loan.interest_rate ? (parseFloat(loan.interest_rate) * 100).toFixed(2) + '%' : 'N/A'}</td>
                <td>${formatDate(loan.next_due_date)}</td>
                <td>${formatDate(loan.last_paid_date)}</td>
                <td>${loan.legal_status || 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    // Launch puppeteer and generate PDF
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setContent(html);
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      margin: { top: 20, right: 20, bottom: 20, left: 20 }
    });

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="loan_report_${new Date().toISOString().split('T')[0]}.pdf"`);
    res.send(pdf);

  } catch (error) {
    console.error('Error generating PDF report:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// Excel Export endpoint
router.get('/reports/excel', async (req, res) => {
  try {
    const filter = req.query.filter as string;
    const { query, params } = buildFilterQuery(filter);
    const result = await pool.query(query, params);
    const loans = result.rows;

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Loan Portfolio');

    // Add title and metadata
    worksheet.mergeCells('A1:J1');
    worksheet.getCell('A1').value = 'Loan Portfolio Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.getCell('A2').value = `Generated on: ${new Date().toLocaleDateString('en-US')}`;
    worksheet.getCell('A3').value = `Total loans: ${loans.length}`;
    if (filter) {
      worksheet.getCell('A4').value = `Filter applied: "${filter}"`;
    }

    // Define columns
    worksheet.columns = [
      { header: 'Loan Number', key: 'servicer_loan_id', width: 15 },
      { header: 'Borrower Name', key: 'borrower_name', width: 25 },
      { header: 'Property Address', key: 'property_address', width: 30 },
      { header: 'City', key: 'property_city', width: 15 },
      { header: 'State', key: 'property_state', width: 10 },
      { header: 'UPB', key: 'unpaid_principal_balance', width: 15 },
      { header: 'Interest Rate', key: 'interest_rate', width: 12 },
      { header: 'Next Due Date', key: 'next_due_date', width: 15 },
      { header: 'Last Paid Date', key: 'last_paid_date', width: 15 },
      { header: 'Legal Status', key: 'legal_status', width: 15 }
    ];

    // Add header row (skip rows used for title and metadata)
    const headerRow = worksheet.addRow([]);
    worksheet.addRow([]);
    if (filter) worksheet.addRow([]);
    worksheet.addRow([]);
    
    const headers = worksheet.addRow([
      'Loan Number',
      'Borrower Name',
      'Property Address',
      'City',
      'State',
      'UPB',
      'Interest Rate',
      'Next Due Date',
      'Last Paid Date',
      'Legal Status'
    ]);
    
    // Style header row
    headers.font = { bold: true };
    headers.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data rows
    loans.forEach(loan => {
      const row = worksheet.addRow({
        servicer_loan_id: loan.servicer_loan_id || 'N/A',
        borrower_name: loan.borrower_name || 'N/A',
        property_address: loan.property_address || 'N/A',
        property_city: loan.property_city || 'N/A',
        property_state: loan.property_state || 'N/A',
        unpaid_principal_balance: loan.unpaid_principal_balance ? parseFloat(loan.unpaid_principal_balance) : 0,
        interest_rate: loan.interest_rate ? parseFloat(loan.interest_rate) : 0,
        next_due_date: loan.next_due_date || 'N/A',
        last_paid_date: loan.last_paid_date || 'N/A',
        legal_status: loan.legal_status || 'N/A'
      });

      // Format currency cell
      const upbCell = row.getCell('unpaid_principal_balance');
      upbCell.numFmt = '$#,##0';

      // Format percentage cell
      const rateCell = row.getCell('interest_rate');
      rateCell.numFmt = '0.00%';
    });

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="loan_report_${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);

  } catch (error) {
    console.error('Error generating Excel report:', error);
    res.status(500).json({ error: 'Failed to generate Excel report' });
  }
});

export default router;