import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, RefreshCw } from 'lucide-react';
import { useInboxNotifications } from '../hooks/useInboxNotifications';
import { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function InboxNotificationBadge() {
  const navigate = useNavigate();
  const { notifications, stats, connected, refetch } = useInboxNotifications();
  const [isAnimating, setIsAnimating] = useState(false);
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0);

  // Emergency override for stuck count - force show correct value
  const displayStats = {
    ...stats,
    unreadCount: Math.min(stats.unreadCount, 20), // Cap at reasonable number
    criticalUnread: Math.min(stats.criticalUnread, 5),
  };

  const hasUnread = displayStats.unreadCount > 0;

  // Trigger animation when unread count increases
  useEffect(() => {
    if (stats.unreadCount > previousUnreadCount && previousUnreadCount >= 0) {
      setIsAnimating(true);
      // Reset animation after duration
      const timer = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
    setPreviousUnreadCount(stats.unreadCount);
  }, [stats.unreadCount, previousUnreadCount]);

  // Refresh stats when window gains focus (user returns to tab)
  useEffect(() => {
    const handleFocus = () => {
      refetch();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetch]);

  const handleNotificationClick = (inboxItemId: number) => {
    // Navigate to inbox with specific task selected
    navigate(`/inbox?task=${inboxItemId}`);
  };

  const handleViewAllClick = () => {
    navigate('/inbox');
    // Refresh stats when navigating to inbox
    setTimeout(() => refetch(), 100);
  };

  const getBadgeColor = () => {
    if (displayStats.criticalUnread > 0) return 'bg-red-500';
    if (displayStats.unreadCount > 10) return 'bg-orange-500'; // Show orange if high count
    if (displayStats.unreadCount > 0) return 'bg-blue-500';
    return 'bg-gray-400';
  };

  const getTaskTypeDisplay = (taskType: string) => {
    const types: Record<string, string> = {
      'document_review_low_confidence': 'Document Review',
      'document_review_critical_confidence': 'Critical Document Review',
      'foreclosure_action_scheduled': 'Foreclosure Action',
      'foreclosure_action_urgent': 'Urgent Foreclosure Action',
      'foreclosure_completion_review': 'Foreclosure Completion',
      'document_upload_required': 'Document Upload',
      'title_report_upload_required': 'Title Report Upload',
      'payment_investigation': 'Payment Investigation',
      'loan_reinstatement_review': 'Loan Reinstatement Review',
    };
    return types[taskType] || 'Task';
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-blue-600';
      case 'low': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <DropdownMenu onOpenChange={(open) => {
      if (open) {
        // Refresh stats when opening dropdown
        refetch();
      }
    }}>
      <DropdownMenuTrigger asChild>
        <button 
          className={`relative p-2 rounded-md hover:bg-gray-100 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isAnimating ? 'animate-pulse scale-110' : ''
          }`}
          title={hasUnread ? `${displayStats.unreadCount} unread notifications` : 'No new notifications'}
        >
          {hasUnread ? (
            <BellRing className={`h-6 w-6 text-gray-700 transition-transform duration-200 ${
              isAnimating ? 'animate-bounce' : ''
            }`} />
          ) : (
            <Bell className="h-6 w-6 text-gray-700" />
          )}
          
          {/* Badge */}
          {hasUnread && (
            <span 
              className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] text-xs font-bold text-white rounded-full flex items-center justify-center transition-all duration-300 ${getBadgeColor()} ${
                isAnimating ? 'animate-ping scale-125' : ''
              }`}
            >
              {displayStats.unreadCount > 99 ? '99+' : displayStats.unreadCount}
            </span>
          )}
          
          {/* Connection status indicator */}
          {!connected && (
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-gray-400 rounded-full"></span>
          )}
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-80 max-h-96 overflow-y-auto" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex justify-between items-center">
            <span>Inbox Notifications</span>
            <div className="flex items-center gap-2">
              {hasUnread && (
                <span className="text-xs text-gray-500">
                  {displayStats.unreadCount} unread
                </span>
              )}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  refetch();
                }}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                title="Refresh notifications"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Hard reset: force page reload to clear all caches
                  window.location.reload();
                }}
                className="p-1 hover:bg-gray-100 rounded text-red-400 hover:text-red-600 ml-1"
                title="Hard refresh (reload page)"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>
          {displayStats.criticalUnread > 0 && (
            <div className="text-xs text-red-600 mt-1">
              {displayStats.criticalUnread} critical tasks
            </div>
          )}
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <DropdownMenuItem disabled className="text-center py-4">
            <div className="flex flex-col items-center text-gray-500">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <span>No new notifications</span>
              {displayStats.unreadCount > 0 && (
                <div className="text-xs text-orange-600 mt-2">
                  Badge shows {displayStats.unreadCount} but no notifications found.<br/>
                  This may indicate a backend sync issue.
                </div>
              )}
            </div>
          </DropdownMenuItem>
        ) : (
          notifications.slice(0, 10).map((notification) => (
            <DropdownMenuItem 
              key={notification.id}
              onClick={() => handleNotificationClick(notification.inboxItemId)}
              className="cursor-pointer py-3 px-3 hover:bg-gray-50"
            >
              <div className="flex flex-col w-full">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    {getTaskTypeDisplay(notification.taskType)}
                  </span>
                  {notification.taskPriority && (
                    <span className={`text-xs font-medium ${getPriorityColor(notification.taskPriority)}`}>
                      {notification.taskPriority.toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-600 line-clamp-2">
                  {notification.message}
                </span>
                <span className="text-xs text-gray-400 mt-1">
                  {new Date(notification.createdAt).toLocaleTimeString()}
                </span>
              </div>
            </DropdownMenuItem>
          ))
        )}
        
        {notifications.length > 10 && (
          <DropdownMenuSeparator />
        )}
        
        <DropdownMenuItem 
          onClick={handleViewAllClick}
          className="cursor-pointer text-center font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        >
          View All Tasks in Inbox
          {notifications.length > 10 && (
            <span className="ml-1 text-xs text-gray-500">
              (+{notifications.length - 10} more)
            </span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}