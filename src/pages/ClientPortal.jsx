import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getClient } from '../data/clients.js';
import './ClientPortal.css';

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  } catch { return iso; }
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

export default function ClientPortal() {
  const { slug } = useParams();
  const client = getClient(slug);

  const [authed, setAuthed] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState(false);

  // Cliente inexistente o inactivo
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

  // Gate de clave
  if (!authed) {
    return (
      <div className="cp-gate">
        <div className="cp-gate-box">
          <div className="cp-brand">alquimia.</div>
          <div className="cp-gate-eyebrow">Portal de cliente</div>
          <h1 className="cp-gate-title">{client.name}</h1>
          <p className="cp-gate-msg">Ingresá la clave de acceso para ver tu panel.</p>
          <input
            type="password"
            className="cp-gate-input"
            placeholder="Clave de acceso"
            value={keyInput}
            onChange={(e) => { setKeyInput(e.target.value); setKeyError(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (keyInput === client.accessKey) setAuthed(true);
                else setKeyError(true);
              }
            }}
          />
          {keyError && <div className="cp-gate-error">Clave incorrecta.</div>}
          <button
            className="cp-btn"
            onClick={() => {
              if (keyInput === client.accessKey) setAuthed(true);
              else setKeyError(true);
            }}
          >
            Ingresar
          </button>
        </div>
      </div>
    );
  }

  return <ClientDashboard client={client} />;
}

function ClientDashboard({ client }) {
  const { strategyMacro, strategyMonthly, roadmap, budget, ecommerceGoal, metaGoal, hypotheses, strategicProducts, considerations } = client;

  // Totales de presupuesto
  const totals = useMemo(() => {
    const sum = (arr) => arr.reduce((s, x) => s + (x.amount || 0), 0);
    const servicios = sum(budget.servicios);
    const medios = sum(budget.medios);
    const produccion = sum(budget.produccion);
    return { servicios, medios, produccion, general: servicios + medios + produccion };
  }, [budget]);

  // Avance ecommerce
  const ecomPct = ecommerceGoal.target > 0 ? (ecommerceGoal.current / ecommerceGoal.target) * 100 : 0;
  const expected = (ecommerceGoal.target / daysInMonth()) * daysElapsed();
  const ecomDeviation = expected > 0 ? ((ecommerceGoal.current - expected) / expected) * 100 : 0;
  const ticket = ecommerceGoal.orders > 0 ? ecommerceGoal.current / ecommerceGoal.orders : 0;

  const allPayments = [
    ...budget.servicios.map((x) => ({ ...x, group: 'Servicios' })),
    ...budget.medios.map((x) => ({ ...x, group: 'Medios' })),
    ...budget.produccion.map((x) => ({ ...x, group: 'Producción' })),
  ].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  return (
    <div className="cp-page">
      {/* Header */}
      <header className="cp-header">
        <div>
          <div className="cp-brand">alquimia.</div>
          <div className="cp-eyebrow">Panel de {client.name}</div>
        </div>
        <div className="cp-period">{strategyMacro.period}</div>
      </header>

      {/* Estrategia macro */}
      <section className="cp-hero">
        <div className="cp-hero-label">Estrategia {strategyMacro.period}</div>
        <h1 className="cp-hero-title">{strategyMacro.objective}</h1>
        <p className="cp-hero-desc">{strategyMacro.description}</p>
        <div className="cp-monthly">
          <span className="cp-monthly-tag">{strategyMonthly.month}</span>
          <span className="cp-monthly-obj">{strategyMonthly.objective}</span>
        </div>
      </section>

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
          <div className="cp-kpi-value">{fmtMoney(totals.general)}</div>
          <div className="cp-kpi-sub">próximo pago</div>
        </div>
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

      {/* Presupuesto y pagos */}
      <section className="cp-section">
        <h2 className="cp-section-title">Presupuesto y pagos del próximo mes</h2>
        <div className="cp-card">
          <table className="cp-payments">
            <thead>
              <tr><th>Concepto</th><th>Categoría</th><th>Vencimiento</th><th>Monto</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {allPayments.map((p, i) => (
                <tr key={i}>
                  <td>{p.concept}</td>
                  <td className="cp-muted">{p.group}</td>
                  <td className="cp-mono">{fmtDate(p.dueDate)}</td>
                  <td>{fmtMoney(p.amount)}</td>
                  <td><span className={`cp-pill ${STATUS_PILL[p.status]?.cls || ''}`}>{STATUS_PILL[p.status]?.label || p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="cp-totals">
            <div><span>Servicios</span><strong>{fmtMoney(totals.servicios)}</strong></div>
            <div><span>Medios</span><strong>{fmtMoney(totals.medios)}</strong></div>
            <div><span>Producción</span><strong>{fmtMoney(totals.produccion)}</strong></div>
            <div className="cp-total-general"><span>Total general</span><strong>{fmtMoney(totals.general)}</strong></div>
          </div>
          <div className="cp-bank">
            <div className="cp-bank-title">Datos para el pago</div>
            <div className="cp-bank-grid">
              <div><span>Titular</span><strong>{budget.bankInfo.titular}</strong></div>
              <div><span>Alias</span><strong>{budget.bankInfo.alias}</strong></div>
              <div><span>CBU/CVU</span><strong className="cp-mono">{budget.bankInfo.cbu}</strong></div>
            </div>
            {budget.bankInfo.observaciones && <div className="cp-bank-obs">{budget.bankInfo.observaciones}</div>}
          </div>
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
