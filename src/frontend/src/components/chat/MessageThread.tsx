import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Bot, User, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ChatTypingIndicator } from './ChatTypingIndicator';
import { useAuth } from '../../contexts/AuthContext';
import { useConversations } from '../../contexts/ConversationContext';

interface MessageThreadProps {
  conversationId: string;
  conversationType: 'ai' | 'user' | 'channel';
  conversationName: string;
  onBack: () => void;
}

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

export function MessageThread({ 
  conversationId, 
  conversationType, 
  conversationName,
  onBack 
}: MessageThreadProps) {
  const { user } = useAuth();
  const { getMessages, addMessage } = useConversations();
  const [loading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get messages from conversation context
  const messages = getMessages(conversationId);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    // Add user message immediately (optimistic update)
    const userName = user?.firstName && user?.lastName 
      ? `${user.firstName} ${user.lastName}`
      : user?.email?.split('@')[0] || 'You';
      
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      content: messageContent,
      sender: {
        id: 'current-user',
        name: userName,
        type: 'user'
      },
      timestamp: new Date(),
      isRead: true
    };

    addMessage(conversationId, userMessage);

    try {
      if (conversationId === 'morgan-ai') {
        // Show typing indicator for AI
        setIsTyping(true);
        
        // Simulate AI response delay
        setTimeout(() => {
          const aiResponse: Message = {
            id: `ai-${Date.now()}`,
            content: `I understand you said: "${messageContent}". Let me help you with that! This is a demo response - the actual AI integration would process your request and provide detailed portfolio analysis.`,
            sender: {
              id: 'morgan-ai',
              name: 'Morgan AI',
              type: 'ai'
            },
            timestamp: new Date(),
            isRead: true
          };
          
          addMessage(conversationId, aiResponse);
          setIsTyping(false);
        }, 1500);
      } else {
        // Handle regular chat message sending
        // TODO: Implement actual chat API integration
        console.log('Sending message to:', conversationType, conversationId, messageContent);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
    }
  };

  const getConversationTitle = () => {
    if (conversationId === 'morgan-ai') {
      return 'Morgan AI';
    } else if (conversationType === 'channel') {
      return `#${conversationName}`;
    } else {
      return conversationName || 'Direct Message';
    }
  };

  const getConversationIcon = () => {
    if (conversationId === 'morgan-ai') {
      return <Bot className="w-5 h-5 text-blue-600" />;
    } else if (conversationType === 'channel') {
      return <span className="text-gray-600 font-semibold">#</span>;
    } else {
      return <User className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Thread Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 shrink-0">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center space-x-2">
            {getConversationIcon()}
            <h3 className="text-sm font-semibold text-gray-900">
              {getConversationTitle()}
            </h3>
            {conversationId === 'morgan-ai' && (
              <Badge className="bg-blue-100 text-blue-700 text-xs">
                AI Assistant
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500">Loading messages...</div>
          </div>
        ) : (
          <>
            {messages.map(message => (
              <div key={message.id} className="flex space-x-3">
                <Avatar className="w-8 h-8 shrink-0">
                  {message.sender.type === 'ai' ? (
                    <div className="w-full h-full bg-blue-100 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                  ) : message.sender.avatarUrl ? (
                    <AvatarImage src={message.sender.avatarUrl} alt={message.sender.name} />
                  ) : (
                    <AvatarFallback className="bg-gray-100">
                      {message.sender.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline space-x-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {message.sender.name}
                    </span>
                    {message.sender.type === 'ai' && (
                      <Badge className="bg-blue-100 text-blue-700 text-xs">AI</Badge>
                    )}
                    <span className="text-xs text-gray-500">
                      {message.timestamp.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  
                  <div className={`
                    inline-block max-w-full p-3 rounded-lg text-sm
                    ${message.sender.id === 'current-user' 
                      ? 'bg-blue-600 text-white ml-auto' 
                      : message.sender.type === 'ai'
                      ? 'bg-blue-50 text-gray-900 border border-blue-200'
                      : 'bg-gray-100 text-gray-900'
                    }
                  `}>
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex space-x-3">
                <Avatar className="w-8 h-8 shrink-0">
                  <div className="w-full h-full bg-blue-100 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-blue-600" />
                  </div>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-baseline space-x-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">Morgan AI</span>
                    <Badge className="bg-blue-100 text-blue-700 text-xs">AI</Badge>
                  </div>
                  <ChatTypingIndicator typingUsers={[]} />
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-200 p-4 shrink-0">
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <Input
              type="text"
              placeholder={
                conversationId === 'morgan-ai' 
                  ? "Ask Morgan about your portfolio..." 
                  : "Type a message..."
              }
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="resize-none"
            />
          </div>
          
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isTyping}
            size="sm"
            className="px-3"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        
        {conversationId === 'morgan-ai' && (
          <p className="text-xs text-gray-500 mt-2">
            Morgan AI can help with portfolio analysis, loan insights, and data questions.
          </p>
        )}
      </div>
    </div>
  );
}