// src/frontend/src/components/MainLayout.tsx
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SideNav } from './SideNav';
import { MobileHeader } from './MobileHeader';
import { UserProfile } from './UserProfile';
import { Sheet, SheetContent } from './ui/sheet';

export function MainLayout() {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-slate-50">
      {/* Desktop Layout: Sidebar + Content */}
      <div className="hidden lg:flex lg:h-screen">
        {/* Fixed Sidebar */}
        <div className="w-64 flex-shrink-0">
          <SideNav />
        </div>
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto flex flex-col">
          {/* Header */}
          <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-end">
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