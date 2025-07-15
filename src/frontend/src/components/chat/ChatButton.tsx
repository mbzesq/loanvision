import { MessageCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface ChatButtonProps {
  onClick: () => void;
  unreadCount?: number;
}

export function ChatButton({ onClick, unreadCount = 0 }: ChatButtonProps) {
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        className="
          flex items-center gap-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50
          transition-colors duration-200
        "
      >
        <MessageCircle className="h-4 w-4" />
        <span className="text-sm font-medium hidden sm:inline">Chat</span>
      </Button>
      
      {/* Unread count badge */}
      {unreadCount > 0 && (
        <Badge 
          variant="secondary" 
          className="
            absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 
            bg-blue-600 text-white text-xs border-2 border-white
          "
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </div>
  );
}