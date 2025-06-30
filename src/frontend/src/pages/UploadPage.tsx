import { useState, useRef } from 'react';
import axios from 'axios';
import { UploadCloud, X, FileText, Loader2, Server } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@loanvision/shared/components/ui/card';
import { Button } from '@loanvision/shared/components/ui/button';
import { useToast } from '@loanvision/shared/hooks/use-toast';
import CollateralUploader from '../components/CollateralUploader';

interface UploadResponse {
  status: string;
  message: string;
  record_count: number;
}

function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];
    
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      return 'Please select a valid file (.xlsx, .xls, or .csv)';
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      return 'File size must be less than 50MB';
    }
    
    return null;
  };

  const handleFileSelect = (selectedFile: File) => {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      toast({
        title: 'Invalid File',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }
    
    setFile(selectedFile);
    setError(null);
    setUploadResponse(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
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
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setError(null);
    setUploadResponse(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError(null);
    setUploadResponse(null);

    const formData = new FormData();
    formData.append('loanFile', file);

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await axios.post<UploadResponse>(`${apiUrl}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadResponse(response.data);
      
      toast({
        title: 'Upload Successful',
        description: `${response.data.message} (${response.data.record_count} records processed)`,
      });
      
      // Clear the file after successful upload
      handleRemoveFile();
    } catch (err) {
      const errorMessage = 'Failed to upload file';
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
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Import Data</h1>
        <p className="text-lg text-slate-600">Upload files or connect to external data sources.</p>
      </div>

      {/* Three Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Manual Upload Card */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="h-5 w-5" />
              Manual File Upload
            </CardTitle>
            <CardDescription>
              Upload .xlsx, .xls, or .csv files directly from your computer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drag and Drop Zone */}
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                isDragOver
                  ? 'border-blue-400 bg-blue-50'
                  : file
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
                onChange={handleFileChange}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              
              {file ? (
                <div className="space-y-3">
                  <FileText className="h-12 w-12 text-green-600 mx-auto" />
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">{file.name}</p>
                    <p className="text-sm text-slate-500">{formatFileSize(file.size)}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile();
                    }}
                    className="flex items-center gap-1"
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <UploadCloud className={`h-12 w-12 mx-auto ${isDragOver ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div className="space-y-1">
                    <p className="text-lg font-medium text-slate-900">
                      Drag and drop your file here
                    </p>
                    <p className="text-sm text-slate-500">
                      or click to select a file
                    </p>
                    <p className="text-xs text-slate-400">
                      Supports .xlsx, .xls, and .csv files up to 50MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Success Display */}
            {uploadResponse && uploadResponse.status === 'success' && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-600">
                  <strong>Success!</strong> {uploadResponse.message}
                </p>
              </div>
            )}

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={!file || loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4 mr-2" />
                  Upload File
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Collateral Upload Card */}
        <CollateralUploader />

        {/* FTP Connection Card (Placeholder) */}
        <Card className="h-fit opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-500">
              <Server className="h-5 w-5" />
              Connect Data Source (FTP)
            </CardTitle>
            <CardDescription>
              Automate data ingestion by connecting to an FTP server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
              <Server className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 font-medium mb-1">FTP Integration</p>
              <p className="text-sm text-slate-500">
                Automatically sync data from your FTP server
              </p>
            </div>
            
            <Button disabled className="w-full" size="lg" variant="outline">
              Configure Connection (Coming Soon)
            </Button>
            
            <p className="text-xs text-slate-400 text-center">
              This feature will be available in a future release
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default UploadPage;