import React, { useEffect, useState } from 'react';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';

interface AlertSummaryProps {
  compact?: boolean;
}

export const AlertSummary: React.FC<AlertSummaryProps> = ({ compact = false }) => {
  const [alertCounts, setAlertCounts] = useState({
    critical: 0,
    warning: 0,
    info: 0,
    total: 0
  });

  useEffect(() => {
    // TODO: Replace with actual API call
    // Mock data for now
    setAlertCounts({
      critical: 2,
      warning: 3,
      info: 1,
      total: 6
    });
  }, []);

  if (alertCounts.total === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-slate-600" />
              <span className="font-medium text-slate-900">Active Alerts</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {alertCounts.critical > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-red-700 font-medium">{alertCounts.critical} Critical</span>
                </div>
              )}
              {alertCounts.warning > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-yellow-700 font-medium">{alertCounts.warning} Warning</span>
                </div>
              )}
              {alertCounts.info > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-blue-700 font-medium">{alertCounts.info} Info</span>
                </div>
              )}
            </div>
          </div>
          <Link to="/today">
            <Button variant="ghost" size="sm" className="text-sm">
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Full version for other uses
  return (
    <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-slate-700" />
              <h3 className="text-lg font-semibold text-slate-900">Portfolio Alerts</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-red-100 px-3 py-1 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-red-800">{alertCounts.critical} Critical</span>
              </div>
              <div className="flex items-center gap-2 bg-yellow-100 px-3 py-1 rounded-full">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-sm font-medium text-yellow-800">{alertCounts.warning} Warnings</span>
              </div>
              <div className="flex items-center gap-2 bg-blue-100 px-3 py-1 rounded-full">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-800">{alertCounts.info} Info</span>
              </div>
            </div>
          </div>
          <Link to="/today">
            <Button variant="default" size="sm">
              Manage Alerts
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AlertSummary;