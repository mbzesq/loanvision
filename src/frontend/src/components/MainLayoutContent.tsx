import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SideNav } from './SideNav';
import { MobileHeader } from './MobileHeader';
import { UserProfile } from './UserProfile';
import { InboxNotificationBadge } from './InboxNotificationBadge';
import { ChatModal } from './chat/ChatModal';
import { ChatButtonWithUnread } from './chat/ChatButtonWithUnread';
import { Sheet, SheetContent } from './ui/sheet';
import { Menu } from 'lucide-react';
import { Button } from './ui/button';
import { FloatingActionButtonRadial } from './FloatingActionButtonRadial';

export function MainLayoutContent() {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDesktopNavCollapsed, setDesktopNavCollapsed] = useState(() => {
    const saved = localStorage.getItem('desktopNavCollapsed');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isHoveringNav, setIsHoveringNav] = useState(false);
  const [isChatOpen, setChatOpen] = useState(false);

  const handleDesktopNavToggle = () => {
    const newState = !isDesktopNavCollapsed;
    setDesktopNavCollapsed(newState);
    localStorage.setItem('desktopNavCollapsed', JSON.stringify(newState));
  };

  const handleChatToggle = () => {
    setChatOpen(!isChatOpen);
  };

  const handleChatClose = () => {
    setChatOpen(false);
  };

  const isNavExpanded = !isDesktopNavCollapsed || isHoveringNav;

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: 'var(--warm-cream-bg)' }}>
      {/* Desktop Layout: Sidebar + Content + Chat */}
      <div className="hidden lg:flex lg:h-screen relative">
        {/* Fixed Sidebar - Always takes minimum space but expands on hover */}
        <div 
          className="flex-shrink-0 relative z-10"
          style={{ width: isNavExpanded ? '256px' : '64px' }}
        >
          <div 
            className={`absolute top-0 left-0 h-full transition-all duration-300 ease-in-out ${
              isNavExpanded ? 'w-64' : 'w-16'
            } shadow-lg`} 
            style={{ 
              backgroundColor: 'var(--warm-cream-tertiary)', 
              borderRight: '1px solid var(--warm-cream-border)' 
            }}
            onMouseEnter={() => {
              console.log('Mouse entered nav area');
              setIsHoveringNav(true);
            }}
            onMouseLeave={() => {
              console.log('Mouse left nav area');
              setIsHoveringNav(false);
            }}
          >
            <SideNav 
              isCollapsed={!isNavExpanded}
              onToggleCollapse={handleDesktopNavToggle}
            />
          </div>
        </div>
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto flex flex-col">
          {/* Header */}
          <header className="h-16 px-6 flex items-center justify-between" style={{ 
            backgroundColor: 'var(--warm-cream-secondary)', 
            borderBottom: '1px solid var(--warm-cream-border)' 
          }}>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDesktopNavToggle}
                className="flex items-center gap-2"
                style={{ color: 'var(--warm-text-secondary)' }}
              >
                <Menu className="h-4 w-4" />
                <span className="text-sm font-medium">Menu</span>
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <InboxNotificationBadge />
              <ChatButtonWithUnread onClick={handleChatToggle} />
              <UserProfile />
            </div>
          </header>
          
          {/* Page Content */}
          <div className="flex-1 overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        {/* Mobile Header and Menu Trigger */}
        <MobileHeader 
          onMenuClick={() => setMobileMenuOpen(true)}
          onChatClick={handleChatToggle}
        />

        {/* Mobile Slide-out Menu */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-64" style={{ backgroundColor: 'var(--warm-cream-tertiary)' }}>
            <SideNav onLinkClick={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main Page Content for Mobile */}
        <main className="overflow-y-auto" style={{ backgroundColor: 'var(--warm-cream-bg)' }}>
          <Outlet />
        </main>
      </div>

      {/* Chat Modal */}
      <ChatModal 
        isOpen={isChatOpen}
        onClose={handleChatClose}
      />
      
      {/* Floating Action Button - Persistent across all pages */}
      <FloatingActionButtonRadial />
    </div>
  );
}