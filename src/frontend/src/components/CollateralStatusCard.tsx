// src/frontend/src/components/CollateralStatusCard.tsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, XCircle, AlertTriangle, Link as LinkIcon, FileText, Clock, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { useToast } from '../hooks/use-toast';

interface DocumentRequirement {
  type: string;
  required: boolean;
  present: boolean;
  validated: boolean;
  count: number;
  validationDetails?: string;
}

interface ValidationError {
  field: string;
  issue: string;
  severity: 'error' | 'warning';
  documentId?: number;
}

interface ChainLink {
  sequenceNumber: number;
  transferor: string;
  transferee: string;
  transferDate?: string;
  recordingDate?: string;
  documentType: string;
  instrumentNumber?: string;
  isGap: boolean;
  gapReason?: string;
}

interface CollateralStatus {
  loanId: string;
  completenessScore: number;
  isComplete: boolean;
  requiredDocuments: DocumentRequirement[];
  missingDocuments: string[];
  assignmentChainComplete: boolean;
  chainGaps: string[];
  validationErrors: ValidationError[];
  lastUpdated: string;
}

interface CollateralStatusCardProps {
  loanId: string;
  refreshTrigger?: number; // Used to trigger refresh from parent
}

const getStatusIcon = (isComplete: boolean, hasErrors: boolean) => {
  if (hasErrors) return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
  if (isComplete) return <CheckCircle className="h-5 w-5 text-green-600" />;
  return <XCircle className="h-5 w-5 text-red-600" />;
};

const getStatusColor = (isComplete: boolean, hasErrors: boolean) => {
  if (hasErrors) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (isComplete) return 'bg-green-100 text-green-800 border-green-200';
  return 'bg-red-100 text-red-800 border-red-200';
};

const getDocumentStatusIcon = (requirement: DocumentRequirement) => {
  if (!requirement.present) return <XCircle className="h-4 w-4 text-red-600" />;
  if (!requirement.validated) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
  return <CheckCircle className="h-4 w-4 text-green-600" />;
};

const CollateralStatusCard: React.FC<CollateralStatusCardProps> = ({ loanId, refreshTrigger }) => {
  const [status, setStatus] = useState<CollateralStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  const fetchCollateralStatus = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await axios.get(`${apiUrl}/api/v2/loans/${loanId}/collateral-status`);
      
      if (response.data.success) {
        setStatus(response.data.status);
      }
    } catch (error) {
      console.error('Error fetching collateral status:', error);
      if (axios.isAxiosError(error) && error.response?.status !== 404) {
        toast({
          title: "Error",
          description: "Failed to load collateral status.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollateralStatus();
  }, [loanId, refreshTrigger]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Collateral Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Collateral Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-gray-500">
            <Shield className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p>No collateral data available</p>
            <p className="text-sm text-gray-400 mt-1">
              Upload documents to see collateral analysis
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasErrors = status.validationErrors.length > 0;
  const criticalErrors = status.validationErrors.filter(e => e.severity === 'error');
  const warnings = status.validationErrors.filter(e => e.severity === 'warning');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Collateral Status
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Status */}
        <div className={`p-4 rounded-lg border ${getStatusColor(status.isComplete, hasErrors)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(status.isComplete, hasErrors)}
              <div>
                <div className="font-semibold">
                  {status.isComplete ? 'Complete' : hasErrors ? 'Issues Detected' : 'Incomplete'}
                </div>
                <div className="text-sm opacity-75">
                  Completeness: {status.completenessScore}%
                </div>
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="font-medium">{status.completenessScore}%</div>
              <div className="text-xs opacity-75">
                Last updated: {new Date(status.lastUpdated).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {status.requiredDocuments.filter(d => d.present).length}/
              {status.requiredDocuments.filter(d => d.required).length}
            </div>
            <div className="text-sm text-gray-600">Required Documents</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              {status.assignmentChainComplete ? (
                <LinkIcon className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <div className="text-lg font-semibold text-gray-900">
                {status.assignmentChainComplete ? 'Complete' : 'Gaps'}
              </div>
            </div>
            <div className="text-sm text-gray-600">Assignment Chain</div>
          </div>
        </div>

        {/* Validation Issues Summary */}
        {hasErrors && (
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span>
              {criticalErrors.length > 0 && `${criticalErrors.length} error${criticalErrors.length > 1 ? 's' : ''}`}
              {criticalErrors.length > 0 && warnings.length > 0 && ', '}
              {warnings.length > 0 && `${warnings.length} warning${warnings.length > 1 ? 's' : ''}`}
            </span>
          </div>
        )}

        {/* Missing Documents */}
        {status.missingDocuments.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-sm text-gray-600">Missing:</span>
            {status.missingDocuments.map((doc, index) => (
              <Badge key={index} variant="outline" className="text-red-600 border-red-200">
                {doc}
              </Badge>
            ))}
          </div>
        )}

        {/* Detailed View */}
        {showDetails && (
          <div className="space-y-4 border-t pt-4">
            {/* Document Requirements */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Document Requirements</h4>
              <div className="space-y-2">
                {status.requiredDocuments.map((req, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      {getDocumentStatusIcon(req)}
                      <span className="text-sm">
                        {req.type} {req.required && <span className="text-red-500">*</span>}
                      </span>
                      {req.count > 0 && (
                        <Badge variant="outline" className="ml-2">
                          {req.count}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {!req.present ? 'Missing' : !req.validated ? 'Needs Review' : 'Validated'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Assignment Chain Issues */}
            {status.chainGaps.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Assignment Chain Issues</h4>
                <div className="space-y-1">
                  {status.chainGaps.map((gap, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-yellow-50 rounded text-sm">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span className="text-yellow-800">{gap}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Validation Errors */}
            {status.validationErrors.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Validation Issues</h4>
                <div className="space-y-1">
                  {status.validationErrors.map((error, index) => (
                    <div key={index} className={`flex items-start gap-2 p-2 rounded text-sm ${
                      error.severity === 'error' 
                        ? 'bg-red-50 text-red-800' 
                        : 'bg-yellow-50 text-yellow-800'
                    }`}>
                      {error.severity === 'error' ? (
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <div className="font-medium">{error.field}</div>
                        <div className="text-xs opacity-75">{error.issue}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Refresh Button */}
        <div className="pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCollateralStatus}
            className="w-full"
          >
            <Clock className="h-4 w-4 mr-2" />
            Refresh Status
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CollateralStatusCard;