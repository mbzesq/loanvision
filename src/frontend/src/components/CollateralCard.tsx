// src/frontend/src/components/CollateralCard.tsx
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Upload, File, Trash2, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@loanvision/shared/components/ui/card';
import { Button } from '@loanvision/shared/components/ui/button';
import { useToast } from '@loanvision/shared/hooks/use-toast';
import { Badge } from '@loanvision/shared/components/ui/badge';

interface CollateralDocument {
  id: number;
  loan_id: string;
  file_name: string;
  document_type: string;
  page_count: number;
  upload_date: string;
  file_size: number;
  created_at: string;
}

interface CollateralCardProps {
  loanId: string;
}

interface UploadProgress {
  fileName: string;
  status: 'uploading' | 'classifying' | 'complete' | 'error';
  error?: string;
}

const getDocumentTypeColor = (docType: string): string => {
  const colorMap: { [key: string]: string } = {
    'Note': 'bg-blue-100 text-blue-800',
    'Mortgage': 'bg-green-100 text-green-800',
    'Deed of Trust': 'bg-purple-100 text-purple-800',
    'Assignment': 'bg-orange-100 text-orange-800',
    'Allonge': 'bg-pink-100 text-pink-800',
    'Rider': 'bg-indigo-100 text-indigo-800',
    'Bailee Letter': 'bg-cyan-100 text-cyan-800',
    'UNLABELED': 'bg-gray-100 text-gray-800'
  };
  return colorMap[docType] || 'bg-gray-100 text-gray-800';
};

const CollateralCard: React.FC<CollateralCardProps> = ({ loanId }) => {
  const [documents, setDocuments] = useState<CollateralDocument[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch existing documents for the loan
  const fetchDocuments = useCallback(async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await axios.get(`${apiUrl}/api/v2/loans/${loanId}/collateral`);
      
      if (response.data.success) {
        setDocuments(response.data.documents || []);
      }
    } catch (error) {
      console.error('Error fetching collateral documents:', error);
      // Don't show error toast on initial load if no documents exist
      if (axios.isAxiosError(error) && error.response?.status !== 404) {
        toast({
          title: "Error",
          description: "Failed to load collateral documents.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [loanId, toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    handleFiles(files);
  };

  // Validate and process selected files
  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        toast({
          title: "Invalid File Type",
          description: `${file.name} is not a PDF file. Only PDF files are allowed.`,
          variant: "destructive",
        });
        return false;
      }
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        toast({
          title: "File Too Large",
          description: `${file.name} is larger than 50MB. Please select a smaller file.`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  // Handle drag and drop
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

  // Remove selected file before upload
  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Upload documents
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select at least one PDF file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(selectedFiles.map(file => ({
      fileName: file.name,
      status: 'uploading'
    })));

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      const formData = new FormData();
      
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      // Update progress to classifying
      setUploadProgress(prev => prev.map(item => ({
        ...item,
        status: 'classifying'
      })));

      // By removing the explicit headers config, our default interceptor 
      // will correctly add the Authorization header.
      const response = await axios.post(
        `${apiUrl}/api/v2/loans/${loanId}/collateral`,
        formData,
        {
          timeout: 60000, // 60 second timeout
        }
      );

      if (response.data.success) {
        // Update progress to complete
        setUploadProgress(prev => prev.map(item => ({
          ...item,
          status: 'complete'
        })));

        toast({
          title: "Upload Successful",
          description: `Successfully uploaded and classified ${response.data.processedFiles} document(s).`,
        });

        // Clear selected files and refresh document list
        setSelectedFiles([]);
        await fetchDocuments();
      } else {
        throw new Error(response.data.errors?.join(', ') || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading documents:', error);
      
      // Update progress to show errors
      setUploadProgress(prev => prev.map(item => ({
        ...item,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })));

      let errorMessage = 'Failed to upload documents';
      if (axios.isAxiosError(error)) {
        if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.code === 'ECONNABORTED') {
          errorMessage = 'Upload timed out. Please try with smaller files.';
        }
      }
      
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Clear progress after a delay
      setTimeout(() => setUploadProgress([]), 3000);
    }
  };

  // Delete document
  const handleDelete = async (documentId: number, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    setDeletingDocumentId(documentId);

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      await axios.delete(`${apiUrl}/api/v2/collateral/${documentId}`);
      
      toast({
        title: "Document Deleted",
        description: `Successfully deleted "${fileName}".`,
      });
      
      // Refresh document list
      await fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      
      let errorMessage = 'Failed to delete document';
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      toast({
        title: "Delete Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setDeletingDocumentId(null);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Collateral Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload Section */}
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="mt-2 block text-sm font-medium text-gray-900">
                  Drop PDF files here, or{' '}
                  <span className="text-blue-600 hover:text-blue-500">browse</span>
                </span>
              </label>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                className="sr-only"
                multiple
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              PDF files only, up to 50MB each
            </p>
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900">Selected Files:</h4>
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700">{file.name}</span>
                    <span className="text-xs text-gray-500">
                      ({(file.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </div>
                  {!isUploading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSelectedFile(index)}
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Upload Progress */}
          {uploadProgress.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900">Upload Progress:</h4>
              {uploadProgress.map((progress, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-700">{progress.fileName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {progress.status === 'uploading' && (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                        <span className="text-xs text-blue-600">Uploading...</span>
                      </>
                    )}
                    {progress.status === 'classifying' && (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                        <span className="text-xs text-purple-600">Classifying...</span>
                      </>
                    )}
                    {progress.status === 'complete' && (
                      <>
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span className="text-xs text-green-600">Complete</span>
                      </>
                    )}
                    {progress.status === 'error' && (
                      <>
                        <AlertCircle className="h-3 w-3 text-red-600" />
                        <span className="text-xs text-red-600">Error</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              `Upload ${selectedFiles.length > 0 ? `${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}` : 'Files'}`
            )}
          </Button>
        </div>

        {/* Documents List */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-900">
            Uploaded Documents ({documents.length})
          </h4>
          
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>No documents uploaded yet.</p>
              <p className="text-sm text-gray-400 mt-1">
                Upload PDF documents to see AI-powered classification results.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-gray-900">{doc.file_name}</span>
                        <Badge className={getDocumentTypeColor(doc.document_type)}>
                          {doc.document_type}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Pages:</span> {doc.page_count}
                        </div>
                        <div>
                          <span className="font-medium">Uploaded:</span> {formatDate(doc.upload_date)}
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc.id, doc.file_name)}
                      disabled={deletingDocumentId === doc.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {deletingDocumentId === doc.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CollateralCard;