// src/frontend/src/components/MobileHeader.tsx
import { Button } from './ui/button';
import { Menu } from 'lucide-react';
import { UserProfile } from './UserProfile';
import { InboxNotificationBadge } from './InboxNotificationBadge';
import { ChatButton } from './chat/ChatButton';
import { Logo } from './Logo';

interface MobileHeaderProps {
  onMenuClick: () => void;
  onChatClick: () => void;
}

export function MobileHeader({ onMenuClick, onChatClick }: MobileHeaderProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b px-4 lg:hidden" style={{ backgroundColor: '#f5f1ec' }}>
      <Button
        variant="outline"
        size="icon"
        className="shrink-0"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle navigation menu</span>
      </Button>
      <Logo className="h-8 w-auto text-slate-800 flex-1" />
      <div className="flex items-center gap-2">
        <InboxNotificationBadge />
        <ChatButton onClick={onChatClick} unreadCount={3} />
        <UserProfile />
      </div>
    </header>
  );
}