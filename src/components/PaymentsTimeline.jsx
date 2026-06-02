import React, { useMemo } from 'react';
import './PaymentsTimeline.css';

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

function dayOf(iso) {
  try { return new Date(iso + 'T00:00:00').getDate(); } catch { return null; }
}

export default function PaymentsTimeline({ budget }) {
  const { early, post } = useMemo(() => {
    const all = [
      ...budget.servicios,
      ...budget.medios,
      ...budget.produccion,
    ];
    const early = all.filter((x) => !x.postMonth).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const post = all.filter((x) => x.postMonth);
    return { early, post };
  }, [budget]);

  const earlyTotal = early.reduce((s, x) => s + (x.amount || 0), 0);
  const postTotal = post.reduce((s, x) => s + (x.amount || 0), 0);

  // Agrupar pagos tempranos por día
  const byDay = useMemo(() => {
    const map = new Map();
    for (const p of early) {
      const d = dayOf(p.dueDate);
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(p);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [early]);

  return (
    <div className="pt-wrap">
      {/* Bloque inicio de mes */}
      <div className="pt-phase">
        <div className="pt-phase-head">
          <span className="pt-phase-badge pt-phase-badge--start">1 – 5 de junio</span>
          <span className="pt-phase-total">{fmtMoney(earlyTotal)}</span>
        </div>
        <div className="pt-phase-sub">Pagos de inicio de mes</div>

        <div className="pt-line">
          {byDay.map(([day, items]) => (
            <div key={day} className="pt-node">
              <div className="pt-node-day">{day} jun</div>
              <div className="pt-node-dot" />
              <div className="pt-node-items">
                {items.map((it, i) => (
                  <div key={i} className="pt-node-item">
                    <span>{it.concept}</span>
                    <strong>{fmtMoney(it.amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bloque fin de mes */}
      <div className="pt-phase pt-phase--post">
        <div className="pt-phase-head">
          <span className="pt-phase-badge pt-phase-badge--post">Post día 30</span>
          <span className="pt-phase-total">{fmtMoney(postTotal)}</span>
        </div>
        <div className="pt-phase-sub">
          Al cierre del mes se paga la inversión en Meta y el componente variable del fee de alquimia.
        </div>
        <div className="pt-post-items">
          {post.map((it, i) => (
            <div key={i} className="pt-node-item">
              <span>{it.concept}</span>
              <strong>{fmtMoney(it.amount)}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
