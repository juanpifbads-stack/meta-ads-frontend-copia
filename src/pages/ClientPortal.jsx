import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getClient } from '../data/clients.js';
import PaymentsSection from '../components/PaymentsSection.jsx';
import './ClientPortal.css';

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

const STATUS_PILL = {
  pendiente: { label: 'Pendiente', cls: 'cp-pill--pending' },
  en_curso: { label: 'En curso', cls: 'cp-pill--progress' },
  finalizada: { label: 'Finalizada', cls: 'cp-pill--done' },
};

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

  const ecomPct = ecommerceGoal.target > 0 ? (ecommerceGoal.current / ecommerceGoal.target) * 100 : 0;
  const expected = (ecommerceGoal.target / daysInMonth()) * daysElapsed();
  const ecomDeviation = expected > 0 ? ((ecommerceGoal.current - expected) / expected) * 100 : 0;
  const ticket = ecommerceGoal.orders > 0 ? ecommerceGoal.current / ecommerceGoal.orders : 0;

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
      <section className="cp-kpis">
        <div className="cp-kpi">
          <div className="cp-kpi-label">Facturación ecommerce</div>
          <div className="cp-kpi-value">{fmtMoney(ecommerceGoal.current)}</div>
          <div className="cp-kpi-sub">obj. {fmtMoney(ecommerceGoal.target)}</div>
        </div>
        <div className="cp-kpi">
          <div className="cp-kpi-label">Pedidos</div>
          <div className="cp-kpi-value">{ecommerceGoal.orders?.toLocaleString('es-AR') || '—'}</div>
          <div className="cp-kpi-sub">ticket {fmtMoney(ticket)}</div>
        </div>
        <div className="cp-kpi">
          <div className="cp-kpi-label">% del objetivo</div>
          <div className="cp-kpi-value">{ecomPct.toFixed(0)}%</div>
          <div className={`cp-kpi-sub ${ecomDeviation < 0 ? 'cp-neg' : 'cp-pos'}`}>
            {ecomDeviation >= 0 ? '+' : ''}{ecomDeviation.toFixed(0)}% vs ritmo
          </div>
        </div>
        <div className="cp-kpi">
          <div className="cp-kpi-label">Presupuesto total mes</div>
          <div className="cp-kpi-value">{fmtMoney(
            [...budget.servicios, ...budget.medios, ...budget.produccion].reduce((s, x) => s + (x.amount || 0), 0)
          )}</div>
          <div className="cp-kpi-sub">a pagar</div>
        </div>
      </section>

      {/* PAGOS — arriba y bien claro */}
      <section className="cp-section">
        <h2 className="cp-section-title">Pagos del mes</h2>
        <PaymentsSection budget={budget} />
      </section>

      {/* Avance objetivo ecommerce */}
      <section className="cp-section">
        <h2 className="cp-section-title">Objetivo de facturación</h2>
        <div className="cp-card">
          <GoalBar
            label="Facturación ecommerce"
            current={ecommerceGoal.current}
            target={ecommerceGoal.target}
            pct={ecomPct}
            status={ecomPct >= 100 ? 'good' : ecomPct >= 70 ? 'warn' : 'bad'}
          />
          <div className="cp-pace">
            <div><span className="cp-pace-lbl">Esperado al día {daysElapsed()}</span><span>{fmtMoney(expected)}</span></div>
            <div><span className="cp-pace-lbl">Actual</span><span>{fmtMoney(ecommerceGoal.current)}</span></div>
            <div><span className="cp-pace-lbl">Desvío</span><span className={ecomDeviation < 0 ? 'cp-neg' : 'cp-pos'}>{ecomDeviation >= 0 ? '+' : ''}{ecomDeviation.toFixed(0)}%</span></div>
          </div>
        </div>
      </section>

      {/* Roadmap semanal */}
      <section className="cp-section">
        <h2 className="cp-section-title">Roadmap del mes</h2>
        <div className="cp-roadmap">
          {roadmap.map((r, i) => {
            const pill = STATUS_PILL[r.status] || STATUS_PILL.pendiente;
            return (
              <div key={i} className="cp-week">
                <div className="cp-week-head">
                  <span className="cp-week-name">{r.week}</span>
                  <span className={`cp-pill ${pill.cls}`}>{pill.label}</span>
                </div>
                <div className="cp-week-goal">{r.goal}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Performance Meta */}
      <section className="cp-section">
        <h2 className="cp-section-title">Performance Meta</h2>
        <div className="cp-card">
          <p className="cp-placeholder">Métricas de Meta — se conectan con la cuenta {client.metaAccountId}.</p>
          <div className="cp-meta-goals">
            <div className="cp-meta-goal"><span>Facturación obj.</span><strong>{fmtMoney(metaGoal.revenueTarget)}</strong></div>
            <div className="cp-meta-goal"><span>ROAS obj.</span><strong>{metaGoal.roasTarget}×</strong></div>
            <div className="cp-meta-goal"><span>Inversión obj.</span><strong>{fmtMoney(metaGoal.spendTarget)}</strong></div>
          </div>
        </div>
      </section>

      {/* Productos estratégicos */}
      <section className="cp-section">
        <h2 className="cp-section-title">Productos estratégicos</h2>
        <div className="cp-card">
          <table className="cp-products">
            <thead>
              <tr><th>Producto</th><th>SKU</th><th>Stock</th><th>Ventas</th><th>Facturación</th></tr>
            </thead>
            <tbody>
              {strategicProducts.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td className="cp-mono">{p.sku}</td>
                  <td className="cp-muted">—</td>
                  <td className="cp-muted">—</td>
                  <td className="cp-muted">—</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="cp-placeholder">Stock, ventas y facturación se conectan con Tienda Nube.</p>
        </div>
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
        <div className="cp-month-banner-obj">Detalle de conceptos, fechas y montos a transferir.</div>
      </div>
      <section className="cp-section">
        <PaymentsSection budget={client.budget} />
      </section>
      <footer className="cp-footer">panel by alquimia.</footer>
    </div>
  );
}
