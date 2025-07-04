import React from 'react';
import '../../styles/design-system.css';

interface ModernChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  height?: string;
}

const ModernChartContainer: React.FC<ModernChartContainerProps> = ({
  title,
  subtitle,
  children,
  actions,
  loading = false,
  error = null,
  height = '400px'
}) => {
  const LoadingShimmer = () => (
    <div style={{
      height: '100%',
      borderRadius: 'var(--radius-md)',
      background: 'linear-gradient(90deg, var(--neutral-200) 25%, var(--neutral-100) 50%, var(--neutral-200) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 2s infinite'
    }} />
  );

  const ErrorState = () => (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--neutral-500)',
      textAlign: 'center'
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <p style={{ 
        marginTop: 'var(--space-md)', 
        fontSize: 'var(--font-size-sm)',
        color: 'var(--warning-red)'
      }}>
        {error}
      </p>
    </div>
  );

  return (
    <div 
      className="chart-container animate-fade-in"
      style={{ 
        minHeight: height,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 'var(--space-lg)',
        borderBottom: '1px solid var(--neutral-200)',
        paddingBottom: 'var(--space-md)'
      }}>
        <div>
          <h3 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--neutral-900)',
            margin: '0 0 var(--space-xs) 0',
            lineHeight: 'var(--line-height-tight)'
          }}>
            {title}
          </h3>
          {subtitle && (
            <p style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--neutral-600)',
              margin: 0,
              lineHeight: 'var(--line-height-normal)'
            }}>
              {subtitle}
            </p>
          )}
        </div>
        
        {actions && (
          <div style={{
            display: 'flex',
            gap: 'var(--space-sm)',
            alignItems: 'center'
          }}>
            {actions}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        minHeight: '320px',
        position: 'relative'
      }}>
        {loading ? (
          <LoadingShimmer />
        ) : error ? (
          <ErrorState />
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default ModernChartContainer;