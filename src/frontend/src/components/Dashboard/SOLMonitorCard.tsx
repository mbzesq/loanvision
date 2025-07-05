import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import solService, { SOLPortfolioSummary } from '../../services/solService';
import interactionManager from '../../services/InteractionManager';
import '../../styles/design-system.css';

interface SOLData {
  name: string;
  value: number;
  color: string;
  upb: number;
}

const SOLMonitorCard: React.FC = () => {
  const [data, setData] = useState<SOLData[]>([]);
  const [summary, setSummary] = useState<SOLPortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSOLData = async () => {
      try {
        setLoading(true);
        const portfolioSummary = await solService.getPortfolioSummary();
        setSummary(portfolioSummary);

        // Calculate SOL categories
        const today = new Date();
        const sixMonthsFromNow = new Date();
        sixMonthsFromNow.setMonth(today.getMonth() + 6);

        const totalLoans = portfolioSummary.summary.analyzed_loans;
        const expiredLoans = portfolioSummary.summary.expired_loans;
        const imminentLoans = portfolioSummary.summary.expiring_within_1_year - expiredLoans; // Subtract expired from within 1 year to avoid double counting
        const safeLoans = totalLoans - expiredLoans - imminentLoans;

        const chartData: SOLData[] = [
          {
            name: 'SOL Expired',
            value: expiredLoans,
            color: '#DC2626', // Red
            upb: portfolioSummary.summary.expired_upb || 0
          },
          {
            name: 'SOL Imminent (< 6 months)',
            value: Math.max(0, imminentLoans), // Ensure non-negative
            color: '#F59E0B', // Orange
            upb: portfolioSummary.summary.expiring_soon_upb || 0
          },
          {
            name: 'SOL Safe',
            value: Math.max(0, safeLoans), // Ensure non-negative
            color: '#059669', // Green
            upb: 0 // We don't have this data point, would need to calculate
          }
        ].filter(item => item.value > 0); // Only show categories with loans

        setData(chartData);
      } catch (err) {
        setError('Failed to fetch SOL data');
        console.error('SOL Monitor error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSOLData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const handleChartClick = (data: SOLData) => {
    let filterCriteria: any = {};
    
    if (data.name === 'SOL Expired') {
      filterCriteria = { expired_only: true };
    } else if (data.name.includes('Imminent')) {
      filterCriteria = { risk_level: 'HIGH' };
    } else {
      filterCriteria = { risk_level: 'LOW' };
    }

    interactionManager.handleChartClick({
      chartType: 'sol-monitor',
      dataPoint: {
        category: data.name,
        count: data.value,
        upb: data.upb,
        ...filterCriteria
      },
      context: { chartType: 'sol-monitor' }
    });
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: 'white',
          padding: 'var(--space-sm)',
          border: '1px solid var(--neutral-200)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <p style={{ 
            fontWeight: 'var(--font-weight-medium)', 
            marginBottom: '4px',
            color: 'var(--neutral-800)'
          }}>
            {data.name}
          </p>
          <p style={{ 
            fontSize: 'var(--font-size-sm)', 
            color: 'var(--neutral-600)',
            margin: '2px 0'
          }}>
            Loans: {formatNumber(data.value)}
          </p>
          {data.upb > 0 && (
            <p style={{ 
              fontSize: 'var(--font-size-sm)', 
              color: 'var(--neutral-600)',
              margin: '2px 0'
            }}>
              UPB: {formatCurrency(data.upb)}
            </p>
          )}
          <p style={{ 
            fontSize: 'var(--font-size-xs)', 
            color: 'var(--neutral-500)',
            marginTop: '4px'
          }}>
            Click to filter loans
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-lg)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        border: '1px solid var(--neutral-200)',
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--neutral-200)',
            borderTop: '3px solid var(--primary-blue)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 12px'
          }} />
          <p style={{ color: 'var(--neutral-600)', fontSize: 'var(--font-size-sm)' }}>
            Loading SOL data...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-lg)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        border: '1px solid var(--warning-red)',
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--warning-red)', fontSize: 'var(--font-size-sm)' }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  const totalLoans = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-lg)',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      border: '1px solid var(--neutral-200)',
      height: '400px'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 'var(--space-md)'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--neutral-900)'
        }}>
          SOL Monitor
        </h3>
        <div style={{
          padding: '4px 8px',
          backgroundColor: 'var(--primary-blue)',
          color: 'white',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-medium)'
        }}>
          {formatNumber(totalLoans)} Total
        </div>
      </div>

      {data.length === 0 ? (
        <div style={{
          height: 'calc(100% - 60px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--neutral-600)',
          fontSize: 'var(--font-size-sm)'
        }}>
          No SOL data available
        </div>
      ) : (
        <>
          {/* Chart */}
          <div style={{ height: '250px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  onClick={(entry) => handleChartClick(entry)}
                  style={{ cursor: 'pointer' }}
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      stroke={entry.color}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend & Summary */}
          <div style={{ marginTop: 'var(--space-sm)' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
              gap: 'var(--space-sm)' 
            }}>
              {data.map((item, index) => (
                <div 
                  key={index}
                  onClick={() => handleChartClick(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-xs)',
                    padding: 'var(--space-xs)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--neutral-50)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: item.color,
                    borderRadius: '2px'
                  }} />
                  <div>
                    <div style={{ 
                      fontSize: 'var(--font-size-xs)', 
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--neutral-800)',
                      lineHeight: '1.2'
                    }}>
                      {item.value}
                    </div>
                    <div style={{ 
                      fontSize: 'var(--font-size-xs)', 
                      color: 'var(--neutral-600)',
                      lineHeight: '1.2'
                    }}>
                      {item.name.replace('SOL ', '')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SOLMonitorCard;