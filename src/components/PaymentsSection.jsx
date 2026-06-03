import React, { useState, useMemo } from 'react';
import { fmtMoney, fmtTotals, sumByCurrency, variableAmount } from '../utils/budget.js';
import './PaymentsSection.css';

// Texto del monto de un ítem (resuelve breakdown / variable / a definir)
function itemAmountText(item, budget, facturacion) {
  if (item.isVariable) return fmtMoney(variableAmount(budget, facturacion), 'ARS');
  if (item.variableMonto) return 'según consumo';
  if (item.breakdown) {
    const t = sumByCurrency([item], { budget, facturacion });
    return fmtTotals(t);
  }
  return fmtMoney(item.amount, item.currency);
}

function Column({ title, accent, groups, budget, facturacion, total }) {
  return (
    <div className={`ps-col ps-col--${accent}`}>
      <div className="ps-col-title">{title}</div>
      {groups.map((g, gi) => (
        <div key={gi} className="ps-col-group">
          <div className="ps-col-group-label">{g.label}</div>
          {g.items.map((it, i) => (
            <div key={i} className="ps-col-line">
              <div className="ps-col-line-left">
                <span>{it.concept}</span>
                {it.detail && <span className="ps-col-line-detail">{it.detail}</span>}
              </div>
              <span className="ps-col-line-amount">{itemAmountText(it, budget, facturacion)}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="ps-col-total">
        <span>Total</span>
        <strong>{fmtTotals(total)}</strong>
      </div>
    </div>
  );
}

export default function PaymentsSection({ budget, facturacion = 0 }) {
  const [showBank, setShowBank] = useState(false);
  const [copied, setCopied] = useState(null);

  const { econGroups, finGroups, econTotal, finTotal } = useMemo(() => {
    const inicio = budget.items.filter((x) => x.phase === 'inicio');
    const fin = budget.items.filter((x) => x.phase === 'fin');
    const post = budget.items.filter((x) => x.phase === 'post');

    // Económico: costo del servicio según el mes
    const econGroups = [
      { label: '1 al 5', items: inicio },
      { label: '29 al 30', items: fin },
      { label: 'Post día 30', items: post },
    ].filter((g) => g.items.length);

    // Financiero: idéntico, pero medios + variable se pagan en el 1 al 5 (mes pasado)
    const finGroups = [
      { label: '1 al 5', items: [...inicio, ...post.map((p) => ({ ...p, detail: 'mes pasado' }))] },
      { label: '29 al 30', items: fin },
    ].filter((g) => g.items.length);

    const all = budget.items;
    return {
      econGroups,
      finGroups,
      econTotal: sumByCurrency(all, { budget, facturacion }),
      finTotal: sumByCurrency(all, { budget, facturacion }),
    };
  }, [budget, facturacion]);

  const copy = (text, label) => {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="ps-card">
      <div className="ps-compare">
        <Column title="Presupuesto económico" accent="econ" groups={econGroups} budget={budget} facturacion={facturacion} total={econTotal} />
        <Column title="Presupuesto financiero" accent="fin" groups={finGroups} budget={budget} facturacion={facturacion} total={finTotal} />
      </div>

      <div className="ps-compare-note">
        El <strong>económico</strong> es el costo del servicio del mes. El <strong>financiero</strong> es
        el flujo de caja real: en el 1 al 5 se abonan además los consumos de Meta y TikTok y el
        componente variable del mes anterior.
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
