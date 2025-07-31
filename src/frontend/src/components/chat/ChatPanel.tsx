import { useState, useEffect } from 'react';
import { X, MessageCircle, Minimize2, Maximize2, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ConversationList } from './ConversationList';
import { MessageThread } from './MessageThread';
import { ChatErrorBoundary } from './ChatErrorBoundary';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function ChatPanel({ isOpen, onClose, className = '' }: ChatPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedConversationType, setSelectedConversationType] = useState<'ai' | 'user' | 'channel' | null>(null);

  // Handle keyboard shortcut (Cmd/Ctrl + Y)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'y') {
        event.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // This would be handled by parent component to open
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleMinimized = () => {
    setIsMinimized(!isMinimized);
  };

  const handleConversationSelect = (id: string, type: 'ai' | 'user' | 'channel') => {
    setSelectedConversationId(id);
    setSelectedConversationType(type);
  };

  const handleBackToList = () => {
    setSelectedConversationId(null);
    setSelectedConversationType(null);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity lg:hidden z-40"
          onClick={onClose}
        />
      )}
      
      {/* Chat Panel - positioned below header */}
      <div 
        className={`
          fixed right-0 top-16 bottom-0
          bg-white shadow-xl transition-all duration-300 ease-in-out
          w-full max-w-sm
          lg:w-[400px] lg:max-w-[400px]
          ${isMinimized ? 'h-16 bottom-auto' : ''}
          flex flex-col
          rounded-tl-xl overflow-hidden
          z-40
          ${className}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <ChatErrorBoundary>
          {/* Panel Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 shrink-0">
            <div className="flex items-center space-x-3">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedConversationId ? (
                  selectedConversationType === 'ai' ? 'Morgan AI' :
                  selectedConversationType === 'channel' ? `#${selectedConversationId}` :
                  'Direct Message'
                ) : 'Messages'}
              </h2>
            </div>
            
            <div className="flex items-center space-x-1">
              {!isMinimized && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleMinimized}
                  className="h-8 w-8 p-0"
                  title="Minimize"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              )}
              
              {isMinimized && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleMinimized}
                  className="h-8 w-8 p-0"
                  title="Expand"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 lg:hidden"
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Panel Content */}
          {!isMinimized && (
            <div className="flex-1 flex flex-col min-h-0">
              {selectedConversationId ? (
                // Message Thread View
                <MessageThread
                  conversationId={selectedConversationId}
                  conversationType={selectedConversationType!}
                  onBack={handleBackToList}
                />
              ) : (
                // Conversation List View
                <>
                  {/* Search Bar */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4"
                      />
                    </div>
                  </div>

                  {/* Conversation List */}
                  <div className="flex-1 overflow-hidden">
                    <ConversationList
                      searchQuery={searchQuery}
                      onConversationSelect={handleConversationSelect}
                      selectedConversationId={selectedConversationId}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </ChatErrorBoundary>
      </div>
    </>
  );
}