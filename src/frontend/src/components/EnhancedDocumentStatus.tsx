// src/frontend/src/components/EnhancedDocumentStatus.tsx
import { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  ArrowRight,
  Link as LinkIcon,
  Scroll,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface DocumentPresence {
  hasNote: boolean;
  hasSecurityInstrument: boolean;
  noteCount: number;
  securityInstrumentCount: number;
}

interface EndorsementChain {
  sequenceNumber: number;
  endorser?: string;
  endorsee?: string;
  endorsementType: 'specific' | 'blank';
  endorsementText: string;
}

interface AssignmentChain {
  sequenceNumber: number;
  assignor?: string;
  assignee?: string;
  assignmentText: string;
  recordingInfo?: string;
}

interface ChainStatus {
  hasEndorsements: boolean;
  endorsementCount: number;
  endorsementChain: EndorsementChain[];
  endsWithCurrentInvestor: boolean;
  endsInBlank: boolean;
  
  hasAssignmentChain: boolean;
  assignmentCount: number;
  assignmentChain: AssignmentChain[];
  assignmentEndsWithCurrentInvestor: boolean;
}

interface EnhancedDocumentStatusProps {
  documentPresence: DocumentPresence;
  chainStatus: ChainStatus;
  className?: string;
}

const EnhancedDocumentStatus: React.FC<EnhancedDocumentStatusProps> = ({ 
  documentPresence, 
  chainStatus,
  className = ""
}) => {
  const [showEndorsementDetails, setShowEndorsementDetails] = useState(false);
  const [showAssignmentDetails, setShowAssignmentDetails] = useState(false);

  // Determine overall status for each document type
  const getDocumentStatus = (hasDocument: boolean, count: number) => {
    if (!hasDocument || count === 0) {
      return { 
        status: 'missing', 
        icon: XCircle, 
        color: 'text-red-600', 
        bgColor: 'bg-red-50 border-red-200',
        text: 'Missing'
      };
    }
    return { 
      status: 'present', 
      icon: CheckCircle, 
      color: 'text-green-600', 
      bgColor: 'bg-green-50 border-green-200',
      text: 'Present'
    };
  };

  const getChainHealthStatus = (hasChain: boolean, endsCorrectly: boolean, chainType: string) => {
    if (!hasChain) {
      return {
        status: 'no-chain',
        icon: AlertTriangle,
        color: 'text-gray-500',
        bgColor: 'bg-gray-50 border-gray-200',
        text: `No ${chainType} found`,
        severity: 'info'
      };
    }
    
    if (endsCorrectly) {
      return {
        status: 'complete',
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-50 border-green-200',
        text: 'Complete & Valid',
        severity: 'success'
      };
    }
    
    return {
      status: 'incomplete',
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 border-yellow-200',
      text: 'Incomplete',
      severity: 'warning'
    };
  };

  const noteStatus = getDocumentStatus(documentPresence.hasNote, documentPresence.noteCount);
  const securityStatus = getDocumentStatus(documentPresence.hasSecurityInstrument, documentPresence.securityInstrumentCount);
  
  const endorsementHealth = getChainHealthStatus(
    chainStatus.hasEndorsements, 
    chainStatus.endsWithCurrentInvestor || chainStatus.endsInBlank,
    'endorsement chain'
  );
  
  const assignmentHealth = getChainHealthStatus(
    chainStatus.hasAssignmentChain,
    chainStatus.assignmentEndsWithCurrentInvestor,
    'assignment chain'
  );

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5" />
          Document & Chain Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Critical Document Presence - Top Priority */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Required Documents
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            
            {/* Note Status */}
            <div className={`border rounded-lg p-3 ${noteStatus.bgColor}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <noteStatus.icon className={`h-5 w-5 ${noteStatus.color}`} />
                  <span className="font-medium">Note</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={noteStatus.status === 'present' ? 'default' : 'destructive'}>
                    {noteStatus.text}
                  </Badge>
                  {documentPresence.noteCount > 0 && (
                    <span className="text-xs text-gray-600">({documentPresence.noteCount})</span>
                  )}
                </div>
              </div>
            </div>

            {/* Security Instrument Status */}
            <div className={`border rounded-lg p-3 ${securityStatus.bgColor}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <securityStatus.icon className={`h-5 w-5 ${securityStatus.color}`} />
                  <span className="font-medium">Security Instrument</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={securityStatus.status === 'present' ? 'default' : 'destructive'}>
                    {securityStatus.text}
                  </Badge>
                  {documentPresence.securityInstrumentCount > 0 && (
                    <span className="text-xs text-gray-600">({documentPresence.securityInstrumentCount})</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chain Analysis - Business Critical */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            Ownership Chain Analysis
          </h3>
          
          {/* Endorsement Chain */}
          <div className={`border rounded-lg p-4 mb-3 ${endorsementHealth.bgColor}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <endorsementHealth.icon className={`h-5 w-5 ${endorsementHealth.color}`} />
                <span className="font-medium">Endorsement Chain</span>
                {chainStatus.hasEndorsements && (
                  <Badge variant="outline" className="text-xs">
                    {chainStatus.endorsementCount} step{chainStatus.endorsementCount !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={endorsementHealth.severity === 'success' ? 'default' : 
                           endorsementHealth.severity === 'warning' ? 'secondary' : 'outline'}
                >
                  {endorsementHealth.text}
                </Badge>
                {chainStatus.hasEndorsements && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEndorsementDetails(!showEndorsementDetails)}
                    className="h-6 px-2"
                  >
                    {showEndorsementDetails ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </div>
            
            {/* Endorsement Summary */}
            <div className="text-sm text-gray-600 mb-2">
              {!chainStatus.hasEndorsements ? (
                "No endorsement chain detected in uploaded documents"
              ) : chainStatus.endsInBlank ? (
                "✓ Chain ends with blank endorsement (transferable)"
              ) : chainStatus.endsWithCurrentInvestor ? (
                "✓ Chain ends with current investor"
              ) : (
                "⚠ Chain does not end with current investor or blank"
              )}
            </div>

            {/* Endorsement Chain Details */}
            {showEndorsementDetails && chainStatus.endorsementChain.length > 0 && (
              <div className="mt-3 p-3 bg-white rounded border space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Chain Steps:</h4>
                {chainStatus.endorsementChain.map((endorsement, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm py-1">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {endorsement.sequenceNumber}
                    </span>
                    <div className="flex-1 flex items-center gap-1">
                      <span>{endorsement.endorser || 'Original Holder'}</span>
                      <ArrowRight className="h-3 w-3 text-gray-400" />
                      {endorsement.endorsementType === 'blank' ? (
                        <span className="font-medium text-green-600">BLANK</span>
                      ) : (
                        <span>{endorsement.endorsee || 'Unknown'}</span>
                      )}
                    </div>
                    <Badge variant={endorsement.endorsementType === 'blank' ? 'default' : 'secondary'}>
                      {endorsement.endorsementType}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assignment Chain */}
          <div className={`border rounded-lg p-4 ${assignmentHealth.bgColor}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <assignmentHealth.icon className={`h-5 w-5 ${assignmentHealth.color}`} />
                <span className="font-medium">Assignment Chain</span>
                {chainStatus.hasAssignmentChain && (
                  <Badge variant="outline" className="text-xs">
                    {chainStatus.assignmentCount} assignment{chainStatus.assignmentCount !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={assignmentHealth.severity === 'success' ? 'default' : 
                           assignmentHealth.severity === 'warning' ? 'secondary' : 'outline'}
                >
                  {assignmentHealth.text}
                </Badge>
                {chainStatus.hasAssignmentChain && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAssignmentDetails(!showAssignmentDetails)}
                    className="h-6 px-2"
                  >
                    {showAssignmentDetails ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </div>
            
            {/* Assignment Summary */}
            <div className="text-sm text-gray-600 mb-2">
              {!chainStatus.hasAssignmentChain ? (
                "No assignment chain detected in uploaded documents"
              ) : chainStatus.assignmentEndsWithCurrentInvestor ? (
                "✓ Assignment chain ends with current investor"
              ) : (
                "⚠ Assignment chain does not end with current investor"
              )}
            </div>

            {/* Assignment Chain Details */}
            {showAssignmentDetails && chainStatus.assignmentChain.length > 0 && (
              <div className="mt-3 p-3 bg-white rounded border space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Assignment Steps:</h4>
                {chainStatus.assignmentChain.map((assignment, index) => (
                  <div key={index} className="border-l-2 border-blue-200 pl-3 py-1">
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {assignment.sequenceNumber}
                      </span>
                      <div className="flex-1 flex items-center gap-1">
                        <span className="font-medium">{assignment.assignor || 'Unknown Assignor'}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <span className="font-medium">{assignment.assignee || 'Unknown Assignee'}</span>
                      </div>
                    </div>
                    {assignment.recordingInfo && (
                      <div className="text-xs text-gray-500 ml-8 flex items-center gap-1">
                        <Scroll className="h-3 w-3" />
                        {assignment.recordingInfo}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedDocumentStatus;