import { useEffect, useState } from 'react';
import SummaryCard from '../components/Dashboard/SummaryCard';
import LoanStatusChart from '../components/Dashboard/LoanStatusChart';
import GeographicalDistributionChart from '../components/Dashboard/GeographicalDistributionChart';
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
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

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
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '32px' 
      }}>
        <h1 style={{ margin: 0 }}>Portfolio Dashboard</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '14px', color: '#666' }}>Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              backgroundColor: 'white',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </select>
        </div>
      </div>
      
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Chart 1: Loan Status */}
        <LoanStatusChart />

        {/* Chart 2: Geographical Distribution */}
        <GeographicalDistributionChart />

        {/* Chart 3: Monthly Cashflow */}
        <MonthlyCashflowChart year={selectedYear} />

        {/* Chart 4: Placeholder for Key Metric TBD */}
        <div className="bg-slate-800 p-6 rounded-lg text-white h-[400px]">
          <h3 className="font-semibold mb-4">Key Metric TBD</h3>
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>Chart coming soon.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;