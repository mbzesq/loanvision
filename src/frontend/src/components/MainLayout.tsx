// src/frontend/src/components/MainLayout.tsx
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SideNav } from './SideNav';
import { MobileHeader } from './MobileHeader';
import { Sheet, SheetContent } from '@loanvision/shared/components/ui/sheet';

export function MainLayout() {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50">
      {/* Persistent Sidebar for Desktop */}
      <div className="hidden lg:block">
        <SideNav />
      </div>

      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
          {/* Mobile Header and Menu Trigger */}
        <MobileHeader onMenuClick={() => setMobileMenuOpen(true)} />

          {/* Mobile Slide-out Menu */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-64">
            <SideNav onLinkClick={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main Page Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}