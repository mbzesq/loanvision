import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Clock, AlertTriangle, XCircle } from 'lucide-react';
import { solService, SOLSummary } from '../../services/solService';
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const SOLMonitorCard: React.FC = () => {
  const [solSummary, setSOLSummary] = useState<SOLSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSOLSummary();
  }, []);

  const loadSOLSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const summary = await solService.getSOLSummary();
      setSOLSummary(summary);
    } catch (err) {
      setError('Failed to load SOL data');
      console.error('Error loading SOL summary:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            SOL Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading SOL data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !solSummary) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            SOL Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-red-500">{error || 'No data available'}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for pie chart
  const pieData = [
    { name: 'Low Risk', value: solSummary.low_risk_count, color: '#10b981' },
    { name: 'Medium Risk', value: solSummary.medium_risk_count, color: '#f59e0b' },
    { name: 'High Risk', value: solSummary.high_risk_count, color: '#ef4444' },
    { name: 'Expired', value: solSummary.expired_count, color: '#6b7280' }
  ].filter(d => d.value > 0);

  const totalAtRisk = solSummary.high_risk_count + solSummary.medium_risk_count;
  const riskPercentage = solSummary.total_loans > 0 
    ? Math.round((totalAtRisk / solSummary.total_loans) * 100) 
    : 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            SOL Monitor
          </div>
          <Badge variant="outline" className="text-xs">
            {solSummary.total_loans} loans
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-2xl font-bold text-red-600">
                {solSummary.expired_count}
              </span>
            </div>
            <p className="text-xs text-red-600 mt-1">Expired</p>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-2xl font-bold text-yellow-600">
                {totalAtRisk}
              </span>
            </div>
            <p className="text-xs text-yellow-600 mt-1">At Risk</p>
          </div>
        </div>

        {/* Risk Distribution Chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => `${value} loans`}
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconSize={10}
                formatter={(value: string) => (
                  <span className="text-xs">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Indicator */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">Portfolio Risk</span>
            <Badge 
              variant="outline" 
              className={`text-xs ${
                riskPercentage > 10 ? 'border-red-300 text-red-700' : 
                riskPercentage > 5 ? 'border-yellow-300 text-yellow-700' : 
                'border-green-300 text-green-700'
              }`}
            >
              {riskPercentage}% at risk
            </Badge>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ${
                riskPercentage > 10 ? 'bg-red-500' : 
                riskPercentage > 5 ? 'bg-yellow-500' : 
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(riskPercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Alerts */}
        {solSummary.alerts && solSummary.alerts.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs font-medium text-gray-700 mb-2">Recent Alerts</p>
            <div className="space-y-1">
              {solSummary.alerts.slice(0, 3).map((alert, index) => (
                <div key={index} className="text-xs text-red-600 flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{alert}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SOLMonitorCard;