import React from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Calculator, 
  BarChart3,
  Bell,
  Scale,
  PieChart,
  Map,
  Activity,
  AlertTriangle
} from 'lucide-react';

// Mini preview components for the widget catalog
export const UPBPreview: React.FC = () => (
  <div className="h-20 bg-gradient-to-br from-blue-50 to-blue-100 rounded-md p-3 flex items-center justify-between">
    <div>
      <div className="text-xs text-blue-600 font-medium">Total UPB</div>
      <div className="text-lg font-bold text-blue-900">$12.4M</div>
      <div className="text-xs text-green-600 flex items-center gap-1">
        <TrendingUp className="h-3 w-3" />
        +5.2%
      </div>
    </div>
    <DollarSign className="h-8 w-8 text-blue-500 opacity-60" />
  </div>
);

export const LoanCountPreview: React.FC = () => (
  <div className="h-20 bg-gradient-to-br from-green-50 to-green-100 rounded-md p-3 flex items-center justify-between">
    <div>
      <div className="text-xs text-green-600 font-medium">Loan Count</div>
      <div className="text-lg font-bold text-green-900">2,847</div>
      <div className="text-xs text-green-600 flex items-center gap-1">
        <TrendingUp className="h-3 w-3" />
        +12
      </div>
    </div>
    <BarChart3 className="h-8 w-8 text-green-500 opacity-60" />
  </div>
);

export const AverageBalancePreview: React.FC = () => (
  <div className="h-20 bg-gradient-to-br from-orange-50 to-orange-100 rounded-md p-3 flex items-center justify-between">
    <div>
      <div className="text-xs text-orange-600 font-medium">Avg Balance</div>
      <div className="text-lg font-bold text-orange-900">$4,356</div>
      <div className="text-xs text-red-600 flex items-center gap-1">
        <TrendingUp className="h-3 w-3 rotate-180" />
        -2.1%
      </div>
    </div>
    <Calculator className="h-8 w-8 text-orange-500 opacity-60" />
  </div>
);

export const PerformancePreview: React.FC = () => (
  <div className="h-20 bg-gradient-to-br from-green-50 to-green-100 rounded-md p-3 flex items-center justify-between">
    <div>
      <div className="text-xs text-green-600 font-medium">Performance</div>
      <div className="text-lg font-bold text-green-900">94.2%</div>
      <div className="text-xs text-green-600 flex items-center gap-1">
        <TrendingUp className="h-3 w-3" />
        +1.8%
      </div>
    </div>
    <TrendingUp className="h-8 w-8 text-green-500 opacity-60" />
  </div>
);

export const AlertsPreview: React.FC = () => (
  <div className="h-20 bg-gradient-to-br from-red-50 to-red-100 rounded-md p-3">
    <div className="flex items-center justify-between mb-2">
      <div className="text-xs text-red-600 font-medium">Alerts</div>
      <Bell className="h-4 w-4 text-red-500" />
    </div>
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3 w-3 text-red-500" />
        <span className="text-xs text-red-700">3 High Priority</span>
      </div>
      <div className="flex items-center gap-2">
        <Bell className="h-3 w-3 text-yellow-500" />
        <span className="text-xs text-yellow-700">7 Medium</span>
      </div>
    </div>
  </div>
);

export const SOLMonitorPreview: React.FC = () => (
  <div className="h-20 bg-gradient-to-br from-purple-50 to-purple-100 rounded-md p-3">
    <div className="flex items-center justify-between mb-2">
      <div className="text-xs text-purple-600 font-medium">SOL Monitor</div>
      <Scale className="h-4 w-4 text-purple-500" />
    </div>
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div>
        <div className="text-purple-900 font-semibold">126</div>
        <div className="text-purple-600">Expiring</div>
      </div>
      <div>
        <div className="text-green-900 font-semibold">94%</div>
        <div className="text-green-600">Safe</div>
      </div>
    </div>
  </div>
);

export const LoanStatusPreview: React.FC = () => (
  <div className="h-20 bg-gradient-to-br from-blue-50 to-blue-100 rounded-md p-3 relative">
    <div className="flex items-center justify-between mb-2">
      <div className="text-xs text-blue-600 font-medium">Loan Status</div>
      <PieChart className="h-4 w-4 text-blue-500" />
    </div>
    <div className="grid grid-cols-3 gap-1 text-xs">
      <div className="text-center">
        <div className="w-3 h-3 bg-green-400 rounded-full mx-auto mb-1"></div>
        <div className="text-gray-600">Current</div>
      </div>
      <div className="text-center">
        <div className="w-3 h-3 bg-yellow-400 rounded-full mx-auto mb-1"></div>
        <div className="text-gray-600">Late</div>
      </div>
      <div className="text-center">
        <div className="w-3 h-3 bg-red-400 rounded-full mx-auto mb-1"></div>
        <div className="text-gray-600">FCL</div>
      </div>
    </div>
  </div>
);

export const GeographicalPreview: React.FC = () => (
  <div className="h-20 bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-md p-3">
    <div className="flex items-center justify-between mb-2">
      <div className="text-xs text-cyan-600 font-medium">Geographic</div>
      <Map className="h-4 w-4 text-cyan-500" />
    </div>
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-cyan-700">CA</span>
          <span className="text-cyan-900">342</span>
        </div>
        <div className="flex justify-between">
          <span className="text-cyan-700">TX</span>
          <span className="text-cyan-900">298</span>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-cyan-700">FL</span>
          <span className="text-cyan-900">256</span>
        </div>
        <div className="flex justify-between">
          <span className="text-cyan-700">NY</span>
          <span className="text-cyan-900">189</span>
        </div>
      </div>
    </div>
  </div>
);

export const CashflowPreview: React.FC = () => (
  <div className="h-20 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-md p-3">
    <div className="flex items-center justify-between mb-2">
      <div className="text-xs text-indigo-600 font-medium">Cashflow</div>
      <BarChart3 className="h-4 w-4 text-indigo-500" />
    </div>
    <div className="flex items-end justify-between h-10">
      <div className="w-2 bg-indigo-300 h-4 rounded-sm"></div>
      <div className="w-2 bg-indigo-400 h-6 rounded-sm"></div>
      <div className="w-2 bg-indigo-500 h-8 rounded-sm"></div>
      <div className="w-2 bg-indigo-600 h-7 rounded-sm"></div>
      <div className="w-2 bg-indigo-400 h-5 rounded-sm"></div>
      <div className="w-2 bg-indigo-500 h-9 rounded-sm"></div>
    </div>
  </div>
);

export const ForeclosurePreview: React.FC = () => (
  <div className="h-20 bg-gradient-to-br from-red-50 to-red-100 rounded-md p-3">
    <div className="flex items-center justify-between mb-2">
      <div className="text-xs text-red-600 font-medium">Foreclosure</div>
      <Activity className="h-4 w-4 text-red-500" />
    </div>
    <div className="grid grid-cols-3 gap-1 text-xs">
      <div className="text-center">
        <div className="text-red-900 font-semibold">23</div>
        <div className="text-red-600">Filed</div>
      </div>
      <div className="text-center">
        <div className="text-orange-900 font-semibold">12</div>
        <div className="text-orange-600">Active</div>
      </div>
      <div className="text-center">
        <div className="text-green-900 font-semibold">8</div>
        <div className="text-green-600">Complete</div>
      </div>
    </div>
  </div>
);

// Widget preview mapping - matching the widget IDs from WidgetRegistry
export const widgetPreviews: Record<string, React.ComponentType> = {
  'kpi-upb': UPBPreview,
  'kpi-loans': LoanCountPreview,
  'kpi-balance': AverageBalancePreview,
  'kpi-performance': PerformancePreview,
  'alerts': AlertsPreview,
  'sol-monitor': SOLMonitorPreview,
  'loan-status': LoanStatusPreview,
  'geographical': GeographicalPreview,
  'cashflow': CashflowPreview,
  'foreclosure': ForeclosurePreview
};