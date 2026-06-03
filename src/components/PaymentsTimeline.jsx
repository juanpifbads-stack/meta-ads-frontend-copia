import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../api/client.js';
import BankBlock from './BankBlock.jsx';
import './PaymentsTimeline.css';

const PHASES = [
  { key: 'inicio', label: '1 – 5 de junio', sub: 'Pagos de inicio de mes. Incluye los consumos de Meta y TikTok y el componente variable del mes pasado.', cls: 'start' },
  { key: 'fin', label: '29 – 30 de junio', sub: 'Cierre de mes', cls: 'mid' },
  { key: 'post', label: 'Post día 30 — mes vencido', sub: 'Inversión y variable de este mes. Se abona en el 1 al 5 del mes siguiente.', cls: 'post' },
];

function convert(amount, from, to, fx) {
  if (amount == null || isNaN(amount)) return null;
  if (from === to || !fx) return from === to ? amount : amount;
  if (from === 'USD' && to === 'ARS') return amount * fx;
  if (from === 'ARS' && to === 'USD') return amount / fx;
  return amount;
}
function money(n, cur) {
  if (n == null || isNaN(n)) return '—';
  if (cur === 'USD') return 'USD ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

/* monto efectivo de un ítem/sub-ítem en moneda destino */
function effective(it, ctx) {
  if (it.bonificado) return 0;
  if (it.isVariable) return convert(ctx.variableAmount, 'ARS', ctx.cur, ctx.fx);
  if (it.editable) {
    const v = ctx.amounts[it.id] != null ? ctx.amounts[it.id] : (it.amount || 0);
    return convert(v, it.currency || 'ARS', ctx.cur, ctx.fx);
  }
  return convert(it.amount || 0, it.currency || 'ARS', ctx.cur, ctx.fx);
}

function SubLine({ b, ctx }) {
  const [showTransfer, setShowTransfer] = useState(false);
  const canTransfer = b.bankInfo && !b.bonificado;
  let right;
  if (b.isVariable) {
    right = <span className="pt-item-amount">{money(effective(b, ctx), ctx.cur)}</span>;
  } else if (b.bonificado) {
    right = <span className="pt-strike">{money(convert(b.amount, b.currency, ctx.cur, ctx.fx), ctx.cur)}</span>;
  } else {
    right = <span>{money(convert(b.amount, b.currency, ctx.cur, ctx.fx), ctx.cur)}</span>;
  }
  return (
    <div className="pt-sub-wrap">
      <div className="pt-sub">
        <div className="pt-sub-left">
          <span className={b.bonificado ? 'pt-sub-concept pt-strike' : 'pt-sub-concept'}>{b.concept}</span>
          {b.detail && <span className="pt-sub-detail">{b.detail}</span>}
          {b.isVariable && <span className="pt-sub-detail">según facturación del mes pasado</span>}
        </div>
        <div className="pt-sub-right">
          {right}
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

function ItemLine({ item, ctx }) {
  const [open, setOpen] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const bankInfo = item.bankInfo || ctx.bankInfo;
  const canTransfer = bankInfo && !item.breakdown && !item.media && !item.editable;
  const paid = !!ctx.paid[item.id];

  // monto a la derecha
  let amountNode;
  if (item.media && item.period === 'pasado') {
    amountNode = <span className="pt-item-variable">inversión del mes pasado</span>;
  } else if (item.editable) {
    amountNode = (
      <div className="pt-edit">
        <span className="pt-edit-cur">$</span>
        <input
          className="pt-edit-input"
          type="number"
          value={ctx.amounts[item.id] != null ? ctx.amounts[item.id] : (item.amount || '')}
          placeholder="0"
          onChange={(e) => ctx.setAmount(item.id, e.target.value === '' ? 0 : parseFloat(e.target.value))}
        />
      </div>
    );
  } else if (item.breakdown) {
    // total del fee (suma del desglose en moneda destino)
    const total = item.breakdown.reduce((s, b) => s + (effective(b, ctx) || 0), 0);
    amountNode = (
      <div className="pt-fee-right">
        <span className="pt-item-amount">{money(total, ctx.cur)}</span>
        <span className="pt-item-toggle">{open ? 'Ocultar −' : 'Ver desglose +'}</span>
      </div>
    );
  } else {
    amountNode = <strong className="pt-item-amount">{money(effective(item, ctx), ctx.cur)}</strong>;
  }

  const clickable = !!item.breakdown;

  return (
    <div className={`pt-item-wrap ${clickable ? 'pt-item-wrap--click' : ''} ${paid ? 'pt-item-wrap--paid' : ''}`}>
      <div className="pt-item" onClick={clickable ? () => setOpen(!open) : undefined}>
        <div className="pt-item-left">
          <div className="pt-item-title-row">
            {item.id && (
              <label className="pt-paid" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={paid} onChange={() => ctx.togglePaid(item.id)} />
                <span>{paid ? 'Pagado' : 'Pagar'}</span>
              </label>
            )}
            <span className="pt-item-concept">{item.concept}</span>
          </div>
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
          {item.breakdown.map((b, i) => <SubLine key={i} b={b} ctx={ctx} />)}
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

export default function PaymentsTimeline({ budget, slug, accessKey }) {
  const [cur, setCur] = useState('USD');
  const [fx, setFx] = useState(null);
  const [prevRevenue, setPrevRevenue] = useState(0);
  const [state, setState] = useState({ paid: {}, amounts: {} });

  useEffect(() => {
    let alive = true;
    apiClient.get('/public/fx').then((r) => { if (alive) setFx(r.data?.venta || null); }).catch(() => {});
    apiClient.get(`/public/${slug}/tiendanube`, { params: { key: accessKey }, timeout: 60000 })
      .then((r) => { if (alive && r.data?.prevRevenue != null) setPrevRevenue(r.data.prevRevenue); }).catch(() => {});
    apiClient.get(`/budget/${slug}`, { params: { key: accessKey } })
      .then((r) => { if (alive && r.data?.data) setState({ paid: r.data.data.paid || {}, amounts: r.data.data.amounts || {} }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug, accessKey]);

  const variableAmount = useMemo(() => {
    const base = budget.variable?.base || 0;
    const rate = budget.variable?.rate || 0;
    return Math.max(0, (prevRevenue || 0) - base) * rate;
  }, [prevRevenue, budget.variable]);

  const save = (next) => {
    setState(next);
    apiClient.patch(`/budget/${slug}`, { key: accessKey, data: next }).catch(() => {});
  };
  const togglePaid = (id) => save({ ...state, paid: { ...state.paid, [id]: !state.paid[id] } });
  const setAmount = (id, val) => setState((s) => ({ ...s, amounts: { ...s.amounts, [id]: val } }));
  const flushAmount = () => apiClient.patch(`/budget/${slug}`, { key: accessKey, data: state }).catch(() => {});

  const ctx = { cur, fx, variableAmount, paid: state.paid, amounts: state.amounts, togglePaid, setAmount, bankInfo: budget.bankInfo };

  const postItems = budget.items.filter((it) => it.phase === 'post');
  const mesPasado = postItems.map((it) => ({ ...it, period: 'pasado' }));

  return (
    <div className="pt-wrap" onBlur={flushAmount}>
      {/* Selector de moneda */}
      <div className="pt-cur">
        <span className="pt-cur-lbl">Mostrar en</span>
        <button className={`pt-cur-btn ${cur === 'USD' ? 'pt-cur-btn--active' : ''}`} onClick={() => setCur('USD')}>USD</button>
        <button className={`pt-cur-btn ${cur === 'ARS' ? 'pt-cur-btn--active' : ''}`} onClick={() => setCur('ARS')}>ARS</button>
        {cur === 'ARS' && <span className="pt-cur-fx">{fx ? `dólar oficial $${fx}` : 'sin cotización'}</span>}
      </div>

      {PHASES.map((ph) => {
        let items = budget.items.filter((it) => it.phase === ph.key);
        if (ph.key === 'inicio') items = [...items, ...mesPasado];
        if (ph.key === 'post') items = items.map((it) => ({ ...it, period: 'presente' }));
        if (!items.length) return null;
        return (
          <div key={ph.key} className={`pt-phase pt-phase--${ph.cls}`}>
            <div className="pt-phase-head">
              <span className={`pt-phase-badge pt-phase-badge--${ph.cls}`}>{ph.label}</span>
            </div>
            <div className="pt-phase-sub">{ph.sub}</div>
            <div className="pt-items">
              {items.map((it, i) => <ItemLine key={i} item={it} ctx={ctx} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
