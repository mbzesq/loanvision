import { useInternalChat } from '../../contexts/InternalChatContext';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Hash, 
  Users, 
  MessageSquare, 
  Lock, 
  ArrowLeft,
  Circle
} from 'lucide-react';
import { ChatRoom, ChatRoomType } from '../../types/chat';
import { formatDistanceToNow } from 'date-fns';

export function ChatRoomList() {
  const { state, selectRoom } = useInternalChat();

  const getRoomIcon = (type: ChatRoomType, isPrivate: boolean) => {
    if (isPrivate) return <Lock className="h-4 w-4" />;
    
    switch (type) {
      case 'general':
        return <Hash className="h-4 w-4" />;
      case 'department':
        return <Users className="h-4 w-4" />;
      case 'direct_message':
        return <MessageSquare className="h-4 w-4" />;
      case 'project':
        return <Circle className="h-4 w-4" />;
      default:
        return <Hash className="h-4 w-4" />;
    }
  };

  const getRoomDescription = (room: ChatRoom) => {
    if (room.type === 'direct_message') {
      return 'Direct message';
    }
    if (room.description) {
      return room.description;
    }
    switch (room.type) {
      case 'general':
        return 'General discussion';
      case 'department':
        return 'Department chat';
      case 'project':
        return 'Project discussion';
      default:
        return '';
    }
  };

  const formatLastMessage = (room: ChatRoom) => {
    if (!room.last_message) return '';
    
    const { last_message } = room;
    const userName = last_message.user?.first_name || 'Someone';
    const timeAgo = formatDistanceToNow(new Date(last_message.created_at), { addSuffix: true });
    
    let content = last_message.content;
    if (content.length > 30) {
      content = content.substring(0, 30) + '...';
    }
    
    return `${userName}: ${content} • ${timeAgo}`;
  };

  // Show back button if a room is selected
  if (state.selectedRoomId) {
    const selectedRoom = (state.rooms || []).find(room => room.id === state.selectedRoomId);
    
    return (
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => selectRoom(null)}
            className="p-1 h-8 w-8 text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className="text-blue-600">
              {selectedRoom && getRoomIcon(selectedRoom.type, selectedRoom.is_private)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {selectedRoom?.name || 'Unknown Room'}
              </h3>
              {selectedRoom && (
                <p className="text-xs text-gray-500 truncate">
                  {getRoomDescription(selectedRoom)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show room list
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Section Header */}
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700">Chat Rooms</h3>
      </div>

      {/* Room List */}
      <div className="divide-y divide-gray-100">
        {(!state.rooms || state.rooms.length === 0) ? (
          <div className="p-4 text-center text-gray-500">
            <Hash className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No chat rooms available</p>
            <p className="text-xs text-gray-400 mt-1">
              Rooms will appear here when they're created
            </p>
          </div>
        ) : (
          (state.rooms || []).map((room) => {
            const unreadCount = state.unreadCounts[room.id] || 0;
            
            return (
              <button
                key={room.id}
                onClick={() => selectRoom(room.id)}
                className="w-full p-3 text-left hover:bg-gray-50 transition-colors focus:outline-none focus:bg-blue-50"
              >
                <div className="flex items-start space-x-3">
                  {/* Room Icon */}
                  <div className="flex-shrink-0 mt-0.5 text-gray-500">
                    {getRoomIcon(room.type, room.is_private)}
                  </div>
                  
                  {/* Room Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {room.name}
                      </h4>
                      {unreadCount > 0 && (
                        <Badge 
                          variant="secondary" 
                          className="bg-blue-600 text-white text-xs px-1.5 py-0.5 ml-2"
                        >
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Last Message or Description */}
                    <p className="text-xs text-gray-500 truncate">
                      {room.last_message ? formatLastMessage(room) : getRoomDescription(room)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}