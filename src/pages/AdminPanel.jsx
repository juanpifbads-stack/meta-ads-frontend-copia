import React, { useState, useEffect } from 'react';
import apiClient from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import FinancePanel from '../components/FinancePanel.jsx';
import { NewClientForm } from './Admin.jsx';
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
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);

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
      .then(() => { setNu({ email: '', name: '', role: 'paid', password: '' }); setMsg('✓ Usuario creado'); setShowNew(false); load(); setTimeout(() => setMsg(''), 2000); })
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
      <h3 className="ad-section-title" onClick={() => setOpen((o) => !o)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▸</span>
        Usuarios internos {users && <span className="ad-muted" style={{ fontWeight: 400, fontSize: 13 }}>· {users.length}</span>}
      </h3>
      {open && <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="ad-btn" onClick={() => setShowNew((s) => !s)}>{showNew ? 'Cerrar' : '+ Agregar usuario'}</button>
      </div>
      {showNew && (
        <div className="ad-newuser">
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
            <button className="ad-btn ad-btn--ghost" onClick={() => { setShowNew(false); setMsg(''); }}>Cancelar</button>
            <button className="ad-btn" onClick={create}>Crear usuario</button>
          </div>
        </div>
      )}

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
                <button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => changePass(u)}>Cambiar contraseña</button>
                <button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => toggleActive(u)}>{u.active ? 'Desactivar' : 'Activar'}</button>
                <button className="ad-btn ad-btn--ghost ad-btn--sm" style={{ color: '#b91c1c', borderColor: '#fecaca' }} onClick={() => removeUser(u)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      </>}
    </div>
  );
}

// Lista de clientes: activar / marcar "no es cliente" / eliminar; y crear (mismo form que la Home).
function ClientsSection({ onOpenClient }) {
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const load = () => apiClient.get('/admin/clients?all=1').then((r) => setClients(r.data.clients || [])).catch(() => setClients([]));
  useEffect(() => { load(); }, []);
  const toggle = (c) => apiClient.put(`/admin/${c.slug}/active`, { active: !c.active })
    .then(() => setClients((cs) => cs.map((x) => x.slug === c.slug ? { ...x, active: !x.active } : x)))
    .catch(() => {});
  const remove = (c) => {
    if (!window.confirm(`¿Eliminar definitivamente a "${c.name}"? No se puede deshacer.`)) return;
    apiClient.delete(`/admin/${c.slug}`).then(() => setClients((cs) => cs.filter((x) => x.slug !== c.slug))).catch(() => {});
  };
  const activos = clients.filter((c) => c.active).length;
  return (
    <div className="ad-section">
      <h3 className="ad-section-title" onClick={() => setOpen((o) => !o)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▸</span>
        Clientes <span className="ad-muted" style={{ fontWeight: 400, fontSize: 13 }}>· {activos} activos de {clients.length}</span>
      </h3>
      {open && <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="ad-btn" onClick={() => setShowNew((s) => !s)}>{showNew ? 'Cerrar' : '+ Agregar cliente'}</button>
      </div>
      {showNew && <NewClientForm onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
      <p className="ad-muted">Los inactivos no aparecen en finanzas ni en el semáforo (no se borran). Eliminar es definitivo.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {clients.map((c) => (
          <div key={c.slug} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '0.5px solid #e3e1d8', borderRadius: 8, opacity: c.active ? 1 : 0.55 }}>
            <button onClick={() => onOpenClient && onOpenClient(c.slug)} title="Abrir cliente" style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-text-primary)', padding: 0 }}>{c.name} →</button>
            <button className="ad-btn ad-btn--ghost" onClick={() => toggle(c)} style={c.active ? {} : { color: '#b91c1c' }}>
              {c.active ? 'Activo' : 'No es cliente'}
            </button>
            <button className="ad-btn ad-btn--ghost" onClick={() => remove(c)} style={{ color: '#b91c1c' }} title="Eliminar definitivamente">Eliminar</button>
          </div>
        ))}
      </div>
      </>}
    </div>
  );
}

export default function AdminPanel({ onBack, onOpenClient }) {
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

      <ClientsSection onOpenClient={onOpenClient} />

      {/* Finanzas de la agencia — SOLO socios. */}
      {user?.isSocio && <FinancePanel />}
    </div>
  );
}
