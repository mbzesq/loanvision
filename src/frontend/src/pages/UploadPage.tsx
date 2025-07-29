import { useState, useRef } from 'react';
import axios from 'axios';
import { UploadCloud, X, FileText, Loader2, Server, Database, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <Database className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Import Data</h1>
              <p className="text-gray-600">Upload files or connect to external data sources</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        
        {/* Three Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Manual Upload Card */}
          <div className="premium-card">
            <div className="premium-card-header">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-blue-600" />
                <h2 className="premium-card-title">Manual File Upload</h2>
              </div>
              <p className="premium-card-subtitle">Upload .xlsx, .xls, or .csv files directly from your computer</p>
            </div>
            
            <div className="premium-card-content space-y-6">
              {/* Drag and Drop Zone */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer ${
                  isDragOver
                    ? 'border-blue-400 bg-blue-50'
                    : file
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
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
                  <div className="space-y-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                      <FileText className="w-8 h-8 text-emerald-600" />
                    </div>
                    <div className="space-y-2">
                      <p className="font-semibold text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile();
                      }}
                      className="inline-flex items-center gap-2 px-3 py-1 text-sm text-red-600 hover:text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center transition-colors ${
                      isDragOver ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <UploadCloud className={`w-8 h-8 ${isDragOver ? 'text-blue-600' : 'text-gray-400'}`} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-semibold text-gray-900">
                        Drag and drop your file here
                      </p>
                      <p className="text-sm text-gray-600">
                        or click to select a file
                      </p>
                      <p className="text-xs text-gray-500">
                        Supports .xlsx, .xls, and .csv files up to 50MB
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Success Display */}
              {uploadResponse && uploadResponse.status === 'success' && (
                <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-800">Upload Successful!</p>
                    <p className="text-sm text-emerald-700">{uploadResponse.message}</p>
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <button
                onClick={handleUpload}
                disabled={!file || loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-5 h-5" />
                    Upload File
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Collateral Upload Card */}
          <CollateralUploader />

          {/* FTP Connection Card (Placeholder) */}
          <div className="premium-card opacity-60">
            <div className="premium-card-header">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-gray-400" />
                <h2 className="premium-card-title text-gray-500">Connect Data Source (FTP)</h2>
              </div>
              <p className="premium-card-subtitle">Automate data ingestion by connecting to an FTP server</p>
            </div>
            
            <div className="premium-card-content space-y-6">
              <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Server className="w-8 h-8 text-gray-400" />
                </div>
                <p className="font-semibold text-gray-600 mb-2">FTP Integration</p>
                <p className="text-sm text-gray-500">
                  Automatically sync data from your FTP server
                </p>
              </div>
              
              <button
                disabled
                className="w-full px-6 py-3 bg-gray-200 text-gray-500 rounded-lg font-medium cursor-not-allowed"
              >
                Configure Connection (Coming Soon)
              </button>
              
              <p className="text-xs text-gray-400 text-center">
                This feature will be available in a future release
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default UploadPage;