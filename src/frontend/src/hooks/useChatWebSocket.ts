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
    console.log('useChatWebSocket: token check', { hasToken: !!token, tokenLength: token?.length });
    if (!token) return;

    const connectSocket = () => {
      // Determine the correct WebSocket URL with proper protocol
      const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
      
      let wsUrl;
      if (isProduction) {
        // Use environment variable if available, otherwise use API base URL
        wsUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_BASE_URL || window.location.origin;
        // If the API URL has /api suffix, remove it for WebSocket
        wsUrl = wsUrl.replace(/\/api$/, '');
      } else {
        wsUrl = 'http://localhost:3000';
      }
      
      console.log('Environment detection:', {
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'undefined',
        protocol: typeof window !== 'undefined' ? window.location.protocol : 'undefined',
        isProduction,
        originalOrigin: typeof window !== 'undefined' ? window.location.origin : 'undefined',
        wsUrl
      });
      console.log('Creating WebSocket connection with:', { 
        wsUrl, 
        hasToken: !!token, 
        tokenLength: token?.length,
        isProduction,
        currentOrigin: window.location.origin,
        hostname: window.location.hostname
      });
      
      const socket = io(wsUrl, {
        path: '/ws',
        auth: { token },
        // Start with polling only in production for stability
        transports: isProduction ? ['polling'] : ['websocket', 'polling'],
        upgrade: false, // Disable transport upgrade in production
        timeout: 30000,
        autoConnect: true,
        forceNew: true,
        // Add retry configuration
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });

      socketRef.current = socket;

      // Connection events
      socket.on('connect', () => {
        console.log('✅ Chat WebSocket connected!', {
          id: socket.id,
          transport: socket.io.engine.transport.name,
          url: wsUrl
        });
        // Clear any reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ Chat WebSocket disconnected:', reason);
        // Auto-reconnect after 3 seconds if not manually disconnected
        if (reason !== 'io client disconnect') {
          console.log('🔄 Auto-reconnecting in 3 seconds...');
          reconnectTimeoutRef.current = window.setTimeout(connectSocket, 3000);
        }
      });

      socket.on('connect_error', (error) => {
        console.error('🚨 Chat WebSocket connection error:', {
          error: error.message,
          type: error.type,
          description: error.description,
          wsUrl
        });
        // Retry connection after 5 seconds
        console.log('🔄 Retrying connection in 5 seconds...');
        reconnectTimeoutRef.current = window.setTimeout(connectSocket, 5000);
      });

      // Add transport change logging
      socket.io.on('upgrade', () => {
        console.log('🚀 Transport upgraded to:', socket.io.engine.transport.name);
      });

      socket.io.on('upgradeError', (error) => {
        console.warn('⚠️ Transport upgrade failed:', error);
      });

      // Chat event listeners
      socket.on('chat:message_received', (data) => {
        console.log('WebSocket received chat:message_received:', data);
        if (onMessageReceived) {
          onMessageReceived(data);
        }
      });
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
  }, [token]); // Only reconnect when token changes, not on every render

  // Emit functions
  const joinRoom = useCallback((roomId: number) => {
    console.log('Joining chat room:', roomId, 'Socket connected:', socketRef.current?.connected, 'Socket ID:', socketRef.current?.id);
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:join_room', { room_id: roomId });
      console.log('Emitted chat:join_room event for room:', roomId);
    } else {
      console.warn('Cannot join room - socket not connected. Will retry in 1 second...');
      // Retry joining room after a short delay
      setTimeout(() => {
        if (socketRef.current?.connected) {
          console.log('Retrying room join for room:', roomId);
          socketRef.current.emit('chat:join_room', { room_id: roomId });
        } else {
          console.warn('Socket still not connected after retry');
        }
      }, 1000);
    }
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