import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuditLog from '../components/AuditLog.jsx';

export default function Audit() {
  const { logout } = useAuth();

  return (
    <div className="app-wrapper">
      {/* Header */}
      <header className="app-header">
        <div className="app-header-inner">
          <div className="logo-group">
            <span className="logo-text">alquimia.</span>
            <div className="logo-line" />
            <span className="logo-subtitle">/ ads dashboard</span>
          </div>
          <nav className="header-nav">
            <Link
              to="/dashboard"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '5px 12px' }}
            >
              ← Dashboard
            </Link>
            <button
              onClick={logout}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '5px 12px' }}
            >
              Salir
            </button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="app-main">
        <div className="content-container">
          {/* Page header */}
          <div style={{ marginBottom: '24px' }}>
            <h1
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: '700',
                fontSize: '18px',
                color: 'var(--color-text-primary)',
                marginBottom: '6px',
              }}
            >
              Historial de acciones
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--color-text-muted)',
              }}
            >
              Registro completo de cambios de presupuesto y pausas realizados desde este dashboard.
            </p>
          </div>

          {/* Audit log card */}
          <div
            className="card"
            style={{ cursor: 'default' }}
          >
            <AuditLog />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>
          design by{' '}
          <span className="footer-brand">alquimia.</span>
        </p>
      </footer>
    </div>
  );
}
