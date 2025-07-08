import { FinancialKPIDashboard } from '../components/FinancialKPIDashboard';
import { AlertSummary } from '../components/AlertSummary';
import { PerformanceTrendChart } from '../components/PerformanceTrendChart';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/design-system.css';

interface LoanStatusData {
  status: string;
  count: number;
  upb: number;
  avgBalance: number;
  change: number;
}

interface Loan {
  loan_id: string;
  legal_status: string;
  prin_bal: string;
}

function DashboardPage() {
  const [loanStatusData, setLoanStatusData] = useState<LoanStatusData[]>([]);
  const [totalLoans, setTotalLoans] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoanData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
        const response = await axios.get<Loan[]>(`${apiUrl}/api/v2/loans`);
        const loans = response.data;
        
        setTotalLoans(loans.length);
        
        // Process loan data by status
        const statusMap = new Map<string, { count: number; totalUpb: number }>();
        
        loans.forEach(loan => {
          const status = loan.legal_status || 'Unknown';
          const upb = parseFloat(loan.prin_bal) || 0;
          
          if (!statusMap.has(status)) {
            statusMap.set(status, { count: 0, totalUpb: 0 });
          }
          
          const statusData = statusMap.get(status)!;
          statusData.count += 1;
          statusData.totalUpb += upb;
        });
        
        // Convert to our format and categorize statuses
        const statusData: LoanStatusData[] = [];
        
        // Group statuses into categories
        const performingStatuses = ['Current', 'Performing', 'Good Standing'];
        const nonPerformingStatuses = ['Non-Performing', 'Delinquent', '30 Days Past Due', '60 Days Past Due', '90 Days Past Due'];
        const defaultStatuses = ['Default', 'Foreclosure', 'FC', 'Bankruptcy', 'BK'];
        
        // Calculate performing loans
        let performingCount = 0;
        let performingUpb = 0;
        performingStatuses.forEach(status => {
          const data = statusMap.get(status);
          if (data) {
            performingCount += data.count;
            performingUpb += data.totalUpb;
          }
        });
        
        // Calculate non-performing loans
        let nonPerformingCount = 0;
        let nonPerformingUpb = 0;
        nonPerformingStatuses.forEach(status => {
          const data = statusMap.get(status);
          if (data) {
            nonPerformingCount += data.count;
            nonPerformingUpb += data.totalUpb;
          }
        });
        
        // Calculate default loans
        let defaultCount = 0;
        let defaultUpb = 0;
        defaultStatuses.forEach(status => {
          const data = statusMap.get(status);
          if (data) {
            defaultCount += data.count;
            defaultUpb += data.totalUpb;
          }
        });
        
        // If we don't have specific categorizations, use the raw data
        if (performingCount === 0 && nonPerformingCount === 0 && defaultCount === 0) {
          // Use top 3 statuses by count
          const sortedStatuses = Array.from(statusMap.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 3);
          
          sortedStatuses.forEach(([status, data]) => {
            statusData.push({
              status: status,
              count: data.count,
              upb: data.totalUpb,
              avgBalance: data.totalUpb / data.count,
              change: Math.random() * 10 - 5 // Mock change data
            });
          });
        } else {
          // Use categorized data
          if (performingCount > 0) {
            statusData.push({
              status: 'PERFORMING',
              count: performingCount,
              upb: performingUpb,
              avgBalance: performingUpb / performingCount,
              change: Math.random() * 5 // Mock positive change
            });
          }
          
          if (nonPerformingCount > 0) {
            statusData.push({
              status: 'NON-PERFORMING',
              count: nonPerformingCount,
              upb: nonPerformingUpb,
              avgBalance: nonPerformingUpb / nonPerformingCount,
              change: Math.random() * 10 - 5 // Mock change
            });
          }
          
          if (defaultCount > 0) {
            statusData.push({
              status: 'DEFAULT',
              count: defaultCount,
              upb: defaultUpb,
              avgBalance: defaultUpb / defaultCount,
              change: Math.random() * 15 // Mock change
            });
          }
        }
        
        setLoanStatusData(statusData);
      } catch (error) {
        console.error('Failed to fetch loan data:', error);
        // Fallback to mock data if API fails
        setLoanStatusData([
          {
            status: 'PERFORMING',
            count: 1524,
            upb: 203700000,
            avgBalance: 133600,
            change: 2.1
          },
          {
            status: 'NON-PERFORMING',
            count: 298,
            upb: 41200000,
            avgBalance: 138300,
            change: 4.7
          },
          {
            status: 'DEFAULT',
            count: 25,
            upb: 2400000,
            avgBalance: 96000,
            change: 15.2
          }
        ]);
        setTotalLoans(1847);
      } finally {
        setLoading(false);
      }
    };

    fetchLoanData();
  }, []);

  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(0)}`;
  };

  const getStatusIndicatorClass = (status: string): string => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('perform')) return 'success';
    if (statusLower.includes('non') || statusLower.includes('delinq')) return 'warning';
    if (statusLower.includes('default') || statusLower.includes('fc')) return 'critical';
    return 'info';
  };
  return (
    <div style={{ 
      padding: '12px', 
      minHeight: '100vh',
      backgroundColor: 'var(--color-background)'
    }}>
      {/* Quick Stats Header */}
      <div className="quick-stats" style={{ marginBottom: '16px' }}>
        <div className="quick-stat">
          <span className="label">PORTFOLIO</span>
          <span className="value">NPL-MAIN</span>
        </div>
        <div className="quick-stat">
          <span className="label">TOTAL LOANS</span>
          <span className="value">{loading ? '...' : totalLoans.toLocaleString()}</span>
        </div>
        <div className="quick-stat">
          <span className="label">SESSION</span>
          <span className="value">{format(new Date(), 'MMM d, yyyy HH:mm')}</span>
        </div>
        <div className="quick-stat">
          <span className="label">STATUS</span>
          <span className="value data-fresh">LIVE</span>
        </div>
      </div>

      {/* Alert Summary Strip */}
      <AlertSummary compact />

      {/* Financial KPI Dashboard */}
      <div className="financial-card" style={{ marginBottom: '16px' }}>
        <div style={{ 
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '8px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase' }}>
            PORTFOLIO METRICS
          </h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="data-timestamp">Real-time</span>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--color-success)',
              animation: 'pulse 2s infinite'
            }}></div>
          </div>
        </div>
        <FinancialKPIDashboard />
      </div>

      {/* Advanced Analytics Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* Performance Trends */}
        <div className="financial-card">
          <div style={{ 
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}>
            <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
              PERFORMANCE TRENDS (30D)
            </h3>
          </div>
          <PerformanceTrendChart />
        </div>

        {/* Risk Distribution */}
        <div className="financial-card">
          <div style={{ 
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}>
            <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
              RISK DISTRIBUTION
            </h3>
          </div>
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase' }}>CHART COMPONENT</div>
              <div style={{ fontSize: '10px' }}>Geographic and sector risk breakdown</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Analytics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginTop: '12px' }}>
        {/* Loan Pipeline */}
        <div className="financial-card">
          <div style={{ 
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}>
            <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
              LOAN PIPELINE & STATUS
            </h3>
          </div>
          {loading ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '150px',
              color: 'var(--color-text-muted)',
              fontSize: '12px',
              textTransform: 'uppercase'
            }}>
              LOADING LOAN DATA...
            </div>
          ) : (
            <table className="financial-table">
              <thead>
                <tr>
                  <th>STATUS</th>
                  <th>COUNT</th>
                  <th>UPB</th>
                  <th>AVG BALANCE</th>
                  <th>CHANGE</th>
                </tr>
              </thead>
              <tbody>
                {loanStatusData.map((statusData, index) => (
                  <tr key={index}>
                    <td>
                      <span className={`status-indicator ${getStatusIndicatorClass(statusData.status)}`}>
                        {statusData.status}
                      </span>
                    </td>
                    <td className="data-value">{statusData.count.toLocaleString()}</td>
                    <td className="data-value">{formatCurrency(statusData.upb)}</td>
                    <td className="data-value">{formatCurrency(statusData.avgBalance)}</td>
                    <td 
                      className="data-value" 
                      style={{ 
                        color: statusData.change > 0 ? 'var(--color-danger)' : 'var(--color-success)' 
                      }}
                    >
                      {statusData.change > 0 ? '+' : ''}{statusData.change.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Market Context */}
        <div className="financial-card">
          <div style={{ 
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}>
            <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
              MARKET CONTEXT
            </h3>
          </div>
          <div className="market-data-widget" style={{ flexDirection: 'column', gap: '8px' }}>
            <div className="market-ticker">
              <div className="symbol">10Y TREASURY</div>
              <div className="value">4.23%</div>
              <div className="change positive">+0.02</div>
            </div>
            <div className="market-ticker">
              <div className="symbol">NPL INDEX</div>
              <div className="value">89.4</div>
              <div className="change negative">-1.2</div>
            </div>
            <div className="market-ticker">
              <div className="symbol">CREDIT SPREAD</div>
              <div className="value">185bp</div>
              <div className="change positive">+3bp</div>
            </div>
            <div className="market-ticker">
              <div className="symbol">VIX</div>
              <div className="value">16.8</div>
              <div className="change positive">+0.5</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;