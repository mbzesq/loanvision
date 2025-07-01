import React, { useState, useEffect } from 'react';
import { FileText, Upload, DollarSign, User, Home } from 'lucide-react';
import axios from '../utils/axios';

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
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      setMessage({ type: 'error', text: 'Failed to load analyzed documents' });
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
        setMessage({ 
          type: 'success', 
          text: `Document analyzed: ${response.data.document.documentType} (${(response.data.document.confidence * 100).toFixed(1)}% confidence)` 
        });
        fetchDocuments();
      }
    } catch (error) {
      console.error('Failed to upload document:', error);
      setMessage({ type: 'error', text: 'Failed to analyze document' });
    } finally {
      setIsUploading(false);
      // Reset the input
      event.target.value = '';
    }
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
            <div className="text-sm text-gray-600">
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
            <div className="text-sm text-gray-600">
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
            <div className="text-sm text-gray-600">
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
            <div className="text-sm text-gray-600">
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
    <div className="border rounded-lg shadow-sm bg-white">
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Document Analysis (OCR)</h3>
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
              <button
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isUploading}
                onClick={(e) => e.preventDefault()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? 'Analyzing...' : 'Upload PDF'}
              </button>
            </label>
          </div>
        </div>
      </div>
      <div className="p-4">
        {message && (
          <div className={`mb-4 p-3 rounded-md ${
            message.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
          }`}>
            {message.text}
          </div>
        )}
        
        {isLoading ? (
          <div className="text-center py-4">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
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
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                        {doc.document_type}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        doc.confidence_score >= 0.8 ? 'bg-green-100 text-green-800' : 
                        doc.confidence_score >= 0.6 ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-red-100 text-red-800'
                      }`}>
                        {(doc.confidence_score * 100).toFixed(1)}% confidence
                      </span>
                      {doc.processing_time_ms && (
                        <span className="text-xs text-gray-500">
                          {doc.processing_time_ms}ms
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(doc.created_at)}
                  </div>
                </div>
                
                {renderDocumentFields(doc)}

                {doc.extraction_metadata && doc.extraction_metadata.fieldConfidence && (
                  <details className="mt-4">
                    <summary className="text-sm text-gray-500 cursor-pointer">
                      Field Confidence Scores
                    </summary>
                    <div className="mt-2 text-xs space-y-1">
                      {Object.entries(doc.extraction_metadata.fieldConfidence).map(([field, confidence]) => (
                        <div key={field} className="flex items-center justify-between">
                          <span>{field}:</span>
                          <span className={confidence as number < 0.7 ? 'text-red-600' : 'text-green-600'}>
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
      </div>
    </div>
  );
};