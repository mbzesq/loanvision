// src/frontend/src/components/MainLayout.tsx
import { Outlet } from 'react-router-dom';
import { SideNav } from './SideNav';

export function MainLayout() {
  return (
    <div className="flex h-screen bg-slate-50">
      <SideNav />
      <main className="flex-1 overflow-y-auto">
        <Outlet /> {/* Child routes will be rendered here */}
      </main>
    </div>
  );
}