import React, { useState } from 'react';
import { fmtMoney } from '../utils/budget.js';
import BankBlock from './BankBlock.jsx';
import './PaymentsTimeline.css';

const PHASES = [
  { key: 'inicio', label: '1 – 5 de junio', sub: 'Pagos de inicio de mes. Incluye los consumos de Meta y TikTok y el componente variable del mes pasado.', cls: 'start' },
  { key: 'fin', label: '29 – 30 de junio', sub: 'Cierre de mes', cls: 'mid' },
  { key: 'post', label: 'Post día 30 — mes vencido', sub: 'Inversión y variable de este mes. Se abona en el 1 al 5 del mes siguiente.', cls: 'post' },
];

function SubLine({ b }) {
  const [showTransfer, setShowTransfer] = useState(false);
  const canTransfer = b.bankInfo && !b.bonificado;
  return (
    <div className="pt-sub-wrap">
      <div className="pt-sub">
        <div className="pt-sub-left">
          <span className={b.bonificado ? 'pt-sub-concept pt-strike' : 'pt-sub-concept'}>{b.concept}</span>
          {b.detail && <span className="pt-sub-detail">{b.detail}</span>}
        </div>
        <div className="pt-sub-right">
          <span className={b.bonificado ? 'pt-strike' : ''}>{fmtMoney(b.amount, b.currency)}</span>
          {b.bonificado && <span className="pt-bonif">{b.bonificado}</span>}
        </div>
      </div>
      {canTransfer && (
        <div className="pt-transfer">
          <button className="pt-transfer-btn" onClick={() => setShowTransfer(!showTransfer)}>
            {showTransfer ? 'Ocultar datos' : 'Datos para transferir →'}
          </button>
          {showTransfer && <BankBlock bankInfo={b.bankInfo} />}
        </div>
      )}
    </div>
  );
}

function ItemLine({ item, budget, facturacion }) {
  const [open, setOpen] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const bankInfo = item.bankInfo || budget.bankInfo;
  // No mostrar transferir en: ítems con desglose (cada sub-ítem tiene el suyo),
  // medios (Meta/TikTok) ni el variable de este mes (post 30, no sale este mes)
  const canTransfer = bankInfo && !item.breakdown && !item.media && !(item.isVariable && item.period === 'presente');

  // Monto a mostrar a la derecha
  let amountNode;
  if (item.isVariable) {
    const txt = item.period === 'pasado'
      ? 'según facturación del mes pasado'
      : 'según facturación de junio';
    amountNode = <span className="pt-item-variable">{txt}</span>;
  } else if (item.media && item.period === 'pasado') {
    amountNode = <span className="pt-item-variable">inversión del mes pasado</span>;
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
          {item.period && (
            <span className={`pt-period pt-period--${item.period}`}>
              {item.period === 'pasado' ? 'Corresponde al mes pasado' : 'Corresponde a junio (mes presente)'}
            </span>
          )}
        </div>
        {amountNode}
      </div>
      {open && item.breakdown && (
        <div className="pt-breakdown">
          {item.breakdown.map((b, i) => <SubLine key={i} b={b} />)}
        </div>
      )}
      {canTransfer && (
        <div className="pt-transfer">
          <button className="pt-transfer-btn" onClick={() => setShowTransfer(!showTransfer)}>
            {showTransfer ? 'Ocultar datos para transferir' : 'Datos para transferir →'}
          </button>
          {showTransfer && <BankBlock bankInfo={bankInfo} />}
        </div>
      )}
    </div>
  );
}

export default function PaymentsTimeline({ budget, facturacion }) {
  // Ítems de medios + variable de este mes (se pagan el mes que viene)
  const postItems = budget.items.filter((it) => it.phase === 'post');
  // Versión "mes pasado": lo que efectivamente se paga AHORA en el 1 al 5
  const mesPasado = postItems.map((it) => ({ ...it, period: 'pasado' }));

  return (
    <div className="pt-wrap">
      {PHASES.map((ph) => {
        let items = budget.items.filter((it) => it.phase === ph.key);
        // En el financiero, el 1 al 5 incluye los medios + variable del mes pasado
        if (ph.key === 'inicio') items = [...items, ...mesPasado];
        // Los ítems del bloque post corresponden al mes presente (junio)
        if (ph.key === 'post') items = items.map((it) => ({ ...it, period: 'presente' }));
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
