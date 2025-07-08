import { useEffect } from 'react';
import { FinancialKPIDashboard } from '../components/FinancialKPIDashboard';
import { AlertSummary } from '../components/AlertSummary';
import { format } from 'date-fns';
import '../styles/design-system.css';

function DashboardPage() {
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
          <span className="label">SESSION</span>
          <span className="value">{format(new Date(), 'MMM d, yyyy HH:mm')}</span>
        </div>
        <div className="quick-stat">
          <span className="label">MARKET</span>
          <span className="value" style={{ color: 'var(--color-success)' }}>OPEN</span>
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
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase' }}>CHART COMPONENT</div>
              <div style={{ fontSize: '10px' }}>Performance over time visualization</div>
            </div>
          </div>
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
              <tr>
                <td><span className="status-indicator success">PERFORMING</span></td>
                <td className="data-value">1,524</td>
                <td className="data-value">$203.7M</td>
                <td className="data-value">$133.6K</td>
                <td className="data-value" style={{ color: 'var(--color-success)' }}>+2.1%</td>
              </tr>
              <tr>
                <td><span className="status-indicator warning">NON-PERFORM</span></td>
                <td className="data-value">298</td>
                <td className="data-value">$41.2M</td>
                <td className="data-value">$138.3K</td>
                <td className="data-value" style={{ color: 'var(--color-danger)' }}>+4.7%</td>
              </tr>
              <tr>
                <td><span className="status-indicator critical">DEFAULT</span></td>
                <td className="data-value">25</td>
                <td className="data-value">$2.4M</td>
                <td className="data-value">$96.0K</td>
                <td className="data-value" style={{ color: 'var(--color-danger)' }}>+15.2%</td>
              </tr>
            </tbody>
          </table>
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