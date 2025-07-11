import React, { useEffect, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, Calendar, AlertTriangle, Scale, RefreshCw } from 'lucide-react';
import { solService, SOLSummary } from '../services/solService';
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
  mediumRiskCount: number;
  lowRiskCount: number;
  avgDaysToExpiration: number;
  highRiskPercentage: number;
  jurisdictionRiskLevel: string;
}

interface SOLHeatMapData {
  stateCode: string;
  stateName: string;
  jurisdictionRiskLevel: string;
  riskScore: number;
  lienYears: number;
  noteYears: number;
  foreclosureYears: number;
  lienExtinguished: boolean;
  foreclosureBarred: boolean;
  portfolioLoanCount: number;
  portfolioExpiredCount: number;
  portfolioHighRiskCount: number;
  portfolioRiskPercentage: number;
  hasPortfolioExposure: boolean;
}

const SOLMonitoringPage: React.FC = () => {
  const [solSummary, setSOLSummary] = useState<SOLSummary | null>(null);
  const [trendData, setTrendData] = useState<SOLTrendData[]>([]);
  const [jurisdictionData, setJurisdictionData] = useState<SOLJurisdictionData[]>([]);
  const [heatMapData, setHeatMapData] = useState<SOLHeatMapData[]>([]);
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
      
      // Load all SOL data in parallel
      const [summary, trendAnalysis, jurisdictionAnalysis, heatMap] = await Promise.all([
        solService.getSOLSummary(),
        solService.getTrendAnalysis(),
        solService.getJurisdictionAnalysis(),
        solService.getGeographicHeatMap()
      ]);
      
      setSOLSummary(summary);
      setTrendData(trendAnalysis);
      setJurisdictionData(jurisdictionAnalysis);
      setHeatMapData(heatMap);
      
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '12px' }}>
        {/* Left Column - SOL Overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                SOL EXPIRATION FORECAST
              </h3>
              <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: 0 }}>
                Monthly timeline showing actual SOL expiration dates (updates daily)
              </p>
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
                    dataKey="expiringCount" 
                    stroke="var(--color-danger)" 
                    strokeWidth={3}
                    name="SOL Expirations"
                    strokeDasharray="none"
                    dot={{ fill: 'var(--color-danger)', strokeWidth: 2, r: 4 }}
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
                    <th>RISK %</th>
                    <th>TOTAL LOANS</th>
                    <th>EXPIRED</th>
                    <th>HIGH RISK</th>
                    <th>JURISDICTION RISK</th>
                  </tr>
                </thead>
                <tbody>
                  {jurisdictionData.map((jurisdiction) => (
                    <tr key={jurisdiction.state}>
                      <td style={{ fontWeight: '600' }}>{jurisdiction.state}</td>
                      <td>
                        <span className={`status-indicator ${
                          jurisdiction.highRiskPercentage >= 50 ? 'critical' : 
                          jurisdiction.highRiskPercentage >= 25 ? 'warning' : 'success'
                        }`}>
                          {jurisdiction.highRiskPercentage}%
                        </span>
                      </td>
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
                      <td>
                        <span className={`status-indicator ${
                          jurisdiction.jurisdictionRiskLevel === 'HIGH' ? 'critical' :
                          jurisdiction.jurisdictionRiskLevel === 'MEDIUM' ? 'warning' : 'success'
                        }`}>
                          {jurisdiction.jurisdictionRiskLevel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Geographic Heat Map */}
          <div className="financial-card">
            <div style={{ 
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '8px',
              marginBottom: '12px'
            }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
                GEOGRAPHIC SOL RISK MAP
              </h3>
            </div>
            
            {/* Interactive US Map */}
            <div style={{ height: '400px', width: '100%', marginBottom: '12px' }}>
              <svg
                viewBox="0 0 1000 600"
                style={{ 
                  width: '100%', 
                  height: '100%',
                  backgroundColor: 'var(--color-surface-light)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                {/* US Map SVG paths would go here - for now showing a simplified grid */}
                <text 
                  x="500" 
                  y="300" 
                  textAnchor="middle" 
                  style={{ 
                    fontSize: '16px', 
                    fill: 'var(--color-text-muted)',
                    fontWeight: '600'
                  }}
                >
                  Interactive US Map Coming Soon
                </text>
                <text 
                  x="500" 
                  y="330" 
                  textAnchor="middle" 
                  style={{ 
                    fontSize: '12px', 
                    fill: 'var(--color-text-muted)'
                  }}
                >
                  SOL Risk Heat Map Visualization
                </text>
              </svg>
            </div>

            {/* State Risk Grid as Fallback/Detail View */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
              gap: '6px',
              maxHeight: '250px',
              overflowY: 'auto',
              marginBottom: '12px'
            }}>
              {heatMapData
                .filter(state => state.hasPortfolioExposure || state.riskScore >= 60) // Show portfolio states + high risk
                .sort((a, b) => {
                  // Prioritize portfolio exposure, then risk score
                  if (a.hasPortfolioExposure && !b.hasPortfolioExposure) return -1;
                  if (!a.hasPortfolioExposure && b.hasPortfolioExposure) return 1;
                  return b.riskScore - a.riskScore;
                })
                .slice(0, 24) // Show top states
                .map((state) => {
                  const isHighRisk = state.portfolioRiskPercentage >= 50 || state.riskScore >= 80;
                  const isMediumRisk = state.portfolioRiskPercentage >= 25 || state.riskScore >= 60;
                  
                  return (
                    <div 
                      key={state.stateCode}
                      style={{
                        padding: '6px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 
                          isHighRisk ? 'rgba(197, 48, 48, 0.1)' :
                          isMediumRisk ? 'rgba(251, 146, 60, 0.1)' :
                          state.hasPortfolioExposure ? 'rgba(59, 130, 246, 0.1)' :
                          'rgba(34, 197, 94, 0.1)',
                        border: `1px solid ${
                          isHighRisk ? 'rgba(197, 48, 48, 0.3)' :
                          isMediumRisk ? 'rgba(251, 146, 60, 0.3)' :
                          state.hasPortfolioExposure ? 'rgba(59, 130, 246, 0.3)' :
                          'rgba(34, 197, 94, 0.3)'
                        }`,
                        position: 'relative',
                        cursor: state.hasPortfolioExposure ? 'pointer' : 'default'
                      }}
                      title={`${state.stateName}: ${state.portfolioLoanCount} loans, ${state.portfolioRiskPercentage}% SOL risk`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <span style={{ fontWeight: '600', fontSize: '11px' }}>{state.stateCode}</span>
                        {state.hasPortfolioExposure && (
                          <div style={{
                            fontSize: '8px',
                            fontWeight: '600',
                            padding: '1px 4px',
                            borderRadius: '2px',
                            backgroundColor: 
                              isHighRisk ? 'var(--color-danger)' :
                              isMediumRisk ? 'var(--color-warning)' : 'var(--color-info)',
                            color: 'white'
                          }}>
                            {state.portfolioRiskPercentage}%
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
                        {state.stateName}
                      </div>
                      {state.hasPortfolioExposure ? (
                        <div style={{ fontSize: '8px', color: 'var(--color-text-primary)' }}>
                          {state.portfolioLoanCount} loans • {state.portfolioExpiredCount} expired
                        </div>
                      ) : (
                        <div style={{ fontSize: '8px', color: 'var(--color-text-muted)' }}>
                          Risk Score: {state.riskScore}
                          {state.lienExtinguished && ' • Lien Ext.'}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Legend and Risk Explanation */}
            <div style={{ 
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '8px',
              backgroundColor: 'var(--color-surface-light)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '9px',
              color: 'var(--color-text-muted)'
            }}>
              <div>
                <strong>Portfolio Risk:</strong> Red (≥50%), Orange (≥25%), Blue (&lt;25%)
              </div>
              <div>
                <strong>Jurisdiction Risk:</strong> Based on SOL periods, lien rules, foreclosure restrictions
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SOLMonitoringPage;