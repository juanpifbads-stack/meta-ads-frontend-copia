import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getClient } from '../data/clients.js';
import apiClient from '../api/client.js';
import PaymentsSection from '../components/PaymentsSection.jsx';
import PaymentsTimeline from '../components/PaymentsTimeline.jsx';
import StrategicProducts from '../components/StrategicProducts.jsx';
import TasksSection from '../components/TasksSection.jsx';
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

function daysElapsed() { return new Date().getDate(); }
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
function KeyGate({ client, title, eyebrow, expectedKey, onPass }) {
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState(false);
  const check = () => {
    if (keyInput === expectedKey) onPass();
    else setKeyError(true);
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
        <button className="cp-btn" onClick={check}>Ingresar</button>
      </div>
    </div>
  );
}

export default function ClientPortal() {
  const { slug } = useParams();
  const client = getClient(slug);
  const [authed, setAuthed] = useState(false);

  if (!client || !client.active) {
    return (
      <div className="cp-gate">
        <div className="cp-gate-box">
          <div className="cp-brand">alquimia.</div>
          <p className="cp-gate-msg">Este portal no está disponible.</p>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <KeyGate
        client={client}
        eyebrow="Portal de cliente"
        title={client.name}
        expectedKey={client.accessKey}
        onPass={() => setAuthed(true)}
      />
    );
  }

  return <ClientDashboard client={client} />;
}

function ClientDashboard({ client }) {
  const {
    strategyMacro, strategyMonthly, roadmap, budget, ecommerceGoal,
    metaGoal, hypotheses, strategicProducts, considerations,
  } = client;

  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [meta, setMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [tn, setTn] = useState(null);
  const [tnLoading, setTnLoading] = useState(true);

  useEffect(() => {
    let alive = true;
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

  // Mientras carga Tienda Nube no mostramos el valor de ejemplo (evita el parpadeo).
  const ecomReady = !tnLoading;

  // Facturación y pedidos: reales de Tienda Nube si están, si no los de config.
  const ecomCurrent = tn ? tn.revenue : ecommerceGoal.current;
  const ecomOrders = tn ? tn.orders : ecommerceGoal.orders;
  const ecomTicket = tn ? tn.ticket : (ecommerceGoal.orders > 0 ? ecommerceGoal.current / ecommerceGoal.orders : 0);

  const ecomPct = ecommerceGoal.target > 0 ? (ecomCurrent / ecommerceGoal.target) * 100 : 0;
  const expected = (ecommerceGoal.target / daysInMonth()) * daysElapsed();
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
      </header>

      {/* Estrategia macro — período bien grande */}
      <section className="cp-hero">
        <div className="cp-hero-period">{strategyMacro.period}</div>
        <div className="cp-hero-label">Estrategia de largo plazo</div>
        <h1 className="cp-hero-title">{strategyMacro.objective}</h1>
        <p className="cp-hero-desc">{strategyMacro.description}</p>
      </section>

      {/* Banner de mes — super claro */}
      <div className="cp-month-banner">
        <div className="cp-month-banner-big">{strategyMonthly.month}</div>
        <div className="cp-month-banner-obj">{strategyMonthly.objective}</div>
      </div>

      {/* KPI Cards */}
      <section className="cp-kpis cp-kpis--3">
        {/* Facturación ecommerce — objetivo claro */}
        <div className="cp-kpi cp-kpi--hero">
          <div className="cp-kpi-label">Facturación ecommerce</div>
          <div className="cp-kpi-value">{ecomReady ? fmtMoney(ecomCurrent) : <span className="dots">Cargando</span>}</div>
          {ecomReady && tn && <div className="cp-kpi-pct">{ecomOrders?.toLocaleString('es-AR')} pedidos · ticket {fmtMoney(ecomTicket)}</div>}
          <div className="cp-kpi-objrow">
            <span className="cp-kpi-objlbl">Objetivo del mes</span>
            <span className="cp-kpi-objval">{fmtMoney(ecommerceGoal.target)}</span>
          </div>
          <div className="cp-bar cp-bar--lg">
            <div className={`cp-bar-fill ${ecomPct >= 100 ? 'cp-bar--good' : ecomPct >= 70 ? 'cp-bar--warn' : 'cp-bar--bad'}`}
              style={{ width: `${ecomReady ? Math.min(ecomPct, 100) : 0}%` }} />
          </div>
          <div className="cp-kpi-pct">{ecomReady ? `${ecomPct.toFixed(0)}% del objetivo alcanzado` : '—'}</div>
        </div>

        {/* Ritmo del mes */}
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

        {/* Presupuesto — botón a modal */}
        <button className="cp-kpi cp-kpi--button" onClick={() => setShowBudgetModal(true)}>
          <div className="cp-kpi-label">Presupuesto total mes</div>
          <div className="cp-kpi-value cp-kpi-value--budget">{fmtTotals(budgetTotals)}</div>
          <div className="cp-kpi-cta">Ver detalle →</div>
        </button>
      </section>

      {/* PAGOS — línea de tiempo del mes (desplegable) */}
      <section className="cp-section">
        <Collapsible title="Presupuesto financiero del mes — ver pagos">
          <PaymentsTimeline budget={budget} slug={client.slug} accessKey={client.accessKey} />
        </Collapsible>
      </section>

      {/* Modal de presupuesto */}
      {showBudgetModal && (
        <Modal title="Presupuesto económico" onClose={() => setShowBudgetModal(false)}>
          <PaymentsSection budget={budget} facturacion={ecomCurrent} objetivo={ecommerceGoal.target} />
        </Modal>
      )}

      {/* Tareas */}
      <section className="cp-section">
        <h2 className="cp-section-title">Tareas</h2>
        <TasksSection slug={client.slug} accessKey={client.accessKey} />
      </section>

      {/* Roadmap semanal */}
      <section className="cp-section">
        <h2 className="cp-section-title">Roadmap del mes</h2>
        <div className="cp-roadmap">
          {roadmap.map((r, i) => <WeekCard key={i} week={r} />)}
        </div>
      </section>

      {/* Performance Meta */}
      <section className="cp-section">
        <h2 className="cp-section-title">Performance Meta · junio</h2>
        <div className="cp-card">
          {metaLoading && <p className="cp-placeholder">Cargando datos de Meta…</p>}
          {!metaLoading && !meta && (
            <p className="cp-placeholder">No se pudieron cargar los datos de Meta en este momento.</p>
          )}
          {!metaLoading && meta && meta.metaError && (
            <p className="cp-placeholder">Meta no devolvió datos: {meta.metaError}</p>
          )}
          {!metaLoading && meta && !meta.metaError && (() => {
            const roasStatus = meta.roas >= metaGoal.roasTarget ? 'good' : meta.roas >= metaGoal.roasTarget * 0.7 ? 'warn' : 'bad';
            const revPct = metaGoal.revenueTarget > 0 ? (meta.purchaseValue / metaGoal.revenueTarget) * 100 : 0;
            // Desvío de facturación atribuida vs ritmo esperado del mes
            const revExpected = (metaGoal.revenueTarget / daysInMonth()) * daysElapsed();
            const revDeviation = revExpected > 0 ? ((meta.purchaseValue - revExpected) / revExpected) * 100 : 0;
            const revOnTrack = revDeviation >= -10;
            return (
              <>
                <div className="cp-meta-grid">
                  <div className="cp-meta-cell">
                    <div className="cp-meta-lbl">Facturación atribuida</div>
                    <div className="cp-meta-val">{fmtMoney(meta.purchaseValue)}</div>
                    <div className="cp-meta-sub">obj. {fmtMoney(metaGoal.revenueTarget)} · {revPct.toFixed(0)}%</div>
                  </div>
                  <div className="cp-meta-cell">
                    <div className="cp-meta-lbl">Inversión</div>
                    <div className="cp-meta-val">{fmtMoney(meta.spend)}</div>
                    <div className="cp-meta-sub">obj. {fmtMoney(metaGoal.spendTarget)}</div>
                  </div>
                  <div className="cp-meta-cell">
                    <div className="cp-meta-lbl">ROAS</div>
                    <div className={`cp-meta-val cp-meta-val--${roasStatus}`}>{meta.roas.toFixed(2)}×</div>
                    <div className="cp-meta-sub">obj. {metaGoal.roasTarget}×</div>
                  </div>
                  <div className="cp-meta-cell">
                    <div className="cp-meta-lbl">Compras</div>
                    <div className="cp-meta-val">{meta.purchases?.toLocaleString('es-AR') || 0}</div>
                    <div className="cp-meta-sub">CPA {fmtMoney(meta.cpa)}</div>
                  </div>
                </div>
                <div className={`cp-meta-verdict cp-verdict--${roasStatus === 'good' ? 'good' : 'bad'}`}>
                  {roasStatus === 'good'
                    ? `✓ En línea: ROAS por encima del objetivo de ${metaGoal.roasTarget}×`
                    : roasStatus === 'warn'
                    ? `⚠ Levemente desviado del objetivo de ROAS ${metaGoal.roasTarget}×`
                    : `⚠ Crítico: ROAS por debajo del objetivo de ${metaGoal.roasTarget}×`}
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

      {/* Productos estratégicos */}
      <section className="cp-section">
        <h2 className="cp-section-title">Productos estratégicos</h2>
        <StrategicProducts slug={client.slug} accessKey={client.accessKey} products={strategicProducts} />
      </section>

      {/* Justificación de objetivos */}
      <section className="cp-section">
        <Collapsible title="Justificación de objetivos">
          <ul className="cp-list">
            {hypotheses.points.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
          <p className="cp-conclusion">{hypotheses.conclusion}</p>
        </Collapsible>
      </section>

      {/* Consideraciones y riesgos */}
      <section className="cp-section">
        <Collapsible title="Consideraciones y riesgos">
          {considerations.map((c, i) => (
            <div key={i} className="cp-risk">
              <div className="cp-risk-title">{c.title}</div>
              <div className="cp-risk-text">{c.text}</div>
            </div>
          ))}
        </Collapsible>
      </section>

      <footer className="cp-footer">panel by alquimia.</footer>
    </div>
  );
}

/* ── Vista SOLO de pagos (para administración) ── */
export function PaymentsPortal() {
  const { slug } = useParams();
  const client = getClient(slug);
  const [authed, setAuthed] = useState(false);

  if (!client || !client.active) {
    return (
      <div className="cp-gate">
        <div className="cp-gate-box">
          <div className="cp-brand">alquimia.</div>
          <p className="cp-gate-msg">Esta vista no está disponible.</p>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <KeyGate
        client={client}
        eyebrow="Pagos"
        title={client.name}
        expectedKey={client.paymentsKey}
        onPass={() => setAuthed(true)}
      />
    );
  }

  return (
    <div className="cp-page">
      <header className="cp-header">
        <div>
          <div className="cp-brand">alquimia.</div>
          <div className="cp-eyebrow">Pagos · {client.name}</div>
        </div>
      </header>
      <div className="cp-month-banner">
        <div className="cp-month-banner-big">Pagos del mes</div>
        <div className="cp-month-banner-obj">Flujo de pagos por fecha, con datos para transferir en cada componente.</div>
      </div>
      <section className="cp-section">
        <PaymentsTimeline budget={client.budget} slug={client.slug} accessKey={client.accessKey} />
      </section>
      <footer className="cp-footer">panel by alquimia.</footer>
    </div>
  );
}
