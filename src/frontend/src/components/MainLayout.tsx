// src/frontend/src/components/MainLayout.tsx
import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { SideNav } from './SideNav';
import { MobileHeader } from './MobileHeader';
import { UserProfile } from './UserProfile';
import { Sheet, SheetContent } from './ui/sheet';
import { Menu } from 'lucide-react';
import { Button } from './ui/button';
import '../styles/financial-design-system.css';

export function MainLayout() {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDesktopNavCollapsed, setDesktopNavCollapsed] = useState(true);
  const [isHoveringNav, setIsHoveringNav] = useState(false);

  // Auto-collapse on desktop, save preference
  useEffect(() => {
    const saved = localStorage.getItem('desktopNavCollapsed');
    if (saved !== null) {
      setDesktopNavCollapsed(JSON.parse(saved));
    }
  }, []);

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

  const isNavExpanded = !isDesktopNavCollapsed || isHoveringNav;

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Desktop Layout: Sidebar + Content */}
      <div className="hidden lg:flex lg:h-screen relative">
        {/* Fixed Sidebar - Always takes minimum space but expands on top */}
        <div 
          className="flex-shrink-0 w-16 relative z-10"
          onMouseEnter={() => setIsHoveringNav(true)}
          onMouseLeave={() => setIsHoveringNav(false)}
        >
          <div className={`absolute top-0 left-0 h-full transition-all duration-300 ease-in-out ${
            isNavExpanded ? 'w-64' : 'w-16'
          } shadow-lg`} style={{ 
            backgroundColor: 'var(--color-sidebar)', 
            borderRight: '1px solid var(--color-border)' 
          }}>
            <SideNav 
              isCollapsed={!isNavExpanded}
              onToggleCollapse={handleDesktopNavToggle}
            />
          </div>
        </div>
        
        {/* Main Content Area - Fixed width, doesn't move */}
        <main className="flex-1 overflow-y-auto flex flex-col">
          {/* Header */}
          <header className="h-16 px-6 flex items-center justify-between" style={{ 
            backgroundColor: 'var(--color-surface)', 
            borderBottom: '1px solid var(--color-border)' 
          }}>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDesktopNavToggle}
                className="flex items-center gap-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <Menu className="h-4 w-4" />
                <span className="text-sm font-medium">Menu</span>
              </Button>
            </div>
            <UserProfile />
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
        <MobileHeader onMenuClick={() => setMobileMenuOpen(true)} />

        {/* Mobile Slide-out Menu */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-64" style={{ backgroundColor: 'var(--color-sidebar)' }}>
            <SideNav onLinkClick={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main Page Content for Mobile */}
        <main className="overflow-y-auto" style={{ backgroundColor: 'var(--color-background)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}