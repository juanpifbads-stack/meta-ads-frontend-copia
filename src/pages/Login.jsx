import React from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://meta-ads-backend-production-85df.up.railway.app';

export default function Login() {
  const handleConnect = () => {
    window.location.href = `${API_URL}/auth/meta`;
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-background)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
      }}
    >
      {/* Login Card */}
      <div
        style={{
          backgroundColor: 'var(--color-white)',
          border: '0.5px solid var(--color-gray-mid)',
          borderLeft: '4px solid var(--color-brand-blue)',
          borderRadius: 'var(--radius-xl)',
          padding: '40px 44px',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: '32px' }}>
          <div className="logo-group">
            <span className="logo-text">alquimia.</span>
            <div className="logo-line" />
            <span
              className="logo-subtitle"
              style={{ marginTop: '6px', fontSize: '12px' }}
            >
              / ads dashboard
            </span>
          </div>
        </div>

        {/* Description */}
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            color: 'var(--color-text-secondary)',
            lineHeight: '1.6',
            marginBottom: '32px',
          }}
        >
          Optimización de campañas Meta Ads con análisis por ventanas de 7, 14 y
          30 días. Controlá presupuestos y pausá conjuntos de anuncios desde un
          solo lugar.
        </p>

        {/* Connect Button */}
        <button
          onClick={handleConnect}
          className="btn btn-primary"
          style={{
            width: '100%',
            justifyContent: 'center',
            fontSize: '13px',
            padding: '12px 20px',
            letterSpacing: '0.04em',
          }}
        >
          Conectar con Meta →
        </button>

        {/* Note */}
        <p
          style={{
            marginTop: '16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
            lineHeight: '1.5',
          }}
        >
          Acceso mediante OAuth 2.0 de Meta.
          <br />
          No almacenamos contraseñas.
        </p>
      </div>

      {/* Footer */}
      <footer
        style={{
          marginTop: '32px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-text-muted)',
          }}
        >
          design by{' '}
          <span
            style={{
              fontWeight: '700',
              color: 'var(--color-brand-blue)',
            }}
          >
            alquimia.
          </span>
        </p>
      </footer>
    </div>
  );
}
