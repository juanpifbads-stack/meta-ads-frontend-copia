import React, { useState } from 'react';
import { fmtMoney, variableAmount } from '../utils/budget.js';
import './PaymentsTimeline.css';

const PHASES = [
  { key: 'inicio', label: '1 – 5 de junio', sub: 'Pagos de inicio de mes', cls: 'start' },
  { key: 'fin', label: '29 – 30 de junio', sub: 'Cierre de mes', cls: 'mid' },
  { key: 'post', label: 'Post día 30 — mes vencido', sub: 'Se abona en el 1 al 5 del mes siguiente', cls: 'post' },
];

function ItemLine({ item, budget, facturacion }) {
  const [open, setOpen] = useState(false);

  // Monto a mostrar a la derecha
  let amountNode;
  if (item.isVariable) {
    amountNode = <strong className="pt-item-amount">{fmtMoney(variableAmount(budget, facturacion), 'ARS')}</strong>;
  } else if (item.variableMonto) {
    amountNode = <span className="pt-item-variable">según consumo</span>;
  } else if (item.breakdown) {
    amountNode = <span className="pt-item-toggle">{open ? 'Ocultar −' : 'Ver desglose +'}</span>;
  } else {
    amountNode = <strong className="pt-item-amount">{fmtMoney(item.amount, item.currency)}</strong>;
  }

  const clickable = !!item.breakdown;

  return (
    <div className={`pt-item-wrap ${clickable ? 'pt-item-wrap--click' : ''}`}>
      <div className="pt-item" onClick={clickable ? () => setOpen(!open) : undefined}>
        <div className="pt-item-left">
          <span className="pt-item-concept">{item.concept}</span>
          {item.detail && <span className="pt-item-detail">{item.detail}</span>}
        </div>
        {amountNode}
      </div>
      {open && item.breakdown && (
        <div className="pt-breakdown">
          {item.breakdown.map((b, i) => (
            <div key={i} className="pt-sub">
              <div className="pt-sub-left">
                <span className={b.bonificado ? 'pt-sub-concept pt-strike' : 'pt-sub-concept'}>{b.concept}</span>
                {b.detail && <span className="pt-sub-detail">{b.detail}</span>}
              </div>
              <div className="pt-sub-right">
                <span className={b.bonificado ? 'pt-strike' : ''}>{fmtMoney(b.amount, b.currency)}</span>
                {b.bonificado && <span className="pt-bonif">{b.bonificado}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PaymentsTimeline({ budget, facturacion }) {
  return (
    <div className="pt-wrap">
      {PHASES.map((ph) => {
        const items = budget.items.filter((it) => it.phase === ph.key);
        if (!items.length) return null;
        return (
          <div key={ph.key} className={`pt-phase pt-phase--${ph.cls}`}>
            <div className="pt-phase-head">
              <span className={`pt-phase-badge pt-phase-badge--${ph.cls}`}>{ph.label}</span>
            </div>
            <div className="pt-phase-sub">{ph.sub}</div>
            <div className="pt-items">
              {items.map((it, i) => (
                <ItemLine key={i} item={it} budget={budget} facturacion={facturacion} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
