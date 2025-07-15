import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../config/logger';
import { NotificationEngine } from './notificationEngine';
import { ChatService } from './chatService';
import pool from '../db';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  userEmail?: string;
  organizationId?: number;
  currentChatRooms?: Set<number>;
}

export class WebSocketServer {
  private io: SocketIOServer;
  private notificationEngine: NotificationEngine;
  private userSockets: Map<number, Set<string>> = new Map();
  private chatRoomUsers: Map<number, Set<number>> = new Map(); // roomId -> Set of userIds
  private userTypingTimers: Map<string, NodeJS.Timeout> = new Map(); // userId-roomId -> timeout

  constructor(httpServer: HttpServer, notificationEngine: NotificationEngine) {
    this.notificationEngine = notificationEngine;
    
    // Initialize Socket.IO with CORS configuration
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true
      },
      path: '/ws'
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupNotificationEngineListeners();
    this.setupChatNotificationListeners();
  }

  /**
   * Set up authentication middleware
   */
  private setupMiddleware() {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
        
        socket.userId = decoded.userId;
        socket.userEmail = decoded.email;
        socket.organizationId = decoded.organizationId;
        socket.currentChatRooms = new Set();
        
        // Track user connection
        this.addUserSocket(decoded.userId, socket.id);
        
        // Update user presence to online
        await ChatService.updateUserPresence(decoded.userId, 'online');
        
        logger.info(`User ${decoded.email} connected via WebSocket`);
        next();
        
      } catch (error) {
        logger.error('WebSocket authentication failed:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Set up Socket.IO event handlers
   */
  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`WebSocket connection established: ${socket.id}`);
      
      // Send initial data
      this.sendInitialData(socket);
      
      // Handle client events
      socket.on('notifications:fetch', async () => {
        await this.sendUserNotifications(socket);
      });
      
      socket.on('notifications:mark_read', async (data) => {
        await this.handleMarkNotificationsRead(socket, data);
      });
      
      socket.on('inbox:fetch_stats', async () => {
        await this.sendInboxStats(socket);
      });
      
      // Chat event handlers
      this.setupChatEventHandlers(socket);
      
      // Handle disconnection
      socket.on('disconnect', async () => {
        if (socket.userId) {
          // Update user presence to offline
          await ChatService.updateUserPresence(socket.userId, 'offline');
          
          // Remove from all chat rooms
          if (socket.currentChatRooms) {
            socket.currentChatRooms.forEach(roomId => {
              this.leaveRoom(socket, roomId);
            });
          }
          
          this.removeUserSocket(socket.userId, socket.id);
        }
        logger.info(`WebSocket disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Set up listeners for Notification Engine events
   */
  private setupNotificationEngineListeners() {
    // New inbox task created
    this.notificationEngine.on('inbox:new_task', async (taskData) => {
      logger.info(`New inbox task notification: ${taskData.message}`);
      await this.sendTaskNotificationToUser(taskData.userId, taskData);
    });
  }

  /**
   * Send initial data when user connects
   */
  private async sendInitialData(socket: AuthenticatedSocket) {
    if (!socket.userId) return;
    
    try {
      // Send unread notifications
      const notifications = await this.notificationEngine.getUnreadNotifications(socket.userId);
      socket.emit('notifications:initial', notifications);
      
      // Send notification statistics
      const stats = await this.notificationEngine.getNotificationStats(socket.userId);
      socket.emit('inbox:stats', stats);
      
    } catch (error) {
      logger.error('Error sending initial data:', error);
    }
  }

  /**
   * Send notifications to a specific user
   */
  private async sendUserNotifications(socket: AuthenticatedSocket) {
    if (!socket.userId) return;
    
    try {
      const notifications = await this.notificationEngine.getUnreadNotifications(socket.userId);
      socket.emit('notifications:list', notifications);
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      socket.emit('error', { message: 'Failed to fetch notifications' });
    }
  }

  /**
   * Handle marking notifications as read
   */
  private async handleMarkNotificationsRead(socket: AuthenticatedSocket, data: any) {
    if (!socket.userId) return;
    
    try {
      const { notificationIds } = data;
      await this.notificationEngine.markNotificationsAsRead(socket.userId, notificationIds);
      socket.emit('notifications:marked_read', { notificationIds });
    } catch (error) {
      logger.error('Error marking notifications as read:', error);
      socket.emit('error', { message: 'Failed to mark notifications as read' });
    }
  }

  /**
   * Send inbox stats to user
   */
  private async sendInboxStats(socket: AuthenticatedSocket) {
    if (!socket.userId) return;
    
    try {
      const stats = await this.notificationEngine.getNotificationStats(socket.userId);
      socket.emit('inbox:stats', stats);
    } catch (error) {
      logger.error('Error fetching inbox stats:', error);
      socket.emit('error', { message: 'Failed to fetch inbox stats' });
    }
  }

  /**
   * Send task notification to specific user
   */
  private async sendTaskNotificationToUser(userId: number, taskData: any) {
    const socketIds = this.userSockets.get(userId);
    
    if (socketIds && socketIds.size > 0) {
      socketIds.forEach(socketId => {
        this.io.to(socketId).emit('inbox:new_task', {
          message: taskData.message,
          taskType: taskData.taskType,
          taskId: taskData.taskId,
          task: taskData.task
        });
      });
      logger.info(`Task notification sent to user ${userId}: ${taskData.message}`);
    } else {
      logger.info(`User ${userId} not connected, notification will be shown on next login`);
    }
  }

  /**
   * Track user socket connections
   */
  private addUserSocket(userId: number, socketId: string) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);
  }

  /**
   * Remove user socket connection
   */
  private removeUserSocket(userId: number, socketId: string) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  /**
   * Set up chat-specific event handlers
   */
  private setupChatEventHandlers(socket: AuthenticatedSocket) {
    // Join a chat room
    socket.on('chat:join_room', async (data: { room_id: number }) => {
      await this.joinRoom(socket, data.room_id);
    });
    
    // Leave a chat room
    socket.on('chat:leave_room', (data: { room_id: number }) => {
      this.leaveRoom(socket, data.room_id);
    });
    
    // Send a message
    socket.on('chat:send_message', async (data: any) => {
      await this.handleSendMessage(socket, data);
    });
    
    // Typing indicators
    socket.on('chat:typing_start', (data: { room_id: number }) => {
      this.handleTypingStart(socket, data.room_id);
    });
    
    socket.on('chat:typing_stop', (data: { room_id: number }) => {
      this.handleTypingStop(socket, data.room_id);
    });
    
    // Mark messages as read
    socket.on('chat:mark_read', async (data: { room_id: number; message_id?: number }) => {
      await this.handleMarkRead(socket, data);
    });
    
    // Add/remove reactions
    socket.on('chat:add_reaction', async (data: { message_id: number; emoji: string }) => {
      await this.handleAddReaction(socket, data);
    });
    
    socket.on('chat:remove_reaction', async (data: { message_id: number; emoji: string }) => {
      await this.handleRemoveReaction(socket, data);
    });
  }
  
  /**
   * Set up chat notification listeners from database
   */
  private setupChatNotificationListeners() {
    // Listen for new chat messages from database notifications
    const client = pool.connect().then(client => {
      client.on('notification', (msg) => {
        if (msg.channel === 'chat_message' && msg.payload) {
          const messageData = JSON.parse(msg.payload);
          this.broadcastChatMessage(messageData);
        }
      });
      
      client.query('LISTEN chat_message');
      logger.info('Chat WebSocket listening for database notifications');
    });
  }
  
  /**
   * Join a chat room
   */
  private async joinRoom(socket: AuthenticatedSocket, roomId: number) {
    if (!socket.userId) return;
    
    try {
      // Verify user has access to the room
      const rooms = await ChatService.getChatRooms(socket.userId, { limit: 1000 });
      const hasAccess = rooms.rooms.some(room => room.id === roomId);
      
      if (!hasAccess) {
        socket.emit('chat:error', { message: 'Access denied to chat room' });
        return;
      }
      
      // Join the socket room
      socket.join(`chat:${roomId}`);
      socket.currentChatRooms?.add(roomId);
      
      // Track user in room
      if (!this.chatRoomUsers.has(roomId)) {
        this.chatRoomUsers.set(roomId, new Set());
      }
      this.chatRoomUsers.get(roomId)!.add(socket.userId);
      
      // Notify other users in the room
      socket.to(`chat:${roomId}`).emit('chat:user_joined', {
        room_id: roomId,
        user: {
          id: socket.userId,
          email: socket.userEmail
        }
      });
      
      logger.info(`User ${socket.userId} joined chat room ${roomId}`);
    } catch (error) {
      logger.error('Error joining chat room:', error);
      socket.emit('chat:error', { message: 'Failed to join chat room' });
    }
  }
  
  /**
   * Leave a chat room
   */
  private leaveRoom(socket: AuthenticatedSocket, roomId: number) {
    if (!socket.userId) return;
    
    socket.leave(`chat:${roomId}`);
    socket.currentChatRooms?.delete(roomId);
    
    // Remove user from room tracking
    const roomUsers = this.chatRoomUsers.get(roomId);
    if (roomUsers) {
      roomUsers.delete(socket.userId);
      if (roomUsers.size === 0) {
        this.chatRoomUsers.delete(roomId);
      }
    }
    
    // Clear any typing indicators
    this.handleTypingStop(socket, roomId);
    
    // Notify other users
    socket.to(`chat:${roomId}`).emit('chat:user_left', {
      room_id: roomId,
      user_id: socket.userId
    });
    
    logger.info(`User ${socket.userId} left chat room ${roomId}`);
  }
  
  /**
   * Handle sending a message
   */
  private async handleSendMessage(socket: AuthenticatedSocket, data: any) {
    if (!socket.userId) return;
    
    try {
      const message = await ChatService.sendMessage(socket.userId, data);
      
      // The database trigger will send the notification via pg_notify
      // which will be handled by broadcastChatMessage
      
      socket.emit('chat:message_sent', { message_id: message.id });
    } catch (error) {
      logger.error('Error sending chat message:', error);
      socket.emit('chat:error', { message: 'Failed to send message' });
    }
  }
  
  /**
   * Handle typing start
   */
  private handleTypingStart(socket: AuthenticatedSocket, roomId: number) {
    if (!socket.userId) return;
    
    const typingKey = `${socket.userId}-${roomId}`;
    
    // Clear existing timer
    const existingTimer = this.userTypingTimers.get(typingKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Notify others in the room
    socket.to(`chat:${roomId}`).emit('chat:user_typing', {
      room_id: roomId,
      user_id: socket.userId,
      user_email: socket.userEmail
    });
    
    // Set auto-stop timer (5 seconds)
    const timer = setTimeout(() => {
      this.handleTypingStop(socket, roomId);
    }, 5000);
    
    this.userTypingTimers.set(typingKey, timer);
  }
  
  /**
   * Handle typing stop
   */
  private handleTypingStop(socket: AuthenticatedSocket, roomId: number) {
    if (!socket.userId) return;
    
    const typingKey = `${socket.userId}-${roomId}`;
    
    // Clear timer
    const timer = this.userTypingTimers.get(typingKey);
    if (timer) {
      clearTimeout(timer);
      this.userTypingTimers.delete(typingKey);
    }
    
    // Notify others in the room
    socket.to(`chat:${roomId}`).emit('chat:user_stopped_typing', {
      room_id: roomId,
      user_id: socket.userId
    });
  }
  
  /**
   * Handle marking messages as read
   */
  private async handleMarkRead(socket: AuthenticatedSocket, data: { room_id: number; message_id?: number }) {
    if (!socket.userId) return;
    
    try {
      await ChatService.markMessagesAsRead(socket.userId, data.room_id, data.message_id);
      socket.emit('chat:marked_read', data);
    } catch (error) {
      logger.error('Error marking messages as read:', error);
      socket.emit('chat:error', { message: 'Failed to mark messages as read' });
    }
  }
  
  /**
   * Handle adding a reaction
   */
  private async handleAddReaction(socket: AuthenticatedSocket, data: { message_id: number; emoji: string }) {
    if (!socket.userId) return;
    
    try {
      const reaction = await ChatService.addReaction(socket.userId, data.message_id, data.emoji);
      
      // Broadcast to all users who can see this message
      const messageResult = await pool.query('SELECT room_id FROM chat_messages WHERE id = $1', [data.message_id]);
      if (messageResult.rows.length > 0) {
        const roomId = messageResult.rows[0].room_id;
        this.io.to(`chat:${roomId}`).emit('chat:reaction_added', reaction);
      }
    } catch (error) {
      logger.error('Error adding reaction:', error);
      socket.emit('chat:error', { message: 'Failed to add reaction' });
    }
  }
  
  /**
   * Handle removing a reaction
   */
  private async handleRemoveReaction(socket: AuthenticatedSocket, data: { message_id: number; emoji: string }) {
    if (!socket.userId) return;
    
    try {
      await ChatService.removeReaction(socket.userId, data.message_id, data.emoji);
      
      // Broadcast to all users who can see this message
      const messageResult = await pool.query('SELECT room_id FROM chat_messages WHERE id = $1', [data.message_id]);
      if (messageResult.rows.length > 0) {
        const roomId = messageResult.rows[0].room_id;
        this.io.to(`chat:${roomId}`).emit('chat:reaction_removed', {
          message_id: data.message_id,
          user_id: socket.userId,
          emoji: data.emoji
        });
      }
    } catch (error) {
      logger.error('Error removing reaction:', error);
      socket.emit('chat:error', { message: 'Failed to remove reaction' });
    }
  }
  
  /**
   * Broadcast a chat message to all room participants
   */
  private broadcastChatMessage(messageData: any) {
    const roomId = messageData.room_id;
    
    // Send to all users in the chat room
    this.io.to(`chat:${roomId}`).emit('chat:message_received', {
      id: messageData.message_id,
      room_id: messageData.room_id,
      user_id: messageData.user_id,
      content: messageData.content,
      message_type: messageData.message_type,
      created_at: messageData.created_at,
      user: {
        name: messageData.user_name
      },
      room_name: messageData.room_name
    });
    
    logger.info(`Chat message broadcasted to room ${roomId}: ${messageData.content.substring(0, 50)}...`);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    return {
      totalConnections: this.io.sockets.sockets.size,
      uniqueUsers: this.userSockets.size,
      chatRooms: this.chatRoomUsers.size,
      userConnections: Array.from(this.userSockets.entries()).map(([userId, sockets]) => ({
        userId,
        connectionCount: sockets.size
      }))
    };
  }
}

export default WebSocketServer;