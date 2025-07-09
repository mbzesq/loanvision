import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, XCircle, ExternalLink } from 'lucide-react';
import { solService, SOLSummary } from '../../services/solService';
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import '../../styles/financial-design-system.css';

const SOLMonitorCard: React.FC = () => {
  const [solSummary, setSOLSummary] = useState<SOLSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadSOLSummary();
  }, []);

  const loadSOLSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const summary = await solService.getSOLSummary();
      setSOLSummary(summary);
    } catch (err) {
      setError('Failed to load SOL data');
      console.error('Error loading SOL summary:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="financial-card" style={{ height: '100%' }}>
        <div style={{ 
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '8px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Clock style={{ width: '16px', height: '16px', color: 'var(--color-primary)' }} />
          <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
            SOL MONITOR
          </h3>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          minHeight: '200px',
          color: 'var(--color-text-muted)',
          fontSize: '12px'
        }}>
          Loading SOL data...
        </div>
      </div>
    );
  }

  if (error || !solSummary) {
    return (
      <div className="financial-card" style={{ height: '100%' }}>
        <div style={{ 
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '8px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Clock style={{ width: '16px', height: '16px', color: 'var(--color-primary)' }} />
          <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
            SOL MONITOR
          </h3>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          minHeight: '200px',
          color: 'var(--color-danger)',
          fontSize: '12px'
        }}>
          {error || 'No data available'}
        </div>
      </div>
    );
  }

  // Prepare data for pie chart with Bloomberg color scheme
  const pieData = [
    { name: 'Low Risk', value: solSummary.low_risk_count, color: 'var(--color-success)' },
    { name: 'Medium Risk', value: solSummary.medium_risk_count, color: 'var(--color-warning)' },
    { name: 'High Risk', value: solSummary.high_risk_count, color: 'var(--color-danger)' },
    { name: 'Expired', value: solSummary.expired_count, color: 'var(--color-text-muted)' }
  ].filter(d => d.value > 0);

  const totalAtRisk = solSummary.high_risk_count + solSummary.medium_risk_count;
  const riskPercentage = solSummary.total_loans > 0 
    ? Math.round((totalAtRisk / solSummary.total_loans) * 100) 
    : 0;

  const handleNavigateToLoans = (filter: string) => {
    navigate(`/loans?sol_filter=${filter}`);
  };

  return (
    <div className="financial-card" style={{ height: '100%' }}>
      <div style={{ 
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: '8px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock style={{ width: '16px', height: '16px', color: 'var(--color-primary)' }} />
          <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
            SOL MONITOR
          </h3>
        </div>
        <div style={{
          fontSize: '10px',
          fontWeight: '600',
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '2px 6px'
        }}>
          {solSummary.total_loans} LOANS
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Key Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div 
            onClick={() => handleNavigateToLoans('expired')}
            style={{
              backgroundColor: 'rgba(197, 48, 48, 0.1)',
              border: '1px solid rgba(197, 48, 48, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(197, 48, 48, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(197, 48, 48, 0.1)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <XCircle style={{ width: '14px', height: '14px', color: 'var(--color-danger)' }} />
              <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-danger)' }}>
                {solSummary.expired_count}
              </span>
            </div>
            <p style={{ fontSize: '10px', color: 'var(--color-danger)', marginTop: '4px', textTransform: 'uppercase' }}>Expired</p>
          </div>
          
          <div 
            onClick={() => handleNavigateToLoans('at_risk')}
            style={{
              backgroundColor: 'rgba(251, 146, 60, 0.1)',
              border: '1px solid rgba(251, 146, 60, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(251, 146, 60, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(251, 146, 60, 0.1)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <AlertTriangle style={{ width: '14px', height: '14px', color: 'var(--color-warning)' }} />
              <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-warning)' }}>
                {totalAtRisk}
              </span>
            </div>
            <p style={{ fontSize: '10px', color: 'var(--color-warning)', marginTop: '4px', textTransform: 'uppercase' }}>At Risk</p>
          </div>
        </div>

        {/* Risk Distribution Chart */}
        <div style={{ height: '180px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={55}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => `${value} loans`}
                contentStyle={{ 
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                  color: 'var(--color-text)'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={30}
                iconSize={8}
                formatter={(value: string) => (
                  <span style={{ fontSize: '10px', color: 'var(--color-text)' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Indicator */}
        <div style={{
          backgroundColor: 'var(--color-background)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Portfolio Risk</span>
            <div style={{
              fontSize: '10px',
              fontWeight: '600',
              textTransform: 'uppercase',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px',
              color: riskPercentage > 10 ? 'var(--color-danger)' : 
                     riskPercentage > 5 ? 'var(--color-warning)' : 
                     'var(--color-success)',
              borderColor: riskPercentage > 10 ? 'var(--color-danger)' : 
                          riskPercentage > 5 ? 'var(--color-warning)' : 
                          'var(--color-success)'
            }}>
              {riskPercentage}% AT RISK
            </div>
          </div>
          <div style={{ width: '100%', backgroundColor: 'var(--color-border)', borderRadius: '2px', height: '6px' }}>
            <div 
              style={{
                height: '6px',
                borderRadius: '2px',
                transition: 'all 0.5s ease',
                backgroundColor: riskPercentage > 10 ? 'var(--color-danger)' : 
                               riskPercentage > 5 ? 'var(--color-warning)' : 
                               'var(--color-success)',
                width: `${Math.min(riskPercentage, 100)}%`
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
          paddingTop: '8px',
          borderTop: '1px solid var(--color-border)'
        }}>
          <button 
            onClick={() => handleNavigateToLoans('high_risk')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '6px 8px',
              fontSize: '10px',
              fontWeight: '600',
              textTransform: 'uppercase',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface)';
            }}
          >
            <ExternalLink style={{ width: '12px', height: '12px' }} />
            High Risk
          </button>
          <button 
            onClick={() => handleNavigateToLoans('expiring_soon')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '6px 8px',
              fontSize: '10px',
              fontWeight: '600',
              textTransform: 'uppercase',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface)';
            }}
          >
            <Clock style={{ width: '12px', height: '12px' }} />
            Expiring Soon
          </button>
        </div>

        {/* Alerts */}
        {solSummary.alerts && solSummary.alerts.length > 0 && (
          <div style={{
            borderTop: '1px solid var(--color-border)',
            paddingTop: '8px'
          }}>
            <p style={{
              fontSize: '10px',
              fontWeight: '600',
              color: 'var(--color-text)',
              marginBottom: '6px',
              textTransform: 'uppercase'
            }}>Recent Alerts</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {solSummary.alerts.slice(0, 3).map((alert, index) => (
                <div key={index} style={{
                  fontSize: '10px',
                  color: 'var(--color-danger)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '4px'
                }}>
                  <AlertTriangle style={{ width: '12px', height: '12px', marginTop: '1px', flexShrink: 0 }} />
                  <span>{alert}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SOLMonitorCard;