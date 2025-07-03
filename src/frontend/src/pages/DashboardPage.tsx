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

      {/* 2x2 Charts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(1, 1fr)',
        gap: '24px',
        marginBottom: '40px'
      }} 
      className="md:grid-cols-2">
        {/* Chart 1: Loan Status */}
        <LoanStatusChart />

        {/* Chart 2: Placeholder for Geographical Distribution */}
        <div style={{
          backgroundColor: '#1e293b',
          padding: '24px',
          borderRadius: '8px',
          color: 'white',
          height: '400px'
        }}>
          <h3 style={{
            fontWeight: '600',
            marginBottom: '16px',
            fontSize: '18px'
          }}>
            Geographical Distribution
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 'calc(100% - 40px)',
            color: '#94a3b8'
          }}>
            <p>Map visualization coming soon.</p>
          </div>
        </div>

        {/* Chart 3: Placeholder for Monthly Cashflow */}
        <div style={{
          backgroundColor: '#1e293b',
          padding: '24px',
          borderRadius: '8px',
          color: 'white',
          height: '400px'
        }}>
          <h3 style={{
            fontWeight: '600',
            marginBottom: '16px',
            fontSize: '18px'
          }}>
            Monthly Cashflow
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 'calc(100% - 40px)',
            color: '#94a3b8'
          }}>
            <p>Cashflow data coming soon.</p>
          </div>
        </div>

        {/* Chart 4: Placeholder for TBD */}
        <div style={{
          backgroundColor: '#1e293b',
          padding: '24px',
          borderRadius: '8px',
          color: 'white',
          height: '400px'
        }}>
          <h3 style={{
            fontWeight: '600',
            marginBottom: '16px',
            fontSize: '18px'
          }}>
            Key Metric TBD
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 'calc(100% - 40px)',
            color: '#94a3b8'
          }}>
            <p>Chart coming soon.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;