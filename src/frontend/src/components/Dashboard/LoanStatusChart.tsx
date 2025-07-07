import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import axios from '../../utils/axios';
import interactionManager from '../../services/InteractionManager';
import '../../styles/design-system.css';

interface LoanStatusData {
  status: string;
  count: number;
}

const LoanStatusChart: React.FC = () => {
  const [data, setData] = useState<LoanStatusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching loan status distribution...');
        const response = await axios.get<LoanStatusData[]>('/api/reports/loan-status-distribution');
        console.log('Loan status response:', response.data);
        setData(response.data);
      } catch (err) {
        setError('Failed to fetch loan status distribution');
        console.error('Error fetching loan status distribution:', err);
        console.error('Error details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Softer, more sophisticated color palette
  const MODERN_COLORS = [
    '#3B82F6', // Softer Blue
    '#22C55E', // Softer Green  
    '#F59E0B', // Balanced Orange
    '#EF4444', // Controlled Red
    '#A855F7', // Softer Purple
    '#14B8A6', // Softer Teal
    '#84CC16', // Natural Lime
    '#F97316', // Warm Orange
  ];

  // Handle pie slice click
  const handleSliceClick = (entry: LoanStatusData, index: number) => {
    const mockCalculatedData = {
      totalUPB: entry.count * 150000, // Mock calculation
      avgDaysInStatus: Math.floor(Math.random() * 90) + 30, // Mock data
      subCategories: [
        { name: '0-30 days', count: Math.floor(entry.count * 0.6) },
        { name: '31-60 days', count: Math.floor(entry.count * 0.3) },
        { name: '60+ days', count: Math.floor(entry.count * 0.1) }
      ]
    };

    interactionManager.handleChartClick({
      chartType: 'pie-status',
      dataPoint: {
        status: entry.status,
        count: entry.count,
        ...mockCalculatedData
      },
      context: { chartType: 'loan-status', colorIndex: index }
    });
  };

  // Handle legend item click for filtering
  const handleLegendClick = (entry: any) => {
    console.log('Legend clicked:', entry);
    // This could toggle filters instead of showing modal
    interactionManager.setFilter('status', entry.value);
  };

  if (loading) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div className="loading-shimmer" style={{ 
          width: '200px', 
          height: '200px', 
          borderRadius: '50%' 
        }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--neutral-500)'
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p style={{ 
          marginTop: 'var(--space-md)', 
          fontSize: 'var(--font-size-sm)',
          color: 'var(--warning-red)'
        }}>
          {error}
        </p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--neutral-500)'
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        <p style={{ 
          marginTop: 'var(--space-md)', 
          fontSize: 'var(--font-size-sm)'
        }}>
          No loan status data available
        </p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--neutral-500)',
        fontSize: 'var(--font-size-sm)'
      }}>
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={100}
          innerRadius={40}
          fill="var(--primary-blue)"
          dataKey="count"
          nameKey="status"
          stroke="var(--bg-primary)"
          strokeWidth={3}
          paddingAngle={2}
          onClick={handleSliceClick}
        >
          {data.map((_, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={MODERN_COLORS[index % MODERN_COLORS.length]}
              className="pie-slice-clickable"
            />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value: number) => [value.toLocaleString(), 'Loans']}
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
        <Legend 
          verticalAlign="bottom" 
          height={50}
          iconType="circle"
          onClick={handleLegendClick}
          wrapperStyle={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--neutral-600)',
            fontWeight: 'var(--font-weight-medium)',
            paddingTop: 'var(--space-md)',
            cursor: 'pointer'
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default LoanStatusChart;