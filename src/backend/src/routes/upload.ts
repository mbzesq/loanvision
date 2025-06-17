import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { Loan } from '@loanvision/shared';
// We will create this enrichment service in a later step.
// import { runEnrichmentJob } from '../services/enrichmentService';

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// --- Data Cleaning Helpers ---
const cleanCurrency = (value: any): number | null => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const cleaned = String(value).replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const cleanPercentage = (value: any): number | null => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const cleaned = String(value).replace(/%/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num / 100.0;
};

const combineName = (loan: Loan, firstKeys: string[], lastKeys: string[]): string | null => {
    const first = firstKeys.map(k => loan[k]).find(v => v) || '';
    const last = lastKeys.map(k => loan[k]).find(v => v) || '';
    const combined = `${first} ${last}`.trim();
    return combined || null;
};

const getValue = (loan: Loan, keys: string[]): any | null => {
    for (const key of keys) {
        const value = loan[key];
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }
    return null;
};

const parseExcelDate = (excelDate: any): string | null => {
  if (typeof excelDate === 'number') {
    const jsDate = XLSX.SSF.parse_date_code(excelDate);
    if (jsDate) {
      // Format to YYYY-MM-DD for PostgreSQL
      const year = jsDate.y;
      const month = String(jsDate.m).padStart(2, '0');
      const day = String(jsDate.d).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  // If it's already a string, try to use it as is (or return null if invalid)
  if (typeof excelDate === 'string' && new Date(excelDate).toString() !== 'Invalid Date') {
    return excelDate;
  }
  return null;
};

// --- Main Upload Endpoint ---
router.post('/upload', upload.single('loanFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet);
    const loans = jsonData as Loan[];

    const uploadSessionId = uuidv4();
    await pool.query(
      `INSERT INTO upload_sessions (id, original_filename, file_type, record_count, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [uploadSessionId, req.file.originalname, 'excel', loans.length, 'processing']
    );

    let insertedCount = 0;
    const insertQuery = `
      INSERT INTO loans (
        upload_session_id, servicer_loan_id, borrower_name, property_address,
        property_city, property_state, property_zip, loan_amount,
        interest_rate, maturity_date, unpaid_principal_balance, last_paid_date,
        next_due_date, remaining_term_months, legal_status, lien_position,
        investor_name, source_filename, data_issues
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
    `;

    for (const loan of loans) {
      try {
        const values = [
          uploadSessionId, // $1
          getValue(loan, ['Loan ID']), // $2 servicer_loan_id
          combineName(loan, ['First Name'], ['Last Name']), // $3 borrower_name
          getValue(loan, ['Address', 'Property Address']), // $4 property_address
          getValue(loan, ['City']), // $5 property_city
          getValue(loan, ['State']), // $6 property_state
          getValue(loan, ['Zip']), // $7 property_zip
          cleanCurrency(getValue(loan, ['Org Amount'])), // $8 loan_amount
          cleanPercentage(getValue(loan, ['Int Rate'])), // $9 interest_rate
          parseExcelDate(getValue(loan, ['Maturity Date'])), // $10 maturity_date
          cleanCurrency(getValue(loan, ['Prin Bal', 'UPB'])), // $11 unpaid_principal_balance
          parseExcelDate(getValue(loan, ['Last Pymt Received'])), // $12 last_paid_date
          parseExcelDate(getValue(loan, ['Next Pymt Due'])), // $13 next_due_date
          getValue(loan, ['Remg Term']), // $14 remaining_term_months
          getValue(loan, ['Legal Status']), // $15 legal_status
          getValue(loan, ['Lien Pos']), // $16 lien_position
          getValue(loan, ['Investor Name']), // $17 investor_name
          req.file.originalname, // $18 source_filename
          null, // $19 data_issues (for now)
        ];

        await pool.query(insertQuery, values);
        insertedCount++;
      } catch (error) {
        console.error('Error inserting loan:', error, 'Loan data:', loan);
      }
    }

    await pool.query(
      `UPDATE upload_sessions SET status = $1 WHERE id = $2`,
      ['completed', uploadSessionId]
    );

    // We will re-implement this in a future step.
    // runEnrichmentJob(uploadSessionId).catch(...)

    res.json({
      status: 'success',
      message: `Successfully imported ${insertedCount} of ${loans.length} loans.`,
      record_count: insertedCount
    });

  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

export default router;