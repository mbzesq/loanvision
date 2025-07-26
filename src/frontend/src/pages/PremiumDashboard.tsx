import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertCircle, 
  DollarSign,
  Users,
  FileText,
  Calendar,
  ArrowUpRight,
  BarChart3,
  Plus
} from 'lucide-react';

interface PortfolioMetrics {
  totalUpb: number;
  avgBalance: number;
  performingLoans: number;
  totalLoans: number;
  monthlyChange: number;
  alerts: number;
}


// Premium Hero Metric Component
const PremiumHeroMetric: React.FC<{
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: React.ComponentType<any>;
  sparklineData?: number[];
  onClick?: () => void;
}> = ({ title, value, change, changeLabel, icon: Icon, sparklineData = [], onClick }) => {
  const isPositive = change > 0;
  const isNegative = change < 0;
  
  return (
    <div className="premium-hero-card group" onClick={onClick}>
      <div className="flex items-start justify-between mb-6">
        <div className="premium-hero-label">{title}</div>
        <Icon className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
      </div>
      
      <div className="premium-hero-value">{value}</div>
      
      <div className={`premium-hero-trend ${isPositive ? 'positive' : isNegative ? 'negative' : 'neutral'}`}>
        {isPositive ? (
          <TrendingUp className="w-4 h-4" />
        ) : isNegative ? (
          <TrendingDown className="w-4 h-4" />
        ) : (
          <Activity className="w-4 h-4" />
        )}
        <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
        <span className="text-gray-500 text-xs">{changeLabel}</span>
      </div>
      
      {sparklineData.length > 0 && (
        <div className="premium-hero-sparkline">
          <svg className="w-full h-full" viewBox="0 0 100 30" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke={isPositive ? 'rgb(16, 185, 129)' : isNegative ? 'rgb(239, 68, 68)' : 'rgb(156, 163, 175)'}
              strokeWidth="2"
              points={sparklineData.map((val, idx) => 
                `${(idx / (sparklineData.length - 1)) * 100},${30 - (val * 28)}`
              ).join(' ')}
            />
            <defs>
              <linearGradient id={`gradient-${title}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isPositive ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)'} stopOpacity="0.3" />
                <stop offset="100%" stopColor={isPositive ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)'} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon
              fill={`url(#gradient-${title})`}
              points={`0,30 ${sparklineData.map((val, idx) => 
                `${(idx / (sparklineData.length - 1)) * 100},${30 - (val * 28)}`
              ).join(' ')} 100,30`}
            />
          </svg>
        </div>
      )}
    </div>
  );
};

// Premium Alert Badge
const PremiumAlertBadge: React.FC<{ count: number; onClick: () => void }> = ({ count, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-full transition-all duration-200 hover:shadow-md hover:scale-105"
  >
    <AlertCircle className="w-4 h-4" />
    <span className="font-semibold text-sm">{count} {count === 1 ? 'alert' : 'alerts'}</span>
    <ArrowUpRight className="w-3 h-3 opacity-60" />
  </button>
);

// Market Ticker Component
const MarketTicker: React.FC = () => {
  const marketData = [
    { label: '10Y Treasury', value: '4.23%', change: '+2bp', positive: true },
    { label: '30Y FRM', value: '6.81%', change: '+5bp', positive: true },
    { label: 'VIX', value: '16.82', change: '+0.45', positive: true },
    { label: 'DXY', value: '104.35', change: '+0.12', positive: true },
  ];

  return (
    <div className="flex items-center gap-8 text-sm">
      {marketData.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-gray-500 font-medium">{item.label}</span>
          <span className="text-gray-900 font-semibold">{item.value}</span>
          <span className={`text-xs font-medium ${item.positive ? 'text-green-600' : 'text-red-600'}`}>
            {item.change}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <div className="premium-live-indicator" />
        <span className="text-sm font-semibold text-gray-700">LIVE</span>
      </div>
    </div>
  );
};

// Quick Action Cards
const QuickActionCard: React.FC<{
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  onClick: () => void;
}> = ({ title, description, icon: Icon, onClick }) => (
  <div 
    className="premium-card cursor-pointer group p-6"
    onClick={onClick}
  >
    <div className="flex items-center justify-between mb-4">
      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-teal-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
    </div>
    <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
    <p className="text-sm text-gray-600">{description}</p>
  </div>
);

// Recent Activity Item
const ActivityItem: React.FC<{
  title: string;
  subtitle: string;
  time: string;
  type: 'upload' | 'alert' | 'task' | 'update';
}> = ({ title, subtitle, time, type }) => {
  const getTypeColor = () => {
    switch (type) {
      case 'upload': return 'bg-blue-100 text-blue-600';
      case 'alert': return 'bg-red-100 text-red-600';
      case 'task': return 'bg-green-100 text-green-600';
      case 'update': return 'bg-amber-100 text-amber-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'upload': return FileText;
      case 'alert': return AlertCircle;
      case 'task': return Calendar;
      case 'update': return Activity;
      default: return Activity;
    }
  };

  const Icon = getIcon();

  return (
    <div className="flex items-start gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getTypeColor()}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm">{title}</p>
        <p className="text-gray-600 text-xs mt-1">{subtitle}</p>
      </div>
      <span className="text-xs text-gray-500 flex-shrink-0">{time}</span>
    </div>
  );
};

const PremiumDashboard: React.FC = () => {
  const [metrics] = useState<PortfolioMetrics>({
    totalUpb: 64000000,
    avgBalance: 70500,
    performingLoans: 1247,
    totalLoans: 1893,
    monthlyChange: 2.4,
    alerts: 6
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleMetricClick = (metric: string) => {
    console.log(`Navigate to ${metric} details`);
  };

  const handleAlertClick = () => {
    console.log('Navigate to alerts');
  };

  const handleQuickAction = (action: string) => {
    console.log(`Execute ${action}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Loading Skeletons */}
          <div className="premium-skeleton h-8 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {[1, 2, 3].map(i => (
              <div key={i} className="premium-card p-8">
                <div className="premium-skeleton h-4 w-20 mb-4" />
                <div className="premium-skeleton h-12 w-32 mb-6" />
                <div className="premium-skeleton h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 backdrop-blur-sm bg-white/80">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Portfolio Dashboard</h1>
              <p className="text-gray-600">NPL-MAIN • Today, {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</p>
            </div>
            
            <div className="flex items-center gap-6">
              <PremiumAlertBadge count={metrics.alerts} onClick={handleAlertClick} />
              <MarketTicker />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        
        {/* Hero Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <PremiumHeroMetric
            title="Total UPB"
            value={`$${(metrics.totalUpb / 1000000).toFixed(1)}M`}
            change={2.4}
            changeLabel="vs last month"
            icon={DollarSign}
            sparklineData={[0.3, 0.4, 0.35, 0.5, 0.45, 0.6, 0.65, 0.7, 0.8, 0.75]}
            onClick={() => handleMetricClick('upb')}
          />
          
          <PremiumHeroMetric
            title="Average Balance"
            value={`$${(metrics.avgBalance / 1000).toFixed(0)}K`}
            change={3.2}
            changeLabel="vs last month"
            icon={BarChart3}
            sparklineData={[0.4, 0.45, 0.5, 0.48, 0.52, 0.58, 0.6, 0.65, 0.7, 0.72]}
            onClick={() => handleMetricClick('balance')}
          />
          
          <PremiumHeroMetric
            title="Performing Loans"
            value={metrics.performingLoans.toLocaleString()}
            change={1.8}
            changeLabel="vs last month"
            icon={Users}
            sparklineData={[0.6, 0.62, 0.58, 0.65, 0.68, 0.7, 0.72, 0.75, 0.78, 0.8]}
            onClick={() => handleMetricClick('performing')}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Quick Actions */}
          <div className="lg:col-span-1">
            <div className="premium-card mb-8">
              <div className="premium-card-header">
                <h2 className="premium-card-title">Quick Actions</h2>
                <p className="premium-card-subtitle">Common tasks and shortcuts</p>
              </div>
              <div className="premium-card-content space-y-4">
                <QuickActionCard
                  title="Upload Data"
                  description="Import loan metrics or foreclosure events"
                  icon={FileText}
                  onClick={() => handleQuickAction('upload')}
                />
                <QuickActionCard
                  title="Generate Report"
                  description="Create performance or compliance reports"
                  icon={BarChart3}
                  onClick={() => handleQuickAction('report')}
                />
                <QuickActionCard
                  title="Schedule Review"
                  description="Set up portfolio review meetings"
                  icon={Calendar}
                  onClick={() => handleQuickAction('schedule')}
                />
              </div>
            </div>
          </div>

          {/* Recent Activity & Performance Chart */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Performance Overview */}
            <div className="premium-card">
              <div className="premium-card-header">
                <h2 className="premium-card-title">Performance Overview</h2>
                <p className="premium-card-subtitle">30-day portfolio performance trends</p>
              </div>
              <div className="premium-card-content">
                <div className="h-64 bg-gradient-to-br from-blue-50 to-teal-50 rounded-xl flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Interactive Performance Chart</p>
                    <p className="text-sm text-gray-500 mt-2">Real-time portfolio analytics with drill-down capabilities</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="premium-card">
              <div className="premium-card-header">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="premium-card-title">Recent Activity</h2>
                    <p className="premium-card-subtitle">Latest updates and system events</p>
                  </div>
                  <button className="premium-btn premium-btn-ghost text-sm">
                    View All
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="premium-card-content">
                <div className="space-y-2">
                  <ActivityItem
                    title="Daily metrics uploaded"
                    subtitle="Portfolio data updated with 1,247 loan records"
                    time="2 min ago"
                    type="upload"
                  />
                  <ActivityItem
                    title="SOL alert triggered"
                    subtitle="3 loans approaching statute of limitations"
                    time="15 min ago"
                    type="alert"
                  />
                  <ActivityItem
                    title="Foreclosure status updated"
                    subtitle="12 loans moved to active foreclosure"
                    time="1 hour ago"
                    type="update"
                  />
                  <ActivityItem
                    title="Review meeting scheduled"
                    subtitle="Q1 portfolio review set for next week"
                    time="3 hours ago"
                    type="task"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Floating Action Button */}
      <button className="premium-fab">
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
};

export default PremiumDashboard;