// src/frontend/src/components/MainLayout.tsx
import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { SideNav } from './SideNav';
import { MobileHeader } from './MobileHeader';
import { UserProfile } from './UserProfile';
import { Sheet, SheetContent } from './ui/sheet';
import { Menu } from 'lucide-react';
import { Button } from './ui/button';

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

  const handleDesktopNavToggle = () => {
    const newState = !isDesktopNavCollapsed;
    setDesktopNavCollapsed(newState);
    localStorage.setItem('desktopNavCollapsed', JSON.stringify(newState));
  };

  const isNavExpanded = !isDesktopNavCollapsed || isHoveringNav;

  return (
    <div className="min-h-screen w-full bg-slate-50">
      {/* Desktop Layout: Sidebar + Content */}
      <div className="hidden lg:flex lg:h-screen">
        {/* Fixed Sidebar */}
        <div 
          className={`flex-shrink-0 transition-all duration-300 ease-in-out ${
            isNavExpanded ? 'w-64' : 'w-16'
          }`}
          onMouseEnter={() => setIsHoveringNav(true)}
          onMouseLeave={() => setIsHoveringNav(false)}
        >
          <SideNav 
            isCollapsed={!isNavExpanded}
            onToggleCollapse={handleDesktopNavToggle}
          />
        </div>
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto flex flex-col">
          {/* Header */}
          <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDesktopNavToggle}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
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
          <SheetContent side="left" className="p-0 w-64">
            <SideNav onLinkClick={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main Page Content for Mobile */}
        <main className="overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}