import { useMemo } from 'react';
import { useInternalChat } from '../../contexts/InternalChatContext';
import { ChatButton } from './ChatButton';

interface ChatButtonWithUnreadProps {
  onClick: () => void;
}

export function ChatButtonWithUnread({ onClick }: ChatButtonWithUnreadProps) {
  const { state } = useInternalChat();
  
  // Calculate total unread count across all rooms
  const totalUnreadCount = useMemo(() => {
    return Object.values(state.unreadCounts || {}).reduce((sum, count) => sum + count, 0);
  }, [state.unreadCounts]);
  
  return <ChatButton onClick={onClick} unreadCount={totalUnreadCount} />;
}