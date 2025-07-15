import { TypingIndicator } from '../../types/chat';

interface ChatTypingIndicatorProps {
  typingUsers: TypingIndicator[];
}

export function ChatTypingIndicator({ typingUsers }: ChatTypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].user_email.split('@')[0]} is typing...`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].user_email.split('@')[0]} and ${typingUsers[1].user_email.split('@')[0]} are typing...`;
    } else {
      return `${typingUsers.length} people are typing...`;
    }
  };

  return (
    <div className="flex items-center space-x-2 text-gray-500">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
      </div>
      <span className="text-xs">{getTypingText()}</span>
    </div>
  );
}