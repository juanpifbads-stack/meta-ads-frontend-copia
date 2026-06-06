import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Audit from './pages/Audit.jsx';
import Home from './pages/Home.jsx';
import ClientHub from './pages/ClientHub.jsx';
import Admin from './pages/Admin.jsx';
import ClientPortal, { PaymentsPortal } from './pages/ClientPortal.jsx';

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

function AppFooter() {
  const { logout } = useAuth();
  return (
    <footer style={{ textAlign: 'center', padding: '28px 16px 40px' }}>
      <button
        onClick={logout}
        style={{
          fontFamily: 'var(--font-mono, monospace)', fontSize: '12px', textTransform: 'uppercase',
          letterSpacing: '0.05em', color: '#64748b', background: 'transparent',
          border: '1px solid #cbd5e1', borderRadius: '999px', padding: '8px 18px', cursor: 'pointer',
        }}
      >
        Cerrar sesión
      </button>
    </footer>
  );
}

function AppShell() {
  const [view, setView] = useState('home');
  const [slug, setSlug] = useState(null);
  const [adminNew, setAdminNew] = useState(false);

  let content;
  if (view === 'optimize') content = <Dashboard onBack={() => setView('home')} />;
  else if (view === 'admin') content = <Admin onBack={() => setView('home')} autoNew={adminNew} />;
  else if (view === 'client' && slug) content = <ClientHub slug={slug} onBack={() => { setView('home'); setSlug(null); }} />;
  else content = (
    <Home
      onOpenClient={(s) => { setSlug(s); setView('client'); }}
      onOptimize={() => setView('optimize')}
      onNewClient={() => { setAdminNew(true); setView('admin'); }}
    />
  );

  return <>{content}<AppFooter /></>;
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
