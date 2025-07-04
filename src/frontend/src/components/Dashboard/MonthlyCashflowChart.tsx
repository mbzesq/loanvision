import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import axios from '../../utils/axios';
import '../../styles/design-system.css';

interface MonthlyCashflowData {
  month: string;
  cashflow: number;
}

interface MonthlyCashflowChartProps {}

const MonthlyCashflowChart: React.FC<MonthlyCashflowChartProps> = () => {
  const [data, setData] = useState<MonthlyCashflowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<string>('2025');
  const [investor, setInvestor] = useState<string>('all');
  const [investors, setInvestors] = useState<string[]>([]);

  // Fetch investors list
  useEffect(() => {
    const fetchInvestors = async () => {
      try {
        const response = await axios.get<string[]>('/api/reports/investors');
        setInvestors(response.data);
      } catch (err) {
        console.error('Error fetching investors:', err);
      }
    };

    fetchInvestors();
  }, []);

  // Fetch cashflow data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get<MonthlyCashflowData[]>(`/api/reports/monthly-cashflow?year=${year}&investor=${investor}`);
        setData(response.data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch monthly cashflow data');
        console.error('Error fetching monthly cashflow:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [year, investor]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  if (loading) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e0e0e0',
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p>Loading chart...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e0e0e0',
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p style={{ color: 'red' }}>{error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e0e0e0',
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p>No cashflow data available</p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '24px',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e0e0e0',
      height: '400px'
    }}>
      <h3 style={{
        margin: '0 0 20px 0',
        fontSize: '18px',
        fontWeight: '600',
        color: '#333'
      }}>
        Monthly Cashflow Trends - {year}
      </h3>
      
      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '20px',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ 
            fontSize: 'var(--font-size-sm)', 
            fontWeight: 'var(--font-weight-medium)', 
            color: 'var(--neutral-600)' 
          }}>
            Year:
          </label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: 'var(--font-size-sm)',
              minWidth: '80px'
            }}
          >
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ 
            fontSize: 'var(--font-size-sm)', 
            fontWeight: 'var(--font-weight-medium)', 
            color: 'var(--neutral-600)' 
          }}>
            Investor:
          </label>
          <select
            value={investor}
            onChange={(e) => setInvestor(e.target.value)}
            className="btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: 'var(--font-size-sm)',
              minWidth: '150px'
            }}
          >
            <option value="all">All Investors</option>
            {investors.map(investorName => (
              <option key={investorName} value={investorName}>
                {investorName}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height="75%">
        <AreaChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 20,
          }}
        >
          <defs>
            <linearGradient id="cashflowGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary-blue)" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="var(--primary-blue)" stopOpacity={0.02}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-300)" opacity={0.5} />
          <XAxis 
            dataKey="month"
            tick={{ fontSize: 'var(--font-size-xs)', fill: 'var(--neutral-500)' }}
            stroke="var(--neutral-400)"
            tickLine={false}
          />
          <YAxis 
            tick={{ fontSize: 'var(--font-size-xs)', fill: 'var(--neutral-500)' }}
            tickFormatter={formatCurrency}
            stroke="var(--neutral-400)"
            tickLine={false}
          />
          <Tooltip 
            formatter={(value: number) => [formatCurrency(value), 'Cashflow']}
            labelStyle={{ 
              color: 'var(--neutral-900)',
              fontWeight: 'var(--font-weight-medium)',
              fontSize: 'var(--font-size-sm)'
            }}
            contentStyle={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--neutral-300)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              fontSize: 'var(--font-size-sm)'
            }}
          />
          <Area
            type="monotone"
            dataKey="cashflow"
            stroke="var(--primary-blue)"
            strokeWidth={3}
            fill="url(#cashflowGradient)"
            dot={{ fill: 'var(--primary-blue)', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: 'var(--primary-blue)', strokeWidth: 2, fill: 'var(--bg-primary)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MonthlyCashflowChart;