import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ForeclosureSummary } from '../../services/foreclosureService';
import '../../styles/financial-design-system.css';

interface ForeclosureMonitorCardProps {
  data: ForeclosureSummary | null;
  loading: boolean;
}

const ForeclosureMonitorCard: React.FC<ForeclosureMonitorCardProps> = ({ data, loading }) => {
  if (loading || !data) {
    return (
      <div className="financial-card" style={{ height: '300px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%',
          color: 'var(--color-text-muted)',
          fontSize: '12px'
        }}>
          {loading ? 'LOADING FORECLOSURE DATA...' : 'NO FORECLOSURE DATA AVAILABLE'}
        </div>
      </div>
    );
  }

  // Prepare data for the donut chart
  const chartData = [
    { name: 'Overdue', value: data.riskDistribution.overdue, color: '#dc2626' },
    { name: 'On Track', value: data.riskDistribution.onTrack, color: '#16a34a' },
    { name: 'Completed', value: data.riskDistribution.completed, color: '#2563eb' }
  ];

  const totalActive = data.riskDistribution.overdue + data.riskDistribution.onTrack;
  const overduePercentage = totalActive > 0 ? (data.riskDistribution.overdue / totalActive * 100) : 0;

  return (
    <div className="financial-card">
      <div style={{ 
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: '8px',
        marginBottom: '16px'
      }}>
        <h3 style={{ 
          fontSize: '12px', 
          fontWeight: '600', 
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          margin: 0
        }}>
          FORECLOSURE MONITOR
        </h3>
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        {/* Donut Chart */}
        <div style={{ width: '140px', height: '140px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={60}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [value, 'Loans']}
                contentStyle={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Stats */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="financial-detail-item">
              <span className="label">TOTAL IN FORECLOSURE</span>
              <span className="value" style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: 'var(--color-primary)' 
              }}>
                {data.totalInForeclosure}
              </span>
            </div>
            
            <div className="financial-detail-item">
              <span className="label">AVG DAYS IN PROCESS</span>
              <span className="value" style={{ 
                fontSize: '16px', 
                fontWeight: '600',
                color: data.avgDaysInProcess > 365 ? 'var(--color-danger)' : 'var(--color-text)' 
              }}>
                {Math.round(data.avgDaysInProcess)}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="financial-detail-item">
              <span className="label">JUDICIAL</span>
              <span className="value">{data.judicialCount}</span>
            </div>
            
            <div className="financial-detail-item">
              <span className="label">NON-JUDICIAL</span>
              <span className="value">{data.nonJudicialCount}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="financial-detail-item">
              <span className="label">OVERDUE CASES</span>
              <span className="value" style={{ 
                color: overduePercentage > 20 ? 'var(--color-danger)' : 'var(--color-warning)' 
              }}>
                {data.riskDistribution.overdue} ({overduePercentage.toFixed(0)}%)
              </span>
            </div>
            
            <div className="financial-detail-item">
              <span className="label">COMPLETED (YTD)</span>
              <span className="value" style={{ color: 'var(--color-success)' }}>
                {data.completedForeclosures}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            fontSize: '10px',
            marginTop: '8px'
          }}>
            {chartData.map((item, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: item.color
                }} />
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {item.name} ({item.value})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForeclosureMonitorCard;