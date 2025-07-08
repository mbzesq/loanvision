import React, { useEffect, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, Calendar, AlertTriangle, Scale, RefreshCw } from 'lucide-react';
import { solService, SOLSummary } from '../services/solService';
import UniversalAlertsPanel from '../components/Alerts/UniversalAlertsPanel';
import SOLMonitorCard from '../components/Dashboard/SOLMonitorCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import '../styles/financial-design-system.css';

interface SOLTrendData {
  month: string;
  expired: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  totalLoans: number;
}

interface SOLJurisdictionData {
  state: string;
  totalLoans: number;
  expiredCount: number;
  highRiskCount: number;
  avgDaysToExpiration: number;
}

const SOLMonitoringPage: React.FC = () => {
  const [solSummary, setSOLSummary] = useState<SOLSummary | null>(null);
  const [trendData, setTrendData] = useState<SOLTrendData[]>([]);
  const [jurisdictionData, setJurisdictionData] = useState<SOLJurisdictionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    loadSOLData();
  }, []);

  const loadSOLData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load current summary
      const summary = await solService.getSOLSummary();
      setSOLSummary(summary);
      
      // Generate mock trend data for demonstration
      const mockTrendData: SOLTrendData[] = [
        { month: 'Jan 2025', expired: 12, highRisk: 28, mediumRisk: 45, lowRisk: 165, totalLoans: 250 },
        { month: 'Feb 2025', expired: 15, highRisk: 32, mediumRisk: 48, lowRisk: 158, totalLoans: 253 },
        { month: 'Mar 2025', expired: 18, highRisk: 35, mediumRisk: 52, lowRisk: 150, totalLoans: 255 },
        { month: 'Apr 2025', expired: 22, highRisk: 38, mediumRisk: 55, lowRisk: 145, totalLoans: 260 },
        { month: 'May 2025', expired: 25, highRisk: 42, mediumRisk: 58, lowRisk: 140, totalLoans: 265 },
        { month: 'Jun 2025', expired: 28, highRisk: 45, mediumRisk: 62, lowRisk: 135, totalLoans: 270 },
      ];
      setTrendData(mockTrendData);
      
      // Generate mock jurisdiction data
      const mockJurisdictionData: SOLJurisdictionData[] = [
        { state: 'FL', totalLoans: 85, expiredCount: 8, highRiskCount: 15, avgDaysToExpiration: 450 },
        { state: 'TX', totalLoans: 72, expiredCount: 6, highRiskCount: 12, avgDaysToExpiration: 520 },
        { state: 'CA', totalLoans: 65, expiredCount: 4, highRiskCount: 8, avgDaysToExpiration: 680 },
        { state: 'NY', totalLoans: 48, expiredCount: 3, highRiskCount: 6, avgDaysToExpiration: 720 },
        { state: 'OH', totalLoans: 35, expiredCount: 2, highRiskCount: 4, avgDaysToExpiration: 580 },
      ];
      setJurisdictionData(mockJurisdictionData);
      
      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to load SOL monitoring data');
      console.error('Error loading SOL data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadSOLData();
  };

  if (loading) {
    return (
      <div style={{ 
        padding: '12px', 
        minHeight: '100vh',
        backgroundColor: 'var(--color-background)' 
      }}>
        <div className="animate-pulse">
          <div style={{ 
            height: '32px', 
            backgroundColor: 'var(--color-surface)', 
            borderRadius: 'var(--radius-md)',
            width: '33%',
            marginBottom: '24px'
          }}></div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '12px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ 
                height: '192px', 
                backgroundColor: 'var(--color-surface)', 
                borderRadius: 'var(--radius-md)'
              }}></div>
              <div style={{ 
                height: '192px', 
                backgroundColor: 'var(--color-surface)', 
                borderRadius: 'var(--radius-md)'
              }}></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ 
                height: '256px', 
                backgroundColor: 'var(--color-surface)', 
                borderRadius: 'var(--radius-md)'
              }}></div>
              <div style={{ 
                height: '128px', 
                backgroundColor: 'var(--color-surface)', 
                borderRadius: 'var(--radius-md)'
              }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '12px', 
        minHeight: '100vh',
        backgroundColor: 'var(--color-background)' 
      }}>
        <h1 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          color: 'var(--color-text-primary)',
          marginBottom: '16px'
        }}>SOL Monitoring Dashboard</h1>
        <div style={{ 
          backgroundColor: 'rgba(197, 48, 48, 0.1)', 
          border: '1px solid rgba(197, 48, 48, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '16px'
        }}>
          <p style={{ color: 'var(--color-danger)' }}>{error}</p>
        </div>
      </div>
    );
  }

  const riskTrend = trendData.length >= 2 ? 
    (trendData[trendData.length - 1].expired + trendData[trendData.length - 1].highRisk) - 
    (trendData[trendData.length - 2].expired + trendData[trendData.length - 2].highRisk) : 0;

  return (
    <div style={{ 
      padding: '12px', 
      minHeight: '100vh',
      backgroundColor: 'var(--color-background)' 
    }}>
      {/* Header */}
      <div className="quick-stats" style={{ marginBottom: '16px' }}>
        <div className="quick-stat">
          <span className="label">SOL MONITORING</span>
          <span className="value">DASHBOARD</span>
        </div>
        <div className="quick-stat">
          <span className="label">LAST UPDATE</span>
          <span className="value data-fresh">{lastRefresh.toLocaleTimeString()}</span>
        </div>
        <div className="quick-stat">
          <span className="label">PORTFOLIO</span>
          <span className="value">NPL-MAIN</span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button 
            className="btn-compact btn-secondary" 
            onClick={handleRefresh}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <RefreshCw style={{ width: '14px', height: '14px' }} />
            REFRESH
          </button>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="dashboard-grid-dense" style={{ marginBottom: '16px' }}>
        <div className="kpi-card-dense">
          <div>
            <div className="kpi-label">EXPIRED SOL</div>
            <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>
              {solSummary?.expired_count || 0}
            </div>
          </div>
          <AlertTriangle style={{ width: '24px', height: '24px', color: 'var(--color-danger)' }} />
        </div>

        <div className="kpi-card-dense">
          <div>
            <div className="kpi-label">HIGH RISK</div>
            <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>
              {solSummary?.high_risk_count || 0}
            </div>
          </div>
          <Clock style={{ width: '24px', height: '24px', color: 'var(--color-warning)' }} />
        </div>

        <div className="kpi-card-dense">
          <div>
            <div className="kpi-label">TOTAL MONITORED</div>
            <div className="kpi-value" style={{ color: 'var(--color-primary)' }}>
              {solSummary?.total_loans || 0}
            </div>
          </div>
          <Scale style={{ width: '24px', height: '24px', color: 'var(--color-primary)' }} />
        </div>

        <div className="kpi-card-dense">
          <div>
            <div className="kpi-label">RISK TREND</div>
            <div className="kpi-value" style={{ 
              color: riskTrend > 0 ? 'var(--color-danger)' : 'var(--color-success)' 
            }}>
              {riskTrend > 0 ? '+' : ''}{riskTrend}
            </div>
          </div>
          {riskTrend > 0 ? (
            <TrendingUp style={{ width: '24px', height: '24px', color: 'var(--color-danger)' }} />
          ) : (
            <TrendingDown style={{ width: '24px', height: '24px', color: 'var(--color-success)' }} />
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
        {/* Left Column - Alerts and Overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <UniversalAlertsPanel className="h-full" maxAlerts={6} showSettings={true} />
          <SOLMonitorCard />
        </div>

        {/* Right Column - Charts and Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Trend Chart */}
          <div className="financial-card">
            <div style={{ 
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '8px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <TrendingUp style={{ width: '16px', height: '16px', color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
                SOL RISK TRENDS
              </h3>
            </div>
            <div style={{ height: '256px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    axisLine={{ stroke: 'var(--color-border)' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    axisLine={{ stroke: 'var(--color-border)' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="expired" 
                    stroke="var(--color-danger)" 
                    strokeWidth={2}
                    name="Expired"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="highRisk" 
                    stroke="var(--color-warning)" 
                    strokeWidth={2}
                    name="High Risk"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="mediumRisk" 
                    stroke="var(--color-info)" 
                    strokeWidth={2}
                    name="Medium Risk"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Jurisdiction Analysis */}
          <div className="financial-card">
            <div style={{ 
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '8px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Calendar style={{ width: '16px', height: '16px', color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
                SOL RISK BY JURISDICTION
              </h3>
            </div>
            <div style={{ height: '256px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={jurisdictionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis 
                    dataKey="state" 
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    axisLine={{ stroke: 'var(--color-border)' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    axisLine={{ stroke: 'var(--color-border)' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="expiredCount" fill="var(--color-danger)" name="Expired" />
                  <Bar dataKey="highRiskCount" fill="var(--color-warning)" name="High Risk" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Jurisdiction Details Table */}
          <div className="financial-card">
            <div style={{ 
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '8px',
              marginBottom: '12px'
            }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
                JURISDICTION DETAILS
              </h3>
            </div>
            <div className="scroll-container">
              <table className="financial-table">
                <thead>
                  <tr>
                    <th>STATE</th>
                    <th>TOTAL LOANS</th>
                    <th>EXPIRED</th>
                    <th>HIGH RISK</th>
                    <th>AVG DAYS TO EXP</th>
                  </tr>
                </thead>
                <tbody>
                  {jurisdictionData.map((jurisdiction) => (
                    <tr key={jurisdiction.state}>
                      <td style={{ fontWeight: '600' }}>{jurisdiction.state}</td>
                      <td className="data-value">{jurisdiction.totalLoans}</td>
                      <td>
                        <span className={`status-indicator ${jurisdiction.expiredCount > 0 ? 'critical' : 'success'}`}>
                          {jurisdiction.expiredCount}
                        </span>
                      </td>
                      <td>
                        <span className={`status-indicator ${jurisdiction.highRiskCount > 5 ? 'critical' : jurisdiction.highRiskCount > 0 ? 'warning' : 'success'}`}>
                          {jurisdiction.highRiskCount}
                        </span>
                      </td>
                      <td className="data-value">
                        {jurisdiction.avgDaysToExpiration}d
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SOLMonitoringPage;