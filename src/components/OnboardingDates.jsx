import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client.js';

// Fechas / calendario dentro del panel del cliente. Timeline de hitos y
// entregables (del store de onboarding). Se muestra solo si el toggle
// mostrarFechas está prendido y hay algo cargado.

const cardStyle = { border: '0.5px solid var(--color-gray-mid, #e3e1d8)', borderRadius: 10, padding: '10px 14px', background: 'var(--color-white,#fff)' };

function fmtWhen(when) {
  if (!when) return '';
  if (when.date) return new Date(when.date + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
  if (when.fromWeek) return `Semana ${when.fromWeek}${when.toWeek && when.toWeek !== when.fromWeek ? `–${when.toWeek}` : ''}`;
  return '';
}

export default function OnboardingDates({ slug, accessKey }) {
  const [ob, setOb] = useState(null);
  const load = useCallback(() => {
    apiClient.get(`/onboarding/${slug}`, { params: { key: accessKey } }).then((r) => setOb(r.data)).catch(() => setOb(null));
  }, [slug, accessKey]);
  useEffect(() => { load(); }, [load]);
  if (!ob) return null;

  const items = (ob.roadmap || []).slice().sort((a, b) => {
    const ka = (a.when && a.when.date) || 'zzzz'; const kb = (b.when && b.when.date) || 'zzzz'; return ka.localeCompare(kb);
  });
  const meeting = ob.meeting1;
  if (!items.length && !(meeting && meeting.date)) return null;

  const setStatus = (it, next) => {
    if (!it.id) return;
    apiClient.patch(`/onboarding/${slug}`, { roadmapStatuses: { [it.id]: next } }, { params: { key: accessKey } }).then(load).catch(() => {});
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {meeting && meeting.date && (
        <div style={{ ...cardStyle, borderLeft: '3px solid var(--color-brand-blue, #2c4cff)' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>🗓 {new Date(meeting.date + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}{meeting.time ? ` · ${meeting.time}` : ''}</div>
          <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>Reunión de arranque</div>
          {meeting.objective && <div style={{ fontSize: 13, color: '#64748b' }}>{meeting.objective}</div>}
        </div>
      )}
      {items.map((it, i) => (
        <div key={it.id || i} style={{ ...cardStyle, opacity: it.status === 'hecho' ? 0.7 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#64748b', background: 'var(--color-background,#f3f2ec)', padding: '2px 8px', borderRadius: 6 }}>{it.kind === 'task' ? 'Entregable' : 'Hito'}</span>
            {fmtWhen(it.when) && <span style={{ fontSize: 12, color: '#64748b' }}>🗓 {fmtWhen(it.when)}</span>}
            <select value={it.status || 'pendiente'} onChange={(e) => setStatus(it, e.target.value)} style={{ marginLeft: 'auto', fontSize: 12, padding: '3px 6px', border: '1px solid var(--color-gray-mid,#d8d6cf)', borderRadius: 6 }}>
              <option value="pendiente">Pendiente</option>
              <option value="en_curso">En curso</option>
              <option value="hecho">Finalizado</option>
            </select>
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4, textDecoration: it.status === 'hecho' ? 'line-through' : 'none' }}>{it.title}</div>
          {it.detail && <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{it.detail}</div>}
        </div>
      ))}
    </div>
  );
}
