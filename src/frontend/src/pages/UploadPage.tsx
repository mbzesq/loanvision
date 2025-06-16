import { useState } from 'react';
import axios from 'axios';

function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadedData, setUploadedData] = useState<any[]>([]);
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

    const formData = new FormData();
    formData.append('loanFile', file);

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await axios.post(`${apiUrl}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadedData(response.data);
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

      {uploadedData.length > 0 && (
        <div>
          <h2>Uploaded Data:</h2>
          <pre>{JSON.stringify(uploadedData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default UploadPage;