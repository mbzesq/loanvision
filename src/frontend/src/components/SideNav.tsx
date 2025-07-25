// src/frontend/src/components/SideNav.tsx
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Table, Upload, Scale, ChevronLeft, ChevronRight, Inbox, Gavel } from 'lucide-react';
import { Logo } from './Logo';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const navLinks = [
  { to: '/inbox', text: 'Inbox', icon: Inbox },
  { to: '/dashboard', text: 'Dashboard', icon: LayoutDashboard },
  { to: '/loans', text: 'Loan Explorer', icon: Table },
  { to: '/sol-monitoring', text: 'SOL Monitoring', icon: Scale },
  { to: '/foreclosure-monitoring', text: 'Foreclosure Monitoring', icon: Gavel },
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
        className={({ isActive: _ }) =>
          `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`
        }
        style={({ isActive }) => ({
          backgroundColor: isActive ? 'rgba(28, 25, 23, 0.1)' : 'transparent',
          color: isActive ? '#1c1917' : '#57534e'
        }) as any}
        onMouseEnter={(e) => {
          if (!(e.target as HTMLElement).closest('[aria-current="page"]')) {
            (e.target as HTMLElement).style.color = '#1c1917';
          }
        }}
        onMouseLeave={(e) => {
          if (!(e.target as HTMLElement).closest('[aria-current="page"]')) {
            (e.target as HTMLElement).style.color = '#57534e';
          }
        }}
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
          <div style={{ color: '#1c1917' }}>
            <Logo className="h-8 w-auto" />
          </div>
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
            style={{ color: '#57534e', backgroundColor: 'transparent' }}
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