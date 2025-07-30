import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { audioNotificationService, AudioNotificationService } from '../services/audioNotificationService';

interface InboxNotification {
  id: number;
  userId: number;
  inboxItemId: number;
  message: string;
  taskType: string;
  taskTitle?: string;
  taskPriority?: string;
  readAt?: Date;
  createdAt: Date;
}

interface InboxStats {
  unreadCount: number;
  criticalUnread: number;
  highUnread: number;
  todayCount: number;
}

interface UseInboxNotificationsReturn {
  notifications: InboxNotification[];
  stats: InboxStats;
  loading: boolean;
  error: string | null;
  connected: boolean;
  markAsRead: (notificationIds: number[]) => Promise<void>;
  refetch: () => void;
}

export function useInboxNotifications(): UseInboxNotificationsReturn {
  const { token, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [stats, setStats] = useState<InboxStats>({
    unreadCount: 0,
    criticalUnread: 0,
    highUnread: 0,
    todayCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const refetch = useCallback(() => {
    if (socketRef.current) {
      console.log('Refetching inbox notifications and stats');
      // Clear current state to show fresh data
      setNotifications([]);
      setStats({
        unreadCount: 0,
        criticalUnread: 0,
        highUnread: 0,
        todayCount: 0,
      });
      socketRef.current.emit('notifications:fetch');
      socketRef.current.emit('inbox:fetch_stats');
    } else {
      console.warn('Socket not connected, cannot refetch');
    }
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    // Determine the correct WebSocket URL (consistent with chat WebSocket)
    const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
    const wsUrl = isProduction 
      ? (import.meta.env.VITE_API_BASE_URL || window.location.origin)
      : 'http://localhost:3000';
    
    console.log('Inbox WebSocket environment detection:', {
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'undefined',
      isProduction,
      wsUrl
    });
    // TODO: Consolidate with chat WebSocket to avoid multiple connections per user
    const socket = io(wsUrl, {
      path: '/ws',
      auth: { token },
      // Force polling in production, WebSocket in development
      transports: isProduction ? ['polling'] : ['websocket', 'polling'],
      upgrade: false, // Disable WebSocket upgrade in production
      forceNew: false, // Allow connection reuse to prevent excessive connections
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      setLoading(false);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    socket.on('notifications:initial', (initialNotifications: InboxNotification[]) => {
      setNotifications(initialNotifications);
      setLoading(false);
    });

    socket.on('notifications:list', (notificationList: InboxNotification[]) => {
      setNotifications(notificationList);
    });

    socket.on('inbox:stats', (newStats: InboxStats) => {
      console.log('Received inbox stats:', newStats);
      setStats(newStats);
    });

    socket.on('inbox:new_task', (taskData: any) => {
      // Add new notification to the list
      const newNotification: InboxNotification = {
        id: Date.now(), // Temporary ID
        userId: 0, // Will be set by server
        inboxItemId: taskData.taskId,
        message: taskData.message,
        taskType: taskData.taskType,
        taskTitle: taskData.task?.title,
        taskPriority: taskData.task?.priority,
        createdAt: new Date(),
      };
      
      setNotifications(prev => [newNotification, ...prev]);
      
      // Update stats
      setStats(prev => ({
        ...prev,
        unreadCount: prev.unreadCount + 1,
        todayCount: prev.todayCount + 1,
        criticalUnread: taskData.task?.priority === 'critical' ? prev.criticalUnread + 1 : prev.criticalUnread,
        highUnread: taskData.task?.priority === 'high' ? prev.highUnread + 1 : prev.highUnread,
      }));
      
      // Show browser notification if permitted
      showBrowserNotification(taskData.message);
      
      // Play audio notification
      const notificationType = AudioNotificationService.getNotificationTypeFromInboxItem(taskData.task || taskData);
      audioNotificationService.playNotification(notificationType);
    });

    socket.on('notifications:marked_read', ({ notificationIds }: { notificationIds: number[] }) => {
      setNotifications(prev => prev.filter(n => !notificationIds.includes(n.id)));
      setStats(prev => ({
        ...prev,
        unreadCount: Math.max(0, prev.unreadCount - notificationIds.length),
      }));
    });

    socket.on('error', (error: { message: string }) => {
      console.error('WebSocket error:', error);
      setError(error.message);
      setLoading(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, token]);

  // Mark notifications as read
  const markAsRead = useCallback(async (notificationIds: number[]) => {
    try {
      if (socketRef.current) {
        socketRef.current.emit('notifications:mark_read', { notificationIds });
      }
    } catch (err) {
      console.error('Error marking notifications as read:', err);
      throw err;
    }
  }, []);

  return {
    notifications,
    stats,
    loading,
    error,
    connected,
    markAsRead,
    refetch,
  };
}

// Helper function for browser notifications
function showBrowserNotification(message: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`NPLVision`, {
      body: message,
      icon: '/favicon.ico',
      tag: 'inbox-task',
    });
  } else if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        showBrowserNotification(message);
      }
    });
  }
}