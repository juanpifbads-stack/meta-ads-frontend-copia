import React, { useState } from 'react';
import apiClient from '../api/client.js';

// Tareas libres como "globos" (estilo onboarding). Check simple (hecho/pendiente),
// deadline opcional (cae en el calendario). Cualquiera con la clave puede agregar.
function fmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }); } catch { return ''; }
}

// Agregar un evento/reunión al calendario (título + fecha).
export function AddCalendarEvent({ slug, accessKey, reload }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const add = () => {
    if (!title.trim() || !date) return;
    apiClient.post(`/tasks/${slug}`, { key: accessKey, title: title.trim(), deadline: date, kind: 'evento' })
      .then(() => { setTitle(''); setDate(''); setOpen(false); reload(); }).catch(() => {});
  };
  if (!open) {
    return <button onClick={() => setOpen(true)} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px dashed #15161a', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>+ Agregar al calendario</button>;
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input autoFocus placeholder="Evento / reunión" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
        style={{ flex: 1, minWidth: 180, padding: '8px 10px', border: '1px solid #d8d6cf', borderRadius: 8 }} />
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
        style={{ padding: '8px 10px', border: '1px solid #d8d6cf', borderRadius: 8 }} />
      <button onClick={add} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--color-brand-blue,#2c4cff)', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>Agregar</button>
      <button onClick={() => { setOpen(false); setTitle(''); setDate(''); }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #d8d6cf', background: 'transparent', cursor: 'pointer' }}>Cancelar</button>
    </div>
  );
}

export default function PortalTasks({ slug, accessKey, tasks, reload }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [showDone, setShowDone] = useState(false); // pop-up de tareas completadas
  const free = (tasks || []).filter((t) => t.kind !== 'evento'); // los eventos van solo al calendario
  // Las completadas se archivan: salen de la lista principal y se ven en el pop-up.
  const pending = free.filter((t) => t.status !== 'terminada');
  const done = free.filter((t) => t.status === 'terminada');

  const toggle = (t) => {
    const next = t.status === 'terminada' ? 'sin_empezar' : 'terminada';
    apiClient.patch(`/tasks/${slug}/${t.id}`, { key: accessKey, status: next }).then(reload).catch(() => {});
  };
  const remove = (t) => {
    if (!window.confirm(`¿Eliminar la tarea "${t.title}"?`)) return;
    apiClient.delete(`/tasks/${slug}/${t.id}`, { params: { key: accessKey } }).then(reload).catch(() => {});
  };
  const add = () => {
    if (!title.trim()) return;
    apiClient.post(`/tasks/${slug}`, { key: accessKey, title: title.trim(), deadline: deadline || null })
      .then(() => { setTitle(''); setDeadline(''); setAdding(false); reload(); }).catch(() => {});
  };

  return (
    <>
      {pending.map((t) => (
        <div key={t.id} className="ob-deliv-card" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => toggle(t)} title="Tocar para marcar como hecha">
          <span className="ob-deliv-icon">📋</span>
          <span className="ob-deliv-name">{t.title}</span>
          <span className="ob-deliv-status">{t.deadline ? `🗓 ${fmtDate(t.deadline)} · ` : ''}Pendiente</span>
          <span onClick={(e) => { e.stopPropagation(); remove(t); }} title="Eliminar" style={{ position: 'absolute', top: 6, right: 10, color: '#b91c1c', fontSize: 16, lineHeight: 1 }}>×</span>
        </div>
      ))}

      {done.length > 0 && (
        <button onClick={() => setShowDone(true)} style={{ alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 8, border: '1px solid #d8d6cf', background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#6b6b6b' }}>
          ✅ Ver tareas completadas ({done.length})
        </button>
      )}

      {showDone && (
        <div onClick={() => setShowDone(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', maxWidth: 520, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>Tareas completadas</h3>
              <span onClick={() => setShowDone(false)} style={{ cursor: 'pointer', fontSize: 20, lineHeight: 1, color: '#6b6b6b' }}>×</span>
            </div>
            {done.length === 0 ? (
              <p style={{ color: '#6b6b6b', fontSize: 13 }}>Todavía no hay tareas completadas.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {done.map((t) => (
                  <div key={t.id} className="ob-deliv-card ob-deliv-card--done" style={{ position: 'relative' }}>
                    <span className="ob-deliv-icon">✅</span>
                    <span className="ob-deliv-name">{t.title}</span>
                    <span className="ob-deliv-status">{t.deadline ? `🗓 ${fmtDate(t.deadline)} · ` : ''}✓ Hecho</span>
                    <span onClick={() => toggle(t)} title="Reabrir tarea" style={{ position: 'absolute', top: 6, right: 34, cursor: 'pointer', fontSize: 13, color: '#2c4cff' }}>↩</span>
                    <span onClick={() => remove(t)} title="Eliminar" style={{ position: 'absolute', top: 6, right: 10, cursor: 'pointer', color: '#b91c1c', fontSize: 16, lineHeight: 1 }}>×</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {adding ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0' }}>
          <input autoFocus placeholder="Título de la tarea" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
            style={{ flex: 1, minWidth: 180, padding: '8px 10px', border: '1px solid #d8d6cf', borderRadius: 8 }} />
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} title="Fecha límite (opcional) → aparece en el calendario"
            style={{ padding: '8px 10px', border: '1px solid #d8d6cf', borderRadius: 8 }} />
          <button onClick={add} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--color-brand-blue,#2c4cff)', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>Agregar</button>
          <button onClick={() => { setAdding(false); setTitle(''); setDeadline(''); }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #d8d6cf', background: 'transparent', cursor: 'pointer' }}>Cancelar</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 8, border: '1.5px dashed #15161a', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>+ Agregar tarea</button>
      )}
    </>
  );
}
