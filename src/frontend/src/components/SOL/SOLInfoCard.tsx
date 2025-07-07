import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Clock, Calendar, AlertTriangle, Info, MapPin, Scale, Shield } from 'lucide-react';
import { solService, SOLCalculation } from '../../services/solService';

interface SOLInfoCardProps {
  loanId: string;
  className?: string;
}

const SOLInfoCard: React.FC<SOLInfoCardProps> = ({ loanId, className = '' }) => {
  const [solData, setSOLData] = useState<SOLCalculation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loanId) {
      loadSOLData();
    }
  }, [loanId]);

  const loadSOLData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await solService.getLoanSOL(loanId);
      setSOLData(data);
      if (!data) {
        setError('No SOL data available for this loan');
      }
    } catch (err) {
      setError('Failed to load SOL data');
      console.error('Error loading SOL data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Statute of Limitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500">Loading SOL data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !solData) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Statute of Limitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">{error || 'No SOL data available'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isHighRisk = solData.sol_risk_level === 'HIGH' || solData.is_expired;
  const isMediumRisk = solData.sol_risk_level === 'MEDIUM';

  return (
    <Card className={`${className} ${isHighRisk ? 'border-red-200' : isMediumRisk ? 'border-yellow-200' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Scale className="h-5 w-5 text-blue-600" />
            Statute of Limitations
          </CardTitle>
          <Badge 
            variant="outline" 
            className={solService.getRiskLevelBadgeColor(solData.sol_risk_level)}
          >
            {solData.sol_risk_level} RISK
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Expiration Status */}
        <div className={`rounded-lg p-4 ${
          solData.is_expired ? 'bg-red-50 border border-red-200' :
          solData.days_until_expiration < 365 ? 'bg-yellow-50 border border-yellow-200' :
          'bg-green-50 border border-green-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className={`h-5 w-5 ${
                solData.is_expired ? 'text-red-600' :
                solData.days_until_expiration < 365 ? 'text-yellow-600' :
                'text-green-600'
              }`} />
              <span className="font-medium">
                {solService.formatDaysUntilExpiration(solData.days_until_expiration)}
              </span>
            </div>
            {solData.is_expired && (
              <Badge variant="destructive" className="text-xs">EXPIRED</Badge>
            )}
          </div>
          <div className="text-sm text-gray-600">
            <p>Expiration: {solService.formatDate(solData.adjusted_expiration_date)}</p>
          </div>
        </div>

        {/* Trigger Information */}
        <div className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Calendar className="h-4 w-4" />
            SOL Trigger Event
          </div>
          <div className="pl-6 space-y-1">
            <p className="text-sm">
              <span className="text-gray-500">Event:</span>{' '}
              <span className="font-medium">{solService.formatTriggerEvent(solData.sol_trigger_event)}</span>
            </p>
            <p className="text-sm">
              <span className="text-gray-500">Date:</span>{' '}
              <span className="font-medium">{solService.formatDate(solData.sol_trigger_date)}</span>
            </p>
          </div>
        </div>

        {/* Jurisdiction Information */}
        <div className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <MapPin className="h-4 w-4" />
            Jurisdiction Details
          </div>
          <div className="pl-6 space-y-1">
            <p className="text-sm">
              <span className="text-gray-500">State:</span>{' '}
              <span className="font-medium">{solData.property_state}</span>
              {solData.jurisdiction_name && (
                <span className="text-gray-400"> ({solData.jurisdiction_name})</span>
              )}
            </p>
            {solData.jurisdiction_risk_level && (
              <p className="text-sm">
                <span className="text-gray-500">Jurisdiction Risk:</span>{' '}
                <Badge 
                  variant="outline" 
                  className={`text-xs ml-1 ${solService.getRiskLevelBadgeColor(solData.jurisdiction_risk_level)}`}
                >
                  {solData.jurisdiction_risk_level}
                </Badge>
              </p>
            )}
          </div>
        </div>

        {/* Risk Factors */}
        {solData.risk_factors && (
          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Shield className="h-4 w-4" />
              Risk Assessment
            </div>
            <div className="pl-6 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Risk Score:</span>
                <Badge variant="outline" className="text-xs">
                  {solData.sol_risk_score}/100
                </Badge>
              </div>
              
              {solData.risk_factors.lien_extinguishment_risk && (
                <div className="flex items-center gap-1 text-sm text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Lien may be extinguished upon expiration</span>
                </div>
              )}
              
              {solData.risk_factors.in_active_foreclosure && (
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <Info className="h-3 w-3" />
                  <span>Active foreclosure reduces SOL risk</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tolling Events */}
        {solData.tolling_events && solData.tolling_events.length > 0 && (
          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Clock className="h-4 w-4" />
              Tolling Events
            </div>
            <div className="pl-6 space-y-1">
              {solData.tolling_events.map((event, index) => (
                <p key={index} className="text-sm">
                  <span className="text-gray-500">{event.type}:</span>{' '}
                  <span className="font-medium">{event.days_tolled} days</span>
                </p>
              ))}
              <p className="text-sm font-medium text-gray-700 pt-1">
                Total Tolled: {solData.total_tolled_days} days
              </p>
            </div>
          </div>
        )}

        {/* Last Updated */}
        <div className="text-xs text-gray-500 text-center pt-2 border-t">
          Last calculated: {solService.formatDate(solData.calculation_date)}
        </div>
      </CardContent>
    </Card>
  );
};

export default SOLInfoCard;