import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SummaryCard from '../components/Dashboard/SummaryCard';
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

      <div style={{ 
        marginTop: '40px',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px'
      }}>
        <h2 style={{ marginBottom: '16px' }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <Link 
            to="/upload" 
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '16px'
            }}
          >
            Upload New File
          </Link>
          <Link 
            to="/loans" 
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '16px'
            }}
          >
            View All Loans
          </Link>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;