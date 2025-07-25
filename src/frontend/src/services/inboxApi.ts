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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

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

  // Archive an item
  async archiveItem(itemId: number): Promise<InboxItem> {
    const item = await this.makeRequest<InboxItem>(`/${itemId}/archive`, {
      method: 'POST',
    });
    return this.transformInboxItem(item);
  }

  // Delete an item
  async deleteItem(itemId: number): Promise<{ success: boolean; message: string }> {
    return this.makeRequest<{ success: boolean; message: string }>(`/${itemId}`, {
      method: 'DELETE',
    });
  }

  // Reply to an item
  async replyToItem(itemId: number, body: string, recipients?: Array<{ user_id: number; recipient_type?: 'to' | 'cc' | 'bcc' }>): Promise<InboxItem> {
    const item = await this.makeRequest<InboxItem>(`/${itemId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ body, recipients }),
    });
    return this.transformInboxItem(item);
  }

  // Forward an item
  async forwardItem(itemId: number, body: string, recipients: Array<{ user_id: number; recipient_type?: 'to' | 'cc' | 'bcc' }>): Promise<InboxItem> {
    const item = await this.makeRequest<InboxItem>(`/${itemId}/forward`, {
      method: 'POST',
      body: JSON.stringify({ body, recipients }),
    });
    return this.transformInboxItem(item);
  }

  // Create a task from an inbox item
  async createTask(itemId: number, title: string, description?: string, assigned_to_user_id?: number, due_date?: Date, priority?: 'urgent' | 'high' | 'normal' | 'low'): Promise<InboxItem> {
    const item = await this.makeRequest<InboxItem>(`/${itemId}/create-task`, {
      method: 'POST',
      body: JSON.stringify({ 
        title, 
        description, 
        assigned_to_user_id, 
        due_date: due_date?.toISOString(), 
        priority 
      }),
    });
    return this.transformInboxItem(item);
  }

  // Create a standalone task
  async createStandaloneTask(title: string, description?: string, assigned_to_user_id?: number, due_date?: Date, priority?: 'urgent' | 'high' | 'normal' | 'low', category?: string, loan_ids?: string[]): Promise<InboxItem> {
    const item = await this.makeRequest<InboxItem>(`/create-task`, {
      method: 'POST',
      body: JSON.stringify({ 
        title, 
        description, 
        assigned_to_user_id, 
        due_date: due_date?.toISOString(), 
        priority,
        category,
        loan_ids
      }),
    });
    return this.transformInboxItem(item);
  }

  // Update task status
  async updateTaskStatus(itemId: number, status: 'unread' | 'read' | 'in_progress' | 'completed'): Promise<InboxItem> {
    const item = await this.makeRequest<InboxItem>(`/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    return this.transformInboxItem(item);
  }

  // Create a new message
  async createMessage(subject: string, body: string, recipients: Array<{ user_id: number; recipient_type?: 'to' | 'cc' | 'bcc' }>): Promise<InboxItem> {
    const item = await this.makeRequest<InboxItem>(``, {
      method: 'POST',
      body: JSON.stringify({
        type: 'user_message',
        subject,
        body,
        priority: 'normal',
        recipients
      }),
    });
    return this.transformInboxItem(item);
  }

  // Get list of users for task assignment
  async getUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE_URL}/api/auth/users`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    
    const data = await response.json();
    return data.users;
  }

  // Search loans for task assignment
  async searchLoans(query: string): Promise<Array<{
    id: string;
    display_name: string;
    borrower_name: string;
    property_address: string;
    property_city: string;
    property_state: string;
    property_zip: string;
    current_balance: number;
    loan_status: string;
  }>> {
    const url = `${API_BASE_URL}/api/loans/search?q=${encodeURIComponent(query)}`;
    console.log('Making loan search request to:', url);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`,
      },
    });
    
    console.log('Loan search response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Loan search error response:', errorText);
      throw new Error(`Failed to search loans: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Loan search API response:', data);
    return data.loans;
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