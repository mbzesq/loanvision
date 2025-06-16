import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { ParsedLoan } from '@loanvision/shared';

const router = Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper function to safely get a value from a loan object using multiple possible keys
// and default to an empty string if none are found.
const getLoanValue = (loan: ParsedLoan, keys: string[]): string => {
    for (const key of keys) {
        if (loan[key] !== undefined && loan[key] !== null) {
            return String(loan[key]);
        }
    }
    return ''; // Return an empty string as a safe default
};

router.post('/upload', upload.single('loanFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Parse the Excel file
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        const loans = jsonData as ParsedLoan[]; // Cast the parsed data to our ParsedLoan type

        // Create upload session
        const uploadSessionId = uuidv4();
        await pool.query(
            `INSERT INTO upload_sessions (id, original_filename, file_type, record_count, status)
             VALUES ($1, $2, $3, $4, $5)`,
            [uploadSessionId, req.file.originalname, 'excel', loans.length, 'completed']
        );

        // Insert loans into database
        let insertedCount = 0;
        const insertQuery = `
            INSERT INTO loans (
                upload_session_id, borrower_name, co_borrower_name, property_address,
                property_city, property_state, property_zip, loan_amount,
                interest_rate, maturity_date, original_lender, unpaid_principal_balance,
                accrued_interest, total_balance, last_paid_date, next_due_date,
                remaining_term_months, legal_status, lien_position, investor_name, source_filename
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
            )
        `;

        for (const loan of loans) {
            try {
                // Use the helper function to safely get and convert all values
                const values = [
                    uploadSessionId,
                    getLoanValue(loan, ['Borrower Name', 'BorrowerName', 'borrower_name']),
                    getLoanValue(loan, ['Co-Borrower Name', 'CoBorrowerName', 'co_borrower_name']),
                    getLoanValue(loan, ['Property Address', 'PropertyAddress', 'property_address']),
                    getLoanValue(loan, ['City', 'property_city']),
                    getLoanValue(loan, ['State', 'property_state']),
                    getLoanValue(loan, ['Zip Code', 'ZipCode', 'property_zip']),
                    getLoanValue(loan, ['Original Loan Amount', 'LoanAmount', 'loan_amount']),
                    getLoanValue(loan, ['Interest Rate', 'InterestRate', 'interest_rate']),
                    getLoanValue(loan, ['Maturity Date', 'MaturityDate', 'maturity_date']),
                    getLoanValue(loan, ['Original Lender', 'OriginalLender', 'original_lender']),
                    getLoanValue(loan, ['UPB', 'Unpaid Principal Balance', 'unpaid_principal_balance']),
                    getLoanValue(loan, ['Accrued Interest', 'AccruedInterest', 'accrued_interest']),
                    getLoanValue(loan, ['Total Balance', 'TotalBalance', 'total_balance']),
                    getLoanValue(loan, ['Last Payment Date', 'LastPaymentDate', 'last_paid_date']),
                    getLoanValue(loan, ['Next Due Date', 'NextDueDate', 'next_due_date']),
                    getLoanValue(loan, ['Remaining Term', 'RemainingTerm', 'remaining_term_months']),
                    getLoanValue(loan, ['Legal Status', 'LegalStatus', 'legal_status']),
                    getLoanValue(loan, ['Lien Position', 'LienPosition', 'lien_position']),
                    getLoanValue(loan, ['Investor Name', 'InvestorName', 'investor_name']),
                    req.file.originalname,
                ];

                await pool.query(insertQuery, values);
                insertedCount++;
            } catch (error) {
                console.error('Error inserting loan:', error);
                // Continue with the next loan even if one fails
            }
        }

        // Return success response
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