// src/frontend/src/components/SideNav.tsx
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Table, Upload, Scale } from 'lucide-react';
import { Logo } from './Logo';

const navLinks = [
  { to: '/dashboard', text: 'Dashboard', icon: LayoutDashboard },
  { to: '/loans', text: 'Loan Explorer', icon: Table },
  { to: '/sol-monitoring', text: 'SOL Monitoring', icon: Scale },
  { to: '/upload', text: 'Import Data', icon: Upload },
];

interface SideNavProps {
  onLinkClick?: () => void;
}

export function SideNav({ onLinkClick }: SideNavProps) {

  return (
    <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo / App Name */}
      <div className="h-16 flex items-center px-6 border-b border-slate-200">
        <Logo className="h-8 w-auto text-slate-800" />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end // Use 'end' for the root path to prevent it from always being active
            onClick={onLinkClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <link.icon className="h-5 w-5" />
            <span>{link.text}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}