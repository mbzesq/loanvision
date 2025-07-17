import { useEffect, useRef } from 'react';
import { useInternalChat } from '../../contexts/InternalChatContext';
import { ChatMessageInput } from './ChatMessageInput';
import { ChatMessageList } from './ChatMessageList';
import { ChatTypingIndicator } from './ChatTypingIndicator';
import { ArrowLeft, Hash, Users, MessageSquare, Lock } from 'lucide-react';
import { Button } from '../ui/button';
import { ChatRoomType } from '../../types/chat';

export function ChatMessageArea() {
  const { state, selectRoom } = useInternalChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedRoom = state.selectedRoomId 
    ? (state.rooms || []).find(room => room.id === state.selectedRoomId)
    : null;

  const messages = state.selectedRoomId 
    ? state.messages[state.selectedRoomId] || []
    : [];

  const typingUsers = state.selectedRoomId 
    ? state.typingUsers[state.selectedRoomId] || []
    : [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const getRoomIcon = (type: ChatRoomType, isPrivate: boolean) => {
    if (isPrivate) return <Lock className="h-4 w-4" />;
    
    switch (type) {
      case 'general':
        return <Hash className="h-4 w-4" />;
      case 'department':
        return <Users className="h-4 w-4" />;
      case 'direct_message':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Hash className="h-4 w-4" />;
    }
  };

  const getRoomDescription = () => {
    if (!selectedRoom) return '';
    
    if (selectedRoom.type === 'direct_message') {
      return 'Direct message';
    }
    if (selectedRoom.description) {
      return selectedRoom.description;
    }
    switch (selectedRoom.type) {
      case 'general':
        return 'General discussion for the organization';
      case 'department':
        return 'Department-specific conversations';
      case 'project':
        return 'Project-related discussions';
      default:
        return '';
    }
  };

  if (!selectedRoom) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-gray-500">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No room selected</h3>
          <p className="text-sm">Choose a chat room to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Room Header */}
      <div className="flex-shrink-0 p-3 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          {/* Back button - always visible with optional label for direct messages */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => selectRoom(null)}
              className="p-1 h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Back to chat rooms"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {selectedRoom?.type === 'direct_message' && (
              <span 
                className="hidden sm:block text-xs text-gray-500 ml-1 cursor-pointer hover:text-gray-700"
                onClick={() => selectRoom(null)}
              >
                Back
              </span>
            )}
          </div>
          
          {/* Room info */}
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className="text-blue-600">
              {selectedRoom && getRoomIcon(selectedRoom.type, selectedRoom.is_private)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {selectedRoom?.name || 'Unknown Room'}
              </h3>
              <p className="text-xs text-gray-500 truncate">
                {getRoomDescription()}
              </p>
            </div>
          </div>

          {/* Room participants count */}
          {selectedRoom?.participant_count && (
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <Users className="h-3 w-3" />
              <span>{selectedRoom.participant_count}</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto">
          {(!messages || messages.length === 0) ? (
            <div className="h-full flex items-center justify-center p-4">
              <div className="text-center text-gray-500">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <h4 className="text-sm font-medium text-gray-900 mb-1">
                  Start the conversation
                </h4>
                <p className="text-xs">
                  Be the first to send a message in {selectedRoom?.name || 'this room'}
                </p>
              </div>
            </div>
          ) : (
            <ChatMessageList messages={messages || []} currentUser={state.currentUser} />
          )}
          
          {/* Typing Indicator */}
          {typingUsers && typingUsers.length > 0 && (
            <div className="px-4 py-2">
              <ChatTypingIndicator typingUsers={typingUsers} />
            </div>
          )}
          
          {/* Auto-scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white">
          <ChatMessageInput 
            roomId={selectedRoom.id}
            placeholder={`Message ${selectedRoom.name}...`}
          />
        </div>
      </div>
    </div>
  );
}