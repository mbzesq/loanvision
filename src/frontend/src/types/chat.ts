// Frontend chat types (mirrored from backend with some additions for UI state)

export type ChatRoomType = 'general' | 'department' | 'direct_message' | 'project';
export type ChatMessageType = 'text' | 'file' | 'system' | 'emoji_only';
export type ChatUserStatus = 'online' | 'away' | 'busy' | 'offline';

// Chat system category for architectural separation
export type ChatSystemType = 'internal' | 'industry';

export interface ChatRoom {
  id: number;
  name: string;
  description?: string;
  type: ChatRoomType;
  organization_id: number;
  department_id?: number;
  created_by_user_id: number;
  is_private: boolean;
  is_archived: boolean;
  last_message_at: Date;
  created_at: Date;
  updated_at: Date;
  
  // Computed fields
  unread_count?: number;
  last_message?: ChatMessage;
  participant_count?: number;
  participants?: ChatParticipant[];
}

export interface ChatParticipant {
  id: number;
  room_id: number;
  user_id: number;
  joined_at: Date;
  last_read_at: Date;
  is_admin: boolean;
  is_muted: boolean;
  
  // User details
  user?: ChatUser;
}

export interface ChatUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  profile_image_url?: string;
  job_title?: string;
  department?: string;
  presence_status?: ChatUserStatus;
  last_seen_at?: Date;
}

export interface ChatMessage {
  id: number;
  room_id: number;
  user_id: number;
  message_type: ChatMessageType;
  content: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  thread_parent_id?: number;
  edited_at?: Date;
  deleted_at?: Date;
  created_at: Date;
  
  // User details
  user?: ChatUser;
  
  // Computed fields
  reactions?: ChatMessageReaction[];
  thread_replies?: ChatMessage[];
  thread_count?: number;
  
  // UI state
  isOptimistic?: boolean; // For optimistic updates
  isSending?: boolean;
}

export interface ChatMessageReaction {
  id: number;
  message_id: number;
  user_id: number;
  emoji: string;
  created_at: Date;
  user?: ChatUser;
}

export interface ChatUserPresence {
  user_id: number;
  status: ChatUserStatus;
  last_seen_at: Date;
  is_typing_in_room_id?: number;
  typing_started_at?: Date;
  updated_at: Date;
}

// Request/Response types
export interface CreateChatRoomRequest {
  name: string;
  description?: string;
  type: ChatRoomType;
  department_id?: number;
  is_private?: boolean;
  participant_user_ids?: number[];
}

export interface SendMessageRequest {
  room_id: number;
  content: string;
  message_type?: ChatMessageType;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  thread_parent_id?: number;
}

export interface ChatRoomListResponse {
  rooms: ChatRoom[];
  total: number;
}

export interface ChatMessageListResponse {
  messages: ChatMessage[];
  total: number;
  has_more: boolean;
}

export interface StartDirectMessageRequest {
  target_user_id: number;
}

export interface UpdateUserPresenceRequest {
  status: ChatUserStatus;
}

export interface AddReactionRequest {
  message_id: number;
  emoji: string;
}

export interface ChatUsersResponse {
  users: ChatUser[];
}

// WebSocket event types for real-time features
export interface ChatWebSocketEvents {
  // Client to server
  'chat:join_room': { room_id: number };
  'chat:leave_room': { room_id: number };
  'chat:send_message': SendMessageRequest;
  'chat:typing_start': { room_id: number };
  'chat:typing_stop': { room_id: number };
  'chat:mark_read': { room_id: number; message_id?: number };
  'chat:add_reaction': AddReactionRequest;
  'chat:remove_reaction': { message_id: number; emoji: string };
  
  // Server to client
  'chat:message_received': ChatMessage;
  'chat:message_sent': { message_id: number };
  'chat:message_updated': ChatMessage;
  'chat:message_deleted': { message_id: number; room_id: number };
  'chat:user_typing': { room_id: number; user_id: number; user_email: string };
  'chat:user_stopped_typing': { room_id: number; user_id: number };
  'chat:user_joined': { room_id: number; user: ChatUser };
  'chat:user_left': { room_id: number; user_id: number };
  'chat:room_updated': ChatRoom;
  'chat:presence_updated': { user_id: number; status: ChatUserStatus };
  'chat:reaction_added': ChatMessageReaction;
  'chat:reaction_removed': { message_id: number; user_id: number; emoji: string };
  'chat:unread_count_updated': { room_id: number; unread_count: number };
  'chat:marked_read': { room_id: number; message_id?: number };
  'chat:error': { message: string };
}

// UI State types
export interface ChatUIState {
  selectedRoomId: number | null;
  isTyping: Record<number, boolean>; // room_id -> isTyping
  typingUsers: Record<number, ChatUser[]>; // room_id -> users typing
  unreadCounts: Record<number, number>; // room_id -> unread count
  isSidebarCollapsed: boolean;
  activeTab: ChatSystemType;
}

export interface TypingIndicator {
  room_id: number;
  user_id: number;
  user_email: string;
  started_at: Date;
}

// Chat Statistics
export interface ChatStats {
  total_rooms: number;
  total_messages: number;
  active_users_today: number;
  popular_rooms: Array<{
    room_id: number;
    room_name: string;
    message_count: number;
  }>;
}

// Error types
export interface ChatError {
  code: string;
  message: string;
  details?: any;
}