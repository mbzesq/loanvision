import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

interface BetaRequest {
  fullName: string;
  email: string;
  company: string;
  role: string;
  portfolioSize: string;
  additionalInfo?: string;
  timestamp: string;
  source: string;
}

// POST /api/beta-access
router.post('/beta-access', async (req: Request<{}, {}, BetaRequest>, res: Response) => {
  try {
    const { 
      fullName, 
      email, 
      company, 
      role, 
      portfolioSize, 
      additionalInfo, 
      timestamp, 
      source 
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !company || !role || !portfolioSize) {
      return res.status(400).json({ 
        error: 'Missing required fields: fullName, email, company, role, portfolioSize' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if a request with this email already exists
    const existingRequest = await pool.query(
      'SELECT id FROM beta_requests WHERE email = $1',
      [email]
    );

    if (existingRequest.rows.length > 0) {
      return res.status(409).json({ 
        error: 'A beta access request with this email already exists' 
      });
    }

    // Calculate priority score based on portfolio size
    const calculatePriority = (portfolioSize: string): number => {
      switch (portfolioSize) {
        case 'over-5b': return 100;
        case '1b-5b': return 90;
        case '500m-1b': return 80;
        case '100m-500m': return 70;
        case '25m-100m': return 60;
        case 'under-25m': return 50;
        default: return 0;
      }
    };

    const priorityScore = calculatePriority(portfolioSize);

    // Insert the beta request
    const result = await pool.query(`
      INSERT INTO beta_requests (
        full_name, 
        email, 
        company, 
        role, 
        portfolio_size, 
        additional_info, 
        timestamp, 
        source, 
        status, 
        priority_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, full_name, email, company, created_at
    `, [
      fullName,
      email,
      company,
      role,
      portfolioSize,
      additionalInfo || null,
      timestamp,
      source,
      'pending',
      priorityScore
    ]);

    const betaRequest = result.rows[0];

    // TODO: Send notification emails here
    // await sendBetaNotification(betaRequest);
    // await sendConfirmationEmail(betaRequest);

    console.log(`[Beta Access] New request from ${fullName} at ${company} (${portfolioSize} AUM)`);

    res.status(201).json({
      message: 'Beta access request submitted successfully',
      requestId: betaRequest.id,
      status: 'pending'
    });

  } catch (error) {
    console.error('Beta access request error:', error);
    res.status(500).json({ error: 'Failed to submit beta access request' });
  }
});

// GET /api/beta-access (for admin use)
router.get('/beta-access', async (req: Request, res: Response) => {
  try {
    // TODO: Add authentication middleware to protect this endpoint
    const result = await pool.query(`
      SELECT 
        id,
        full_name,
        email,
        company,
        role,
        portfolio_size,
        additional_info,
        status,
        priority_score,
        created_at,
        followed_up_at
      FROM beta_requests 
      ORDER BY priority_score DESC, created_at DESC
    `);

    res.json({
      requests: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching beta requests:', error);
    res.status(500).json({ error: 'Failed to fetch beta requests' });
  }
});

// PUT /api/beta-access/:id/status (for admin use)
router.put('/beta-access/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected', 'contacted'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await pool.query(`
      UPDATE beta_requests 
      SET status = $1, followed_up_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, status
    `, [status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Beta request not found' });
    }

    res.json({
      message: 'Status updated successfully',
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating beta request status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

export default router;