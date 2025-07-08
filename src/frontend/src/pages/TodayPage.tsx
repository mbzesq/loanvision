import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { AlertCircle, TrendingUp, Scale, FileText, DollarSign, Calendar, ChevronRight, Bell } from 'lucide-react';
import { format } from 'date-fns';
import '../styles/design-system.css';

// Mock data structure for alerts
interface Alert {
  id: string;
  type: 'sol' | 'performance' | 'legal' | 'document' | 'payment';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  loanCount: number;
  createdAt: Date;
  ageInDays: number;
  status: 'new' | 'acknowledged' | 'in_progress';
}

// Mock data structure for tasks
interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  relatedAlertId?: string;
  assignedTo?: string;
}

function TodayPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  // Mock data generation
  useEffect(() => {
    // Generate mock alerts
    const mockAlerts: Alert[] = [
      {
        id: '1',
        type: 'sol',
        severity: 'critical',
        title: 'SOL Expiring Within 30 Days',
        description: '12 loans approaching statute of limitations deadline',
        loanCount: 12,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        ageInDays: 2,
        status: 'new'
      },
      {
        id: '2',
        type: 'performance',
        severity: 'warning',
        title: 'Non-Performing Loans Increasing',
        description: '8 loans transitioned from performing to non-performing status',
        loanCount: 8,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        ageInDays: 5,
        status: 'acknowledged'
      },
      {
        id: '3',
        type: 'document',
        severity: 'warning',
        title: 'Missing Critical Documents',
        description: '5 loans missing mortgage or assignment documentation',
        loanCount: 5,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        ageInDays: 1,
        status: 'new'
      },
      {
        id: '4',
        type: 'legal',
        severity: 'critical',
        title: 'New Foreclosure Filing Required',
        description: '3 loans require immediate foreclosure action',
        loanCount: 3,
        createdAt: new Date(),
        ageInDays: 0,
        status: 'new'
      },
      {
        id: '5',
        type: 'payment',
        severity: 'info',
        title: 'Payment Received',
        description: '2 loans received unexpected payments',
        loanCount: 2,
        createdAt: new Date(),
        ageInDays: 0,
        status: 'new'
      }
    ];

    // Generate mock tasks
    const mockTasks: Task[] = [
      {
        id: '1',
        title: 'Review SOL Documentation',
        description: 'Verify chain of title for loans approaching SOL deadline',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        priority: 'high',
        status: 'pending',
        relatedAlertId: '1'
      },
      {
        id: '2',
        title: 'Contact Servicer on Non-Performing Loans',
        description: 'Request status update and action plan for recently defaulted loans',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        priority: 'medium',
        status: 'in_progress',
        relatedAlertId: '2'
      },
      {
        id: '3',
        title: 'Upload Missing Documents',
        description: 'Obtain and upload missing mortgage documentation from servicer',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        priority: 'medium',
        status: 'pending',
        relatedAlertId: '3'
      }
    ];

    setAlerts(mockAlerts);
    setTasks(mockTasks);
  }, []);

  const handleAlertSelect = (alertId: string) => {
    const newSelection = new Set(selectedAlerts);
    if (newSelection.has(alertId)) {
      newSelection.delete(alertId);
    } else {
      newSelection.add(alertId);
    }
    setSelectedAlerts(newSelection);
  };

  const handleBulkAction = (action: string) => {
    console.log(`Performing ${action} on ${selectedAlerts.size} alerts`);
    // Implement bulk action logic
  };

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'sol': return <Scale className="h-4 w-4" />;
      case 'performance': return <TrendingUp className="h-4 w-4" />;
      case 'legal': return <FileText className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      case 'payment': return <DollarSign className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredAlerts = filterSeverity === 'all' 
    ? alerts 
    : alerts.filter(alert => alert.severity === filterSeverity);

  const alertCounts = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length,
    total: alerts.length
  };

  return (
    <div style={{ 
      padding: '12px', 
      minHeight: '100vh',
      backgroundColor: 'var(--color-background)'
    }}>
      {/* Page Header with Date */}
      <div className="quick-stats" style={{ marginBottom: '16px' }}>
        <div className="quick-stat">
          <span className="label">SESSION</span>
          <span className="value">{format(new Date(), 'MMM d, yyyy HH:mm')}</span>
        </div>
        <div className="quick-stat">
          <span className="label">PORTFOLIO</span>
          <span className="value">NPL-MAIN</span>
        </div>
        <div className="quick-stat">
          <span className="label">LAST UPDATE</span>
          <span className="value data-fresh">{format(new Date(), 'HH:mm:ss')}</span>
        </div>
        <div className="quick-stat">
          <span className="label">ALERTS</span>
          <span className="value" style={{ color: alertCounts.critical > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
            {alertCounts.total} ACTIVE
          </span>
        </div>
      </div>

      {/* Alert Summary Bar - Compact Financial Style */}
      <div className="alert-strip">
        <div className="alert-count">
          <span style={{ color: 'var(--color-danger)' }}>●</span>
          <span className="count">{alertCounts.critical}</span>
          <span>CRITICAL</span>
        </div>
        <div className="alert-count">
          <span style={{ color: 'var(--color-warning)' }}>●</span>
          <span className="count">{alertCounts.warning}</span>
          <span>WARNING</span>
        </div>
        <div className="alert-count">
          <span style={{ color: 'var(--color-info)' }}>●</span>
          <span className="count">{alertCounts.info}</span>
          <span>INFO</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="data-timestamp">Last: {format(new Date(), 'HH:mm:ss')}</span>
          <button className="btn-compact btn-primary">MANAGE</button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '12px' }}>
        {/* Left Column - Alerts Table */}
        <div className="financial-card scroll-container">
          <div className="filter-bar-advanced" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className={`btn-compact ${filterSeverity === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterSeverity('all')}
              >
                ALL
              </button>
              <button 
                className={`btn-compact ${filterSeverity === 'critical' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterSeverity('critical')}
              >
                CRITICAL
              </button>
              <button 
                className={`btn-compact ${filterSeverity === 'warning' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterSeverity('warning')}
              >
                WARNING
              </button>
            </div>
            {selectedAlerts.size > 0 && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {selectedAlerts.size} SELECTED
                </span>
                <button className="btn-compact btn-secondary" onClick={() => handleBulkAction('acknowledge')}>
                  ACK
                </button>
                <button className="btn-compact btn-primary" onClick={() => handleBulkAction('createTask')}>
                  TASK
                </button>
              </div>
            )}
          </div>

          <table className="financial-table">
            <thead>
              <tr>
                <th style={{ width: '30px' }}></th>
                <th style={{ width: '50px' }}>SEV</th>
                <th style={{ width: '60px' }}>TYPE</th>
                <th>DESCRIPTION</th>
                <th style={{ width: '50px' }}>LOANS</th>
                <th style={{ width: '60px' }}>AGE</th>
                <th style={{ width: '80px' }}>CREATED</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map((alert) => (
                <tr 
                  key={alert.id}
                  style={{ 
                    cursor: 'pointer',
                    backgroundColor: selectedAlerts.has(alert.id) ? 'rgba(26, 54, 93, 0.3)' : 'transparent'
                  }}
                  onClick={() => handleAlertSelect(alert.id)}
                >
                  <td>
                    <input 
                      type="checkbox" 
                      checked={selectedAlerts.has(alert.id)}
                      onChange={() => handleAlertSelect(alert.id)}
                      style={{ margin: 0 }}
                    />
                  </td>
                  <td>
                    <span className={`status-indicator ${alert.severity}`}>
                      {alert.severity === 'critical' ? 'CRIT' : 
                       alert.severity === 'warning' ? 'WARN' : 'INFO'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {getAlertIcon(alert.type)}
                      <span style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                        {alert.type.replace('_', '')}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div>
                      <div style={{ fontWeight: '600', marginBottom: '2px' }}>{alert.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {alert.description}
                      </div>
                    </div>
                  </td>
                  <td className="data-value">{alert.loanCount}</td>
                  <td className="data-value">
                    {alert.ageInDays}d
                  </td>
                  <td className="data-timestamp">
                    {format(alert.createdAt, 'MM/dd HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right Column - Tasks and Market Data */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Market Data Widget */}
          <div className="market-data-widget">
            <div className="market-ticker">
              <div className="symbol">10Y TREAS</div>
              <div className="value">4.23%</div>
              <div className="change positive">+0.02</div>
            </div>
            <div className="market-ticker">
              <div className="symbol">NPL IDX</div>
              <div className="value">89.4</div>
              <div className="change negative">-1.2</div>
            </div>
            <div className="market-ticker">
              <div className="symbol">VIX</div>
              <div className="value">16.8</div>
              <div className="change positive">+0.5</div>
            </div>
          </div>

          {/* Tasks Section */}
          <div className="financial-card">
            <div style={{ 
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '8px',
              marginBottom: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
                TASKS ({tasks.length})
              </h3>
              <span className="data-timestamp">Updated: {format(new Date(), 'HH:mm')}</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {tasks.map((task) => (
                <div key={task.id} style={{ 
                  padding: '6px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-surface-light)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600' }}>{task.title}</span>
                    <span className={`status-indicator ${task.priority === 'high' ? 'critical' : task.priority === 'medium' ? 'warning' : 'success'}`}>
                      {task.priority.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    {task.description}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar style={{ width: '10px', height: '10px' }} />
                      <span className="data-timestamp">Due: {format(task.dueDate, 'MM/dd')}</span>
                    </div>
                    {task.status === 'in_progress' && (
                      <span className="status-indicator warning">ACTIVE</span>
                    )}
                  </div>
                </div>
              ))}
              <button className="btn-compact btn-secondary" style={{ width: '100%', marginTop: '4px' }}>
                VIEW ALL TASKS
              </button>
            </div>
          </div>

          {/* News/Updates Section */}
          <div className="financial-card">
            <div style={{ 
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '8px',
              marginBottom: '8px'
            }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
                MARKET UPDATES
              </h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ 
                borderLeft: '3px solid var(--color-info)',
                paddingLeft: '8px',
                paddingTop: '4px',
                paddingBottom: '4px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '2px' }}>
                  SYSTEM UPDATE
                </div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
                  Document analysis batch uploads now available
                </div>
                <span className="data-timestamp">14:30</span>
              </div>
              
              <div style={{ 
                borderLeft: '3px solid var(--color-success)',
                paddingLeft: '8px',
                paddingTop: '4px',
                paddingBottom: '4px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '2px' }}>
                  MARKET DATA
                </div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
                  NPL market activity +15% Q1 2024
                </div>
                <span className="data-timestamp">09:15</span>
              </div>
              
              <div style={{ 
                borderLeft: '3px solid var(--color-warning)',
                paddingLeft: '8px',
                paddingTop: '4px',
                paddingBottom: '4px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '2px' }}>
                  REGULATORY
                </div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
                  SOL guidelines updated - effective Mar 1
                </div>
                <span className="data-timestamp">Yesterday</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TodayPage;