import { useState, useEffect } from 'react';
import { CheckCircle, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import '../styles/financial-design-system.css';

interface InboxKPIData {
  avgDaysToClear: number;
  tasksCleared: number;
  avgOverdueDays: number;
  totalActiveItems: number;
  overdueItems: number;
  urgentItems: number;
}

export function InboxKPIs() {
  const [kpiData, setKpiData] = useState<InboxKPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKPIData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
        const token = localStorage.getItem('authToken');
        
        const response = await fetch(`${apiUrl}/api/inbox/kpis`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setKpiData(data);
        } else {
          console.error('Failed to fetch KPI data:', response.status, response.statusText);
          // Use zeros instead of mock data to show real state
          setKpiData({
            avgDaysToClear: 0,
            tasksCleared: 0,
            avgOverdueDays: 0,
            totalActiveItems: 0,
            overdueItems: 0,
            urgentItems: 0
          });
        }
      } catch (error) {
        console.error('Error fetching inbox KPIs:', error);
        // Use zeros to show real state instead of fake data
        setKpiData({
          avgDaysToClear: 0,
          tasksCleared: 0,
          avgOverdueDays: 0,
          totalActiveItems: 0,
          overdueItems: 0,
          urgentItems: 0
        });
      } finally {
        setLoading(false);
      }
    };

    fetchKPIData();
  }, []);

  if (loading) {
    return (
      <div className="financial-card" style={{ height: '280px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%',
          color: 'var(--color-text-muted)',
          fontSize: '12px'
        }}>
          LOADING INBOX METRICS...
        </div>
      </div>
    );
  }

  if (!kpiData) {
    return (
      <div className="financial-card" style={{ height: '280px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%',
          color: 'var(--color-danger)',
          fontSize: '12px'
        }}>
          Error loading inbox metrics
        </div>
      </div>
    );
  }

  const kpiItems = [
    {
      label: 'AVG DAYS TO CLEAR',
      value: kpiData.avgDaysToClear.toFixed(1),
      icon: <CheckCircle style={{ width: '16px', height: '16px', color: 'var(--color-success)' }} />,
      trend: kpiData.avgDaysToClear < 5 ? 'good' : kpiData.avgDaysToClear < 10 ? 'warning' : 'danger'
    },
    {
      label: 'TASKS CLEARED (30D)',
      value: kpiData.tasksCleared.toString(),
      icon: <TrendingUp style={{ width: '16px', height: '16px', color: 'var(--color-primary)' }} />,
      trend: kpiData.tasksCleared > 30 ? 'good' : kpiData.tasksCleared > 15 ? 'warning' : 'danger'
    },
    {
      label: 'AVG OVERDUE DAYS',
      value: kpiData.avgOverdueDays.toFixed(1),
      icon: <Clock style={{ width: '16px', height: '16px', color: 'var(--color-warning)' }} />,
      trend: kpiData.avgOverdueDays < 2 ? 'good' : kpiData.avgOverdueDays < 5 ? 'warning' : 'danger'
    },
    {
      label: 'ACTIVE ITEMS',
      value: kpiData.totalActiveItems.toString(),
      icon: <AlertTriangle style={{ width: '16px', height: '16px', color: 'var(--color-info)' }} />,
      trend: 'neutral'
    },
    {
      label: 'OVERDUE ITEMS',
      value: kpiData.overdueItems.toString(),
      icon: <AlertTriangle style={{ width: '16px', height: '16px', color: 'var(--color-danger)' }} />,
      trend: kpiData.overdueItems === 0 ? 'good' : kpiData.overdueItems < 5 ? 'warning' : 'danger'
    },
    {
      label: 'URGENT ITEMS',
      value: kpiData.urgentItems.toString(),
      icon: <AlertTriangle style={{ width: '16px', height: '16px', color: 'var(--color-warning)' }} />,
      trend: kpiData.urgentItems === 0 ? 'good' : kpiData.urgentItems < 3 ? 'warning' : 'danger'
    }
  ];

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'good': return 'var(--color-success)';
      case 'warning': return 'var(--color-warning)';
      case 'danger': return 'var(--color-danger)';
      default: return 'var(--color-text)';
    }
  };

  return (
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
          INBOX PERFORMANCE METRICS
        </h3>
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px'
      }}>
        {kpiItems.map((item, index) => (
          <div key={index} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {item.icon}
              <span style={{ 
                fontSize: '10px', 
                fontWeight: '500',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase'
              }}>
                {item.label}
              </span>
            </div>
            <span style={{ 
              fontSize: '16px', 
              fontWeight: '600',
              color: getTrendColor(item.trend)
            }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
      
      <div style={{ 
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: '1px solid var(--color-border)',
        fontSize: '10px',
        color: 'var(--color-text-muted)',
        textAlign: 'center'
      }}>
        Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  );
}