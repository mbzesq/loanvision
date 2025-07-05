import React, { useState, useEffect } from 'react';
import solService, { SOLCalculation } from '../../services/solService';
import '../../styles/design-system.css';

interface SOLInfoCardProps {
  loanId: number;
  compact?: boolean;
  showCalculateButton?: boolean;
}

const SOLInfoCard: React.FC<SOLInfoCardProps> = ({ 
  loanId, 
  compact = false, 
  showCalculateButton = false 
}) => {
  const [solData, setSolData] = useState<SOLCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSOLData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await solService.calculateLoanSOL(loanId);
      setSolData(data);
    } catch (err) {
      setError('Failed to fetch SOL data');
      console.error('SOL fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSOLData();
  }, [loanId]);

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'HIGH':
        return '🔴';
      case 'MEDIUM':
        return '🟡';
      case 'LOW':
        return '🟢';
      default:
        return '⚪';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="sol-info-card" style={{
        padding: compact ? 'var(--space-sm)' : 'var(--space-md)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <div className="loading-spinner" style={{
            width: '16px',
            height: '16px',
            border: '2px solid var(--neutral-200)',
            borderTop: '2px solid var(--primary-blue)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-600)' }}>
            Loading SOL data...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sol-info-card" style={{
        padding: compact ? 'var(--space-sm)' : 'var(--space-md)',
        border: '1px solid var(--warning-red)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'rgba(239, 68, 68, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--warning-red)' }}>
            {error}
          </span>
          {showCalculateButton && (
            <button
              onClick={fetchSOLData}
              style={{
                padding: '4px 8px',
                fontSize: 'var(--font-size-xs)',
                backgroundColor: 'var(--primary-blue)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!solData) {
    return (
      <div className="sol-info-card" style={{
        padding: compact ? 'var(--space-sm)' : 'var(--space-md)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--neutral-50)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-600)' }}>
            No SOL data available
          </span>
          {showCalculateButton && (
            <button
              onClick={fetchSOLData}
              style={{
                padding: '4px 8px',
                fontSize: 'var(--font-size-xs)',
                backgroundColor: 'var(--primary-blue)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer'
              }}
            >
              Calculate
            </button>
          )}
        </div>
      </div>
    );
  }

  const priorityLevel = solService.getPriorityLevel(solData);
  const isCritical = solService.isCritical(solData);

  if (compact) {
    return (
      <div className="sol-info-card-compact" style={{
        padding: 'var(--space-sm)',
        border: `1px solid ${solService.getRiskLevelColor(solData.sol_risk_level)}`,
        borderRadius: 'var(--radius-sm)',
        backgroundColor: solService.getRiskLevelBackgroundColor(solData.sol_risk_level)
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          <span>{getRiskIcon(solData.sol_risk_level)}</span>
          <div>
            <div style={{ 
              fontSize: 'var(--font-size-xs)', 
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--neutral-800)' 
            }}>
              SOL: {solService.formatDaysUntilExpiration(solData.days_until_expiration, solData.is_expired)}
            </div>
            <div style={{ 
              fontSize: 'var(--font-size-xs)', 
              color: 'var(--neutral-600)' 
            }}>
              {solData.sol_risk_level} Risk
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sol-info-card" style={{
      padding: 'var(--space-md)',
      border: `1px solid ${solService.getRiskLevelColor(solData.sol_risk_level)}`,
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'white'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 'var(--space-md)'
      }}>
        <h4 style={{ 
          margin: 0, 
          fontSize: 'var(--font-size-md)', 
          fontWeight: 'var(--font-weight-semibold)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)'
        }}>
          {getRiskIcon(solData.sol_risk_level)} Statute of Limitations
        </h4>
        <span style={{
          padding: '2px 8px',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-medium)',
          backgroundColor: solService.getRiskLevelColor(solData.sol_risk_level),
          color: 'white',
          borderRadius: 'var(--radius-sm)'
        }}>
          {solData.sol_risk_level} RISK
        </span>
      </div>

      {/* Key Information */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
        <div>
          <label style={{ 
            fontSize: 'var(--font-size-xs)', 
            color: 'var(--neutral-600)',
            fontWeight: 'var(--font-weight-medium)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Expiration Status
          </label>
          <div style={{ 
            fontSize: 'var(--font-size-sm)', 
            fontWeight: 'var(--font-weight-medium)',
            color: solData.is_expired ? 'var(--warning-red)' : 'var(--neutral-800)',
            marginTop: '2px'
          }}>
            {solService.formatDaysUntilExpiration(solData.days_until_expiration, solData.is_expired)}
          </div>
        </div>
        
        <div>
          <label style={{ 
            fontSize: 'var(--font-size-xs)', 
            color: 'var(--neutral-600)',
            fontWeight: 'var(--font-weight-medium)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Expiration Date
          </label>
          <div style={{ 
            fontSize: 'var(--font-size-sm)', 
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--neutral-800)',
            marginTop: '2px'
          }}>
            {formatDate(solData.adjusted_expiration_date)}
          </div>
        </div>
      </div>

      {/* Trigger Information */}
      <div style={{ 
        marginTop: 'var(--space-md)', 
        paddingTop: 'var(--space-md)', 
        borderTop: '1px solid var(--neutral-200)' 
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <div>
            <label style={{ 
              fontSize: 'var(--font-size-xs)', 
              color: 'var(--neutral-600)',
              fontWeight: 'var(--font-weight-medium)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Trigger Event
            </label>
            <div style={{ 
              fontSize: 'var(--font-size-sm)', 
              color: 'var(--neutral-800)',
              marginTop: '2px',
              textTransform: 'capitalize'
            }}>
              {solData.sol_trigger_event.replace(/_/g, ' ')}
            </div>
          </div>
          
          <div>
            <label style={{ 
              fontSize: 'var(--font-size-xs)', 
              color: 'var(--neutral-600)',
              fontWeight: 'var(--font-weight-medium)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Trigger Date
            </label>
            <div style={{ 
              fontSize: 'var(--font-size-sm)', 
              color: 'var(--neutral-800)',
              marginTop: '2px'
            }}>
              {formatDate(solData.sol_trigger_date)}
            </div>
          </div>
        </div>
      </div>

      {/* Risk Factors */}
      {(isCritical || solData.risk_factors.in_active_foreclosure) && (
        <div style={{ 
          marginTop: 'var(--space-md)', 
          padding: 'var(--space-sm)',
          backgroundColor: isCritical ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
          borderRadius: 'var(--radius-sm)',
          border: `1px solid ${isCritical ? 'var(--warning-red)' : 'var(--success-green)'}`
        }}>
          <div style={{ 
            fontSize: 'var(--font-size-xs)', 
            fontWeight: 'var(--font-weight-medium)',
            color: isCritical ? 'var(--warning-red)' : 'var(--success-green)',
            marginBottom: '4px'
          }}>
            {isCritical ? '⚠️ Critical Alert' : '✅ Risk Mitigation'}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-700)' }}>
            {isCritical 
              ? 'This loan requires immediate attention due to SOL expiration risk.'
              : solData.risk_factors.risk_mitigation || 'Active foreclosure reduces SOL risk.'
            }
          </div>
        </div>
      )}

      {/* Tolling Events */}
      {solData.tolling_events.length > 0 && (
        <div style={{ 
          marginTop: 'var(--space-md)', 
          paddingTop: 'var(--space-md)', 
          borderTop: '1px solid var(--neutral-200)' 
        }}>
          <label style={{ 
            fontSize: 'var(--font-size-xs)', 
            color: 'var(--neutral-600)',
            fontWeight: 'var(--font-weight-medium)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Tolling Events ({solData.total_tolled_days} days)
          </label>
          <div style={{ marginTop: '4px' }}>
            {solData.tolling_events.map((event, index) => (
              <div key={index} style={{ 
                fontSize: 'var(--font-size-xs)', 
                color: 'var(--neutral-700)',
                marginBottom: '2px'
              }}>
                • {event.type.replace(/_/g, ' ')}: {event.days_tolled} days
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SOLInfoCard;