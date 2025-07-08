import { 
  InboxItem, 
  InboxListResponse, 
  InboxStats, 
  InboxFilter,
  CreateInboxItemRequest,
  UpdateInboxItemRequest,
  BulkActionRequest,
  BulkActionResponse,
  LoanContext,
  User
} from '../types/inbox';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class InboxApiService {
  private getAuthToken(): string | null {
    return localStorage.getItem('authToken');
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/api/inbox${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Get inbox items with filtering and pagination
  async getInboxItems(filters: InboxFilter = {}): Promise<InboxListResponse> {
    const queryParams = new URLSearchParams();
    
    // Convert filters to query parameters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, String(v)));
        } else {
          queryParams.append(key, String(value));
        }
      }
    });

    const response = await this.makeRequest<InboxListResponse>(
      `?${queryParams.toString()}`
    );

    // Transform API response to match frontend types
    return {
      ...response,
      items: response.items.map(this.transformInboxItem),
      stats: this.transformStats(response.stats)
    };
  }

  // Get inbox statistics
  async getInboxStats(): Promise<InboxStats> {
    const stats = await this.makeRequest<InboxStats>('/stats');
    return this.transformStats(stats);
  }

  // Get a single inbox item
  async getInboxItem(itemId: number): Promise<InboxItem> {
    const item = await this.makeRequest<InboxItem>(`/${itemId}`);
    return this.transformInboxItem(item);
  }

  // Create a new inbox item
  async createInboxItem(data: CreateInboxItemRequest): Promise<InboxItem> {
    const item = await this.makeRequest<InboxItem>('', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return this.transformInboxItem(item);
  }

  // Update an inbox item
  async updateInboxItem(itemId: number, data: UpdateInboxItemRequest): Promise<InboxItem> {
    const item = await this.makeRequest<InboxItem>(`/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return this.transformInboxItem(item);
  }

  // Mark an item as read
  async markAsRead(itemId: number): Promise<InboxItem> {
    const item = await this.makeRequest<InboxItem>(`/${itemId}/mark-read`, {
      method: 'POST',
    });
    return this.transformInboxItem(item);
  }

  // Get inbox items for a specific loan
  async getLoanInboxItems(loanId: string): Promise<{
    items: InboxItem[];
    total: number;
    loan_context: LoanContext | null;
  }> {
    const response = await this.makeRequest<{
      items: InboxItem[];
      total: number;
      loan_context: LoanContext | null;
    }>(`/loans/${loanId}`);

    return {
      ...response,
      items: response.items.map(this.transformInboxItem)
    };
  }

  // Perform bulk actions
  async performBulkAction(action: BulkActionRequest): Promise<BulkActionResponse> {
    return this.makeRequest<BulkActionResponse>('/bulk-action', {
      method: 'POST',
      body: JSON.stringify(action),
    });
  }

  // Get thread items
  async getThreadItems(threadId: string): Promise<{
    items: InboxItem[];
    total: number;
    thread_id: string;
  }> {
    const response = await this.makeRequest<{
      items: InboxItem[];
      total: number;
      thread_id: string;
    }>(`/threads/${threadId}`);

    return {
      ...response,
      items: response.items.map(this.transformInboxItem)
    };
  }

  // Transform backend API response to frontend format
  private transformInboxItem(item: any): InboxItem {
    const transformedUser = (user: any): User | undefined => {
      if (!user) return undefined;
      return {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        name: user.first_name && user.last_name 
          ? `${user.first_name} ${user.last_name}` 
          : user.email
      };
    };

    return {
      ...item,
      // Transform dates
      created_at: new Date(item.created_at),
      updated_at: new Date(item.updated_at),
      due_date: item.due_date ? new Date(item.due_date) : undefined,
      
      // Transform users
      created_by: transformedUser(item.created_by),
      assigned_to: transformedUser(item.assigned_to),
      
      // Legacy compatibility fields
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
      loanIds: item.loan_ids,
      assignedTo: transformedUser(item.assigned_to),
      threadId: item.thread_id,
      replyToId: item.reply_to_id?.toString(),
      from: transformedUser(item.created_by),
      to: item.recipients?.filter((r: any) => r.recipient_type === 'to')
        .map((r: any) => transformedUser(r.user)) || []
    };
  }

  // Transform stats for compatibility
  private transformStats(stats: any): InboxStats {
    return {
      ...stats,
      // Legacy compatibility
      myTasks: stats.my_tasks,
      byCategory: stats.by_category,
      byPriority: stats.by_priority
    };
  }
}

export const inboxApi = new InboxApiService();