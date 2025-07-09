// Inbox system types for backend API

export type InboxItemType = 'system_alert' | 'user_message' | 'task_assignment' | 'loan_update' | 'document_share' | 'system_notification';
export type InboxPriority = 'urgent' | 'high' | 'normal' | 'low';
export type InboxStatus = 'unread' | 'read' | 'in_progress' | 'completed' | 'archived' | 'deleted';
export type InboxSource = 'system' | 'user' | 'api' | 'automation';
export type RecipientType = 'to' | 'cc' | 'bcc';

export interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

export interface InboxItem {
  id: number;
  external_id: string;
  type: InboxItemType;
  subject: string;
  body: string;
  priority: InboxPriority;
  status: InboxStatus;
  source: InboxSource;
  category?: string;
  
  // User relationships
  created_by_user_id?: number;
  assigned_to_user_id?: number;
  
  // Thread relationships
  thread_id?: string;
  reply_to_id?: number;
  
  // Loan context
  loan_ids?: string[];
  
  // Task-specific fields
  due_date?: Date;
  estimated_duration?: number; // minutes
  completion_notes?: string;
  
  // Metadata
  created_at: Date;
  updated_at: Date;
  
  // Populated relationships
  created_by?: User;
  assigned_to?: User;
  recipients?: InboxRecipient[];
  attachments?: InboxAttachment[];
}

export interface InboxRecipient {
  id: number;
  inbox_item_id: number;
  user_id: number;
  recipient_type: RecipientType;
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
}

export interface InboxActivityLog {
  id: number;
  inbox_item_id: number;
  user_id?: number;
  action: string;
  old_value?: string;
  new_value?: string;
  notes?: string;
  created_at: Date;
  user?: User;
}

// API Request/Response types
export interface CreateInboxItemRequest {
  type: InboxItemType;
  subject: string;
  body: string;
  priority?: InboxPriority;
  category?: string;
  assigned_to_user_id?: number;
  thread_id?: string;
  reply_to_id?: number;
  loan_ids?: string[];
  due_date?: string; // ISO date string
  estimated_duration?: number;
  recipients?: Array<{
    user_id: number;
    recipient_type?: RecipientType;
  }>;
}

export interface UpdateInboxItemRequest {
  subject?: string;
  body?: string;
  priority?: InboxPriority;
  status?: InboxStatus;
  category?: string;
  assigned_to_user_id?: number;
  due_date?: string;
  estimated_duration?: number;
  completion_notes?: string;
}

export interface InboxFilterParams {
  status?: InboxStatus[];
  priority?: InboxPriority[];
  type?: InboxItemType[];
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
  include_deleted?: boolean;
}

export interface InboxStats {
  total: number;
  unread: number;
  urgent: number;
  overdue: number;
  my_tasks: number;
  deleted: number;
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
  by_status: Record<string, number>;
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

// Bulk operation types
export type BulkAction = 'mark_read' | 'mark_unread' | 'archive' | 'delete' | 'assign';

export interface BulkActionRequest {
  action: BulkAction;
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