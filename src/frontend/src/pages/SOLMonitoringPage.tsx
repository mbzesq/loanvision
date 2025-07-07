import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Clock, TrendingUp, TrendingDown, Calendar, AlertTriangle, Scale, RefreshCw } from 'lucide-react';
import { solService, SOLSummary } from '../services/solService';
import SOLAlertsPanel from '../components/SOL/SOLAlertsPanel';
import SOLMonitorCard from '../components/Dashboard/SOLMonitorCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface SOLTrendData {
  month: string;
  expired: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  totalLoans: number;
}

interface SOLJurisdictionData {
  state: string;
  totalLoans: number;
  expiredCount: number;
  highRiskCount: number;
  avgDaysToExpiration: number;
}

const SOLMonitoringPage: React.FC = () => {
  const [solSummary, setSOLSummary] = useState<SOLSummary | null>(null);
  const [trendData, setTrendData] = useState<SOLTrendData[]>([]);
  const [jurisdictionData, setJurisdictionData] = useState<SOLJurisdictionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    loadSOLData();
  }, []);

  const loadSOLData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load current summary
      const summary = await solService.getSOLSummary();
      setSOLSummary(summary);
      
      // Generate mock trend data for demonstration
      const mockTrendData: SOLTrendData[] = [
        { month: 'Jan 2025', expired: 12, highRisk: 28, mediumRisk: 45, lowRisk: 165, totalLoans: 250 },
        { month: 'Feb 2025', expired: 15, highRisk: 32, mediumRisk: 48, lowRisk: 158, totalLoans: 253 },
        { month: 'Mar 2025', expired: 18, highRisk: 35, mediumRisk: 52, lowRisk: 150, totalLoans: 255 },
        { month: 'Apr 2025', expired: 22, highRisk: 38, mediumRisk: 55, lowRisk: 145, totalLoans: 260 },
        { month: 'May 2025', expired: 25, highRisk: 42, mediumRisk: 58, lowRisk: 140, totalLoans: 265 },
        { month: 'Jun 2025', expired: 28, highRisk: 45, mediumRisk: 62, lowRisk: 135, totalLoans: 270 },
      ];
      setTrendData(mockTrendData);
      
      // Generate mock jurisdiction data
      const mockJurisdictionData: SOLJurisdictionData[] = [
        { state: 'FL', totalLoans: 85, expiredCount: 8, highRiskCount: 15, avgDaysToExpiration: 450 },
        { state: 'TX', totalLoans: 72, expiredCount: 6, highRiskCount: 12, avgDaysToExpiration: 520 },
        { state: 'CA', totalLoans: 65, expiredCount: 4, highRiskCount: 8, avgDaysToExpiration: 680 },
        { state: 'NY', totalLoans: 48, expiredCount: 3, highRiskCount: 6, avgDaysToExpiration: 720 },
        { state: 'OH', totalLoans: 35, expiredCount: 2, highRiskCount: 4, avgDaysToExpiration: 580 },
      ];
      setJurisdictionData(mockJurisdictionData);
      
      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to load SOL monitoring data');
      console.error('Error loading SOL data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadSOLData();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-6">
              <div className="h-48 bg-slate-200 rounded"></div>
              <div className="h-48 bg-slate-200 rounded"></div>
            </div>
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-slate-200 rounded"></div>
              <div className="h-32 bg-slate-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">SOL Monitoring Dashboard</h1>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const riskTrend = trendData.length >= 2 ? 
    (trendData[trendData.length - 1].expired + trendData[trendData.length - 1].highRisk) - 
    (trendData[trendData.length - 2].expired + trendData[trendData.length - 2].highRisk) : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Scale className="h-6 w-6 text-blue-600" />
            SOL Monitoring Dashboard
          </h1>
          <p className="text-slate-600 mt-1">
            Comprehensive monitoring of Statute of Limitations across your portfolio
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Expired SOL</p>
                <p className="text-2xl font-bold text-red-700">
                  {solSummary?.expired_count || 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-medium">High Risk</p>
                <p className="text-2xl font-bold text-yellow-700">
                  {solSummary?.high_risk_count || 0}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Monitored</p>
                <p className="text-2xl font-bold text-blue-700">
                  {solSummary?.total_loans || 0}
                </p>
              </div>
              <Scale className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={riskTrend > 0 ? 'border-red-200' : 'border-green-200'}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Risk Trend</p>
                <p className={`text-2xl font-bold ${riskTrend > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {riskTrend > 0 ? '+' : ''}{riskTrend}
                </p>
              </div>
              {riskTrend > 0 ? (
                <TrendingUp className="h-8 w-8 text-red-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-green-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Alerts and Overview */}
        <div className="space-y-6">
          <SOLAlertsPanel className="h-full" maxAlerts={6} />
          <SOLMonitorCard />
        </div>

        {/* Right Column - Charts and Analytics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                SOL Risk Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px'
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="expired" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      name="Expired"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="highRisk" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      name="High Risk"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="mediumRisk" 
                      stroke="#eab308" 
                      strokeWidth={2}
                      name="Medium Risk"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Jurisdiction Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                SOL Risk by Jurisdiction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={jurisdictionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="state" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="expiredCount" fill="#ef4444" name="Expired" />
                    <Bar dataKey="highRiskCount" fill="#f59e0b" name="High Risk" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Jurisdiction Details Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Jurisdiction Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-2 font-medium">State</th>
                      <th className="text-right p-2 font-medium">Total Loans</th>
                      <th className="text-right p-2 font-medium">Expired</th>
                      <th className="text-right p-2 font-medium">High Risk</th>
                      <th className="text-right p-2 font-medium">Avg Days to Expiration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jurisdictionData.map((jurisdiction) => (
                      <tr key={jurisdiction.state} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-medium">{jurisdiction.state}</td>
                        <td className="p-2 text-right">{jurisdiction.totalLoans}</td>
                        <td className="p-2 text-right">
                          <Badge variant={jurisdiction.expiredCount > 0 ? "destructive" : "secondary"}>
                            {jurisdiction.expiredCount}
                          </Badge>
                        </td>
                        <td className="p-2 text-right">
                          <Badge variant={jurisdiction.highRiskCount > 5 ? "destructive" : "secondary"}>
                            {jurisdiction.highRiskCount}
                          </Badge>
                        </td>
                        <td className="p-2 text-right text-gray-600">
                          {jurisdiction.avgDaysToExpiration} days
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SOLMonitoringPage;