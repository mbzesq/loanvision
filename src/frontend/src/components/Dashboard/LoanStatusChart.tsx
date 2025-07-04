import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import axios from '../../utils/axios';
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
        const response = await axios.get<LoanStatusData[]>('/api/reports/loan-status-distribution');
        setData(response.data);
      } catch (err) {
        setError('Failed to fetch loan status distribution');
        console.error('Error fetching loan status distribution:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Modern color palette
  const MODERN_COLORS = [
    '#2563EB', // Primary Blue
    '#10B981', // Success Green
    '#F59E0B', // Warning Orange
    '#EF4444', // Warning Red
    '#8B5CF6', // Purple
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
  ];

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
          strokeWidth={2}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={MODERN_COLORS[index % MODERN_COLORS.length]} />
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
          wrapperStyle={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--neutral-600)',
            fontWeight: 'var(--font-weight-medium)',
            paddingTop: 'var(--space-md)'
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default LoanStatusChart;