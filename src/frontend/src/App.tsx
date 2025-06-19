import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import LoanExplorerPage from './pages/LoanExplorerPage';
import DashboardPage from './pages/DashboardPage';
import { TestExportPage } from './pages/TestExportPage';

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
            <Link to="/" style={{ marginRight: '20px' }}>Dashboard</Link>
            <Link to="/upload" style={{ marginRight: '20px' }}>Upload</Link>
            <Link to="/loans" style={{ marginRight: '20px' }}>Loan Explorer</Link>
            <Link to="/test-export" className="text-sm font-medium text-red-500 hover:underline">
              (Test Page)
            </Link>
          </nav>
        </header>
        
        <main style={{ padding: '20px' }}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/loans" element={<LoanExplorerPage />} />
            <Route path="/test-export" element={<TestExportPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;