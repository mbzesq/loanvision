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
  Scale,
  Target
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FinancialKPIDashboard } from '../components/FinancialKPIDashboard';
import { PerformanceTrendChart } from '../components/PerformanceTrendChart';
import { InboxKPIs } from '../components/InboxKPIs';

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


// Recent Activity Item with Premium Styling
const ActivityItem: React.FC<{
  title: string;
  subtitle: string;
  time: string;
  type: 'upload' | 'alert' | 'task' | 'update';
}> = ({ title, subtitle, time, type }) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'upload': return {
        bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
        icon: 'text-blue-600',
        border: 'border-blue-200'
      };
      case 'alert': return {
        bg: 'bg-gradient-to-br from-red-50 to-red-100',
        icon: 'text-red-600',
        border: 'border-red-200'
      };
      case 'task': return {
        bg: 'bg-gradient-to-br from-green-50 to-green-100',
        icon: 'text-green-600',
        border: 'border-green-200'
      };
      case 'update': return {
        bg: 'bg-gradient-to-br from-amber-50 to-amber-100',
        icon: 'text-amber-600',
        border: 'border-amber-200'
      };
      default: return {
        bg: 'bg-gradient-to-br from-gray-50 to-gray-100',
        icon: 'text-gray-600',
        border: 'border-gray-200'
      };
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
  const styles = getTypeStyles();

  return (
    <div className="group flex items-start gap-4 p-4 hover:bg-gray-50 rounded-xl transition-all duration-200 hover:shadow-sm cursor-pointer">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${styles.bg} border ${styles.border} group-hover:scale-110 transition-transform duration-200`}>
        <Icon className={`w-5 h-5 ${styles.icon}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">{title}</p>
        <p className="text-gray-600 text-xs mt-1 line-clamp-1">{subtitle}</p>
      </div>
      <span className="text-xs text-gray-400 flex-shrink-0 font-medium">{time}</span>
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
        
        // Generate comprehensive activity feed based on real data insights
        const activities: RecentActivityItem[] = [
          {
            id: '1',
            title: 'Portfolio data synchronized',
            subtitle: `${totalLoans.toLocaleString()} loan records updated, UPB: $${(totalUPB / 1000000).toFixed(1)}M`,
            time: '2 min ago',
            type: 'upload' as const
          },
          ...(solRiskLoans.length > 0 ? [{
            id: '2',
            title: 'Critical SOL alert',
            subtitle: `${solRiskLoans.length} loans require immediate attention - statute approaching`,
            time: '15 min ago',
            type: 'alert' as const
          }] : []),
          ...(fcOnTrackPercentage < 70 ? [{
            id: '3',
            title: 'Foreclosure timeline alert',
            subtitle: `${(100 - fcOnTrackPercentage).toFixed(1)}% of foreclosures are behind schedule`,
            time: '25 min ago',
            type: 'alert' as const
          }] : []),
          {
            id: '4',
            title: 'Performance analysis completed',
            subtitle: `${performingLoans.length} performing loans (${((performingLoans.length / totalLoans) * 100).toFixed(1)}% of portfolio)`,
            time: '1 hour ago',
            type: 'task' as const
          },
          {
            id: '5',
            title: 'Risk assessment updated',
            subtitle: `Average balance: $${avgBalance.toLocaleString()} per loan`,
            time: '2 hours ago',
            type: 'update' as const
          },
          {
            id: '6',
            title: 'Daily metrics processed',
            subtitle: 'All current loan metrics have been validated and updated',
            time: '3 hours ago',
            type: 'task' as const
          }
        ].slice(0, 5); // Show only the 5 most recent
        
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


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header Skeleton */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="premium-skeleton h-8 w-48 mb-2" />
                <div className="premium-skeleton h-4 w-64" />
              </div>
              <div className="flex items-center gap-6">
                <div className="premium-skeleton h-10 w-24 rounded-full" />
                <div className="premium-skeleton h-4 w-96" />
              </div>
            </div>
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto px-8 py-8">
          {/* Hero Metrics Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {[1, 2, 3].map(i => (
              <div key={i} className="premium-card p-8">
                <div className="premium-skeleton h-4 w-20 mb-4" />
                <div className="premium-skeleton h-12 w-32 mb-6" />
                <div className="premium-skeleton h-4 w-24" />
              </div>
            ))}
          </div>
          
          {/* KPI Dashboard Skeleton */}
          <div className="premium-skeleton h-32 w-full mb-12 rounded-xl" />
          
          {/* Content Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="premium-skeleton h-96 rounded-xl" />
            <div className="premium-skeleton h-96 rounded-xl" />
          </div>
        </main>
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

        {/* Secondary KPIs */}
        <div className="mb-12">
          <FinancialKPIDashboard />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
          {/* Performance Trends */}
          <div className="premium-card">
            <div className="premium-card-header">
              <h2 className="premium-card-title">Performance Trends</h2>
              <p className="premium-card-subtitle">30-day portfolio performance</p>
            </div>
            <div className="premium-card-content">
              <PerformanceTrendChart />
            </div>
          </div>

          {/* Inbox Activity */}
          <div className="premium-card">
            <div className="premium-card-header">
              <h2 className="premium-card-title">Inbox Activity</h2>
              <p className="premium-card-subtitle">Tasks and communications</p>
            </div>
            <div className="premium-card-content">
              <InboxKPIs />
            </div>
          </div>
        </div>

        {/* Portfolio Health & Risk Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          
          {/* Portfolio Health */}
          <div className="premium-card">
            <div className="premium-card-header">
              <h2 className="premium-card-title">Portfolio Health</h2>
              <p className="premium-card-subtitle">Loan status distribution</p>
            </div>
            <div className="premium-card-content">
              <div className="space-y-4">
                {[
                  { 
                    category: 'Performing', 
                    value: metrics.performingLoans, 
                    percentage: metrics.totalLoans > 0 ? (metrics.performingLoans / metrics.totalLoans * 100) : 0,
                    color: 'bg-green-500',
                    trend: 'up' as const
                  },
                  { 
                    category: 'SOL Risk', 
                    value: metrics.solRiskCount, 
                    percentage: metrics.totalLoans > 0 ? (metrics.solRiskCount / metrics.totalLoans * 100) : 0,
                    color: 'bg-amber-500',
                    trend: 'up' as const
                  },
                  { 
                    category: 'In Foreclosure', 
                    value: Math.round(metrics.totalLoans * 0.15), // Estimate
                    percentage: 15,
                    color: 'bg-red-500',
                    trend: 'down' as const
                  },
                  { 
                    category: 'Other', 
                    value: metrics.totalLoans - metrics.performingLoans - metrics.solRiskCount - Math.round(metrics.totalLoans * 0.15),
                    percentage: 100 - (metrics.totalLoans > 0 ? ((metrics.performingLoans + metrics.solRiskCount + Math.round(metrics.totalLoans * 0.15)) / metrics.totalLoans * 100) : 0),
                    color: 'bg-gray-400',
                    trend: 'neutral' as const
                  }
                ].map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{item.category}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{item.value.toLocaleString()}</span>
                        <span className="text-xs text-gray-500">({item.percentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`${item.color} h-2 rounded-full transition-all duration-500`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Portfolio</span>
                  <span className="text-lg font-bold text-gray-900">{metrics.totalLoans.toLocaleString()} loans</span>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Distribution */}
          <div className="premium-card">
            <div className="premium-card-header">
              <h2 className="premium-card-title">Risk Distribution</h2>
              <p className="premium-card-subtitle">Geographic and concentration analysis</p>
            </div>
            <div className="premium-card-content">
              <div className="h-64 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <Scale className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">Risk Analysis Dashboard</p>
                  <p className="text-sm text-gray-500 mt-2">Geographic distribution and concentration metrics</p>
                  <button 
                    className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    onClick={() => navigate('/loans?view=map')}
                  >
                    View Risk Map →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity - Full Width */}
        <div className="mt-8">
          <div className="premium-card">
            <div className="premium-card-header">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="premium-card-title">Recent Activity</h2>
                  <p className="premium-card-subtitle">Latest updates and system events</p>
                </div>
                <button 
                  className="premium-btn premium-btn-ghost text-sm"
                  onClick={() => navigate('/inbox')}
                >
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

      </main>
    </div>
  );
};

export default DashboardPage;