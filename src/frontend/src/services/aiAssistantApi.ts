import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface AIQueryRequest {
  query: string;
  conversationId?: string;
  includeContext?: boolean;
  maxResults?: number;
}

export interface AIQueryResponse {
  response: string;
  conversationId: string;
  messageId: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  rateLimitStatus: {
    queriesRemaining: number;
    tokensRemaining: number;
    resetTime: Date;
  };
  responseTimeMs: number;
  anonymizedQuery: string;
  piiMappingsUsed: string[];
}

export interface AIConversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessage?: string;
}

export interface AIMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  tokenCount: number;
  createdAt: Date;
}

export interface RateLimitStatus {
  userId: number;
  date: string;
  queriesUsed: number;
  tokensUsed: number;
  queriesRemaining: number;
  tokensRemaining: number;
  resetTime: Date;
  isBlocked: boolean;
  blockedReason?: string;
}

export interface AIStats {
  totalQueries: number;
  totalTokens: number;
  activeUsers: number;
  avgResponseTime: number;
  topQueries: string[];
}

class AIAssistantAPI {
  private baseURL: string;

  constructor() {
    this.baseURL = `${API_BASE_URL}/api/ai`;
  }

  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Send a query to Morgan AI assistant
   */
  async sendQuery(request: AIQueryRequest): Promise<AIQueryResponse> {
    try {
      const response = await axios.post(`${this.baseURL}/query`, request, {
        headers: this.getAuthHeaders()
      });

      if (response.data.success) {
        return {
          ...response.data.data,
          rateLimitStatus: {
            ...response.data.data.rateLimitStatus,
            resetTime: new Date(response.data.data.rateLimitStatus.resetTime)
          }
        };
      } else {
        throw new Error(response.data.error || 'Failed to send query');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Get user's conversations
   */
  async getConversations(): Promise<AIConversation[]> {
    try {
      const response = await axios.get(`${this.baseURL}/conversations`, {
        headers: this.getAuthHeaders()
      });

      if (response.data.success) {
        return response.data.data.conversations.map((conv: any) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt)
        }));
      } else {
        throw new Error(response.data.error || 'Failed to get conversations');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Get messages for a conversation
   */
  async getConversationMessages(conversationId: string): Promise<AIMessage[]> {
    try {
      const response = await axios.get(`${this.baseURL}/conversations/${conversationId}/messages`, {
        headers: this.getAuthHeaders()
      });

      if (response.data.success) {
        return response.data.data.messages.map((msg: any) => ({
          ...msg,
          createdAt: new Date(msg.createdAt)
        }));
      } else {
        throw new Error(response.data.error || 'Failed to get messages');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      const response = await axios.delete(`${this.baseURL}/conversations/${conversationId}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to delete conversation');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(): Promise<RateLimitStatus> {
    try {
      const response = await axios.get(`${this.baseURL}/rate-limit`, {
        headers: this.getAuthHeaders()
      });

      if (response.data.success) {
        return {
          ...response.data.data,
          resetTime: new Date(response.data.data.resetTime)
        };
      } else {
        throw new Error(response.data.error || 'Failed to get rate limit status');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Get rate limit history
   */
  async getRateLimitHistory(): Promise<{
    current: RateLimitStatus;
    history: Array<{
      date: string;
      queries: number;
      tokens: number;
      lastQuery: Date | null;
    }>;
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/rate-limit/history`, {
        headers: this.getAuthHeaders()
      });

      if (response.data.success) {
        return {
          current: {
            ...response.data.data.current,
            resetTime: new Date(response.data.data.current.resetTime)
          },
          history: response.data.data.history.map((item: any) => ({
            ...item,
            lastQuery: item.lastQuery ? new Date(item.lastQuery) : null
          }))
        };
      } else {
        throw new Error(response.data.error || 'Failed to get rate limit history');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Get AI assistant statistics
   */
  async getStats(): Promise<AIStats> {
    try {
      const response = await axios.get(`${this.baseURL}/stats`, {
        headers: this.getAuthHeaders()
      });

      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to get stats');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Test AI assistant connectivity (admin only)
   */
  async testConnection(): Promise<{
    success: boolean;
    model: string;
    responseTimeMs: number;
    error?: string;
  }> {
    try {
      const response = await axios.post(`${this.baseURL}/test`, {}, {
        headers: this.getAuthHeaders()
      });

      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to test connection');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        throw new Error(message);
      }
      throw error;
    }
  }
}

export const aiAssistantApi = new AIAssistantAPI();