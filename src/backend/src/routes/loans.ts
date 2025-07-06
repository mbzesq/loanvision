import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import pool from '../db';

const router = Router();

// GET /api/loans
router.get('/loans', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        loan_id,
        current_upb,
        property_type,
        property_state,
        lien_position
      FROM daily_metrics_current
      LIMIT 100
    `);
    
    res.json({ loans: result.rows });
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;