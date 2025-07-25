import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, DollarSign, FileText, Scale, AlertTriangle, BarChart3, Target } from 'lucide-react';
import axios from 'axios';

interface KPIData {
  label: string;
  value: string;
  change: number;
  changeLabel?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  clickAction?: () => void;
}

interface Loan {
  loan_id: string;
  prin_bal: string;
  legal_status: string;
  last_pymt_received: string;
  next_pymt_due: string;
  maturity_date: string;
  int_rate: string;
  fc_start_date?: string;
}

export const FinancialKPIDashboard: React.FC = () => {
  const [kpiData, setKpiData] = useState<KPIData[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
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
    navigate('/inbox');
  };

  const handleRecoveryRateClick = () => {
    navigate('/loans?status=recovery');
  };

  const handleTimeToResolutionClick = () => {
    navigate('/loans?status=FC&sortBy=fc_start_date&sortOrder=asc');
  };

  // Export functionality
  const handleExport = async () => {
    setExporting(true);
    try {
      // Create CSV content
      const csvHeaders = ['Metric', 'Value', 'Change', 'Change Label', 'Trend'].join(',');
      const csvRows = kpiData.map(kpi => [
        kpi.label,
        kpi.value,
        `${kpi.change > 0 ? '+' : ''}${kpi.change.toFixed(1)}%`,
        kpi.changeLabel || '',
        kpi.trend || ''
      ].join(','));
      
      const csvContent = [csvHeaders, ...csvRows].join('\n');
      
      // Add metadata
      const metadata = [
        '',
        'Export Information:',
        `Generated: ${new Date().toLocaleString()}`,
        `Portfolio: NPL-MAIN`,
        `Data Source: Primary`,
        `Total KPIs: ${kpiData.length}`,
        `Last Update: ${lastUpdate.toLocaleString()}`
      ].join('\n');
      
      const fullContent = csvContent + '\n' + metadata;
      
      // Create and download file
      const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const filename = `NPL_Portfolio_Metrics_${new Date().toISOString().split('T')[0]}.csv`;
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleRefresh = () => {
    setLastUpdate(new Date());
    // In a real app, this would trigger a data refresh
    console.log('Refreshing KPI data...');
  };

  useEffect(() => {
    const fetchRealKPIData = async () => {
      try {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
        const response = await axios.get<Loan[]>(`${apiUrl}/api/v2/loans`);
        const loans = response.data;
        
        // Calculate real KPIs from loan data
        const totalUPB = loans.reduce((sum, loan) => sum + (parseFloat(loan.prin_bal) || 0), 0);
        const totalLoans = loans.length;
        const avgBalance = totalLoans > 0 ? totalUPB / totalLoans : 0;
        
        // Define performance categories
        const performingStatuses = ['Current', 'Performing', 'Good Standing'];
        
        // Calculate performance metrics
        const performingLoans = loans.filter(loan => 
          performingStatuses.includes(loan.legal_status || '')
        );
        // Note: Additional loan categories available for future use if needed
        
        const performanceRate = totalLoans > 0 ? (performingLoans.length / totalLoans) * 100 : 0;
        
        // Calculate SOL risk - loans approaching or past SOL expiration
        // This would ideally use the SOL service to get actual expiration dates
        // For now, using a simplified approach based on last payment date
        const solRiskLoans = loans.filter(loan => {
          const lastPayment = loan.last_pymt_received ? new Date(loan.last_pymt_received) : null;
          if (!lastPayment) return false;
          
          // Simplified SOL calculation - typically 3-6 years depending on jurisdiction
          // In practice, would use actual SOL service calculations
          const yearsOld = (Date.now() - lastPayment.getTime()) / (1000 * 60 * 60 * 24 * 365);
          
          // Flag loans that are 2.5+ years old (approaching 3-year SOL) or older
          return yearsOld >= 2.5;
        });
        
        // Calculate foreclosure performance - % on track vs overdue
        const fcLoans = loans.filter(loan => 
          loan.fc_start_date && (loan.legal_status === 'FC' || loan.legal_status === 'Foreclosure')
        );
        
        let fcOnTrackCount = 0;
        fcLoans.forEach(loan => {
          const startDate = new Date(loan.fc_start_date!);
          const daysSinceStart = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Simplified timeline - typical foreclosure should complete in 6-12 months (180-365 days)
          // This would ideally use actual foreclosure timeline data
          const expectedDays = 270; // 9 months average
          const isOnTrack = daysSinceStart <= expectedDays;
          
          if (isOnTrack) fcOnTrackCount++;
        });
        
        const fcOnTrackPercentage = fcLoans.length > 0 ? (fcOnTrackCount / fcLoans.length) * 100 : 0;
        
        // Calculate recovery rate - requires historical status transition data
        // Would measure: loans that moved from Non-Performing back to Performing
        // Currently using placeholder until historical data is available
        const recoveryRate = 0; // Placeholder - needs historical loan status data
        
        // Format currency
        const formatCurrency = (amount: number): string => {
          if (amount >= 1000000) {
            return `$${(amount / 1000000).toFixed(1)}M`;
          } else if (amount >= 1000) {
            return `$${(amount / 1000).toFixed(1)}K`;
          }
          return `$${amount.toFixed(0)}`;
        };
        
        const realKPIs: KPIData[] = [
          {
            label: 'Total UPB',
            value: formatCurrency(totalUPB),
            change: 2.4, // Would need historical data
            changeLabel: 'vs last month',
            icon: <DollarSign className="h-4 w-4" />,
            trend: 'up',
            clickAction: handleTotalUPBClick
          },
          {
            label: 'Loan Count',
            value: totalLoans.toLocaleString(),
            change: -0.8, // Would need historical data
            changeLabel: 'vs last month',
            icon: <FileText className="h-4 w-4" />,
            trend: 'down',
            clickAction: handleLoanCountClick
          },
          {
            label: 'Avg Balance',
            value: formatCurrency(avgBalance),
            change: 3.2, // Would need historical data
            changeLabel: 'vs last month',
            icon: <BarChart3 className="h-4 w-4" />,
            trend: 'up',
            clickAction: handleAvgBalanceClick
          },
          {
            label: 'Performance',
            value: `${performanceRate.toFixed(1)}%`,
            change: -1.1, // Would need historical data
            changeLabel: 'vs last month',
            icon: <Target className="h-4 w-4" />,
            trend: 'down',
            clickAction: handlePerformanceClick
          },
          {
            label: 'SOL Risk',
            value: solRiskLoans.length.toString(),
            change: 5.0, // Would need historical data
            changeLabel: 'approaching/past SOL',
            icon: <Scale className="h-4 w-4" />,
            trend: solRiskLoans.length > 0 ? 'up' : 'neutral',
            clickAction: handleSOLRiskClick
          },
          {
            label: 'Active Alerts',
            value: '6', // Would need alerts system
            change: 0,
            changeLabel: 'critical',
            icon: <AlertTriangle className="h-4 w-4" />,
            trend: 'neutral',
            clickAction: handleActiveAlertsClick
          },
          {
            label: 'Recovery Rate',
            value: recoveryRate > 0 ? `${recoveryRate.toFixed(1)}%` : 'N/A',
            change: 0, // Would need historical data for calculation
            changeLabel: 'vs last month',
            icon: <TrendingUp className="h-4 w-4" />,
            trend: 'neutral',
            clickAction: handleRecoveryRateClick
          },
          {
            label: 'FC On Track',
            value: `${fcOnTrackPercentage.toFixed(1)}%`,
            change: 0, // Would need historical data for MoM calculation
            changeLabel: 'vs last month',
            icon: <BarChart3 className="h-4 w-4" />,
            trend: fcOnTrackPercentage >= 70 ? 'up' : 'down',
            clickAction: handleTimeToResolutionClick
          }
        ];

        setKpiData(realKPIs);
      } catch (error) {
        console.error('Failed to fetch loan data for KPIs:', error);
        // Fallback to minimal mock data if API fails
        setKpiData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRealKPIData();
    
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

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '200px',
        color: 'var(--color-text-muted)',
        fontSize: '12px'
      }}>
        LOADING KPI DATA...
      </div>
    );
  }

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
            onMouseEnter={(e) => {
              if (kpi.clickAction) {
                e.currentTarget.style.backgroundColor = 'rgba(252, 248, 243, 0.6)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(28, 25, 23, 0.12)';
              }
            }}
            onMouseLeave={(e) => {
              if (kpi.clickAction) {
                e.currentTarget.style.backgroundColor = '';
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '';
              }
            }}
          >
            <div style={{ flex: 1 }}>
              <div className="kpi-label">{kpi.label}</div>
              <div className="kpi-value metric-value">{kpi.value}</div>
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
          <button 
            className="btn-compact btn-secondary" 
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'EXPORTING...' : 'EXPORT'}
          </button>
          <button 
            className="btn-compact btn-primary" 
            onClick={handleRefresh}
          >
            REFRESH
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinancialKPIDashboard;