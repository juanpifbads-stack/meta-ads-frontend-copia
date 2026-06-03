import React, { useState, useMemo } from 'react';
import { fmtMoney, fmtTotals, sumByCurrency, variableAmount } from '../utils/budget.js';
import './PaymentsSection.css';

const PHASE_TAG = {
  inicio: '1 al 5 jun',
  fin: '29 al 30 jun',
  post: 'post día 30',
};

function itemAmountText(item, budget, facturacion) {
  if (item.isVariable) return fmtMoney(variableAmount(budget, facturacion), 'ARS');
  if (item.variableMonto) return 'según consumo';
  if (item.breakdown) return fmtTotals(sumByCurrency([item], { budget, facturacion }));
  return fmtMoney(item.amount, item.currency);
}

function EconLine({ item, budget, facturacion }) {
  const [open, setOpen] = useState(false);
  const clickable = !!item.breakdown;
  return (
    <div className="ps-line-wrap">
      <div className={`ps-line ${clickable ? 'ps-line--click' : ''}`} onClick={clickable ? () => setOpen(!open) : undefined}>
        <div className="ps-line-left">
          <span className="ps-line-concept">{item.concept}</span>
          {item.detail && <span className="ps-line-detail">{item.detail}</span>}
          <span className={`ps-when ps-when--${item.phase}`}>{PHASE_TAG[item.phase]}</span>
        </div>
        <div className="ps-line-right">
          {clickable
            ? <span className="ps-toggle">{open ? 'Ocultar −' : 'Ver desglose +'}</span>
            : <span className="ps-line-amount">{itemAmountText(item, budget, facturacion)}</span>}
        </div>
      </div>
      {open && item.breakdown && (
        <div className="ps-breakdown">
          {item.breakdown.map((b, i) => (
            <div key={i} className="ps-sub">
              <div className="ps-sub-left">
                <span className={b.bonificado ? 'ps-sub-concept ps-strike' : 'ps-sub-concept'}>{b.concept}</span>
                {b.detail && <span className="ps-sub-detail">{b.detail}</span>}
              </div>
              <div className="ps-sub-right">
                <span className={b.bonificado ? 'ps-strike' : ''}>{fmtMoney(b.amount, b.currency)}</span>
                {b.bonificado && <span className="ps-bonif">{b.bonificado}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PaymentsSection({ budget, facturacion = 0 }) {
  const [showBank, setShowBank] = useState(false);
  const [copied, setCopied] = useState(null);

  const total = useMemo(
    () => sumByCurrency(budget.items, { budget, facturacion }),
    [budget, facturacion]
  );

  const copy = (text, label) => {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="ps-card">
      <div className="ps-econ">
        {budget.items.map((it, i) => (
          <EconLine key={i} item={it} budget={budget} facturacion={facturacion} />
        ))}
        <div className="ps-econ-total">
          <span>Total presupuesto del mes</span>
          <strong>{fmtTotals(total)}</strong>
        </div>
      </div>

      {/* Botón transferir */}
      <button className="ps-bank-btn" onClick={() => setShowBank(!showBank)}>
        {showBank ? 'Ocultar datos para transferir' : 'Ver datos para transferir'}
      </button>

      {showBank && (
        <div className="ps-bank">
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
