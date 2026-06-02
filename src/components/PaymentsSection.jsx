import React, { useState, useMemo } from 'react';
import './PaymentsSection.css';

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

export default function PaymentsSection({ budget }) {
  const [showBank, setShowBank] = useState(false);
  const [copied, setCopied] = useState(null);

  const econTotal = useMemo(
    () => budget.economico.reduce((s, x) => s + (x.amount || 0), 0),
    [budget]
  );
  const finTotal = useMemo(
    () => budget.financiero.reduce((s, x) => s + (x.amount || 0), 0),
    [budget]
  );

  const copy = (text, label) => {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="ps-card">
      {/* Económico */}
      <div className="ps-group">
        <div className="ps-group-head">
          <span className="ps-group-label">Presupuesto económico del mes</span>
        </div>
        {budget.economico.map((item, i) => (
          <div key={i} className="ps-line">
            <div className="ps-line-left">
              <span className="ps-line-concept">{item.concept}</span>
              {item.detail && <span className="ps-line-detail">{item.detail}</span>}
              {item.phase === 'post' && <span className="ps-tag-post">post día 30</span>}
            </div>
            <span className="ps-line-amount">{fmtMoney(item.amount)}</span>
          </div>
        ))}
        <div className="ps-group-total">
          <span>Total presupuesto del mes</span>
          <strong>{fmtMoney(econTotal)}</strong>
        </div>
      </div>

      {/* Financiero (mes pasado) */}
      <div className="ps-group ps-group--fin">
        <div className="ps-group-head">
          <span className="ps-group-label">Financiero — mes pasado</span>
        </div>
        {budget.financiero.map((item, i) => (
          <div key={i} className="ps-line">
            <div className="ps-line-left">
              <span className="ps-line-concept">{item.concept}</span>
              {item.detail && <span className="ps-line-detail">{item.detail}</span>}
            </div>
            <span className="ps-line-amount">{fmtMoney(item.amount)}</span>
          </div>
        ))}
        <div className="ps-fin-note">
          No suma al presupuesto del mes — corresponde a pagos financieros del mes anterior.
        </div>
      </div>

      {/* Botón transferir */}
      <button className="ps-bank-btn" onClick={() => setShowBank(!showBank)}>
        {showBank ? 'Ocultar datos para transferir' : 'Ver datos para transferir'}
      </button>

      {showBank && (
        <div className="ps-bank">
          <div className="ps-bank-amount">
            <span>A transferir este mes</span>
            <strong>{fmtMoney(econTotal + finTotal)}</strong>
          </div>
          <div className="ps-bank-grid">
            <div className="ps-bank-row">
              <span className="ps-bank-lbl">Titular</span>
              <strong>{budget.bankInfo.titular}</strong>
            </div>
            <div className="ps-bank-row">
              <span className="ps-bank-lbl">Alias</span>
              <div className="ps-bank-copy">
                <strong>{budget.bankInfo.alias}</strong>
                <button onClick={() => copy(budget.bankInfo.alias, 'alias')}>
                  {copied === 'alias' ? '✓' : 'Copiar'}
                </button>
              </div>
            </div>
            <div className="ps-bank-row">
              <span className="ps-bank-lbl">CBU / CVU</span>
              <div className="ps-bank-copy">
                <strong className="ps-mono">{budget.bankInfo.cbu}</strong>
                <button onClick={() => copy(budget.bankInfo.cbu, 'cbu')}>
                  {copied === 'cbu' ? '✓' : 'Copiar'}
                </button>
              </div>
            </div>
          </div>
          {budget.bankInfo.observaciones && (
            <div className="ps-bank-obs">{budget.bankInfo.observaciones}</div>
          )}
        </div>
      )}
    </div>
  );
}
