// src/frontend/src/components/ChainAnalysisCard.tsx
import { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight,
  Link as LinkIcon,
  FileText,
  Building2,
  Scroll
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

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

interface ChainAnalysisData {
  // Document presence
  hasNote: boolean;
  hasSecurityInstrument: boolean;
  
  // Endorsement chain (Notes)
  hasEndorsements: boolean;
  endorsementCount: number;
  endorsementChain: EndorsementChain[];
  endsWithCurrentInvestor: boolean;
  endsInBlank: boolean;
  
  // Assignment chain
  hasAssignmentChain: boolean;
  assignmentCount: number;
  assignmentChain: AssignmentChain[];
  assignmentEndsWithCurrentInvestor: boolean;
  
  // Legacy fields for compatibility
  assignmentChainComplete?: boolean;
  chainGaps?: string[];
}

interface ChainAnalysisCardProps {
  chainData: ChainAnalysisData;
}

const ChainAnalysisCard: React.FC<ChainAnalysisCardProps> = ({ chainData }) => {
  const [showEndorsementDetails, setShowEndorsementDetails] = useState(false);
  const [showAssignmentDetails, setShowAssignmentDetails] = useState(false);

  const getChainStatus = (hasChain: boolean, endsWithCurrentInvestor: boolean, endsInBlank?: boolean) => {
    if (!hasChain) {
      return { status: 'missing', color: 'text-red-600', bgColor: 'bg-red-50', icon: XCircle };
    }
    if (endsWithCurrentInvestor || endsInBlank) {
      return { status: 'complete', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle };
    }
    return { status: 'incomplete', color: 'text-yellow-600', bgColor: 'bg-yellow-50', icon: AlertTriangle };
  };

  const endorsementStatus = getChainStatus(
    chainData.hasEndorsements, 
    chainData.endsWithCurrentInvestor, 
    chainData.endsInBlank
  );

  const assignmentStatus = getChainStatus(
    chainData.hasAssignmentChain, 
    chainData.assignmentEndsWithCurrentInvestor
  );

  const getEndorsementSummary = () => {
    if (!chainData.hasEndorsements) return 'No endorsements found';
    if (chainData.endsInBlank) return 'Ends in blank endorsement';
    if (chainData.endsWithCurrentInvestor) return 'Ends with current investor';
    return 'Ends with unknown party';
  };

  const getAssignmentSummary = () => {
    if (!chainData.hasAssignmentChain) return 'No assignment chain found';
    if (chainData.assignmentEndsWithCurrentInvestor) return 'Ends with current investor';
    return 'Does not end with current investor';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <LinkIcon className="h-5 w-5" />
          Chain Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Document Presence Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 ${chainData.hasNote ? 'text-green-600' : 'text-red-600'}`}>
              {chainData.hasNote ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <FileText className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">
              Note {chainData.hasNote ? 'Present' : 'Missing'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 ${chainData.hasSecurityInstrument ? 'text-green-600' : 'text-red-600'}`}>
              {chainData.hasSecurityInstrument ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <Building2 className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">
              Security Instrument {chainData.hasSecurityInstrument ? 'Present' : 'Missing'}
            </span>
          </div>
        </div>

        {/* Endorsement Chain Analysis */}
        <div className={`border rounded-lg p-4 ${endorsementStatus.bgColor}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <endorsementStatus.icon className={`h-5 w-5 ${endorsementStatus.color}`} />
              <h3 className="font-semibold">Endorsement Chain</h3>
              <Badge variant="outline" className="text-xs">
                {chainData.endorsementCount} endorsement{chainData.endorsementCount !== 1 ? 's' : ''}
              </Badge>
            </div>
            {chainData.hasEndorsements && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEndorsementDetails(!showEndorsementDetails)}
                className="h-6 px-2"
              >
                {showEndorsementDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          
          <div className="text-sm text-gray-600 mb-2">
            {getEndorsementSummary()}
          </div>

          {showEndorsementDetails && chainData.endorsementChain.length > 0 && (
            <div className="mt-3 space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Chain Details:</h4>
              {chainData.endorsementChain.map((endorsement, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold">
                    {endorsement.sequenceNumber}
                  </span>
                  <span className="flex-1">
                    {endorsement.endorser || 'Unknown'} 
                    <ArrowRight className="h-3 w-3 inline mx-1" />
                    {endorsement.endorsementType === 'blank' ? (
                      <span className="font-medium text-green-600">BLANK</span>
                    ) : (
                      endorsement.endorsee || 'Unknown'
                    )}
                  </span>
                  <Badge variant={endorsement.endorsementType === 'blank' ? 'default' : 'secondary'} className="text-xs">
                    {endorsement.endorsementType}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assignment Chain Analysis */}
        <div className={`border rounded-lg p-4 ${assignmentStatus.bgColor}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <assignmentStatus.icon className={`h-5 w-5 ${assignmentStatus.color}`} />
              <h3 className="font-semibold">Assignment Chain</h3>
              <Badge variant="outline" className="text-xs">
                {chainData.assignmentCount} assignment{chainData.assignmentCount !== 1 ? 's' : ''}
              </Badge>
            </div>
            {chainData.hasAssignmentChain && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAssignmentDetails(!showAssignmentDetails)}
                className="h-6 px-2"
              >
                {showAssignmentDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          
          <div className="text-sm text-gray-600 mb-2">
            {getAssignmentSummary()}
          </div>

          {showAssignmentDetails && chainData.assignmentChain.length > 0 && (
            <div className="mt-3 space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Chain Details:</h4>
              {chainData.assignmentChain.map((assignment, index) => (
                <div key={index} className="border-l-2 border-blue-200 pl-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold">
                      {assignment.sequenceNumber}
                    </span>
                    <span className="font-medium">{assignment.assignor || 'Unknown'}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span className="font-medium">{assignment.assignee || 'Unknown'}</span>
                  </div>
                  {assignment.recordingInfo && (
                    <div className="text-xs text-gray-500 ml-8">
                      <Scroll className="h-3 w-3 inline mr-1" />
                      {assignment.recordingInfo}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legacy Chain Gaps (for backward compatibility) */}
        {chainData.chainGaps && chainData.chainGaps.length > 0 && (
          <div className="border-l-4 border-yellow-400 bg-yellow-50 p-3">
            <h4 className="font-medium text-yellow-800 mb-1">Chain Issues:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              {chainData.chainGaps.map((gap, index) => (
                <li key={index} className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  {gap}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ChainAnalysisCard;