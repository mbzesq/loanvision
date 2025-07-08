import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, DollarSign, FileText, Scale, AlertTriangle, BarChart3, Target } from 'lucide-react';

interface KPIData {
  label: string;
  value: string;
  change: number;
  changeLabel?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  clickAction?: () => void;
}

export const FinancialKPIDashboard: React.FC = () => {
  const [kpiData, setKpiData] = useState<KPIData[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const navigate = useNavigate();

  // Click handlers for each KPI
  const handleTotalUPBClick = () => {
    navigate('/loans?sortBy=prin_bal&sortOrder=desc');
  };

  const handleLoanCountClick = () => {
    navigate('/loans?showAll=true');
  };

  const handleAvgBalanceClick = () => {
    navigate('/loans?sortBy=prin_bal&sortOrder=desc');
  };

  const handlePerformanceClick = () => {
    navigate('/loans?status=performing');
  };

  const handleSOLRiskClick = () => {
    navigate('/sol-monitoring');
  };

  const handleActiveAlertsClick = () => {
    navigate('/today');
  };

  const handleRecoveryRateClick = () => {
    navigate('/loans?status=recovery');
  };

  const handleTimeToResolutionClick = () => {
    navigate('/loans?status=FC&sortBy=fc_start_date&sortOrder=asc');
  };

  useEffect(() => {
    // Mock data - replace with actual API calls
    const mockKPIs: KPIData[] = [
      {
        label: 'Total UPB',
        value: '$247.3M',
        change: 2.4,
        changeLabel: 'vs last month',
        icon: <DollarSign className="h-4 w-4" />,
        trend: 'up',
        clickAction: handleTotalUPBClick
      },
      {
        label: 'Loan Count',
        value: '1,847',
        change: -0.8,
        changeLabel: 'vs last month',
        icon: <FileText className="h-4 w-4" />,
        trend: 'down',
        clickAction: handleLoanCountClick
      },
      {
        label: 'Avg Balance',
        value: '$133.9K',
        change: 3.2,
        changeLabel: 'vs last month',
        icon: <BarChart3 className="h-4 w-4" />,
        trend: 'up',
        clickAction: handleAvgBalanceClick
      },
      {
        label: 'Performance',
        value: '87.3%',
        change: -1.1,
        changeLabel: 'vs last month',
        icon: <Target className="h-4 w-4" />,
        trend: 'down',
        clickAction: handlePerformanceClick
      },
      {
        label: 'SOL Risk',
        value: '23',
        change: 5.0,
        changeLabel: 'loans at risk',
        icon: <Scale className="h-4 w-4" />,
        trend: 'up',
        clickAction: handleSOLRiskClick
      },
      {
        label: 'Active Alerts',
        value: '6',
        change: 0,
        changeLabel: 'critical',
        icon: <AlertTriangle className="h-4 w-4" />,
        trend: 'neutral',
        clickAction: handleActiveAlertsClick
      },
      {
        label: 'Recovery Rate',
        value: '34.2%',
        change: 1.8,
        changeLabel: 'vs target',
        icon: <TrendingUp className="h-4 w-4" />,
        trend: 'up',
        clickAction: handleRecoveryRateClick
      },
      {
        label: 'Time to Resolution',
        value: '47d',
        change: -12.5,
        changeLabel: 'avg days',
        icon: <BarChart3 className="h-4 w-4" />,
        trend: 'up',
        clickAction: handleTimeToResolutionClick
      }
    ];

    setKpiData(mockKPIs);
    
    // Simulate real-time updates
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const formatChange = (change: number, trend?: string) => {
    const sign = change > 0 ? '+' : '';
    const color = trend === 'up' ? 'var(--color-success)' : 
                  trend === 'down' ? 'var(--color-danger)' : 
                  'var(--color-text-muted)';
    
    return {
      text: `${sign}${change.toFixed(1)}%`,
      color
    };
  };

  return (
    <div>
      {/* KPI Grid - 4 columns, 2 rows */}
      <div className="dashboard-grid-dense" style={{ 
        gridTemplateColumns: 'repeat(4, 1fr)',
        marginBottom: '16px'
      }}>
        {kpiData.map((kpi, index) => (
          <div 
            key={index} 
            className="kpi-card-dense" 
            onClick={kpi.clickAction}
            style={{ 
              cursor: kpi.clickAction ? 'pointer' : 'default',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => {
              if (kpi.clickAction) {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-light)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseOut={(e) => {
              if (kpi.clickAction) {
                e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            <div style={{ flex: 1 }}>
              <div className="kpi-label">{kpi.label}</div>
              <div className="kpi-value">{kpi.value}</div>
              {kpi.change !== 0 && (
                <div 
                  className="kpi-change"
                  style={{ color: formatChange(kpi.change, kpi.trend).color }}
                >
                  {kpi.trend === 'up' && <TrendingUp style={{ width: '10px', height: '10px' }} />}
                  {kpi.trend === 'down' && <TrendingDown style={{ width: '10px', height: '10px' }} />}
                  <span>{formatChange(kpi.change, kpi.trend).text}</span>
                  {kpi.changeLabel && (
                    <span style={{ color: 'var(--color-text-muted)', marginLeft: '4px' }}>
                      {kpi.changeLabel}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div style={{ opacity: 0.6 }}>
              {kpi.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Data Freshness Indicator */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '8px 0',
        borderTop: '1px solid var(--color-border)',
        marginTop: '16px'
      }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span className="data-timestamp data-fresh">
            LIVE • Last Update: {lastUpdate.toLocaleTimeString()}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Portfolio: NPL-MAIN | Data Source: Primary
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-compact btn-secondary">EXPORT</button>
          <button className="btn-compact btn-primary">REFRESH</button>
        </div>
      </div>
    </div>
  );
};

export default FinancialKPIDashboard;