import { useState, useEffect, useRef } from 'react';
import { Send, Brain, AlertCircle, BarChart3, Clock, Zap, Loader2, Trash2, History } from 'lucide-react';
import { Button } from '../ui/button';
import { aiAssistantApi, AIMessage, AIConversation, RateLimitStatus } from '../../services/aiAssistantApi';

export function MorganAIContainer() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus | null>(null);
  const [showConversations, setShowConversations] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [conversationsData, rateLimitData] = await Promise.all([
        aiAssistantApi.getConversations(),
        aiAssistantApi.getRateLimitStatus()
      ]);
      
      setConversations(conversationsData);
      setRateLimitStatus(rateLimitData);
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load AI assistant data');
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    try {
      const messagesData = await aiAssistantApi.getConversationMessages(conversationId);
      setMessages(messagesData);
      setSelectedConversationId(conversationId);
      setShowConversations(false);
    } catch (err) {
      console.error('Failed to load conversation messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversation messages');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    setError(null);

    // Add user message to UI immediately
    const tempUserMessage: AIMessage = {
      id: `temp-${Date.now()}`,
      type: 'user',
      content: userMessage,
      tokenCount: 0,
      createdAt: new Date()
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const response = await aiAssistantApi.sendQuery({
        query: userMessage,
        conversationId: selectedConversationId || undefined,
        includeContext: true,
        maxResults: 10 // Reduced from 100 - most queries don't need many individual loans
      });

      // Update rate limit status
      setRateLimitStatus(prevStatus => ({
        ...prevStatus!,
        ...response.rateLimitStatus
      }));

      // Update conversation ID if it's a new conversation
      if (!selectedConversationId) {
        setSelectedConversationId(response.conversationId);
      }

      // Replace temp message with real user message and add assistant response
      const userMessageReal: AIMessage = {
        id: `user-${response.messageId}`,
        type: 'user',
        content: userMessage,
        tokenCount: response.tokenUsage.promptTokens,
        createdAt: new Date()
      };

      const assistantMessage: AIMessage = {
        id: response.messageId,
        type: 'assistant',
        content: response.response,
        tokenCount: response.tokenUsage.completionTokens,
        createdAt: new Date()
      };

      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== tempUserMessage.id);
        return [...filtered, userMessageReal, assistantMessage];
      });

      // Refresh conversations list
      loadInitialData();

    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      
      // Remove temp message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    setSelectedConversationId(null);
    setShowConversations(false);
    setError(null);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await aiAssistantApi.deleteConversation(conversationId);
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      if (selectedConversationId === conversationId) {
        handleNewConversation();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete conversation');
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  const formatResetTime = (resetTime: Date) => {
    const now = new Date();
    const diff = resetTime.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return 'Soon';
    }
  };

  // Loading state
  if (!rateLimitStatus) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading Morgan AI Assistant...</p>
        </div>
      </div>
    );
  }

  // Show conversations list
  if (showConversations) {
    return (
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <History className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Conversation History</h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConversations(false)}
            >
              Back to Chat
            </Button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-4">
          {conversations.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No conversations yet</p>
              <p className="text-sm text-gray-400">Start a conversation with Morgan to see it here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {conversations.map(conversation => (
                <div
                  key={conversation.id}
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => loadConversationMessages(conversation.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {conversation.title}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {conversation.messageCount} messages • {formatTime(conversation.updatedAt)}
                      </p>
                      {conversation.lastMessage && (
                        <p className="text-xs text-gray-400 mt-1 truncate">
                          {conversation.lastMessage}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conversation.id);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main chat interface
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Brain className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Morgan</h3>
              <p className="text-sm text-gray-600">AI Portfolio Assistant</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConversations(true)}
            >
              <History className="h-4 w-4 mr-2" />
              History
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewConversation}
            >
              New Chat
            </Button>
          </div>
        </div>

        {/* Rate Limit Status */}
        <div className="mt-3 flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1">
            <BarChart3 className="h-3 w-3 text-blue-600" />
            <span className="text-gray-600">
              {rateLimitStatus.queriesRemaining} queries left
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <Zap className="h-3 w-3 text-purple-600" />
            <span className="text-gray-600">
              {rateLimitStatus.tokensRemaining.toLocaleString()} tokens left
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="h-3 w-3 text-green-600" />
            <span className="text-gray-600">
              Resets in {formatResetTime(rateLimitStatus.resetTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Hello! I'm Morgan</h3>
            <p className="text-gray-600 mb-4">Your AI assistant for mortgage portfolio analysis.</p>
            <div className="max-w-md mx-auto">
              <p className="text-sm text-gray-500 mb-4">Ask me questions like:</p>
              <div className="space-y-2 text-sm text-gray-400">
                <div className="p-2 bg-gray-50 rounded">• "What's the average credit score?"</div>
                <div className="p-2 bg-gray-50 rounded">• "Show me loans in California"</div>
                <div className="p-2 bg-gray-50 rounded">• "How many loans are delinquent?"</div>
              </div>
            </div>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                <div className="text-xs mt-1 opacity-70">
                  {formatTime(message.createdAt)}
                  {message.tokenCount > 0 && (
                    <span className="ml-2">• {message.tokenCount} tokens</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-2 border-t border-red-200 bg-red-50">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 ml-auto"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={rateLimitStatus.isBlocked ? "Rate limit exceeded" : "Ask Morgan about your loan portfolio..."}
            disabled={isLoading || rateLimitStatus.isBlocked}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <Button 
            type="submit" 
            disabled={isLoading || !input.trim() || rateLimitStatus.isBlocked}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        
        {rateLimitStatus.isBlocked && (
          <p className="text-xs text-red-600 mt-2">
            {rateLimitStatus.blockedReason} - Resets in {formatResetTime(rateLimitStatus.resetTime)}
          </p>
        )}
      </div>
    </div>
  );
}