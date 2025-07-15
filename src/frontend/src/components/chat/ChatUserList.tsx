import { useState } from 'react';
import { useInternalChat } from '../../contexts/InternalChatContext';
import { Avatar } from './Avatar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, MessageSquare } from 'lucide-react';
import { ChatUser } from '../../types/chat';

export function ChatUserList() {
  const { state, startDirectMessage } = useInternalChat();
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredUsers = state.users
    .filter(user => user.id !== state.currentUser?.id) // Exclude current user
    .filter(user => {
      if (!searchTerm) return true;
      const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
      const email = user.email.toLowerCase();
      const search = searchTerm.toLowerCase();
      return fullName.includes(search) || email.includes(search);
    })
    .sort((a, b) => {
      // Sort by online status first, then by name
      const aOnline = a.presence_status === 'online';
      const bOnline = b.presence_status === 'online';
      
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
      
      return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
    });

  const displayUsers = isExpanded ? filteredUsers : filteredUsers.slice(0, 5);
  const onlineCount = state.users.filter(user => user.presence_status === 'online').length;

  const handleStartDM = async (user: ChatUser) => {
    try {
      await startDirectMessage(user.id);
    } catch (error) {
      console.error('Failed to start direct message:', error);
    }
  };

  return (
    <div className="border-t border-gray-200 bg-gray-50">
      {/* Header */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Team Members</h3>
          <span className="text-xs text-green-600">
            {onlineCount} online
          </span>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
          <Input
            type="text"
            placeholder="Search team..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-7 text-xs h-7 bg-white"
          />
        </div>
      </div>

      {/* User List */}
      <div className="max-h-48 overflow-y-auto">
        {displayUsers.length === 0 ? (
          <div className="p-3 text-center text-gray-500">
            <p className="text-xs">
              {searchTerm ? 'No users found' : 'No team members available'}
            </p>
          </div>
        ) : (
          <>
            {displayUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => handleStartDM(user)}
                className="w-full p-2 flex items-center space-x-2 hover:bg-gray-100 transition-colors text-left"
              >
                <Avatar 
                  user={user} 
                  size="sm" 
                  showOnlineStatus={true}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user.job_title || user.email}
                  </p>
                </div>
                <MessageSquare className="h-3 w-3 text-gray-400" />
              </button>
            ))}
            
            {/* Show more/less button */}
            {filteredUsers.length > 5 && (
              <div className="p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-full text-xs text-gray-600 hover:text-gray-900"
                >
                  {isExpanded 
                    ? 'Show less' 
                    : `Show ${filteredUsers.length - 5} more`
                  }
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}