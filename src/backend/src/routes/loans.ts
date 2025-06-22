import { Router } from 'express';
import pool from '../db';
import { getForeclosureTimeline } from '../services/foreclosureService';

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

// V2 endpoint for single loan details
router.get('/v2/loans/:loanId', async (req, res) => {
  try {
    const { loanId } = req.params;
    const query = 'SELECT * FROM daily_metrics_current WHERE loan_id = $1';
    const result = await pool.query(query, [loanId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Loan not found in current metrics' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching V2 loan detail:', error);
    res.status(500).json({ error: 'Failed to fetch loan detail' });
  }
});

// V2 endpoint for all loans
router.get('/v2/loans', async (req, res) => {
  try {
    const query = `
      SELECT
        dmc.*,
        fe.fc_status,
        fe.fc_jurisdiction,
        fe.fc_start_date
      FROM
        daily_metrics_current AS dmc
      LEFT JOIN
        foreclosure_events AS fe
      ON
        dmc.loan_id = fe.loan_id
      ORDER BY
        dmc.loan_id;
    `;
    const result = await pool.query(query);
    console.log(`[Backend] V2 loans query returned ${result.rows.length} rows.`); // MANDATORY LOG
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching V2 loans data:', error);
    res.status(500).json({ error: 'Failed to fetch consolidated loan data' });
  }
});

// Endpoint for foreclosure timeline
router.get('/loans/:loanId/foreclosure-timeline', async (req, res) => {
  try {
    const { loanId } = req.params;
    console.log(`[API] Fetching foreclosure timeline for loan: ${loanId}`);
    const timeline = await getForeclosureTimeline(loanId);

    if (!timeline || timeline.length === 0) {
      console.log(`[API] No foreclosure timeline data found for loan: ${loanId}`);
      return res.json([]); // Return empty array instead of 404
    }

    console.log(`[API] Found ${timeline.length} timeline milestones for loan: ${loanId}`);
    res.json(timeline);
  } catch (error) {
    console.error('Error fetching foreclosure timeline:', error);
    res.status(500).json({ error: 'Failed to fetch foreclosure timeline' });
  }
});

export default router;