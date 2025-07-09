import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware';
import { InboxService } from '../services/inboxService';
import { 
  CreateInboxItemRequest, 
  UpdateInboxItemRequest, 
  InboxFilterParams,
  BulkActionRequest 
} from '../types/inbox';

const router = express.Router();

// Skip authentication for OPTIONS requests (CORS preflight)
router.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  return authenticateToken(req as AuthRequest, res, next);
});

// GET /api/inbox - Get inbox items with filtering and pagination
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    
    // Parse query parameters
    const filters: InboxFilterParams = {
      status: req.query.status ? (Array.isArray(req.query.status) ? req.query.status : [req.query.status]) as any : undefined,
      priority: req.query.priority ? (Array.isArray(req.query.priority) ? req.query.priority : [req.query.priority]) as any : undefined,
      type: req.query.type ? (Array.isArray(req.query.type) ? req.query.type : [req.query.type]) as any : undefined,
      category: req.query.category ? (Array.isArray(req.query.category) ? req.query.category : [req.query.category]) as any : undefined,
      assigned_to_user_id: req.query.assigned_to_user_id ? parseInt(req.query.assigned_to_user_id as string) : undefined,
      created_by_user_id: req.query.created_by_user_id ? parseInt(req.query.created_by_user_id as string) : undefined,
      loan_ids: req.query.loan_ids ? (Array.isArray(req.query.loan_ids) ? req.query.loan_ids : [req.query.loan_ids]) as string[] : undefined,
      search: req.query.search as string,
      due_before: req.query.due_before as string,
      due_after: req.query.due_after as string,
      created_before: req.query.created_before as string,
      created_after: req.query.created_after as string,
      thread_id: req.query.thread_id as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      include_archived: req.query.include_archived === 'true'
    };
    
    const { items, total } = await InboxService.getInboxItems(userId, filters);
    const stats = await InboxService.getInboxStats(userId);
    
    res.json({
      items,
      total,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      stats
    });
    
  } catch (error) {
    console.error('Error fetching inbox items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/inbox/stats - Get inbox statistics
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const stats = await InboxService.getInboxStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching inbox stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/inbox/:id - Get a specific inbox item
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const itemId = parseInt(req.params.id);
    
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    
    const item = await InboxService.getInboxItemById(itemId, userId);
    res.json(item);
    
  } catch (error) {
    if ((error as Error).message.includes('not found') || (error as Error).message.includes('access denied')) {
      return res.status(404).json({ error: 'Inbox item not found' });
    }
    console.error('Error fetching inbox item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inbox - Create a new inbox item
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const data: CreateInboxItemRequest = req.body;
    
    // Validate required fields
    if (!data.type || !data.subject || !data.body) {
      return res.status(400).json({ error: 'Missing required fields: type, subject, body' });
    }
    
    // Validate enum values
    const validTypes = ['system_alert', 'user_message', 'task_assignment', 'loan_update', 'document_share', 'system_notification'];
    if (!validTypes.includes(data.type)) {
      return res.status(400).json({ error: 'Invalid type value' });
    }
    
    const validPriorities = ['urgent', 'high', 'normal', 'low'];
    if (data.priority && !validPriorities.includes(data.priority)) {
      return res.status(400).json({ error: 'Invalid priority value' });
    }
    
    const item = await InboxService.createInboxItem(data, userId);
    res.status(201).json(item);
    
  } catch (error) {
    console.error('Error creating inbox item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/inbox/:id - Update an inbox item
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const itemId = parseInt(req.params.id);
    const data: UpdateInboxItemRequest = req.body;
    
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    
    // Validate enum values if provided
    const validPriorities = ['urgent', 'high', 'normal', 'low'];
    if (data.priority && !validPriorities.includes(data.priority)) {
      return res.status(400).json({ error: 'Invalid priority value' });
    }
    
    const validStatuses = ['unread', 'read', 'in_progress', 'completed', 'archived'];
    if (data.status && !validStatuses.includes(data.status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    
    const item = await InboxService.updateInboxItem(itemId, data, userId);
    res.json(item);
    
  } catch (error) {
    if ((error as Error).message.includes('Access denied')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    console.error('Error updating inbox item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inbox/:id/mark-read - Mark an item as read
router.post('/:id/mark-read', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const itemId = parseInt(req.params.id);
    
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    
    const item = await InboxService.updateInboxItem(itemId, { status: 'read' }, userId);
    res.json(item);
    
  } catch (error) {
    if ((error as Error).message.includes('Access denied')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    console.error('Error marking item as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inbox/:id/archive - Archive an item
router.post('/:id/archive', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const itemId = parseInt(req.params.id);
    
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    
    const item = await InboxService.updateInboxItem(itemId, { status: 'archived' }, userId);
    res.json(item);
    
  } catch (error) {
    if ((error as Error).message.includes('Access denied')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    console.error('Error archiving item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/inbox/:id - Delete an item
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const itemId = parseInt(req.params.id);
    
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    
    // Use bulk action for delete to maintain consistency and logging
    const result = await InboxService.performBulkAction({
      action: 'delete',
      item_ids: [itemId]
    }, userId);
    
    if (result.affected_count === 0) {
      return res.status(404).json({ error: 'Item not found or access denied' });
    }
    
    if (result.errors && result.errors.length > 0) {
      return res.status(400).json({ error: result.errors[0].error });
    }
    
    res.json({ success: true, message: 'Item deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inbox/:id/reply - Reply to an item
router.post('/:id/reply', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const itemId = parseInt(req.params.id);
    const { body, recipients } = req.body;
    
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    
    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Reply body is required' });
    }
    
    // Get the original item to extract context
    const originalItem = await InboxService.getInboxItemById(itemId, userId);
    
    // Create reply with proper threading
    const replyData: CreateInboxItemRequest = {
      type: 'user_message',
      subject: originalItem.subject.startsWith('Re: ') ? originalItem.subject : `Re: ${originalItem.subject}`,
      body: body.trim(),
      priority: 'normal',
      category: originalItem.category,
      thread_id: originalItem.thread_id,
      reply_to_id: itemId,
      loan_ids: originalItem.loan_ids,
      recipients: recipients || []
    };
    
    const reply = await InboxService.createInboxItem(replyData, userId);
    res.status(201).json(reply);
    
  } catch (error) {
    if ((error as Error).message.includes('not found') || (error as Error).message.includes('access denied')) {
      return res.status(404).json({ error: 'Original item not found' });
    }
    console.error('Error creating reply:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inbox/:id/forward - Forward an item
router.post('/:id/forward', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const itemId = parseInt(req.params.id);
    const { body, recipients } = req.body;
    
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients are required for forwarding' });
    }
    
    // Get the original item to extract context
    const originalItem = await InboxService.getInboxItemById(itemId, userId);
    
    // Create forward with new thread
    const forwardData: CreateInboxItemRequest = {
      type: 'user_message',
      subject: originalItem.subject.startsWith('Fwd: ') ? originalItem.subject : `Fwd: ${originalItem.subject}`,
      body: `${body ? body.trim() + '\n\n' : ''}--- Forwarded Message ---\n${originalItem.body}`,
      priority: originalItem.priority,
      category: originalItem.category,
      loan_ids: originalItem.loan_ids,
      recipients: recipients
    };
    
    const forward = await InboxService.createInboxItem(forwardData, userId);
    res.status(201).json(forward);
    
  } catch (error) {
    if ((error as Error).message.includes('not found') || (error as Error).message.includes('access denied')) {
      return res.status(404).json({ error: 'Original item not found' });
    }
    console.error('Error creating forward:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/inbox/loans/:loanId - Get inbox items for a specific loan
router.get('/loans/:loanId', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const loanId = req.params.loanId;
    
    const filters: InboxFilterParams = {
      loan_ids: [loanId],
      limit: 100 // Get more items for loan-specific view
    };
    
    const { items, total } = await InboxService.getInboxItems(userId, filters);
    
    // Get loan context
    const loanContext = await InboxService.getLoanContext([loanId]);
    
    res.json({
      items,
      total,
      loan_context: loanContext[0] || null
    });
    
  } catch (error) {
    console.error('Error fetching loan inbox items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inbox/bulk-action - Perform bulk actions on multiple items
router.post('/bulk-action', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const action: BulkActionRequest = req.body;
    
    // Validate request
    if (!action.action || !action.item_ids || !Array.isArray(action.item_ids)) {
      return res.status(400).json({ error: 'Missing required fields: action, item_ids' });
    }
    
    const validActions = ['mark_read', 'mark_unread', 'archive', 'delete', 'assign'];
    if (!validActions.includes(action.action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    if (action.action === 'assign' && !action.assigned_to_user_id) {
      return res.status(400).json({ error: 'assigned_to_user_id required for assign action' });
    }
    
    const result = await InboxService.performBulkAction(action, userId);
    
    res.json({
      success: true,
      affected_count: result.affected_count,
      errors: result.errors.length > 0 ? result.errors : undefined
    });
    
  } catch (error) {
    console.error('Error performing bulk action:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/inbox/threads/:threadId - Get all items in a thread
router.get('/threads/:threadId', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const threadId = req.params.threadId;
    
    const filters: InboxFilterParams = {
      thread_id: threadId,
      limit: 100,
      include_archived: true // Include archived items in thread view
    };
    
    const { items, total } = await InboxService.getInboxItems(userId, filters);
    
    // Sort by creation date for thread chronology
    items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    res.json({
      items,
      total,
      thread_id: threadId
    });
    
  } catch (error) {
    console.error('Error fetching thread items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inbox/:id/create-task - Create a task from an inbox item
router.post('/:id/create-task', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const itemId = parseInt(req.params.id);
    const { title, description, assigned_to_user_id, due_date, priority } = req.body;
    
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required' });
    }
    
    // Get the original item to extract context
    const originalItem = await InboxService.getInboxItemById(itemId, userId);
    
    // Create task with proper context
    const taskData: CreateInboxItemRequest = {
      type: 'task_assignment',
      subject: title.trim(),
      body: description || `Task created from: ${originalItem.subject}`,
      priority: priority || 'normal',
      category: originalItem.category,
      thread_id: originalItem.thread_id,
      loan_ids: originalItem.loan_ids,
      assigned_to_user_id: assigned_to_user_id || userId,
      due_date: due_date ? new Date(due_date) : undefined,
      status: 'unread'
    };
    
    const task = await InboxService.createInboxItem(taskData, userId);
    res.status(201).json(task);
    
  } catch (error) {
    if ((error as Error).message.includes('not found') || (error as Error).message.includes('access denied')) {
      return res.status(404).json({ error: 'Original item not found' });
    }
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;