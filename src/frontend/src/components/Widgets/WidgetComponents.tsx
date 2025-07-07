import React, { useEffect, useState } from 'react';
import ModernKPICard from '../Dashboard/ModernKPICard';
import UniversalAlertsPanel from '../Alerts/UniversalAlertsPanel';
import SOLMonitorCard from '../Dashboard/SOLMonitorCard';
import LoanStatusChart from '../Dashboard/LoanStatusChart';
import GeographicalDistributionChart from '../Dashboard/GeographicalDistributionChart';
import MonthlyCashflowChart from '../Dashboard/MonthlyCashflowChart';
import ForeclosureTrackingChart from '../Dashboard/ForeclosureTrackingChart';
import ModernChartContainer from '../Dashboard/ModernChartContainer';
import axios from '../../utils/axios';
import { DollarSign, TrendingUp, Calculator, BarChart3 } from 'lucide-react';

// Portfolio Summary Interface
interface PortfolioSummary {
  loanCount: number;
  totalUPB: number;
  averageBalance: number;
}

// KPI Widget Components
export const UPBWidget: React.FC<{ refreshKey?: number }> = ({ refreshKey }) => {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get<PortfolioSummary>('/api/portfolio/summary');
        setSummary(response.data);
      } catch (error) {
        console.error('Failed to fetch portfolio summary:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [refreshKey]);

  if (loading || !summary) {
    return <div className="h-full flex items-center justify-center text-gray-500">Loading...</div>;
  }

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  return (
    <div className="h-full w-full">
      <ModernKPICard
        title="Total UPB"
        value={formatCurrency(summary.totalUPB)}
        trend={{ value: 5.2, direction: 'up', period: 'last month' }}
        icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />}
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
    </div>
  );
};

export const LoanCountWidget: React.FC<{ refreshKey?: number }> = ({ refreshKey }) => {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get<PortfolioSummary>('/api/portfolio/summary');
        setSummary(response.data);
      } catch (error) {
        console.error('Failed to fetch portfolio summary:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [refreshKey]);

  if (loading || !summary) {
    return <div className="h-full flex items-center justify-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="h-full w-full">
      <ModernKPICard
        title="Loan Count"
        value={summary.loanCount.toLocaleString()}
        trend={{ value: 12, direction: 'up', period: 'last month' }}
        icon={<BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />}
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
    </div>
  );
};

export const AverageBalanceWidget: React.FC<{ refreshKey?: number }> = ({ refreshKey }) => {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get<PortfolioSummary>('/api/portfolio/summary');
        setSummary(response.data);
      } catch (error) {
        console.error('Failed to fetch portfolio summary:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [refreshKey]);

  if (loading || !summary) {
    return <div className="h-full flex items-center justify-center text-gray-500">Loading...</div>;
  }

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  return (
    <div className="h-full w-full">
      <ModernKPICard
        title="Average Balance"
        value={formatCurrency(summary.averageBalance)}
        trend={{ value: 2.1, direction: 'down', period: 'last month' }}
        icon={<Calculator className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />}
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
    </div>
  );
};

export const PerformanceWidget: React.FC = () => {
  return (
    <div className="h-full w-full">
      <ModernKPICard
        title="Performance"
        value="94.2%"
        trend={{ value: 1.8, direction: 'up', period: 'last quarter' }}
        icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />}
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
  );
};

// Chart Widget Components
export const AlertsWidget: React.FC = () => {
  return (
    <div className="h-full w-full overflow-hidden">
      <UniversalAlertsPanel 
        className="h-full w-full"
        maxAlerts={6}
        showSettings={false}
        autoRefresh={true}
      />
    </div>
  );
};

export const SOLMonitorWidget: React.FC = () => {
  return (
    <div className="h-full w-full">
      <SOLMonitorCard />
    </div>
  );
};

export const LoanStatusWidget: React.FC = () => {
  return (
    <div className="h-full w-full">
      <ModernChartContainer
        title="Loan Status Distribution"
        subtitle="Current portfolio breakdown by loan status"
      >
        <div className="h-full w-full">
          <LoanStatusChart />
        </div>
      </ModernChartContainer>
    </div>
  );
};

export const GeographicalWidget: React.FC = () => {
  return (
    <div className="h-full w-full">
      <ModernChartContainer
        title="Geographic Distribution"
        subtitle="Loan distribution across states"
      >
        <div className="h-full w-full">
          <GeographicalDistributionChart />
        </div>
      </ModernChartContainer>
    </div>
  );
};

export const CashflowWidget: React.FC = () => {
  return (
    <div className="h-full w-full">
      <ModernChartContainer
        title="Cashflow Analysis"
        subtitle="Monthly payment trends and investor breakdown"
      >
        <div className="h-full w-full">
          <MonthlyCashflowChart />
        </div>
      </ModernChartContainer>
    </div>
  );
};

export const ForeclosureWidget: React.FC = () => {
  return (
    <div className="h-full w-full">
      <ModernChartContainer
        title="Foreclosure Pipeline"
        subtitle="Active foreclosure status and milestone tracking"
      >
        <div className="h-full w-full">
          <ForeclosureTrackingChart />
        </div>
      </ModernChartContainer>
    </div>
  );
};