import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, AlertCircle, CheckCircle, DollarSign, Calendar, User, Home } from 'lucide-react';
import axios from '../utils/axios';
import { useToast } from '@/hooks/use-toast';

interface AnalyzedDocument {
  id: number;
  file_name: string;
  document_type: string;
  confidence_score: number;
  property_street?: string;
  property_city?: string;
  property_state?: string;
  property_zip?: string;
  borrower_name?: string;
  co_borrower_name?: string;
  loan_amount?: number;
  origination_date?: string;
  lender_name?: string;
  assignor?: string;
  assignee?: string;
  assignment_date?: string;
  recording_date?: string;
  instrument_number?: string;
  extraction_metadata?: any;
  processing_time_ms?: number;
  created_at: string;
}

interface DocumentAnalysisCardProps {
  loanId: string;
}

export const DocumentAnalysisCard: React.FC<DocumentAnalysisCardProps> = ({ loanId }) => {
  const [documents, setDocuments] = useState<AnalyzedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
  }, [loanId]);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`/api/v2/loans/${loanId}/analyzed-documents`);
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Failed to fetch analyzed documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analyzed documents',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('document', file);

    try {
      const response = await axios.post(
        `/api/v2/loans/${loanId}/analyze-document`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        toast({
          title: 'Success',
          description: `Document analyzed: ${response.data.document.documentType} (${(response.data.document.confidence * 100).toFixed(1)}% confidence)`,
        });
        fetchDocuments();
      }
    } catch (error) {
      console.error('Failed to upload document:', error);
      toast({
        title: 'Error',
        description: 'Failed to analyze document',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset the input
      event.target.value = '';
    }
  };

  const getConfidenceBadgeVariant = (confidence: number): 'default' | 'secondary' | 'destructive' => {
    if (confidence >= 0.8) return 'default';
    if (confidence >= 0.6) return 'secondary';
    return 'destructive';
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const renderDocumentFields = (doc: AnalyzedDocument) => {
    const hasPropertyInfo = doc.property_street || doc.property_city;
    const hasBorrowerInfo = doc.borrower_name || doc.co_borrower_name;
    const hasLoanInfo = doc.loan_amount || doc.origination_date || doc.lender_name;
    const hasAssignmentInfo = doc.assignor || doc.assignee || doc.assignment_date;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {hasPropertyInfo && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Home className="h-4 w-4" />
              Property Address
            </div>
            <div className="text-sm text-muted-foreground">
              {doc.property_street && <div>{doc.property_street}</div>}
              {(doc.property_city || doc.property_state || doc.property_zip) && (
                <div>
                  {doc.property_city}{doc.property_city && doc.property_state && ', '}
                  {doc.property_state} {doc.property_zip}
                </div>
              )}
            </div>
          </div>
        )}

        {hasBorrowerInfo && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4" />
              Borrower Information
            </div>
            <div className="text-sm text-muted-foreground">
              {doc.borrower_name && <div>Primary: {doc.borrower_name}</div>}
              {doc.co_borrower_name && <div>Co-Borrower: {doc.co_borrower_name}</div>}
            </div>
          </div>
        )}

        {hasLoanInfo && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              Loan Details
            </div>
            <div className="text-sm text-muted-foreground">
              {doc.loan_amount && <div>Amount: {formatCurrency(doc.loan_amount)}</div>}
              {doc.origination_date && <div>Date: {formatDate(doc.origination_date)}</div>}
              {doc.lender_name && <div>Lender: {doc.lender_name}</div>}
            </div>
          </div>
        )}

        {hasAssignmentInfo && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4" />
              Assignment Details
            </div>
            <div className="text-sm text-muted-foreground">
              {doc.assignor && <div>From: {doc.assignor}</div>}
              {doc.assignee && <div>To: {doc.assignee}</div>}
              {doc.assignment_date && <div>Date: {formatDate(doc.assignment_date)}</div>}
              {doc.recording_date && <div>Recorded: {formatDate(doc.recording_date)}</div>}
              {doc.instrument_number && <div>Instrument #: {doc.instrument_number}</div>}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Document Analysis (OCR)</CardTitle>
          <div className="relative">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="document-upload"
              disabled={isUploading}
            />
            <label htmlFor="document-upload">
              <Button
                variant="outline"
                size="sm"
                disabled={isUploading}
                asChild
              >
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? 'Analyzing...' : 'Upload PDF'}
                </span>
              </Button>
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No documents analyzed yet. Upload a PDF to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <div key={doc.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {doc.file_name}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{doc.document_type}</Badge>
                      <Badge variant={getConfidenceBadgeVariant(doc.confidence_score)}>
                        {(doc.confidence_score * 100).toFixed(1)}% confidence
                      </Badge>
                      {doc.processing_time_ms && (
                        <span className="text-xs text-muted-foreground">
                          {doc.processing_time_ms}ms
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(doc.created_at)}
                  </div>
                </div>
                
                {renderDocumentFields(doc)}

                {doc.extraction_metadata && doc.extraction_metadata.fieldConfidence && (
                  <details className="mt-4">
                    <summary className="text-sm text-muted-foreground cursor-pointer">
                      Field Confidence Scores
                    </summary>
                    <div className="mt-2 text-xs space-y-1">
                      {Object.entries(doc.extraction_metadata.fieldConfidence).map(([field, confidence]) => (
                        <div key={field} className="flex items-center justify-between">
                          <span>{field}:</span>
                          <span className={confidence as number < 0.7 ? 'text-destructive' : ''}>
                            {((confidence as number) * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};