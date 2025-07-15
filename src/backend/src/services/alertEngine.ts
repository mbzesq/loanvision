import { Pool } from 'pg';
import { EventEmitter } from 'events';
import logger from '../config/logger';

export interface AlertRule {
  id: number;
  name: string;
  description: string;
  event_type: string;
  condition_json: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  is_active: boolean;
}

export interface Alert {
  id: number;
  alert_rule_id: number;
  loan_id: string;
  document_id?: number;
  severity: string;
  title: string;
  message: string;
  metadata: any;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  created_at: Date;
}

export interface AlertEventData {
  eventType: string;
  loanId?: string;
  data: Record<string, any>;
}

export class AlertEngine extends EventEmitter {
  private db: Pool;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(db: Pool) {
    super();
    this.db = db;
  }

  /**
   * Start the alert engine with periodic checks
   */
  start() {
    logger.info('Starting Alert Engine...');
    
    // Listen for PostgreSQL notifications
    this.setupDatabaseListeners();
    
    // Run periodic checks every 5 minutes
    this.checkInterval = setInterval(() => {
      this.runScheduledChecks();
    }, 5 * 60 * 1000);
    
    // Run initial check
    this.runScheduledChecks();
  }

  /**
   * Stop the alert engine
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info('Alert Engine stopped');
  }

  /**
   * Set up PostgreSQL LISTEN for real-time notifications
   */
  private async setupDatabaseListeners() {
    const client = await this.db.connect();
    
    client.on('notification', async (msg) => {
      if (msg.channel === 'new_alert' && msg.payload) {
        const alertId = parseInt(msg.payload);
        await this.processNewAlert(alertId);
      }
    });
    
    await client.query('LISTEN new_alert');
    logger.info('Alert Engine listening for database notifications');
  }

  /**
   * Process a newly created alert
   */
  private async processNewAlert(alertId: number) {
    try {
      // Get alert details with rule information
      const { rows } = await this.db.query(`
        SELECT 
          a.*,
          ar.name as rule_name,
          ar.event_type
        FROM alerts a
        JOIN alert_rules ar ON a.alert_rule_id = ar.id
        WHERE a.id = $1
      `, [alertId]);

      if (rows.length === 0) return;

      const alert = rows[0];
      
      // Emit event for WebSocket server to pick up
      this.emit('alert:created', alert);
      
      // Process deliveries
      await this.deliverAlert(alert);
      
    } catch (error) {
      logger.error('Error processing new alert:', error);
    }
  }

  /**
   * Deliver alert to subscribed users
   */
  private async deliverAlert(alert: Alert) {
    try {
      // Get all subscribed users
      const { rows: subscriptions } = await this.db.query(`
        SELECT 
          s.*,
          u.email,
          u.id as user_id
        FROM alert_subscriptions s
        JOIN users u ON s.user_id = u.id
        WHERE s.alert_rule_id = $1
        AND s.is_active = true
      `, [alert.alert_rule_id]);

      // Create delivery records
      for (const subscription of subscriptions) {
        await this.db.query(`
          INSERT INTO alert_deliveries (
            alert_id, user_id, delivery_method
          ) VALUES ($1, $2, $3)
        `, [alert.id, subscription.user_id, subscription.delivery_method]);

        // Emit delivery event based on method
        if (subscription.delivery_method === 'in_app') {
          this.emit('alert:deliver:in_app', {
            userId: subscription.user_id,
            alert
          });
        } else if (subscription.delivery_method === 'email') {
          this.emit('alert:deliver:email', {
            email: subscription.email,
            alert
          });
        }
      }
    } catch (error) {
      logger.error('Error delivering alert:', error);
    }
  }

  /**
   * Run scheduled checks for time-based alerts
   */
  private async runScheduledChecks() {
    logger.info('Running scheduled alert checks...');
    
    try {
      // Check for missing documents
      await this.db.query('SELECT check_missing_documents()');
      logger.info('Missing documents check completed');
      
      // Check for foreclosure milestones that may have been missed
      await this.checkForeclosureMilestones();
      
      // Check for stale data
      await this.checkStaleData();
      
      // Auto-resolve old alerts that are no longer relevant
      await this.cleanupOldAlerts();
      
    } catch (error) {
      logger.error('Error in scheduled checks:', error);
    }
  }

  /**
   * Check for foreclosure milestone alerts
   */
  private async checkForeclosureMilestones() {
    // Check for upcoming foreclosure sales that need alerts
    const { rows: upcomingSales } = await this.db.query(`
      SELECT 
        fe.*,
        EXTRACT(DAY FROM fe.sale_scheduled_date - CURRENT_DATE) as days_until_sale
      FROM foreclosure_events fe
      WHERE fe.sale_scheduled_date IS NOT NULL
      AND fe.sale_scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      AND fe.sale_held_date IS NULL -- Sale hasn't happened yet
    `);

    const { rows: rules } = await this.db.query(`
      SELECT * FROM alert_rules
      WHERE event_type = 'foreclosure_status_change'
      AND is_active = true
    `);

    for (const sale of upcomingSales) {
      const eventData = {
        loan_id: sale.loan_id,
        new_status: 'sale_scheduled',
        sale_date: sale.sale_scheduled_date,
        days_until_sale: sale.days_until_sale
      };

      for (const rule of rules) {
        const shouldTrigger = await this.evaluateCondition(rule.condition_json, eventData);
        
        if (shouldTrigger) {
          // Check if alert already exists for this sale date
          const existing = await this.db.query(`
            SELECT id FROM alerts
            WHERE alert_rule_id = $1
            AND loan_id = $2
            AND status = 'active'
            AND metadata->>'sale_date' = $3
          `, [rule.id, sale.loan_id, sale.sale_scheduled_date]);

          if (existing.rows.length === 0) {
            await this.createAlert(rule, eventData);
          }
        }
      }
    }
  }

  /**
   * Check for stale data alerts
   */
  private async checkStaleData() {
    // Check for loans with no updates in 30+ days
    const { rows: staleLloans } = await this.db.query(`
      SELECT 
        loan_id,
        MAX(report_date) as last_update,
        EXTRACT(DAY FROM NOW() - MAX(report_date)) as days_stale
      FROM daily_metrics_history
      GROUP BY loan_id
      HAVING MAX(report_date) < NOW() - INTERVAL '30 days'
    `);

    // Create alerts for stale loans if rule exists
    const { rows: rules } = await this.db.query(`
      SELECT * FROM alert_rules
      WHERE event_type = 'stale_data'
      AND is_active = true
    `);

    for (const rule of rules) {
      for (const loan of staleLloans) {
        const eventData = {
          loan_id: loan.loan_id,
          days_stale: loan.days_stale,
          last_update: loan.last_update
        };

        const shouldTrigger = await this.evaluateCondition(rule.condition_json, eventData);
        if (shouldTrigger) {
          await this.createAlert(rule, eventData);
        }
      }
    }
  }

  /**
   * Evaluate if a condition matches the event data
   */
  private async evaluateCondition(condition: any, eventData: any): Promise<boolean> {
    try {
      const { rows } = await this.db.query(
        'SELECT evaluate_alert_condition($1::jsonb, $2::jsonb) as result',
        [JSON.stringify(condition), JSON.stringify(eventData)]
      );
      return rows[0].result;
    } catch (error) {
      logger.error('Error evaluating condition:', error);
      return false;
    }
  }

  /**
   * Create a new alert
   */
  private async createAlert(rule: AlertRule, eventData: any) {
    try {
      const title = `${rule.name} - Loan ${eventData.loan_id}`;
      const message = this.buildAlertMessage(rule, eventData);

      const { rows } = await this.db.query(`
        INSERT INTO alerts (
          alert_rule_id,
          loan_id,
          severity,
          title,
          message,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        rule.id,
        eventData.loan_id,
        rule.severity,
        title,
        message,
        eventData
      ]);

      // Notify for processing
      await this.db.query("SELECT pg_notify('new_alert', $1)", [rows[0].id]);
      
    } catch (error) {
      logger.error('Error creating alert:', error);
    }
  }

  /**
   * Build a human-readable alert message
   */
  private buildAlertMessage(rule: AlertRule, eventData: any): string {
    switch (rule.event_type) {
      case 'document_upload':
        return `Document "${eventData.file_name}" uploaded with ${eventData.confidence}% confidence`;
      
      case 'foreclosure_status_change':
        if (eventData.days_until_sale !== null) {
          return `Foreclosure sale scheduled in ${eventData.days_until_sale} days`;
        }
        return `Foreclosure status changed to ${eventData.new_status}`;
      
      case 'document_check':
        return `Required ${eventData.document_type} not uploaded after ${eventData.days_since_loan_added} days`;
      
      case 'stale_data':
        return `No updates received for ${eventData.days_stale} days (last update: ${eventData.last_update})`;
      
      default:
        return JSON.stringify(eventData);
    }
  }

  /**
   * Get active alerts for a user
   */
  async getActiveAlertsForUser(userId: number): Promise<Alert[]> {
    const { rows } = await this.db.query(`
      SELECT DISTINCT
        a.*,
        ar.name as rule_name,
        ar.event_type,
        dmc.property_address,
        dmc.borrower_name
      FROM alerts a
      JOIN alert_rules ar ON a.alert_rule_id = ar.id
      JOIN alert_subscriptions s ON s.alert_rule_id = ar.id
      LEFT JOIN daily_metrics_current dmc ON a.loan_id = dmc.loan_id
      WHERE s.user_id = $1
      AND s.is_active = true
      AND a.status = 'active'
      ORDER BY a.created_at DESC
      LIMIT 100
    `, [userId]);

    return rows;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: number, userId: number, notes?: string) {
    await this.db.query('BEGIN');
    
    try {
      // Update alert status
      await this.db.query(`
        UPDATE alerts 
        SET status = 'acknowledged',
            acknowledged_at = CURRENT_TIMESTAMP,
            acknowledged_by = $2
        WHERE id = $1
      `, [alertId, userId]);

      // Record action
      await this.db.query(`
        INSERT INTO alert_actions (alert_id, user_id, action, notes)
        VALUES ($1, $2, 'acknowledge', $3)
      `, [alertId, userId, notes]);

      await this.db.query('COMMIT');
      
      this.emit('alert:acknowledged', { alertId, userId });
      
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: number, userId: number, notes?: string) {
    await this.db.query('BEGIN');
    
    try {
      // Update alert status
      await this.db.query(`
        UPDATE alerts 
        SET status = 'resolved',
            resolved_at = CURRENT_TIMESTAMP,
            resolved_by = $2
        WHERE id = $1
      `, [alertId, userId]);

      // Record action
      await this.db.query(`
        INSERT INTO alert_actions (alert_id, user_id, action, notes)
        VALUES ($1, $2, 'resolve', $3)
      `, [alertId, userId, notes]);

      await this.db.query('COMMIT');
      
      this.emit('alert:resolved', { alertId, userId });
      
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(userId?: number): Promise<any> {
    const userFilter = userId ? 'AND s.user_id = $1' : '';
    const params = userId ? [userId] : [];

    const { rows } = await this.db.query(`
      SELECT
        COUNT(*) FILTER (WHERE a.status = 'active') as active_count,
        COUNT(*) FILTER (WHERE a.status = 'acknowledged') as acknowledged_count,
        COUNT(*) FILTER (WHERE a.status = 'resolved' AND a.resolved_at > NOW() - INTERVAL '7 days') as resolved_this_week,
        COUNT(*) FILTER (WHERE a.severity = 'critical' AND a.status = 'active') as critical_active,
        COUNT(*) FILTER (WHERE a.severity = 'high' AND a.status = 'active') as high_active
      FROM alerts a
      ${userId ? 'JOIN alert_subscriptions s ON s.alert_rule_id = a.alert_rule_id' : ''}
      WHERE 1=1 ${userFilter}
    `, params);

    return rows[0];
  }

  /**
   * Clean up old or irrelevant alerts
   */
  private async cleanupOldAlerts() {
    try {
      // Auto-resolve missing document alerts where documents have been uploaded
      await this.db.query(`
        UPDATE alerts 
        SET status = 'resolved', 
            resolved_at = CURRENT_TIMESTAMP,
            resolved_by = NULL
        WHERE alert_rule_id IN (
          SELECT id FROM alert_rules WHERE event_type = 'document_check'
        )
        AND status = 'active'
        AND EXISTS (
          SELECT 1 FROM collateral_documents cd
          WHERE cd.loan_id = alerts.loan_id
          AND (
            LOWER(cd.document_type) = LOWER(alerts.metadata->>'document_type') OR
            LOWER(cd.document_type) LIKE '%' || LOWER(alerts.metadata->>'document_type') || '%'
          )
        )
      `);

      // Auto-resolve foreclosure sale alerts where sale has occurred
      await this.db.query(`
        UPDATE alerts 
        SET status = 'resolved', 
            resolved_at = CURRENT_TIMESTAMP,
            resolved_by = NULL
        WHERE alert_rule_id IN (
          SELECT id FROM alert_rules WHERE event_type = 'foreclosure_status_change'
        )
        AND status = 'active'
        AND EXISTS (
          SELECT 1 FROM foreclosure_events fe
          WHERE fe.loan_id = alerts.loan_id
          AND (fe.sale_held_date IS NOT NULL OR fe.real_estate_owned_date IS NOT NULL)
        )
      `);

      logger.info('Old alerts cleanup completed');
    } catch (error) {
      logger.error('Error cleaning up old alerts:', error);
    }
  }
}

export default AlertEngine;