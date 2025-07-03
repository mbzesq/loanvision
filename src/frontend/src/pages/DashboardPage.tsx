import { useEffect, useState } from 'react';
import SummaryCard from '../components/Dashboard/SummaryCard';
import LoanStatusChart from '../components/Dashboard/LoanStatusChart';
import GeographicalChart from '../components/Dashboard/GeographicalChart';
import MonthlyCashflowChart from '../components/Dashboard/MonthlyCashflowChart';
import axios from '../utils/axios';

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

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'red' }}>{error}</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>No data available</p>
      </div>
    );
  }

  // Format currency values
  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  return (
    <div style={{ padding: '40px' }}>
      <h1 style={{ marginBottom: '32px' }}>Portfolio Dashboard</h1>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px',
        marginBottom: '40px'
      }}>
        <SummaryCard 
          title="Total UPB" 
          value={formatCurrency(summary.totalUPB)} 
        />
        <SummaryCard 
          title="Loan Count" 
          value={summary.loanCount.toLocaleString()} 
        />
        <SummaryCard 
          title="Average Balance" 
          value={formatCurrency(summary.averageBalance)} 
        />
      </div>

      {/* Charts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
        gap: '24px',
        marginBottom: '40px'
      }}>
        <LoanStatusChart />
        <GeographicalChart />
      </div>

      {/* Monthly Cashflow Chart - Full Width */}
      <div style={{ marginBottom: '40px' }}>
        <MonthlyCashflowChart />
      </div>
    </div>
  );
}

export default DashboardPage;