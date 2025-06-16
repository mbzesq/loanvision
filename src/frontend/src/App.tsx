import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import LoanExplorerPage from './pages/LoanExplorerPage';

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
    <Router>
      <div>
        <header style={{ padding: '20px', borderBottom: '1px solid #ccc' }}>
          <h1>LoanVision</h1>
          <p>Backend Status: {status}</p>
          <nav>
            <Link to="/" style={{ marginRight: '20px' }}>Upload</Link>
            <Link to="/loans">Loan Explorer</Link>
          </nav>
        </header>
        
        <main style={{ padding: '20px' }}>
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/loans" element={<LoanExplorerPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;