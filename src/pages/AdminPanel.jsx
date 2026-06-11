import React, { useState, useEffect } from 'react';
import apiClient from '../api/client.js';
import './Admin.css';

/* Campo simple reutilizable */
function F({ label, value, onChange, type = 'text' }) {
  return (
    <div className="ad-field ad-field--grow">
      <label>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: '8px 10px' }} />
    </div>
  );
}

/* ── Usuarios internos ── */
function UsersSection() {
  const [users, setUsers] = useState(null);
  const [nu, setNu] = useState({ email: '', name: '', role: 'paid', password: '' });
  const [msg, setMsg] = useState('');

  const load = () => apiClient.get('/admin/users').then((r) => setUsers(r.data.users || [])).catch(() => setUsers([]));
  useEffect(() => { load(); }, []);

  const create = () => {
    if (!nu.email || !nu.name || nu.password.length < 6) { setMsg('Completá email, nombre y contraseña de 6+ caracteres'); return; }
    setMsg('Creando…');
    apiClient.post('/admin/users', nu)
      .then(() => { setNu({ email: '', name: '', role: 'paid', password: '' }); setMsg('✓ Usuario creado'); load(); setTimeout(() => setMsg(''), 2000); })
      .catch((e) => setMsg(e.response?.data?.message || 'Error al crear'));
  };
  const changePass = (u) => {
    const p = window.prompt(`Nueva contraseña para ${u.name} (mín. 6):`);
    if (!p) return;
    if (p.length < 6) { setMsg('Mínimo 6 caracteres'); return; }
    apiClient.put(`/admin/users/${u.id}`, { password: p }).then(() => { setMsg(`✓ Contraseña de ${u.name} actualizada`); setTimeout(() => setMsg(''), 2500); }).catch(() => setMsg('Error'));
  };
  const toggleActive = (u) => apiClient.put(`/admin/users/${u.id}`, { active: !u.active }).then(load).catch(() => {});
  const setRole = (u, role) => apiClient.put(`/admin/users/${u.id}`, { role }).then(load).catch(() => {});

  return (
    <div className="ad-section">
      <h3 className="ad-section-title">Usuarios internos</h3>
      <p className="ad-muted" style={{ margin: '0 0 12px' }}>Usuarios de Alquimia. <strong>admin</strong> ve todo; <strong>paid</strong> (cuando esté el enforcement) verá solo sus clientes y sin datos sensibles.</p>

      {users === null ? <p className="ad-muted">Cargando…</p> : (
        <div style={{ marginBottom: 16 }}>
          {users.map((u) => (
            <div key={u.id} className="ad-row" style={{ alignItems: 'center', opacity: u.active ? 1 : 0.5 }}>
              <div className="ad-field ad-field--grow"><label>{u.name}{u.active ? '' : ' · inactivo'}</label><input readOnly value={u.email} style={{ padding: '6px 8px', fontSize: 13 }} /></div>
              <div className="ad-field">
                <label>Rol</label>
                <select value={u.role} onChange={(e) => setRole(u, e.target.value)}>
                  <option value="paid">Paid</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => changePass(u)}>Cambiar contraseña</button>
              <button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => toggleActive(u)}>{u.active ? 'Desactivar' : 'Activar'}</button>
            </div>
          ))}
        </div>
      )}

      <div className="ad-sublabel">Crear usuario</div>
      <div className="ad-row">
        <F label="Email" value={nu.email} onChange={(v) => setNu((s) => ({ ...s, email: v }))} type="email" />
        <F label="Nombre" value={nu.name} onChange={(v) => setNu((s) => ({ ...s, name: v }))} />
        <div className="ad-field">
          <label>Rol</label>
          <select value={nu.role} onChange={(e) => setNu((s) => ({ ...s, role: e.target.value }))}>
            <option value="paid">Paid</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <F label="Contraseña temporal" value={nu.password} onChange={(v) => setNu((s) => ({ ...s, password: v }))} />
      </div>
      <div className="ad-row" style={{ justifyContent: 'flex-end' }}>
        {msg && <span className="ad-msg">{msg}</span>}
        <button className="ad-btn" onClick={create}>Crear usuario</button>
      </div>
    </div>
  );
}

export default function AdminPanel({ onBack }) {
  return (
    <div className="ad-page">
      <header className="ad-header">
        <div>
          <div className="ad-brand">alquimia.</div>
          <div className="ad-eyebrow">Panel de administrador</div>
        </div>
        <button className="ad-btn ad-btn--ghost" onClick={onBack}>← Volver</button>
      </header>

      <UsersSection />

      {/* Próximamente: gestión de agencia (finanzas, fees, reparto) — solo admin. */}
      <div className="ad-section">
        <h3 className="ad-section-title">Gestión de agencia</h3>
        <p className="ad-muted">Próximamente: parte financiera (fees, reparto, etc.). Solo visible para administradores.</p>
      </div>
    </div>
  );
}
