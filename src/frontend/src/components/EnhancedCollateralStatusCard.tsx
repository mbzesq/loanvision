// src/frontend/src/components/EnhancedCollateralStatusCard.tsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useToast } from '../hooks/use-toast';
import EnhancedDocumentStatus from './EnhancedDocumentStatus';
import { Loader2 } from 'lucide-react';

interface DocumentPresence {
  hasNote: boolean;
  hasSecurityInstrument: boolean;
  noteCount: number;
  securityInstrumentCount: number;
  assignmentCount: number;
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

interface ChainAnalysisData {
  documentPresence: DocumentPresence;
  endorsementChain: {
    hasEndorsements: boolean;
    endorsementCount: number;
    endorsementChain: EndorsementChain[];
    endsWithCurrentInvestor: boolean;
    endsInBlank: boolean;
    sourceDocument?: {
      fileName: string;
      confidence: number;
    };
  };
  assignmentChain: {
    hasAssignmentChain: boolean;
    assignmentCount: number;
    assignmentChain: AssignmentChain[];
    assignmentEndsWithCurrentInvestor: boolean;
    sourceDocument?: {
      fileName: string;
      confidence: number;
    };
  };
  legacy: {
    assignmentChainComplete: boolean;
    chainGaps: string[];
  };
}

interface EnhancedCollateralStatusCardProps {
  loanId: string;
  refreshTrigger?: number;
  className?: string;
}

const EnhancedCollateralStatusCard: React.FC<EnhancedCollateralStatusCardProps> = ({ 
  loanId, 
  refreshTrigger, 
  className = "" 
}) => {
  const [chainData, setChainData] = useState<ChainAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchChainAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      console.log(`🔗 Fetching chain analysis for loan: ${loanId}`);
      
      const response = await axios.get(`${apiUrl}/api/v2/loans/${loanId}/chain-analysis`);
      
      if (response.data.success) {
        setChainData(response.data);
        console.log('Chain analysis data received:', response.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching chain analysis:', error);
      
      // Handle 404 or missing data gracefully
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Set default empty state for missing data
        setChainData({
          documentPresence: {
            hasNote: false,
            hasSecurityInstrument: false,
            noteCount: 0,
            securityInstrumentCount: 0,
            assignmentCount: 0
          },
          endorsementChain: {
            hasEndorsements: false,
            endorsementCount: 0,
            endorsementChain: [],
            endsWithCurrentInvestor: false,
            endsInBlank: false
          },
          assignmentChain: {
            hasAssignmentChain: false,
            assignmentCount: 0,
            assignmentChain: [],
            assignmentEndsWithCurrentInvestor: false
          },
          legacy: {
            assignmentChainComplete: false,
            chainGaps: []
          }
        });
      } else {
        setError('Failed to load chain analysis');
        
        // Only show error toast for unexpected errors
        if (!axios.isAxiosError(error) || error.response?.status !== 404) {
          toast({
            title: "Error",
            description: "Failed to load chain analysis data",
            variant: "destructive",
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loanId) {
      fetchChainAnalysis();
    }
  }, [loanId, refreshTrigger]);

  // Loading state
  if (loading || !chainData) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading chain analysis...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-red-600">Error Loading Chain Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchChainAnalysis}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  // Transform data for EnhancedDocumentStatus component
  const documentPresence = chainData.documentPresence;
  const chainStatus = {
    hasEndorsements: chainData.endorsementChain.hasEndorsements,
    endorsementCount: chainData.endorsementChain.endorsementCount,
    endorsementChain: chainData.endorsementChain.endorsementChain,
    endsWithCurrentInvestor: chainData.endorsementChain.endsWithCurrentInvestor,
    endsInBlank: chainData.endorsementChain.endsInBlank,
    
    hasAssignmentChain: chainData.assignmentChain.hasAssignmentChain,
    assignmentCount: chainData.assignmentChain.assignmentCount,
    assignmentChain: chainData.assignmentChain.assignmentChain,
    assignmentEndsWithCurrentInvestor: chainData.assignmentChain.assignmentEndsWithCurrentInvestor
  };

  return (
    <div className={className}>
      <EnhancedDocumentStatus
        documentPresence={documentPresence}
        chainStatus={chainStatus}
      />
      
      {/* Optional: Display source document information */}
      {(chainData.endorsementChain.sourceDocument || chainData.assignmentChain.sourceDocument) && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">Source Documents</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xs text-gray-600 space-y-1">
              {chainData.endorsementChain.sourceDocument && (
                <div>
                  <strong>Endorsement Chain:</strong> {chainData.endorsementChain.sourceDocument.fileName} 
                  <span className="ml-2 text-green-600">
                    ({(chainData.endorsementChain.sourceDocument.confidence * 100).toFixed(0)}% confidence)
                  </span>
                </div>
              )}
              {chainData.assignmentChain.sourceDocument && (
                <div>
                  <strong>Assignment Chain:</strong> {chainData.assignmentChain.sourceDocument.fileName}
                  <span className="ml-2 text-green-600">
                    ({(chainData.assignmentChain.sourceDocument.confidence * 100).toFixed(0)}% confidence)
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EnhancedCollateralStatusCard;