import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { 
  Home, 
  Search, 
  FileText, 
  BarChart3, 
  Mail, 
  Settings, 
  Users, 
  AlertTriangle,
  TrendingUp,
  Calendar,
  Shield,
  Upload,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  path: string;
  badge?: number;
  section: string;
}

interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

const PremiumSidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user } = useAuth();
  const [expandedSections, setExpandedSections] = useState<string[]>(['main', 'portfolio']);

  const navigationSections: NavSection[] = [
    {
      id: 'main',
      title: 'Main',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard', section: 'main' },
        { id: 'explorer', label: 'Loan Explorer', icon: Search, path: '/loans', section: 'main' },
        { id: 'inbox', label: 'Inbox', icon: Mail, path: '/inbox', badge: 3, section: 'main' },
      ]
    },
    {
      id: 'portfolio',
      title: 'Portfolio Management',
      items: [
        { id: 'analytics', label: 'Portfolio Analytics', icon: BarChart3, path: '/analytics', section: 'portfolio' },
        { id: 'foreclosure', label: 'Foreclosure Monitor', icon: AlertTriangle, path: '/foreclosure-monitoring', section: 'portfolio' },
        { id: 'sol', label: 'SOL Monitoring', icon: Shield, path: '/sol-monitoring', section: 'portfolio' },
        { id: 'performance', label: 'Performance', icon: TrendingUp, path: '/performance', section: 'portfolio' },
      ]
    },
    {
      id: 'tools',
      title: 'Tools & Data',
      items: [
        { id: 'upload', label: 'Upload Data', icon: Upload, path: '/upload', section: 'tools' },
        { id: 'reports', label: 'Reports', icon: FileText, path: '/reports', section: 'tools' },
        { id: 'calendar', label: 'Calendar', icon: Calendar, path: '/calendar', section: 'tools' },
      ]
    },
    {
      id: 'admin',
      title: 'Administration',
      items: [
        { id: 'organization', label: 'Organization', icon: Users, path: '/organization', section: 'admin' },
        { id: 'settings', label: 'Settings', icon: Settings, path: '/settings', section: 'admin' },
      ]
    }
  ];

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const isActive = (path: string) => location.pathname === path;

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`premium-sidebar ${isOpen ? 'open' : ''}`}>
        
        {/* Header */}
        <div className="premium-sidebar-header">
          <div className="premium-sidebar-brand">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">NPL</span>
            </div>
            <span>NPLVision</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="premium-sidebar-nav">
          {navigationSections.map((section) => (
            <div key={section.id} className="premium-nav-section">
              
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="premium-nav-section-title w-full flex items-center justify-between hover:text-gray-600 transition-colors"
              >
                <span>{section.title}</span>
                <ChevronRight 
                  className={`w-3 h-3 transition-transform duration-200 ${
                    expandedSections.includes(section.id) ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {/* Section Items */}
              <div className={`overflow-hidden transition-all duration-300 ${
                expandedSections.includes(section.id) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              }`}>
                {section.items.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      className={`premium-nav-item ${isActive(item.path) ? 'active' : ''}`}
                      onClick={() => window.innerWidth < 1024 && onClose()}
                    >
                      <IconComponent className="premium-nav-icon" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="premium-nav-badge">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile Footer */}
        <div className="premium-sidebar-footer">
          <div className="premium-user-profile">
            <div className="premium-user-avatar">
              {getUserInitials()}
            </div>
            <div className="premium-user-info">
              <h4>{user?.firstName} {user?.lastName}</h4>
              <p>{user?.jobTitle || 'Portfolio Manager'}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PremiumSidebar;