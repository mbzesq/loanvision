import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../styles/financial-design-system.css';

interface PerformanceTrendData {
  date: string;
  performing: number;
  nonPerforming: number;
  defaulted: number;
  totalTransitions: number;
}

interface StatusTransition {
  from: string;
  to: string;
  count: number;
  date: string;
}

export const PerformanceTrendChart: React.FC = () => {
  const [trendData, setTrendData] = useState<PerformanceTrendData[]>([]);
  const [transitions, setTransitions] = useState<StatusTransition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching real status transition data
    const generateMockData = () => {
      const data: PerformanceTrendData[] = [];
      const transitionData: StatusTransition[] = [];
      
      // Generate data for the last 30 days
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Simulate realistic loan performance changes
        const basePerforming = 750 + Math.random() * 50;
        const baseNonPerforming = 120 + Math.random() * 30;
        const baseDefaulted = 30 + Math.random() * 10;
        
        // Add some trending patterns
        const trendFactor = (30 - i) / 30;
        const performing = Math.floor(basePerforming - (trendFactor * 20)); // Slight decline
        const nonPerforming = Math.floor(baseNonPerforming + (trendFactor * 15)); // Slight increase
        const defaulted = Math.floor(baseDefaulted + (trendFactor * 5)); // Slight increase
        
        const totalTransitions = Math.floor(Math.random() * 15) + 5;
        
        data.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          performing,
          nonPerforming,
          defaulted,
          totalTransitions
        });
        
        // Generate some transition records
        if (Math.random() > 0.3) {
          const transitionTypes = [
            { from: 'Performing', to: 'Non-Performing', probability: 0.4 },
            { from: 'Non-Performing', to: 'Default', probability: 0.3 },
            { from: 'Non-Performing', to: 'Performing', probability: 0.2 },
            { from: 'Default', to: 'Foreclosure', probability: 0.1 }
          ];
          
          transitionTypes.forEach(transition => {
            if (Math.random() < transition.probability) {
              transitionData.push({
                from: transition.from,
                to: transition.to,
                count: Math.floor(Math.random() * 5) + 1,
                date: dateStr
              });
            }
          });
        }
      }
      
      setTrendData(data);
      setTransitions(transitionData);
      setLoading(false);
    };

    // Simulate API call delay
    const timer = setTimeout(generateMockData, 500);
    return () => clearTimeout(timer);
  }, []);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="financial-tooltip">
          <p style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ fontSize: '10px', color: entry.color, margin: '2px 0' }}>
              {entry.name}: {entry.value} loans
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div style={{ 
        height: '200px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--color-text-muted)',
        fontSize: '12px'
      }}>
        LOADING PERFORMANCE DATA...
      </div>
    );
  }

  return (
    <div>
      <div style={{ height: '200px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
              axisLine={{ stroke: 'var(--color-border)' }}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
              axisLine={{ stroke: 'var(--color-border)' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '10px' }}
              iconType="line"
            />
            <Line 
              type="monotone" 
              dataKey="performing" 
              stroke="var(--color-success)" 
              strokeWidth={2}
              name="Performing"
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="nonPerforming" 
              stroke="var(--color-warning)" 
              strokeWidth={2}
              name="Non-Performing"
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="defaulted" 
              stroke="var(--color-danger)" 
              strokeWidth={2}
              name="Default"
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Recent Transitions Summary */}
      <div style={{ 
        marginTop: '12px',
        padding: '8px',
        backgroundColor: 'var(--color-surface-light)',
        borderRadius: 'var(--radius-sm)'
      }}>
        <div style={{ 
          fontSize: '10px', 
          fontWeight: '600', 
          color: 'var(--color-text-secondary)',
          marginBottom: '4px',
          textTransform: 'uppercase'
        }}>
          RECENT TRANSITIONS (7D)
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {transitions.slice(-4).map((transition, index) => (
            <div key={index} style={{ 
              fontSize: '10px',
              color: 'var(--color-text-muted)'
            }}>
              <span style={{ fontWeight: '500' }}>{transition.count}</span> loans:
              <span style={{ marginLeft: '4px' }}>{transition.from} → {transition.to}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PerformanceTrendChart;