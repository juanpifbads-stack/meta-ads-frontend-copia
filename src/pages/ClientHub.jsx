import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client.js';
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

const TABS = [
  { k: 'resumen', l: 'Resumen' },
  { k: 'media', l: 'Plan de medios' },
  { k: 'analizar', l: 'Analizar cuenta' },
  { k: 'portal', l: 'Portal del cliente' },
  { k: 'admin', l: 'Admin' },
  { k: 'optimizar', l: '⚡ Optimizar' },
];

export default function ClientHub({ slug, onBack }) {
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
  if (tab === 'media') return <MediaPlan lockedSlug={slug} onBack={() => setTab('resumen')} />;
  if (tab === 'admin') return <Admin lockedSlug={slug} onBack={() => setTab('resumen')} />;
  if (tab === 'optimizar') return <Dashboard initialAccount={accountId} onBack={() => setTab('resumen')} />;

  const name = cfg?.name || slug;
  const spend = health?.spend || 0;
  const purchaseValue = health?.purchaseValue || 0;
  const roas = health?.roas || (spend > 0 ? purchaseValue / spend : 0);
  const revGoal = planObjective ? (planObjective.facturacion || 0) : (parseFloat(goals.revenue) || 0);
  const roasGoal = planObjective ? (planObjective.roas || 0) : (parseFloat(goals.roas) || 0);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const portalLink = `${origin}/cliente/${slug}`;

  return (
    <div className="ctrl-page">
      <div className="ctrl-header">
        <div className="ctrl-header-top">
          <div>
            <div className="ctrl-brand">alquimia.</div>
            <div className="ctrl-eyebrow">Cliente · {cfg?.am || '—'}</div>
            <h1 className="ctrl-title">{name}</h1>
          </div>
          <div className="ctrl-header-actions">
            <button className="ctrl-btn ctrl-btn--ghost" onClick={onBack}>← Inicio</button>
          </div>
        </div>

        <div className="hub-tabs">
          {TABS.map((t) => (
            <button key={t.k} className={`hub-tab ${tab === t.k ? 'hub-tab--active' : ''}`} onClick={() => setTab(t.k)}>{t.l}</button>
          ))}
        </div>
      </div>

      <div className="ctrl-divider" />

      {tab === 'resumen' && (
        <div className="hub-resumen">
          {!accountId && <div className="ctrl-error">Este cliente no tiene cuenta de Meta asignada. Asignala en la pestaña Admin → Config del cliente.</div>}
          <div className="hub-metrics">
            <div className="hub-metric"><div className="hub-metric-lbl">Gasto del mes</div><div className="hub-metric-val">{fmtMoney(spend)}</div></div>
            <div className="hub-metric"><div className="hub-metric-lbl">Valor de compras</div><div className="hub-metric-val">{purchaseValue ? fmtMoney(purchaseValue) : '—'}</div></div>
            <div className="hub-metric"><div className="hub-metric-lbl">ROAS</div><div className="hub-metric-val">{roas > 0 ? roas.toFixed(2) + '×' : '—'}</div></div>
          </div>

          <div className="hub-goals-card">
            <div className="hub-goals-title">Metas del mes</div>
            {planObjective ? (
              <>
                <div className="hub-metrics">
                  <div className="hub-metric"><div className="hub-metric-lbl">Meta facturación</div><div className="hub-metric-val">{fmtMoney(revGoal)}</div></div>
                  <div className="hub-metric"><div className="hub-metric-lbl">Meta ROAS</div><div className="hub-metric-val">{roasGoal ? roasGoal + '×' : '—'}</div></div>
                </div>
                <div className="hub-goals-note">
                  <span className="ad-muted">Viene del Plan de medios de este mes.</span>
                  <button className="ctrl-btn ctrl-btn--ghost ctrl-btn--sm" onClick={() => setTab('media')}>Editar en Plan de medios →</button>
                </div>
              </>
            ) : (
              <div className="hub-goals-row">
                <div className="ad-field"><label>Meta facturación (ARS)</label><input type="number" value={goals.revenue} placeholder="ej. 5000000" onChange={(e) => setGoals((g) => ({ ...g, revenue: e.target.value }))} /></div>
                <div className="ad-field"><label>Meta ROAS (×)</label><input type="number" step="0.1" value={goals.roas} placeholder="ej. 3.5" onChange={(e) => setGoals((g) => ({ ...g, roas: e.target.value }))} /></div>
                <button className="ctrl-btn" onClick={saveGoals}>Guardar metas</button>
                {msg && <span className="ad-msg">{msg}</span>}
                <span className="ad-muted" style={{ flexBasis: '100%' }}>Tip: si cargás el objetivo en el Plan de medios, la meta se completa sola.</span>
              </div>
            )}
            {(revGoal > 0 || roasGoal > 0) && (
              <div className="hub-progress">
                {revGoal > 0 && <div className="hub-prog-row"><span>Facturación</span><strong>{Math.min((purchaseValue / revGoal) * 100, 999).toFixed(0)}%</strong></div>}
                {roasGoal > 0 && <div className="hub-prog-row"><span>ROAS</span><strong>{Math.min((roas / roasGoal) * 100, 999).toFixed(0)}%</strong></div>}
              </div>
            )}
          </div>

          <div className="hub-quick">
            <button className="hub-quick-btn" onClick={() => setTab('media')}>📄 Plan de medios</button>
            <button className="hub-quick-btn" onClick={() => setTab('analizar')}>🔎 Analizar cuenta</button>
            <button className="hub-quick-btn" onClick={() => setTab('optimizar')}>⚡ Optimizar esta cuenta</button>
            <button className="hub-quick-btn" onClick={() => setTab('admin')}>⚙ Admin del cliente</button>
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
          <div className="hub-portal-card">
            <div className="hub-portal-lbl">Solo pagos (administración)</div>
            <div className="hub-portal-link">{portalLink}/pagos</div>
            <div className="hub-portal-key">Clave: <strong>{cfg?.paymentsKey || '—'}</strong></div>
            <div className="hub-portal-actions">
              <a className="ctrl-btn ctrl-btn--ghost" href={`${portalLink}/pagos`} target="_blank" rel="noreferrer">Abrir pagos</a>
              <button className="ctrl-btn ctrl-btn--ghost" onClick={() => navigator.clipboard?.writeText(`${portalLink}/pagos`)}>Copiar link</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
