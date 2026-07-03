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
  const free = (tasks || []).filter((t) => t.kind !== 'evento'); // los eventos van solo al calendario

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
      {free.map((t) => {
        const done = t.status === 'terminada';
        return (
          <div key={t.id} className={`ob-deliv-card ${done ? 'ob-deliv-card--done' : ''}`} style={{ position: 'relative', cursor: 'pointer' }} onClick={() => toggle(t)} title="Tocar para marcar como hecha">
            <span className="ob-deliv-icon">{done ? '✅' : '📋'}</span>
            <span className="ob-deliv-name">{t.title}</span>
            <span className="ob-deliv-status">{t.deadline ? `🗓 ${fmtDate(t.deadline)} · ` : ''}{done ? '✓ Hecho' : 'Pendiente'}</span>
            <span onClick={(e) => { e.stopPropagation(); remove(t); }} title="Eliminar" style={{ position: 'absolute', top: 6, right: 10, color: '#b91c1c', fontSize: 16, lineHeight: 1 }}>×</span>
          </div>
        );
      })}

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
