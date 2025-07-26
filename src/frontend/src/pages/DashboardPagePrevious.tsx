import { FinancialKPIDashboard } from '../components/FinancialKPIDashboard';
import { PerformanceTrendChart } from '../components/PerformanceTrendChart';
import { InboxKPIs } from '../components/InboxKPIs';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, TrendingDown, Activity, AlertCircle } from 'lucide-react';


interface Loan {
  loan_id: string;
  legal_status: string;
  prin_bal: string;
  pi_pmt: string | number;
  next_pymt_due: string;
  last_pymt_received: string;
  fc_status?: string;
  january_2025?: string | number;
  february_2025?: string | number;
  march_2025?: string | number;
  april_2025?: string | number;
  may_2025?: string | number;
  june_2025?: string | number;
  july_2025?: string | number;
  august_2025?: string | number;
  september_2025?: string | number;
  october_2025?: string | number;
  november_2025?: string | number;
  december_2025?: string | number;
}

// Hero Metric Component - Level 1 Typography (Most Important)
const HeroMetric = ({ 
  value, 
  label, 
  trend, 
  trendValue, 
  onClick,
  sparklineData = []
}: {
  value: string;
  label: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  onClick?: () => void;
  sparklineData?: number[];
}) => {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Activity;
  const trendColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400';
  
  return (
    <div 
      className={`group cursor-pointer transition-all duration-300 hover:scale-[1.02] ${onClick ? 'hover:shadow-lg' : ''}`}
      onClick={onClick}
    >
      {/* Hero Value - Level 1 Typography */}
      <div className="text-5xl font-bold text-gray-900 leading-none mb-2">
        {value}
      </div>
      
      {/* Label - Level 3 Typography */}
      <div className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-3">
        {label}
      </div>
      
      {/* Trend Indicator */}
      <div className={`flex items-center gap-2 ${trendColor}`}>
        <TrendIcon className="w-4 h-4" />
        <span className="text-sm font-semibold">{trendValue}</span>
        <span className="text-xs text-gray-500">vs last month</span>
      </div>
      
      {/* Sparkline (when data provided) */}
      {sparklineData.length > 0 && (
        <div className="mt-4 h-8 opacity-60 group-hover:opacity-100 transition-opacity">
          <svg className="w-full h-full" viewBox="0 0 100 20">
            <polyline 
              fill="none" 
              stroke={trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#9ca3af'} 
              strokeWidth="2"
              points={sparklineData.map((val, idx) => `${(idx / (sparklineData.length - 1)) * 100},${20 - (val * 18)}`).join(' ')}
            />
          </svg>
        </div>
      )}
    </div>
  );
};

// Market Ticker - Minimal and Contextual
const MarketTicker = () => (
  <div className="flex items-center justify-end gap-8 text-xs text-gray-500 py-2">
    <div className="flex items-center gap-1">
      <span>10Y</span>
      <span className="font-medium text-gray-700">4.23%</span>
      <span className="text-emerald-500">+2bp</span>
    </div>
    <div className="flex items-center gap-1">
      <span>30Y FRM</span>
      <span className="font-medium text-gray-700">6.81%</span>
      <span className="text-emerald-500">+5bp</span>
    </div>
    <div className="flex items-center gap-1">
      <span>VIX</span>
      <span className="font-medium text-gray-700">16.82</span>
      <span className="text-emerald-500">+0.45</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
      <span className="font-medium text-gray-700">LIVE</span>
    </div>
  </div>
);

// Interactive Alert Badge
const AlertBadge = ({ count, onClick }: { count: number; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium rounded-full transition-colors"
  >
    <AlertCircle className="w-4 h-4" />
    <span>{count} alerts</span>
  </button>
);

function DashboardPage() {  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoanData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
        await axios.get<Loan[]>(`${apiUrl}/api/v2/loans`);
        // const loans = response.data;
        
        // Process data (existing logic)
        // [... existing data processing logic ...]
        setLoading(false);
      } catch (error) {
        console.error('Error fetching loan data:', error);
        setLoading(false);
      }
    };
    
    fetchLoanData();
  }, []);

  // Mock data for demo - replace with real calculations
  const portfolioTotalUpb = 64000000;
  const avgBalance = 70500;
  const performingLoans = 1247;
  const alertCount = 6;

  const handleMetricClick = (metric: string) => {
    console.log(`Navigate to ${metric} details`);
    // Implement navigation or filtering
  };

  const handleAlertsClick = () => {
    console.log('Navigate to alerts');
    // Navigate to alerts page
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal Header - Consolidated */}
      <div className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Page Context */}
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Portfolio Dashboard</h1>
              <div className="text-sm text-gray-500 mt-1">NPL-MAIN • {format(new Date(), 'MMM d, yyyy')}</div>
            </div>
            
            {/* Right: Market Context + Alerts */}
            <div className="flex items-center gap-6">
              <AlertBadge count={alertCount} onClick={handleAlertsClick} />
              <MarketTicker />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 8px Grid System */}
      <div className="max-w-7xl mx-auto px-8">
        
        {/* Hero Metrics Section */}
        <div className="py-16">
          <div className="grid grid-cols-3 gap-16">
            <HeroMetric
              value={loading ? '...' : `$${(portfolioTotalUpb / 1000000).toFixed(1)}M`}
              label="Total UPB"
              trend="up"
              trendValue="+2.4%"
              onClick={() => handleMetricClick('upb')}
              sparklineData={[0.3, 0.4, 0.35, 0.5, 0.45, 0.6, 0.65, 0.7, 0.8, 0.75]}
            />
            
            <HeroMetric
              value={loading ? '...' : `$${(avgBalance / 1000).toFixed(0)}K`}
              label="Avg Balance"
              trend="up"
              trendValue="+3.2%"
              onClick={() => handleMetricClick('balance')}
              sparklineData={[0.4, 0.45, 0.5, 0.48, 0.52, 0.58, 0.6, 0.65, 0.7, 0.72]}
            />
            
            <HeroMetric
              value={loading ? '...' : performingLoans.toLocaleString()}
              label="Performing Loans"
              trend="up"
              trendValue="+18"
              onClick={() => handleMetricClick('performing')}
              sparklineData={[0.6, 0.62, 0.58, 0.65, 0.68, 0.7, 0.72, 0.75, 0.78, 0.8]}
            />
          </div>
        </div>

        {/* Secondary Metrics - Data as Interface */}
        <div className="py-8 border-t border-gray-50">
          <FinancialKPIDashboard />
        </div>

        {/* Analytics Grid - Elevated Importance */}
        <div className="py-16">
          <div className="grid grid-cols-2 gap-16">
            
            {/* Performance Trends - Clean Title Treatment */}
            <div>
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Performance Trends</h2>
                <p className="text-sm text-gray-500">30-day view</p>
              </div>
              <PerformanceTrendChart />
            </div>

            {/* Inbox Activity - Contextual */}
            <div>
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Recent Activity</h2>
                <p className="text-sm text-gray-500">Tasks and communications</p>
              </div>
              <InboxKPIs />
            </div>
          </div>
        </div>

        {/* Risk Distribution Placeholder - Data-First Approach */}
        <div className="py-16 border-t border-gray-50">
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Geographic Distribution</h2>
            <p className="text-sm text-gray-500">Click any state to filter portfolio</p>
          </div>
          
          {/* Interactive Placeholder */}
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer group">
            <div className="text-center">
              <div className="text-gray-400 mb-2">
                <Activity className="w-8 h-8 mx-auto" />
              </div>
              <p className="text-sm font-medium text-gray-600 group-hover:text-gray-900">Interactive Risk Map</p>
              <p className="text-xs text-gray-500 mt-1">Geographic and sector risk breakdown</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default DashboardPage;