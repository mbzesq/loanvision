import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticateToken } from '../middleware/auth';
import logger from '../config/logger';

const router = Router();

export function createAlertsRouter(db: Pool): Router {
  // Get active alerts for current user
  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { status, severity, loanId } = req.query;

      let query = `
        SELECT DISTINCT
          a.*,
          ar.name as rule_name,
          ar.event_type,
          ar.description as rule_description,
          dmc.property_address,
          dmc.borrower_name,
          cd.file_name as document_name
        FROM alerts a
        JOIN alert_rules ar ON a.alert_rule_id = ar.id
        JOIN alert_subscriptions s ON s.alert_rule_id = ar.id
        LEFT JOIN daily_metrics_current dmc ON a.loan_id = dmc.loan_id
        LEFT JOIN collateral_documents cd ON a.document_id = cd.id
        WHERE s.user_id = $1
        AND s.is_active = true
      `;
      
      const params: any[] = [userId];
      let paramCount = 1;

      if (status) {
        paramCount++;
        query += ` AND a.status = $${paramCount}`;
        params.push(status);
      }

      if (severity) {
        paramCount++;
        query += ` AND a.severity = $${paramCount}`;
        params.push(severity);
      }

      if (loanId) {
        paramCount++;
        query += ` AND a.loan_id = $${paramCount}`;
        params.push(loanId);
      }

      query += ` ORDER BY a.created_at DESC LIMIT 100`;

      const { rows } = await db.query(query, params);
      res.json(rows);
      
    } catch (error) {
      logger.error('Error fetching alerts:', error);
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  });

  // Get alert statistics
  router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      
      const { rows } = await db.query(`
        SELECT
          COUNT(*) FILTER (WHERE a.status = 'active') as active_count,
          COUNT(*) FILTER (WHERE a.status = 'acknowledged') as acknowledged_count,
          COUNT(*) FILTER (WHERE a.status = 'resolved' AND a.resolved_at > NOW() - INTERVAL '7 days') as resolved_this_week,
          COUNT(*) FILTER (WHERE a.severity = 'critical' AND a.status = 'active') as critical_active,
          COUNT(*) FILTER (WHERE a.severity = 'high' AND a.status = 'active') as high_active,
          COUNT(*) FILTER (WHERE a.severity = 'medium' AND a.status = 'active') as medium_active,
          COUNT(*) FILTER (WHERE a.severity = 'low' AND a.status = 'active') as low_active
        FROM alerts a
        JOIN alert_subscriptions s ON s.alert_rule_id = a.alert_rule_id
        WHERE s.user_id = $1
        AND s.is_active = true
      `, [userId]);

      res.json(rows[0]);
      
    } catch (error) {
      logger.error('Error fetching alert stats:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  // Get alert rules (for subscription management)
  router.get('/rules', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      
      const { rows } = await db.query(`
        SELECT 
          ar.*,
          s.id as subscription_id,
          s.delivery_method,
          s.is_active as is_subscribed
        FROM alert_rules ar
        LEFT JOIN alert_subscriptions s ON s.alert_rule_id = ar.id AND s.user_id = $1
        WHERE ar.is_active = true
        ORDER BY ar.event_type, ar.name
      `, [userId]);

      res.json(rows);
      
    } catch (error) {
      logger.error('Error fetching alert rules:', error);
      res.status(500).json({ error: 'Failed to fetch alert rules' });
    }
  });

  // Get single alert details
  router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const alertId = req.params.id;
      
      const { rows } = await db.query(`
        SELECT 
          a.*,
          ar.name as rule_name,
          ar.event_type,
          ar.description as rule_description,
          dmc.property_address,
          dmc.borrower_name,
          dmc.current_upb,
          cd.file_name as document_name,
          cd.confidence_score,
          u_ack.first_name || ' ' || u_ack.last_name as acknowledged_by_name,
          u_res.first_name || ' ' || u_res.last_name as resolved_by_name
        FROM alerts a
        JOIN alert_rules ar ON a.alert_rule_id = ar.id
        JOIN alert_subscriptions s ON s.alert_rule_id = ar.id
        LEFT JOIN daily_metrics_current dmc ON a.loan_id = dmc.loan_id
        LEFT JOIN collateral_documents cd ON a.document_id = cd.id
        LEFT JOIN users u_ack ON a.acknowledged_by = u_ack.id
        LEFT JOIN users u_res ON a.resolved_by = u_res.id
        WHERE a.id = $1
        AND s.user_id = $2
        AND s.is_active = true
      `, [alertId, userId]);

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      // Get action history
      const { rows: actions } = await db.query(`
        SELECT 
          aa.*,
          u.first_name || ' ' || u.last_name as user_name
        FROM alert_actions aa
        JOIN users u ON aa.user_id = u.id
        WHERE aa.alert_id = $1
        ORDER BY aa.created_at DESC
      `, [alertId]);

      res.json({
        ...rows[0],
        actions
      });
      
    } catch (error) {
      logger.error('Error fetching alert:', error);
      res.status(500).json({ error: 'Failed to fetch alert' });
    }
  });

  // Acknowledge alert
  router.post('/:id/acknowledge', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const alertId = req.params.id;
      const { notes } = req.body;

      await db.query('BEGIN');

      // Update alert
      await db.query(`
        UPDATE alerts 
        SET status = 'acknowledged',
            acknowledged_at = CURRENT_TIMESTAMP,
            acknowledged_by = $2
        WHERE id = $1
        AND status = 'active'
      `, [alertId, userId]);

      // Record action
      await db.query(`
        INSERT INTO alert_actions (alert_id, user_id, action, notes)
        VALUES ($1, $2, 'acknowledge', $3)
      `, [alertId, userId, notes]);

      // Mark delivery as read
      await db.query(`
        UPDATE alert_deliveries
        SET read_at = CURRENT_TIMESTAMP
        WHERE alert_id = $1 AND user_id = $2 AND read_at IS NULL
      `, [alertId, userId]);

      await db.query('COMMIT');
      
      res.json({ success: true });
      
    } catch (error) {
      await db.query('ROLLBACK');
      logger.error('Error acknowledging alert:', error);
      res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
  });

  // Resolve alert
  router.post('/:id/resolve', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const alertId = req.params.id;
      const { notes } = req.body;

      await db.query('BEGIN');

      // Update alert
      await db.query(`
        UPDATE alerts 
        SET status = 'resolved',
            resolved_at = CURRENT_TIMESTAMP,
            resolved_by = $2
        WHERE id = $1
        AND status IN ('active', 'acknowledged')
      `, [alertId, userId]);

      // Record action
      await db.query(`
        INSERT INTO alert_actions (alert_id, user_id, action, notes)
        VALUES ($1, $2, 'resolve', $3)
      `, [alertId, userId, notes]);

      await db.query('COMMIT');
      
      res.json({ success: true });
      
    } catch (error) {
      await db.query('ROLLBACK');
      logger.error('Error resolving alert:', error);
      res.status(500).json({ error: 'Failed to resolve alert' });
    }
  });

  // Dismiss alert
  router.post('/:id/dismiss', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const alertId = req.params.id;
      const { reason } = req.body;

      await db.query('BEGIN');

      // Update alert
      await db.query(`
        UPDATE alerts 
        SET status = 'dismissed',
            resolved_at = CURRENT_TIMESTAMP,
            resolved_by = $2
        WHERE id = $1
        AND status IN ('active', 'acknowledged')
      `, [alertId, userId]);

      // Record action
      await db.query(`
        INSERT INTO alert_actions (alert_id, user_id, action, notes)
        VALUES ($1, $2, 'dismiss', $3)
      `, [alertId, userId, `Dismissed: ${reason}`]);

      await db.query('COMMIT');
      
      res.json({ success: true });
      
    } catch (error) {
      await db.query('ROLLBACK');
      logger.error('Error dismissing alert:', error);
      res.status(500).json({ error: 'Failed to dismiss alert' });
    }
  });

  // Subscribe to alert rule
  router.post('/rules/:ruleId/subscribe', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const ruleId = req.params.ruleId;
      const { deliveryMethod = 'in_app' } = req.body;

      await db.query(`
        INSERT INTO alert_subscriptions (user_id, alert_rule_id, delivery_method)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, alert_rule_id) 
        DO UPDATE SET 
          delivery_method = $3,
          is_active = true
      `, [userId, ruleId, deliveryMethod]);
      
      res.json({ success: true });
      
    } catch (error) {
      logger.error('Error subscribing to alerts:', error);
      res.status(500).json({ error: 'Failed to subscribe' });
    }
  });

  // Unsubscribe from alert rule
  router.post('/rules/:ruleId/unsubscribe', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const ruleId = req.params.ruleId;

      await db.query(`
        UPDATE alert_subscriptions
        SET is_active = false
        WHERE user_id = $1 AND alert_rule_id = $2
      `, [userId, ruleId]);
      
      res.json({ success: true });
      
    } catch (error) {
      logger.error('Error unsubscribing from alerts:', error);
      res.status(500).json({ error: 'Failed to unsubscribe' });
    }
  });

  // Mark alerts as read
  router.post('/mark-read', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { alertIds } = req.body;

      if (!Array.isArray(alertIds)) {
        return res.status(400).json({ error: 'alertIds must be an array' });
      }

      await db.query(`
        UPDATE alert_deliveries
        SET read_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 
        AND alert_id = ANY($2::int[])
        AND read_at IS NULL
      `, [userId, alertIds]);
      
      res.json({ success: true });
      
    } catch (error) {
      logger.error('Error marking alerts as read:', error);
      res.status(500).json({ error: 'Failed to mark as read' });
    }
  });

  return router;
}

export default createAlertsRouter;