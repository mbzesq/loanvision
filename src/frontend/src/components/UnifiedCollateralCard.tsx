// src/frontend/src/components/UnifiedCollateralCard.tsx
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Upload, CheckCircle, XCircle, AlertTriangle, Shield, Trash2, File, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import '../styles/financial-design-system.css';

interface CollateralDocument {
  id: number;
  loan_id: string;
  file_name: string;
  document_type: string;
  confidence_score: number;
  created_at: string;
}

interface DocumentRequirement {
  type: string;
  required: boolean;
  present: boolean;
  validated: boolean;
  count: number;
}

interface CollateralStatus {
  loanId: string;
  completenessScore: number;
  isComplete: boolean;
  requiredDocuments: DocumentRequirement[];
  missingDocuments: string[];
  assignmentChainComplete: boolean;
  chainGaps: string[];
  validationErrors: any[];
  lastUpdated: string;
}

interface UnifiedCollateralCardProps {
  loanId: string;
}

const getDocumentTypeColor = (docType: string): string => {
  const baseColors: { [key: string]: string } = {
    'Note': 'var(--color-primary)',
    'Mortgage': 'var(--color-success)',
    'Security Instrument': 'var(--color-success)',
    'Deed of Trust': 'var(--color-warning)',
    'Assignment': 'var(--color-info)',
    'Allonge': 'var(--color-danger)',
    'Other': 'var(--color-text-muted)'
  };
  return baseColors[docType] || 'var(--color-text-muted)';
};

const UnifiedCollateralCard: React.FC<UnifiedCollateralCardProps> = ({ loanId }) => {
  const [documents, setDocuments] = useState<CollateralDocument[]>([]);
  const [collateralStatus, setCollateralStatus] = useState<CollateralStatus | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch both documents and status
  const fetchCollateralData = useCallback(async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      
      // Fetch documents and status in parallel
      const [docsResponse, statusResponse] = await Promise.all([
        axios.get(`${apiUrl}/api/v2/loans/${loanId}/analyzed-documents`).catch(() => ({ data: { documents: [] } })),
        axios.get(`${apiUrl}/api/v2/loans/${loanId}/collateral-status`).catch(() => ({ data: { status: null } }))
      ]);
      
      setDocuments(docsResponse.data.documents || []);
      setCollateralStatus(statusResponse.data.status || {
        loanId,
        completenessScore: 0,
        isComplete: false,
        requiredDocuments: [
          { type: 'Note', required: true, present: false, validated: false, count: 0 },
          { type: 'Security Instrument', required: true, present: false, validated: false, count: 0 },
          { type: 'Assignment', required: true, present: false, validated: false, count: 0 }
        ],
        missingDocuments: ['Note', 'Mortgage/Deed of Trust', 'Assignment'],
        assignmentChainComplete: false,
        chainGaps: [],
        validationErrors: [],
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching collateral data:', error);
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    fetchCollateralData();
  }, [fetchCollateralData]);

  // File handling
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    handleFiles(files);
  };

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        toast({
          title: "Invalid File Type",
          description: `${file.name} is not a PDF file.`,
          variant: "destructive",
        });
        return false;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: `${file.name} is larger than 50MB.`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    const files = Array.from(event.dataTransfer.files);
    handleFiles(files);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('document', file);

        await axios.post(
          `${apiUrl}/api/v2/loans/${loanId}/analyze-document`,
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 60000,
          }
        );
      }

      toast({
        title: "Upload Successful",
        description: `Successfully uploaded ${selectedFiles.length} document(s).`,
      });

      setSelectedFiles([]);
      await fetchCollateralData();
    } catch (error) {
      console.error('Error uploading documents:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload documents.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (documentId: number, fileName: string) => {
    if (!confirm(`Delete "${fileName}"?`)) return;

    setDeletingDocumentId(documentId);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      await axios.delete(`${apiUrl}/api/v2/loans/${loanId}/documents/${documentId}`);
      
      toast({
        title: "Document Deleted",
        description: `Deleted "${fileName}".`,
      });
      
      await fetchCollateralData();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete document.",
        variant: "destructive",
      });
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const getStatusIcon = (requirement: DocumentRequirement) => {
    if (!requirement.present) return <XCircle style={{ width: '12px', height: '12px', color: 'var(--color-danger)' }} />;
    if (!requirement.validated) return <AlertTriangle style={{ width: '12px', height: '12px', color: 'var(--color-warning)' }} />;
    return <CheckCircle style={{ width: '12px', height: '12px', color: 'var(--color-success)' }} />;
  };

  if (loading) {
    return (
      <div className="financial-card" style={{ padding: '12px' }}>
        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  const completenessScore = collateralStatus?.completenessScore || 0;
  const scoreColor = completenessScore === 100 ? 'var(--color-success)' : 
                     completenessScore >= 75 ? 'var(--color-warning)' : 
                     'var(--color-danger)';

  return (
    <div className="financial-card" style={{ padding: '12px', marginBottom: '12px' }}>
      {/* Header with Status */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: '8px',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield style={{ width: '14px', height: '14px', color: 'var(--color-text-muted)' }} />
          <h3 style={{ 
            fontSize: '11px', 
            fontWeight: '600', 
            textTransform: 'uppercase',
            margin: 0,
            color: 'var(--color-text)'
          }}>
            COLLATERAL DOCUMENTS
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: scoreColor }}>
              {completenessScore}%
            </div>
            <div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
              {collateralStatus?.isComplete ? 'Complete' : 'Incomplete'}
            </div>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: '3px',
              padding: '4px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
              color: 'var(--color-text-muted)'
            }}
          >
            Details
            {showDetails ? <ChevronUp style={{ width: '12px', height: '12px' }} /> : <ChevronDown style={{ width: '12px', height: '12px' }} />}
          </button>
        </div>
      </div>

      {/* Compact Status Summary */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '8px',
        marginBottom: '12px'
      }}>
        {collateralStatus?.requiredDocuments.filter(d => d.required).map((req, index) => (
          <div key={index} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '3px',
            border: '1px solid var(--color-border)'
          }}>
            {getStatusIcon(req)}
            <span style={{ fontSize: '10px', color: 'var(--color-text)' }}>
              {req.type}
            </span>
            {req.count > 0 && (
              <span style={{ 
                fontSize: '9px', 
                color: 'var(--color-text-muted)',
                marginLeft: 'auto'
              }}>
                ({req.count})
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Upload Area - Compact */}
      <div style={{ marginBottom: '12px' }}>
        <div
          style={{
            border: `2px dashed ${isDragOver ? 'var(--color-primary)' : 'var(--color-border)'}`,
            borderRadius: '4px',
            padding: '12px',
            textAlign: 'center',
            backgroundColor: isDragOver ? 'rgba(0, 123, 255, 0.1)' : 'var(--color-surface)',
            transition: 'all 0.2s ease'
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload style={{ 
            width: '20px', 
            height: '20px', 
            margin: '0 auto 8px', 
            color: 'var(--color-text-muted)' 
          }} />
          <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text)' }}>
              Drop PDFs or{' '}
              <span style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>browse</span>
            </span>
          </label>
          <input
            id="file-upload"
            type="file"
            style={{ display: 'none' }}
            multiple
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
            disabled={isUploading}
          />
          <p style={{ fontSize: '9px', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            PDF only, up to 50MB
          </p>
        </div>

        {/* Selected Files */}
        {selectedFiles.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            {selectedFiles.map((file, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                backgroundColor: 'var(--color-surface)',
                borderRadius: '3px',
                marginBottom: '4px',
                fontSize: '10px'
              }}>
                <span>{file.name}</span>
                <button
                  onClick={() => removeSelectedFile(index)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-danger)',
                    cursor: 'pointer',
                    padding: '2px'
                  }}
                >
                  <XCircle style={{ width: '12px', height: '12px' }} />
                </button>
              </div>
            ))}
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="btn-compact btn-primary"
              style={{ 
                width: '100%', 
                marginTop: '8px',
                fontSize: '10px',
                padding: '6px'
              }}
            >
              {isUploading ? 'UPLOADING...' : `UPLOAD ${selectedFiles.length} FILE${selectedFiles.length > 1 ? 'S' : ''}`}
            </button>
          </div>
        )}
      </div>

      {/* Document List - Compact */}
      {documents.length > 0 && (
        <div>
          <div style={{ 
            fontSize: '10px', 
            fontWeight: '600', 
            color: 'var(--color-text-muted)',
            marginBottom: '8px'
          }}>
            UPLOADED DOCUMENTS ({documents.length})
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {documents.map((doc) => (
              <div key={doc.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                backgroundColor: 'var(--color-surface)',
                borderRadius: '3px',
                marginBottom: '4px',
                border: '1px solid var(--color-border)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <File style={{ width: '12px', height: '12px', color: 'var(--color-text-muted)' }} />
                  <span style={{ fontSize: '10px', color: 'var(--color-text)' }}>
                    {doc.file_name}
                  </span>
                  <span style={{
                    fontSize: '9px',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    color: getDocumentTypeColor(doc.document_type),
                    border: `1px solid ${getDocumentTypeColor(doc.document_type)}`,
                    marginLeft: 'auto'
                  }}>
                    {doc.document_type} ({Math.round(doc.confidence_score * 100)}%)
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(doc.id, doc.file_name)}
                  disabled={deletingDocumentId === doc.id}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-danger)',
                    cursor: 'pointer',
                    padding: '2px',
                    marginLeft: '8px'
                  }}
                >
                  <Trash2 style={{ width: '12px', height: '12px' }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expanded Details */}
      {showDetails && collateralStatus && (
        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid var(--color-border)',
          fontSize: '10px'
        }}>
          {/* Chain Status */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--color-text)' }}>
              Assignment Chain: {collateralStatus.assignmentChainComplete ? 
                <span style={{ color: 'var(--color-success)' }}>Complete</span> : 
                <span style={{ color: 'var(--color-danger)' }}>Incomplete</span>
              }
            </div>
            {collateralStatus.chainGaps.length > 0 && (
              <div style={{ color: 'var(--color-warning)', fontSize: '9px' }}>
                {collateralStatus.chainGaps.map((gap, i) => (
                  <div key={i}>• {gap}</div>
                ))}
              </div>
            )}
          </div>

          {/* Missing Documents */}
          {collateralStatus.missingDocuments.length > 0 && (
            <div>
              <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--color-text)' }}>
                Missing Documents:
              </div>
              <div style={{ color: 'var(--color-danger)', fontSize: '9px' }}>
                {collateralStatus.missingDocuments.map((doc, i) => (
                  <span key={i}>• {doc}{i < collateralStatus.missingDocuments.length - 1 ? ' ' : ''}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UnifiedCollateralCard;