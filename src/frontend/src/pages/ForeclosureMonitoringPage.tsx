import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle, Calendar, RefreshCw, Gavel, MapPin } from 'lucide-react';
import { foreclosureService, ForeclosureSummary, ForeclosureLoan, ForeclosureStateData } from '../services/foreclosureService';
import ForeclosureMonitorCard from '../components/Dashboard/ForeclosureMonitorCard';
import { LoanDetailModal } from '../components/LoanDetailModal';
import { getOverallLoanStatus } from '../lib/timelineUtils';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import '../styles/financial-design-system.css';

interface ForeclosureTrendData {
  month: string;
  started: number;
  completed: number;
  overdue: number;
  totalActive: number;
}

const ForeclosureMonitoringPage: React.FC = () => {
  const [foreclosureSummary, setForeclosureSummary] = useState<ForeclosureSummary | null>(null);
  const [foreclosureLoans, setForeclosureLoans] = useState<ForeclosureLoan[]>([]);
  const [stateData, setStateData] = useState<ForeclosureStateData[]>([]);
  const [trendData, setTrendData] = useState<ForeclosureTrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  useEffect(() => {
    loadForeclosureData();
  }, []);

  const loadForeclosureData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load all foreclosure data in parallel
      const [summary, loans, states] = await Promise.all([
        foreclosureService.getForeclosureSummary(),
        foreclosureService.getForeclosureLoans(),
        foreclosureService.getForeclosureByState()
      ]);
      
      setForeclosureSummary(summary);
      setForeclosureLoans(loans);
      setStateData(states);
      
      // Generate trend data based on summary
      setTrendData(generateMockTrendData());
      
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error loading foreclosure data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load foreclosure data');
      // If API fails, fall back to mock data for development
      if (import.meta.env.DEV) {
        setForeclosureSummary(generateMockSummary());
        setForeclosureLoans(generateMockLoans());
        setStateData(generateMockStateData());
        setTrendData(generateMockTrendData());
      }
    } finally {
      setLoading(false);
    }
  };

  // Mock data generators for development
  const generateMockSummary = (): ForeclosureSummary => ({
    totalInForeclosure: 47,
    judicialCount: 31,
    nonJudicialCount: 16,
    avgDaysInProcess: 287,
    completedForeclosures: 23,
    statusBreakdown: {
      'Notice of Default': 12,
      'Lis Pendens Filed': 8,
      'Notice of Sale': 15,
      'Foreclosure Sale': 7,
      'REO': 5
    },
    riskDistribution: {
      overdue: 18,
      onTrack: 24,
      completed: 23
    }
  });

  const generateMockLoans = (): ForeclosureLoan[] => [
    {
      loanId: 'FC001',
      borrowerName: 'John Smith',
      state: 'CA',
      jurisdiction: 'Judicial',
      currentMilestone: 'Notice of Sale',
      fcStartDate: '2024-03-15',
      daysInProcess: 298,
      expectedCompletionDate: '2024-09-15',
      status: 'overdue' as const,
      principalBalance: 345000
    },
    {
      loanId: 'FC002',
      borrowerName: 'Maria Garcia',
      state: 'TX',
      jurisdiction: 'Non-Judicial',
      currentMilestone: 'Notice of Default',
      fcStartDate: '2024-06-01',
      daysInProcess: 201,
      expectedCompletionDate: '2025-01-15',
      status: 'on_track' as const,
      principalBalance: 289000
    },
    {
      loanId: 'FC003',
      borrowerName: 'Robert Johnson',
      state: 'FL',
      jurisdiction: 'Judicial',
      currentMilestone: 'Lis Pendens Filed',
      fcStartDate: '2024-01-10',
      daysInProcess: 365,
      expectedCompletionDate: '2024-12-01',
      status: 'overdue' as const,
      principalBalance: 412000
    }
  ];

  const generateMockStateData = (): ForeclosureStateData[] => [
    { state: 'CA', totalLoans: 15, judicialCount: 15, nonJudicialCount: 0, avgDaysInProcess: 320, completedCount: 8 },
    { state: 'TX', totalLoans: 12, judicialCount: 0, nonJudicialCount: 12, avgDaysInProcess: 180, completedCount: 6 },
    { state: 'FL', totalLoans: 10, judicialCount: 10, nonJudicialCount: 0, avgDaysInProcess: 290, completedCount: 4 },
    { state: 'NY', totalLoans: 8, judicialCount: 8, nonJudicialCount: 0, avgDaysInProcess: 410, completedCount: 3 },
    { state: 'AZ', totalLoans: 2, judicialCount: 0, nonJudicialCount: 2, avgDaysInProcess: 120, completedCount: 2 }
  ];

  const generateMockTrendData = (): ForeclosureTrendData[] => [
    { month: 'Jul 2024', started: 8, completed: 3, overdue: 12, totalActive: 42 },
    { month: 'Aug 2024', started: 6, completed: 5, overdue: 15, totalActive: 43 },
    { month: 'Sep 2024', started: 9, completed: 4, overdue: 16, totalActive: 48 },
    { month: 'Oct 2024', started: 4, completed: 7, overdue: 14, totalActive: 45 },
    { month: 'Nov 2024', started: 7, completed: 6, overdue: 17, totalActive: 46 },
    { month: 'Dec 2024', started: 5, completed: 8, overdue: 18, totalActive: 47 }
  ];


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'overdue': return <AlertTriangle style={{ width: '14px', height: '14px', color: 'var(--color-danger)' }} />;
      case 'on_track': return <Clock style={{ width: '14px', height: '14px', color: 'var(--color-success)' }} />;
      case 'completed': return <Calendar style={{ width: '14px', height: '14px', color: 'var(--color-info)' }} />;
      default: return null;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };


  if (loading) {
    return (
      <div style={{ 
        padding: '12px', 
        minHeight: '100vh',
        backgroundColor: 'var(--color-background)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ 
          color: 'var(--color-text-muted)',
          fontSize: '12px',
          textAlign: 'center'
        }}>
          <RefreshCw style={{ width: '24px', height: '24px', marginBottom: '8px', animation: 'spin 1s linear infinite' }} />
          <div>LOADING FORECLOSURE DATA...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '12px', 
      minHeight: '100vh',
      backgroundColor: 'var(--color-background)'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: 'var(--color-text)',
            margin: '0 0 4px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            <Gavel style={{ width: '20px', height: '20px', marginRight: '8px', verticalAlign: 'text-bottom' }} />
            FORECLOSURE MONITORING
          </h1>
          <p style={{ 
            fontSize: '11px', 
            color: 'var(--color-text-muted)',
            margin: 0
          }}>
            Portfolio foreclosure proceedings and timeline management • Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        
        <button 
          onClick={loadForeclosureData}
          className="btn-compact btn-secondary"
          disabled={loading}
        >
          <RefreshCw style={{ width: '12px', height: '12px', marginRight: '4px' }} />
          REFRESH
        </button>
      </div>

      {error && (
        <div style={{ 
          padding: '12px',
          backgroundColor: 'var(--color-danger-bg)',
          border: '1px solid var(--color-danger)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px',
          fontSize: '12px',
          color: 'var(--color-danger)'
        }}>
          Error: {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        {/* Foreclosure Monitor Card */}
        <ForeclosureMonitorCard data={foreclosureSummary} loading={loading} />

        {/* Trend Chart */}
        <div className="financial-card">
          <div style={{ 
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '8px',
            marginBottom: '16px'
          }}>
            <h3 style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              margin: 0
            }}>
              FORECLOSURE ACTIVITY TREND
            </h3>
          </div>
          
          <div style={{ height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                  stroke="var(--color-border)"
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                  stroke="var(--color-border)"
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px'
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '10px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="started" 
                  stroke="var(--color-primary)" 
                  strokeWidth={2}
                  name="Started"
                />
                <Line 
                  type="monotone" 
                  dataKey="completed" 
                  stroke="var(--color-success)" 
                  strokeWidth={2}
                  name="Completed"
                />
                <Line 
                  type="monotone" 
                  dataKey="overdue" 
                  stroke="var(--color-danger)" 
                  strokeWidth={2}
                  name="Overdue"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '20px' }}>
        {/* Active Foreclosures Table */}
        <div className="financial-card" style={{ height: 'fit-content' }}>
          <div style={{ 
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '8px',
            marginBottom: '16px'
          }}>
            <h3 style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              margin: 0
            }}>
              ACTIVE FORECLOSURES (TOP 10)
            </h3>
          </div>

          <div style={{ maxHeight: '420px', overflowY: 'auto', position: 'relative' }}>
            <table style={{ width: '100%', fontSize: '11px' }}>
              <thead style={{ 
                position: 'sticky', 
                top: 0, 
                backgroundColor: 'var(--color-surface)',
                zIndex: 10,
                borderBottom: '2px solid var(--color-border)'
              }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: '600', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)' }}>
                    LOAN ID
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: '600', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)' }}>
                    BORROWER
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: '600', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)' }}>
                    STATE
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: '600', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)' }}>
                    MILESTONE
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 4px', fontWeight: '600', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)' }}>
                    DAYS
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 4px', fontWeight: '600', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)' }}>
                    BALANCE
                  </th>
                  <th style={{ textAlign: 'center', padding: '8px 4px', fontWeight: '600', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)' }}>
                    TIMELINE STATUS
                  </th>
                  <th style={{ textAlign: 'center', padding: '8px 4px', fontWeight: '600', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)' }}>
                    STATUS
                  </th>
                </tr>
              </thead>
              <tbody>
                {foreclosureLoans.slice(0, 10).map((loan, index) => {
                  // Convert foreclosure loan to format expected by getOverallLoanStatus
                  const loanForStatus = {
                    fc_status: loan.status === 'completed' ? 'CLOSED' : 'ACTIVE',
                    state: loan.state,
                    fc_jurisdiction: loan.jurisdiction,
                    fc_start_date: loan.fcStartDate
                  };
                  const timelineStatus = getOverallLoanStatus(loanForStatus as any);
                  
                  return (
                    <tr 
                      key={loan.loanId}
                      style={{ 
                        borderBottom: index < 9 ? '1px solid var(--color-border)' : 'none'
                      }}
                    >
                      <td style={{ padding: '8px 4px', fontWeight: '500', color: 'var(--color-primary)' }}>
                        <button
                          onClick={() => setSelectedLoanId(loan.loanId)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-primary)',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            fontSize: 'inherit',
                            fontWeight: '500',
                            padding: 0
                          }}
                        >
                          {loan.loanId}
                        </button>
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        {loan.borrowerName}
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        {loan.state}
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        {loan.currentMilestone}
                      </td>
                      <td style={{ 
                        padding: '8px 4px', 
                        textAlign: 'right',
                        color: loan.daysInProcess > 300 ? 'var(--color-danger)' : 'var(--color-text)'
                      }}>
                        {loan.daysInProcess}
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                        {formatCurrency(loan.principalBalance)}
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                        <span
                          style={{
                            color: timelineStatus === 'Overdue' ? 'var(--color-danger)' : 
                                   timelineStatus === 'On Track' ? 'var(--color-success)' : 'var(--color-text-muted)',
                            fontWeight: '500',
                            fontSize: '10px'
                          }}
                        >
                          {timelineStatus || 'N/A'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          {getStatusIcon(loan.status)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* State Breakdown */}
        <div className="financial-card">
          <div style={{ 
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '8px',
            marginBottom: '16px'
          }}>
            <h3 style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <MapPin style={{ width: '12px', height: '12px' }} />
              BY JURISDICTION
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stateData.map((state) => (
              <div 
                key={state.state}
                style={{
                  padding: '8px',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '6px'
                }}>
                  <span style={{ fontWeight: '600', fontSize: '12px' }}>{state.state}</span>
                  <span style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: 'var(--color-primary)' 
                  }}>
                    {state.totalLoans}
                  </span>
                </div>
                
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Judicial: {state.judicialCount}</span>
                    <span>Non-Judicial: {state.nonJudicialCount}</span>
                  </div>
                  <div style={{ marginTop: '2px' }}>
                    Avg Days: {Math.round(state.avgDaysInProcess)} | Completed: {state.completedCount}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Loan Detail Modal */}
      {selectedLoanId && (
        <LoanDetailModal
          loanId={selectedLoanId}
          onClose={() => setSelectedLoanId(null)}
        />
      )}
    </div>
  );
};

export default ForeclosureMonitoringPage;