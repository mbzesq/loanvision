import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../config/logger';
import { NotificationEngine } from './notificationEngine';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  userEmail?: string;
}

export class WebSocketServer {
  private io: SocketIOServer;
  private notificationEngine: NotificationEngine;
  private userSockets: Map<number, Set<string>> = new Map();

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
        
        // Track user connection
        this.addUserSocket(decoded.userId, socket.id);
        
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
      
      // Handle disconnection
      socket.on('disconnect', () => {
        if (socket.userId) {
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
   * Get connection statistics
   */
  getConnectionStats() {
    return {
      totalConnections: this.io.sockets.sockets.size,
      uniqueUsers: this.userSockets.size,
      userConnections: Array.from(this.userSockets.entries()).map(([userId, sockets]) => ({
        userId,
        connectionCount: sockets.size
      }))
    };
  }
}

export default WebSocketServer;