// src/frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
import LoanExplorerPage from './pages/LoanExplorerPage';
import UploadPage from './pages/UploadPage';
import DashboardPage from './pages/DashboardPage';
import InboxPage from './pages/InboxPage';
import LoanDetailPage from './pages/LoanDetailPage';
import SOLMonitoringPage from './pages/SOLMonitoringPage';
import ForeclosureMonitoringPage from './pages/ForeclosureMonitoringPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LandingPage from './pages/LandingPage';
import OrganizationPage from './pages/OrganizationPage';
import OrganizationDirectoryPage from './pages/OrganizationDirectoryPage';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Protected routes */}
          <Route element={<MainLayout />}>
            <Route path="/inbox" element={
              <ProtectedRoute>
                <InboxPage />
              </ProtectedRoute>
            } />
            <Route path="/today" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/loans" element={
              <ProtectedRoute>
                <LoanExplorerPage />
              </ProtectedRoute>
            } />
            <Route path="/loans/:loanId" element={
              <ProtectedRoute>
                <LoanDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/upload" element={
              <ProtectedRoute>
                <UploadPage />
              </ProtectedRoute>
            } />
            <Route path="/sol-monitoring" element={
              <ProtectedRoute>
                <SOLMonitoringPage />
              </ProtectedRoute>
            } />
            <Route path="/foreclosure-monitoring" element={
              <ProtectedRoute>
                <ForeclosureMonitoringPage />
              </ProtectedRoute>
            } />
            <Route path="/organization" element={
              <ProtectedRoute>
                <OrganizationPage />
              </ProtectedRoute>
            } />
            <Route path="/organization/directory" element={
              <ProtectedRoute>
                <OrganizationDirectoryPage />
              </ProtectedRoute>
            } />
            {/* Other pages will be added as new routes here */}
          </Route>
        </Routes>
        <Toaster />
      </AuthProvider>
    </Router>
  );
}

export default App;