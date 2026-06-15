import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Analyze from './Analyze.jsx';
import MediaPlan from './MediaPlan.jsx';
import Admin from './Admin.jsx';
import Dashboard from './Dashboard.jsx';
import './Control.css';
import './ClientHub.css';

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}
function daysElapsed() { return new Date().getDate(); }
function daysInMonth() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate(); }
function currentYM() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; }

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function fmtMonthYM(ym) { if (!ym) return ''; const [y, m] = ym.split('-'); return `${MESES[parseInt(m, 10) - 1] || ym} ${y}`; }

// Landing del Plan de medios: ver el vigente, ver anteriores, o crear/editar.
function MediaPlanHub({ slug, onBack }) {
  const [months, setMonths] = useState(null);
  const [editing, setEditing] = useState(null);
  useEffect(() => {
    apiClient.get(`/admin/${slug}/media-months`).then((r) => setMonths(r.data.months || [])).catch(() => setMonths([]));
  }, [slug]);

  if (editing) return <MediaPlan lockedSlug={slug} initialMonth={editing} onBack={() => setEditing(null)} />;

  const cur = currentYM();
  const list = months || [];
  const hasCurrent = list.includes(cur);
  const prev = list.filter((m) => m !== cur).sort().reverse();

  return (
    <div className="ctrl-page">
      <div className="hub-head">
        <div className="hub-cross"><span className="hub-cross-alq">Plan de medios</span></div>
        <button className="ctrl-btn ctrl-btn--ghost" onClick={onBack}>← Volver</button>
      </div>
      <div className="ctrl-divider" />

      <div className="mph-wrap">
        <div className="mph-block">
          <div className="hub-goals-title hub-goals-title--dark">Plan vigente · {fmtMonthYM(cur)}</div>
          {hasCurrent
            ? <button className="hub-op-btn" onClick={() => setEditing(cur)}>Ver / editar plan vigente</button>
            : <p className="ad-muted">Todavía no hay un plan de medios para este mes.</p>}
        </div>

        <div className="mph-block">
          <button className="ctrl-btn" onClick={() => setEditing(cur)}>+ Crear plan de medios</button>
        </div>

        <div className="mph-block">
          <div className="hub-goals-title hub-goals-title--dark">Planes anteriores</div>
          {months === null ? <p className="ad-muted">Cargando…</p>
            : prev.length === 0 ? <p className="ad-muted">Todavía no hay planes anteriores.</p>
            : <div className="mph-prev">{prev.map((m) => <button key={m} className="ctrl-btn ctrl-btn--ghost" onClick={() => setEditing(m)}>{fmtMonthYM(m)}</button>)}</div>}
        </div>
      </div>
    </div>
  );
}

export default function ClientHub({ slug, onBack }) {
  const { user } = useAuth();
  const isPaid = !!user && user.role === 'paid' && !user.legacy;
  const [cfg, setCfg] = useState(null);
  const [health, setHealth] = useState(null);
  const [goals, setGoals] = useState({ revenue: '', roas: '' });
  const [planObjective, setPlanObjective] = useState(null); // objetivo del plan de medios del mes actual
  const [tab, setTab] = useState('resumen');
  const [msg, setMsg] = useState('');

  const accountId = cfg?.metaAccountId || null;

  const load = useCallback(() => {
    apiClient.get(`/admin/clients/${slug}/config`).then((r) => {
      const c = r.data.config || {};
      setCfg(c);
      setGoals({ revenue: c.goals?.revenue ?? '', roas: c.goals?.roas ?? '' });
      if (c.metaAccountId) {
        apiClient.get(`/accounts/${String(c.metaAccountId).replace('act_', '')}/insights/monthly`)
          .then((ri) => setHealth(ri.data)).catch(() => setHealth(null));
      }
    }).catch(() => {});
    apiClient.get(`/admin/${slug}/media/${currentYM()}`)
      .then((r) => { const o = r.data.plan?.objective; setPlanObjective(o && (o.facturacion || o.roas) ? o : null); })
      .catch(() => setPlanObjective(null));
  }, [slug]);

  useEffect(() => { load(); }, [load]);
  // Al volver a "Resumen" (ej. después de guardar el plan), refrescar metas/datos.
  useEffect(() => { if (tab === 'resumen') load(); }, [tab, load]);

  const saveGoals = () => {
    setMsg('Guardando…');
    apiClient.put(`/admin/${slug}/goals`, { revenue: parseFloat(goals.revenue) || 0, roas: parseFloat(goals.roas) || 0 })
      .then(() => { setMsg('✓ Metas guardadas'); setTimeout(() => setMsg(''), 2000); })
      .catch(() => setMsg('Error'));
  };

  // Procesos a pantalla completa (con su propio header + volver al resumen)
  if (tab === 'analizar') return <Analyze lockedAccount={accountId} onBack={() => setTab('resumen')} />;
  if (tab === 'media') return <MediaPlanHub slug={slug} onBack={() => setTab('resumen')} />;
  if (tab === 'config') return <Admin lockedSlug={slug} onBack={() => setTab('resumen')} />;
  if (tab === 'optimizar') return <Dashboard initialAccount={accountId} lockedAccount={accountId} onBack={() => setTab('resumen')} />;

  const name = cfg?.name || slug;
  const spend = health?.spend || 0;
  const purchaseValue = health?.purchaseValue || 0;
  const roas = health?.roas || (spend > 0 ? purchaseValue / spend : 0);
  const revGoal = planObjective ? (planObjective.facturacion || 0) : (parseFloat(goals.revenue) || 0);
  const roasGoal = planObjective ? (planObjective.roas || 0) : (parseFloat(goals.roas) || 0);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const portalLink = `${origin}/cliente/${slug}`;
  const now = new Date();
  const monthLabel = `${MESES[now.getMonth()]} ${now.getFullYear()}`;
  const openPortal = () => window.open(portalLink, '_blank', 'noopener');

  return (
    <div className="ctrl-page">
      {/* Header: alquimia × cliente */}
      <div className="hub-head">
        <div className="hub-cross">
          <span className="hub-cross-alq">alquimia.</span>
          <span className="hub-cross-x">×</span>
          <span className="hub-cross-client">{name}</span>
        </div>
        <button className="ctrl-btn ctrl-btn--ghost" onClick={onBack}>← Inicio</button>
      </div>

      {/* Botones de configuración (arriba) */}
      <div className="hub-config-row">
        <button className="ctrl-btn ctrl-btn--ghost" onClick={() => setTab('config')}>⚙ Configuración del cliente</button>
        <button className="ctrl-btn ctrl-btn--ghost" onClick={() => setTab('portal')}>🔗 Portal del cliente</button>
      </div>

      <div className="ctrl-divider" />

      {tab === 'resumen' && (
        <div className="hub-resumen">
          {!accountId && <div className="ctrl-error">Este cliente no tiene cuenta de Meta asignada. Asignala en ⚙ Configuración del cliente.</div>}

          <div className="hub-month">{monthLabel}</div>

          {/* Objetivo (arriba) */}
          <div className="hub-goals-card">
            <div className="hub-goals-title hub-goals-title--dark">Objetivo</div>
            {planObjective ? (
              <div className="hub-metrics">
                <div className="hub-metric"><div className="hub-metric-lbl">Meta facturación</div><div className="hub-metric-val">{fmtMoney(revGoal)}</div></div>
                <div className="hub-metric"><div className="hub-metric-lbl">Meta ROAS</div><div className="hub-metric-val">{roasGoal ? roasGoal + '×' : '—'}</div></div>
              </div>
            ) : (
              <div className="hub-goals-row">
                <div className="ad-field"><label>Meta facturación (ARS)</label><input type="number" value={goals.revenue} placeholder="ej. 5000000" onChange={(e) => setGoals((g) => ({ ...g, revenue: e.target.value }))} /></div>
                <div className="ad-field"><label>Meta ROAS (×)</label><input type="number" step="0.1" value={goals.roas} placeholder="ej. 3.5" onChange={(e) => setGoals((g) => ({ ...g, roas: e.target.value }))} /></div>
                <button className="ctrl-btn" onClick={saveGoals}>Guardar metas</button>
                {msg && <span className="ad-msg">{msg}</span>}
              </div>
            )}
          </div>

          {/* Lo real (abajo) */}
          <div className="hub-metrics">
            <div className="hub-metric"><div className="hub-metric-lbl">Gasto del mes</div><div className="hub-metric-val">{fmtMoney(spend)}</div></div>
            <div className="hub-metric"><div className="hub-metric-lbl">Valor de compras</div><div className="hub-metric-val">{purchaseValue ? fmtMoney(purchaseValue) : '—'}</div></div>
            <div className="hub-metric"><div className="hub-metric-lbl">ROAS</div><div className="hub-metric-val">{roas > 0 ? roas.toFixed(2) + '×' : '—'}</div></div>
          </div>

          <div className="hub-quick">
            <button className="hub-op-btn" onClick={() => setTab('media')}>Plan de medios</button>
            <button className="hub-op-btn" onClick={() => setTab('analizar')}>Analizar cuenta</button>
            <button className="hub-op-btn" onClick={() => setTab('optimizar')}>Optimizar cuenta</button>
            <button className="hub-op-btn" onClick={openPortal}>Panel del cliente</button>
          </div>
        </div>
      )}

      {tab === 'portal' && (
        <div className="hub-portal">
          <div className="hub-portal-card">
            <div className="hub-portal-lbl">Panel completo (cliente)</div>
            <div className="hub-portal-link">{portalLink}</div>
            <div className="hub-portal-key">Clave: <strong>{cfg?.accessKey || '—'}</strong></div>
            <div className="hub-portal-actions">
              <a className="ctrl-btn" href={portalLink} target="_blank" rel="noreferrer">Abrir panel</a>
              <button className="ctrl-btn ctrl-btn--ghost" onClick={() => navigator.clipboard?.writeText(portalLink)}>Copiar link</button>
            </div>
          </div>
          {!isPaid && (
            <div className="hub-portal-card">
              <div className="hub-portal-lbl">Solo pagos (administración)</div>
              <div className="hub-portal-link">{portalLink}/pagos</div>
              <div className="hub-portal-key">Clave: <strong>{cfg?.paymentsKey || '—'}</strong></div>
              <div className="hub-portal-actions">
                <a className="ctrl-btn ctrl-btn--ghost" href={`${portalLink}/pagos`} target="_blank" rel="noreferrer">Abrir pagos</a>
                <button className="ctrl-btn ctrl-btn--ghost" onClick={() => navigator.clipboard?.writeText(`${portalLink}/pagos`)}>Copiar link</button>
              </div>
            </div>
          )}
          <p className="ad-muted" style={{ marginTop: 4 }}>Acá vas a poder configurar también qué secciones ve el cliente (próximamente).</p>
        </div>
      )}
    </div>
  );
}
