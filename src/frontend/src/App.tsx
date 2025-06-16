import { useEffect, useState } from 'react';
import UploadPage from './pages/UploadPage';

function App() {
  const [status, setStatus] = useState<string>('loading...');

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
    fetch(`${apiUrl}/api/health`)
      .then(res => res.json())
      .then(data => setStatus(data.status))
      .catch(() => setStatus('error'));
  }, []);

  return (
    <div>
      <h1>Backend Status: {status}</h1>
      <hr />
      <UploadPage />
    </div>
  );
}

export default App;