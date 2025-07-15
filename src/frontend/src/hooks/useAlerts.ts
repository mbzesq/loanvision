import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertStats } from '../types/alerts';
import alertService from '../services/alertService';

interface UseAlertsReturn {
  alerts: Alert[];
  stats: AlertStats;
  loading: boolean;
  error: string | null;
  acknowledgeAlert: (alertId: number, notes?: string) => Promise<void>;
  resolveAlert: (alertId: number, notes?: string) => Promise<void>;
  dismissAlert: (alertId: number, reason?: string) => Promise<void>;
  markAsRead: (alertIds: number[]) => Promise<void>;
  refetch: () => void;
  connected: boolean;
}

export function useAlerts(): UseAlertsReturn {
  const { token, isAuthenticated } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats>({
    activeCount: 0,
    acknowledgedCount: 0,
    resolvedThisWeek: 0,
    criticalActive: 0,
    highActive: 0,
    mediumActive: 0,
    lowActive: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Fetch initial alerts
  const fetchAlerts = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      const [alertsData, statsData] = await Promise.all([
        alertService.getAlerts(),
        alertService.getStats(),
      ]);
      setAlerts(alertsData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000', {
      path: '/ws',
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    socket.on('alerts:initial', (initialAlerts: Alert[]) => {
      setAlerts(initialAlerts);
    });

    socket.on('alerts:stats', (newStats: AlertStats) => {
      setStats(newStats);
    });

    socket.on('alert:new', (alert: Alert) => {
      setAlerts(prev => [alert, ...prev]);
      // Update stats
      setStats(prev => ({
        ...prev,
        activeCount: prev.activeCount + 1,
        [getSeverityCountKey(alert.severity)]: prev[getSeverityCountKey(alert.severity)] + 1,
      }));
      
      // Show browser notification if permitted
      showNotification(alert);
    });

    socket.on('alert:statusChanged', ({ alertId, newStatus }: { alertId: number; newStatus: string }) => {
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, status: newStatus as Alert['status'] } : alert
      ));
    });

    socket.on('error', (error: { message: string }) => {
      console.error('WebSocket error:', error);
      setError(error.message);
    });

    // Fetch initial data
    fetchAlerts();

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, token, fetchAlerts]);

  // Alert actions
  const acknowledgeAlert = useCallback(async (alertId: number, notes?: string) => {
    try {
      await alertService.acknowledgeAlert(alertId, notes);
      socketRef.current?.emit('alert:acknowledge', { alertId, notes });
      
      // Optimistically update UI
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, status: 'acknowledged' as const, acknowledgedAt: new Date().toISOString() }
          : alert
      ));
      
      // Update stats
      setStats(prev => ({
        ...prev,
        activeCount: Math.max(0, prev.activeCount - 1),
        acknowledgedCount: prev.acknowledgedCount + 1,
      }));
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      throw err;
    }
  }, []);

  const resolveAlert = useCallback(async (alertId: number, notes?: string) => {
    try {
      await alertService.resolveAlert(alertId, notes);
      socketRef.current?.emit('alert:resolve', { alertId, notes });
      
      // Optimistically update UI
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, status: 'resolved' as const, resolvedAt: new Date().toISOString() }
          : alert
      ));
      
      // Update stats
      const alert = alerts.find(a => a.id === alertId);
      if (alert) {
        setStats(prev => ({
          ...prev,
          activeCount: alert.status === 'active' ? Math.max(0, prev.activeCount - 1) : prev.activeCount,
          acknowledgedCount: alert.status === 'acknowledged' ? Math.max(0, prev.acknowledgedCount - 1) : prev.acknowledgedCount,
          resolvedThisWeek: prev.resolvedThisWeek + 1,
          [getSeverityCountKey(alert.severity)]: alert.status === 'active' ? Math.max(0, prev[getSeverityCountKey(alert.severity)] - 1) : prev[getSeverityCountKey(alert.severity)],
        }));
      }
    } catch (err) {
      console.error('Error resolving alert:', err);
      throw err;
    }
  }, [alerts]);

  const dismissAlert = useCallback(async (alertId: number, reason?: string) => {
    try {
      await alertService.dismissAlert(alertId, reason);
      socketRef.current?.emit('alert:dismiss', { alertId, reason });
      
      // Remove from list
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
      
      // Update stats
      const alert = alerts.find(a => a.id === alertId);
      if (alert && alert.status === 'active') {
        setStats(prev => ({
          ...prev,
          activeCount: Math.max(0, prev.activeCount - 1),
          [getSeverityCountKey(alert.severity)]: Math.max(0, prev[getSeverityCountKey(alert.severity)] - 1),
        }));
      }
    } catch (err) {
      console.error('Error dismissing alert:', err);
      throw err;
    }
  }, [alerts]);

  const markAsRead = useCallback(async (alertIds: number[]) => {
    try {
      await alertService.markAsRead(alertIds);
    } catch (err) {
      console.error('Error marking alerts as read:', err);
    }
  }, []);

  const refetch = useCallback(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return {
    alerts,
    stats,
    loading,
    error,
    acknowledgeAlert,
    resolveAlert,
    dismissAlert,
    markAsRead,
    refetch,
    connected,
  };
}

// Helper functions
function getSeverityCountKey(severity: string): keyof AlertStats {
  switch (severity) {
    case 'critical': return 'criticalActive';
    case 'high': return 'highActive';
    case 'medium': return 'mediumActive';
    case 'low': return 'lowActive';
    default: return 'mediumActive';
  }
}

function showNotification(alert: Alert) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`New Alert: ${alert.title}`, {
      body: alert.message,
      icon: '/favicon.ico',
      tag: `alert-${alert.id}`,
    });
  }
}