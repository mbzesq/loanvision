import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { ParsedLoan } from '@loanvision/shared';

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper function to clean currency values (remove $ and ,)
const cleanCurrency = (value: any): number | null => {
    if (value === undefined || value === null || value === '') return null;
    const cleaned = String(value).replace(/[$,]/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
};

// Helper function to clean percentage values (remove % and convert to decimal)
const cleanPercentage = (value: any): number | null => {
    if (value === undefined || value === null || value === '') return null;
    const cleaned = String(value).replace(/%/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num / 100; // Convert to decimal (9.50% becomes 0.095)
};

// Helper function to combine first and last name
const combineName = (firstName: any, lastName: any): string | null => {
    const first = firstName ? String(firstName).trim() : '';
    const last = lastName ? String(lastName).trim() : '';
    if (!first && !last) return null;
    return `${first} ${last}`.trim();
};

// Helper function to get a clean string value
const getString = (value: any): string | null => {
    if (value === undefined || value === null || value === '') return null;
    return String(value).trim();
};

// Helper function to get a clean number value
const getNumber = (value: any): number | null => {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
};

router.post('/upload', upload.single('loanFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false }); // raw: false to get formatted strings
        const loans = jsonData as ParsedLoan[];

        const uploadSessionId = uuidv4();
        await pool.query(
            `INSERT INTO upload_sessions (id, original_filename, file_type, record_count, status)
             VALUES ($1, $2, $3, $4, $5)`,
            [uploadSessionId, req.file.originalname, 'excel', loans.length, 'processing']
        );

        let insertedCount = 0;
        const insertQuery = `
            INSERT INTO loans (
                upload_session_id, borrower_name, co_borrower_name, property_address,
                property_city, property_state, property_zip, loan_amount,
                interest_rate, maturity_date, original_lender, unpaid_principal_balance,
                accrued_interest, total_balance, last_paid_date, next_due_date,
                remaining_term_months, legal_status, lien_position, investor_name, source_filename
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        `;

        for (const loan of loans) {
            try {
                // Extract and clean all values according to the mapping
                const borrowerName = combineName(loan['First Name'], loan['Last Name']) || 
                                   getString(loan['Borrower Name']) || 
                                   getString(loan['BorrowerName']) || 
                                   getString(loan['borrower_name']);

                const values = [
                    uploadSessionId,
                    borrowerName,
                    getString(loan['Co-Borrower Name']) || getString(loan['CoBorrowerName']) || getString(loan['co_borrower_name']),
                    getString(loan['Address']) || getString(loan['Property Address']) || getString(loan['PropertyAddress']) || getString(loan['property_address']),
                    getString(loan['City']) || getString(loan['property_city']),
                    getString(loan['State']) || getString(loan['property_state']),
                    getString(loan['Zip']) || getString(loan['Zip Code']) || getString(loan['ZipCode']) || getString(loan['property_zip']),
                    cleanCurrency(loan['Org Amount']) || cleanCurrency(loan['Original Loan Amount']) || cleanCurrency(loan['LoanAmount']) || cleanCurrency(loan['loan_amount']),
                    cleanPercentage(loan['Int Rate']) || cleanPercentage(loan['Interest Rate']) || cleanPercentage(loan['InterestRate']) || cleanPercentage(loan['interest_rate']),
                    getString(loan['Maturity Date']) || getString(loan['MaturityDate']) || getString(loan['maturity_date']),
                    getString(loan['Original Lender']) || getString(loan['OriginalLender']) || getString(loan['original_lender']),
                    cleanCurrency(loan['Prin Bal']) || cleanCurrency(loan['UPB']) || cleanCurrency(loan['Unpaid Principal Balance']) || cleanCurrency(loan['unpaid_principal_balance']),
                    cleanCurrency(loan['Accrued Interest']) || cleanCurrency(loan['AccruedInterest']) || cleanCurrency(loan['accrued_interest']),
                    cleanCurrency(loan['Total Balance']) || cleanCurrency(loan['TotalBalance']) || cleanCurrency(loan['total_balance']),
                    getString(loan['Last Pymt Received']) || getString(loan['Last Payment Date']) || getString(loan['LastPaymentDate']) || getString(loan['last_paid_date']),
                    getString(loan['Next Pymt Due']) || getString(loan['Next Due Date']) || getString(loan['NextDueDate']) || getString(loan['next_due_date']),
                    getNumber(loan['Remg Term']) || getNumber(loan['Remaining Term']) || getNumber(loan['RemainingTerm']) || getNumber(loan['remaining_term_months']),
                    getString(loan['Legal Status']) || getString(loan['LegalStatus']) || getString(loan['legal_status']),
                    getString(loan['Lien Pos']) || getString(loan['Lien Position']) || getString(loan['LienPosition']) || getString(loan['lien_position']),
                    getString(loan['Investor Name']) || getString(loan['InvestorName']) || getString(loan['investor_name']),
                    req.file.originalname,
                ];
                
                await pool.query(insertQuery, values);
                insertedCount++;
            } catch (error) {
                console.error('Error inserting loan:', error);
                console.error('Loan data:', loan); // Log the problematic loan for debugging
            }
        }

        // Update session status
        await pool.query(
          `UPDATE upload_sessions SET status = $1 WHERE id = $2`,
          ['completed', uploadSessionId]
        );

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