import { useEffect, useState } from 'react';
import ModernKPICard from '../components/Dashboard/ModernKPICard';
import ModernChartContainer from '../components/Dashboard/ModernChartContainer';
import LoanStatusChart from '../components/Dashboard/LoanStatusChart';
import GeographicalDistributionChart from '../components/Dashboard/GeographicalDistributionChart';
import MonthlyCashflowChart from '../components/Dashboard/MonthlyCashflowChart';
import ForeclosureTrackingChart from '../components/Dashboard/ForeclosureTrackingChart';
import axios from '../utils/axios';
import '../styles/design-system.css';

interface PortfolioSummary {
  loanCount: number;
  totalUPB: number;
  averageBalance: number;
}

function DashboardPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortfolioSummary = async () => {
      try {
        const response = await axios.get<PortfolioSummary>('/api/portfolio/summary');
        setSummary(response.data);
      } catch (err) {
        setError('Failed to fetch portfolio summary');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolioSummary();
  }, []);

  // Format currency values
  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Calculate portfolio trends (mock data for demo)
  const getPortfolioTrends = () => {
    return {
      upb: { value: 5.2, direction: 'up' as const, period: 'last month' },
      loans: { value: 12, direction: 'up' as const, period: 'last month' },
      avgBalance: { value: 2.1, direction: 'down' as const, period: 'last month' }
    };
  };

  const trends = getPortfolioTrends();

  // Icons for KPI cards
  const DollarIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  );

  const TrendingUpIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
      <polyline points="17 6 23 6 23 12"></polyline>
    </svg>
  );

  const CalculatorIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2"></rect>
      <line x1="8" y1="6" x2="16" y2="6"></line>
      <line x1="8" y1="10" x2="8" y2="10"></line>
      <line x1="12" y1="10" x2="12" y2="10"></line>
      <line x1="16" y1="10" x2="16" y2="10"></line>
      <line x1="8" y1="14" x2="8" y2="14"></line>
      <line x1="12" y1="14" x2="12" y2="14"></line>
      <line x1="16" y1="14" x2="16" y2="14"></line>
      <line x1="8" y1="18" x2="8" y2="18"></line>
      <line x1="12" y1="18" x2="12" y2="18"></line>
      <line x1="16" y1="18" x2="16" y2="18"></line>
    </svg>
  );

  const FileTextIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  );

  if (loading) {
    return (
      <div style={{ 
        padding: 'var(--space-3xl)', 
        textAlign: 'center',
        background: 'var(--bg-secondary)',
        minHeight: '100vh'
      }}>
        <div className="loading-shimmer" style={{ 
          width: '200px', 
          height: '20px', 
          margin: '0 auto',
          borderRadius: 'var(--radius-md)'
        }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: 'var(--space-3xl)', 
        textAlign: 'center',
        background: 'var(--bg-secondary)',
        minHeight: '100vh'
      }}>
        <p style={{ color: 'var(--warning-red)', fontSize: 'var(--font-size-lg)' }}>{error}</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{ 
        padding: 'var(--space-3xl)', 
        textAlign: 'center',
        background: 'var(--bg-secondary)',
        minHeight: '100vh'
      }}>
        <p style={{ color: 'var(--neutral-600)', fontSize: 'var(--font-size-lg)' }}>No data available</p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: 'var(--space-3xl)', 
      background: 'var(--bg-secondary)',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{ 
        marginBottom: 'var(--space-2xl)'
      }}>
        <h1 style={{ 
          margin: 0,
          fontSize: 'var(--font-size-3xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--neutral-900)',
          lineHeight: 'var(--line-height-tight)'
        }}>
          Portfolio Dashboard
        </h1>
        <p style={{
          margin: 'var(--space-xs) 0 0 0',
          fontSize: 'var(--font-size-lg)',
          color: 'var(--neutral-600)',
          fontWeight: 'var(--font-weight-normal)'
        }}>
          Real-time insights into your loan portfolio performance
        </p>
      </div>
      
      {/* KPI Cards Grid */}
      <div className="kpi-grid mb-2xl">
        <ModernKPICard
          title="Total UPB"
          value={formatCurrency(summary.totalUPB)}
          trend={trends.upb}
          icon={<DollarIcon />}
          color="blue"
          clickable={true}
          drillDownData={{
            filters: { sortBy: 'upb', order: 'desc' },
            breakdown: {
              byStatus: summary.totalUPB * 0.4,
              byGeography: summary.totalUPB * 0.6
            },
            historicalData: [
              { month: 'Jan', value: summary.totalUPB * 0.95 },
              { month: 'Feb', value: summary.totalUPB * 0.98 },
              { month: 'Mar', value: summary.totalUPB }
            ]
          }}
        />
        <ModernKPICard
          title="Loan Count"
          value={summary.loanCount.toLocaleString()}
          trend={trends.loans}
          icon={<FileTextIcon />}
          color="green"
          clickable={true}
          drillDownData={{
            filters: { sortBy: 'count', showDistribution: true },
            breakdown: {
              current: Math.floor(summary.loanCount * 0.7),
              delinquent: Math.floor(summary.loanCount * 0.2),
              foreclosure: Math.floor(summary.loanCount * 0.1)
            }
          }}
        />
        <ModernKPICard
          title="Average Balance"
          value={formatCurrency(summary.averageBalance)}
          trend={trends.avgBalance}
          icon={<CalculatorIcon />}
          color="orange"
          clickable={true}
          drillDownData={{
            filters: { sortBy: 'balance', showDistribution: true },
            breakdown: {
              median: summary.averageBalance * 0.85,
              mean: summary.averageBalance,
              p90: summary.averageBalance * 1.4
            }
          }}
        />
        <ModernKPICard
          title="Performance"
          value="94.2%"
          trend={{ value: 1.8, direction: 'up', period: 'last quarter' }}
          icon={<TrendingUpIcon />}
          color="green"
          format="percentage"
          clickable={true}
          drillDownData={{
            filters: { showPerformanceMetrics: true },
            breakdown: {
              collections: 94.2,
              onTime: 89.5,
              recovery: 98.1
            },
            historicalData: [
              { month: 'Q1', value: 92.4 },
              { month: 'Q2', value: 93.8 },
              { month: 'Q3', value: 94.2 }
            ]
          }}
        />
      </div>

      {/* Charts Grid */}
      <div className="chart-grid">
        {/* Chart 1: Loan Status */}
        <ModernChartContainer
          title="Loan Status Distribution"
          subtitle="Current portfolio breakdown by loan status"
        >
          <LoanStatusChart />
        </ModernChartContainer>

        {/* Chart 2: Geographical Distribution */}
        <ModernChartContainer
          title="Geographic Distribution"
          subtitle="Loan distribution across states"
        >
          <GeographicalDistributionChart />
        </ModernChartContainer>

        {/* Chart 3: Monthly Cashflow */}
        <ModernChartContainer
          title="Cashflow Analysis"
          subtitle="Monthly payment trends and investor breakdown"
        >
          <MonthlyCashflowChart />
        </ModernChartContainer>

        {/* Chart 4: Foreclosure Tracking */}
        <ModernChartContainer
          title="Foreclosure Pipeline"
          subtitle="Active foreclosure status and milestone tracking"
        >
          <ForeclosureTrackingChart />
        </ModernChartContainer>
      </div>
    </div>
  );
}

export default DashboardPage;