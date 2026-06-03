import React, { useState, useMemo } from 'react';
import { fmtMoney, fmtTotals, sumByCurrency } from '../utils/budget.js';
import BankBlock from './BankBlock.jsx';
import './PaymentsSection.css';

const PHASE_TAG = {
  inicio: '1 al 5 jun',
  fin: '29 al 30 jun',
  post: 'post día 30',
};

function itemAmountText(item, budget, facturacion) {
  if (item.isVariable) return 'según facturación del mes';
  if (item.variableMonto) return 'según consumo';
  if (item.breakdown) return fmtTotals(sumByCurrency([item], { budget, facturacion }));
  return fmtMoney(item.amount, item.currency);
}

function PsSub({ b, varProjected, objetivo, base }) {
  const [showCalc, setShowCalc] = useState(false);
  const diff = Math.max(0, (objetivo || 0) - (base || 0));
  return (
    <div className="ps-sub-wrap">
      <div className="ps-sub">
        <div className="ps-sub-left">
          <span className={b.bonificado ? 'ps-sub-concept ps-strike' : 'ps-sub-concept'}>{b.concept}</span>
          {b.detail && <span className="ps-sub-detail">{b.detail}</span>}
          {b.isVariable && <span className="ps-sub-detail">según facturación del mes actual — proyectado si se cumple el objetivo</span>}
          {b.isVariable && (
            <button className="ps-calc-btn" onClick={() => setShowCalc((s) => !s)}>
              {showCalc ? 'Ocultar cálculo' : 'ⓘ Cómo se calcula'}
            </button>
          )}
        </div>
        <div className="ps-sub-right">
          {b.isVariable
            ? <span>{fmtMoney(varProjected, 'ARS')}</span>
            : <span className={b.bonificado ? 'ps-strike' : ''}>{fmtMoney(b.amount, b.currency)}</span>}
          {b.bonificado && <span className="ps-bonif">{b.bonificado}</span>}
        </div>
      </div>
      {b.isVariable && showCalc && (
        <div className="ps-calc">
          <div className="ps-calc-row"><span>Objetivo de facturación del mes</span><strong>{fmtMoney(objetivo, 'ARS')}</strong></div>
          <div className="ps-calc-row"><span>− Base fija</span><strong>− {fmtMoney(base, 'ARS')}</strong></div>
          <div className="ps-calc-row ps-calc-sub"><span>= Diferencial</span><strong>{fmtMoney(diff, 'ARS')}</strong></div>
          <div className="ps-calc-row ps-calc-total"><span>× 3%</span><strong>{fmtMoney(diff * 0.03, 'ARS')}</strong></div>
        </div>
      )}
    </div>
  );
}

function EconLine({ item, budget, facturacion, varProjected, objetivo, base }) {
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
            <PsSub key={i} b={b} varProjected={varProjected} objetivo={objetivo} base={base} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PaymentsSection({ budget, facturacion = 0, objetivo = 0, showTransfer = false }) {
  const [showBank, setShowBank] = useState(false);

  const base = budget.variable?.base || 0;
  const rate = budget.variable?.rate || 0;
  const varProjected = Math.max(0, objetivo - base) * rate;

  const total = useMemo(
    () => sumByCurrency(budget.items, { budget, facturacion }),
    [budget, facturacion]
  );

  return (
    <div className="ps-card">
      <div className="ps-econ">
        {budget.items.map((it, i) => (
          <EconLine key={i} item={it} budget={budget} facturacion={facturacion} varProjected={varProjected} objetivo={objetivo} base={base} />
        ))}
        <div className="ps-econ-total">
          <span>Total presupuesto del mes</span>
          <strong>{fmtTotals(total)}</strong>
        </div>
      </div>

      {showTransfer && (
        <>
          <button className="ps-bank-btn" onClick={() => setShowBank(!showBank)}>
            {showBank ? 'Ocultar datos para transferir' : 'Ver datos para transferir'}
          </button>
          {showBank && <BankBlock bankInfo={budget.bankInfo} />}
        </>
      )}
    </div>
  );
}
