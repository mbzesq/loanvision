import axios from '../utils/axios';
import {
  ChatRoom,
  ChatMessage,
  CreateChatRoomRequest,
  SendMessageRequest,
  StartDirectMessageRequest,
  ChatRoomListResponse,
  ChatMessageListResponse,
  ChatUsersResponse,
  ChatStats,
  ChatRoomType,
  ChatUserStatus
} from '../types/chat';

class ChatAPI {
  private baseURL = '/api/chat';

  // Chat Rooms
  async getChatRooms(params?: {
    type?: ChatRoomType[];
    include_archived?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<ChatRoomListResponse> {
    const response = await axios.get(`${this.baseURL}/rooms`, { params });
    return response.data;
  }

  async createChatRoom(data: CreateChatRoomRequest): Promise<ChatRoom> {
    const response = await axios.post(`${this.baseURL}/rooms`, data);
    return response.data;
  }

  // Messages
  async getMessages(roomId: number, params?: {
    before?: number;
    after?: number;
    thread_parent_id?: number | null;
    limit?: number;
    offset?: number;
  }): Promise<ChatMessageListResponse> {
    const response = await axios.get(`${this.baseURL}/rooms/${roomId}/messages`, { params });
    return response.data;
  }

  async sendMessage(roomId: number, data: Omit<SendMessageRequest, 'room_id'>): Promise<ChatMessage> {
    const response = await axios.post(`${this.baseURL}/rooms/${roomId}/messages`, data);
    return response.data;
  }

  async markMessagesAsRead(roomId: number, messageId?: number): Promise<void> {
    await axios.post(`${this.baseURL}/rooms/${roomId}/read`, { message_id: messageId });
  }

  // Direct Messages
  async startDirectMessage(data: StartDirectMessageRequest): Promise<ChatRoom> {
    const response = await axios.post(`${this.baseURL}/direct-messages`, data);
    return response.data;
  }

  // User Presence
  async updatePresence(status: ChatUserStatus): Promise<void> {
    await axios.post(`${this.baseURL}/presence`, { status });
  }

  // Message Reactions
  async addReaction(messageId: number, emoji: string): Promise<void> {
    await axios.post(`${this.baseURL}/messages/${messageId}/reactions`, { emoji });
  }

  async removeReaction(messageId: number, emoji: string): Promise<void> {
    await axios.delete(`${this.baseURL}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
  }

  // Users
  async getOrganizationUsers(search?: string): Promise<ChatUsersResponse> {
    const response = await axios.get(`${this.baseURL}/users`, { 
      params: search ? { search } : undefined 
    });
    return response.data;
  }

  // Statistics
  async getChatStats(): Promise<ChatStats> {
    const response = await axios.get(`${this.baseURL}/stats`);
    return response.data;
  }
}

// Create singleton instance
export const chatApi = new ChatAPI();
export default chatApi;