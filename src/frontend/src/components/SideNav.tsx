// src/frontend/src/components/SideNav.tsx
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Table, Upload, Scale, ChevronLeft, ChevronRight, Inbox, Gavel } from 'lucide-react';
import { Logo } from './Logo';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import '../styles/premium-saas-design.css';

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
        className={({ isActive }) =>
          `premium-nav-item ${
            isCollapsed ? 'collapsed' : ''
          } ${isActive ? 'active' : ''}`
        }
      >
        <link.icon className="premium-nav-icon" />
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
    <aside className="premium-sidebar-inner">
      {/* Premium Logo Section */}
      <div className={`premium-sidebar-logo ${
        isCollapsed ? 'collapsed' : ''
      }`}>
        {isCollapsed ? (
          <div className="premium-logo-collapsed">
            <span>N</span>
          </div>
        ) : (
          <Logo className="h-8 w-auto" />
        )}
      </div>

      {/* Premium Navigation */}
      <nav className="premium-sidebar-nav">
        <div className="premium-nav-section">
          {navLinks.map((link) => (
            <NavItem key={link.to} link={link} isCollapsed={isCollapsed} />
          ))}
        </div>
      </nav>

      {/* Premium Collapse Button */}
      {onToggleCollapse && (
        <div className="premium-sidebar-collapse">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={`premium-collapse-button ${isCollapsed ? 'collapsed' : ''}`}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      )}
    </aside>
  );
}