import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertCircle, 
  DollarSign,
  FileText,
  Calendar,
  ArrowUpRight,
  BarChart3,
  Plus,
  Scale,
  Target
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface PortfolioMetrics {
  totalUpb: number;
  avgBalance: number;
  performingLoans: number;
  totalLoans: number;
  solRiskCount: number;
  fcOnTrackPercentage: number;
  alerts: number;
}

interface Loan {
  loan_id: string;
  prin_bal: string;
  legal_status: string;
  last_pymt_received: string;
  next_pymt_due: string;
  maturity_date: string;
  int_rate: string;
  fc_start_date?: string;
}

interface RecentActivityItem {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  type: 'upload' | 'alert' | 'task' | 'update';
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

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<PortfolioMetrics>({
    totalUpb: 0,
    avgBalance: 0,
    performingLoans: 0,
    totalLoans: 0,
    solRiskCount: 0,
    fcOnTrackPercentage: 0,
    alerts: 6
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPortfolioData = async () => {
      try {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
        const response = await axios.get<Loan[]>(`${apiUrl}/api/v2/loans`);
        const loans = response.data;
        
        // Calculate real metrics from loan data
        const totalUPB = loans.reduce((sum, loan) => sum + (parseFloat(loan.prin_bal) || 0), 0);
        const totalLoans = loans.length;
        const avgBalance = totalLoans > 0 ? totalUPB / totalLoans : 0;
        
        // Define performance categories
        const performingStatuses = ['Current', 'Performing', 'Good Standing'];
        const performingLoans = loans.filter(loan => 
          performingStatuses.includes(loan.legal_status || '')
        );
        
        // Calculate SOL risk - loans approaching or past SOL expiration
        const solRiskLoans = loans.filter(loan => {
          const lastPayment = loan.last_pymt_received ? new Date(loan.last_pymt_received) : null;
          if (!lastPayment) return false;
          
          // Simplified SOL calculation - typically 3-6 years depending on jurisdiction
          const yearsOld = (Date.now() - lastPayment.getTime()) / (1000 * 60 * 60 * 24 * 365);
          
          // Flag loans that are 2.5+ years old (approaching 3-year SOL) or older
          return yearsOld >= 2.5;
        });
        
        // Calculate foreclosure performance - % on track vs overdue
        const fcLoans = loans.filter(loan => 
          loan.fc_start_date && (loan.legal_status === 'FC' || loan.legal_status === 'Foreclosure')
        );
        
        let fcOnTrackCount = 0;
        fcLoans.forEach(loan => {
          const startDate = new Date(loan.fc_start_date!);
          const daysSinceStart = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Simplified timeline - typical foreclosure should complete in 6-12 months (180-365 days)
          const expectedDays = 270; // 9 months average
          const isOnTrack = daysSinceStart <= expectedDays;
          
          if (isOnTrack) fcOnTrackCount++;
        });
        
        const fcOnTrackPercentage = fcLoans.length > 0 ? (fcOnTrackCount / fcLoans.length) * 100 : 0;
        
        setMetrics({
          totalUpb: totalUPB,
          avgBalance,
          performingLoans: performingLoans.length,
          totalLoans,
          solRiskCount: solRiskLoans.length,
          fcOnTrackPercentage,
          alerts: 6 // Would need alerts system
        });
        
        // Generate recent activity based on loan data
        const activities: RecentActivityItem[] = [
          {
            id: '1',
            title: 'Portfolio data updated',
            subtitle: `${totalLoans} loan records processed`,
            time: '2 min ago',
            type: 'upload'
          },
          ...(solRiskLoans.length > 0 ? [{
            id: '2',
            title: 'SOL alert triggered',
            subtitle: `${solRiskLoans.length} loans approaching statute of limitations`,
            time: '15 min ago',
            type: 'alert' as const
          }] : []),
          ...(fcLoans.length > 0 ? [{
            id: '3',
            title: 'Foreclosure status updated',
            subtitle: `${fcLoans.length} loans in active foreclosure`,
            time: '1 hour ago',
            type: 'update' as const
          }] : []),
          {
            id: '4',
            title: 'Performance metrics calculated',
            subtitle: `${performingLoans.length} performing loans identified`,
            time: '2 hours ago',
            type: 'task'
          }
        ];
        
        setRecentActivity(activities);
        
      } catch (error) {
        console.error('Failed to fetch portfolio data:', error);
        // Keep default values on error
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolioData();
  }, []);

  const handleMetricClick = (metric: string) => {
    switch (metric) {
      case 'sol-risk':
        navigate('/sol-monitoring');
        break;
      case 'foreclosure':
        navigate('/foreclosure-monitoring');
        break;
      case 'upb':
        navigate('/loans?sortBy=prin_bal&sortOrder=desc');
        break;
      default:
        navigate('/loans');
    }
  };

  const handleAlertClick = () => {
    navigate('/inbox');
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'upload':
        navigate('/upload');
        break;
      case 'report':
        // Would navigate to reports page when available
        console.log('Navigate to reports');
        break;
      case 'schedule':
        // Would navigate to calendar/scheduling when available
        console.log('Navigate to scheduling');
        break;
    }
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
        
        {/* Hero Metrics - Focus on Key Risk Areas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <PremiumHeroMetric
            title="SOL Risk Loans"
            value={loading ? '...' : metrics.solRiskCount.toString()}
            change={metrics.solRiskCount > 0 ? 5.0 : 0}
            changeLabel="approaching/past SOL"
            icon={Scale}
            sparklineData={[0.2, 0.25, 0.3, 0.28, 0.35, 0.4, 0.45, 0.5, 0.48, 0.52]}
            onClick={() => handleMetricClick('sol-risk')}
          />
          
          <PremiumHeroMetric
            title="FC On Track"
            value={loading ? '...' : `${metrics.fcOnTrackPercentage.toFixed(1)}%`}
            change={metrics.fcOnTrackPercentage >= 70 ? 2.1 : -3.5}
            changeLabel="vs last month"
            icon={Target}
            sparklineData={[0.6, 0.65, 0.7, 0.68, 0.72, 0.75, 0.73, 0.78, 0.8, 0.82]}
            onClick={() => handleMetricClick('foreclosure')}
          />
          
          <PremiumHeroMetric
            title="Total UPB"
            value={loading ? '...' : `$${(metrics.totalUpb / 1000000).toFixed(1)}M`}
            change={2.4}
            changeLabel="vs last month"
            icon={DollarSign}
            sparklineData={[0.3, 0.4, 0.35, 0.5, 0.45, 0.6, 0.65, 0.7, 0.8, 0.75]}
            onClick={() => handleMetricClick('upb')}
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
                  {loading ? (
                    <div className="space-y-4">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex items-start gap-4 p-4">
                          <div className="premium-skeleton w-8 h-8 rounded-full" />
                          <div className="flex-1">
                            <div className="premium-skeleton h-4 w-3/4 mb-2" />
                            <div className="premium-skeleton h-3 w-1/2" />
                          </div>
                          <div className="premium-skeleton h-3 w-16" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    recentActivity.map(activity => (
                      <ActivityItem
                        key={activity.id}
                        title={activity.title}
                        subtitle={activity.subtitle}
                        time={activity.time}
                        type={activity.type}
                      />
                    ))
                  )}
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

export default DashboardPage;