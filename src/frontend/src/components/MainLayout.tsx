// src/frontend/src/components/MainLayout.tsx
import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { SideNav } from './SideNav';
import { MobileHeader } from './MobileHeader';
import { UserProfile } from './UserProfile';
import { InboxNotificationBadge } from './InboxNotificationBadge';
import { ChatSidebar } from './chat/ChatSidebar';
import { InternalChatProvider } from '../contexts/InternalChatContext';
import { useAuth } from '../contexts/AuthContext';
import { Sheet, SheetContent } from './ui/sheet';
import { Menu } from 'lucide-react';
import { Button } from './ui/button';
import '../styles/financial-design-system.css';

export function MainLayout() {
  const { user, token } = useAuth();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDesktopNavCollapsed, setDesktopNavCollapsed] = useState(() => {
    // Start collapsed by default, but check localStorage
    const saved = localStorage.getItem('desktopNavCollapsed');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isHoveringNav, setIsHoveringNav] = useState(false);
  const [isChatOpen, setChatOpen] = useState(() => {
    // Check localStorage for chat sidebar state
    const saved = localStorage.getItem('chatSidebarOpen');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Apply financial theme class to body
  useEffect(() => {
    document.body.classList.add('financial-theme');
    return () => {
      document.body.classList.remove('financial-theme');
    };
  }, []);

  const handleDesktopNavToggle = () => {
    const newState = !isDesktopNavCollapsed;
    setDesktopNavCollapsed(newState);
    localStorage.setItem('desktopNavCollapsed', JSON.stringify(newState));
  };

  const handleChatToggle = () => {
    const newState = !isChatOpen;
    setChatOpen(newState);
    localStorage.setItem('chatSidebarOpen', JSON.stringify(newState));
  };

  const isNavExpanded = !isDesktopNavCollapsed || isHoveringNav;

  // Convert user to ChatUser format
  const chatUser = user ? {
    id: user.id,
    first_name: user.firstName || '',
    last_name: user.lastName || '',
    email: user.email,
    profile_image_url: user.profileImageUrl,
    job_title: user.jobTitle,
    department: user.department,
  } : null;

  return (
    <InternalChatProvider token={token} currentUser={chatUser}>
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
          
          {/* Main Content Area - Adjusts width based on chat sidebar */}
          <main 
            className="flex-1 overflow-y-auto flex flex-col transition-all duration-300 ease-in-out"
            style={{ 
              marginRight: isChatOpen ? '320px' : '48px' // Account for chat sidebar
            }}
          >
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
                <UserProfile />
              </div>
            </header>
            
            {/* Page Content */}
            <div className="flex-1 overflow-y-auto">
              <Outlet />
            </div>
          </main>

          {/* Chat Sidebar */}
          <ChatSidebar 
            isOpen={isChatOpen}
            onToggle={handleChatToggle}
          />
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden">
          {/* Mobile Header and Menu Trigger */}
          <MobileHeader onMenuClick={() => setMobileMenuOpen(true)} />

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

          {/* Mobile Chat Sidebar */}
          <ChatSidebar 
            isOpen={isChatOpen}
            onToggle={handleChatToggle}
          />
        </div>
      </div>
    </InternalChatProvider>
  );
}