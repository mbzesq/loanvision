import { Pool } from 'pg';
import { EventEmitter } from 'events';
import logger from '../config/logger';

export interface InboxTaskNotification {
  id: number;
  userId: number;
  inboxItemId: number;
  message: string;
  taskType: string;
  readAt?: Date;
  createdAt: Date;
}

export interface InboxTask {
  id: number;
  taskType: string;
  title: string;
  description: string;
  loanId?: string;
  documentId?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'unread' | 'in_progress' | 'completed' | 'archived';
  assignedTo: number;
  metadata: any;
  createdAt: Date;
}

export class NotificationEngine extends EventEmitter {
  private db: Pool;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(db: Pool) {
    super();
    this.db = db;
  }

  /**
   * Start the notification engine
   */
  start() {
    logger.info('Starting Notification Engine...');
    
    // Listen for PostgreSQL notifications
    this.setupDatabaseListeners();
    
    // Run periodic checks every 5 minutes for scheduled tasks
    this.checkInterval = setInterval(() => {
      this.runScheduledChecks();
    }, 5 * 60 * 1000);
    
    // Run initial check
    this.runScheduledChecks();
  }

  /**
   * Stop the notification engine
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info('Notification Engine stopped');
  }

  /**
   * Set up PostgreSQL LISTEN for real-time notifications
   */
  private async setupDatabaseListeners() {
    const client = await this.db.connect();
    
    client.on('notification', async (msg) => {
      if (msg.channel === 'new_inbox_task' && msg.payload) {
        const taskData = JSON.parse(msg.payload);
        await this.processNewInboxTask(taskData);
      }
    });
    
    await client.query('LISTEN new_inbox_task');
    logger.info('Notification Engine listening for database notifications');
  }

  /**
   * Process a newly created inbox task notification
   */
  private async processNewInboxTask(taskData: any) {
    try {
      // Get full task details
      const { rows } = await this.db.query(`
        SELECT 
          it.*,
          u.first_name || ' ' || u.last_name as assigned_user_name,
          u.email as assigned_user_email
        FROM inbox_items it
        LEFT JOIN users u ON it.assigned_to_user_id = u.id
        WHERE it.id = $1
      `, [taskData.task_id]);

      if (rows.length === 0) return;

      const task = rows[0];
      
      // Emit event for WebSocket server to pick up
      this.emit('inbox:new_task', {
        taskId: task.id,
        userId: task.assigned_to,
        message: taskData.message,
        taskType: taskData.task_type,
        task: task
      });
      
      logger.info(`New inbox task notification sent: ${task.title} (${task.task_type})`);
      
    } catch (error) {
      logger.error('Error processing new inbox task:', error);
    }
  }

  /**
   * Run scheduled checks for time-based tasks
   */
  private async runScheduledChecks() {
    logger.info('Running scheduled notification checks...');
    
    try {
      // Check for missing documents and create tasks
      await this.db.query('SELECT check_missing_documents_tasks()');
      logger.info('Missing documents check completed');
      
      // Auto-resolve completed tasks (e.g., when documents are uploaded)
      await this.autoResolveCompletedTasks();
      
    } catch (error) {
      logger.error('Error in scheduled checks:', error);
    }
  }

  /**
   * Auto-resolve tasks that are no longer needed
   */
  private async autoResolveCompletedTasks() {
    try {
      // Resolve document upload tasks where documents have been uploaded
      await this.db.query(`
        UPDATE inbox_items 
        SET status = 'completed',
            updated_at = CURRENT_TIMESTAMP,
            notes = 'Auto-completed: Required document was uploaded'
        WHERE task_type IN ('document_upload_required', 'title_report_upload_required')
        AND status IN ('unread', 'in_progress')
        AND EXISTS (
          SELECT 1 FROM collateral_documents cd
          WHERE cd.loan_id = inbox_items.loan_id
          AND (
            (inbox_items.task_type = 'document_upload_required' AND (
              LOWER(cd.document_type) LIKE '%security%' OR
              LOWER(cd.document_type) LIKE '%mortgage%' OR
              LOWER(cd.document_type) LIKE '%deed%'
            )) OR
            (inbox_items.task_type = 'title_report_upload_required' AND 
              LOWER(cd.document_type) LIKE '%title%'
            )
          )
        )
      `);

      // Resolve foreclosure action tasks where sale has occurred
      await this.db.query(`
        UPDATE inbox_items 
        SET status = 'completed',
            updated_at = CURRENT_TIMESTAMP,
            notes = 'Auto-completed: Foreclosure sale has occurred'
        WHERE task_type IN ('foreclosure_action_scheduled', 'foreclosure_action_urgent')
        AND status IN ('unread', 'in_progress')
        AND EXISTS (
          SELECT 1 FROM foreclosure_events fe
          WHERE fe.loan_id = inbox_items.loan_id
          AND fe.sale_held_date IS NOT NULL
        )
      `);

      logger.info('Auto-resolved completed tasks');
    } catch (error) {
      logger.error('Error auto-resolving tasks:', error);
    }
  }

  /**
   * Get unread notifications for a user
   */
  async getUnreadNotifications(userId: number): Promise<InboxTaskNotification[]> {
    const { rows } = await this.db.query(`
      SELECT 
        n.*,
        it.task_type,
        it.title as task_title,
        it.priority as task_priority
      FROM notifications n
      JOIN inbox_items it ON n.inbox_item_id = it.id
      WHERE n.user_id = $1
      AND n.read_at IS NULL
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [userId]);

    return rows;
  }

  /**
   * Mark notifications as read
   */
  async markNotificationsAsRead(userId: number, notificationIds: number[]) {
    await this.db.query(`
      UPDATE notifications
      SET read_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 
      AND id = ANY($2::int[])
      AND read_at IS NULL
    `, [userId, notificationIds]);
  }

  /**
   * Get notification stats for a user
   */
  async getNotificationStats(userId: number): Promise<any> {
    const { rows } = await this.db.query(`
      SELECT
        COUNT(*) FILTER (WHERE n.read_at IS NULL) as unread_count,
        COUNT(*) FILTER (WHERE it.priority = 'critical' AND n.read_at IS NULL) as critical_unread,
        COUNT(*) FILTER (WHERE it.priority = 'high' AND n.read_at IS NULL) as high_unread,
        COUNT(*) FILTER (WHERE n.created_at > NOW() - INTERVAL '24 hours') as today_count
      FROM notifications n
      JOIN inbox_items it ON n.inbox_item_id = it.id
      WHERE n.user_id = $1
    `, [userId]);

    return rows[0];
  }
}

export default NotificationEngine;