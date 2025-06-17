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
    const result = await pool.query('SELECT * FROM loans WHERE servicer_loan_id = $1', [loanId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Loan not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching loan:', error);
    res.status(500).json({ error: 'Failed to fetch loan' });
  }
});

export default router;