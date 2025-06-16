import { useState } from 'react';
import axios from 'axios';

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
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
      setFile(null);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setError('Failed to upload file');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Upload Loan File</h1>
      
      <div>
        <input type="file" onChange={handleFileChange} accept=".xlsx,.xls,.csv" />
        <button onClick={handleUpload} disabled={loading}>
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {uploadResponse && uploadResponse.status === 'success' && (
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#d4edda', color: '#155724', border: '1px solid #c3e6cb', borderRadius: '4px' }}>
          <strong>Success!</strong> {uploadResponse.message}
        </div>
      )}
    </div>
  );
}

export default UploadPage;