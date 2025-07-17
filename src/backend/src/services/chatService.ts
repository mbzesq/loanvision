import pool from '../db';
import { getWSServerInstance } from './wsServerInstance';
import { 
  ChatRoom, 
  ChatMessage, 
  ChatParticipant, 
  ChatUserPresence,
  ChatRoomFilters,
  ChatMessageFilters,
  CreateChatRoomRequest,
  SendMessageRequest,
  UpdateMessageRequest,
  ChatRoomListResponse,
  ChatMessageListResponse,
  ChatMessageReaction,
  ChatStats
} from '../types/chat';

export class ChatService {
  
  // Get chat rooms for a user's organization
  static async getChatRooms(userId: number, filters: ChatRoomFilters = {}): Promise<ChatRoomListResponse> {
    let query = `
      SELECT 
        cr.*,
        COUNT(DISTINCT cp.user_id) as participant_count,
        COUNT(DISTINCT CASE WHEN cm.created_at > cp.last_read_at THEN cm.id END) as unread_count,
        (
          SELECT json_build_object(
            'id', cm2.id,
            'content', cm2.content,
            'message_type', cm2.message_type,
            'created_at', cm2.created_at,
            'user', json_build_object(
              'id', u2.id,
              'first_name', u2.first_name,
              'last_name', u2.last_name
            )
          )
          FROM chat_messages cm2
          JOIN users u2 ON cm2.user_id = u2.id
          WHERE cm2.room_id = cr.id
          AND cm2.deleted_at IS NULL
          ORDER BY cm2.created_at DESC
          LIMIT 1
        ) as last_message
      FROM chat_rooms cr
      JOIN chat_participants cp ON cp.room_id = cr.id AND cp.user_id = $1
      LEFT JOIN chat_messages cm ON cm.room_id = cr.id AND cm.deleted_at IS NULL
    `;
    
    const queryParams: any[] = [userId];
    const conditions: string[] = [];
    let paramIndex = 2;
    
    // Type filter
    if (filters.type && filters.type.length > 0) {
      conditions.push(`cr.type = ANY($${paramIndex})`);
      queryParams.push(filters.type);
      paramIndex++;
    }
    
    // Include archived filter
    if (!filters.include_archived) {
      conditions.push(`cr.is_archived = false`);
    }
    
    // Search filter
    if (filters.search) {
      conditions.push(`cr.name ILIKE $${paramIndex}`);
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }
    
    // Add WHERE clause
    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }
    
    query += `
      GROUP BY cr.id, cp.last_read_at
      ORDER BY cr.last_message_at DESC
    `;
    
    // Pagination
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
    
    const rooms: ChatRoom[] = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      organization_id: row.organization_id,
      department_id: row.department_id,
      created_by_user_id: row.created_by_user_id,
      is_private: row.is_private,
      is_archived: row.is_archived,
      last_message_at: row.last_message_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      unread_count: parseInt(row.unread_count || '0'),
      participant_count: parseInt(row.participant_count || '0'),
      last_message: row.last_message
    }));
    
    return { rooms, total: rooms.length };
  }
  
  // Get messages in a chat room
  static async getMessages(userId: number, filters: ChatMessageFilters): Promise<ChatMessageListResponse> {
    // First verify user has access to the room
    const accessCheck = await pool.query(`
      SELECT 1 FROM chat_participants cp
      WHERE cp.room_id = $1 AND cp.user_id = $2
    `, [filters.room_id, userId]);
    
    if (accessCheck.rows.length === 0) {
      throw new Error('Access denied to chat room');
    }
    
    let query = `
      SELECT 
        cm.*,
        json_build_object(
          'id', u.id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'profile_image_url', u.profile_image_url
        ) as user,
        (
          SELECT json_agg(
            json_build_object(
              'id', cmr.id,
              'emoji', cmr.emoji,
              'user', json_build_object(
                'id', ur.id,
                'first_name', ur.first_name,
                'last_name', ur.last_name
              )
            )
          )
          FROM chat_message_reactions cmr
          JOIN users ur ON ur.id = cmr.user_id
          WHERE cmr.message_id = cm.id
        ) as reactions,
        (
          SELECT COUNT(*)
          FROM chat_messages cm2
          WHERE cm2.thread_parent_id = cm.id
          AND cm2.deleted_at IS NULL
        ) as thread_count
      FROM chat_messages cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.room_id = $1
      AND cm.deleted_at IS NULL
    `;
    
    const queryParams: any[] = [filters.room_id];
    let paramIndex = 2;
    
    // Thread filter
    if (filters.thread_parent_id !== undefined) {
      if (filters.thread_parent_id === null) {
        query += ` AND cm.thread_parent_id IS NULL`;
      } else {
        query += ` AND cm.thread_parent_id = $${paramIndex}`;
        queryParams.push(filters.thread_parent_id);
        paramIndex++;
      }
    } else {
      // Default to only top-level messages if no thread filter specified
      query += ` AND cm.thread_parent_id IS NULL`;
    }
    
    // Pagination filters
    if (filters.before_message_id) {
      query += ` AND cm.id < $${paramIndex}`;
      queryParams.push(filters.before_message_id);
      paramIndex++;
    }
    
    if (filters.after_message_id) {
      query += ` AND cm.id > $${paramIndex}`;
      queryParams.push(filters.after_message_id);
      paramIndex++;
    }
    
    query += ` ORDER BY cm.created_at DESC`;
    
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
    
    const messages: ChatMessage[] = result.rows.map(row => ({
      id: row.id,
      room_id: row.room_id,
      user_id: row.user_id,
      message_type: row.message_type,
      content: row.content,
      file_url: row.file_url,
      file_name: row.file_name,
      file_size: row.file_size,
      thread_parent_id: row.thread_parent_id,
      edited_at: row.edited_at,
      deleted_at: row.deleted_at,
      created_at: row.created_at,
      user: row.user,
      reactions: row.reactions || [],
      thread_count: parseInt(row.thread_count || '0')
    }));
    
    // Reverse to get chronological order
    messages.reverse();
    
    return { 
      messages, 
      total: messages.length,
      has_more: messages.length === (filters.limit || 50)
    };
  }
  
  // Create a new chat room
  static async createChatRoom(userId: number, data: CreateChatRoomRequest): Promise<ChatRoom> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get user's organization
      const userResult = await client.query('SELECT organization_id FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      const organizationId = userResult.rows[0].organization_id;
      
      // Create the room
      const roomResult = await client.query(`
        INSERT INTO chat_rooms (
          name, description, type, organization_id, department_id, 
          created_by_user_id, is_private
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        data.name, data.description, data.type, organizationId,
        data.department_id, userId, data.is_private || false
      ]);
      
      const room = roomResult.rows[0];
      
      // Add creator as admin participant
      await client.query(
        'INSERT INTO chat_participants (room_id, user_id, is_admin) VALUES ($1, $2, true)',
        [room.id, userId]
      );
      
      // Add additional participants if specified
      if (data.participant_user_ids && data.participant_user_ids.length > 0) {
        for (const participantUserId of data.participant_user_ids) {
          // Verify user is in same organization
          const participantCheck = await client.query(
            'SELECT id FROM users WHERE id = $1 AND organization_id = $2',
            [participantUserId, organizationId]
          );
          
          if (participantCheck.rows.length > 0 && participantUserId !== userId) {
            await client.query(
              'INSERT INTO chat_participants (room_id, user_id) VALUES ($1, $2)',
              [room.id, participantUserId]
            );
          }
        }
      }
      
      await client.query('COMMIT');
      
      return {
        id: room.id,
        name: room.name,
        description: room.description,
        type: room.type,
        organization_id: room.organization_id,
        department_id: room.department_id,
        created_by_user_id: room.created_by_user_id,
        is_private: room.is_private,
        is_archived: room.is_archived,
        last_message_at: room.last_message_at,
        created_at: room.created_at,
        updated_at: room.updated_at
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Send a message
  static async sendMessage(userId: number, data: SendMessageRequest): Promise<ChatMessage> {
    // Verify user has access to the room
    const accessCheck = await pool.query(`
      SELECT 1 FROM chat_participants cp
      WHERE cp.room_id = $1 AND cp.user_id = $2
    `, [data.room_id, userId]);
    
    if (accessCheck.rows.length === 0) {
      throw new Error('Access denied to chat room');
    }
    
    const result = await pool.query(`
      INSERT INTO chat_messages (
        room_id, user_id, message_type, content,
        file_url, file_name, file_size, thread_parent_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      data.room_id, userId, data.message_type || 'text', data.content,
      data.file_url, data.file_name, data.file_size, data.thread_parent_id
    ]);
    
    const message = result.rows[0];
    
    // Get user details
    const userResult = await pool.query(
      'SELECT id, first_name, last_name, profile_image_url FROM users WHERE id = $1',
      [userId]
    );
    
    return {
      id: message.id,
      room_id: message.room_id,
      user_id: message.user_id,
      message_type: message.message_type,
      content: message.content,
      file_url: message.file_url,
      file_name: message.file_name,
      file_size: message.file_size,
      thread_parent_id: message.thread_parent_id,
      edited_at: message.edited_at,
      deleted_at: message.deleted_at,
      created_at: message.created_at,
      user: userResult.rows[0],
      reactions: [],
      thread_count: 0
    };
  }
  
  // Create or get direct message room
  static async createDirectMessage(userId: number, targetUserId: number): Promise<ChatRoom> {
    const result = await pool.query('SELECT create_direct_message_room($1, $2) as room_id', [userId, targetUserId]);
    const roomId = result.rows[0].room_id;
    
    // Get the room details
    const roomResult = await pool.query('SELECT * FROM chat_rooms WHERE id = $1', [roomId]);
    const room = roomResult.rows[0];
    
    return {
      id: room.id,
      name: room.name,
      description: room.description,
      type: room.type,
      organization_id: room.organization_id,
      department_id: room.department_id,
      created_by_user_id: room.created_by_user_id,
      is_private: room.is_private,
      is_archived: room.is_archived,
      last_message_at: room.last_message_at,
      created_at: room.created_at,
      updated_at: room.updated_at
    };
  }
  
  // Update user presence
  static async updateUserPresence(userId: number, status: 'online' | 'away' | 'busy' | 'offline'): Promise<void> {
    await pool.query(`
      INSERT INTO chat_user_presence (user_id, status, last_seen_at, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        status = EXCLUDED.status,
        last_seen_at = EXCLUDED.last_seen_at,
        updated_at = EXCLUDED.updated_at
    `, [userId, status]);
    
    // Broadcast presence update to other users
    const wsServer = getWSServerInstance();
    if (wsServer) {
      wsServer.broadcastPresenceUpdate(userId, status);
    }
  }
  
  // Mark messages as read
  static async markMessagesAsRead(userId: number, roomId: number, messageId?: number): Promise<void> {
    const timestamp = messageId ? 
      await pool.query('SELECT created_at FROM chat_messages WHERE id = $1', [messageId]) :
      { rows: [{ created_at: new Date() }] };
    
    await pool.query(`
      UPDATE chat_participants 
      SET last_read_at = $1
      WHERE room_id = $2 AND user_id = $3
    `, [timestamp.rows[0].created_at, roomId, userId]);
  }
  
  // Add reaction to message
  static async addReaction(userId: number, messageId: number, emoji: string): Promise<ChatMessageReaction> {
    const result = await pool.query(`
      INSERT INTO chat_message_reactions (message_id, user_id, emoji)
      VALUES ($1, $2, $3)
      ON CONFLICT (message_id, user_id, emoji) DO NOTHING
      RETURNING *
    `, [messageId, userId, emoji]);
    
    if (result.rows.length === 0) {
      throw new Error('Reaction already exists');
    }
    
    const reaction = result.rows[0];
    
    // Get user details
    const userResult = await pool.query(
      'SELECT id, first_name, last_name FROM users WHERE id = $1',
      [userId]
    );
    
    return {
      id: reaction.id,
      message_id: reaction.message_id,
      user_id: reaction.user_id,
      emoji: reaction.emoji,
      created_at: reaction.created_at,
      user: userResult.rows[0]
    };
  }
  
  // Remove reaction from message
  static async removeReaction(userId: number, messageId: number, emoji: string): Promise<void> {
    await pool.query(`
      DELETE FROM chat_message_reactions
      WHERE message_id = $1 AND user_id = $2 AND emoji = $3
    `, [messageId, userId, emoji]);
  }
  
  // Get chat statistics
  static async getChatStats(organizationId: number): Promise<ChatStats> {
    const queries = await Promise.all([
      // Total rooms
      pool.query('SELECT COUNT(*) as count FROM chat_rooms WHERE organization_id = $1', [organizationId]),
      
      // Total messages today
      pool.query(`
        SELECT COUNT(*) as count 
        FROM chat_messages cm
        JOIN chat_rooms cr ON cr.id = cm.room_id
        WHERE cr.organization_id = $1 
        AND cm.created_at >= CURRENT_DATE
      `, [organizationId]),
      
      // Active users today
      pool.query(`
        SELECT COUNT(DISTINCT cm.user_id) as count
        FROM chat_messages cm
        JOIN chat_rooms cr ON cr.id = cm.room_id
        WHERE cr.organization_id = $1 
        AND cm.created_at >= CURRENT_DATE
      `, [organizationId]),
      
      // Popular rooms
      pool.query(`
        SELECT 
          cr.id as room_id,
          cr.name as room_name,
          COUNT(cm.id) as message_count
        FROM chat_rooms cr
        LEFT JOIN chat_messages cm ON cm.room_id = cr.id
        WHERE cr.organization_id = $1
        AND cm.created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY cr.id, cr.name
        ORDER BY message_count DESC
        LIMIT 5
      `, [organizationId])
    ]);
    
    return {
      total_rooms: parseInt(queries[0].rows[0].count),
      total_messages: parseInt(queries[1].rows[0].count),
      active_users_today: parseInt(queries[2].rows[0].count),
      popular_rooms: queries[3].rows.map(row => ({
        room_id: row.room_id,
        room_name: row.room_name,
        message_count: parseInt(row.message_count)
      })),
      user_activity: [] // Can be implemented later if needed
    };
  }
}