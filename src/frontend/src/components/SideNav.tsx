// src/frontend/src/components/SideNav.tsx
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Table, Upload, Scale, ChevronLeft, ChevronRight, Calendar, Inbox } from 'lucide-react';
import { Logo } from './Logo';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const navLinks = [
  { to: '/inbox', text: 'Inbox', icon: Inbox },
  { to: '/today', text: 'Today', icon: Calendar },
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
              ? 'text-blue-300'
              : 'text-slate-300 hover:text-white'
          } ${
            isCollapsed ? 'justify-center' : ''
          }`
        }
        style={({ isActive }) => ({
          backgroundColor: isActive ? 'rgba(49, 130, 206, 0.2)' : 'transparent'
        }) as any}
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
    <aside className="h-full flex flex-col" style={{ 
      backgroundColor: 'var(--color-sidebar)', 
      borderRight: '1px solid var(--color-border)' 
    }}>
      {/* Logo / App Name */}
      <div className={`h-16 flex items-center ${
        isCollapsed ? 'justify-center px-2' : 'px-6'
      }`} style={{ borderBottom: '1px solid var(--color-border)' }}>
        {isCollapsed ? (
          <div style={{ 
            width: '32px', 
            height: '32px', 
            backgroundColor: 'var(--color-primary)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>N</span>
          </div>
        ) : (
          <Logo className="h-8 w-auto text-slate-200" />
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
        <div className={`p-4 ${
          isCollapsed ? 'flex justify-center' : ''
        }`} style={{ borderTop: '1px solid var(--color-border)' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={`w-full ${
              isCollapsed ? 'w-8 h-8 p-0' : 'justify-start'
            }`}
            style={{ color: 'var(--color-text-secondary)', backgroundColor: 'transparent' }}
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