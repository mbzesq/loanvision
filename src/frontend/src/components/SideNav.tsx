// src/frontend/src/components/SideNav.tsx
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Table, Upload, LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const navLinks = [
  { to: '/dashboard', text: 'Dashboard', icon: LayoutDashboard },
  { to: '/loans', text: 'Loan Explorer', icon: Table },
  { to: '/upload', text: 'Upload', icon: Upload },
];

interface SideNavProps {
  onLinkClick?: () => void;
}

export function SideNav({ onLinkClick }: SideNavProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  return (
    <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo / App Name */}
      <div className="h-16 flex items-center px-6 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-800">NPLVision</h1>
        {/* Logo component will go here later */}
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

      {/* User Info & Logout */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}