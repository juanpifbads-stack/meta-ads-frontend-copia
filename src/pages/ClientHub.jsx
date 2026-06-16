import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Analyze from './Analyze.jsx';
import MediaPlan, { buildTrendSvg } from './MediaPlan.jsx';
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

// Vista del Plan de medios: documento del vigente (lectura) + crear / ver anteriores.
function mpRoas(v) { return v ? `${v}×` : '—'; }
function mpDate(d) { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${dd}/${m}`; }

function MediaPlanHub({ slug, onBack }) {
  const [months, setMonths] = useState(null);
  const [plan, setPlan] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showPrev, setShowPrev] = useState(false);
  const cur = currentYM();

  useEffect(() => {
    apiClient.get(`/admin/${slug}/media-months`).then((r) => setMonths(r.data.months || [])).catch(() => setMonths([]));
    apiClient.get(`/admin/${slug}/media/${cur}`).then((r) => setPlan(r.data.plan || null)).catch(() => setPlan(null));
  }, [slug, cur]);

  if (editing) return <MediaPlan lockedSlug={slug} initialMonth={editing} onBack={() => setEditing(null)} />;

  const list = months || [];
  const prev = list.filter((m) => m !== cur).sort().reverse();
  const inc = plan?.include || {};
  const obj = plan?.objective || {};
  const dateItems = (plan?.context?.dateItems || []).filter((it) => it.date || it.name);
  const cons = (plan?.considerations || []).filter((c) => (c || '').trim());
  const trendSvg = (plan && inc.trend !== false) ? buildTrendSvg(plan.trend || [], { staticLabels: true }) : '';

  return (
    <div className="ctrl-page">
      <div className="hub-head">
        <div className="hub-cross"><span className="hub-cross-alq">Plan de medios</span></div>
        <button className="ctrl-btn ctrl-btn--ghost" onClick={onBack}>← Volver</button>
      </div>

      <div className="hub-config-row">
        <button className="ctrl-btn" onClick={() => setEditing(cur)}>＋ Crear plan</button>
        <button className="ctrl-btn ctrl-btn--ghost" onClick={() => setEditing(cur)}>✎ Editar plan</button>
        <button className="ctrl-btn ctrl-btn--ghost" onClick={() => setShowPrev((v) => !v)}>🗂 Ver anteriores</button>
      </div>
      {showPrev && (
        <div className="mph-prev" style={{ marginBottom: 14 }}>
          {months === null ? <span className="ad-muted">Cargando…</span>
            : prev.length === 0 ? <span className="ad-muted">Todavía no hay planes anteriores.</span>
            : prev.map((m) => <button key={m} className="ctrl-btn ctrl-btn--ghost ctrl-btn--sm" onClick={() => setEditing(m)}>{fmtMonthYM(m)}</button>)}
        </div>
      )}

      <div className="ctrl-divider" />

      {/* Documento del plan vigente (lectura) */}
      {!plan ? (
        <div className="mpdoc">
          <p className="ad-muted">Todavía no hay un plan de medios para {fmtMonthYM(cur)}. Tocá “Crear / editar plan”.</p>
        </div>
      ) : (
        <div className="mpdoc">
          <div className="mpdoc-eyebrow">Plan de medios · {fmtMonthYM(cur)}</div>

          <div className="mpdoc-sec">
            <div className="mpdoc-h">Objetivo propuesto</div>
            <div className="mpdoc-kpis">
              <div className="mpdoc-kpi"><span>Facturación objetivo (en Meta)</span><strong>{fmtMoney(obj.facturacion)}</strong></div>
              <div className="mpdoc-kpi"><span>ROAS objetivo</span><strong>{mpRoas(obj.roas)}</strong></div>
              <div className="mpdoc-kpi"><span>Inversión necesaria</span><strong>{fmtMoney(obj.inversion)}</strong></div>
            </div>
          </div>

          {inc.lastMonth !== false && (
            <div className="mpdoc-sec">
              <div className="mpdoc-h">Cómo nos fue el mes pasado</div>
              <div className="mpdoc-kpis">
                <div className="mpdoc-kpi"><span>Facturación</span><strong>{fmtMoney(plan.lastMonthMeta?.facturacion)}</strong></div>
                <div className="mpdoc-kpi"><span>Inversión</span><strong>{fmtMoney(plan.lastMonthMeta?.inversion)}</strong></div>
                <div className="mpdoc-kpi"><span>ROAS</span><strong>{mpRoas(plan.lastMonthMeta?.roas)}</strong></div>
              </div>
            </div>
          )}

          {inc.lastYear !== false && (
            <div className="mpdoc-sec">
              <div className="mpdoc-h">Mismo período del año pasado</div>
              {(plan.lastYearMeta?.inversion || 0) > 0 ? (
                <div className="mpdoc-kpis">
                  <div className="mpdoc-kpi"><span>Facturación</span><strong>{fmtMoney(plan.lastYearMeta?.facturacion)}</strong></div>
                  <div className="mpdoc-kpi"><span>Inversión</span><strong>{fmtMoney(plan.lastYearMeta?.inversion)}</strong></div>
                  <div className="mpdoc-kpi"><span>ROAS</span><strong>{mpRoas(plan.lastYearMeta?.roas)}</strong></div>
                </div>
              ) : (
                <p className="mpdoc-txt">No se puede comparar con el mismo período del año pasado ya que no hubo inversión publicitaria.</p>
              )}
            </div>
          )}

          {inc.trend !== false && trendSvg && (
            <div className="mpdoc-sec">
              <div className="mpdoc-h">Tendencia (últimos 3 meses)</div>
              <div className="mpdoc-chart" dangerouslySetInnerHTML={{ __html: trendSvg }} />
              {plan.trendNote?.trim() && <p className="mpdoc-txt" style={{ marginTop: 8 }}>{plan.trendNote}</p>}
            </div>
          )}

          {inc.contextDates !== false && dateItems.length > 0 && (
            <div className="mpdoc-sec">
              <div className="mpdoc-h">Fechas importantes del mes</div>
              <ul className="mpdoc-list">
                {dateItems.map((it, i) => <li key={i}><strong>{mpDate(it.date)}{it.endDate ? ` al ${mpDate(it.endDate)}` : ''}</strong> — {it.name}</li>)}
              </ul>
            </div>
          )}

          {inc.contextProducts !== false && plan.context?.products?.trim() && (
            <div className="mpdoc-sec"><div className="mpdoc-h">Stock y reposición de productos clave</div><p className="mpdoc-txt">{plan.context.products}</p></div>
          )}

          {plan.objectiveJustification?.trim() && (
            <div className="mpdoc-sec"><div className="mpdoc-h">Justificación de objetivos</div><p className="mpdoc-txt">{plan.objectiveJustification}</p></div>
          )}
          {cons.length > 0 && (
            <div className="mpdoc-sec"><div className="mpdoc-h">Consideraciones y riesgos</div><ul className="mpdoc-list">{cons.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
          )}
          {plan.nextPlanning?.trim() && (
            <div className="mpdoc-sec"><div className="mpdoc-h">Planificación de próximos meses</div><p className="mpdoc-txt">{plan.nextPlanning}</p></div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClientHub({ slug, onBack }) {
  const { user } = useAuth();
  const isPaid = !!user && user.role === 'paid' && !user.legacy;
  const [cfg, setCfg] = useState(null);
  const [health, setHealth] = useState(null);
  const [goals, setGoals] = useState({ revenue: '', roas: '' });
  const [editGoals, setEditGoals] = useState(false);
  const [planObjective, setPlanObjective] = useState(null); // objetivo del plan de medios del mes actual
  const [tab, setTab] = useState('resumen');
  const [msg, setMsg] = useState('');

  const accountId = cfg?.metaAccountId || null;

  const load = useCallback(() => {
    apiClient.get(`/admin/clients/${slug}/config`).then((r) => {
      const c = r.data.config || {};
      setCfg(c);
      setGoals({ revenue: c.goals?.revenue ?? '', roas: c.goals?.roas ?? '' });
      // Una o varias cuentas: sumamos las métricas de todas.
      const ids = (c.metaAccountIds && c.metaAccountIds.length ? c.metaAccountIds : (c.metaAccountId ? [c.metaAccountId] : []))
        .map((a) => String(a).replace('act_', ''));
      if (ids.length) {
        // Ecommerce: ROAS/gasto/valor cuentan SOLO campañas de ventas (excluye mensajes/leads).
        const params = c.type === 'servicios' ? {} : { salesOnly: 1 };
        Promise.all(ids.map((id) => apiClient.get(`/accounts/${id}/insights/monthly`, { params }).then((ri) => ri.data).catch(() => null)))
          .then((rows) => {
            const valid = rows.filter(Boolean);
            if (!valid.length) { setHealth(null); return; }
            const spend = valid.reduce((s, x) => s + (x.spend || 0), 0);
            const purchaseValue = valid.reduce((s, x) => s + (x.purchaseValue || 0), 0);
            setHealth({ spend, purchaseValue, roas: spend > 0 ? purchaseValue / spend : 0 });
          });
      } else { setHealth(null); }
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
      .then(() => { setMsg('✓ Metas guardadas'); setEditGoals(false); setTimeout(() => setMsg(''), 2000); })
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

      {/* Botón de configuración (arriba) */}
      <div className="hub-config-row">
        <button className="ctrl-btn ctrl-btn--ghost" onClick={() => setTab('config')}>⚙ Configuración del cliente</button>
      </div>

      <div className="ctrl-divider" />

      {tab === 'resumen' && (
        <div className="hub-resumen">
          {!accountId && <div className="ctrl-error">Este cliente no tiene cuenta de Meta asignada. Asignala en ⚙ Configuración del cliente.</div>}

          <div className="hub-month">{monthLabel}</div>

          {/* Objetivo (arriba) */}
          <div className="hub-goals-card">
            <div className="hub-goals-title hub-goals-title--dark">Objetivo</div>
            {(revGoal > 0 || roasGoal > 0) && !editGoals ? (
              <>
                <div className="hub-metrics">
                  <div className="hub-metric"><div className="hub-metric-lbl">Meta facturación</div><div className="hub-metric-val">{fmtMoney(revGoal)}</div></div>
                  <div className="hub-metric"><div className="hub-metric-lbl">Meta ROAS</div><div className="hub-metric-val">{roasGoal ? roasGoal + '×' : '—'}</div></div>
                </div>
                {!planObjective && <button className="ctrl-btn ctrl-btn--ghost ctrl-btn--sm" style={{ marginTop: 12 }} onClick={() => setEditGoals(true)}>✎ Editar objetivo</button>}
              </>
            ) : (
              <div className="hub-goals-row">
                <div className="ad-field"><label>Meta facturación (ARS)</label><input type="number" value={goals.revenue} placeholder="ej. 5000000" onChange={(e) => setGoals((g) => ({ ...g, revenue: e.target.value }))} /></div>
                <div className="ad-field"><label>Meta ROAS (×)</label><input type="number" step="0.1" value={goals.roas} placeholder="ej. 3.5" onChange={(e) => setGoals((g) => ({ ...g, roas: e.target.value }))} /></div>
                <button className="ctrl-btn" onClick={saveGoals}>Guardar metas</button>
                {msg && <span className="ad-msg">{msg}</span>}
              </div>
            )}
          </div>

          {/* Actualidad (abajo) */}
          <div className="hub-goals-card">
            <div className="hub-goals-title hub-goals-title--dark">Actualidad</div>
            <div className="hub-metrics">
              <div className="hub-metric"><div className="hub-metric-lbl">Gasto del mes</div><div className="hub-metric-val">{fmtMoney(spend)}</div></div>
              <div className="hub-metric"><div className="hub-metric-lbl">Valor de compras</div><div className="hub-metric-val">{purchaseValue ? fmtMoney(purchaseValue) : '—'}</div></div>
              <div className="hub-metric"><div className="hub-metric-lbl">ROAS</div><div className="hub-metric-val">{roas > 0 ? roas.toFixed(2) + '×' : '—'}</div></div>
            </div>
          </div>

          <div className="hub-quick">
            <button className="hub-op-btn" onClick={() => setTab('media')}>📄 Plan de medios</button>
            <button className="hub-op-btn" onClick={() => setTab('analizar')}>🔎 Analizar cuenta</button>
            <button className="hub-op-btn" onClick={() => setTab('optimizar')}>⚡ Optimizar cuenta</button>
            <button className="hub-op-btn" onClick={openPortal}>🪟 Panel del cliente</button>
          </div>
        </div>
      )}

    </div>
  );
}
