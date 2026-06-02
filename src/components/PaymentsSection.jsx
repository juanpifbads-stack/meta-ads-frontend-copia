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
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  } catch { return iso; }
}

const GROUPS = [
  { key: 'servicios', label: 'Servicios' },
  { key: 'medios', label: 'Medios' },
  { key: 'produccion', label: 'Producción' },
];

export default function PaymentsSection({ budget }) {
  const [showBank, setShowBank] = useState(false);
  const [copied, setCopied] = useState(false);

  const totals = useMemo(() => {
    const sum = (arr) => arr.reduce((s, x) => s + (x.amount || 0), 0);
    return {
      servicios: sum(budget.servicios),
      medios: sum(budget.medios),
      produccion: sum(budget.produccion),
      general: sum(budget.servicios) + sum(budget.medios) + sum(budget.produccion),
    };
  }, [budget]);

  const copy = (text) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="ps-card">
      {/* Inversiones discriminadas por categoría */}
      {GROUPS.map((g) => (
        <div key={g.key} className="ps-group">
          <div className="ps-group-head">
            <span className="ps-group-label">{g.label}</span>
            <span className="ps-group-total">{fmtMoney(totals[g.key])}</span>
          </div>
          {budget[g.key].map((item, i) => (
            <div key={i} className="ps-line">
              <div className="ps-line-left">
                <span className="ps-line-concept">{item.concept}</span>
                {item.postMonth && <span className="ps-tag-post">post día 30</span>}
              </div>
              <div className="ps-line-right">
                <span className="ps-line-date">{fmtDate(item.dueDate)}</span>
                <span className="ps-line-amount">{fmtMoney(item.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Total general */}
      <div className="ps-general">
        <span>Total general del mes</span>
        <strong>{fmtMoney(totals.general)}</strong>
      </div>

      {/* Botón datos para transferir */}
      <button className="ps-bank-btn" onClick={() => setShowBank(!showBank)}>
        {showBank ? 'Ocultar datos para transferir' : 'Ver datos para transferir'}
      </button>

      {showBank && (
        <div className="ps-bank">
          <div className="ps-bank-amount">
            Total a transferir <strong>{fmtMoney(totals.general)}</strong>
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
    </div>
  );
}
