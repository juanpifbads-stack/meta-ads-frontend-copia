import React, { useState } from 'react';
import apiClient, { setAuthToken } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'https://meta-ads-backend-production-85df.up.railway.app';

const card = {
  backgroundColor: 'var(--color-white)', border: '0.5px solid var(--color-gray-mid)',
  borderLeft: '4px solid var(--color-brand-blue)', borderRadius: 'var(--radius-xl)',
  padding: '40px 44px', width: '100%', maxWidth: '400px',
};
const page = {
  minHeight: '100vh', backgroundColor: 'var(--color-background)', display: 'flex',
  flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px',
};
const inputStyle = {
  width: '100%', padding: '12px 14px', border: '1.5px solid var(--color-gray-mid)',
  borderRadius: 'var(--radius-md)', fontSize: '15px', marginBottom: '12px', outline: 'none',
};

export default function Login() {
  const { needsMeta, user, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const connectFB = () => { window.location.href = `${API_URL}/auth/meta`; };

  const submit = async () => {
    if (!email || !password) return;
    setLoading(true); setError('');
    try {
      const r = await apiClient.post('/auth/login', { email: email.trim(), password });
      setAuthToken(r.data.token);
      const me = await refresh();          // actualiza el contexto (rol, metaConnected…)
      if (r.data.needsMeta || (me && !me.metaConnected)) {
        connectFB();                       // hay que conectar/refrescar Facebook
      }
      // si no, isAuthenticated pasa a true y PublicRoute redirige a /app
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  // Logueado en Alquimia pero falta conectar Facebook → paso 2.
  if (needsMeta) {
    return (
      <div style={page}>
        <div style={card}>
          <div className="logo-group" style={{ marginBottom: 24 }}>
            <span className="logo-text">alquimia.</span>
            <div className="logo-line" />
            <span className="logo-subtitle" style={{ marginTop: 6, fontSize: 12 }}>/ ads dashboard</span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
            Hola{user?.name ? `, ${user.name}` : ''}. Conectá tu cuenta de Facebook para acceder a las métricas de Meta.
          </p>
          <button onClick={connectFB} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '12px 20px', letterSpacing: '0.04em' }}>
            Conectar con Facebook →
          </button>
          <p style={{ marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
            Lo pedimos en cada ingreso para mantener tu acceso a Meta siempre vigente.
          </p>
        </div>
      </div>
    );
  }

  // Paso 1: login con Alquimia.
  return (
    <div style={page}>
      <div style={card}>
        <div className="logo-group" style={{ marginBottom: 28 }}>
          <span className="logo-text">alquimia.</span>
          <div className="logo-line" />
          <span className="logo-subtitle" style={{ marginTop: 6, fontSize: 12 }}>/ ads dashboard</span>
        </div>

        <input style={inputStyle} type="email" placeholder="Email" value={email} autoFocus
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        <input style={inputStyle} type="password" placeholder="Contraseña" value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />

        {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button onClick={submit} disabled={loading} className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '12px 20px', letterSpacing: '0.04em' }}>
          {loading ? 'Ingresando…' : 'Ingresar →'}
        </button>

        <p style={{ marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
          Acceso interno de Alquimia.
        </p>
      </div>

      <footer style={{ marginTop: 32, textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-muted)' }}>
          design by <span style={{ fontWeight: 700, color: 'var(--color-brand-blue)' }}>alquimia.</span>
        </p>
      </footer>
    </div>
  );
}
