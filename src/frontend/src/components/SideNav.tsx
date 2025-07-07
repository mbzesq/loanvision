// src/frontend/src/components/SideNav.tsx
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Table, Upload, Scale, ChevronLeft, ChevronRight } from 'lucide-react';
import { Logo } from './Logo';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const navLinks = [
  { to: '/dashboard', text: 'Dashboard', icon: LayoutDashboard },
  { to: '/loans', text: 'Loan Explorer', icon: Table },
  { to: '/sol-monitoring', text: 'SOL Monitoring', icon: Scale },
  { to: '/upload', text: 'Import Data', icon: Upload },
];

interface SideNavProps {
  onLinkClick?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function SideNav({ onLinkClick, isCollapsed = false, onToggleCollapse }: SideNavProps) {
  const NavItem = ({ link, isCollapsed }: { link: typeof navLinks[0], isCollapsed: boolean }) => {
    const content = (
      <NavLink
        to={link.to}
        end
        onClick={onLinkClick}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isActive
              ? 'bg-blue-100 text-blue-700'
              : 'text-slate-600 hover:bg-slate-100'
          } ${
            isCollapsed ? 'justify-center' : ''
          }`
        }
      >
        <link.icon className="h-5 w-5 flex-shrink-0" />
        {!isCollapsed && <span>{link.text}</span>}
      </NavLink>
    );

    if (isCollapsed) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {content}
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{link.text}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return content;
  };

  return (
    <aside className="h-full bg-white border-r border-slate-200 flex flex-col">
      {/* Logo / App Name */}
      <div className={`h-16 flex items-center border-b border-slate-200 ${
        isCollapsed ? 'justify-center px-2' : 'px-6'
      }`}>
        {isCollapsed ? (
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-sm">N</span>
          </div>
        ) : (
          <Logo className="h-8 w-auto text-slate-800" />
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navLinks.map((link) => (
          <NavItem key={link.to} link={link} isCollapsed={isCollapsed} />
        ))}
      </nav>

      {/* Collapse Toggle Button (Desktop only) */}
      {onToggleCollapse && (
        <div className={`p-4 border-t border-slate-200 ${
          isCollapsed ? 'flex justify-center' : ''
        }`}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={`w-full ${
              isCollapsed ? 'w-8 h-8 p-0' : 'justify-start'
            }`}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      )}
    </aside>
  );
}