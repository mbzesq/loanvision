import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { AlertCircle, CheckCircle2, Clock, TrendingUp, Scale, FileAlert, DollarSign, Calendar, ChevronRight, Filter, Bell } from 'lucide-react';
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
      case 'legal': return <FileAlert className="h-4 w-4" />;
      case 'document': return <FileAlert className="h-4 w-4" />;
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
    <div className="p-4 bg-slate-50 min-h-screen">
      {/* Page Header with Date */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-slate-900">Today</h1>
          <div className="text-lg text-slate-600">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </div>
        </div>
        <p className="text-lg text-slate-600">
          Your daily operations dashboard - alerts, tasks, and updates
        </p>
      </div>

      {/* Alert Summary Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Critical Alerts</p>
                <p className="text-2xl font-bold text-red-800">{alertCounts.critical}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Warnings</p>
                <p className="text-2xl font-bold text-yellow-800">{alertCounts.warning}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Information</p>
                <p className="text-2xl font-bold text-blue-800">{alertCounts.info}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Alerts</p>
                <p className="text-2xl font-bold text-slate-800">{alertCounts.total}</p>
              </div>
              <Bell className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Alerts (8 cols) */}
        <div className="col-span-12 lg:col-span-8">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Portfolio Alerts</CardTitle>
                <div className="flex items-center gap-2">
                  {/* Filter Buttons */}
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                    <Button
                      variant={filterSeverity === 'all' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setFilterSeverity('all')}
                      className="h-7 px-3"
                    >
                      All
                    </Button>
                    <Button
                      variant={filterSeverity === 'critical' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setFilterSeverity('critical')}
                      className="h-7 px-3"
                    >
                      Critical
                    </Button>
                    <Button
                      variant={filterSeverity === 'warning' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setFilterSeverity('warning')}
                      className="h-7 px-3"
                    >
                      Warning
                    </Button>
                  </div>
                  {/* Bulk Actions */}
                  {selectedAlerts.size > 0 && (
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-sm text-slate-600">
                        {selectedAlerts.size} selected
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkAction('acknowledge')}
                      >
                        Acknowledge
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkAction('createTask')}
                      >
                        Create Task
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-4 transition-all cursor-pointer hover:shadow-md ${
                      selectedAlerts.has(alert.id) ? 'ring-2 ring-blue-500' : ''
                    } ${getSeverityColor(alert.severity)}`}
                    onClick={() => handleAlertSelect(alert.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {getAlertIcon(alert.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{alert.title}</h4>
                            {alert.status === 'new' && (
                              <Badge className="bg-green-100 text-green-800 text-xs">New</Badge>
                            )}
                            {alert.ageInDays > 3 && (
                              <Badge variant="outline" className="text-xs">
                                {alert.ageInDays} days old
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm opacity-90">{alert.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs opacity-75">
                            <span>{alert.loanCount} loans affected</span>
                            <span>Created {format(alert.createdAt, 'MMM d, h:mm a')}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-50" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Tasks and News (4 cols) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Tasks Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Today's Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm">{task.title}</h4>
                      <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 mb-2">{task.description}</p>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>Due {format(task.dueDate, 'MMM d')}</span>
                      </div>
                      {task.status === 'in_progress' && (
                        <Badge variant="outline" className="text-xs">In Progress</Badge>
                      )}
                    </div>
                  </div>
                ))}
                <Button className="w-full" variant="outline" size="sm">
                  View All Tasks
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* News/Updates Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Updates & News</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="border-l-4 border-blue-500 pl-3 py-2">
                  <h4 className="font-medium text-sm">System Update</h4>
                  <p className="text-xs text-slate-600">
                    Document analysis feature now supports batch uploads
                  </p>
                  <span className="text-xs text-slate-500">2 hours ago</span>
                </div>
                <div className="border-l-4 border-green-500 pl-3 py-2">
                  <h4 className="font-medium text-sm">Market Update</h4>
                  <p className="text-xs text-slate-600">
                    NPL market showing increased activity in Q1 2024
                  </p>
                  <span className="text-xs text-slate-500">5 hours ago</span>
                </div>
                <div className="border-l-4 border-yellow-500 pl-3 py-2">
                  <h4 className="font-medium text-sm">Regulatory Notice</h4>
                  <p className="text-xs text-slate-600">
                    New SOL guidelines effective March 1st
                  </p>
                  <span className="text-xs text-slate-500">1 day ago</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default TodayPage;