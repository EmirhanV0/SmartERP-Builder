import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';
import { useViewport } from './hooks/useViewport';
import ProtectedRoute from './components/ProtectedRoute';
import RequireAdmin from './components/RequireAdmin';
import LoadingSpinner from './components/LoadingSpinner';
import CommandPalette from './components/CommandPalette';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DescribePage from './pages/DescribePage';
import PreviewPage from './pages/PreviewPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  const { loading, isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const { isMobile } = useViewport();

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
        <Route path="/setup/describe" element={<ProtectedRoute><DescribePage /></ProtectedRoute>} />
        <Route path="/setup/preview" element={<ProtectedRoute><PreviewPage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastContainer
        position={isMobile ? 'top-center' : 'top-right'}
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme={theme}
        style={{ zIndex: 9999 }}
      />
      <CommandPalette />
    </>
  );
}
