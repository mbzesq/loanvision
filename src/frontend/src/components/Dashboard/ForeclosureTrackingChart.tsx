import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from '../../utils/axios';

interface ForeclosureData {
  total_foreclosure_loans: number;
  status_breakdown: Array<{ status: string; count: number }>;
  milestone_breakdown: Array<{ milestone: string; count: number }>;
  timeline_status: Array<{ status: string; count: number }>;
}

const ForeclosureTrackingChart: React.FC = () => {
  const [data, setData] = useState<ForeclosureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'milestones' | 'timeline'>('milestones');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get<ForeclosureData>('/api/reports/foreclosure-tracking');
        setData(response.data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch foreclosure tracking data');
        console.error('Error fetching foreclosure tracking:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Color schemes
  const milestoneColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#F4A460', '#87CEEB', '#DEB887', '#FFB6C1',
    '#98FB98', '#F0E68C'
  ];

  const timelineColors = {
    'On Track': '#4CAF50',
    'Delayed': '#FF9800', 
    'Overdue': '#F44336',
    'Not in Foreclosure': '#9E9E9E'
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
        <p>Loading foreclosure data...</p>
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

  if (!data) {
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
        <p>No foreclosure data available</p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e0e0e0',
      height: '400px'
    }}>
      {/* Header with total and view selector */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <div>
          <h3 style={{
            margin: '0 0 4px 0',
            fontSize: '18px',
            fontWeight: '600',
            color: '#333'
          }}>
            Foreclosure Tracking
          </h3>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#666',
            fontWeight: '500'
          }}>
            Total: {data.total_foreclosure_loans} loans in foreclosure
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveView('milestones')}
            style={{
              padding: '6px 12px',
              border: activeView === 'milestones' ? '2px solid #1f77b4' : '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: activeView === 'milestones' ? '#f0f8ff' : 'white',
              fontSize: '12px',
              cursor: 'pointer',
              color: activeView === 'milestones' ? '#1f77b4' : '#666'
            }}
          >
            Milestones
          </button>
          <button
            onClick={() => setActiveView('timeline')}
            style={{
              padding: '6px 12px',
              border: activeView === 'timeline' ? '2px solid #1f77b4' : '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: activeView === 'timeline' ? '#f0f8ff' : 'white',
              fontSize: '12px',
              cursor: 'pointer',
              color: activeView === 'timeline' ? '#1f77b4' : '#666'
            }}
          >
            Timeline Status
          </button>
        </div>
      </div>

      {/* Chart area */}
      <div style={{ height: '320px' }}>
        {activeView === 'milestones' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.milestone_breakdown}
              margin={{ top: 10, right: 10, left: 10, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="milestone"
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 10 }}
                stroke="#666"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#666"
              />
              <Tooltip 
                formatter={(value: number) => [value, 'Loans']}
                labelStyle={{ color: '#333', fontSize: '12px' }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  fontSize: '12px'
                }}
              />
              <Bar 
                dataKey="count" 
                fill="#1f77b4"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.timeline_status}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ status, count, percent }) => 
                  `${status}: ${count} (${(percent * 100).toFixed(0)}%)`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {data.timeline_status.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={timelineColors[entry.status as keyof typeof timelineColors] || '#8884d8'} 
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [value, 'Loans']}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  fontSize: '12px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default ForeclosureTrackingChart;