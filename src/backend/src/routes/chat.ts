import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware';
import { ChatService } from '../services/chatService';
import { 
  CreateChatRoomRequest, 
  SendMessageRequest, 
  UpdateMessageRequest,
  ChatRoomFilters,
  ChatMessageFilters,
  StartDirectMessageRequest,
  UpdateUserPresenceRequest,
  AddReactionRequest
} from '../types/chat';

const router = express.Router();

// All chat routes require authentication
router.use(authenticateToken);

// Get chat rooms for the user's organization
router.get('/rooms', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const filters: ChatRoomFilters = {
      type: req.query.type ? (Array.isArray(req.query.type) ? req.query.type : [req.query.type]) as any : undefined,
      include_archived: req.query.include_archived === 'true',
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };
    
    const result = await ChatService.getChatRooms(userId, filters);
    res.json(result);
  } catch (error) {
    console.error('Error getting chat rooms:', error);
    res.status(500).json({ error: 'Failed to get chat rooms' });
  }
});

// Create a new chat room
router.post('/rooms', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const data: CreateChatRoomRequest = req.body;
    
    // Validate required fields
    if (!data.name || !data.type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }
    
    const room = await ChatService.createChatRoom(userId, data);
    res.status(201).json(room);
  } catch (error) {
    console.error('Error creating chat room:', error);
    res.status(500).json({ error: 'Failed to create chat room' });
  }
});

// Get messages in a chat room
router.get('/rooms/:roomId/messages', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const roomId = parseInt(req.params.roomId);
    
    if (isNaN(roomId)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    
    const filters: ChatMessageFilters = {
      room_id: roomId,
      before_message_id: req.query.before ? parseInt(req.query.before as string) : undefined,
      after_message_id: req.query.after ? parseInt(req.query.after as string) : undefined,
      thread_parent_id: req.query.thread_parent_id === 'null' ? null : 
        req.query.thread_parent_id ? parseInt(req.query.thread_parent_id as string) : 
        undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };
    
    const result = await ChatService.getMessages(userId, filters);
    res.json(result);
  } catch (error) {
    console.error('Error getting messages:', error);
    if (error instanceof Error && error.message === 'Access denied to chat room') {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to get messages' });
    }
  }
});

// Send a message to a chat room
router.post('/rooms/:roomId/messages', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const roomId = parseInt(req.params.roomId);
    
    if (isNaN(roomId)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    
    const data: SendMessageRequest = {
      ...req.body,
      room_id: roomId
    };
    
    // Validate required fields
    if (!data.content && !data.file_url) {
      return res.status(400).json({ error: 'Message content or file is required' });
    }
    
    const message = await ChatService.sendMessage(userId, data);
    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    if (error instanceof Error && error.message === 'Access denied to chat room') {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
});

// Mark messages as read in a room
router.post('/rooms/:roomId/read', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const roomId = parseInt(req.params.roomId);
    const messageId = req.body.message_id ? parseInt(req.body.message_id) : undefined;
    
    if (isNaN(roomId)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    
    await ChatService.markMessagesAsRead(userId, roomId, messageId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Start or get a direct message conversation
router.post('/direct-messages', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const data: StartDirectMessageRequest = req.body;
    
    if (!data.target_user_id) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }
    
    const room = await ChatService.createDirectMessage(userId, data.target_user_id);
    res.json(room);
  } catch (error) {
    console.error('Error creating direct message:', error);
    if (error instanceof Error && error.message === 'Users must be in the same organization') {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create direct message' });
    }
  }
});

// Update user presence status
router.post('/presence', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const data: UpdateUserPresenceRequest = req.body;
    
    if (!data.status || !['online', 'away', 'busy', 'offline'].includes(data.status)) {
      return res.status(400).json({ error: 'Valid status is required' });
    }
    
    await ChatService.updateUserPresence(userId, data.status);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating presence:', error);
    res.status(500).json({ error: 'Failed to update presence' });
  }
});

// Add reaction to a message
router.post('/messages/:messageId/reactions', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const messageId = parseInt(req.params.messageId);
    const { emoji } = req.body;
    
    if (isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }
    
    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }
    
    const reaction = await ChatService.addReaction(userId, messageId, emoji);
    res.status(201).json(reaction);
  } catch (error) {
    console.error('Error adding reaction:', error);
    if (error instanceof Error && error.message === 'Reaction already exists') {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to add reaction' });
    }
  }
});

// Remove reaction from a message
router.delete('/messages/:messageId/reactions/:emoji', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const messageId = parseInt(req.params.messageId);
    const emoji = req.params.emoji;
    
    if (isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }
    
    await ChatService.removeReaction(userId, messageId, emoji);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing reaction:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// Get chat statistics (for admins or analytics)
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    
    // Get user's organization
    const userResult = await ChatService.getChatStats(req.user!.organizationId || 1);
    res.json(userResult);
  } catch (error) {
    console.error('Error getting chat stats:', error);
    res.status(500).json({ error: 'Failed to get chat statistics' });
  }
});

// Get users in the same organization (for starting DMs, @mentions, etc.)
router.get('/users', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const search = req.query.search as string;
    
    // Get users in the same organization
    let query = `
      SELECT 
        id, first_name, last_name, email, job_title, department,
        profile_image_url,
        CASE 
          WHEN cup.status IS NOT NULL THEN cup.status
          ELSE 'offline'
        END as presence_status,
        cup.last_seen_at
      FROM users u
      LEFT JOIN chat_user_presence cup ON cup.user_id = u.id
      WHERE u.organization_id = $1 AND u.id != $2
    `;
    
    const queryParams: any[] = [req.user!.organizationId || 1, userId];
    let paramIndex = 3;
    
    if (search) {
      query += ` AND (u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
    }
    
    query += ` ORDER BY u.first_name, u.last_name LIMIT 50`;
    
    const result = await require('../db').default.query(query, queryParams);
    
    const users = result.rows.map((row: any) => ({
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      job_title: row.job_title,
      department: row.department,
      profile_image_url: row.profile_image_url,
      presence_status: row.presence_status,
      last_seen_at: row.last_seen_at
    }));
    
    res.json({ users });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

export default router;