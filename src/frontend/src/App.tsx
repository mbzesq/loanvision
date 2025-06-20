// src/frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
import LoanExplorerPage from './pages/LoanExplorerPage';
import UploadPage from './pages/UploadPage';
import DashboardPage from './pages/DashboardPage';
import { Toaster } from '@loanvision/shared/components/ui/toaster';

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/loans" element={<LoanExplorerPage />} />
          <Route path="/upload" element={<UploadPage />} />
          {/* Other pages will be added as new routes here */}
        </Route>
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;