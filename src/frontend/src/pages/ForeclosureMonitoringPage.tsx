import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle, RefreshCw, Gavel, Activity } from 'lucide-react';
import { foreclosureService, ForeclosureSummary, ForeclosureLoan, ForeclosureStateData } from '../services/foreclosureService';
import { LoanDetailModal } from '../components/LoanDetailModal';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, BarChart, Bar } from 'recharts';

interface ForeclosureTrendData {
  month: string;
  started: number;
  completed: number;
  overdue: number;
  totalActive: number;
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
                trend.value > 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {trend.value > 0 ? '+' : ''}{trend.value}%
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

const ForeclosureMonitoringPage: React.FC = () => {
  const [foreclosureSummary, setForeclosureSummary] = useState<ForeclosureSummary | null>(null);
  const [foreclosureLoans, setForeclosureLoans] = useState<ForeclosureLoan[]>([]);
  const [stateData, setStateData] = useState<ForeclosureStateData[]>([]);
  const [trendData, setTrendData] = useState<ForeclosureTrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  useEffect(() => {
    loadForeclosureData();
  }, []);

  const loadForeclosureData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [summary, loans, states] = await Promise.all([
        foreclosureService.getForeclosureSummary(),
        foreclosureService.getForeclosureLoans(),
        foreclosureService.getForeclosureByState()
      ]);
      
      setForeclosureSummary(summary);
      setForeclosureLoans(loans);
      setStateData(states);
      setTrendData(generateMockTrendData());
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error loading foreclosure data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load foreclosure data');
      if (import.meta.env.DEV) {
        setForeclosureSummary(generateMockSummary());
        setForeclosureLoans(generateMockLoans());
        setStateData(generateMockStateData());
        setTrendData(generateMockTrendData());
      }
    } finally {
      setLoading(false);
    }
  };

  // Mock data generators
  const generateMockSummary = (): ForeclosureSummary => ({
    totalInForeclosure: 47,
    judicialCount: 31,
    nonJudicialCount: 16,
    avgDaysInProcess: 287,
    completedForeclosures: 23,
    statusBreakdown: {
      'Notice of Default': 12,
      'Lis Pendens Filed': 8,
      'Notice of Sale': 15,
      'Foreclosure Sale': 7,
      'REO': 5
    },
    riskDistribution: {
      overdue: 18,
      onTrack: 24,
      completed: 23
    }
  });

  const generateMockLoans = (): ForeclosureLoan[] => [
    {
      loanId: 'FC001',
      borrowerName: 'John Smith',
      state: 'CA',
      jurisdiction: 'Judicial',
      currentMilestone: 'Notice of Sale',
      fcStartDate: '2024-03-15',
      daysInProcess: 298,
      expectedCompletionDate: '2024-09-15',
      status: 'overdue' as const,
      principalBalance: 345000
    },
    // ... more mock data
  ];

  const generateMockStateData = (): ForeclosureStateData[] => [
    { state: 'CA', totalLoans: 12, judicialCount: 0, nonJudicialCount: 12, avgDaysInProcess: 287, completedCount: 5 },
    { state: 'NY', totalLoans: 8, judicialCount: 8, nonJudicialCount: 0, avgDaysInProcess: 365, completedCount: 3 },
    { state: 'FL', totalLoans: 15, judicialCount: 15, nonJudicialCount: 0, avgDaysInProcess: 245, completedCount: 7 },
    { state: 'TX', totalLoans: 12, judicialCount: 0, nonJudicialCount: 12, avgDaysInProcess: 185, completedCount: 3 }
  ];

  const generateMockTrendData = (): ForeclosureTrendData[] => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map((month) => ({
      month,
      started: Math.floor(Math.random() * 10) + 5,
      completed: Math.floor(Math.random() * 8) + 3,
      overdue: Math.floor(Math.random() * 5) + 2,
      totalActive: Math.floor(Math.random() * 20) + 30
    }));
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };


  const getStatusBadge = (status: string): React.ReactNode => {
    const statusConfig = {
      overdue: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
      ontrack: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
      completed: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.ontrack;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
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
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Foreclosure Monitoring</h1>
          <div className="premium-card p-6 border-red-200 bg-red-50">
            <p className="text-red-700">{error}</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Foreclosure Monitoring</h1>
              <p className="text-gray-600">Track and manage foreclosure pipeline performance</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
              <button
                onClick={loadForeclosureData}
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
            title="Total in Foreclosure"
            value={foreclosureSummary?.totalInForeclosure || 0}
            icon={Gavel}
            trend={{ value: 5.2, label: "vs last month" }}
            color="primary"
          />
          
          <PremiumMetricCard
            title="Overdue Cases"
            value={foreclosureSummary?.riskDistribution.overdue || 0}
            icon={AlertTriangle}
            trend={{ value: -2.3, label: "vs last month" }}
            color="danger"
          />
          
          <PremiumMetricCard
            title="Avg Days in Process"
            value={`${foreclosureSummary?.avgDaysInProcess || 0}d`}
            icon={Clock}
            trend={{ value: 3.1, label: "vs avg" }}
            color="warning"
          />
          
          <PremiumMetricCard
            title="Completed YTD"
            value={foreclosureSummary?.completedForeclosures || 0}
            icon={Activity}
            trend={{ value: 8.7, label: "vs last year" }}
            color="success"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          {/* Trend Chart */}
          <div className="premium-card">
            <div className="premium-card-header">
              <h2 className="premium-card-title">Foreclosure Activity Trend</h2>
              <p className="premium-card-subtitle">Monthly foreclosure metrics</p>
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
                    <Line type="monotone" dataKey="started" stroke="#3b82f6" strokeWidth={2} name="Started" />
                    <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} name="Completed" />
                    <Line type="monotone" dataKey="overdue" stroke="#ef4444" strokeWidth={2} name="Overdue" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* State Distribution */}
          <div className="premium-card">
            <div className="premium-card-header">
              <h2 className="premium-card-title">Jurisdiction Breakdown</h2>
              <p className="premium-card-subtitle">Foreclosures by state</p>
            </div>
            <div className="premium-card-content">
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stateData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="state" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="totalLoans" fill="#3b82f6" name="Total" />
                    <Bar dataKey="completedCount" fill="#10b981" name="Completed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Active Foreclosures Table */}
        <div className="premium-card">
          <div className="premium-card-header">
            <h2 className="premium-card-title">Active Foreclosures</h2>
            <p className="premium-card-subtitle">Top 10 cases requiring attention</p>
          </div>
          <div className="premium-card-content">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Loan ID</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Borrower</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">State</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Current Stage</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700 text-sm">Days</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700 text-sm">Balance</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700 text-sm">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {foreclosureLoans.slice(0, 10).map((loan, index) => (
                    <tr key={loan.loanId} className={index !== 9 ? 'border-b border-gray-100' : ''}>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setSelectedLoanId(loan.loanId)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {loan.loanId}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-gray-900">{loan.borrowerName}</td>
                      <td className="py-3 px-4 text-gray-600">{loan.state}</td>
                      <td className="py-3 px-4 text-gray-900">{loan.currentMilestone}</td>
                      <td className={`py-3 px-4 text-right font-medium ${
                        loan.daysInProcess > 300 ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {loan.daysInProcess}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        {formatCurrency(loan.principalBalance)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {getStatusBadge(loan.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Loan Detail Modal */}
      {selectedLoanId && (
        <LoanDetailModal
          onClose={() => setSelectedLoanId(null)}
          loanId={selectedLoanId}
        />
      )}
    </div>
  );
};

export default ForeclosureMonitoringPage;