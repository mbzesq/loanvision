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

export default router;