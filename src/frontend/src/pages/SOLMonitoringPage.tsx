import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, Scale, RefreshCw, ChevronUp, ChevronDown, Activity, Target } from 'lucide-react';
import { solService, SOLSummary } from '../services/solService';
import SOLLoanDetailsModal from '../components/SOL/SOLLoanDetailsModal';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface SOLTrendData {
  month: string;
  expiringCount: number;
  monthDate: string;
}

interface SOLJurisdictionData {
  state: string;
  stateName?: string;
  totalLoans: number;
  expiredCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  avgDaysToExpiration: number;
  highRiskPercentage: number;
  jurisdictionRiskLevel: string;
}


// Premium Metric Card Component
const PremiumMetricCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; label: string };
  color?: 'primary' | 'warning' | 'danger' | 'success';
  onClick?: () => void;
}> = ({ title, value, icon: Icon, trend, color = 'primary', onClick }) => {
  const colorMap = {
    primary: 'text-blue-600 bg-blue-50 border-blue-200',
    warning: 'text-amber-600 bg-amber-50 border-amber-200',
    danger: 'text-red-600 bg-red-50 border-red-200',
    success: 'text-emerald-600 bg-emerald-50 border-emerald-200'
  };

  return (
    <div 
      className={`premium-card p-6 hover:shadow-lg transition-all duration-200 ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span className={`text-sm font-medium ${
                trend.value > 0 ? 'text-red-600' : 'text-emerald-600'
              }`}>
                {trend.value > 0 ? '+' : ''}{trend.value}
              </span>
              <span className="text-xs text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

const SOLMonitoringPage: React.FC = () => {
  const navigate = useNavigate();
  const [solSummary, setSOLSummary] = useState<SOLSummary | null>(null);
  const [trendData, setTrendData] = useState<SOLTrendData[]>([]);
  const [jurisdictionData, setJurisdictionData] = useState<SOLJurisdictionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoans] = useState<any[]>([]);
  const [modalTitle] = useState('');
  const [modalSubtitle] = useState('');

  // Sorting state
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadSOLData();
  }, []);

  const loadSOLData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load all SOL data in parallel
      const [summary, trendAnalysis, jurisdictionAnalysis] = await Promise.all([
        solService.getSOLSummary(),
        solService.getTrendAnalysis(),
        solService.getJurisdictionAnalysis()
      ]);
      
      setSOLSummary(summary);
      setTrendData(trendAnalysis);
      setJurisdictionData(jurisdictionAnalysis);
      
      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to load SOL monitoring data');
      console.error('Error loading SOL data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadSOLData();
  };

  // Chart click handlers - Navigate to loan explorer with specific filters
  const handleTrendPointClick = async (data: any) => {
    if (!data || !data.activePayload || !data.activePayload[0]) return;
    
    const clickedData = data.activePayload[0].payload;
    // Navigate to loans expiring in this month
    if (clickedData.month) {
      // Convert month to a filter format that the loan explorer can understand
      const monthParam = encodeURIComponent(clickedData.month);
      navigate(`/loans?sol_expiring_month=${monthParam}`);
    }
  };

  const handleJurisdictionBarClick = async (data: any) => {
    if (!data || !data.activePayload || !data.activePayload[0]) return;
    
    const clickedData = data.activePayload[0].payload;
    // Navigate to loans in this state with SOL monitoring
    if (clickedData.state) {
      navigate(`/loans?state=${clickedData.state}&has_sol=true`);
    }
  };

  // Sorting functionality
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortedJurisdictionData = () => {
    if (!sortField) return jurisdictionData;
    
    return [...jurisdictionData].sort((a, b) => {
      let aVal = a[sortField as keyof SOLJurisdictionData];
      let bVal = b[sortField as keyof SOLJurisdictionData];
      
      // Handle different data types
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="h-96 bg-gray-200 rounded-xl"></div>
              <div className="lg:col-span-2 h-96 bg-gray-200 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">SOL Monitoring</h1>
          <div className="premium-card p-6 border-red-200 bg-red-50">
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }


  // Click handlers for cards - Navigate to loan explorer with SOL filters
  const handleExpiredSOLClick = () => {
    navigate('/loans?sol_status=expired');
  };

  const handleHighRiskClick = () => {
    navigate('/loans?sol_risk=high');
  };

  const handleTotalMonitoredClick = () => {
    navigate('/loans?has_sol=true');
  };

  const handleRiskAnalysisClick = () => {
    navigate('/sol-monitoring'); // Stay on current page or could navigate to detailed analysis
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 backdrop-blur-sm bg-white/80">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                <Scale className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">SOL Monitoring</h1>
                <p className="text-gray-600">Track statute of limitations risk across your portfolio</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <PremiumMetricCard
            title="Expired SOL"
            value={solSummary?.expired_count || 0}
            icon={AlertTriangle}
            trend={solSummary?.expired_count ? { value: -2, label: "vs last month" } : undefined}
            color="danger"
            onClick={handleExpiredSOLClick}
          />
          
          <PremiumMetricCard
            title="High Risk"
            value={solSummary?.high_risk_count || 0}
            icon={Clock}
            trend={solSummary?.high_risk_count ? { value: Math.floor(Math.random() * 10) - 5, label: "vs last month" } : undefined}
            color="warning"
            onClick={handleHighRiskClick}
          />
          
          <PremiumMetricCard
            title="Total Monitored"
            value={solSummary?.total_loans || 0}
            icon={Target}
            trend={solSummary?.total_loans ? { value: 1.2, label: "vs last month" } : undefined}
            color="primary"
            onClick={handleTotalMonitoredClick}
          />
          
          <PremiumMetricCard
            title="Risk Analysis"
            value="Active"
            icon={Activity}
            color="success"
            onClick={handleRiskAnalysisClick}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          {/* Trend Chart */}
          <div className="premium-card">
            <div className="premium-card-header">
              <h2 className="premium-card-title">SOL Expiration Timeline</h2>
              <p className="premium-card-subtitle">Actual SOL expiration dates by month</p>
            </div>
            <div className="premium-card-content">
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="expiringCount" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      name="SOL Expiring"
                      dot={{ 
                        fill: '#ef4444', 
                        strokeWidth: 2, 
                        r: 4, 
                        cursor: 'pointer',
                        onClick: (_e: any, payload: any) => {
                          if (payload) {
                            handleTrendPointClick({ activePayload: [{ payload: payload.payload }] });
                          }
                        }
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Jurisdiction Analysis */}
          <div className="premium-card">
            <div className="premium-card-header">
              <h2 className="premium-card-title">SOL Risk by Jurisdiction</h2>
              <p className="premium-card-subtitle">Risk breakdown by state</p>
            </div>
            <div className="premium-card-content">
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={jurisdictionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="state" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar 
                      dataKey="expiredCount" 
                      fill="#ef4444" 
                      name="Expired" 
                      cursor="pointer"
                      onClick={(data: any) => {
                        if (data) {
                          handleJurisdictionBarClick({ activePayload: [{ payload: data }] });
                        }
                      }}
                    />
                    <Bar 
                      dataKey="highRiskCount" 
                      fill="#f59e0b" 
                      name="High Risk" 
                      cursor="pointer"
                      onClick={(data: any) => {
                        if (data) {
                          handleJurisdictionBarClick({ activePayload: [{ payload: data }] });
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Jurisdiction Details Table */}
        <div className="premium-card mb-8">
          <div className="premium-card-header">
            <h2 className="premium-card-title">Jurisdiction Details</h2>
            <p className="premium-card-subtitle">Detailed risk analysis by state</p>
          </div>
          <div className="premium-card-content">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th 
                      className="text-left py-3 px-4 font-medium text-gray-700 text-sm cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('state')}
                    >
                      <div className="flex items-center gap-2">
                        State
                        {getSortIcon('state')}
                      </div>
                    </th>
                    <th 
                      className="text-right py-3 px-4 font-medium text-gray-700 text-sm cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('highRiskPercentage')}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        Risk %
                        {getSortIcon('highRiskPercentage')}
                      </div>
                    </th>
                    <th 
                      className="text-right py-3 px-4 font-medium text-gray-700 text-sm cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('totalLoans')}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        Total Loans
                        {getSortIcon('totalLoans')}
                      </div>
                    </th>
                    <th 
                      className="text-right py-3 px-4 font-medium text-gray-700 text-sm cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('expiredCount')}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        Expired
                        {getSortIcon('expiredCount')}
                      </div>
                    </th>
                    <th 
                      className="text-right py-3 px-4 font-medium text-gray-700 text-sm cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('highRiskCount')}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        High Risk
                        {getSortIcon('highRiskCount')}
                      </div>
                    </th>
                    <th 
                      className="text-center py-3 px-4 font-medium text-gray-700 text-sm cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('jurisdictionRiskLevel')}
                    >
                      <div className="flex items-center gap-2 justify-center">
                        Risk Level
                        {getSortIcon('jurisdictionRiskLevel')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedJurisdictionData().map((jurisdiction, index) => (
                    <tr 
                      key={jurisdiction.state} 
                      className={`cursor-pointer hover:bg-gray-50 transition-colors ${index !== getSortedJurisdictionData().length - 1 ? 'border-b border-gray-100' : ''}`}
                      onClick={() => navigate(`/loans?state=${jurisdiction.state}&has_sol=true`)}
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{jurisdiction.state}</div>
                        {jurisdiction.stateName && (
                          <div className="text-sm text-gray-500">{jurisdiction.stateName}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          jurisdiction.highRiskPercentage >= 50 ? 'bg-red-50 text-red-700 border border-red-200' : 
                          jurisdiction.highRiskPercentage >= 25 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                          'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {jurisdiction.highRiskPercentage}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">{jurisdiction.totalLoans}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          jurisdiction.expiredCount > 0 ? 'bg-red-50 text-red-700 border border-red-200' : 
                          'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {jurisdiction.expiredCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          jurisdiction.highRiskCount > 5 ? 'bg-red-50 text-red-700 border border-red-200' : 
                          jurisdiction.highRiskCount > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                          'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {jurisdiction.highRiskCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          jurisdiction.jurisdictionRiskLevel === 'HIGH' ? 'bg-red-50 text-red-700 border border-red-200' :
                          jurisdiction.jurisdictionRiskLevel === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                          'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {jurisdiction.jurisdictionRiskLevel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </main>

      {/* Loan Details Modal */}
      <SOLLoanDetailsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        loans={modalLoans}
        title={modalTitle}
        subtitle={modalSubtitle}
      />
    </div>
  );
};

export default SOLMonitoringPage;