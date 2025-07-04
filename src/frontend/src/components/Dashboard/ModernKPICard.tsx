import React from 'react';
import '../../styles/design-system.css';

interface TrendData {
  value: number;
  direction: 'up' | 'down' | 'neutral';
  period: string;
}

interface ModernKPICardProps {
  title: string;
  value: string;
  trend?: TrendData;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'orange';
  format?: 'currency' | 'number' | 'percentage';
}

const ModernKPICard: React.FC<ModernKPICardProps> = ({ 
  title, 
  value, 
  trend, 
  icon, 
  color = 'blue',
  format = 'currency'
}) => {
  const getColorClasses = (colorType: string) => {
    switch (colorType) {
      case 'green':
        return {
          accent: 'var(--success-green)',
          bg: 'rgba(16, 185, 129, 0.06)',
          text: 'var(--success-green)'
        };
      case 'red':
        return {
          accent: 'var(--warning-red)',
          bg: 'rgba(239, 68, 68, 0.06)',
          text: 'var(--warning-red)'
        };
      case 'orange':
        return {
          accent: 'var(--warning-orange)',
          bg: 'rgba(245, 158, 11, 0.06)',
          text: 'var(--warning-orange)'
        };
      default:
        return {
          accent: 'var(--primary-blue)',
          bg: 'rgba(37, 99, 235, 0.06)',
          text: 'var(--primary-blue)'
        };
    }
  };

  const colors = getColorClasses(color);

  const formatTrendValue = (value: number) => {
    return format === 'percentage' ? `${value}%` : value.toLocaleString();
  };

  const TrendIcon = ({ direction }: { direction: 'up' | 'down' | 'neutral' }) => {
    if (direction === 'up') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
          <polyline points="17 6 23 6 23 12"></polyline>
        </svg>
      );
    }
    if (direction === 'down') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
          <polyline points="17 18 23 18 23 12"></polyline>
        </svg>
      );
    }
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    );
  };

  return (
    <div 
      className="kpi-card animate-fade-in"
      style={{
        background: `linear-gradient(135deg, ${colors.bg} 0%, rgba(255,255,255,0.9) 100%)`
      }}
    >
      {/* Top accent bar */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: `linear-gradient(90deg, ${colors.accent}, ${colors.accent}dd)`
        }}
      />
      
      {/* Header with icon */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-md)'
      }}>
        <h3 style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-medium)',
          color: 'var(--neutral-600)',
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {title}
        </h3>
        
        {icon && (
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-lg)',
            background: colors.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.text
          }}>
            {icon}
          </div>
        )}
      </div>

      {/* Main value */}
      <div style={{
        fontSize: 'var(--font-size-4xl)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--neutral-900)',
        lineHeight: 'var(--line-height-tight)',
        marginBottom: trend ? 'var(--space-sm)' : 0
      }}>
        {value}
      </div>

      {/* Trend indicator */}
      {trend && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-medium)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: trend.direction === 'up' ? '#059669' : 
                   trend.direction === 'down' ? '#DC2626' : 'var(--neutral-500)',
            opacity: 0.8
          }}>
            <TrendIcon direction={trend.direction} />
            <span>{formatTrendValue(trend.value)}</span>
          </div>
          <span style={{ color: 'var(--neutral-400)', fontSize: 'var(--font-size-xs)' }}>
            vs {trend.period}
          </span>
        </div>
      )}
    </div>
  );
};

export default ModernKPICard;