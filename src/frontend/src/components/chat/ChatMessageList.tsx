import { ChatMessage, ChatUser } from '../../types/chat';
import { isToday, isYesterday, format } from 'date-fns';
import { Avatar } from './Avatar';

interface ChatMessageListProps {
  messages: ChatMessage[];
  currentUser: ChatUser | null;
}

export function ChatMessageList({ messages = [], currentUser }: ChatMessageListProps) {
  const formatMessageTime = (date: Date) => {
    if (isToday(date)) {
      return format(date, 'h:mm a');
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, h:mm a');
    }
  };

  const shouldGroupMessage = (message: ChatMessage, previousMessage: ChatMessage | null) => {
    if (!previousMessage) return false;
    
    // Same user and within 5 minutes
    const timeDiff = new Date(message.created_at).getTime() - new Date(previousMessage.created_at).getTime();
    return message.user_id === previousMessage.user_id && timeDiff < 5 * 60 * 1000;
  };

  return (
    <div className="p-4 space-y-4">
      {(messages || []).map((message, index) => {
        const previousMessage = index > 0 ? messages[index - 1] : null;
        const isGrouped = shouldGroupMessage(message, previousMessage);
        const isOwnMessage = currentUser?.id === message.user_id;
        const userName = message.user ? `${message.user.first_name} ${message.user.last_name}` : 'Unknown User';

        return (
          <div
            key={message.id}
            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-1' : 'mt-4'}`}
          >
            <div className={`flex ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2 max-w-xs lg:max-w-md`}>
              {/* Avatar - only show if not grouped and not own message */}
              {!isGrouped && !isOwnMessage && (
                <div className="flex-shrink-0">
                  <Avatar 
                    user={message.user}
                    size="sm"
                  />
                </div>
              )}
              
              {/* Spacer for grouped messages */}
              {isGrouped && !isOwnMessage && (
                <div className="w-8 flex-shrink-0" />
              )}

              {/* Message Content */}
              <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                {/* User name and time - only show if not grouped */}
                {!isGrouped && (
                  <div className={`flex items-center space-x-2 mb-1 ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <span className="text-xs font-medium text-gray-900">
                      {isOwnMessage ? 'You' : userName}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatMessageTime(new Date(message.created_at))}
                    </span>
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`
                    px-3 py-2 rounded-lg max-w-full break-words
                    ${isOwnMessage
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                    }
                    ${message.isSending ? 'opacity-70' : ''}
                  `}
                >
                  {/* System messages */}
                  {message.message_type === 'system' ? (
                    <div className="text-xs text-gray-500 italic">
                      {message.content}
                    </div>
                  ) : (
                    /* Regular text messages */
                    <div className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </div>
                  )}

                  {/* File attachments */}
                  {message.file_url && (
                    <div className="mt-2 pt-2 border-t border-opacity-20 border-current">
                      <a
                        href={message.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline hover:no-underline"
                      >
                        📎 {message.file_name || 'Attachment'}
                      </a>
                    </div>
                  )}

                  {/* Thread replies indicator */}
                  {(() => {
                    if (message.thread_count && message.thread_count > 0) {
                      return (
                        <div className="mt-2 pt-2 border-t border-opacity-20 border-current">
                          <button className="text-xs underline hover:no-underline">
                            {message.thread_count} {message.thread_count === 1 ? 'reply' : 'replies'}
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Message reactions */}
                {(() => {
                  if (message.reactions && message.reactions.length > 0) {
                    console.log('Message has reactions:', message.id, message.reactions);
                    return (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {message.reactions.map((reaction, reactionIndex) => (
                          <button
                            key={reactionIndex}
                            className="bg-gray-100 hover:bg-gray-200 rounded-full px-2 py-1 text-xs flex items-center space-x-1 transition-colors"
                          >
                            <span>{reaction.emoji}</span>
                            <span className="text-gray-600">1</span>
                          </button>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Grouped message time - show only time for grouped messages */}
                {isGrouped && (
                  <div className="text-xs text-gray-500 mt-1">
                    {format(new Date(message.created_at), 'h:mm a')}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}