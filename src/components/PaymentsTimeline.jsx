import React, { useMemo } from 'react';
import './PaymentsTimeline.css';

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

export default function PaymentsTimeline({ budget }) {
  const { startItems, postItems, startTotal, postTotal } = useMemo(() => {
    const econInicio = budget.economico.filter((x) => x.phase === 'inicio');
    const econPost = budget.economico.filter((x) => x.phase === 'post');
    const finInicio = budget.financiero.filter((x) => x.phase === 'inicio');

    // 1 al 5: financiero (mes pasado) + económico de inicio
    const startItems = [
      ...finInicio.map((x) => ({ ...x, financial: true })),
      ...econInicio,
    ];
    const startTotal = econInicio.reduce((s, x) => s + (x.amount || 0), 0);
    const postTotal = econPost.reduce((s, x) => s + (x.amount || 0), 0);
    return { startItems, postItems: econPost, startTotal, postTotal };
  }, [budget]);

  return (
    <div className="pt-wrap">
      {/* 1 al 5 de junio */}
      <div className="pt-phase">
        <div className="pt-phase-head">
          <span className="pt-phase-badge pt-phase-badge--start">1 – 5 de junio</span>
        </div>
        <div className="pt-phase-sub">Pagos de inicio de mes</div>

        <div className="pt-items">
          {startItems.map((it, i) => (
            <div key={i} className={`pt-item ${it.financial ? 'pt-item--fin' : ''}`}>
              <div className="pt-item-left">
                <span className="pt-item-concept">{it.concept}</span>
                {it.detail && <span className="pt-item-detail">{it.detail}</span>}
              </div>
              <strong className="pt-item-amount">{fmtMoney(it.amount)}</strong>
            </div>
          ))}
        </div>

        <div className="pt-note">
          ⓘ Los conceptos marcados <strong>(mes pasado)</strong> corresponden al
          presupuesto <strong>financiero</strong>, no al económico del mes. Por eso no
          se suman al presupuesto del mes.
        </div>
      </div>

      {/* Post día 30 */}
      <div className="pt-phase pt-phase--post">
        <div className="pt-phase-head">
          <span className="pt-phase-badge pt-phase-badge--post">Post día 30 — mes vencido</span>
        </div>
        <div className="pt-phase-sub">
          Al cierre del mes se paga la <strong>inversión en Meta</strong> y el
          <strong> componente variable del fee de alquimia</strong>. Estos conceptos
          se abonan recién en el 1 al 5 del mes siguiente.
        </div>
        <div className="pt-items">
          {postItems.map((it, i) => (
            <div key={i} className="pt-item">
              <div className="pt-item-left">
                <span className="pt-item-concept">{it.concept}</span>
                {it.detail && <span className="pt-item-detail">{it.detail}</span>}
              </div>
              <strong className="pt-item-amount">{fmtMoney(it.amount)}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
