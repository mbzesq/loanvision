import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import axios from '../../utils/axios';

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

  // Professional color palette (blues, greys, etc.)
  const getPieColor = (index: number): string => {
    const colors = [
      '#1f77b4', // Professional Blue
      '#aec7e8', // Light Blue
      '#637081', // Dark Grey
      '#98a8ba', // Medium Grey
      '#2ca02c', // Professional Green
      '#d62728', // Professional Red
      '#ff7f0e', // Professional Orange
      '#ffbb78', // Light Orange
    ];
    return colors[index % colors.length];
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
        <p>No data available</p>
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
        Loan Status Distribution
      </h3>
      
      <ResponsiveContainer width="100%" height="90%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={100}
            fill="#8884d8"
            dataKey="count"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={getPieColor(index)} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => [value, 'Count']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            wrapperStyle={{ fontSize: '12px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LoanStatusChart;