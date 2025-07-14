import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../config/logger';
import { AlertEngine } from './alertEngine';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  userEmail?: string;
}

export class WebSocketServer {
  private io: SocketIOServer;
  private alertEngine: AlertEngine;
  private userSockets: Map<number, Set<string>> = new Map();

  constructor(httpServer: HttpServer, alertEngine: AlertEngine) {
    this.alertEngine = alertEngine;
    
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
    this.setupAlertEngineListeners();
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
      socket.on('alerts:fetch', async () => {
        await this.sendUserAlerts(socket);
      });
      
      socket.on('alert:acknowledge', async (data) => {
        await this.handleAcknowledgeAlert(socket, data);
      });
      
      socket.on('alert:resolve', async (data) => {
        await this.handleResolveAlert(socket, data);
      });
      
      socket.on('alert:dismiss', async (data) => {
        await this.handleDismissAlert(socket, data);
      });
      
      // Handle subscription management
      socket.on('alerts:subscribe', async (data) => {
        await this.handleSubscribe(socket, data);
      });
      
      socket.on('alerts:unsubscribe', async (data) => {
        await this.handleUnsubscribe(socket, data);
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
   * Set up listeners for Alert Engine events
   */
  private setupAlertEngineListeners() {
    // New alert created
    this.alertEngine.on('alert:created', async (alert) => {
      logger.info(`New alert created: ${alert.id}`);
      await this.broadcastToSubscribedUsers(alert);
    });
    
    // In-app delivery
    this.alertEngine.on('alert:deliver:in_app', async ({ userId, alert }) => {
      await this.sendAlertToUser(userId, alert);
    });
    
    // Alert status changes
    this.alertEngine.on('alert:acknowledged', async ({ alertId, userId }) => {
      await this.broadcastAlertUpdate(alertId, 'acknowledged');
    });
    
    this.alertEngine.on('alert:resolved', async ({ alertId, userId }) => {
      await this.broadcastAlertUpdate(alertId, 'resolved');
    });
  }

  /**
   * Send initial data when user connects
   */
  private async sendInitialData(socket: AuthenticatedSocket) {
    if (!socket.userId) return;
    
    try {
      // Send active alerts
      const alerts = await this.alertEngine.getActiveAlertsForUser(socket.userId);
      socket.emit('alerts:initial', alerts);
      
      // Send alert statistics
      const stats = await this.alertEngine.getAlertStats(socket.userId);
      socket.emit('alerts:stats', stats);
      
    } catch (error) {
      logger.error('Error sending initial data:', error);
    }
  }

  /**
   * Send alerts to a specific user
   */
  private async sendUserAlerts(socket: AuthenticatedSocket) {
    if (!socket.userId) return;
    
    try {
      const alerts = await this.alertEngine.getActiveAlertsForUser(socket.userId);
      socket.emit('alerts:list', alerts);
    } catch (error) {
      logger.error('Error fetching alerts:', error);
      socket.emit('error', { message: 'Failed to fetch alerts' });
    }
  }

  /**
   * Handle alert acknowledgment
   */
  private async handleAcknowledgeAlert(socket: AuthenticatedSocket, data: any) {
    if (!socket.userId) return;
    
    try {
      const { alertId, notes } = data;
      await this.alertEngine.acknowledgeAlert(alertId, socket.userId, notes);
      socket.emit('alert:acknowledged', { alertId });
    } catch (error) {
      logger.error('Error acknowledging alert:', error);
      socket.emit('error', { message: 'Failed to acknowledge alert' });
    }
  }

  /**
   * Handle alert resolution
   */
  private async handleResolveAlert(socket: AuthenticatedSocket, data: any) {
    if (!socket.userId) return;
    
    try {
      const { alertId, notes } = data;
      await this.alertEngine.resolveAlert(alertId, socket.userId, notes);
      socket.emit('alert:resolved', { alertId });
    } catch (error) {
      logger.error('Error resolving alert:', error);
      socket.emit('error', { message: 'Failed to resolve alert' });
    }
  }

  /**
   * Handle alert dismissal
   */
  private async handleDismissAlert(socket: AuthenticatedSocket, data: any) {
    if (!socket.userId) return;
    
    try {
      const { alertId, reason } = data;
      // Dismissal is a type of resolution
      await this.alertEngine.resolveAlert(alertId, socket.userId, `Dismissed: ${reason}`);
      socket.emit('alert:dismissed', { alertId });
    } catch (error) {
      logger.error('Error dismissing alert:', error);
      socket.emit('error', { message: 'Failed to dismiss alert' });
    }
  }

  /**
   * Handle subscription to alert rules
   */
  private async handleSubscribe(socket: AuthenticatedSocket, data: any) {
    if (!socket.userId) return;
    
    try {
      const { ruleId, deliveryMethod = 'in_app' } = data;
      // Implementation would update alert_subscriptions table
      socket.emit('alerts:subscribed', { ruleId });
    } catch (error) {
      logger.error('Error subscribing to alerts:', error);
      socket.emit('error', { message: 'Failed to subscribe' });
    }
  }

  /**
   * Handle unsubscription from alert rules
   */
  private async handleUnsubscribe(socket: AuthenticatedSocket, data: any) {
    if (!socket.userId) return;
    
    try {
      const { ruleId } = data;
      // Implementation would update alert_subscriptions table
      socket.emit('alerts:unsubscribed', { ruleId });
    } catch (error) {
      logger.error('Error unsubscribing from alerts:', error);
      socket.emit('error', { message: 'Failed to unsubscribe' });
    }
  }

  /**
   * Send alert to specific user
   */
  private async sendAlertToUser(userId: number, alert: any) {
    const socketIds = this.userSockets.get(userId);
    
    if (socketIds && socketIds.size > 0) {
      socketIds.forEach(socketId => {
        this.io.to(socketId).emit('alert:new', alert);
      });
      logger.info(`Alert ${alert.id} sent to user ${userId}`);
    } else {
      logger.info(`User ${userId} not connected, alert will be shown on next login`);
    }
  }

  /**
   * Broadcast alert to all subscribed users
   */
  private async broadcastToSubscribedUsers(alert: any) {
    // This would query alert_subscriptions to find all users
    // For now, we'll emit to all connected users
    this.io.emit('alert:new', alert);
  }

  /**
   * Broadcast alert status update
   */
  private async broadcastAlertUpdate(alertId: number, newStatus: string) {
    this.io.emit('alert:statusChanged', { alertId, newStatus });
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