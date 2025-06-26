import { Router } from 'express';
import pool from '../db';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/portfolio/summary', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as loan_count,
        COALESCE(SUM(unpaid_principal_balance), 0) as total_upb,
        COALESCE(AVG(unpaid_principal_balance), 0) as average_balance
      FROM loans
    `;
    
    const result = await pool.query(query);
    const row = result.rows[0];
    
    // Convert BigInt count to number and format the response
    const summary = {
      loanCount: parseInt(row.loan_count),
      totalUPB: parseFloat(row.total_upb) || 0,
      averageBalance: parseFloat(row.average_balance) || 0
    };
    
    res.json(summary);
  } catch (error) {
    console.error('Error fetching portfolio summary:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio summary' });
  }
});

export default router;