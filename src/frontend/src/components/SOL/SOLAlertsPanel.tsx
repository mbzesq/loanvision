import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { AlertTriangle, Clock, ExternalLink, X, Bell } from 'lucide-react';
import { solService } from '../../services/solService';
import { useNavigate } from 'react-router-dom';

interface SOLAlert {
  id: string;
  loanId: string;
  borrowerName: string;
  alertType: 'expired' | 'expiring_soon' | 'high_risk';
  message: string;
  daysUntilExpiration: number;
  riskLevel: string;
  priority: 'high' | 'medium' | 'low';
  timestamp: Date;
}

interface SOLAlertsPanelProps {
  className?: string;
  maxAlerts?: number;
  autoRefresh?: boolean;
}

const SOLAlertsPanel: React.FC<SOLAlertsPanelProps> = ({ 
  className = '', 
  maxAlerts = 10,
  autoRefresh = true 
}) => {
  const [alerts, setAlerts] = useState<SOLAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    loadSOLAlerts();
    
    if (autoRefresh) {
      const interval = setInterval(loadSOLAlerts, 5 * 60 * 1000); // Refresh every 5 minutes
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadSOLAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get SOL summary to identify at-risk loans
      const summary = await solService.getSOLSummary();
      const alertsToGenerate: SOLAlert[] = [];

      // Generate alerts based on summary data
      if (summary.expired_count > 0) {
        alertsToGenerate.push({
          id: `expired-${Date.now()}`,
          loanId: 'multiple',
          borrowerName: 'Multiple Borrowers',
          alertType: 'expired',
          message: `${summary.expired_count} loans have expired SOL`,
          daysUntilExpiration: -1,
          riskLevel: 'HIGH',
          priority: 'high',
          timestamp: new Date()
        });
      }

      if (summary.high_risk_count > 0) {
        alertsToGenerate.push({
          id: `high-risk-${Date.now()}`,
          loanId: 'multiple',
          borrowerName: 'Multiple Borrowers',
          alertType: 'high_risk',
          message: `${summary.high_risk_count} loans are at high SOL risk`,
          daysUntilExpiration: 0,
          riskLevel: 'HIGH',
          priority: 'high',
          timestamp: new Date()
        });
      }

      if (summary.medium_risk_count > 0) {
        alertsToGenerate.push({
          id: `medium-risk-${Date.now()}`,
          loanId: 'multiple',
          borrowerName: 'Multiple Borrowers',
          alertType: 'expiring_soon',
          message: `${summary.medium_risk_count} loans are at medium SOL risk`,
          daysUntilExpiration: 180,
          riskLevel: 'MEDIUM',
          priority: 'medium',
          timestamp: new Date()
        });
      }

      // Add mock individual loan alerts for demonstration
      if (summary.total_loans > 0) {
        alertsToGenerate.push({
          id: `individual-${Date.now()}`,
          loanId: 'LOAN123456',
          borrowerName: 'John Smith',
          alertType: 'expiring_soon',
          message: 'SOL expires in 45 days',
          daysUntilExpiration: 45,
          riskLevel: 'MEDIUM',
          priority: 'medium',
          timestamp: new Date()
        });
      }

      // Filter out dismissed alerts and limit to maxAlerts
      const filteredAlerts = alertsToGenerate
        .filter(alert => !dismissedAlerts.has(alert.id))
        .slice(0, maxAlerts);

      setAlerts(filteredAlerts);
    } catch (err) {
      setError('Failed to load SOL alerts');
      console.error('Error loading SOL alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const handleViewLoan = (loanId: string) => {
    if (loanId === 'multiple') {
      // Navigate to loan explorer with SOL filter
      navigate('/loans?sol_filter=at_risk');
    } else {
      // Navigate to specific loan
      navigate(`/loans/${loanId}`);
    }
  };

  const getAlertIcon = (alertType: SOLAlert['alertType']) => {
    switch (alertType) {
      case 'expired':
        return <X className="h-4 w-4 text-red-600" />;
      case 'expiring_soon':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'high_risk':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Bell className="h-4 w-4 text-gray-600" />;
    }
  };

  const getAlertBadgeColor = (priority: SOLAlert['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-700 border-green-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            SOL Alerts
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
            SOL Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-3" />
            <p className="text-red-500">{error}</p>
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
            SOL Alerts
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {alerts.length} active
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No SOL alerts at this time</p>
            <p className="text-sm text-gray-400 mt-1">All loans are within safe SOL timeframes</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`border rounded-lg p-3 ${
                  alert.priority === 'high' ? 'border-red-200 bg-red-50' :
                  alert.priority === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                  'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getAlertIcon(alert.alertType)}
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getAlertBadgeColor(alert.priority)}`}
                    >
                      {alert.priority.toUpperCase()}
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
                    {alert.borrowerName}
                  </p>
                  <p className="text-sm text-gray-600">
                    {alert.message}
                  </p>
                  {alert.loanId !== 'multiple' && (
                    <p className="text-xs text-gray-500">
                      Loan: {alert.loanId}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-500">
                    {alert.timestamp.toLocaleTimeString()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewLoan(alert.loanId)}
                    className="text-xs h-7"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {alerts.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/loans?sol_filter=at_risk')}
              className="w-full text-xs"
            >
              View All SOL Issues
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SOLAlertsPanel;