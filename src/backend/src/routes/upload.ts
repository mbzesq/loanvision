import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';

const router = Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/upload', upload.single('loanFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse the Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    
    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert sheet to JSON
    const jsonData = XLSX.utils.sheet_to_json(sheet);
    
    // Create upload session
    const uploadSessionId = uuidv4();
    const sessionResult = await pool.query(
      `INSERT INTO upload_sessions (id, original_filename, file_type, record_count, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [uploadSessionId, req.file.originalname, 'excel', jsonData.length, 'completed']
    );

    // Insert loans into database
    let insertedCount = 0;
    
    for (const loan of jsonData) {
      try {
        await pool.query(
          `INSERT INTO loans (
            upload_session_id,
            borrower_name,
            co_borrower_name,
            property_address,
            property_city,
            property_state,
            property_zip,
            loan_amount,
            interest_rate,
            maturity_date,
            original_lender,
            unpaid_principal_balance,
            accrued_interest,
            total_balance,
            last_paid_date,
            next_due_date,
            remaining_term_months,
            legal_status,
            lien_position,
            investor_name,
            source_filename
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
          )`,
          [
            uploadSessionId,
            loan['Borrower Name'] || loan['BorrowerName'] || loan['borrower_name'],
            loan['Co-Borrower Name'] || loan['CoBorrowerName'] || loan['co_borrower_name'],
            loan['Property Address'] || loan['PropertyAddress'] || loan['property_address'],
            loan['City'] || loan['property_city'],
            loan['State'] || loan['property_state'],
            loan['Zip Code'] || loan['ZipCode'] || loan['property_zip'],
            parseFloat(loan['Original Loan Amount'] || loan['LoanAmount'] || loan['loan_amount'] || 0),
            parseFloat(loan['Interest Rate'] || loan['InterestRate'] || loan['interest_rate'] || 0),
            loan['Maturity Date'] || loan['MaturityDate'] || loan['maturity_date'],
            loan['Original Lender'] || loan['OriginalLender'] || loan['original_lender'],
            parseFloat(loan['UPB'] || loan['Unpaid Principal Balance'] || loan['unpaid_principal_balance'] || 0),
            parseFloat(loan['Accrued Interest'] || loan['AccruedInterest'] || loan['accrued_interest'] || 0),
            parseFloat(loan['Total Balance'] || loan['TotalBalance'] || loan['total_balance'] || 0),
            loan['Last Payment Date'] || loan['LastPaymentDate'] || loan['last_paid_date'],
            loan['Next Due Date'] || loan['NextDueDate'] || loan['next_due_date'],
            parseInt(loan['Remaining Term'] || loan['RemainingTerm'] || loan['remaining_term_months'] || 0),
            loan['Legal Status'] || loan['LegalStatus'] || loan['legal_status'],
            loan['Lien Position'] || loan['LienPosition'] || loan['lien_position'],
            loan['Investor Name'] || loan['InvestorName'] || loan['investor_name'],
            req.file.originalname
          ]
        );
        insertedCount++;
      } catch (error) {
        console.error('Error inserting loan:', error);
        // Continue with next loan even if one fails
      }
    }

    // Return success response
    res.json({
      status: 'success',
      message: `Successfully imported ${insertedCount} loans.`,
      record_count: insertedCount
    });
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

export default router;