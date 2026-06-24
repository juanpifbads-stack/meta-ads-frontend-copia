import React, { useState, useEffect } from 'react';
import apiClient from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import FinancePanel from '../components/FinancePanel.jsx';
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
  const [clients, setClients] = useState([]);
  const [nu, setNu] = useState({ email: '', name: '', role: 'paid', password: '' });
  const [msg, setMsg] = useState('');
  const [assignOpen, setAssignOpen] = useState(null); // id del usuario con el panel de clientes abierto

  const load = () => apiClient.get('/admin/users').then((r) => setUsers(r.data.users || [])).catch(() => setUsers([]));
  useEffect(() => { load(); }, []);
  useEffect(() => { apiClient.get('/admin/clients').then((r) => setClients(r.data.clients || [])).catch(() => {}); }, []);

  const toggleAssign = (u, slug) => {
    const cur = new Set(u.assigned_slugs || []);
    cur.has(slug) ? cur.delete(slug) : cur.add(slug);
    const next = [...cur];
    apiClient.put(`/admin/users/${u.id}`, { assigned_slugs: next })
      .then(() => { setUsers((list) => list.map((x) => x.id === u.id ? { ...x, assigned_slugs: next } : x)); })
      .catch(() => setMsg('Error al asignar'));
  };

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
  const removeUser = (u) => {
    if (!window.confirm(`¿Eliminar definitivamente a ${u.name} (${u.email})? Esta acción no se puede deshacer.`)) return;
    apiClient.delete(`/admin/users/${u.id}`).then(load).catch((e) => setMsg(e.response?.data?.message || 'Error al eliminar'));
  };

  return (
    <div className="ad-section">
      <h3 className="ad-section-title">Usuarios internos</h3>
      <p className="ad-muted" style={{ margin: '0 0 12px' }}>Usuarios de Alquimia. <strong>admin</strong> ve todo; <strong>paid</strong> (cuando esté el enforcement) verá solo sus clientes y sin datos sensibles.</p>

      {users === null ? <p className="ad-muted">Cargando…</p> : (
        <div style={{ marginBottom: 16 }}>
          {users.map((u) => (
            <div key={u.id} style={{ borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 8 }}>
              <div className="ad-row" style={{ alignItems: 'center', opacity: u.active ? 1 : 0.5 }}>
                <div className="ad-field ad-field--grow"><label>{u.name}{u.active ? '' : ' · inactivo'}</label><input readOnly value={u.email} style={{ padding: '6px 8px', fontSize: 13 }} /></div>
                <div className="ad-field">
                  <label>Rol</label>
                  <select value={u.role} onChange={(e) => setRole(u, e.target.value)}>
                    <option value="paid">Paid</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {u.role === 'paid' && <button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => setAssignOpen(assignOpen === u.id ? null : u.id)}>Clientes ({(u.assigned_slugs || []).length})</button>}
                <button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => changePass(u)}>Cambiar contraseña</button>
                <button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => toggleActive(u)}>{u.active ? 'Desactivar' : 'Activar'}</button>
                <button className="ad-btn ad-btn--ghost ad-btn--sm" style={{ color: '#b91c1c', borderColor: '#fecaca' }} onClick={() => removeUser(u)}>Eliminar</button>
              </div>
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#64748b', padding: '2px 2px 0' }}>
                {u.meta
                  ? <>📘 Facebook vinculado: <strong style={{ color: '#15161a' }}>{u.meta.name || u.meta.email || '—'}</strong>{' '}
                      {u.meta.fresh
                        ? <span style={{ color: '#15803d' }}>· token vigente{u.meta.expiresAt ? ` (hasta ${new Date(u.meta.expiresAt).toLocaleDateString('es-AR')})` : ''}</span>
                        : <span style={{ color: '#b91c1c' }}>· token vencido (debe reconectar)</span>}
                      {u.meta.fresh && u.meta.adsRead === false && (
                        <span style={{ color: '#b91c1c' }}> · ⚠️ SIN permiso de anuncios (debe reconectar y aceptar todos los permisos)</span>
                      )}
                    </>
                  : <span style={{ color: '#94a3b8' }}>📘 Sin Facebook vinculado todavía</span>}
              </div>
              {u.role === 'paid' && assignOpen === u.id && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '6px 2px 2px' }}>
                  {clients.map((c) => (
                    <label key={c.slug} className="ad-cap" style={{ fontSize: 13 }}>
                      <input type="checkbox" checked={(u.assigned_slugs || []).includes(c.slug)} onChange={() => toggleAssign(u, c.slug)} />
                      <span>{c.name}</span>
                    </label>
                  ))}
                  {!clients.length && <span className="ad-muted">No hay clientes.</span>}
                </div>
              )}
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
  const { user } = useAuth();
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

      {/* Finanzas de la agencia — SOLO socios. */}
      {user?.isSocio && <FinancePanel />}
    </div>
  );
}
