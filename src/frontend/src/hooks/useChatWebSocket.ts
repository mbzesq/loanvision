import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChatWebSocketEvents } from '../types/chat';

interface UseChatWebSocketProps {
  token: string | null;
  onMessageReceived?: (data: ChatWebSocketEvents['chat:message_received']) => void;
  onMessageSent?: (data: ChatWebSocketEvents['chat:message_sent']) => void;
  onUserTyping?: (data: ChatWebSocketEvents['chat:user_typing']) => void;
  onUserStoppedTyping?: (data: ChatWebSocketEvents['chat:user_stopped_typing']) => void;
  onUserJoined?: (data: ChatWebSocketEvents['chat:user_joined']) => void;
  onUserLeft?: (data: ChatWebSocketEvents['chat:user_left']) => void;
  onPresenceUpdated?: (data: ChatWebSocketEvents['chat:presence_updated']) => void;
  onReactionAdded?: (data: ChatWebSocketEvents['chat:reaction_added']) => void;
  onReactionRemoved?: (data: ChatWebSocketEvents['chat:reaction_removed']) => void;
  onMarkedRead?: (data: ChatWebSocketEvents['chat:marked_read']) => void;
  onError?: (data: ChatWebSocketEvents['chat:error']) => void;
}

export function useChatWebSocket({
  token,
  onMessageReceived,
  onMessageSent,
  onUserTyping,
  onUserStoppedTyping,
  onUserJoined,
  onUserLeft,
  onPresenceUpdated,
  onReactionAdded,
  onReactionRemoved,
  onMarkedRead,
  onError,
}: UseChatWebSocketProps) {
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // Initialize socket connection
  useEffect(() => {
    if (!token) return;

    const connectSocket = () => {
      const socket = io(typeof window !== 'undefined' && import.meta.env.PROD
        ? window.location.origin 
        : 'http://localhost:3001', {
        path: '/ws',
        auth: { token },
        transports: ['websocket', 'polling'],
      });

      socketRef.current = socket;

      // Connection events
      socket.on('connect', () => {
        console.log('Chat WebSocket connected');
        // Clear any reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('Chat WebSocket disconnected:', reason);
        // Auto-reconnect after 3 seconds if not manually disconnected
        if (reason !== 'io client disconnect') {
          reconnectTimeoutRef.current = window.setTimeout(connectSocket, 3000);
        }
      });

      socket.on('connect_error', (error) => {
        console.error('Chat WebSocket connection error:', error);
        // Retry connection after 5 seconds
        reconnectTimeoutRef.current = window.setTimeout(connectSocket, 5000);
      });

      // Chat event listeners
      socket.on('chat:message_received', onMessageReceived || (() => {}));
      socket.on('chat:message_sent', onMessageSent || (() => {}));
      socket.on('chat:user_typing', onUserTyping || (() => {}));
      socket.on('chat:user_stopped_typing', onUserStoppedTyping || (() => {}));
      socket.on('chat:user_joined', onUserJoined || (() => {}));
      socket.on('chat:user_left', onUserLeft || (() => {}));
      socket.on('chat:presence_updated', onPresenceUpdated || (() => {}));
      socket.on('chat:reaction_added', onReactionAdded || (() => {}));
      socket.on('chat:reaction_removed', onReactionRemoved || (() => {}));
      socket.on('chat:marked_read', onMarkedRead || (() => {}));
      socket.on('chat:error', onError || ((error) => console.error('Chat error:', error)));
    };

    connectSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [token, onMessageReceived, onMessageSent, onUserTyping, onUserStoppedTyping, 
      onUserJoined, onUserLeft, onPresenceUpdated, onReactionAdded, onReactionRemoved, 
      onMarkedRead, onError]);

  // Emit functions
  const joinRoom = useCallback((roomId: number) => {
    socketRef.current?.emit('chat:join_room', { room_id: roomId });
  }, []);

  const leaveRoom = useCallback((roomId: number) => {
    socketRef.current?.emit('chat:leave_room', { room_id: roomId });
  }, []);

  const sendMessage = useCallback((data: ChatWebSocketEvents['chat:send_message']) => {
    socketRef.current?.emit('chat:send_message', data);
  }, []);

  const startTyping = useCallback((roomId: number) => {
    socketRef.current?.emit('chat:typing_start', { room_id: roomId });
  }, []);

  const stopTyping = useCallback((roomId: number) => {
    socketRef.current?.emit('chat:typing_stop', { room_id: roomId });
  }, []);

  const markRead = useCallback((roomId: number, messageId?: number) => {
    socketRef.current?.emit('chat:mark_read', { room_id: roomId, message_id: messageId });
  }, []);

  const addReaction = useCallback((messageId: number, emoji: string) => {
    socketRef.current?.emit('chat:add_reaction', { message_id: messageId, emoji });
  }, []);

  const removeReaction = useCallback((messageId: number, emoji: string) => {
    socketRef.current?.emit('chat:remove_reaction', { message_id: messageId, emoji });
  }, []);

  const isConnected = socketRef.current?.connected || false;

  return {
    // Connection state
    isConnected,
    
    // Actions
    joinRoom,
    leaveRoom,
    sendMessage,
    startTyping,
    stopTyping,
    markRead,
    addReaction,
    removeReaction,
  };
}