import pool from '../db';
import { 
  InboxItem, 
  InboxFilterParams, 
  InboxStats, 
  CreateInboxItemRequest, 
  UpdateInboxItemRequest,
  LoanContext,
  BulkActionRequest
} from '../types/inbox';

export class InboxService {
  
  // Get inbox items with filtering and pagination
  static async getInboxItems(userId: number, filters: InboxFilterParams = {}): Promise<{ items: InboxItem[], total: number }> {
    let query = `
      SELECT 
        ii.*,
        cb.id as created_by_id, cb.email as created_by_email, cb.first_name as created_by_first_name, cb.last_name as created_by_last_name,
        ab.id as assigned_to_id, ab.email as assigned_to_email, ab.first_name as assigned_to_first_name, ab.last_name as assigned_to_last_name
      FROM inbox_items ii
      LEFT JOIN users cb ON ii.created_by_user_id = cb.id
      LEFT JOIN users ab ON ii.assigned_to_user_id = ab.id
      LEFT JOIN inbox_recipients ir ON ii.id = ir.inbox_item_id AND ir.user_id = $1
    `;
    
    const queryParams: any[] = [userId];
    const conditions: string[] = [];
    let paramIndex = 2;
    
    // User visibility: show items created by user, assigned to user, or where user is recipient
    conditions.push(`(ii.created_by_user_id = $1 OR ii.assigned_to_user_id = $1 OR ir.user_id = $1)`);
    
    // Status filter
    if (filters.status && filters.status.length > 0) {
      conditions.push(`ii.status = ANY($${paramIndex})`);
      queryParams.push(filters.status);
      paramIndex++;
    }
    
    // Priority filter
    if (filters.priority && filters.priority.length > 0) {
      conditions.push(`ii.priority = ANY($${paramIndex})`);
      queryParams.push(filters.priority);
      paramIndex++;
    }
    
    // Type filter
    if (filters.type && filters.type.length > 0) {
      conditions.push(`ii.type = ANY($${paramIndex})`);
      queryParams.push(filters.type);
      paramIndex++;
    }
    
    // Category filter
    if (filters.category && filters.category.length > 0) {
      conditions.push(`ii.category = ANY($${paramIndex})`);
      queryParams.push(filters.category);
      paramIndex++;
    }
    
    // Assigned to filter
    if (filters.assigned_to_user_id) {
      conditions.push(`ii.assigned_to_user_id = $${paramIndex}`);
      queryParams.push(filters.assigned_to_user_id);
      paramIndex++;
    }
    
    // Created by filter
    if (filters.created_by_user_id) {
      conditions.push(`ii.created_by_user_id = $${paramIndex}`);
      queryParams.push(filters.created_by_user_id);
      paramIndex++;
    }
    
    // Loan IDs filter
    if (filters.loan_ids && filters.loan_ids.length > 0) {
      conditions.push(`ii.loan_ids && $${paramIndex}`);
      queryParams.push(filters.loan_ids);
      paramIndex++;
    }
    
    // Search filter
    if (filters.search) {
      conditions.push(`(ii.subject ILIKE $${paramIndex} OR ii.body ILIKE $${paramIndex})`);
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }
    
    // Date filters
    if (filters.due_before) {
      conditions.push(`ii.due_date <= $${paramIndex}`);
      queryParams.push(filters.due_before);
      paramIndex++;
    }
    
    if (filters.due_after) {
      conditions.push(`ii.due_date >= $${paramIndex}`);
      queryParams.push(filters.due_after);
      paramIndex++;
    }
    
    if (filters.created_before) {
      conditions.push(`ii.created_at <= $${paramIndex}`);
      queryParams.push(filters.created_before);
      paramIndex++;
    }
    
    if (filters.created_after) {
      conditions.push(`ii.created_at >= $${paramIndex}`);
      queryParams.push(filters.created_after);
      paramIndex++;
    }
    
    // Thread filter
    if (filters.thread_id) {
      conditions.push(`ii.thread_id = $${paramIndex}`);
      queryParams.push(filters.thread_id);
      paramIndex++;
    }
    
    // Exclude archived and deleted by default
    if (!filters.include_archived && !filters.include_deleted) {
      conditions.push(`ii.status NOT IN ('archived', 'deleted')`);
    } else if (!filters.include_archived) {
      conditions.push(`ii.status != 'archived'`);
    } else if (!filters.include_deleted) {
      conditions.push(`ii.status != 'deleted'`);
    }
    
    // Add WHERE clause
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    // Get total count
    const countQuery = `SELECT COUNT(DISTINCT counted_items.id) as total FROM (${query}) as counted_items`;
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);
    
    // Add ordering and pagination
    query += ` ORDER BY ii.created_at DESC`;
    
    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      queryParams.push(filters.limit);
      paramIndex++;
    }
    
    if (filters.offset) {
      query += ` OFFSET $${paramIndex}`;
      queryParams.push(filters.offset);
      paramIndex++;
    }
    
    const result = await pool.query(query, queryParams);
    
    // Transform results to include user objects
    const items: InboxItem[] = result.rows.map(row => ({
      id: row.id,
      external_id: row.external_id,
      type: row.type,
      subject: row.subject,
      body: row.body,
      priority: row.priority,
      status: row.status,
      source: row.source,
      category: row.category,
      created_by_user_id: row.created_by_user_id,
      assigned_to_user_id: row.assigned_to_user_id,
      thread_id: row.thread_id,
      reply_to_id: row.reply_to_id,
      loan_ids: row.loan_ids,
      due_date: row.due_date,
      estimated_duration: row.estimated_duration,
      completion_notes: row.completion_notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by_id ? {
        id: row.created_by_id,
        email: row.created_by_email,
        first_name: row.created_by_first_name,
        last_name: row.created_by_last_name,
        role: ''
      } : undefined,
      assigned_to: row.assigned_to_id ? {
        id: row.assigned_to_id,
        email: row.assigned_to_email,
        first_name: row.assigned_to_first_name,
        last_name: row.assigned_to_last_name,
        role: ''
      } : undefined
    }));
    
    return { items, total };
  }
  
  // Get inbox statistics for a user
  static async getInboxStats(userId: number): Promise<InboxStats> {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE status NOT IN ('archived', 'deleted')) as total,
        COUNT(*) FILTER (WHERE status = 'unread') as unread,
        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
        COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed', 'archived')) as overdue,
        COUNT(*) FILTER (WHERE assigned_to_user_id = $1 AND type = 'task_assignment' AND status NOT IN ('completed', 'archived')) as my_tasks,
        COUNT(*) FILTER (WHERE status = 'deleted') as deleted,
        COUNT(*) FILTER (WHERE created_by_user_id = $1 AND type = 'task_assignment' AND status NOT IN ('archived', 'deleted')) as sent_tasks,
        COUNT(*) FILTER (WHERE type = 'user_message' AND status NOT IN ('archived', 'deleted')) as messages,
        COUNT(*) FILTER (WHERE type = 'user_message' AND status = 'unread') as unread_messages,
        COUNT(*) FILTER (WHERE created_by_user_id = $1 AND type = 'user_message' AND status NOT IN ('archived', 'deleted')) as sent_messages,
        COUNT(*) FILTER (WHERE type = 'task_assignment' AND status NOT IN ('archived', 'deleted')) as all_tasks
      FROM inbox_items ii
      LEFT JOIN inbox_recipients ir ON ii.id = ir.inbox_item_id AND ir.user_id = $1
      WHERE (ii.created_by_user_id = $1 OR ii.assigned_to_user_id = $1 OR ir.user_id = $1)
    `;
    
    const categoryQuery = `
      SELECT category, COUNT(*) as count
      FROM inbox_items ii
      LEFT JOIN inbox_recipients ir ON ii.id = ir.inbox_item_id AND ir.user_id = $1
      WHERE (ii.created_by_user_id = $1 OR ii.assigned_to_user_id = $1 OR ir.user_id = $1)
        AND ii.status NOT IN ('archived', 'deleted')
        AND category IS NOT NULL
      GROUP BY category
    `;
    
    const priorityQuery = `
      SELECT priority, COUNT(*) as count
      FROM inbox_items ii
      LEFT JOIN inbox_recipients ir ON ii.id = ir.inbox_item_id AND ir.user_id = $1
      WHERE (ii.created_by_user_id = $1 OR ii.assigned_to_user_id = $1 OR ir.user_id = $1)
        AND ii.status NOT IN ('archived', 'deleted')
      GROUP BY priority
    `;
    
    const statusQuery = `
      SELECT status, COUNT(*) as count
      FROM inbox_items ii
      LEFT JOIN inbox_recipients ir ON ii.id = ir.inbox_item_id AND ir.user_id = $1
      WHERE (ii.created_by_user_id = $1 OR ii.assigned_to_user_id = $1 OR ir.user_id = $1)
        AND ii.status NOT IN ('archived', 'deleted')
      GROUP BY status
    `;
    
    const [statsResult, categoryResult, priorityResult, statusResult] = await Promise.all([
      pool.query(query, [userId]),
      pool.query(categoryQuery, [userId]),
      pool.query(priorityQuery, [userId]),
      pool.query(statusQuery, [userId])
    ]);
    
    const stats = statsResult.rows[0];
    
    const by_category: Record<string, number> = {};
    categoryResult.rows.forEach(row => {
      by_category[row.category] = parseInt(row.count);
    });
    
    const by_priority: Record<string, number> = {};
    priorityResult.rows.forEach(row => {
      by_priority[row.priority] = parseInt(row.count);
    });
    
    const by_status: Record<string, number> = {};
    statusResult.rows.forEach(row => {
      by_status[row.status] = parseInt(row.count);
    });
    
    return {
      total: parseInt(stats.total),
      unread: parseInt(stats.unread),
      urgent: parseInt(stats.urgent),
      overdue: parseInt(stats.overdue),
      my_tasks: parseInt(stats.my_tasks),
      deleted: parseInt(stats.deleted),
      sent_tasks: parseInt(stats.sent_tasks),
      messages: parseInt(stats.messages),
      unread_messages: parseInt(stats.unread_messages),
      sent_messages: parseInt(stats.sent_messages),
      all_tasks: parseInt(stats.all_tasks),
      by_category,
      by_priority,
      by_status
    };
  }
  
  // Get KPI metrics for inbox performance
  static async getInboxKPIs(userId: number): Promise<{
    avgDaysToClear: number;
    tasksCleared: number;
    avgOverdueDays: number;
    totalActiveItems: number;
    overdueItems: number;
    urgentItems: number;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const queries = await Promise.all([
      // Average days to clear completed tasks in last 30 days
      pool.query(`
        SELECT AVG(EXTRACT(epoch FROM (ii.updated_at - ii.created_at))/86400) as avg_days
        FROM inbox_items ii
        LEFT JOIN inbox_recipients ir ON ii.id = ir.inbox_item_id AND ir.user_id = $1
        WHERE (ii.created_by_user_id = $1 OR ii.assigned_to_user_id = $1 OR ir.user_id = $1)
          AND ii.status = 'completed'
          AND ii.updated_at >= $2
          AND ii.type = 'task_assignment'
      `, [userId, thirtyDaysAgo]),
      
      // Tasks cleared in last 30 days
      pool.query(`
        SELECT COUNT(*) as count
        FROM inbox_items ii
        LEFT JOIN inbox_recipients ir ON ii.id = ir.inbox_item_id AND ir.user_id = $1
        WHERE (ii.created_by_user_id = $1 OR ii.assigned_to_user_id = $1 OR ir.user_id = $1)
          AND ii.status = 'completed'
          AND ii.updated_at >= $2
          AND ii.type = 'task_assignment'
      `, [userId, thirtyDaysAgo]),
      
      // Average overdue days for overdue items
      pool.query(`
        SELECT AVG(EXTRACT(epoch FROM (NOW() - due_date))/86400) as avg_overdue_days
        FROM inbox_items ii
        LEFT JOIN inbox_recipients ir ON ii.id = ir.inbox_item_id AND ir.user_id = $1
        WHERE (ii.created_by_user_id = $1 OR ii.assigned_to_user_id = $1 OR ir.user_id = $1)
          AND ii.due_date < NOW()
          AND ii.status NOT IN ('completed', 'archived', 'deleted')
          AND ii.type = 'task_assignment'
      `, [userId]),
      
      // Total active items
      pool.query(`
        SELECT COUNT(*) as count
        FROM inbox_items ii
        LEFT JOIN inbox_recipients ir ON ii.id = ir.inbox_item_id AND ir.user_id = $1
        WHERE (ii.created_by_user_id = $1 OR ii.assigned_to_user_id = $1 OR ir.user_id = $1)
          AND ii.status NOT IN ('completed', 'archived', 'deleted')
      `, [userId]),
      
      // Overdue items
      pool.query(`
        SELECT COUNT(*) as count
        FROM inbox_items ii
        LEFT JOIN inbox_recipients ir ON ii.id = ir.inbox_item_id AND ir.user_id = $1
        WHERE (ii.created_by_user_id = $1 OR ii.assigned_to_user_id = $1 OR ir.user_id = $1)
          AND ii.due_date < NOW()
          AND ii.status NOT IN ('completed', 'archived', 'deleted')
          AND ii.type = 'task_assignment'
      `, [userId]),
      
      // Urgent items
      pool.query(`
        SELECT COUNT(*) as count
        FROM inbox_items ii
        LEFT JOIN inbox_recipients ir ON ii.id = ir.inbox_item_id AND ir.user_id = $1
        WHERE (ii.created_by_user_id = $1 OR ii.assigned_to_user_id = $1 OR ir.user_id = $1)
          AND ii.priority = 'urgent'
          AND ii.status NOT IN ('completed', 'archived', 'deleted')
      `, [userId])
    ]);

    return {
      avgDaysToClear: parseFloat(queries[0].rows[0]?.avg_days || '0') || 0,
      tasksCleared: parseInt(queries[1].rows[0]?.count || '0'),
      avgOverdueDays: parseFloat(queries[2].rows[0]?.avg_overdue_days || '0') || 0,
      totalActiveItems: parseInt(queries[3].rows[0]?.count || '0'),
      overdueItems: parseInt(queries[4].rows[0]?.count || '0'),
      urgentItems: parseInt(queries[5].rows[0]?.count || '0')
    };
  }
  
  // Create a new inbox item
  static async createInboxItem(data: CreateInboxItemRequest, createdByUserId: number): Promise<InboxItem> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Generate thread_id for new conversations
      const threadId = data.thread_id || (data.reply_to_id ? undefined : `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      
      const insertQuery = `
        INSERT INTO inbox_items (
          type, subject, body, priority, category, 
          created_by_user_id, assigned_to_user_id, 
          thread_id, reply_to_id, loan_ids, 
          due_date, estimated_duration
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      
      const values = [
        data.type,
        data.subject,
        data.body,
        data.priority || 'normal',
        data.category,
        createdByUserId,
        data.assigned_to_user_id,
        threadId,
        data.reply_to_id,
        data.loan_ids,
        data.due_date ? new Date(data.due_date) : null,
        data.estimated_duration
      ];
      
      const result = await client.query(insertQuery, values);
      const newItem = result.rows[0];
      
      // Add recipients if specified
      if (data.recipients && data.recipients.length > 0) {
        for (const recipient of data.recipients) {
          await client.query(
            'INSERT INTO inbox_recipients (inbox_item_id, user_id, recipient_type) VALUES ($1, $2, $3)',
            [newItem.id, recipient.user_id, recipient.recipient_type || 'to']
          );
        }
      }
      
      // Log creation activity
      await client.query(
        'INSERT INTO inbox_activity_log (inbox_item_id, user_id, action) VALUES ($1, $2, $3)',
        [newItem.id, createdByUserId, 'created']
      );
      
      await client.query('COMMIT');
      
      // Return the created item with relationships
      return await this.getInboxItemById(newItem.id, createdByUserId);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Get a single inbox item by ID
  static async getInboxItemById(itemId: number, userId: number): Promise<InboxItem> {
    const query = `
      SELECT 
        ii.*,
        cb.id as created_by_id, cb.email as created_by_email, cb.first_name as created_by_first_name, cb.last_name as created_by_last_name,
        ab.id as assigned_to_id, ab.email as assigned_to_email, ab.first_name as assigned_to_first_name, ab.last_name as assigned_to_last_name
      FROM inbox_items ii
      LEFT JOIN users cb ON ii.created_by_user_id = cb.id
      LEFT JOIN users ab ON ii.assigned_to_user_id = ab.id
      LEFT JOIN inbox_recipients ir ON ii.id = ir.inbox_item_id AND ir.user_id = $2
      WHERE ii.id = $1 
        AND (ii.created_by_user_id = $2 OR ii.assigned_to_user_id = $2 OR ir.user_id = $2)
    `;
    
    const result = await pool.query(query, [itemId, userId]);
    
    if (result.rows.length === 0) {
      throw new Error('Inbox item not found or access denied');
    }
    
    const row = result.rows[0];
    
    return {
      id: row.id,
      external_id: row.external_id,
      type: row.type,
      subject: row.subject,
      body: row.body,
      priority: row.priority,
      status: row.status,
      source: row.source,
      category: row.category,
      created_by_user_id: row.created_by_user_id,
      assigned_to_user_id: row.assigned_to_user_id,
      thread_id: row.thread_id,
      reply_to_id: row.reply_to_id,
      loan_ids: row.loan_ids,
      due_date: row.due_date,
      estimated_duration: row.estimated_duration,
      completion_notes: row.completion_notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by_id ? {
        id: row.created_by_id,
        email: row.created_by_email,
        first_name: row.created_by_first_name,
        last_name: row.created_by_last_name,
        role: ''
      } : undefined,
      assigned_to: row.assigned_to_id ? {
        id: row.assigned_to_id,
        email: row.assigned_to_email,
        first_name: row.assigned_to_first_name,
        last_name: row.assigned_to_last_name,
        role: ''
      } : undefined
    };
  }
  
  // Update an inbox item
  static async updateInboxItem(itemId: number, data: UpdateInboxItemRequest, userId: number): Promise<InboxItem> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if user has permission to update
      const permissionCheck = await client.query(
        `SELECT id FROM inbox_items 
         WHERE id = $1 AND (created_by_user_id = $2 OR assigned_to_user_id = $2)`,
        [itemId, userId]
      );
      
      if (permissionCheck.rows.length === 0) {
        throw new Error('Access denied: Cannot update this inbox item');
      }
      
      // Build dynamic update query
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;
      
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`);
          updateValues.push(key === 'due_date' && value ? new Date(value as string) : value);
          paramIndex++;
        }
      });
      
      if (updateFields.length === 0) {
        return await this.getInboxItemById(itemId, userId);
      }
      
      updateFields.push(`updated_at = NOW()`);
      updateValues.push(itemId);
      
      const updateQuery = `
        UPDATE inbox_items 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      
      await client.query(updateQuery, updateValues);
      
      await client.query('COMMIT');
      
      return await this.getInboxItemById(itemId, userId);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Get loan context for loan IDs
  static async getLoanContext(loanIds: string[]): Promise<LoanContext[]> {
    if (!loanIds || loanIds.length === 0) return [];
    
    const query = `
      SELECT 
        loan_id,
        CONCAT(first_name, ' ', last_name) as borrower_name,
        CONCAT(address, ', ', city, ', ', state, ' ', zip) as address,
        prin_bal as principal_balance,
        legal_status as status,
        next_pymt_due as next_payment_due,
        last_pymt_received as last_payment_received
      FROM daily_metrics_current
      WHERE loan_id = ANY($1)
    `;
    
    const result = await pool.query(query, [loanIds]);
    
    return result.rows.map(row => ({
      loan_id: row.loan_id,
      borrower_name: row.borrower_name,
      address: row.address,
      principal_balance: parseFloat(row.principal_balance),
      status: row.status,
      next_payment_due: row.next_payment_due,
      last_payment_received: row.last_payment_received
    }));
  }
  
  // Perform bulk actions
  static async performBulkAction(action: BulkActionRequest, userId: number): Promise<{ affected_count: number; errors: any[] }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const errors: any[] = [];
      let affectedCount = 0;
      
      for (const itemId of action.item_ids) {
        try {
          // Check permission
          const permissionCheck = await client.query(
            `SELECT id FROM inbox_items 
             WHERE id = $1 AND (created_by_user_id = $2 OR assigned_to_user_id = $2)`,
            [itemId, userId]
          );
          
          if (permissionCheck.rows.length === 0) {
            errors.push({ item_id: itemId, error: 'Access denied' });
            continue;
          }
          
          // Perform action
          switch (action.action) {
            case 'mark_read':
              await client.query('UPDATE inbox_items SET status = $1 WHERE id = $2', ['read', itemId]);
              break;
            case 'mark_unread':
              await client.query('UPDATE inbox_items SET status = $1 WHERE id = $2', ['unread', itemId]);
              break;
            case 'archive':
              await client.query('UPDATE inbox_items SET status = $1 WHERE id = $2', ['archived', itemId]);
              break;
            case 'delete':
              // Log deletion activity before marking as deleted
              await client.query(
                'INSERT INTO inbox_activity_log (inbox_item_id, user_id, action) VALUES ($1, $2, $3)',
                [itemId, userId, 'deleted']
              );
              
              // Mark as deleted instead of actually deleting (soft delete)
              await client.query(
                'UPDATE inbox_items SET status = $1, updated_at = NOW() WHERE id = $2', 
                ['deleted', itemId]
              );
              break;
            case 'assign':
              if (!action.assigned_to_user_id) {
                errors.push({ item_id: itemId, error: 'assigned_to_user_id required for assign action' });
                continue;
              }
              await client.query(
                'UPDATE inbox_items SET assigned_to_user_id = $1 WHERE id = $2', 
                [action.assigned_to_user_id, itemId]
              );
              break;
            default:
              errors.push({ item_id: itemId, error: 'Unknown action' });
              continue;
          }
          
          affectedCount++;
          
        } catch (itemError) {
          errors.push({ item_id: itemId, error: (itemError as Error).message });
        }
      }
      
      await client.query('COMMIT');
      
      return { affected_count: affectedCount, errors };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}