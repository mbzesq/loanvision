import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing } from 'lucide-react';
import { useInboxNotifications } from '../hooks/useInboxNotifications';
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
  const { notifications, stats, connected } = useInboxNotifications();

  const hasUnread = stats.unreadCount > 0;
  const hasCritical = stats.criticalUnread > 0;

  const handleNotificationClick = (inboxItemId: number, notificationId: number) => {
    // Navigate to inbox with specific task selected
    navigate(`/inbox?task=${inboxItemId}`);
  };

  const handleViewAllClick = () => {
    navigate('/inbox');
  };

  const getBadgeColor = () => {
    if (stats.criticalUnread > 0) return 'bg-red-500';
    if (stats.highUnread > 0) return 'bg-orange-500';
    if (stats.unreadCount > 0) return 'bg-blue-500';
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button 
          className="relative p-2 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          title={hasUnread ? `${stats.unreadCount} unread notifications` : 'No new notifications'}
        >
          {hasUnread ? (
            <BellRing className="h-6 w-6 text-gray-700" />
          ) : (
            <Bell className="h-6 w-6 text-gray-700" />
          )}
          
          {/* Badge */}
          {hasUnread && (
            <span 
              className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] text-xs font-bold text-white rounded-full flex items-center justify-center ${getBadgeColor()}`}
            >
              {stats.unreadCount > 99 ? '99+' : stats.unreadCount}
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
            {hasUnread && (
              <span className="text-xs text-gray-500">
                {stats.unreadCount} unread
              </span>
            )}
          </div>
          {stats.criticalUnread > 0 && (
            <div className="text-xs text-red-600 mt-1">
              {stats.criticalUnread} critical tasks
            </div>
          )}
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <DropdownMenuItem disabled className="text-center py-4">
            <div className="flex flex-col items-center text-gray-500">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <span>No new notifications</span>
            </div>
          </DropdownMenuItem>
        ) : (
          notifications.slice(0, 10).map((notification) => (
            <DropdownMenuItem 
              key={notification.id}
              onClick={() => handleNotificationClick(notification.inboxItemId, notification.id)}
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