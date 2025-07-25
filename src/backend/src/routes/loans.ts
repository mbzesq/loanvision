import { Router } from 'express';
import pool from '../db';
import { getForeclosureTimeline } from '../services/foreclosureService';
import { enrichLoanWithPropertyData } from '../services/homeHarvestService';
import { getCurrentPropertyData } from '../services/propertyDataService';
// import { enrichLoanWithRentCast } from '../services/rentCastService';
import { authenticateToken } from '../middleware/authMiddleware';
import organizationAccessService from '../services/organizationAccessService';

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

// GET /loans/search - Search loans for task assignment
router.get('/loans/search', authenticateToken, async (req: any, res) => {
  try {
    console.log('Loan search endpoint hit with query:', req.query);
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      console.log('Invalid query parameter:', q);
      return res.status(400).json({ error: 'Search query (q) is required' });
    }
    
    const searchTerm = `%${q.toLowerCase()}%`;
    console.log('Searching loans with term:', searchTerm);
    
    // Apply organization-based filtering
    const baseQuery = `
      SELECT 
        loan_id,
        first_name,
        last_name,
        address,
        city,
        state,
        zip,
        prin_bal,
        legal_status
      FROM daily_metrics_current 
      WHERE (
        LOWER(loan_id) LIKE $1 OR
        LOWER(CONCAT(first_name, ' ', last_name)) LIKE $1 OR
        LOWER(address) LIKE $1 OR
        LOWER(city) LIKE $1
      ) {LOAN_FILTER}
      ORDER BY 
        CASE 
          WHEN LOWER(loan_id) = LOWER($2) THEN 1
          WHEN LOWER(loan_id) LIKE $1 THEN 2
          WHEN LOWER(CONCAT(first_name, ' ', last_name)) LIKE $1 THEN 3
          ELSE 4
        END,
        loan_id
      LIMIT 20
    `;
    
    const { query, params } = await organizationAccessService.applyLoanFilter(
      baseQuery, 
      req.user.id, 
      [searchTerm, q.toLowerCase()]
    );
    
    const result = await pool.query(query, params);
    
    console.log('Raw database results:', result.rows.length, 'rows');
    
    const loans = result.rows.map(loan => {
      const borrowerName = `${loan.first_name || ''} ${loan.last_name || ''}`.trim();
      return {
        id: loan.loan_id,
        display_name: `${loan.loan_id} - ${borrowerName}`,
        borrower_name: borrowerName,
        property_address: loan.address,
        property_city: loan.city,
        property_state: loan.state,
        property_zip: loan.zip,
        current_balance: loan.prin_bal,
        loan_status: loan.legal_status
      };
    });
    
    console.log('Processed loans for response:', loans.length, 'loans');
    res.json({ loans });
  } catch (error) {
    console.error('Error searching loans:', error);
    res.status(500).json({ error: 'Failed to search loans' });
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
router.get('/v2/loans/:loanId', authenticateToken, organizationAccessService.createLoanAccessMiddleware(), async (req, res) => {
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
router.get('/v2/loans', authenticateToken, async (req: any, res) => {
  try {
    const baseQuery = `
      SELECT
        dmc.*,
        fe.id AS foreclosure_id,
        fe.fc_status,
        fe.fc_jurisdiction,
        fe.fc_start_date,
        fe.referral_date,
        fe.title_ordered_date,
        fe.title_received_date,
        fe.complaint_filed_date,
        fe.service_completed_date,
        fe.judgment_date,
        fe.sale_scheduled_date,
        fe.sale_held_date,
        fe.referral_expected_completion_date,
        fe.title_ordered_expected_completion_date,
        fe.title_received_expected_completion_date,
        fe.complaint_filed_expected_completion_date,
        fe.service_completed_expected_completion_date,
        fe.judgment_expected_completion_date,
        fe.sale_scheduled_expected_completion_date,
        fe.sale_held_expected_completion_date
      FROM
        daily_metrics_current AS dmc
      LEFT JOIN
        foreclosure_events AS fe
      ON
        dmc.loan_id = fe.loan_id
      WHERE 1=1 {LOAN_FILTER}
      ORDER BY
        dmc.loan_id;
    `;
    
    const { query, params } = await organizationAccessService.applyLoanFilter(
      baseQuery, 
      req.user.id
    );
    
    const result = await pool.query(query, params);
    console.log(`[Backend] V2 loans query returned ${result.rows.length} rows.`); // MANDATORY LOG
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching V2 loans data:', error);
    res.status(500).json({ error: 'Failed to fetch consolidated loan data' });
  }
});

// Endpoint for foreclosure timeline
router.get('/loans/:loanId/foreclosure-timeline', authenticateToken, organizationAccessService.createLoanAccessMiddleware(), async (req, res) => {
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
router.get('/v2/loans/:loanId/property-details', authenticateToken, organizationAccessService.createLoanAccessMiddleware(), async (req, res) => {
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
      last_updated: propertyData.last_updated
    });

  } catch (error) {
    console.error('Error fetching property details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch property details',
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// V2 endpoint to trigger RentCast property data enrichment
router.post('/v2/loans/:loanId/enrich', authenticateToken, organizationAccessService.createLoanAccessMiddleware('servicer'), async (req, res) => {
  // Local helper function for proper title case formatting
  function toTitleCase(str: string): string {
    if (!str) return '';
    // This regex handles words separated by spaces or hyphens
    return str.toLowerCase().replace(/\b(\w|')/g, s => s.toUpperCase());
  }

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
    
    // Format each address component according to RentCast API requirements
    const formattedAddress = toTitleCase(loan.address || '');
    const formattedCity = toTitleCase(loan.city || '');
    const formattedState = (loan.state || '').toUpperCase(); // Critical: keep state in uppercase
    const formattedZip = loan.zip || '';

    // Construct the properly formatted address
    const addressParts = [formattedAddress, formattedCity, formattedState, formattedZip];
    const fullAddress = addressParts.filter(Boolean).join(', ');
    
    if (!fullAddress || fullAddress === ', ') {
      return res.status(400).json({ 
        error: 'Loan does not have a valid address for enrichment' 
      });
    }

    console.log(`[API] Starting RentCast property enrichment for loan ${loanId} at address: ${fullAddress}`);

    // Trigger the RentCast enrichment process
    //     const enrichedData = await enrichLoanWithRentCast(loanId, fullAddress);

    console.log(`[API] RentCast property enrichment completed for loan ${loanId}`);

    res.status(200).json({
      success: true,
      message: 'Property data enrichment completed successfully with RentCast',
      loan_id: loanId,
      address: fullAddress,
      source: 'RentCast',
      // property_data: enrichedData
    });

  } catch (error) {
    console.error('Error during RentCast property enrichment:', error);
    
    // Determine appropriate error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (errorMessage.includes('authentication failed')) {
      res.status(401).json({ 
        error: 'RentCast API authentication failed',
        details: 'Please check the API configuration' 
      });
    } else if (errorMessage.includes('Property not found')) {
      res.status(404).json({ 
        error: 'Property not found in RentCast database',
        details: errorMessage 
      });
    } else if (errorMessage.includes('rate limit exceeded')) {
      res.status(429).json({ 
        error: 'RentCast API rate limit exceeded',
        details: 'Please try again later' 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to enrich property data with RentCast',
        details: errorMessage 
      });
    }
  }
});

// Legacy endpoint for HomeHarvest enrichment (keeping for backward compatibility)
router.post('/v2/loans/:loanId/enrich-homeharvest', authenticateToken, organizationAccessService.createLoanAccessMiddleware('servicer'), async (req, res) => {
  try {
    const { loanId } = req.params;

    if (!loanId) {
      return res.status(400).json({ error: 'Loan ID is required' });
    }

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
    const fullAddress = `${loan.address}, ${loan.city}, ${loan.state} ${loan.zip}`.trim();
    
    if (!fullAddress || fullAddress === ', ') {
      return res.status(400).json({ 
        error: 'Loan does not have a valid address for enrichment' 
      });
    }

    console.log(`[API] Starting HomeHarvest property enrichment for loan ${loanId} at address: ${fullAddress}`);

    await enrichLoanWithPropertyData(loanId, fullAddress);
    const propertyData = await getCurrentPropertyData(loanId);

    console.log(`[API] HomeHarvest property enrichment completed for loan ${loanId}`);

    res.status(200).json({
      success: true,
      message: 'Property data enrichment completed successfully with HomeHarvest',
      loan_id: loanId,
      address: fullAddress,
      source: 'HomeHarvest',
      property_data: propertyData
    });

  } catch (error) {
    console.error('Error during HomeHarvest property enrichment:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (errorMessage.includes('HomeHarvest script exited with code')) {
      res.status(500).json({ 
        error: 'Failed to fetch property data from HomeHarvest',
        details: errorMessage 
      });
    } else if (errorMessage.includes('Failed to parse HomeHarvest output')) {
      res.status(502).json({ 
        error: 'Invalid response from HomeHarvest',
        details: errorMessage 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to enrich property data with HomeHarvest',
        details: errorMessage 
      });
    }
  }
});

export default router;