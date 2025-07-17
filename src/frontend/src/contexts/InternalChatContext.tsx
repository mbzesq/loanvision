import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { 
  ChatRoom, 
  ChatMessage, 
  ChatUser, 
  TypingIndicator,
  ChatUserStatus
} from '../types/chat';
import { chatApi } from '../services/chatApi';
import { useChatWebSocket } from '../hooks/useChatWebSocket';

// State interface
interface InternalChatState {
  // Data
  rooms: ChatRoom[];
  messages: Record<number, ChatMessage[]>; // room_id -> messages
  users: ChatUser[];
  currentUser: ChatUser | null;
  
  // UI State
  selectedRoomId: number | null;
  isLoading: boolean;
  isSidebarCollapsed: boolean;
  
  // Real-time state
  typingUsers: Record<number, TypingIndicator[]>; // room_id -> typing users
  unreadCounts: Record<number, number>; // room_id -> unread count
  onlineUsers: Set<number>; // user_ids that are online
  
  // Error state
  error: string | null;
}

// Action types
type InternalChatAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CURRENT_USER'; payload: ChatUser }
  | { type: 'SET_ROOMS'; payload: ChatRoom[] }
  | { type: 'ADD_ROOM'; payload: ChatRoom }
  | { type: 'UPDATE_ROOM'; payload: ChatRoom }
  | { type: 'SET_MESSAGES'; payload: { roomId: number; messages: ChatMessage[] } }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_USERS'; payload: ChatUser[] }
  | { type: 'SELECT_ROOM'; payload: number | null }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_COLLAPSED'; payload: boolean }
  | { type: 'ADD_TYPING_USER'; payload: { roomId: number; user: TypingIndicator } }
  | { type: 'REMOVE_TYPING_USER'; payload: { roomId: number; userId: number } }
  | { type: 'SET_UNREAD_COUNT'; payload: { roomId: number; count: number } }
  | { type: 'UPDATE_USER_PRESENCE'; payload: { userId: number; status: ChatUserStatus } }
  | { type: 'MARK_ROOM_AS_READ'; payload: number };

// Initial state
const initialState: InternalChatState = {
  rooms: [],
  messages: {},
  users: [],
  currentUser: null,
  selectedRoomId: null,
  isLoading: false,
  isSidebarCollapsed: true,
  typingUsers: {},
  unreadCounts: {},
  onlineUsers: new Set(),
  error: null,
};

// Reducer
function internalChatReducer(state: InternalChatState, action: InternalChatAction): InternalChatState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
      
    case 'SET_ERROR':
      return { ...state, error: action.payload };
      
    case 'SET_CURRENT_USER':
      return { ...state, currentUser: action.payload };
      
    case 'SET_ROOMS':
      return { ...state, rooms: action.payload };
      
    case 'ADD_ROOM':
      return { ...state, rooms: [...state.rooms, action.payload] };
      
    case 'UPDATE_ROOM':
      return {
        ...state,
        rooms: state.rooms.map(room => 
          room.id === action.payload.id ? action.payload : room
        ),
      };
      
    case 'SET_MESSAGES':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.roomId]: action.payload.messages,
        },
      };
      
    case 'ADD_MESSAGE':
      const roomId = action.payload.room_id;
      const existingMessages = state.messages[roomId] || [];
      
      // Avoid duplicates (check by ID)
      if (existingMessages.some(msg => msg.id === action.payload.id)) {
        return state;
      }
      
      return {
        ...state,
        messages: {
          ...state.messages,
          [roomId]: [...existingMessages, action.payload].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ),
        },
      };
      
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.room_id]: (state.messages[action.payload.room_id] || []).map(msg =>
            msg.id === action.payload.id ? action.payload : msg
          ),
        },
      };
      
    case 'SET_USERS':
      return { ...state, users: action.payload };
      
    case 'SELECT_ROOM':
      return { ...state, selectedRoomId: action.payload };
      
    case 'TOGGLE_SIDEBAR':
      return { ...state, isSidebarCollapsed: !state.isSidebarCollapsed };
      
    case 'SET_SIDEBAR_COLLAPSED':
      return { ...state, isSidebarCollapsed: action.payload };
      
    case 'ADD_TYPING_USER':
      const currentTyping = state.typingUsers[action.payload.roomId] || [];
      const isAlreadyTyping = currentTyping.some(t => t.user_id === action.payload.user.user_id);
      
      if (isAlreadyTyping) return state;
      
      return {
        ...state,
        typingUsers: {
          ...state.typingUsers,
          [action.payload.roomId]: [...currentTyping, action.payload.user],
        },
      };
      
    case 'REMOVE_TYPING_USER':
      return {
        ...state,
        typingUsers: {
          ...state.typingUsers,
          [action.payload.roomId]: (state.typingUsers[action.payload.roomId] || []).filter(
            t => t.user_id !== action.payload.userId
          ),
        },
      };
      
    case 'SET_UNREAD_COUNT':
      return {
        ...state,
        unreadCounts: {
          ...state.unreadCounts,
          [action.payload.roomId]: action.payload.count,
        },
      };
      
    case 'UPDATE_USER_PRESENCE':
      return {
        ...state,
        users: state.users.map(user =>
          user.id === action.payload.userId
            ? { ...user, presence_status: action.payload.status }
            : user
        ),
        onlineUsers: action.payload.status === 'online'
          ? new Set([...state.onlineUsers, action.payload.userId])
          : new Set([...state.onlineUsers].filter(id => id !== action.payload.userId)),
      };
      
    case 'MARK_ROOM_AS_READ':
      return {
        ...state,
        unreadCounts: {
          ...state.unreadCounts,
          [action.payload]: 0,
        },
      };
      
    default:
      return state;
  }
}

// Context interface
interface InternalChatContextType {
  // State
  state: InternalChatState;
  
  // Actions
  loadRooms: () => Promise<void>;
  loadMessages: (roomId: number) => Promise<void>;
  loadUsers: () => Promise<void>;
  selectRoom: (roomId: number | null) => void;
  sendMessage: (content: string, roomId?: number) => Promise<void>;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  startDirectMessage: (userId: number) => Promise<void>;
  markRoomAsRead: (roomId: number) => Promise<void>;
  
  // WebSocket functions
  wsActions: {
    joinRoom: (roomId: number) => void;
    leaveRoom: (roomId: number) => void;
    startTyping: (roomId: number) => void;
    stopTyping: (roomId: number) => void;
    addReaction: (messageId: number, emoji: string) => void;
    removeReaction: (messageId: number, emoji: string) => void;
    isConnected: boolean;
  };
}

// Create context
const InternalChatContext = createContext<InternalChatContextType | null>(null);

// Provider component
interface InternalChatProviderProps {
  children: React.ReactNode;
  token: string | null;
  currentUser: ChatUser | null;
}

export function InternalChatProvider({ children, token, currentUser }: InternalChatProviderProps) {
  const [state, dispatch] = useReducer(internalChatReducer, initialState);

  // Set current user when provided
  useEffect(() => {
    if (currentUser) {
      dispatch({ type: 'SET_CURRENT_USER', payload: currentUser });
    }
  }, [currentUser]);

  // WebSocket event handlers
  const handleMessageReceived = useCallback((message: ChatMessage) => {
    console.log('Received chat message:', message);
    dispatch({ type: 'ADD_MESSAGE', payload: message });
    
    // Update unread count if not in the room
    if (state.selectedRoomId !== message.room_id) {
      const currentCount = state.unreadCounts[message.room_id] || 0;
      dispatch({ 
        type: 'SET_UNREAD_COUNT', 
        payload: { roomId: message.room_id, count: currentCount + 1 } 
      });
    }
  }, [state.selectedRoomId, state.unreadCounts]);

  const handleUserTyping = useCallback((data: { room_id: number; user_id: number; user_email: string }) => {
    const typingUser: TypingIndicator = {
      room_id: data.room_id,
      user_id: data.user_id,
      user_email: data.user_email,
      started_at: new Date(),
    };
    dispatch({ type: 'ADD_TYPING_USER', payload: { roomId: data.room_id, user: typingUser } });
  }, []);

  const handleUserStoppedTyping = useCallback((data: { room_id: number; user_id: number }) => {
    dispatch({ 
      type: 'REMOVE_TYPING_USER', 
      payload: { roomId: data.room_id, userId: data.user_id } 
    });
  }, []);

  const handlePresenceUpdated = useCallback((data: { user_id: number; status: ChatUserStatus }) => {
    dispatch({ type: 'UPDATE_USER_PRESENCE', payload: { userId: data.user_id, status: data.status } });
  }, []);

  const handleMarkedRead = useCallback((data: { room_id: number }) => {
    dispatch({ type: 'MARK_ROOM_AS_READ', payload: data.room_id });
  }, []);

  // Initialize WebSocket
  const wsActions = useChatWebSocket({
    token,
    onMessageReceived: handleMessageReceived,
    onUserTyping: handleUserTyping,
    onUserStoppedTyping: handleUserStoppedTyping,
    onPresenceUpdated: handlePresenceUpdated,
    onMarkedRead: handleMarkedRead,
    onError: (error) => dispatch({ type: 'SET_ERROR', payload: error.message }),
  });

  // Load data functions
  const loadRooms = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await chatApi.getChatRooms();
      dispatch({ type: 'SET_ROOMS', payload: response.rooms });
      
      // Set unread counts
      response.rooms.forEach(room => {
        if (room.unread_count) {
          dispatch({ 
            type: 'SET_UNREAD_COUNT', 
            payload: { roomId: room.id, count: room.unread_count } 
          });
        }
      });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load chat rooms' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const loadMessages = useCallback(async (roomId: number) => {
    try {
      const response = await chatApi.getMessages(roomId, { limit: 50 });
      dispatch({ type: 'SET_MESSAGES', payload: { roomId, messages: response.messages } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load messages' });
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const response = await chatApi.getOrganizationUsers();
      dispatch({ type: 'SET_USERS', payload: response.users });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load users' });
    }
  }, []);

  const selectRoom = useCallback((roomId: number | null) => {
    // Leave previous room
    if (state.selectedRoomId) {
      wsActions.leaveRoom(state.selectedRoomId);
    }
    
    dispatch({ type: 'SELECT_ROOM', payload: roomId });
    
    // Join new room and mark as read
    if (roomId) {
      // Add a small delay to ensure WebSocket is ready
      setTimeout(() => {
        wsActions.joinRoom(roomId);
      }, 100);
      loadMessages(roomId);
      markRoomAsRead(roomId);
    }
  }, [state.selectedRoomId, wsActions.joinRoom, wsActions.leaveRoom, loadMessages, markRoomAsRead]);

  const sendMessage = useCallback(async (content: string, roomId?: number) => {
    const targetRoomId = roomId || state.selectedRoomId;
    if (!targetRoomId || !content.trim()) return;

    try {
      await chatApi.sendMessage(targetRoomId, { content: content.trim() });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to send message' });
    }
  }, [state.selectedRoomId]);

  const startDirectMessage = useCallback(async (userId: number) => {
    try {
      const room = await chatApi.startDirectMessage({ target_user_id: userId });
      dispatch({ type: 'ADD_ROOM', payload: room });
      selectRoom(room.id);
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to start direct message' });
    }
  }, [selectRoom]);

  const markRoomAsRead = useCallback(async (roomId: number) => {
    try {
      await chatApi.markMessagesAsRead(roomId);
      wsActions.markRead(roomId);
    } catch (error) {
      console.error('Failed to mark room as read:', error);
    }
  }, [wsActions]);

  const toggleSidebar = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    dispatch({ type: 'SET_SIDEBAR_COLLAPSED', payload: collapsed });
  }, []);

  // Initialize data on mount
  useEffect(() => {
    if (token) {
      loadRooms();
      loadUsers();
    }
  }, [token, loadRooms, loadUsers]);

  // Removed temporary polling mechanism - WebSocket handles real-time updates now

  const contextValue: InternalChatContextType = {
    state,
    loadRooms,
    loadMessages,
    loadUsers,
    selectRoom,
    sendMessage,
    toggleSidebar,
    setSidebarCollapsed,
    startDirectMessage,
    markRoomAsRead,
    wsActions,
  };

  return (
    <InternalChatContext.Provider value={contextValue}>
      {children}
    </InternalChatContext.Provider>
  );
}

// Hook to use the context
export function useInternalChat() {
  const context = useContext(InternalChatContext);
  if (!context) {
    throw new Error('useInternalChat must be used within an InternalChatProvider');
  }
  return context;
}

export default InternalChatContext;