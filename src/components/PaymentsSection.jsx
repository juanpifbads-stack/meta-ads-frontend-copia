import React, { useState, useMemo } from 'react';
import './PaymentsSection.css';

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long' });
  } catch { return iso; }
}

const STATUS = {
  pendiente: { label: 'Pendiente', cls: 'ps-pill--pending' },
  pagado: { label: 'Pagado', cls: 'ps-pill--done' },
};

const GROUP_LABELS = {
  servicios: 'Servicios',
  medios: 'Medios',
  produccion: 'Producción',
};

export default function PaymentsSection({ budget }) {
  const [showBank, setShowBank] = useState(false);
  const [copied, setCopied] = useState(false);

  const { rows, totals } = useMemo(() => {
    const sum = (arr) => arr.reduce((s, x) => s + (x.amount || 0), 0);
    const all = [
      ...budget.servicios.map((x) => ({ ...x, group: 'servicios' })),
      ...budget.medios.map((x) => ({ ...x, group: 'medios' })),
      ...budget.produccion.map((x) => ({ ...x, group: 'produccion' })),
    ].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    return {
      rows: all,
      totals: {
        servicios: sum(budget.servicios),
        medios: sum(budget.medios),
        produccion: sum(budget.produccion),
        general: sum(budget.servicios) + sum(budget.medios) + sum(budget.produccion),
        pendiente: all.filter((x) => x.status !== 'pagado').reduce((s, x) => s + (x.amount || 0), 0),
      },
    };
  }, [budget]);

  const copy = (text) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="ps-card">
      {/* Total destacado */}
      <div className="ps-summary">
        <div className="ps-summary-main">
          <span className="ps-summary-lbl">Total a transferir este mes</span>
          <span className="ps-summary-amount">{fmtMoney(totals.pendiente)}</span>
        </div>
        <button className="ps-bank-btn" onClick={() => setShowBank(!showBank)}>
          {showBank ? 'Ocultar datos bancarios' : 'Ver datos bancarios — cuánto y a dónde transferir'}
        </button>
      </div>

      {/* Datos bancarios (detrás del botón) */}
      {showBank && (
        <div className="ps-bank">
          <div className="ps-bank-amount">
            Transferir <strong>{fmtMoney(totals.pendiente)}</strong>
          </div>
          <div className="ps-bank-grid">
            <div className="ps-bank-row">
              <span>Titular</span>
              <strong>{budget.bankInfo.titular}</strong>
            </div>
            <div className="ps-bank-row">
              <span>Alias</span>
              <div className="ps-bank-copy">
                <strong>{budget.bankInfo.alias}</strong>
                <button onClick={() => copy(budget.bankInfo.alias)}>Copiar</button>
              </div>
            </div>
            <div className="ps-bank-row">
              <span>CBU / CVU</span>
              <div className="ps-bank-copy">
                <strong className="ps-mono">{budget.bankInfo.cbu}</strong>
                <button onClick={() => copy(budget.bankInfo.cbu)}>Copiar</button>
              </div>
            </div>
          </div>
          {budget.bankInfo.observaciones && (
            <div className="ps-bank-obs">{budget.bankInfo.observaciones}</div>
          )}
          {copied && <div className="ps-copied">✓ Copiado</div>}
        </div>
      )}

      {/* Flujo de pagos por fecha */}
      <div className="ps-flow-title">Calendario de pagos</div>
      <div className="ps-flow">
        {rows.map((p, i) => {
          const st = STATUS[p.status] || STATUS.pendiente;
          return (
            <div key={i} className="ps-flow-item">
              <div className="ps-flow-date">
                <span className="ps-flow-day">{fmtDate(p.dueDate)}</span>
              </div>
              <div className="ps-flow-body">
                <div className="ps-flow-concept">{p.concept}</div>
                <div className="ps-flow-group">{GROUP_LABELS[p.group]}</div>
              </div>
              <div className="ps-flow-right">
                <div className="ps-flow-amount">{fmtMoney(p.amount)}</div>
                <span className={`ps-pill ${st.cls}`}>{st.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totales por categoría */}
      <div className="ps-totals">
        <div><span>Servicios</span><strong>{fmtMoney(totals.servicios)}</strong></div>
        <div><span>Medios</span><strong>{fmtMoney(totals.medios)}</strong></div>
        <div><span>Producción</span><strong>{fmtMoney(totals.produccion)}</strong></div>
        <div className="ps-total-general"><span>Total general</span><strong>{fmtMoney(totals.general)}</strong></div>
      </div>
    </div>
  );
}
