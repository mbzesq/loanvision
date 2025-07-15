// Chat system type definitions
export type ChatRoomType = 'general' | 'department' | 'direct_message' | 'project';
export type ChatMessageType = 'text' | 'file' | 'system' | 'emoji_only';
export type ChatUserStatus = 'online' | 'away' | 'busy' | 'offline';

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
  user?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    profile_image_url?: string;
    job_title?: string;
    department?: string;
  };
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
  user?: {
    id: number;
    first_name: string;
    last_name: string;
    profile_image_url?: string;
  };
  
  // Computed fields
  reactions?: ChatMessageReaction[];
  thread_replies?: ChatMessage[];
  thread_count?: number;
}

export interface ChatMessageReaction {
  id: number;
  message_id: number;
  user_id: number;
  emoji: string;
  created_at: Date;
  
  // User details
  user?: {
    id: number;
    first_name: string;
    last_name: string;
  };
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

export interface UpdateMessageRequest {
  content?: string;
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

export interface ChatRoomFilters {
  type?: ChatRoomType[];
  include_archived?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ChatMessageFilters {
  room_id: number;
  before_message_id?: number;
  after_message_id?: number;
  thread_parent_id?: number | null;
  limit?: number;
  offset?: number;
}

export interface StartDirectMessageRequest {
  target_user_id: number;
}

export interface UpdateTypingStatusRequest {
  room_id: number;
  is_typing: boolean;
}

export interface UpdateUserPresenceRequest {
  status: ChatUserStatus;
}

export interface AddReactionRequest {
  message_id: number;
  emoji: string;
}

// WebSocket event types
export interface ChatWebSocketEvents {
  // Client to server
  'join_room': { room_id: number };
  'leave_room': { room_id: number };
  'send_message': SendMessageRequest;
  'typing_start': { room_id: number };
  'typing_stop': { room_id: number };
  'mark_read': { room_id: number; message_id?: number };
  'add_reaction': AddReactionRequest;
  'remove_reaction': { message_id: number; emoji: string };
  
  // Server to client
  'message_received': ChatMessage;
  'message_updated': ChatMessage;
  'message_deleted': { message_id: number; room_id: number };
  'user_typing': { room_id: number; user_id: number; user_name: string };
  'user_stopped_typing': { room_id: number; user_id: number };
  'user_joined_room': { room_id: number; user: ChatParticipant['user'] };
  'user_left_room': { room_id: number; user_id: number };
  'room_updated': ChatRoom;
  'presence_updated': { user_id: number; status: ChatUserStatus };
  'reaction_added': ChatMessageReaction;
  'reaction_removed': { message_id: number; user_id: number; emoji: string };
  'unread_count_updated': { room_id: number; unread_count: number };
}

// Statistics and analytics
export interface ChatStats {
  total_rooms: number;
  total_messages: number;
  active_users_today: number;
  popular_rooms: Array<{
    room_id: number;
    room_name: string;
    message_count: number;
  }>;
  user_activity: Array<{
    user_id: number;
    user_name: string;
    message_count: number;
    last_active: Date;
  }>;
}