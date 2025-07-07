import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  AlertTriangle, 
  Clock, 
  ExternalLink, 
  X, 
  Bell, 
  TrendingDown, 
  TrendingUp,
  UserX,
  Briefcase,
  MapPin,
  Heart,
  CheckCircle,
  ArrowUp,
  Package,
  XCircle,
  Settings
} from 'lucide-react';
import { alertService, UniversalAlert, AlertPriority, AlertType } from '../../services/alertService';
import { useNavigate } from 'react-router-dom';

interface UniversalAlertsPanelProps {
  className?: string;
  maxAlerts?: number;
  autoRefresh?: boolean;
  showSettings?: boolean;
}

const UniversalAlertsPanel: React.FC<UniversalAlertsPanelProps> = ({ 
  className = '', 
  maxAlerts = 12,
  autoRefresh = true,
  showSettings = false
}) => {
  const [alerts, setAlerts] = useState<UniversalAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    loadAlerts();
    
    if (autoRefresh) {
      const interval = setInterval(loadAlerts, 5 * 60 * 1000); // Refresh every 5 minutes
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const allAlerts = await alertService.generateAllAlerts();
      
      // Filter out dismissed alerts and apply category filter
      const filteredAlerts = allAlerts
        .filter(alert => !dismissedAlerts.has(alert.id))
        .filter(alert => selectedCategory === 'all' || alert.category === selectedCategory)
        .slice(0, maxAlerts);

      setAlerts(filteredAlerts);
    } catch (err) {
      setError('Failed to load alerts');
      console.error('Error loading alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const handleViewAlert = (alert: UniversalAlert) => {
    if (alert.isPortfolioWide) {
      // Navigate to appropriate filtered view
      if (alert.category === 'sol') {
        navigate('/loans?sol_filter=at_risk');
      } else if (alert.alertType === 'geographic_clustering') {
        navigate(`/loans?state=${alert.metadata?.geography}`);
      } else if (alert.alertType === 'securitization_opportunity') {
        navigate('/loans?status=CU'); // Current loans
      } else {
        navigate('/loans');
      }
    } else if (alert.loanIds.length === 1) {
      // Navigate to specific loan
      navigate(`/loans/${alert.loanIds[0]}`);
    } else {
      // Multiple loans - navigate to filtered view
      navigate('/loans');
    }
  };

  const getAlertIcon = (alertType: AlertType) => {
    const iconMap: Record<AlertType, React.ComponentType<any>> = {
      // Performance Degradation
      payment_deterioration: TrendingDown,
      partial_payments: AlertTriangle,
      credit_score_drop: UserX,
      employment_change: Briefcase,
      geographic_clustering: MapPin,
      // Performance Improvement
      approaching_securitizable: TrendingUp,
      payment_rehabilitation: Heart,
      workout_success: CheckCircle,
      equity_improvement: ArrowUp,
      // Legal & Regulatory
      foreclosure_delay: Clock,
      // Portfolio Level
      securitization_opportunity: Package,
      // SOL
      sol_expired: XCircle,
      sol_expiring_soon: Clock,
      sol_high_risk: AlertTriangle
    };
    
    const IconComponent = iconMap[alertType] || Bell;
    return <IconComponent className="h-4 w-4" />;
  };

  const getAlertBadgeColor = (priority: AlertPriority) => {
    const colorMap: Record<AlertPriority, string> = {
      critical: 'bg-red-100 text-red-700 border-red-300',
      high: 'bg-orange-100 text-orange-700 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      informational: 'bg-blue-100 text-blue-700 border-blue-300'
    };
    return colorMap[priority];
  };

  const getAlertBackgroundColor = (priority: AlertPriority) => {
    const bgMap: Record<AlertPriority, string> = {
      critical: 'border-red-200 bg-red-50',
      high: 'border-orange-200 bg-orange-50',
      medium: 'border-yellow-200 bg-yellow-50',
      informational: 'border-blue-200 bg-blue-50'
    };
    return bgMap[priority];
  };

  const getCategoryDisplayName = (category: string) => {
    const nameMap: Record<string, string> = {
      all: 'All Alerts',
      performance_degradation: 'Performance Issues',
      performance_improvement: 'Performance Gains',
      legal_regulatory: 'Legal & Regulatory',
      portfolio_level: 'Portfolio Level',
      sol: 'SOL Alerts'
    };
    return nameMap[category] || category;
  };

  const alertsByCategory = alerts.reduce((acc, alert) => {
    acc[alert.category] = (acc[alert.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Portfolio Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500">Loading alerts...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Portfolio Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-3" />
            <p className="text-red-500">{error}</p>
            <Button variant="outline" size="sm" onClick={loadAlerts} className="mt-3">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            Portfolio Alerts
          </CardTitle>
          <div className="flex items-center gap-2">
            {showSettings && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/alert-settings')}>
                <Settings className="h-4 w-4" />
              </Button>
            )}
            <Badge variant="outline" className="text-xs">
              {alerts.length} active
            </Badge>
          </div>
        </div>
        
        {/* Category Filter */}
        <div className="flex flex-wrap gap-1 mt-2">
          {['all', 'performance_degradation', 'performance_improvement', 'legal_regulatory', 'portfolio_level', 'sol'].map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="text-xs h-7"
            >
              {getCategoryDisplayName(category)}
              {category !== 'all' && alertsByCategory[category] && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {alertsByCategory[category]}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No alerts for selected category</p>
            <p className="text-sm text-gray-400 mt-1">Portfolio is performing within normal parameters</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`border rounded-lg p-3 ${getAlertBackgroundColor(alert.priority)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`${alertService.getAlertColor(alert.priority) === 'red' ? 'text-red-600' : 
                                    alertService.getAlertColor(alert.priority) === 'orange' ? 'text-orange-600' :
                                    alertService.getAlertColor(alert.priority) === 'yellow' ? 'text-yellow-600' :
                                    'text-blue-600'}`}>
                      {getAlertIcon(alert.alertType)}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getAlertBadgeColor(alert.priority)}`}
                    >
                      {alert.priority.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {getCategoryDisplayName(alert.category)}
                    </Badge>
                  </div>
                  <button
                    onClick={() => handleDismissAlert(alert.id)}
                    className="text-gray-400 hover:text-gray-600 text-xs"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-900">
                    {alert.message}
                  </p>
                  <p className="text-sm text-gray-600">
                    {alert.detailMessage}
                  </p>
                  
                  {/* Borrower/Loan Info */}
                  {!alert.isPortfolioWide && (
                    <div className="text-xs text-gray-500">
                      {alert.loanIds.length === 1 ? (
                        <span>Loan: {alert.loanIds[0]} | Borrower: {alert.borrowerNames[0]}</span>
                      ) : (
                        <span>{alert.loanIds.length} loans affected</span>
                      )}
                    </div>
                  )}
                  
                  {/* Metadata */}
                  {alert.metadata && (
                    <div className="text-xs text-gray-500">
                      {alert.metadata.count && <span>Count: {alert.metadata.count} | </span>}
                      {alert.metadata.daysOverdue && <span>Days Overdue: {alert.metadata.daysOverdue} | </span>}
                      {alert.metadata.geography && <span>Geography: {alert.metadata.geography} | </span>}
                      {alert.metadata.daysCurrent && <span>Days Current: {alert.metadata.daysCurrent} | </span>}
                      {alert.metadata.placeholder && <span className="text-blue-600">Feature Coming Soon</span>}
                    </div>
                  )}
                </div>
                
                {/* Suggested Actions */}
                {alert.suggestedActions.length > 0 && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                    <div className="font-medium text-gray-700 mb-1">Suggested Actions:</div>
                    <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                      {alert.suggestedActions.slice(0, 2).map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-500">
                    {alert.timestamp.toLocaleTimeString()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewAlert(alert)}
                    className="text-xs h-7"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    {alert.isPortfolioWide ? 'View Portfolio' : 'View Loan'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {alerts.length > 0 && (
          <div className="mt-4 pt-3 border-t space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAlerts}
              className="w-full text-xs"
            >
              Refresh Alerts
            </Button>
            {showSettings && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/alert-settings')}
                className="w-full text-xs"
              >
                <Settings className="h-3 w-3 mr-1" />
                Configure Alert Settings
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UniversalAlertsPanel;