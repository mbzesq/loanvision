import { useState, useRef } from 'react';
import axios from 'axios';
import { FileText, X, Loader2, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../hooks/use-toast';

interface CollateralUploadResult {
  success: boolean;
  fileName: string;
  documentType: string;
  pageCount: number;
  error?: string;
}

interface CollateralUploadResponse {
  success: boolean;
  message: string;
  results: CollateralUploadResult[];
  loanId: string;
}

function CollateralUploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [loanId, setLoanId] = useState('');
  const [uploadResponse, setUploadResponse] = useState<CollateralUploadResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    if (file.type !== 'application/pdf') {
      return 'Please select a valid PDF file';
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      return 'File size must be less than 50MB';
    }
    
    return null;
  };

  const handleFileSelect = (selectedFiles: FileList | File[]) => {
    const newFiles: File[] = [];
    const errors: string[] = [];

    Array.from(selectedFiles).forEach(file => {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`);
      } else {
        newFiles.push(file);
      }
    });

    if (errors.length > 0) {
      setError(errors.join(', '));
      toast({
        title: 'Invalid Files',
        description: errors.join(', '),
        variant: 'destructive',
      });
    } else {
      setError(null);
    }

    setFiles(prev => [...prev, ...newFiles]);
    setUploadResponse(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (files.length === 1) {
      setError(null);
      setUploadResponse(null);
    }
  };

  const handleUpload = async () => {
    if (!loanId.trim()) {
      setError('Please enter a Loan ID');
      return;
    }

    if (files.length === 0) {
      setError('Please select at least one PDF file');
      return;
    }

    setLoading(true);
    setError(null);
    setUploadResponse(null);

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      
      // By removing the explicit headers config, our default interceptor 
      // will correctly add the Authorization header.
      const response = await axios.post<CollateralUploadResponse>(
        `${apiUrl}/api/v2/loans/${loanId.trim()}/collateral`, 
        formData
      );

      setUploadResponse(response.data);
      
      const successCount = response.data.results.filter(r => r.success).length;
      const totalCount = response.data.results.length;
      
      toast({
        title: 'Upload Complete',
        description: `Successfully processed ${successCount} of ${totalCount} documents`,
        variant: successCount === totalCount ? 'default' : 'destructive',
      });
      
      // Clear files after successful upload
      if (response.data.success) {
        setFiles([]);
        setLoanId('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to upload collateral documents';
      setError(errorMessage);
      toast({
        title: 'Upload Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Collateral Document Package
        </CardTitle>
        <CardDescription>
          Upload PDF documents for loan collateral analysis and classification.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Loan ID Input */}
        <div className="space-y-2">
          <Label htmlFor="loanId">Loan ID</Label>
          <Input
            id="loanId"
            type="text"
            placeholder="Enter Loan ID (e.g., 0000359811)"
            value={loanId}
            onChange={(e) => setLoanId(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Drag and Drop Zone */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            isDragOver
              ? 'border-blue-400 bg-blue-50'
              : files.length > 0
              ? 'border-green-300 bg-green-50'
              : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            accept=".pdf"
            className="hidden"
          />
          
          <div className="space-y-3">
            <FileText className={`h-10 w-10 mx-auto ${isDragOver ? 'text-blue-600' : 'text-slate-400'}`} />
            <div className="space-y-1">
              <p className="font-medium text-slate-900">
                {files.length > 0 ? `${files.length} file(s) selected` : 'Drag and drop PDF files here'}
              </p>
              <p className="text-sm text-slate-500">
                or click to select files
              </p>
              <p className="text-xs text-slate-400">
                Supports PDF files up to 50MB each
              </p>
            </div>
          </div>
        </div>

        {/* Selected Files List */}
        {files.length > 0 && (
          <div className="space-y-2">
            <Label>Selected Files ({files.length})</Label>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-slate-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      handleRemoveFile(index);
                    }}
                    className="flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Success Display */}
        {uploadResponse && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900">
                Upload Results for Loan {uploadResponse.loanId}:
              </p>
              {uploadResponse.results.map((result, index) => (
                <div key={index} className={`text-sm p-2 rounded ${
                  result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {result.success ? (
                    <span>✓ {result.fileName} → {result.documentType} ({result.pageCount} pages)</span>
                  ) : (
                    <span>✗ {result.fileName}: {result.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={!loanId.trim() || files.length === 0 || loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing Documents...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload Collateral Documents
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default CollateralUploader;