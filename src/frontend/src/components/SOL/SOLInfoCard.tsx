import React, { useEffect, useState } from 'react';
import { Clock, Calendar, AlertTriangle, Info, MapPin, Scale, Shield } from 'lucide-react';
import { solService, SOLCalculation } from '../../services/solService';
import '../../styles/financial-design-system.css';

interface SOLInfoCardProps {
  loanId: string;
  className?: string;
}

const SOLInfoCard: React.FC<SOLInfoCardProps> = ({ loanId, className = '' }) => {
  const [solData, setSOLData] = useState<SOLCalculation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loanId) {
      loadSOLData();
    }
  }, [loanId]);

  const loadSOLData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await solService.getLoanSOL(loanId);
      setSOLData(data);
      if (!data) {
        setError('No SOL data available for this loan');
      }
    } catch (err) {
      setError('Failed to load SOL data');
      console.error('Error loading SOL data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`financial-card ${className}`}>
        <div style={{ 
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '8px',
          marginBottom: '12px'
        }}>
          <h3 style={{ 
            fontSize: '12px', 
            fontWeight: '600', 
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Scale style={{ width: '16px', height: '16px' }} />
            STATUTE OF LIMITATIONS
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '128px' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Loading SOL data...</div>
        </div>
      </div>
    );
  }

  if (error || !solData) {
    return (
      <div className={`financial-card ${className}`}>
        <div style={{ 
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '8px',
          marginBottom: '12px'
        }}>
          <h3 style={{ 
            fontSize: '12px', 
            fontWeight: '600', 
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Scale style={{ width: '16px', height: '16px' }} />
            STATUTE OF LIMITATIONS
          </h3>
        </div>
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <AlertTriangle style={{ width: '48px', height: '48px', color: 'var(--color-text-muted)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{error || 'No SOL data available'}</p>
        </div>
      </div>
    );
  }

  const isHighRisk = solData.sol_risk_level === 'HIGH' || solData.is_expired;
  const isMediumRisk = solData.sol_risk_level === 'MEDIUM';

  return (
    <div className={`financial-card ${className}`} style={{
      borderColor: isHighRisk ? 'var(--color-danger)' : isMediumRisk ? 'var(--color-warning)' : 'var(--color-border)'
    }}>
      <div style={{ 
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: '8px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h3 style={{ 
          fontSize: '12px', 
          fontWeight: '600', 
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Scale style={{ width: '16px', height: '16px', color: 'var(--color-primary)' }} />
          STATUTE OF LIMITATIONS
        </h3>
        <span className={`status-indicator ${solData.sol_risk_level === 'HIGH' ? 'critical' : solData.sol_risk_level === 'MEDIUM' ? 'warning' : 'success'}`}>
          {solData.sol_risk_level} RISK
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Expiration Status */}
        <div style={{
          borderRadius: 'var(--radius-sm)',
          padding: '12px',
          backgroundColor: solData.is_expired ? 'var(--color-danger-bg)' :
                          solData.days_until_expiration < 365 ? 'var(--color-warning-bg)' :
                          'var(--color-success-bg)',
          border: `1px solid ${
            solData.is_expired ? 'var(--color-danger)' :
            solData.days_until_expiration < 365 ? 'var(--color-warning)' :
            'var(--color-success)'
          }`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock style={{
                width: '16px',
                height: '16px',
                color: solData.is_expired ? 'var(--color-danger)' :
                       solData.days_until_expiration < 365 ? 'var(--color-warning)' :
                       'var(--color-success)'
              }} />
              <span style={{ fontWeight: '500', fontSize: '12px', color: 'var(--color-text)' }}>
                {solService.formatDaysUntilExpiration(solData.days_until_expiration)}
              </span>
            </div>
            {solData.is_expired && (
              <span className="status-indicator critical" style={{ fontSize: '10px' }}>EXPIRED</span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            <p>Expiration: {solService.formatDate(solData.adjusted_expiration_date)}</p>
          </div>
        </div>

        {/* Trigger Information */}
        <div style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px',
          backgroundColor: 'var(--color-surface)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '11px', 
            fontWeight: '500',
            color: 'var(--color-text-secondary)',
            marginBottom: '8px'
          }}>
            <Calendar style={{ width: '14px', height: '14px' }} />
            SOL TRIGGER EVENT
          </div>
          <div style={{ paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div className="financial-detail-item">
              <span className="label">EVENT</span>
              <span className="value">{solService.formatTriggerEvent(solData.sol_trigger_event)}</span>
            </div>
            <div className="financial-detail-item">
              <span className="label">DATE</span>
              <span className="value">{solService.formatDate(solData.sol_trigger_date)}</span>
            </div>
          </div>
        </div>

        {/* Jurisdiction Information */}
        <div style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px',
          backgroundColor: 'var(--color-surface)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '11px', 
            fontWeight: '500',
            color: 'var(--color-text-secondary)',
            marginBottom: '8px'
          }}>
            <MapPin style={{ width: '14px', height: '14px' }} />
            JURISDICTION DETAILS
          </div>
          <div style={{ paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div className="financial-detail-item">
              <span className="label">STATE</span>
              <span className="value">
                {solData.property_state}
                {solData.jurisdiction_name && (
                  <span style={{ color: 'var(--color-text-muted)' }}> ({solData.jurisdiction_name})</span>
                )}
              </span>
            </div>
            {solData.jurisdiction_risk_level && (
              <div className="financial-detail-item">
                <span className="label">JURISDICTION RISK</span>
                <span className={`status-indicator ${solData.jurisdiction_risk_level === 'HIGH' ? 'critical' : solData.jurisdiction_risk_level === 'MEDIUM' ? 'warning' : 'success'}`}>
                  {solData.jurisdiction_risk_level}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Risk Factors */}
        {solData.risk_factors && (
          <div style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px',
            backgroundColor: 'var(--color-surface)'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              fontSize: '11px', 
              fontWeight: '500',
              color: 'var(--color-text-secondary)',
              marginBottom: '8px'
            }}>
              <Shield style={{ width: '14px', height: '14px' }} />
              RISK ASSESSMENT
            </div>
            <div style={{ paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="financial-detail-item">
                <span className="label">RISK SCORE</span>
                <span className="value">{solData.sol_risk_score}/100</span>
              </div>
              
              {solData.risk_factors.lien_extinguishment_risk && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-danger)' }}>
                  <AlertTriangle style={{ width: '12px', height: '12px' }} />
                  <span>Lien may be extinguished upon expiration</span>
                </div>
              )}
              
              {solData.risk_factors.in_active_foreclosure && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-success)' }}>
                  <Info style={{ width: '12px', height: '12px' }} />
                  <span>Active foreclosure reduces SOL risk</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tolling Events */}
        {solData.tolling_events && solData.tolling_events.length > 0 && (
          <div style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px',
            backgroundColor: 'var(--color-surface)'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              fontSize: '11px', 
              fontWeight: '500',
              color: 'var(--color-text-secondary)',
              marginBottom: '8px'
            }}>
              <Clock style={{ width: '14px', height: '14px' }} />
              TOLLING EVENTS
            </div>
            <div style={{ paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {solData.tolling_events.map((event, index) => (
                <div key={index} className="financial-detail-item">
                  <span className="label">{event.type}</span>
                  <span className="value">{event.days_tolled} days</span>
                </div>
              ))}
              <div className="financial-detail-item" style={{ paddingTop: '4px' }}>
                <span className="label">TOTAL TOLLED</span>
                <span className="value">{solData.total_tolled_days} days</span>
              </div>
            </div>
          </div>
        )}

        {/* Last Updated */}
        <div style={{ 
          fontSize: '10px', 
          color: 'var(--color-text-muted)', 
          textAlign: 'center', 
          paddingTop: '8px', 
          borderTop: '1px solid var(--color-border)' 
        }}>
          Last calculated: {solService.formatDate(solData.calculation_date)}
        </div>
      </div>
    </div>
  );
};

export default SOLInfoCard;