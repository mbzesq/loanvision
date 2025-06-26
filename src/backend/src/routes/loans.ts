import { Router } from 'express';
import pool from '../db';
import { getForeclosureTimeline } from '../services/foreclosureService';
import { enrichLoanWithPropertyData, getCurrentPropertyData } from '../services/homeHarvestService';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/loans', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM loans ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({ error: 'Failed to fetch loans' });
  }
});


router.get('/loans/:loanId/enrichments', authenticateToken, async (req, res) => {
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
router.get('/v2/loans/:loanId', authenticateToken, async (req, res) => {
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
router.get('/v2/loans', authenticateToken, async (req, res) => {
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
router.get('/loans/:loanId/foreclosure-timeline', authenticateToken, async (req, res) => {
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

// V2 endpoint to get property details for a loan
router.get('/v2/loans/:loanId/property-details', authenticateToken, async (req, res) => {
  try {
    const { loanId } = req.params;

    if (!loanId) {
      return res.status(400).json({ error: 'Loan ID is required' });
    }

    // Fetch the current property data
    const propertyData = await getCurrentPropertyData(loanId);

    if (!propertyData) {
      return res.status(404).json({ 
        error: 'No property data found for this loan',
        loan_id: loanId 
      });
    }

    res.json({
      loan_id: loanId,
      property_data: propertyData,
      last_updated: propertyData.last_updated || new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching property details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch property details',
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// V2 endpoint to trigger property data enrichment
router.post('/v2/loans/:loanId/enrich', authenticateToken, async (req, res) => {
  try {
    const { loanId } = req.params;

    // Validate loan_id
    if (!loanId) {
      return res.status(400).json({ error: 'Loan ID is required' });
    }

    // First, fetch the loan's address from daily_metrics_current
    const loanQuery = `
      SELECT loan_id, address, city, state, zip 
      FROM daily_metrics_current 
      WHERE loan_id = $1
    `;
    const loanResult = await pool.query(loanQuery, [loanId]);

    if (loanResult.rows.length === 0) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    const loan = loanResult.rows[0];
    
    // Construct full address for HomeHarvest
    const fullAddress = `${loan.address}, ${loan.city}, ${loan.state} ${loan.zip}`.trim();
    
    if (!fullAddress || fullAddress === ', ') {
      return res.status(400).json({ 
        error: 'Loan does not have a valid address for enrichment' 
      });
    }

    console.log(`[API] Starting property enrichment for loan ${loanId} at address: ${fullAddress}`);

    // Trigger the enrichment process
    await enrichLoanWithPropertyData(loanId, fullAddress);

    // Fetch the newly saved property data
    const propertyData = await getCurrentPropertyData(loanId);

    console.log(`[API] Property enrichment completed for loan ${loanId}`);

    res.status(200).json({
      success: true,
      message: 'Property data enrichment completed successfully',
      loan_id: loanId,
      address: fullAddress,
      property_data: propertyData
    });

  } catch (error) {
    console.error('Error during property enrichment:', error);
    
    // Determine appropriate error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (errorMessage.includes('HomeHarvest script exited with code')) {
      res.status(500).json({ 
        error: 'Failed to fetch property data from external source',
        details: errorMessage 
      });
    } else if (errorMessage.includes('Failed to parse HomeHarvest output')) {
      res.status(502).json({ 
        error: 'Invalid response from property data source',
        details: errorMessage 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to enrich property data',
        details: errorMessage 
      });
    }
  }
});

export default router;