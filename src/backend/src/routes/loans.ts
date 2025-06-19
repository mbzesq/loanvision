import { Router } from 'express';
import pool from '../db';

const router = Router();

router.get('/loans', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM loans ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({ error: 'Failed to fetch loans' });
  }
});

router.get('/loans/:loanId', async (req, res) => {
  try {
    const { loanId } = req.params;
    console.log(`[Backend] Fetching loan with ID: ${loanId}`); // Add this log

    const result = await pool.query(
      'SELECT * FROM loans WHERE servicer_loan_id::text = $1', // Modify this query
      [loanId]
    );

    if (result.rows.length === 0) {
      console.warn(`[Backend] No loan found for ID: ${loanId}`); // Add this log
      return res.status(404).json({ error: 'Loan not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching loan:', error);
    res.status(500).json({ error: 'Failed to fetch loan' });
  }
});

router.get('/loans/:loanId/enrichments', async (req, res) => {
  try {
    const { loanId } = req.params;
    
    // First, get the loan's internal ID using the servicer_loan_id
    const loanResult = await pool.query('SELECT id FROM loans WHERE servicer_loan_id = $1', [loanId]);
    
    if (loanResult.rows.length === 0) {
      return res.status(404).json({ error: 'Loan not found' });
    }
    
    const internalLoanId = loanResult.rows[0].id;
    
    // Fetch all enrichments for this loan
    const enrichmentResult = await pool.query(
      'SELECT * FROM enrichments WHERE loan_id = $1 ORDER BY created_at DESC',
      [internalLoanId]
    );
    
    res.json(enrichmentResult.rows);
  } catch (error) {
    console.error('Error fetching loan enrichments:', error);
    res.status(500).json({ error: 'Failed to fetch loan enrichments' });
  }
});

export default router;