import { useInternalChat } from '../../contexts/InternalChatContext';
import { ChatRoomList } from './ChatRoomList';
import { ChatMessageArea } from './ChatMessageArea';
import { ChatUserList } from './ChatUserList';
import { UserStatusSelector } from './UserStatusSelector';
import { Avatar } from './Avatar';
import { Building2, AlertCircle } from 'lucide-react';

export function InternalChatContainer() {
  const { state, updateCurrentUserStatus } = useInternalChat();

  // Loading state
  if (state.isLoading && (!state.rooms || state.rooms.length === 0)) {
    return (
      <div className="h-full flex flex-col">
        {/* Header with internal chat branding */}
        <div className="p-3 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center space-x-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Internal Communications</span>
          </div>
          <p className="text-xs text-blue-700 mt-1">
            🔒 Secure organization-only conversations
          </p>
        </div>

        {/* Loading content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-sm text-gray-500">Loading chat rooms...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-3 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center space-x-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Internal Communications</span>
          </div>
        </div>

        {/* Error content */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">Connection Error</h3>
            <p className="text-xs text-gray-500 mb-3">{state.error}</p>
            <button 
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={() => window.location.reload()}
            >
              Refresh to retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main chat interface
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header with internal chat branding */}
      <div className="p-3 bg-blue-50 border-b border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Internal Communications</span>
          </div>
          
          {/* Current user status */}
          {state.currentUser && (
            <div className="flex items-center space-x-2">
              <Avatar 
                user={state.currentUser} 
                size="xs" 
                showOnlineStatus={true}
              />
              <div className="min-w-0">
                <UserStatusSelector 
                  currentStatus={state.currentUser.presence_status}
                  onStatusChange={updateCurrentUserStatus}
                  className="w-20"
                />
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-blue-700 mt-1">
          🔒 Secure conversations within your organization
        </p>
      </div>

      {/* Chat content area */}
      <div className="flex-1 flex flex-col min-h-0">
        {!state.selectedRoomId ? (
          // No room selected - show room list and users
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <ChatRoomList />
            </div>
            <div className="border-t border-gray-200">
              <ChatUserList />
            </div>
          </div>
        ) : (
          // Room selected - show message area
          <div className="flex-1 flex flex-col min-h-0">
            <ChatMessageArea />
          </div>
        )}
      </div>
    </div>
  );
}