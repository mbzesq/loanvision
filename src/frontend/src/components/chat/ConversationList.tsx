import React, { useState, useEffect } from 'react';
import { Bot, User, Hash, Circle, Clock, MessageCircle, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { chatApi } from '../../services/chatApi';
import { ChatRoom, ChatUser } from '../../types/chat';

interface ConversationListProps {
  searchQuery: string;
  onConversationSelect: (id: string, type: 'ai' | 'user' | 'channel') => void;
  selectedConversationId: string | null;
}

interface ConversationItem {
  id: string;
  type: 'ai' | 'user' | 'channel';
  name: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
  isOnline?: boolean;
  avatarUrl?: string;
}

export function ConversationList({ 
  searchQuery, 
  onConversationSelect, 
  selectedConversationId 
}: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [channels, setChannels] = useState<ChatRoom[]>([]);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      
      // Load users and rooms in parallel
      const [usersResponse, roomsResponse] = await Promise.all([
        chatApi.getUsers(),
        chatApi.getRooms()
      ]);

      setUsers(usersResponse.users);
      setChannels(roomsResponse.rooms);

      // Create unified conversation list
      const conversationItems: ConversationItem[] = [];

      // Add Morgan AI as first item
      conversationItems.push({
        id: 'morgan-ai',
        type: 'ai',
        name: 'Morgan AI',
        lastMessage: 'I\'m here to help with your portfolio analysis and questions!',
        lastMessageTime: new Date(),
        unreadCount: 0,
        isOnline: true
      });

      // Add direct message conversations (users)
      usersResponse.users.forEach(user => {
        conversationItems.push({
          id: `user-${user.id}`,
          type: 'user',
          name: `${user.first_name} ${user.last_name}`,
          lastMessage: '', // TODO: Get actual last message
          lastMessageTime: user.last_seen_at ? new Date(user.last_seen_at) : undefined,
          unreadCount: 0, // TODO: Get actual unread count
          isOnline: user.presence_status === 'online',
          avatarUrl: user.profile_image_url
        });
      });

      // Add channels
      roomsResponse.rooms
        .filter(room => room.type !== 'direct_message')
        .forEach(room => {
          conversationItems.push({
            id: `channel-${room.id}`,
            type: 'channel',
            name: room.name,
            lastMessage: room.last_message?.content || '',
            lastMessageTime: room.last_message_at ? new Date(room.last_message_at) : room.created_at ? new Date(room.created_at) : undefined,
            unreadCount: room.unread_count || 0,
          });
        });

      setConversations(conversationItems);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = conversations.filter(conv => 
    searchQuery === '' || 
    conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (conv.lastMessage && conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatTime = (date?: Date) => {
    if (!date) return '';
    
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d`;
    }
  };

  const getStatusIcon = (conversation: ConversationItem) => {
    if (conversation.type === 'ai') {
      return <Circle className="w-2 h-2 fill-green-500 text-green-500" />;
    } else if (conversation.type === 'user') {
      return (
        <Circle 
          className={`w-2 h-2 ${
            conversation.isOnline 
              ? 'fill-green-500 text-green-500' 
              : 'fill-gray-400 text-gray-400'
          }`} 
        />
      );
    }
    return null;
  };

  const getConversationIcon = (conversation: ConversationItem) => {
    if (conversation.type === 'ai') {
      return <Bot className="w-5 h-5 text-blue-600" />;
    } else if (conversation.type === 'channel') {
      return <Hash className="w-5 h-5 text-gray-600" />;
    } else {
      return conversation.avatarUrl ? (
        <img 
          src={conversation.avatarUrl} 
          alt={conversation.name}
          className="w-8 h-8 rounded-full object-cover"
        />
      ) : (
        <User className="w-5 h-5 text-gray-600" />
      );
    }
  };

  // Group conversations
  const aiConversations = filteredConversations.filter(c => c.type === 'ai');
  const userConversations = filteredConversations.filter(c => c.type === 'user');
  const channelConversations = filteredConversations.filter(c => c.type === 'channel');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Direct Messages Section */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Direct Messages
          </h3>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* AI Assistant */}
        {aiConversations.map(conversation => (
          <div
            key={conversation.id}
            onClick={() => onConversationSelect(conversation.id, conversation.type)}
            className={`
              flex items-start space-x-3 p-3 rounded-lg cursor-pointer transition-colors
              ${selectedConversationId === conversation.id 
                ? 'bg-blue-50 border border-blue-200' 
                : 'hover:bg-gray-50'
              }
            `}
          >
            <div className="relative">
              {getConversationIcon(conversation)}
              {conversation.type === 'ai' && (
                <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 bg-blue-100 text-blue-700 text-xs">
                  AI
                </Badge>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {conversation.name}
                </h4>
                <div className="flex items-center space-x-1 ml-2">
                  {getStatusIcon(conversation)}
                  {conversation.lastMessageTime && (
                    <span className="text-xs text-gray-500">
                      {formatTime(conversation.lastMessageTime)}
                    </span>
                  )}
                </div>
              </div>
              
              {conversation.lastMessage && (
                <p className="text-xs text-gray-600 truncate mt-1">
                  {conversation.lastMessage}
                </p>
              )}
            </div>
            
            {conversation.unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {conversation.unreadCount}
              </Badge>
            )}
          </div>
        ))}

        {/* Team Members */}
        {userConversations.map(conversation => (
          <div
            key={conversation.id}
            onClick={() => onConversationSelect(conversation.id, conversation.type)}
            className={`
              flex items-start space-x-3 p-3 rounded-lg cursor-pointer transition-colors
              ${selectedConversationId === conversation.id 
                ? 'bg-blue-50 border border-blue-200' 
                : 'hover:bg-gray-50'
              }
            `}
          >
            <div className="relative">
              {getConversationIcon(conversation)}
              <div className="absolute -bottom-0.5 -right-0.5">
                {getStatusIcon(conversation)}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {conversation.name}
                </h4>
                {conversation.lastMessageTime && (
                  <span className="text-xs text-gray-500 ml-2">
                    {formatTime(conversation.lastMessageTime)}
                  </span>
                )}
              </div>
              
              {conversation.lastMessage && (
                <p className="text-xs text-gray-600 truncate mt-1">
                  {conversation.lastMessage}
                </p>
              )}
            </div>
            
            {conversation.unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {conversation.unreadCount}
              </Badge>
            )}
          </div>
        ))}
      </div>

      {/* Channels Section */}
      {channelConversations.length > 0 && (
        <>
          <Separator />
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Channels
              </h3>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            {channelConversations.map(conversation => (
              <div
                key={conversation.id}
                onClick={() => onConversationSelect(conversation.id, conversation.type)}
                className={`
                  flex items-start space-x-3 p-3 rounded-lg cursor-pointer transition-colors
                  ${selectedConversationId === conversation.id 
                    ? 'bg-blue-50 border border-blue-200' 
                    : 'hover:bg-gray-50'
                  }
                `}
              >
                {getConversationIcon(conversation)}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {conversation.name}
                    </h4>
                    {conversation.lastMessageTime && (
                      <span className="text-xs text-gray-500 ml-2">
                        {formatTime(conversation.lastMessageTime)}
                      </span>
                    )}
                  </div>
                  
                  {conversation.lastMessage && (
                    <p className="text-xs text-gray-600 truncate mt-1">
                      {conversation.lastMessage}
                    </p>
                  )}
                </div>
                
                {conversation.unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {conversation.unreadCount}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {filteredConversations.length === 0 && searchQuery && (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <MessageCircle className="w-12 h-12 mb-4 text-gray-300" />
          <p className="text-sm">No conversations found</p>
          <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  );
}