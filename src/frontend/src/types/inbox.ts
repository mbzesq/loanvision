// Unified Inbox System Types
// Consolidates alerts, tasks, and communications into one cohesive system

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'analyst' | 'manager' | 'legal' | 'admin';
  avatar?: string;
}

export interface InboxItem {
  id: string;
  type: 'system_alert' | 'user_message' | 'task_assignment' | 'loan_update' | 'document_share' | 'system_notification';
  
  // Universal fields
  subject: string;
  body: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: 'unread' | 'read' | 'in_progress' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  
  // Context (when applicable)
  loanIds?: string[];
  relatedUsers?: User[];
  attachments?: InboxAttachment[];
  
  // Communication fields (when applicable)
  from?: User;
  to?: User[];
  cc?: User[];
  threadId?: string; // Groups related messages
  replyToId?: string; // Direct reply relationships
  
  // Task/Work Item fields (when applicable)
  dueDate?: Date;
  assignedTo?: User;
  estimatedDuration?: number; // in minutes
  category?: 'sol' | 'performance' | 'legal' | 'document' | 'payment' | 'foreclosure';
  
  // System-specific fields
  source: 'system' | 'user' | 'api' | 'auto_generated';
  metadata?: Record<string, any>; // Flexible storage for system-specific data
}

export interface InboxAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  url: string;
  uploadedAt: Date;
  uploadedBy: User;
}

export interface InboxThread {
  id: string;
  subject: string;
  participants: User[];
  itemCount: number;
  lastActivity: Date;
  status: 'active' | 'resolved' | 'archived';
  loanIds?: string[];
  category?: string;
}

export interface InboxFilter {
  type?: InboxItem['type'][];
  priority?: InboxItem['priority'][];
  status?: InboxItem['status'][];
  category?: InboxItem['category'][];
  assignedTo?: string[];
  loanIds?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
}

export interface InboxStats {
  total: number;
  unread: number;
  urgent: number;
  overdue: number;
  myTasks: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

// Predefined quick filters for Bloomberg-style interface
export const INBOX_QUICK_FILTERS = {
  UNREAD: { status: ['unread'] as InboxItem['status'][] },
  URGENT: { priority: ['urgent'] as InboxItem['priority'][] },
  MY_TASKS: { type: ['task_assignment'] as InboxItem['type'][], assignedTo: ['current_user'] },
  MESSAGES: { type: ['user_message'] as InboxItem['type'][] },
  SYSTEM_ALERTS: { type: ['system_alert', 'system_notification'] as InboxItem['type'][] },
  SOL_ITEMS: { category: ['sol'] as InboxItem['category'][] },
  LEGAL_ITEMS: { category: ['legal', 'foreclosure'] as InboxItem['category'][] },
  OVERDUE: { status: ['in_progress'] as InboxItem['status'][] }, // Combined with date logic
} as const;

// Action types for bulk operations
export type InboxBulkAction = 
  | 'mark_read' 
  | 'mark_unread' 
  | 'archive' 
  | 'delete' 
  | 'assign' 
  | 'set_priority' 
  | 'set_due_date'
  | 'create_task';

// Notification preferences
export interface NotificationSettings {
  userId: string;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  categories: {
    system_alerts: boolean;
    messages: boolean;
    task_assignments: boolean;
    urgent_only: boolean;
  };
  digestFrequency: 'none' | 'daily' | 'weekly';
}