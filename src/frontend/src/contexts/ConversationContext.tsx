import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Message {
  id: string;
  content: string;
  sender: {
    id: string;
    name: string;
    type: 'ai' | 'user';
    avatarUrl?: string;
  };
  timestamp: Date;
  isRead: boolean;
}

interface ConversationState {
  messages: Message[];
  lastActivity: Date;
}

interface ConversationContextType {
  conversations: Record<string, ConversationState>;
  getMessages: (conversationId: string) => Message[];
  addMessage: (conversationId: string, message: Message) => void;
  clearOldMessages: () => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export function useConversations() {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversations must be used within a ConversationProvider');
  }
  return context;
}

interface ConversationProviderProps {
  children: ReactNode;
}

// Message retention policy - 24 hours (in milliseconds)
const MESSAGE_RETENTION_HOURS = 24;
const MESSAGE_RETENTION_MS = MESSAGE_RETENTION_HOURS * 60 * 60 * 1000;

export function ConversationProvider({ children }: ConversationProviderProps) {
  const [conversations, setConversations] = useState<Record<string, ConversationState>>({});

  const getMessages = (conversationId: string): Message[] => {
    return conversations[conversationId]?.messages || [];
  };

  const addMessage = (conversationId: string, message: Message) => {
    setConversations(prev => ({
      ...prev,
      [conversationId]: {
        messages: [...(prev[conversationId]?.messages || []), message],
        lastActivity: new Date()
      }
    }));
  };

  const clearOldMessages = () => {
    const now = new Date();
    setConversations(prev => {
      const updated = { ...prev };
      
      Object.keys(updated).forEach(conversationId => {
        const conversation = updated[conversationId];
        const cutoffTime = new Date(now.getTime() - MESSAGE_RETENTION_MS);
        
        // Filter out messages older than retention period
        const filteredMessages = conversation.messages.filter(
          message => message.timestamp > cutoffTime
        );
        
        if (filteredMessages.length === 0) {
          // Remove conversation entirely if no messages remain
          delete updated[conversationId];
        } else if (filteredMessages.length !== conversation.messages.length) {
          // Update conversation with filtered messages
          updated[conversationId] = {
            ...conversation,
            messages: filteredMessages
          };
        }
      });
      
      return updated;
    });
  };

  // Initialize default messages for Morgan AI
  const initializeConversation = (conversationId: string) => {
    if (conversationId === 'morgan-ai' && !conversations[conversationId]) {
      const welcomeMessage: Message = {
        id: 'morgan-welcome',
        content: 'Hello! I\'m Morgan AI, your portfolio analysis assistant. How can I help you today?',
        sender: {
          id: 'morgan-ai',
          name: 'Morgan AI',
          type: 'ai'
        },
        timestamp: new Date(),
        isRead: true
      };
      
      addMessage(conversationId, welcomeMessage);
    }
  };

  const contextValue: ConversationContextType = {
    conversations,
    getMessages: (conversationId: string) => {
      initializeConversation(conversationId);
      return getMessages(conversationId);
    },
    addMessage,
    clearOldMessages
  };

  // Automatic cleanup of old messages - runs every hour
  useEffect(() => {
    const cleanup = () => {
      clearOldMessages();
    };

    // Run cleanup immediately on mount
    cleanup();

    // Set up interval to run cleanup every hour
    const interval = setInterval(cleanup, 60 * 60 * 1000); // 1 hour

    return () => clearInterval(interval);
  }, []);

  return (
    <ConversationContext.Provider value={contextValue}>
      {children}
    </ConversationContext.Provider>
  );
}