import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Audit from './pages/Audit.jsx';
import Choice from './pages/Choice.jsx';
import Control from './pages/Control.jsx';
import Analyze from './pages/Analyze.jsx';
import ClientPortal, { PaymentsPortal } from './pages/ClientPortal.jsx';
import ClientsList from './pages/ClientsList.jsx';
import Admin from './pages/Admin.jsx';
import MediaPlan from './pages/MediaPlan.jsx';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-center" style={{ minHeight: '100vh' }}>
        <span className="spinner spinner-lg" />
        <span>Cargando...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-center" style={{ minHeight: '100vh' }}>
        <span className="spinner spinner-lg" />
        <span>Cargando...</span>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return children;
}

function AppShell() {
  const [view, setView] = useState('choice');

  if (view === 'optimize') return <Dashboard onBack={() => setView('choice')} />;
  if (view === 'control') return <Control onBack={() => setView('choice')} />;
  if (view === 'analyze') return <Analyze onBack={() => setView('choice')} />;
  if (view === 'clients') return <ClientsList onBack={() => setView('choice')} />;
  if (view === 'admin') return <Admin onBack={() => setView('choice')} />;
  if (view === 'media') return <MediaPlan onBack={() => setView('choice')} />;
  return <Choice onPick={(mode) => setView(mode)} />;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit"
        element={
          <ProtectedRoute>
            <Audit />
          </ProtectedRoute>
        }
      />
      {/* Portal de cliente — público, protegido por clave propia */}
      <Route path="/cliente/:slug" element={<ClientPortal />} />
      {/* Vista solo de pagos — para administración, clave separada */}
      <Route path="/cliente/:slug/pagos" element={<PaymentsPortal />} />
      {/* Legacy redirect */}
      <Route path="/dashboard" element={<Navigate to="/app" replace />} />
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
