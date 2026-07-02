import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../api/client.js';
import PaymentsSection from '../components/PaymentsSection.jsx';
import PaymentsTimeline from '../components/PaymentsTimeline.jsx';
import StrategicProducts from '../components/StrategicProducts.jsx';
import TasksSection from '../components/TasksSection.jsx';
import OnboardingTasks from '../components/OnboardingTasks.jsx';
import OnboardingDates from '../components/OnboardingDates.jsx';
import { Welcome } from './Onboarding.jsx';
import { sumByCurrency, fmtTotals } from '../utils/budget.js';
import './ClientPortal.css';

/* ── Modal central ── */
function Modal({ title, onClose, children }) {
  return (
    <div className="cp-modal-overlay" onClick={onClose}>
      <div className="cp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cp-modal-head">
          <h3>{title}</h3>
          <button className="cp-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="cp-modal-body">{children}</div>
      </div>
    </div>
  );
}

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fmtMonthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const name = MESES[parseInt(m, 10) - 1] || ym;
  return `${name.charAt(0).toUpperCase() + name.slice(1)} ${y}`;
}

function daysElapsed() { return new Date().getDate(); }
// Días "efectivos" para el ritmo: días completos (hasta ayer) + fracción de hoy (10am→22hs).
function elapsedPace() {
  const now = new Date();
  const todayFrac = Math.min(1, Math.max(0, (now.getHours() + now.getMinutes() / 60 - 10) / 12));
  return Math.max(0, now.getDate() - 1) + todayFrac;
}
function daysInMonth() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
}

/* ── Bloque desplegable ── */
function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="cp-collapsible">
      <button className="cp-collapsible-head" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && <div className="cp-collapsible-body">{children}</div>}
    </div>
  );
}

const STATUS_PILL = {
  pendiente: { label: 'Pendiente', cls: 'cp-pill--pending' },
  en_curso: { label: 'En curso', cls: 'cp-pill--progress' },
  finalizada: { label: 'Finalizada', cls: 'cp-pill--done' },
};

function fmtRecDate(iso) {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' });
  } catch { return iso; }
}

/* ── Card de semana del roadmap (tocable) ── */
function WeekCard({ week }) {
  const [open, setOpen] = useState(false);
  const pill = STATUS_PILL[week.status] || STATUS_PILL.pendiente;
  const recs = week.recordings || [];
  return (
    <div className={`cp-week cp-week--click ${open ? 'cp-week--open' : ''}`} onClick={() => setOpen(!open)}>
      <div className="cp-week-head">
        <span className="cp-week-name">{week.week}</span>
        <span className={`cp-pill ${pill.cls}`}>{pill.label}</span>
      </div>
      <div className="cp-week-goal">{week.goal}</div>
      <div className="cp-week-recline">
        🎬 {recs.length > 0 ? `${recs.length} grabación${recs.length > 1 ? 'es' : ''}` : 'Sin grabaciones'}
        <span className="cp-week-toggle">{open ? '−' : '+'}</span>
      </div>
      {open && (
        <div className="cp-week-recs" onClick={(e) => e.stopPropagation()}>
          {recs.length === 0 && <div className="cp-week-empty">No hay grabaciones esta semana.</div>}
          {recs.map((r, i) => (
            <div key={i} className="cp-rec">
              <div className="cp-rec-date">{fmtRecDate(r.date)}</div>
              <div className="cp-rec-body">
                <span className="cp-rec-actress">{r.actress}</span>
                {r.note && <span className="cp-rec-note">{r.note}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Barra de objetivo ── */
function GoalBar({ label, current, target, pct, status }) {
  const cls = status === 'good' ? 'cp-bar--good' : status === 'warn' ? 'cp-bar--warn' : 'cp-bar--bad';
  return (
    <div className="cp-goal">
      <div className="cp-goal-top">
        <span>{label}</span>
        <span>{pct != null ? `${pct.toFixed(0)}%` : '—'}</span>
      </div>
      <div className="cp-bar"><div className={`cp-bar-fill ${cls}`} style={{ width: `${Math.min(pct || 0, 100)}%` }} /></div>
      <div className="cp-goal-vals">
        <span>{fmtMoney(current)}</span>
        <span>obj. {fmtMoney(target)}</span>
      </div>
    </div>
  );
}

/* ── Gate de clave genérico ── */
function KeyGate({ slug, title, eyebrow, kind = 'portal', onPass }) {
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState(false);
  const [loading, setLoading] = useState(false);
  const check = () => {
    if (!keyInput.trim() || loading) return;
    setLoading(true); setKeyError(false);
    apiClient.get(`/portal/${slug}/info`, { params: { key: keyInput, kind } })
      .then((r) => { if (r.data?.keyOk) onPass(keyInput); else setKeyError(true); })
      .catch(() => setKeyError(true))
      .finally(() => setLoading(false));
  };
  return (
    <div className="cp-gate">
      <div className="cp-gate-box">
        <div className="cp-brand">alquimia.</div>
        <div className="cp-gate-eyebrow">{eyebrow}</div>
        <h1 className="cp-gate-title">{title}</h1>
        <p className="cp-gate-msg">Ingresá la clave de acceso para continuar.</p>
        <input
          type="password"
          className="cp-gate-input"
          placeholder="Clave de acceso"
          value={keyInput}
          onChange={(e) => { setKeyInput(e.target.value); setKeyError(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') check(); }}
        />
        {keyError && <div className="cp-gate-error">Clave incorrecta.</div>}
        <button className="cp-btn" onClick={check} disabled={loading}>{loading ? 'Entrando…' : 'Ingresar'}</button>
      </div>
    </div>
  );
}

// Resuelve la info pública del portal desde la base (nombre + si está activo).
function usePortalInfo(slug) {
  const [info, setInfo] = useState(undefined); // undefined = cargando, null = error
  useEffect(() => {
    let alive = true;
    apiClient.get(`/portal/${slug}/info`).then((r) => { if (alive) setInfo(r.data); }).catch(() => { if (alive) setInfo(null); });
    return () => { alive = false; };
  }, [slug]);
  return info;
}

function PortalMessage({ children }) {
  return (
    <div className="cp-gate">
      <div className="cp-gate-box">
        <div className="cp-brand">alquimia.</div>
        <p className="cp-gate-msg">{children}</p>
      </div>
    </div>
  );
}

export default function ClientPortal() {
  const { slug } = useParams();
  const info = usePortalInfo(slug);
  const [authKey, setAuthKey] = useState(null);

  if (info === undefined) return <PortalMessage>Cargando…</PortalMessage>;
  if (!info || !info.exists || !info.active) return <PortalMessage>Este portal no está disponible.</PortalMessage>;
  if (!authKey) return <KeyGate slug={slug} eyebrow="Portal de cliente" title={info.name} kind="portal" onPass={setAuthKey} />;

  return <ClientDashboard client={{ slug, name: info.name, accessKey: authKey }} />;
}

function ClientDashboard({ client }) {
  // Contenido desde la base (con fallback al config de código).
  const [content, setContent] = useState(null);
  const [month, setMonth] = useState(null);
  const [welcomeDone, setWelcomeDone] = useState(false); // bienvenida breve en cada ingreso (solo genéricos)

  useEffect(() => {
    let alive = true;
    apiClient
      .get(`/portal/${client.slug}`, { params: { key: client.accessKey, ...(month ? { month } : {}) } })
      .then((res) => { if (alive) { setContent(res.data); if (!month) setMonth(res.data.selectedMonth); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [client.slug, client.accessKey, month]);

  const data = content || client;
  const {
    strategyMacro, strategyMonthly, roadmap, budget, ecommerceGoal,
    metaGoal, hypotheses, strategicProducts, considerations,
  } = data;
  const months = content?.months || [];
  const caps = data.capabilities || { ecommerce: true, meta: true, contenido: true, variable: true, web: true, tiktok: true };

  // Composición del panel: si el cliente tiene `panel`, gobierna qué se muestra.
  // Si no (ej. Moka), `show` devuelve true → comportamiento actual intacto.
  // Las secciones obligatorias siempre se muestran; las opcionales según el checklist.
  const MANDATORY = ['macro', 'estrategiaMes', 'facturacion', 'ritmo', 'performanceMeta', 'justificacion', 'consideraciones', 'tareas'];
  const panelSections = data.panel?.sections || null;
  const generic = !!data.panel;
  const show = (key) => (generic ? (MANDATORY.includes(key) || !!(panelSections || {})[key]) : true);

  // Bienvenida breve y saltable en cada ingreso (solo clientes nuevos/genéricos; Moka/legacy no).
  if (content && generic && !welcomeDone) {
    return <Welcome name={data.name} onDone={() => setWelcomeDone(true)} />;
  }

  // Contenido alimentado por el plan de medios (solo para portales genéricos).
  const mediaObjective = generic ? data.mediaObjective : null;
  const mediaJustification = generic ? (data.justificationText || '') : '';
  const mediaConsiderations = generic ? (data.considerationsList || []) : [];
  const mediaPlanning = generic ? (data.planningText || '') : '';
  // El objetivo de Performance Meta sale del PLAN DE MEDIOS del mes (para TODOS
  // los clientes, incluido Moka). Solo cae al metaGoal estático si el plan de
  // medios del mes no tiene objetivo cargado (así no se rompe el display con 0s).
  const metaObjFromPlan = data.mediaObjective && (data.mediaObjective.facturacion || data.mediaObjective.roas)
    ? data.mediaObjective : null;
  const effMetaGoal = metaObjFromPlan
    ? { revenueTarget: metaObjFromPlan.facturacion || 0, roasTarget: metaObjFromPlan.roas || 0, spendTarget: metaObjFromPlan.inversion || 0 }
    : metaGoal;

  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [meta, setMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [tn, setTn] = useState(null);
  const [tnLoading, setTnLoading] = useState(true);
  const [fx, setFx] = useState(null);
  const [budgetCur, setBudgetCur] = useState('orig'); // 'orig' (monedas originales) | 'ars' (todo en pesos)
  const [salesSrc, setSalesSrc] = useState(undefined); // undefined = cargando; objeto = cargado (con datos o tnError)

  useEffect(() => {
    let alive = true;
    apiClient.get('/public/fx').then((r) => { if (alive) setFx(r.data?.venta || null); }).catch(() => {});
    if (client.slug === 'cameo') {
      apiClient
        .get(`/public/${client.slug}/sales-source`, { params: { key: client.accessKey }, timeout: 90000 })
        .then((res) => { if (alive) setSalesSrc(res.data || { tnError: 'Sin datos.' }); })
        .catch((e) => { if (alive) setSalesSrc({ tnError: e.response?.data?.message || e.message || 'Error al cargar.' }); });
    }
    apiClient
      .get(`/public/${client.slug}/meta-insights`, { params: { key: client.accessKey } })
      .then((res) => { if (alive) setMeta(res.data); })
      .catch(() => { if (alive) setMeta(null); })
      .finally(() => { if (alive) setMetaLoading(false); });
    apiClient
      .get(`/public/${client.slug}/tiendanube`, { params: { key: client.accessKey }, timeout: 60000 })
      .then((res) => { if (alive && res.data && !res.data.tnError) setTn(res.data); })
      .catch(() => {})
      .finally(() => { if (alive) setTnLoading(false); });
    return () => { alive = false; };
  }, [client.slug, client.accessKey]);

  // Esperamos los datos del portal (vienen de la base) antes de armar el dashboard:
  // así evitamos crashear cuando todavía no tenemos budget/ecommerceGoal/etc.
  if (!content) return <PortalMessage>Cargando…</PortalMessage>;

  // Mientras carga Tienda Nube no mostramos el valor de ejemplo (evita el parpadeo).
  const ecomReady = !tnLoading;

  // Facturación y pedidos: reales de Tienda Nube si están, si no los de config.
  const ecomCurrent = tn ? tn.revenue : ecommerceGoal.current;
  const ecomOrders = tn ? tn.orders : ecommerceGoal.orders;
  const ecomTicket = tn ? tn.ticket : (ecommerceGoal.orders > 0 ? ecommerceGoal.current / ecommerceGoal.orders : 0);

  // Objetivo de facturación: para portales genéricos viene del Plan de medios; si no, del plan mensual.
  // Objetivo de facturación ecommerce: el campo dedicado del plan de medios; si no
  // está cargado, cae al de Meta (compat) y por último al ecommerceGoal (legacy/Moka).
  const ecomTarget = generic
    ? (mediaObjective?.ecommerce || mediaObjective?.facturacion || ecommerceGoal.target || 0)
    : (ecommerceGoal.target || 0);

  const ecomPct = ecomTarget > 0 ? (ecomCurrent / ecomTarget) * 100 : 0;
  const expected = (ecomTarget / daysInMonth()) * elapsedPace();
  const ecomDeviation = expected > 0 ? ((ecomCurrent - expected) / expected) * 100 : 0;

  const budgetTotals = sumByCurrency(budget.items, { budget, facturacion: ecomCurrent });

  return (
    <div className="cp-page">
      {/* Header */}
      <header className="cp-header">
        <div>
          <div className="cp-brand">alquimia.</div>
          <div className="cp-eyebrow">Panel de {client.name}</div>
        </div>
        {months.length > 0 && (
          <div className="cp-month-select">
            <span className="cp-month-select-lbl">Mes</span>
            <select value={month || ''} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => <option key={m} value={m}>{fmtMonthLabel(m)}</option>)}
            </select>
          </div>
        )}
      </header>

      {/* Estrategia macro — período bien grande */}
      {show('macro') && strategyMacro && (
      <section className="cp-hero">
        <div className="cp-hero-period">{strategyMacro.period}</div>
        <div className="cp-hero-label">Estrategia de largo plazo</div>
        <h1 className="cp-hero-title">{strategyMacro.objective}</h1>
        <p className="cp-hero-desc">{strategyMacro.description}</p>
      </section>
      )}

      {/* Banner de mes — super claro */}
      {show('estrategiaMes') && strategyMonthly && (
      <div className="cp-month-banner">
        <div className="cp-month-banner-big">{strategyMonthly.month}</div>
        <div className="cp-month-banner-obj">{strategyMonthly.objective}</div>
      </div>
      )}

      {/* Aclaración del objetivo del mes (editable desde el plan de medios → justificación de objetivos).
          Solo para Moka/legacy: los genéricos ya la muestran abajo en la sección Justificación. */}
      {!generic && (data.justificationText || '').trim() && (
        <p className="cp-objective-note">{data.justificationText}</p>
      )}

      {/* Performance ecommerce */}
      <section className="cp-section">
        <h2 className="cp-section-title">Performance ecommerce</h2>
        <div className="cp-kpis cp-kpis--3">
        {/* Facturación ecommerce — objetivo claro */}
        {caps.ecommerce && show('facturacion') && (
        <div className="cp-kpi cp-kpi--hero">
          <div className="cp-kpi-label">Facturación ecommerce</div>
          <div className="cp-kpi-value">{ecomReady ? fmtMoney(ecomCurrent) : <span className="dots">Cargando</span>}</div>
          {ecomReady && tn && <div className="cp-kpi-pct">{ecomOrders?.toLocaleString('es-AR')} pedidos · ticket {fmtMoney(ecomTicket)}</div>}
          <div className="cp-kpi-objrow">
            <span className="cp-kpi-objlbl">Objetivo del mes</span>
            <span className="cp-kpi-objval">{fmtMoney(ecomTarget)}</span>
          </div>
          <div className="cp-bar cp-bar--lg">
            <div className={`cp-bar-fill ${ecomPct >= 100 ? 'cp-bar--good' : ecomPct >= 70 ? 'cp-bar--warn' : 'cp-bar--bad'}`}
              style={{ width: `${ecomReady ? Math.min(ecomPct, 100) : 0}%` }} />
          </div>
          <div className="cp-kpi-pct">{ecomReady ? `${ecomPct.toFixed(0)}% del objetivo alcanzado` : '—'}</div>
        </div>
        )}

        {/* Ritmo del mes */}
        {caps.ecommerce && show('ritmo') && (
        <div className="cp-kpi">
          <div className="cp-kpi-label">Ritmo del mes</div>
          <div className="cp-ritmo">
            <div className="cp-ritmo-row">
              <span>Objetivo a día {daysElapsed()}:</span>
              <strong>{fmtMoney(expected)}</strong>
            </div>
            <div className="cp-ritmo-row">
              <span>Vamos:</span>
              <strong>{ecomReady ? fmtMoney(ecomCurrent) : <span className="dots">Cargando</span>}</strong>
            </div>
          </div>
          {ecomReady && (
            <div className={`cp-ritmo-verdict ${ecomDeviation < 0 ? 'cp-verdict--bad' : 'cp-verdict--good'}`}>
              {ecomDeviation >= 0
                ? `Adelantados ${ecomDeviation.toFixed(0)}% sobre el ritmo`
                : `Desviados ${Math.abs(ecomDeviation).toFixed(0)}% por debajo del ritmo`}
            </div>
          )}
        </div>
        )}

        {/* Presupuesto — toggle de moneda + detalle */}
        {show('presupuestoTotal') && (
        <div className="cp-kpi cp-kpi--button">
          <div className="cp-kpi-label">Presupuesto total mes</div>
          <div className="cp-budget-cur">
            <button className={`cp-budget-curbtn ${budgetCur === 'orig' ? 'cp-budget-curbtn--on' : ''}`} onClick={() => setBudgetCur('orig')}>Monedas originales</button>
            <button className={`cp-budget-curbtn ${budgetCur === 'ars' ? 'cp-budget-curbtn--on' : ''}`} onClick={() => setBudgetCur('ars')} disabled={!fx}>Todo en pesos</button>
          </div>
          <div className="cp-kpi-value cp-kpi-value--budget">
            {budgetCur === 'ars'
              ? fmtMoney((budgetTotals.ARS || 0) + (budgetTotals.USD || 0) * (fx || 0))
              : fmtTotals(budgetTotals)}
          </div>
          {budgetCur === 'ars' && fx && <div className="cp-kpi-pct">al dólar oficial venta ${fx}</div>}
          <div className="cp-kpi-cta" onClick={() => setShowBudgetModal(true)} style={{ cursor: 'pointer' }}>Ver detalle →</div>
        </div>
        )}
        </div>
      </section>

      {/* Performance Meta */}
      {caps.meta && show('performanceMeta') && (
      <section className="cp-section">
        <h2 className="cp-section-title">Performance Meta y TikTok</h2>
        <div className="cp-card">
          {metaLoading && <p className="cp-placeholder">Cargando datos de Meta…</p>}
          {!metaLoading && !meta && (
            <p className="cp-placeholder">No se pudieron cargar los datos de Meta en este momento.</p>
          )}
          {!metaLoading && meta && meta.metaError && (
            <p className="cp-placeholder">Meta no devolvió datos: {meta.metaError}</p>
          )}
          {!metaLoading && meta && !meta.metaError && (() => {
            const roasStatus = meta.roas >= effMetaGoal.roasTarget ? 'good' : meta.roas >= effMetaGoal.roasTarget * 0.7 ? 'warn' : 'bad';
            const revPct = effMetaGoal.revenueTarget > 0 ? (meta.purchaseValue / effMetaGoal.revenueTarget) * 100 : 0;
            // Desvío de facturación atribuida vs ritmo esperado del mes
            const revExpected = (effMetaGoal.revenueTarget / daysInMonth()) * elapsedPace();
            const revDeviation = revExpected > 0 ? ((meta.purchaseValue - revExpected) / revExpected) * 100 : 0;
            const revOnTrack = revDeviation >= -10;
            return (
              <>
                <div className="cp-meta-grid">
                  <div className="cp-meta-cell">
                    <div className="cp-meta-lbl">Facturación atribuida</div>
                    <div className="cp-meta-val">{fmtMoney(meta.purchaseValue)}</div>
                    <div className="cp-meta-sub">obj. {fmtMoney(effMetaGoal.revenueTarget)} · {revPct.toFixed(0)}%</div>
                  </div>
                  <div className="cp-meta-cell">
                    <div className="cp-meta-lbl">Inversión</div>
                    <div className="cp-meta-val">{fmtMoney(meta.spend)}</div>
                    <div className="cp-meta-sub">obj. {fmtMoney(effMetaGoal.spendTarget)}</div>
                  </div>
                  <div className="cp-meta-cell">
                    <div className="cp-meta-lbl">ROAS</div>
                    <div className={`cp-meta-val cp-meta-val--${roasStatus}`}>{meta.roas.toFixed(2)}×</div>
                    <div className="cp-meta-sub">obj. {effMetaGoal.roasTarget}×</div>
                  </div>
                  <div className="cp-meta-cell">
                    <div className="cp-meta-lbl">Compras</div>
                    <div className="cp-meta-val">{meta.purchases?.toLocaleString('es-AR') || 0}</div>
                    <div className="cp-meta-sub">CPA {fmtMoney(meta.cpa)}</div>
                  </div>
                </div>
                <div className={`cp-meta-verdict cp-verdict--${roasStatus === 'good' ? 'good' : 'bad'}`}>
                  {roasStatus === 'good'
                    ? `✓ En línea: ROAS por encima del objetivo de ${effMetaGoal.roasTarget}×`
                    : roasStatus === 'warn'
                    ? `⚠ Levemente desviado del objetivo de ROAS ${effMetaGoal.roasTarget}×`
                    : `⚠ Crítico: ROAS por debajo del objetivo de ${effMetaGoal.roasTarget}×`}
                </div>

                {/* Desvío de facturación atribuida vs ritmo */}
                <div className="cp-meta-pace">
                  <div className="cp-meta-pace-row">
                    <span>Objetivo de facturación a día {daysElapsed()}</span>
                    <strong>{fmtMoney(revExpected)}</strong>
                  </div>
                  <div className="cp-meta-pace-row">
                    <span>Facturación atribuida actual</span>
                    <strong>{fmtMoney(meta.purchaseValue)}</strong>
                  </div>
                  <div className={`cp-meta-verdict cp-verdict--${revOnTrack ? 'good' : 'bad'}`}>
                    {revDeviation >= 0
                      ? `✓ Facturación atribuida ${revDeviation.toFixed(0)}% por encima del ritmo`
                      : `⚠ Facturación atribuida desviada ${Math.abs(revDeviation).toFixed(0)}% por debajo del ritmo`}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </section>
      )}

      {/* ¿De dónde vienen las ventas? — solo Cameo (UTM del último click vs atribución de Meta) */}
      {client.slug === 'cameo' && (
        <section className="cp-section">
          <h2 className="cp-section-title">¿De dónde vienen las ventas?</h2>
          <div className="cp-card">
            {salesSrc === undefined && <p className="cp-placeholder">Cargando origen de ventas…</p>}
            {salesSrc && salesSrc.tnError && <p className="cp-placeholder">No se pudo leer el origen: {salesSrc.tnError}</p>}
            {salesSrc && !salesSrc.tnError && (() => {
              const total = salesSrc.totalOrders || 0;
              const tiktok = (salesSrc.sources || []).find((s) => s.source === 'tiktok');
              return (
                <>
                  <p className="cp-src-note">Origen real de cada venta de la tienda, según el último click (UTM). Meta cuenta con su propio píxel (click + view-through), por eso puede atribuirse ventas que en realidad llegaron por TikTok.</p>
                  <div className="cp-src-list">
                    {(salesSrc.sources || []).map((s) => {
                      const pct = total ? Math.round((s.orders / total) * 100) : 0;
                      return (
                        <div key={s.source} className="cp-src-row">
                          <div className="cp-src-top"><span className="cp-src-lbl">{s.label}</span><span className="cp-src-val">{s.orders} ventas · {fmtMoney(s.revenue)} · {pct}%</span></div>
                          <div className="cp-bar"><div className={`cp-bar-fill cp-src-fill--${s.source}`} style={{ width: `${pct}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="cp-src-contrast">
                    <div className="cp-src-contrast-row"><span>Ventas reales en la tienda (mes)</span><strong>{total} · {fmtMoney(salesSrc.totalRevenue)}</strong></div>
                    <div className="cp-src-contrast-row"><span>Meta se atribuye</span><strong>{salesSrc.meta?.purchases || 0} compras · {fmtMoney(salesSrc.meta?.purchaseValue || 0)}</strong></div>
                    {tiktok && <div className="cp-src-contrast-note">⚠ {tiktok.orders} ventas reales tienen UTM de TikTok ({fmtMoney(tiktok.revenue)}). Parte de lo que Meta se atribuye puede ser, en realidad, de TikTok.</div>}
                  </div>
                </>
              );
            })()}
          </div>
        </section>
      )}

      {/* PAGOS — línea de tiempo del mes (desplegable) */}
      {show('pagos') && (
      <section className="cp-section">
        <Collapsible title="Presupuesto financiero del mes — ver pagos">
          <PaymentsTimeline budget={budget} slug={client.slug} accessKey={client.accessKey} />
        </Collapsible>
      </section>
      )}

      {/* Modal de presupuesto */}
      {showBudgetModal && (
        <Modal title="Presupuesto económico" onClose={() => setShowBudgetModal(false)}>
          <PaymentsSection budget={budget} facturacion={ecomCurrent} objetivo={ecomTarget} />
        </Modal>
      )}

      {/* Tareas */}
      {show('tareas') && (
      <section className="cp-section">
        <h2 className="cp-section-title">Tareas</h2>
        {generic && data.onboarding && (data.onboarding.pedirFormulario || data.onboarding.pedirContenido) && (
          <OnboardingTasks slug={client.slug} accessKey={client.accessKey} toggles={data.onboarding} />
        )}
        <TasksSection slug={client.slug} accessKey={client.accessKey} />
      </section>
      )}

      {/* Fechas / calendario (onboarding) — gateado por el toggle mostrarFechas */}
      {generic && data.onboarding && data.onboarding.mostrarFechas && (
      <section className="cp-section">
        <h2 className="cp-section-title">Fechas</h2>
        <OnboardingDates slug={client.slug} accessKey={client.accessKey} />
      </section>
      )}

      {/* Roadmap semanal */}
      {show('roadmap') && (roadmap || []).length > 0 && (
      <section className="cp-section">
        <h2 className="cp-section-title">Roadmap del mes</h2>
        <div className="cp-roadmap">
          {roadmap.map((r, i) => <WeekCard key={i} week={r} />)}
        </div>
      </section>
      )}

      {/* Productos estratégicos (se traen de Tienda Nube; si no hay tienda conectada, no aparece) */}
      {caps.ecommerce && show('productos') && (generic ? !!tn : (strategicProducts || []).length > 0) && (
      <section className="cp-section">
        <h2 className="cp-section-title">Productos estratégicos</h2>
        {/* Genéricos (Cameo, etc.): "modo todos" (sin SKUs) → trae todos los productos vendidos.
            Moka/legacy: mantiene su lista curada de productos estratégicos. */}
        <StrategicProducts slug={client.slug} accessKey={client.accessKey} products={generic ? [] : (strategicProducts || [])} />
      </section>
      )}

      {/* Justificación de objetivos */}
      {show('justificacion') && (generic ? !!mediaJustification.trim() : !!((hypotheses?.points || []).length || (hypotheses?.conclusion || '').trim())) && (
      <section className="cp-section">
        <Collapsible title="Justificación de objetivos">
          {generic
            ? <p className="cp-bodytext">{mediaJustification}</p>
            : (
              <>
                <ul className="cp-list">
                  {hypotheses.points.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
                <p className="cp-conclusion">{hypotheses.conclusion}</p>
              </>
            )}
        </Collapsible>
      </section>
      )}

      {/* Consideraciones y riesgos */}
      {show('consideraciones') && (generic ? mediaConsiderations.length > 0 : (considerations || []).length > 0) && (
      <section className="cp-section">
        <Collapsible title="Consideraciones y riesgos">
          {generic
            ? <ul className="cp-list">{mediaConsiderations.map((c, i) => <li key={i}>{c}</li>)}</ul>
            : considerations.map((c, i) => (
              <div key={i} className="cp-risk">
                <div className="cp-risk-title">{c.title}</div>
                <div className="cp-risk-text">{c.text}</div>
              </div>
            ))}
        </Collapsible>
      </section>
      )}

      {/* Planificación de próximos meses (solo portales genéricos, desde el plan de medios) */}
      {generic && show('planificacion') && !!mediaPlanning.trim() && (
      <section className="cp-section">
        <Collapsible title="Planificación de próximos meses">
          <p className="cp-bodytext">{mediaPlanning}</p>
        </Collapsible>
      </section>
      )}

      <footer className="cp-footer">panel by alquimia.</footer>
    </div>
  );
}

/* ── Vista SOLO de pagos (para administración) ── */
export function PaymentsPortal() {
  const { slug } = useParams();
  const info = usePortalInfo(slug);
  const [authKey, setAuthKey] = useState(null);

  if (info === undefined) return <PortalMessage>Cargando…</PortalMessage>;
  if (!info || !info.exists || !info.active || !info.hasPayments) return <PortalMessage>Esta vista no está disponible.</PortalMessage>;
  if (!authKey) return <KeyGate slug={slug} eyebrow="Pagos" title={info.name} kind="pagos" onPass={setAuthKey} />;

  return <PaymentsView slug={slug} name={info.name} authKey={authKey} />;
}

function PaymentsView({ slug, name, authKey }) {
  const [budget, setBudget] = useState(null);
  useEffect(() => {
    let alive = true;
    apiClient.get(`/portal/${slug}`, { params: { key: authKey } })
      .then((r) => { if (alive) setBudget(r.data?.budget || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug, authKey]);

  return (
    <div className="cp-page">
      <header className="cp-header">
        <div>
          <div className="cp-brand">alquimia.</div>
          <div className="cp-eyebrow">Pagos · {name}</div>
        </div>
      </header>
      <div className="cp-month-banner">
        <div className="cp-month-banner-big">Pagos del mes</div>
        <div className="cp-month-banner-obj">Flujo de pagos por fecha, con datos para transferir en cada componente.</div>
      </div>
      <section className="cp-section">
        {budget ? <PaymentsTimeline budget={budget} slug={slug} accessKey={authKey} /> : <p className="cp-placeholder">Cargando pagos…</p>}
      </section>
      <footer className="cp-footer">panel by alquimia.</footer>
    </div>
  );
}
