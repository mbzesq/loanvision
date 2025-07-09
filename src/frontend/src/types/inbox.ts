// Unified Inbox System Types
// Consolidates alerts, tasks, and communications into one cohesive system

export interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  name?: string; // Computed field for compatibility
  avatar?: string;
}

export interface InboxItem {
  id: number;
  external_id: string;
  type: 'system_alert' | 'user_message' | 'task_assignment' | 'loan_update' | 'document_share' | 'system_notification';
  
  // Universal fields
  subject: string;
  body: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: 'unread' | 'read' | 'in_progress' | 'completed' | 'archived';
  source: 'system' | 'user' | 'api' | 'automation';
  category?: string;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
  
  // User relationships
  created_by_user_id?: number;
  assigned_to_user_id?: number;
  created_by?: User;
  assigned_to?: User;
  
  // Thread relationships
  thread_id?: string;
  reply_to_id?: number;
  
  // Context
  loan_ids?: string[];
  
  // Task-specific fields
  due_date?: Date;
  estimated_duration?: number; // in minutes
  completion_notes?: string;
  
  // Communication fields (for compatibility)
  from?: User;
  to?: User[];
  recipients?: InboxRecipient[];
  attachments?: InboxAttachment[];
  
  // Legacy compatibility
  createdAt?: Date;
  updatedAt?: Date;
  loanIds?: string[];
  assignedTo?: User;
  threadId?: string;
  replyToId?: string;
}

export interface InboxRecipient {
  id: number;
  inbox_item_id: number;
  user_id: number;
  recipient_type: 'to' | 'cc' | 'bcc';
  created_at: Date;
  user?: User;
}

export interface InboxAttachment {
  id: number;
  inbox_item_id: number;
  file_name: string;
  file_size?: number;
  file_type?: string;
  s3_key?: string;
  upload_user_id?: number;
  created_at: Date;
  uploaded_by?: User;
  
  // Legacy compatibility
  filename?: string;
  size?: number;
  mimeType?: string;
  url?: string;
  uploadedAt?: Date;
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
  category?: string[];
  assigned_to_user_id?: number;
  created_by_user_id?: number;
  loan_ids?: string[];
  search?: string;
  due_before?: string;
  due_after?: string;
  created_before?: string;
  created_after?: string;
  thread_id?: string;
  limit?: number;
  offset?: number;
  include_archived?: boolean;
}

export interface InboxStats {
  total: number;
  unread: number;
  urgent: number;
  overdue: number;
  my_tasks: number;
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
  by_status: Record<string, number>;
  
  // Legacy compatibility
  myTasks?: number;
  byCategory?: Record<string, number>;
  byPriority?: Record<string, number>;
}

export interface InboxListResponse {
  items: InboxItem[];
  total: number;
  limit: number;
  offset: number;
  stats: InboxStats;
}

export interface LoanContext {
  loan_id: string;
  borrower_name?: string;
  address?: string;
  principal_balance?: number;
  status?: string;
  next_payment_due?: Date;
  last_payment_received?: Date;
}

// API Request types
export interface CreateInboxItemRequest {
  type: InboxItem['type'];
  subject: string;
  body: string;
  priority?: InboxItem['priority'];
  category?: string;
  assigned_to_user_id?: number;
  thread_id?: string;
  reply_to_id?: number;
  loan_ids?: string[];
  due_date?: string; // ISO date string
  estimated_duration?: number;
  recipients?: Array<{
    user_id: number;
    recipient_type?: 'to' | 'cc' | 'bcc';
  }>;
}

export interface UpdateInboxItemRequest {
  subject?: string;
  body?: string;
  priority?: InboxItem['priority'];
  status?: InboxItem['status'];
  category?: string;
  assigned_to_user_id?: number;
  due_date?: string;
  estimated_duration?: number;
  completion_notes?: string;
}

// Predefined quick filters for Bloomberg-style interface
export const INBOX_QUICK_FILTERS = {
  UNREAD: { status: ['unread'] as InboxItem['status'][] },
  URGENT: { priority: ['urgent'] as InboxItem['priority'][] },
  MY_TASKS: { type: ['task_assignment'] as InboxItem['type'][], assignedTo: ['current_user'] },
  SENT_TASKS: { type: ['task_assignment'] as InboxItem['type'][], createdBy: ['current_user'] },
  MESSAGES: { type: ['user_message'] as InboxItem['type'][] },
  SYSTEM_ALERTS: { type: ['system_alert', 'system_notification'] as InboxItem['type'][] },
  SOL_ITEMS: { category: ['sol'] },
  LEGAL_ITEMS: { category: ['legal', 'foreclosure'] },
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

export interface BulkActionRequest {
  action: InboxBulkAction;
  item_ids: number[];
  assigned_to_user_id?: number; // For assign action
}

export interface BulkActionResponse {
  success: boolean;
  affected_count: number;
  errors?: Array<{
    item_id: number;
    error: string;
  }>;
}

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