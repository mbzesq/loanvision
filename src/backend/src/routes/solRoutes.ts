import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { SOLCalculationService } from '../services/SOLCalculationService';
import { authenticateToken } from '../middleware/authMiddleware';

export function createSOLRoutes(pool: Pool): Router {
  const router = Router();
  const solService = new SOLCalculationService(pool);

  // All routes require authentication
  router.use(authenticateToken);

  /**
   * GET /api/sol/jurisdictions
   * Get all SOL jurisdictions with summary stats
   */
  router.get('/jurisdictions', async (req: Request, res: Response) => {
    try {
      const query = `
        SELECT 
          j.state_code,
          j.state_name,
          j.risk_level,
          p.lien_years,
          p.note_years,
          p.foreclosure_years,
          ee.lien_extinguished,
          ee.foreclosure_barred,
          COUNT(DISTINCT lsc.loan_id) as affected_loans,
          SUM(CASE WHEN lsc.is_expired THEN 1 ELSE 0 END) as expired_loans,
          SUM(CASE WHEN lsc.days_until_expiration BETWEEN 0 AND 365 THEN 1 ELSE 0 END) as expiring_soon
        FROM sol_jurisdictions j
        LEFT JOIN sol_periods p ON p.jurisdiction_id = j.id
        LEFT JOIN sol_expiration_effects ee ON ee.jurisdiction_id = j.id
        LEFT JOIN loan_sol_calculations lsc ON lsc.jurisdiction_id = j.id
        GROUP BY j.id, j.state_code, j.state_name, j.risk_level,
                 p.lien_years, p.note_years, p.foreclosure_years,
                 ee.lien_extinguished, ee.foreclosure_barred
        ORDER BY j.state_code
      `;

      const result = await pool.query(query);
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error fetching SOL jurisdictions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch SOL jurisdictions'
      });
    }
  });

  /**
   * GET /api/sol/jurisdiction/:stateCode
   * Get detailed SOL rules for a specific state
   */
  router.get('/jurisdiction/:stateCode', async (req: Request, res: Response) => {
    try {
      const { stateCode } = req.params;

      const query = `
        SELECT 
          j.*,
          json_build_object(
            'lien_years', p.lien_years,
            'note_years', p.note_years,
            'foreclosure_years', p.foreclosure_years,
            'deficiency_years', p.deficiency_years,
            'additional_periods', p.additional_periods
          ) as sol_periods,
          array_agg(DISTINCT te.event_type) as trigger_events,
          array_agg(DISTINCT tp.provision_type) as tolling_provisions,
          array_agg(DISTINCT sp.provision) as special_provisions,
          array_agg(DISTINCT sc.citation) as statute_citations,
          array_agg(DISTINCT sn.note) as notes,
          json_build_object(
            'lien_extinguished', ee.lien_extinguished,
            'foreclosure_barred', ee.foreclosure_barred,
            'deficiency_barred', ee.deficiency_barred,
            'becomes_unsecured', ee.becomes_unsecured,
            'special_effects', ee.special_effects
          ) as effect_of_expiration,
          json_build_object(
            'partial_payment', rm.partial_payment,
            'written_acknowledgment', rm.written_acknowledgment,
            'new_promise', rm.new_promise,
            'other_methods', rm.other_methods
          ) as revival_methods
        FROM sol_jurisdictions j
        LEFT JOIN sol_periods p ON p.jurisdiction_id = j.id
        LEFT JOIN sol_trigger_events te ON te.jurisdiction_id = j.id
        LEFT JOIN sol_tolling_provisions tp ON tp.jurisdiction_id = j.id
        LEFT JOIN sol_special_provisions sp ON sp.jurisdiction_id = j.id
        LEFT JOIN sol_statute_citations sc ON sc.jurisdiction_id = j.id
        LEFT JOIN sol_notes sn ON sn.jurisdiction_id = j.id
        LEFT JOIN sol_expiration_effects ee ON ee.jurisdiction_id = j.id
        LEFT JOIN sol_revival_methods rm ON rm.jurisdiction_id = j.id
        WHERE j.state_code = $1
        GROUP BY j.id, p.lien_years, p.note_years, p.foreclosure_years, 
                 p.deficiency_years, p.additional_periods,
                 ee.lien_extinguished, ee.foreclosure_barred, ee.deficiency_barred,
                 ee.becomes_unsecured, ee.special_effects,
                 rm.partial_payment, rm.written_acknowledgment, rm.new_promise, rm.other_methods
      `;

      const result = await pool.query(query, [stateCode.toUpperCase()]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Jurisdiction not found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error fetching jurisdiction details:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch jurisdiction details'
      });
    }
  });

  /**
   * POST /api/sol/calculate/:loanId
   * Calculate SOL for a specific loan
   */
  router.post('/calculate/:loanId', async (req: Request, res: Response) => {
    try {
      const { loanId } = req.params;

      // Get loan data
      const loanQuery = `
        SELECT 
          l.id as loan_id,
          l.property_state,
          l.origination_date,
          l.maturity_date,
          ld.first_default_date as default_date,
          ld.last_payment_date,
          ld.acceleration_date,
          ld.charge_off_date,
          fs.status as foreclosure_status,
          fs.complaint_filed_date
        FROM loans l
        LEFT JOIN loan_details ld ON ld.loan_id = l.id
        LEFT JOIN foreclosure_status fs ON fs.loan_id = l.id
        WHERE l.id = $1
      `;

      const loanResult = await pool.query(loanQuery, [loanId]);
      
      if (loanResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Loan not found'
        });
      }

      const loanData = loanResult.rows[0];
      
      // Calculate SOL
      const solResult = await solService.calculateLoanSOL(loanData);
      
      if (!solResult) {
        return res.json({
          success: true,
          data: null,
          message: 'No valid SOL triggers found for this loan'
        });
      }

      // Store the result
      await solService.storeCalculationResult(solResult);

      res.json({
        success: true,
        data: solResult
      });
    } catch (error) {
      console.error('Error calculating SOL:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate SOL'
      });
    }
  });

  /**
   * POST /api/sol/calculate-portfolio
   * Calculate SOL for entire portfolio
   */
  router.post('/calculate-portfolio', async (req: Request, res: Response) => {
    try {
      // This could be a long-running operation
      // In production, you'd want to queue this as a background job
      
      const result = await solService.calculatePortfolioSOL();
      
      res.json({
        success: true,
        data: {
          processed: result.processed,
          errors: result.errors
        }
      });
    } catch (error) {
      console.error('Error calculating portfolio SOL:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate portfolio SOL'
      });
    }
  });

  /**
   * GET /api/sol/portfolio-summary
   * Get SOL risk summary for entire portfolio
   */
  router.get('/portfolio-summary', async (req: Request, res: Response) => {
    try {
      const query = `
        WITH sol_stats AS (
          SELECT 
            COUNT(*) as total_loans,
            COUNT(lsc.id) as analyzed_loans,
            SUM(CASE WHEN lsc.is_expired THEN 1 ELSE 0 END) as expired_loans,
            SUM(CASE WHEN lsc.days_until_expiration BETWEEN 0 AND 365 THEN 1 ELSE 0 END) as expiring_within_1_year,
            SUM(CASE WHEN lsc.days_until_expiration BETWEEN 0 AND 730 THEN 1 ELSE 0 END) as expiring_within_2_years,
            SUM(CASE WHEN lsc.sol_risk_level = 'HIGH' THEN 1 ELSE 0 END) as high_risk_loans,
            SUM(CASE WHEN lsc.sol_risk_level = 'MEDIUM' THEN 1 ELSE 0 END) as medium_risk_loans,
            SUM(CASE WHEN lsc.sol_risk_level = 'LOW' THEN 1 ELSE 0 END) as low_risk_loans,
            SUM(CASE WHEN lsc.is_expired THEN l.current_upb ELSE 0 END) as expired_upb,
            SUM(CASE WHEN lsc.days_until_expiration BETWEEN 0 AND 365 THEN l.current_upb ELSE 0 END) as expiring_soon_upb
          FROM loans l
          LEFT JOIN loan_sol_calculations lsc ON lsc.loan_id = l.id
          WHERE l.property_state IS NOT NULL
        ),
        state_breakdown AS (
          SELECT 
            l.property_state,
            sj.risk_level as jurisdiction_risk,
            COUNT(DISTINCT l.id) as loan_count,
            SUM(l.current_upb) as total_upb,
            AVG(lsc.days_until_expiration) as avg_days_until_expiration,
            SUM(CASE WHEN lsc.is_expired THEN 1 ELSE 0 END) as expired_count
          FROM loans l
          LEFT JOIN loan_sol_calculations lsc ON lsc.loan_id = l.id
          LEFT JOIN sol_jurisdictions sj ON sj.state_code = l.property_state
          WHERE l.property_state IS NOT NULL
          GROUP BY l.property_state, sj.risk_level
          ORDER BY expired_count DESC, total_upb DESC
          LIMIT 10
        )
        SELECT 
          json_build_object(
            'total_loans', total_loans,
            'analyzed_loans', analyzed_loans,
            'expired_loans', expired_loans,
            'expiring_within_1_year', expiring_within_1_year,
            'expiring_within_2_years', expiring_within_2_years,
            'high_risk_loans', high_risk_loans,
            'medium_risk_loans', medium_risk_loans,
            'low_risk_loans', low_risk_loans,
            'expired_upb', expired_upb,
            'expiring_soon_upb', expiring_soon_upb
          ) as summary,
          (SELECT json_agg(state_breakdown.*) FROM state_breakdown) as top_states_at_risk
        FROM sol_stats
      `;

      const result = await pool.query(query);
      const data = result.rows[0];

      res.json({
        success: true,
        data: {
          summary: data.summary,
          topStatesAtRisk: data.top_states_at_risk || []
        }
      });
    } catch (error) {
      console.error('Error fetching portfolio SOL summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch portfolio SOL summary'
      });
    }
  });

  /**
   * GET /api/sol/loans
   * Get loans with SOL calculations
   */
  router.get('/loans', async (req: Request, res: Response) => {
    try {
      const { 
        risk_level, 
        state, 
        expired_only,
        limit = 100,
        offset = 0
      } = req.query;

      let whereConditions = ['l.property_state IS NOT NULL'];
      const params: any[] = [];
      let paramCount = 0;

      if (risk_level) {
        whereConditions.push(`lsc.sol_risk_level = $${++paramCount}`);
        params.push(risk_level);
      }

      if (state) {
        whereConditions.push(`l.property_state = $${++paramCount}`);
        params.push(state);
      }

      if (expired_only === 'true') {
        whereConditions.push('lsc.is_expired = true');
      }

      const query = `
        SELECT 
          l.id,
          l.loan_number,
          l.borrower_name,
          l.property_state,
          l.current_upb,
          l.loan_status,
          lsc.sol_trigger_date,
          lsc.sol_trigger_event,
          lsc.adjusted_expiration_date,
          lsc.days_until_expiration,
          lsc.is_expired,
          lsc.sol_risk_level,
          lsc.sol_risk_score,
          lsc.risk_factors,
          sj.risk_level as jurisdiction_risk_level
        FROM loans l
        JOIN loan_sol_calculations lsc ON lsc.loan_id = l.id
        JOIN sol_jurisdictions sj ON sj.id = lsc.jurisdiction_id
        ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
        ORDER BY lsc.sol_risk_score DESC, lsc.days_until_expiration ASC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;

      params.push(limit, offset);

      const result = await pool.query(query, params);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          total: result.rows.length
        }
      });
    } catch (error) {
      console.error('Error fetching loans with SOL:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch loans with SOL data'
      });
    }
  });

  return router;
}