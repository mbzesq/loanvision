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
import '../styles/premium-saas-design.css';

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
    <div className="premium-app-container">
      {/* Desktop Layout: Sidebar + Content + Chat */}
      <div className="hidden lg:flex lg:h-screen relative">
        {/* Premium Sidebar */}
        <div 
          className="premium-sidebar-container"
          style={{ width: isNavExpanded ? '256px' : '64px' }}
        >
          <div 
            className={`premium-sidebar ${
              isNavExpanded ? 'expanded' : 'collapsed'
            }`}
            onMouseEnter={() => {
              setIsHoveringNav(true);
            }}
            onMouseLeave={() => {
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
        <main className="premium-main-content">
          {/* Premium Header */}
          <header className="premium-header">
            <div className="premium-header-left">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDesktopNavToggle}
                className="premium-menu-toggle"
              >
                <Menu className="h-4 w-4" />
                <span className="text-sm font-medium">Menu</span>
              </Button>
            </div>
            <div className="premium-header-right">
              <InboxNotificationBadge />
              <ChatButtonWithUnread onClick={handleChatToggle} />
              <UserProfile />
            </div>
          </header>
          
          {/* Page Content */}
          <div className="premium-page-wrapper">
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