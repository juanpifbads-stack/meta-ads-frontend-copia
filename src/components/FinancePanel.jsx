import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client.js';
import './FinancePanel.css';

const SERVICIOS = [
  { k: 'meta', l: 'Meta Ads' }, { k: 'tiktok', l: 'TikTok' }, { k: 'contenido', l: 'Contenido' },
  { k: 'ecommerce', l: 'Ecommerce' }, { k: 'web', l: 'Web' },
  { k: 'automatizacion', l: 'Automatización — Mantenimiento' },
  { k: 'automatizacion_impl', l: 'Automatización — Implementación' },
];
const servLabel = (k) => (SERVICIOS.find((s) => s.k === k) || {}).l || k;
const currentYM = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; };
const fmt = (x) => Math.round(x || 0).toLocaleString('es-AR');
// Formato es-AR mientras se tipea: miles con punto, decimales con coma. "1234567,5" → "1.234.567,5"
function formatMiles(str) {
  const s = String(str == null ? '' : str).replace(/[^\d,]/g, ''); // deja solo dígitos y coma
  const [ent, ...rest] = s.split(',');
  const entFmt = (ent || '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return rest.length ? `${entFmt},${rest.join('')}` : entFmt;
}
// A número plano para el backend: "1.234.567,5" → "1234567.5"
const parseMiles = (str) => String(str == null ? '' : str).replace(/\./g, '').replace(',', '.');

// Origen de una entrada del ledger ("cobro:slug" / "costo:concepto" / "transferencia") → legible.
function prettyOrigin(key, cname) {
  if (!key) return '';
  const [kind, ...rest] = key.split(':');
  const val = rest.join(':');
  if (kind === 'cobro') return `cobro ${cname ? cname(val) : val}`;
  if (kind === 'costo') return `costo ${val}`;
  if (kind === 'transferencia') return 'transferencia';
  return key;
}
// Drill-down de una persona: a quién le debe (owes) y quién le debe (owed), con origen.
function LedgerDetail({ entry, disp, cons, cname }) {
  const line = (items) => items.map((it, i) => (
    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '2px 0' }}>
      <span>{it.isCaja ? '🏦 Caja' : it.party} <span className="fp-muted" style={{ fontSize: 12 }}>· {Object.keys(it.origins || {}).map((k) => prettyOrigin(k, cname)).join(', ')}</span></span>
      <strong>{cons} {fmt(disp(it.amount))}</strong>
    </div>
  ));
  const owed = entry.owed || [], owes = entry.owes || [];
  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
      <div style={{ minWidth: 240 }}>
        <div className="fp-muted" style={{ fontWeight: 700, marginBottom: 2 }}>Le deben</div>
        {owed.length ? line(owed) : <div className="fp-muted">—</div>}
      </div>
      <div style={{ minWidth: 240 }}>
        <div className="fp-muted" style={{ fontWeight: 700, marginBottom: 2 }}>Debe</div>
        {owes.length ? line(owes) : <div className="fp-muted">—</div>}
      </div>
    </div>
  );
}
// Drill-down de la caja: en manos de quién está (y a quién le debe la caja, si adelantaron costos).
function CajaDetail({ caja, disp, cons, cname }) {
  const line = (items, sign) => items.map((it, i) => (
    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '2px 0' }}>
      <span>{it.person} <span className="fp-muted" style={{ fontSize: 12 }}>· {Object.keys(it.origins || {}).map((k) => prettyOrigin(k, cname)).join(', ')}</span></span>
      <strong>{cons} {fmt(disp(it.amount))}</strong>
    </div>
  ));
  const heldBy = caja.heldBy || [], owesTo = caja.owesTo || [];
  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
      <div style={{ minWidth: 240 }}>
        <div className="fp-muted" style={{ fontWeight: 700, marginBottom: 2 }}>La tiene</div>
        {heldBy.length ? line(heldBy) : <div className="fp-muted">—</div>}
      </div>
      {owesTo.length > 0 && (
        <div style={{ minWidth: 240 }}>
          <div className="fp-muted" style={{ fontWeight: 700, marginBottom: 2 }}>La caja debe (adelantos)</div>
          {line(owesTo)}
        </div>
      )}
    </div>
  );
}

function defaultLine(servicio) {
  return {
    servicio, tipo: 'post', moneda: 'ARS', fee: '', socio_pct: 50, opex_pct: 30, opex_operador: '',
    socio_modo: 'pct', socio_monto: '', opex_modo: 'pct', opex_monto: '',
    opex_reparto: [{ persona: '', modo: 'pct', pct: 30, monto: '' }],
    setup_fee: '', setup_month: '', costos: [],
    reparto: [{ persona: '', modo: 'pct', pct: 100, monto: 0 }], variable: { modo: 'none', base: '', rate: '', fuente: 'manual' },
    cobro: { tipo: 'inicio_mes' },
  };
}

// Las líneas viejas (post) traen un solo operador en columnas sueltas. Las normalizamos a
// `opex_reparto` (lista) para que la UI muestre siempre la lista de operadores del OPEX.
function normalizePost(l) {
  if (l.tipo === 'pre') return l;
  if (Array.isArray(l.opex_reparto) && l.opex_reparto.length) return l;
  return { ...l, opex_reparto: [{ persona: l.opex_operador || '', modo: l.opex_modo || 'pct', pct: l.opex_pct ?? 30, monto: l.opex_monto ?? '' }] };
}

// Solo dígitos, punto y coma (sin spinner, sin forzar 0). El backend coacciona a número.
const numProps = { type: 'text', inputMode: 'decimal' };

// ─── Editor de un deal (se abre desde la ficha del cliente) ────────────────────
function ConfigTab({ slug, clientName, people, month, setMonth, onBack }) {
  const [lines, setLines] = useState([]);
  const [fx, setFx] = useState('');
  const [msg, setMsg] = useState('');
  const [pagaVencido, setPagaVencido] = useState(false);

  // Cargamos la config VIGENTE DEL MES elegido (así ves el fee que corresponde a ese mes).
  const loadLines = useCallback((s) => {
    if (!s) return;
    apiClient.get(`/admin/finance/services?client=${s}&month=${month}`).then((r) => { setLines((r.data.lines || []).map(normalizePost)); setPagaVencido(!!r.data.pagaVencido); }).catch(() => setLines([]));
  }, [month]);
  const toggleVencido = (val) => {
    const next = typeof val === 'boolean' ? val : !pagaVencido; setPagaVencido(next);
    apiClient.put(`/admin/finance/client-flags/${slug}`, { pagaVencido: next }).catch(() => setPagaVencido(!next));
  };
  useEffect(() => { loadLines(slug); }, [slug, month, loadLines]);
  useEffect(() => {
    apiClient.get(`/admin/finance/fx?month=${month}`).then((r) => setFx(r.data.fx ? String(r.data.fx.ars_por_usd) : '')).catch(() => {});
  }, [month]);

  const saveFx = () => apiClient.put('/admin/finance/fx', { month, arsPorUsd: parseFloat(fx) || 0 })
    .then(() => { setMsg('✓ Tipo de cambio guardado'); setTimeout(() => setMsg(''), 2000); }).catch(() => setMsg('Error'));

  const setLine = (i, patch) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const setVar = (i, patch) => setLine(i, { variable: { ...lines[i].variable, ...patch } });

  const addService = () => {
    const used = lines.map((l) => l.servicio);
    const free = SERVICIOS.find((s) => !used.includes(s.k));
    if (!free) return;
    setLines((ls) => [...ls, defaultLine(free.k)]);
  };
  // Regla: lo que cobran los operadores no puede exceder el fee mensual.
  // Pre-agencia → debe dar EXACTO el fee (no hay caja). Post → no lo supera (queda caja).
  const validateLine = (l) => {
    // Automatización: mantenimiento reparte el fee NETO de costos; implementación reparte el setup.
    const costos = l.servicio === 'automatizacion' ? (l.costos || []).reduce((s, c) => s + (Number(c.monto) || 0), 0) : 0;
    const fee = Math.max(0, (Number(l.fee) || 0) + (Number(l.setup_fee) || 0) - costos);
    if (fee <= 0) return 'Cargá el monto (fee mensual o implementación).';
    if (l.tipo === 'pre') {
      const entries = l.reparto || [];
      const fixedTot = entries.filter((e) => (e.modo || 'pct') === 'fijo').reduce((s, e) => s + (Number(e.monto) || 0), 0);
      const pcts = entries.filter((e) => (e.modo || 'pct') !== 'fijo');
      if (fixedTot > fee + 0.5) return `Los montos fijos ($${fmt(fixedTot)}) superan el fee mensual ($${fmt(fee)}).`;
      if (pcts.length) {
        const pctSum = pcts.reduce((s, e) => s + (Number(e.pct) || 0), 0);
        if (Math.abs(pctSum - 100) > 0.1) return `Los % de los operadores tienen que sumar 100 (hoy suman ${pctSum}). En pre-agencia se reparte el 100% del fee.`;
      } else if (Math.abs(fixedTot - fee) > 0.5) {
        return `Sin operadores por %, los montos fijos tienen que sumar exactamente el fee ($${fmt(fee)}). Hoy suman $${fmt(fixedTot)}.`;
      }
      return null;
    }
    // post-agencia
    const socioTot = (l.socio_modo === 'fijo') ? (Number(l.socio_monto) || 0) : fee * (Number(l.socio_pct) || 0) / 100;
    const opexRows = (l.opex_reparto && l.opex_reparto.length) ? l.opex_reparto : [{ modo: l.opex_modo, pct: l.opex_pct, monto: l.opex_monto }];
    const opex = opexRows.reduce((s, e) => s + ((e.modo === 'fijo') ? (Number(e.monto) || 0) : fee * (Number(e.pct) || 0) / 100), 0);
    if (socioTot + opex > fee + 0.5) return `Sueldo socios + OPEX ($${fmt(socioTot + opex)}) no puede superar el fee mensual ($${fmt(fee)}). La caja quedaría negativa.`;
    return null;
  };

  const saveLine = (i) => {
    const l = lines[i];
    const err = validateLine(l);
    if (err) { setMsg(err); return; }
    // Post: mantenemos las columnas legacy (opex_operador/modo/pct/monto) en sync con el
    // primer operador, así no quedan desactualizadas para quien las lea sin la lista.
    const payload = { client_slug: slug, ...l, effective_month: month };
    if (l.tipo !== 'pre') {
      const first = (l.opex_reparto && l.opex_reparto[0]) || {};
      payload.opex_operador = first.persona || '';
      payload.opex_modo = first.modo || 'pct';
      payload.opex_pct = first.pct ?? 30;
      payload.opex_monto = first.monto ?? 0;
    }
    // effective_month ata la versión al 1° del mes elegido → cada mes conserva su fee.
    apiClient.post('/admin/finance/services', payload)
      .then(() => { setMsg(`✓ ${servLabel(l.servicio)} guardado para ${month}`); setTimeout(() => setMsg(''), 2500); loadLines(slug); })
      .catch((e) => setMsg(e?.response?.data?.message || 'Error al guardar'));
  };
  const delLine = (l) => {
    if (!l.id) { setLines((ls) => ls.filter((x) => x !== l)); return; }
    apiClient.delete(`/admin/finance/services/${slug}/${l.servicio}`).then(() => loadLines(slug)).catch(() => {});
  };

  return (
    <div>
      <div className="fp-bar fp-deal-editbar">
        <button className="fp-btn" onClick={onBack}>← Volver</button>
        <strong className="fp-deal-title">{clientName}</strong>
        <label className="fp-inline" style={{ marginLeft: 'auto' }}>Mes
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>
      <p className="fp-muted" style={{ margin: '0 0 10px' }}>Guardar registra el fee desde el 1° de <strong>{month}</strong> (los meses anteriores no cambian).</p>
      {msg && <div className="fp-msg">{msg}</div>}

      {lines.map((l, i) => (
        <div className="fp-card" key={l.id || `new-${i}`}>
          <div className="fp-card-head">
            {l.id
              ? <strong>{servLabel(l.servicio)}</strong>
              : (
                <select value={l.servicio} onChange={(e) => setLine(i, { servicio: e.target.value })}>
                  {SERVICIOS.filter((s) => s.k === l.servicio || !lines.some((x, xi) => xi !== i && x.servicio === s.k))
                    .map((s) => <option key={s.k} value={s.k}>{s.l}</option>)}
                </select>
              )}
            <span className="fp-tag">{l.tipo === 'pre' ? 'pre-agencia' : 'post-agencia'}</span>
            <button className="fp-btn fp-btn--danger" style={{ marginLeft: 'auto' }} onClick={() => delLine(l)}>Quitar</button>
          </div>
          <div className="fp-grid">
            <label>Tipo<select value={l.tipo} onChange={(e) => { const tipo = e.target.value; const patch = { tipo }; if (tipo !== 'pre' && !(l.opex_reparto && l.opex_reparto.length)) patch.opex_reparto = [{ persona: l.opex_operador || '', modo: l.opex_modo || 'pct', pct: l.opex_pct ?? 30, monto: l.opex_monto ?? '' }]; setLine(i, patch); }}><option value="post">Post-agencia</option><option value="pre">Pre-agencia</option></select></label>
            <label>Moneda<select value={l.moneda} onChange={(e) => setLine(i, { moneda: e.target.value })}><option value="ARS">ARS</option><option value="USD">USD</option></select></label>
            {l.servicio !== 'automatizacion_impl' && <label>{l.servicio === 'automatizacion' ? 'Mantenimiento (mensual)' : 'Fee mensual'}<input {...numProps} value={l.fee ?? ''} onChange={(e) => setLine(i, { fee: e.target.value })} /></label>}
          </div>

          {l.servicio === 'automatizacion_impl' && (
            <div className="fp-grid">
              <label>Monto de la implementación (one-shot)<input {...numProps} value={l.setup_fee ?? ''} onChange={(e) => setLine(i, { setup_fee: e.target.value })} /></label>
              <label>Mes del cobro<input type="month" value={l.setup_month || ''} onChange={(e) => setLine(i, { setup_month: e.target.value })} /></label>
            </div>
          )}
          {l.servicio === 'automatizacion' && (
            <>
              <div className="fp-pre">
                <div className="fp-sub">Costos mensuales — se restan del mantenimiento antes de repartir y se le reintegran a quien los paga</div>
                {(l.costos || []).map((c, ci) => (
                  <div className="fp-pre-row" key={ci}>
                    <input placeholder="Nombre del costo (ej. WATI, N8N)" value={c.nombre || ''} onChange={(e) => setLine(i, { costos: l.costos.map((x, xi) => xi === ci ? { ...x, nombre: e.target.value } : x) })} style={{ flex: 1 }} />
                    <input {...numProps} placeholder="Monto" value={c.monto ?? ''} style={{ width: 90 }} onChange={(e) => setLine(i, { costos: l.costos.map((x, xi) => xi === ci ? { ...x, monto: e.target.value } : x) })} /><span className="fp-pct">{l.moneda}</span>
                    <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>paga<select value={c.quien || ''} onChange={(e) => setLine(i, { costos: l.costos.map((x, xi) => xi === ci ? { ...x, quien: e.target.value } : x) })}><option value="">—</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
                    <button className="fp-btn fp-btn--danger" onClick={() => setLine(i, { costos: l.costos.filter((_, xi) => xi !== ci) })}>×</button>
                  </div>
                ))}
                <button className="fp-btn" onClick={() => setLine(i, { costos: [...(l.costos || []), { nombre: '', monto: '', quien: '' }] })}>+ Costo</button>
                {(() => {
                  const ct = (l.costos || []).reduce((s, c) => s + (Number(c.monto) || 0), 0);
                  const rest = Math.max(0, (Number(l.fee) || 0) - ct);
                  return <div className="fp-muted" style={{ marginTop: 6, fontSize: 12 }}>Mantenimiento {fmt(Number(l.fee) || 0)} − costos {fmt(ct)} = <strong>restante {fmt(rest)}</strong> {l.moneda} → se reparte según el tipo/operadores de abajo. Los costos se le devuelven a quien los paga.</div>;
                })()}
              </div>
            </>
          )}

          {l.tipo === 'post' ? (
            <>
              <div className="fp-grid">
                <label>Sueldo socios<select value={l.socio_modo || 'pct'} onChange={(e) => setLine(i, { socio_modo: e.target.value })}><option value="pct">% del total</option><option value="fijo">Monto fijo</option></select></label>
                {(l.socio_modo || 'pct') === 'fijo'
                  ? <label>Sueldo socios fijo ({l.moneda})<input {...numProps} value={l.socio_monto ?? ''} onChange={(e) => setLine(i, { socio_monto: e.target.value })} /></label>
                  : <label>Sueldo socios %<input {...numProps} value={l.socio_pct ?? ''} onChange={(e) => setLine(i, { socio_pct: e.target.value })} /></label>}
              </div>
              <div className="fp-pre">
                <div className="fp-sub">Operadores (OPEX) — cada uno cobra su monto fijo o su % del total; el resto queda en la caja</div>
                {(l.opex_reparto || []).map((r, ri) => (
                  <div className="fp-pre-row" key={ri}>
                    <select value={r.persona || ''} onChange={(e) => setLine(i, { opex_reparto: l.opex_reparto.map((x, xi) => xi === ri ? { ...x, persona: e.target.value } : x) })}><option value="">—</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                    <select value={r.modo || 'pct'} onChange={(e) => setLine(i, { opex_reparto: l.opex_reparto.map((x, xi) => xi === ri ? { ...x, modo: e.target.value } : x) })}><option value="pct">%</option><option value="fijo">Fijo</option></select>
                    {(r.modo || 'pct') === 'fijo'
                      ? <><input {...numProps} value={r.monto ?? ''} style={{ width: 90 }} onChange={(e) => setLine(i, { opex_reparto: l.opex_reparto.map((x, xi) => xi === ri ? { ...x, monto: e.target.value } : x) })} /><span className="fp-pct">{l.moneda}</span></>
                      : <><input {...numProps} value={r.pct ?? ''} style={{ width: 70 }} onChange={(e) => setLine(i, { opex_reparto: l.opex_reparto.map((x, xi) => xi === ri ? { ...x, pct: e.target.value } : x) })} /><span className="fp-pct">%</span></>}
                    {(l.opex_reparto || []).length > 1 && <button className="fp-btn fp-btn--danger" onClick={() => setLine(i, { opex_reparto: l.opex_reparto.filter((_, xi) => xi !== ri) })}>×</button>}
                  </div>
                ))}
                <button className="fp-btn" onClick={() => setLine(i, { opex_reparto: [...(l.opex_reparto || []), { persona: '', modo: 'pct', pct: 0, monto: '' }] })}>+ Operador</button>
              </div>
            </>
          ) : (
            <div className="fp-pre">
              <div className="fp-sub">Operadores (los % reparten lo que queda después de los fijos)</div>
              {(l.reparto || []).map((r, ri) => (
                <div className="fp-pre-row" key={ri}>
                  <select value={r.persona || ''} onChange={(e) => setLine(i, { reparto: l.reparto.map((x, xi) => xi === ri ? { ...x, persona: e.target.value } : x) })}><option value="">—</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                  <select value={r.modo || 'pct'} onChange={(e) => setLine(i, { reparto: l.reparto.map((x, xi) => xi === ri ? { ...x, modo: e.target.value } : x) })}><option value="pct">%</option><option value="fijo">Fijo</option></select>
                  {(r.modo || 'pct') === 'fijo'
                    ? <><input {...numProps} value={r.monto ?? ''} style={{ width: 90 }} onChange={(e) => setLine(i, { reparto: l.reparto.map((x, xi) => xi === ri ? { ...x, monto: e.target.value } : x) })} /><span className="fp-pct">{l.moneda}</span></>
                    : <><input {...numProps} value={r.pct ?? ''} style={{ width: 70 }} onChange={(e) => setLine(i, { reparto: l.reparto.map((x, xi) => xi === ri ? { ...x, pct: e.target.value } : x) })} /><span className="fp-pct">%</span></>}
                  {l.reparto.length > 1 && <button className="fp-btn fp-btn--danger" onClick={() => setLine(i, { reparto: l.reparto.filter((_, xi) => xi !== ri) })}>×</button>}
                </div>
              ))}
              <button className="fp-btn" onClick={() => setLine(i, { reparto: [...l.reparto, { persona: '', modo: 'pct', pct: 0, monto: 0 }] })}>+ Operador</button>
            </div>
          )}

          <div className="fp-grid">
            <label>Variable<select value={l.variable?.modo || 'none'} onChange={(e) => setVar(i, { modo: e.target.value })}><option value="none">Sin variable</option><option value="differential">Diferencial</option><option value="percent">Sobre total</option></select></label>
            {l.variable?.modo !== 'none' && <label>Base<input {...numProps} value={l.variable?.base ?? ''} onChange={(e) => setVar(i, { base: e.target.value })} /></label>}
            {l.variable?.modo !== 'none' && <label>Rate %<input {...numProps} value={l.variable?.rate ?? ''} onChange={(e) => setVar(i, { rate: e.target.value })} /></label>}
            {l.variable?.modo !== 'none' && <label>Facturación<select value={l.variable?.fuente || 'manual'} onChange={(e) => setVar(i, { fuente: e.target.value })}><option value="tiendanube">Tienda Nube</option><option value="manual">Manual</option></select></label>}
          </div>

          <div className="fp-grid">
            <label>Cobro<select value={pagaVencido ? 'vencido' : 'adelantado'} onChange={(e) => toggleVencido(e.target.value === 'vencido')}><option value="adelantado">Mes adelantado</option><option value="vencido">Mes vencido</option></select></label>
          </div>

          <div className="fp-card-foot"><button className="fp-btn fp-btn--primary" onClick={() => saveLine(i)}>Guardar {servLabel(l.servicio)}</button></div>
        </div>
      ))}

      {lines.length < SERVICIOS.length && <button className="fp-btn" onClick={addService}>+ Agregar servicio</button>}
    </div>
  );
}

// ─── Reparto del mes ──────────────────────────────────────────────────────────
const FUENTE_LBL = { 'pre': 'Pre-agencia', 'pre (fijo)': 'Pre-agencia (fijo)', 'sueldo socio': 'Sueldo socio', 'opex': 'OPEX', 'interno': 'Deal interno' };
function RepartoTab({ month, clients }) {
  const [data, setData] = useState(null);
  const [cons, setCons] = useState('USD');
  const [open, setOpen] = useState(null); // persona expandida
  const cname = (slug) => (clients || []).find((c) => c.slug === slug)?.name || slug;
  useEffect(() => { apiClient.get(`/admin/finance/reparto?month=${month}`).then((r) => setData(r.data)).catch(() => setData(null)); setOpen(null); }, [month]);
  if (!data) return <div className="fp-muted">Cargando…</div>;
  const fx = data.fx || 0;
  const consolidate = (p) => cons === 'USD' ? (p.USD.total + (fx ? p.ARS.total / fx : 0)) : (p.ARS.total + p.USD.total * fx);

  // Caja fuera de esta vista (vive en el P&L). Solo personas.
  const rows = data.people;
  const totalCons = rows.reduce((s, p) => s + consolidate(p), 0) || 1;
  return (
    <div>
      <div className="fp-bar">
        <span className="fp-muted">Facturado · USD {fmt(data.totals.USD)} · ARS {fmt(data.totals.ARS)} {fx ? `· TC ${fmt(fx)}` : '· sin TC cargado'}</span>
        <span style={{ marginLeft: 'auto' }} className="fp-inline">Consolidar a
          <button className={`fp-btn ${cons === 'USD' ? 'fp-btn--primary' : ''}`} onClick={() => setCons('USD')}>USD</button>
          <button className={`fp-btn ${cons === 'ARS' ? 'fp-btn--primary' : ''}`} onClick={() => setCons('ARS')}>ARS</button>
        </span>
      </div>
      <table className="fp-table">
        <thead><tr><th>Persona</th><th>%</th><th>Gana USD</th><th>Gana ARS</th><th>Consolidado ({cons})</th></tr></thead>
        <tbody>
          {rows.map((p, i) => {
            const pct = (consolidate(p) / totalCons) * 100;
            const isOpen = open === p.person;
            const src = (data.sources || {})[p.person] || [];
            return (
              <React.Fragment key={i}>
                <tr onClick={() => setOpen(isOpen ? null : p.person)} style={{ cursor: 'pointer' }} title="Ver de dónde viene la plata">
                  <td>{isOpen ? '▾' : '▸'} {p.person}</td>
                  <td className="fp-muted">{pct.toFixed(0)}%</td>
                  <td>{p.USD.total ? fmt(p.USD.total) : '—'}</td>
                  <td>{p.ARS.total ? fmt(p.ARS.total) : '—'}</td>
                  <td className="fp-cons">{fmt(consolidate(p))}</td>
                </tr>
                {isOpen && (
                  <tr className="fp-src-row"><td colSpan={5}>
                    {src.length === 0 ? <span className="fp-muted">Sin detalle este mes.</span> : (
                      <table className="fp-subtable">
                        <thead><tr><th>Marca</th><th>Servicio</th><th>Fuente</th><th>Monto</th></tr></thead>
                        <tbody>
                          {src.slice().sort((a, b) => b.amount - a.amount).map((s, si) => (
                            <tr key={si}>
                              <td>{s.client ? cname(s.client) : 'Interno'}{s.descripcion ? <span className="fp-muted"> · {s.descripcion}</span> : ''}</td>
                              <td>{s.servicio ? servLabel(s.servicio) : '—'} <span className="fp-tag">{s.tipo}</span></td>
                              <td>{FUENTE_LBL[s.fuente] || s.fuente}</td>
                              <td><strong>{s.moneda} {fmt(s.amount)}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td></tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {!fx && <p className="fp-muted">Sin TC del mes: el consolidado no puede mezclar monedas.</p>}
    </div>
  );
}

// ─── Deals Clientes (lista de clientes + editor del deal) ──────────────────────
function DealsClientesTab({ clients, people, month, setMonth }) {
  const [editing, setEditing] = useState(null);   // slug en edición
  const [byClient, setByClient] = useState(null); // slug -> lines (del mes)
  const [q, setQ] = useState('');

  // Traemos los deals del mes para mostrar servicio + fee en cada ficha.
  useEffect(() => {
    if (editing) return;
    apiClient.get(`/admin/finance/by-client?month=${month}`).then((r) => {
      const map = {}; (r.data.clients || []).forEach((c) => { map[c.client] = c.lines || []; });
      setByClient(map);
    }).catch(() => setByClient({}));
  }, [month, editing]);

  if (editing) {
    const c = clients.find((x) => x.slug === editing);
    return <ConfigTab slug={editing} clientName={c?.name || editing} people={people} month={month} setMonth={setMonth} onBack={() => setEditing(null)} />;
  }

  const list = clients.filter((c) => c.active !== false)
    .filter((c) => (c.name || '').toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }));

  return (
    <div>
      <div className="fp-bar">
        <input placeholder="Buscar cliente…" value={q} onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, maxWidth: 340, padding: '8px 12px', border: '1px solid #d8d6cf', borderRadius: 8 }} />
        <span className="fp-muted" style={{ marginLeft: 'auto' }}>{list.length} clientes</span>
      </div>
      {byClient === null ? <div className="fp-muted">Cargando…</div> : list.map((c) => {
        const lines = byClient[c.slug] || [];
        return (
          <div className="fp-deal-card" key={c.slug}>
            <div className="fp-deal-head">
              <strong>{c.name}</strong>
              <button className="fp-gear" title="Editar deal" onClick={() => setEditing(c.slug)}>⚙️</button>
            </div>
            {lines.length === 0
              ? <div className="fp-muted fp-deal-empty">Sin deals configurados</div>
              : lines.map((l, i) => (
                  <div className="fp-deal-line" key={i}>
                    <span>{servLabel(l.servicio)} · <strong>{l.moneda} {fmt(l.fee)}</strong></span>
                    <span className={`fp-tag fp-tag--${l.tipo}`}>{l.tipo === 'pre' ? 'Pre-agencia' : 'Post-agencia'}</span>
                  </div>
                ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Movimientos (cuentas + transferencias + saldos acumulados) ────────────────
function MovimientosTab({ people, clients, month }) {
  const [accounts, setAccounts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [balances, setBalances] = useState(null);
  const [collections, setCollections] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [openPerson, setOpenPerson] = useState(null);   // persona con drill-down abierto en Saldos
  const [openCaja, setOpenCaja] = useState(false);      // caja con "en manos de quién" abierto
  const [balA, setBalA] = useState('');                 // balanza: persona A
  const [balB, setBalB] = useState('');                 // balanza: persona B (o Caja)
  const [newAcc, setNewAcc] = useState('');
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), tipo: 'cliente', account_id: '', person: '', from_person: '', client_slug: '', servicio: '', amount: '', moneda: 'ARS', note: '', covers_from: '', covers_to: '' });
  const [editingId, setEditingId] = useState(null);      // transferencia en edición
  const [clientQuery, setClientQuery] = useState('');    // texto del buscador de cliente
  const [openClient, setOpenClient] = useState(null);    // cliente con desglose por servicio abierto
  const [mMonth, setMMonth] = useState(month);           // mes local del tab (además del general)
  const [saldoMode, setSaldoMode] = useState('mes');     // 'mes' | 'acumulado' (para los Saldos)
  const [fPerson, setFPerson] = useState(''); const [fClient, setFClient] = useState(''); const [fFrom, setFFrom] = useState(''); const [fTo, setFTo] = useState(''); // filtros del listado
  const [msg, setMsg] = useState('');
  const [cons, setCons] = useState('USD');
  const cname = (slug) => (clients || []).find((c) => c.slug === slug)?.name || slug;
  useEffect(() => { setMMonth(month); }, [month]);        // si cambia el general, seguimos ese

  const loadStatic = useCallback(() => {
    apiClient.get('/admin/finance/accounts').then((r) => setAccounts(r.data.accounts || [])).catch(() => {});
    apiClient.get('/admin/finance/transfers').then((r) => setTransfers(r.data.transfers || [])).catch(() => {});
  }, []);
  const loadMonth = useCallback(() => {
    const bMonth = saldoMode === 'acumulado' ? 'all' : mMonth;
    apiClient.get(`/admin/finance/balances?month=${bMonth}`).then((r) => setBalances(r.data)).catch(() => setBalances({ rows: [], fx: null }));
    apiClient.get(`/admin/finance/collections?month=${mMonth}`).then((r) => setCollections(r.data)).catch(() => setCollections({ rows: [] }));
    apiClient.get(`/admin/finance/ledger?month=${bMonth}`).then((r) => setLedger(r.data)).catch(() => setLedger({ people: {}, caja: { heldBy: [] } }));
  }, [mMonth, saldoMode]);
  useEffect(() => { loadStatic(); }, [loadStatic]);
  useEffect(() => { loadMonth(); }, [loadMonth]);
  const reload = () => { loadStatic(); loadMonth(); };

  const addAccount = () => {
    if (!newAcc.trim()) return;
    apiClient.post('/admin/finance/accounts', { name: newAcc.trim() }).then(() => { setNewAcc(''); loadStatic(); }).catch(() => {});
  };
  const delAccount = (id) => { if (window.confirm('¿Borrar la cuenta?')) apiClient.delete(`/admin/finance/accounts/${id}`).then(loadStatic).catch(() => {}); };
  const resetForm = () => { setForm({ date: new Date().toISOString().slice(0, 10), tipo: 'cliente', account_id: '', person: '', from_person: '', client_slug: '', servicio: '', amount: '', moneda: 'ARS', note: '', covers_from: '', covers_to: '' }); setClientQuery(''); setEditingId(null); };
  const saveTransfer = () => {
    const amount = parseMiles(form.amount);
    if (!form.person || !(Number(amount) > 0)) { setMsg('Falta destinatario o monto'); return; }
    if (form.tipo === 'cliente' && !form.client_slug) { setMsg('Elegí de qué cliente es el cobro'); return; }
    if (form.tipo === 'interno' && !form.from_person) { setMsg('Elegí quién mandó la transferencia'); return; }
    const payload = { ...form, amount };
    const req = editingId
      ? apiClient.put(`/admin/finance/transfers/${editingId}`, payload)
      : apiClient.post('/admin/finance/transfers', payload);
    req.then(() => { resetForm(); setMsg(editingId ? '✓ Transferencia actualizada' : '✓ Transferencia cargada'); setTimeout(() => setMsg(''), 2000); reload(); })
      .catch((e) => setMsg(e?.response?.data?.message || 'Error'));
  };
  const editTransfer = (t) => {
    setForm({ date: t.date, tipo: t.tipo || 'cliente', account_id: t.account_id || '', person: t.person || '', from_person: t.from_person || '', client_slug: t.client_slug || '', servicio: t.servicio || '', amount: formatMiles(String(t.amount)), moneda: t.moneda || 'ARS', note: t.note || '', covers_from: t.covers_from || '', covers_to: t.covers_to || '' });
    setClientQuery(t.client_slug ? cname(t.client_slug) : '');
    setEditingId(t.id); setMsg('');
  };
  const toggleSettled = (client, on) => apiClient.post('/admin/finance/collections/settle', { client_slug: client, month: mMonth, on }).then(loadMonth).catch((e) => setMsg(e?.response?.data?.message || 'Error al saldar'));
  const toggleSettledPerson = (person, on) => apiClient.post('/admin/finance/balances/settle', { person, month: saldoMode === 'acumulado' ? 'all' : mMonth, on }).then(loadMonth).catch((e) => setMsg(e?.response?.data?.message || 'Error al saldar'));
  const moneyLine = (o) => { const p = []; if (o.USD) p.push(`USD ${fmt(o.USD)}`); if (o.ARS) p.push(`ARS ${fmt(o.ARS)}`); return p.length ? p.join(' · ') : '—'; };
  const delTransfer = (id) => { if (window.confirm('¿Borrar la transferencia?')) apiClient.delete(`/admin/finance/transfers/${id}`).then(() => { if (editingId === id) resetForm(); reload(); }).catch(() => {}); };

  const accName = (id) => accounts.find((a) => a.id === id)?.name || '—';
  const fx = balances?.fx || 0;
  const eur = balances?.eur || 0; // EUR→USD
  const toUsd = (s) => s.USD + (fx ? s.ARS / fx : 0);
  const consSaldo = (s) => (cons === 'ARS' ? (s.ARS + s.USD * fx) : cons === 'EUR' ? (eur ? toUsd(s) / eur : 0) : toUsd(s));

  const formBody = (
    <>
      <div className="fp-grid">
        <label>Fecha<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
        <label>Tipo<select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}><option value="cliente">Cobro de cliente</option><option value="interno">Transferencia interna</option></select></label>
        {form.tipo === 'cliente'
          ? <label>Cliente (paga)<input list="fp-clients-dl" value={clientQuery} placeholder="Buscá el cliente…" onChange={(e) => { const v = e.target.value; setClientQuery(v); const c = (clients || []).find((x) => x.name === v); const slug = c ? c.slug : ''; const svcs = (collections?.rows || []).find((r) => r.client === slug)?.services || []; setForm({ ...form, client_slug: slug, servicio: svcs.length === 1 ? svcs[0].servicio : '' }); }} /><datalist id="fp-clients-dl">{(clients || []).filter((c) => c.active !== false).map((c) => <option key={c.slug} value={c.name} />)}</datalist></label>
          : <label>De (manda)<select value={form.from_person} onChange={(e) => setForm({ ...form, from_person: e.target.value })}><option value="">—</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>}
        {form.tipo === 'cliente' && (() => {
          const svcs = (collections?.rows || []).find((r) => r.client === form.client_slug)?.services || [];
          return svcs.length > 0 ? (
            <label>Servicio<select value={form.servicio} onChange={(e) => setForm({ ...form, servicio: e.target.value })}>
              <option value="">General (todo el cliente)</option>
              {svcs.map((s) => <option key={s.servicio} value={s.servicio}>{servLabel(s.servicio)}</option>)}
            </select></label>
          ) : null;
        })()}
        <label>Le entró a<select value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })}><option value="">—</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
        <label>Moneda<select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}><option value="ARS">ARS</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
        <label>Monto<input {...numProps} value={form.amount} onChange={(e) => setForm({ ...form, amount: formatMiles(e.target.value) })} /></label>
        <label>Nota<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
      </div>
      {form.tipo === 'cliente' && (
        <div style={{ marginTop: 8 }}>
          <label className="fp-inline" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.covers_from} onChange={(e) => setForm({ ...form, covers_from: e.target.checked ? mMonth : '', covers_to: e.target.checked ? mMonth : '' })} />
            <span>Este pago cubre varios meses (se prorratea en Cobros)</span>
          </label>
          {form.covers_from && (
            <div className="fp-inline" style={{ gap: 6, marginTop: 6 }}>
              <span className="fp-muted">De</span>
              <input type="month" value={form.covers_from} onChange={(e) => setForm({ ...form, covers_from: e.target.value })} />
              <span className="fp-muted">a</span>
              <input type="month" value={form.covers_to || form.covers_from} onChange={(e) => setForm({ ...form, covers_to: e.target.value })} />
            </div>
          )}
        </div>
      )}
      <div style={{ textAlign: 'right', marginTop: 8 }}>
        {editingId && <button className="fp-btn" style={{ marginRight: 8 }} onClick={resetForm}>Cancelar</button>}
        <button className="fp-btn fp-btn--primary" onClick={saveTransfer}>{editingId ? 'Guardar cambios' : 'Cargar'}</button>
      </div>
    </>
  );

  return (
    <div>

      {/* Cargar transferencia (inline, solo para nuevas) */}
      {!editingId && (
        <div className="fp-card">
          <div className="fp-card-head"><strong>Cargar transferencia</strong>{msg && <span className="fp-msg" style={{ marginLeft: 'auto' }}>{msg}</span>}</div>
          {formBody}
        </div>
      )}

      {/* Editar transferencia (modal, aparece donde estás) */}
      {editingId && (
        <div onClick={resetForm} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="fp-card" style={{ background: '#fff', maxWidth: 640, width: '100%', maxHeight: '85vh', overflowY: 'auto', margin: 0 }}>
            <div className="fp-card-head"><strong>Editar transferencia</strong>{msg && <span className="fp-msg" style={{ marginLeft: 'auto' }}>{msg}</span>}</div>
            {formBody}
          </div>
        </div>
      )}

      {/* Cobros de clientes del mes */}
      <div className="fp-card">
        <div className="fp-card-head"><strong>Cobros de clientes</strong>
          <label className="fp-inline" style={{ marginLeft: 'auto' }}>Mes<input type="month" value={mMonth} onChange={(e) => setMMonth(e.target.value)} /></label>
          <span className="fp-muted" style={{ marginLeft: 12 }}>{collections?.tc ? `TC ${fmt(collections.tc)}` : 'sin TC'}</span>
        </div>
        {!collections ? <div className="fp-muted">Cargando…</div> : collections.rows.length === 0 ? <div className="fp-muted">Sin clientes facturados este mes.</div> : (
          <table className="fp-table">
            <thead><tr><th>Cliente</th><th>Debe</th><th>Pagó</th><th>Falta</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {/* Orden: los que no pagaron → mes vencido (deben, pero no están atrasados) → los que pagaron. */}
              {[...collections.rows].sort((a, b) => {
                const rank = (r) => (r.settled ? 2 : r.pagaVencido ? 1 : 0);
                return rank(a) - rank(b);
              }).map((r, i) => {
                const multi = r.services.length > 1;
                const isOpen = openClient === r.client;
                const vencidoPend = !r.settled && r.pagaVencido; // paga a mes vencido y todavía no cobró
                return (
                  <React.Fragment key={i}>
                    <tr style={{ cursor: multi ? 'pointer' : 'default' }} onClick={() => multi && setOpenClient(isOpen ? null : r.client)} title={multi ? 'Ver desglose por servicio' : ''}>
                      <td>{multi ? (isOpen ? '▾ ' : '▸ ') : ''}{cname(r.client)}{multi ? <span className="fp-muted"> · {r.services.length} servicios</span> : ''}</td>
                      <td>{moneyLine(r.owed)}</td>
                      <td>{moneyLine(r.paid)}</td>
                      <td>{moneyLine(r.pending)}</td>
                      <td>{r.settled
                        ? <span style={{ color: '#15803d', fontWeight: 700 }}>✓ Pagó{r.manual ? ' (saldado)' : ''}</span>
                        : vencidoPend
                          ? <span style={{ color: '#92620b', fontWeight: 700 }}>Mes vencido</span>
                          : <span style={{ color: '#b91c1c', fontWeight: 700 }}>Falta</span>}</td>
                      <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        {r.manual
                          ? <button className="fp-btn" onClick={() => toggleSettled(r.client, false)}>Reabrir</button>
                          : (!r.settled && <button className="fp-btn" onClick={() => toggleSettled(r.client, true)}>Dar por saldado</button>)}
                      </td>
                    </tr>
                    {isOpen && r.services.map((s, si) => (
                      <tr key={`${i}-${si}`} className="fp-src-row">
                        <td style={{ paddingLeft: 24 }}>{servLabel(s.servicio)} <span className="fp-tag">{s.moneda}</span></td>
                        <td>{s.moneda} {fmt(s.owed)}</td>
                        <td>{s.moneda} {fmt(s.paid)}</td>
                        <td>{s.moneda} {fmt(s.pending)}</td>
                        <td colSpan={2} className="fp-muted">{s.pending <= 0 ? 'saldado' : 'falta'}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Saldo por persona (mes o acumulado) */}
      <div className="fp-card">
        <div className="fp-card-head"><strong>{saldoMode === 'acumulado' ? 'Saldo acumulado (desde julio)' : 'Saldo del mes'}</strong>
          <span className="fp-inline" style={{ marginLeft: 'auto' }}>
            <button className={`fp-btn ${saldoMode === 'mes' ? 'fp-btn--primary' : ''}`} onClick={() => setSaldoMode('mes')}>Mes</button>
            <button className={`fp-btn ${saldoMode === 'acumulado' ? 'fp-btn--primary' : ''}`} onClick={() => setSaldoMode('acumulado')}>Acumulado</button>
          </span>
          {saldoMode === 'mes' && <label className="fp-inline" style={{ marginLeft: 12 }}>Mes<input type="month" value={mMonth} onChange={(e) => setMMonth(e.target.value)} /></label>}
          <span className="fp-inline" style={{ marginLeft: 12 }}>Ver en
            <button className={`fp-btn ${cons === 'USD' ? 'fp-btn--primary' : ''}`} onClick={() => setCons('USD')}>USD</button>
            <button className={`fp-btn ${cons === 'ARS' ? 'fp-btn--primary' : ''}`} onClick={() => setCons('ARS')}>ARS</button>
            <button className={`fp-btn ${cons === 'EUR' ? 'fp-btn--primary' : ''}`} onClick={() => setCons('EUR')}>EUR</button>
          </span>
        </div>
        {!balances ? <div className="fp-muted">Cargando…</div> : (() => {
          // Mostramos en la moneda elegida un monto que viene consolidado a USD.
          const disp = (usd) => (cons === 'ARS' ? usd * fx : cons === 'EUR' ? (eur ? usd / eur : 0) : usd);
          const rows = balances.rows.map((r) => {
            // Netear TODO en una sola moneda (USD): así un pago en pesos salda una deuda
            // en dólares (le corresponde − recibió = falta), sin importar la moneda de cada uno.
            const owedUsd = toUsd(r.owed), recUsd = toUsd(r.received), preUsd = toUsd(r.preDebe || { USD: 0, ARS: 0 });
            const net = owedUsd - recUsd;                 // + = le falta cobrar; − = retiene de más
            // Si está "dado por saldado", la diferencia se cierra: no queda falta ni debe.
            const faltaUsd = r.settled ? 0 : Math.max(0, net);
            const debeUsd = r.settled ? 0 : Math.max(0, -net) + preUsd;   // retiene de más + deals pre-agencia que paga
            return { person: r.person, corr: consSaldo(r.owed), rec: consSaldo(r.received), falta: disp(faltaUsd), debe: disp(debeUsd), settled: r.settled };
          });
          // Caja de la agencia: fila aparte. Le corresponde y "falta recibir" = la caja (aún en las cuentas).
          const cajaCorr = consSaldo(balances.caja || { USD: 0, ARS: 0 });
          const tot = rows.reduce((a, r) => ({ falta: a.falta + r.falta, debe: a.debe + r.debe }), { falta: cajaCorr, debe: 0 });
          return (
            <table className="fp-table">
              <thead><tr><th>Persona</th><th>Le corresponde ({cons})</th><th>Recibió ({cons})</th><th>Falta recibir ({cons})</th><th>Debe ({cons})</th><th></th></tr></thead>
              <tbody>
                {rows.map((r, i) => {
                  const lp = ledger?.people?.[r.person];
                  const isOpen = openPerson === r.person;
                  return (
                  <React.Fragment key={i}>
                  <tr>
                    <td style={{ cursor: lp ? 'pointer' : 'default' }} onClick={() => lp && setOpenPerson(isOpen ? null : r.person)} title={lp ? 'Ver a quién le debe / quién le debe' : ''}>{lp ? (isOpen ? '▾ ' : '▸ ') : ''}{r.person}{r.settled && <span className="fp-tag" style={{ marginLeft: 6 }}>saldado</span>}</td>
                    <td>{fmt(r.corr)}</td>
                    <td>{fmt(r.rec)}</td>
                    <td>{r.falta > 0 ? fmt(r.falta) : '—'}</td>
                    <td>{r.debe > 0 ? <strong style={{ color: '#b91c1c' }}>{fmt(r.debe)}</strong> : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{r.settled
                      ? <button className="fp-btn" onClick={() => toggleSettledPerson(r.person, false)}>Reabrir</button>
                      : ((r.falta > 0 || r.debe > 0) && <button className="fp-btn" onClick={() => toggleSettledPerson(r.person, true)}>Dar por saldado</button>)}</td>
                  </tr>
                  {isOpen && lp && (
                    <tr className="fp-src-row"><td colSpan={6}>
                      <LedgerDetail entry={lp} disp={disp} cons={cons} cname={cname} />
                    </td></tr>
                  )}
                  </React.Fragment>
                  );
                })}
                <tr className="fp-src-row"><td style={{ cursor: ledger?.caja ? 'pointer' : 'default' }} onClick={() => ledger?.caja && setOpenCaja(!openCaja)} title="Ver en manos de quién está la caja">{ledger?.caja ? (openCaja ? '▾ ' : '▸ ') : ''}Caja agencia</td><td>{fmt(cajaCorr)}</td><td>—</td><td>{cajaCorr > 0 ? fmt(cajaCorr) : '—'}</td><td>—</td><td></td></tr>
                {openCaja && ledger?.caja && (
                  <tr className="fp-src-row"><td colSpan={6}><CajaDetail caja={ledger.caja} disp={disp} cons={cons} cname={cname} /></td></tr>
                )}
                <tr className="fp-pnl-strong"><td>Total</td><td></td><td></td><td>{fmt(tot.falta)}</td><td>{fmt(tot.debe)}</td><td></td></tr>
              </tbody>
            </table>
          );
        })()}
        <p className="fp-muted" style={{ marginTop: 6 }}><strong>Falta recibir</strong> = lo que le corresponde y no cobró. <strong>Debe</strong> = plata de más que retiene (de otros) + deals pre-agencia que paga. La <strong>Caja agencia</strong> es la ganancia del mes (va aparte). Cuando esté todo cobrado de los clientes, Falta total = Debe total.</p>
      </div>

      {/* Balanza entre dos partes */}
      <div className="fp-card">
        <div className="fp-card-head"><strong>Balanza entre dos</strong>
          <label className="fp-inline" style={{ marginLeft: 'auto' }}><select value={balA} onChange={(e) => setBalA(e.target.value)}><option value="">—</option>{(ledger?.parties || []).map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
          <span className="fp-muted" style={{ margin: '0 6px' }}>vs</span>
          <label className="fp-inline"><select value={balB} onChange={(e) => setBalB(e.target.value)}><option value="">—</option>{(ledger?.parties || []).map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
        </div>
        {(!balA || !balB || balA === balB) ? <div className="fp-muted">Elegí dos partes para ver la balanza.</div> : (() => {
          const disp = (usd) => (cons === 'ARS' ? usd * fx : cons === 'EUR' ? (eur ? usd / eur : 0) : usd);
          const oweAB = (ledger?.owe?.[balA]?.[balB]?.origins) || {};
          const oweBA = (ledger?.owe?.[balB]?.[balA]?.origins) || {};
          const keys = new Set([...Object.keys(oweAB), ...Object.keys(oweBA)]);
          const combined = {}; // + = A tiene plata de B (A le debe a B)
          keys.forEach((k) => { combined[k] = (oweAB[k] || 0) - (oweBA[k] || 0); });
          const aHasB = Object.entries(combined).filter(([, v]) => v > 0.5).map(([k, v]) => ({ k, v }));
          const bHasA = Object.entries(combined).filter(([, v]) => v < -0.5).map(([k, v]) => ({ k, v: -v }));
          const netA = Object.values(combined).reduce((s, v) => s + v, 0); // + = A le debe a B
          const col = (title, items) => (
            <div style={{ minWidth: 260, flex: 1 }}>
              <div className="fp-muted" style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
              {items.length ? items.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '2px 0' }}>
                  <span>{prettyOrigin(it.k, cname)}</span><strong>{cons} {fmt(disp(it.v))}</strong>
                </div>
              )) : <div className="fp-muted">—</div>}
            </div>
          );
          return (
            <div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {col(`${balA} tiene plata de ${balB}`, aHasB)}
                {col(`${balB} tiene plata de ${balA}`, bHasA)}
              </div>
              <div className="fp-pnl-strong" style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--color-gray-light, #e5e7eb)' }}>
                {Math.abs(netA) < 1 ? <span>Están a mano.</span> : netA > 0
                  ? <span><strong>{balA}</strong> le debe a <strong>{balB}</strong>: <strong>{cons} {fmt(disp(netA))}</strong></span>
                  : <span><strong>{balB}</strong> le debe a <strong>{balA}</strong>: <strong>{cons} {fmt(disp(-netA))}</strong></span>}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Últimas transferencias + filtros */}
      <div className="fp-card">
        <div className="fp-card-head"><strong>Transferencias cargadas</strong></div>
        <div className="fp-inline" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <label className="fp-inline">Persona<select value={fPerson} onChange={(e) => setFPerson(e.target.value)}><option value="">Todas</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
          <label className="fp-inline">Cliente<select value={fClient} onChange={(e) => setFClient(e.target.value)}><option value="">Todos</option>{(clients || []).filter((c) => c.active !== false).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
          <label className="fp-inline">Desde<input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} /></label>
          <label className="fp-inline">Hasta<input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} /></label>
          {(fPerson || fClient || fFrom || fTo) && <button className="fp-btn" onClick={() => { setFPerson(''); setFClient(''); setFFrom(''); setFTo(''); }}>Limpiar</button>}
        </div>
        {(() => {
          const filtered = transfers.filter((t) =>
            (!fPerson || t.person === fPerson || t.from_person === fPerson)
            && (!fClient || t.client_slug === fClient)
            && (!fFrom || t.date >= fFrom) && (!fTo || t.date <= fTo));
          return filtered.length === 0 ? <div className="fp-muted">Sin transferencias{transfers.length ? ' con esos filtros' : ' todavía'}.</div> : (
            <table className="fp-table">
              <thead><tr><th>Fecha</th><th>Detalle</th><th>Le entró a</th><th>Monto</th><th></th></tr></thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} style={{ background: editingId === t.id ? '#fff7ed' : undefined }}>
                    <td>{t.date}</td>
                    <td>{t.tipo === 'interno' ? <>Interna · de <strong>{t.from_person || '—'}</strong></> : <>Cobro · <strong>{cname(t.client_slug)}</strong>{t.servicio ? <span className="fp-muted"> · {servLabel(t.servicio)}</span> : ''}</>}{t.note ? <span className="fp-muted"> · {t.note}</span> : ''}</td>
                    <td>{t.person}</td>
                    <td>{t.moneda} {fmt(t.amount)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span onClick={() => editTransfer(t)} style={{ cursor: 'pointer', marginRight: 10 }} title="Editar">✎</span>
                      <span onClick={() => delTransfer(t.id)} style={{ cursor: 'pointer', color: '#b91c1c' }} title="Borrar">×</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })()}
      </div>
    </div>
  );
}

// ─── P&L post-agencia (Profit First) ───────────────────────────────────────────
function PnlTab({ month, people }) {
  const [data, setData] = useState(null);
  const [cons, setCons] = useState('ARS');
  const [tax, setTax] = useState({ nombre: '', modo: 'pct', valor: '', moneda: 'ARS', quien_paga: '' });
  const [open, setOpen] = useState({ socio: true, opex: true, imp: true, interno: true });

  const load = useCallback(() => { apiClient.get(`/admin/finance/pnl?month=${month}`).then((r) => setData(r.data)).catch(() => setData(null)); }, [month]);
  useEffect(() => { load(); }, [load]);

  const addTax = () => { if (!tax.nombre.trim()) return; apiClient.post('/admin/finance/tax-configs', tax).then(() => { setTax({ nombre: '', modo: 'pct', valor: '', moneda: 'ARS', quien_paga: '' }); load(); }).catch(() => {}); };
  const delTax = (id) => { if (window.confirm('¿Borrar el impuesto?')) apiClient.delete(`/admin/finance/tax-configs/${id}`).then(load).catch(() => {}); };
  const delGasto = (id) => { apiClient.delete(`/admin/finance/costs/${id}`).then(load).catch(() => {}); };

  if (!data) return <div className="fp-muted">Cargando…</div>;
  const fx = data.fx || 0;
  const conv2 = (o) => cons === 'USD' ? (o.USD + (fx ? o.ARS / fx : 0)) : (o.ARS + o.USD * fx);
  const conv1 = (monto, moneda) => moneda === cons ? monto : (cons === 'USD' ? (fx ? monto / fx : 0) : monto * fx);

  const income = conv2(data.income);
  const socio = conv2(data.socio);
  const opexOp = conv2(data.opexOperators);
  const opexGastos = (data.expenses || []).filter((e) => e.categoria === 'opex');
  const opexGastosTot = opexGastos.reduce((s, e) => s + conv1(e.monto, e.moneda), 0);
  const opexTotal = opexOp + opexGastosTot;
  const taxes = (data.taxConfigs || []).map((t) => ({ ...t, monto: t.modo === 'pct' ? income * (Number(t.valor) || 0) / 100 : conv1(Number(t.valor) || 0, t.moneda) }));
  const taxesTot = taxes.reduce((s, t) => s + t.monto, 0);
  const internalDeals = (data.internalDealsPost || []).map((d) => ({ ...d, amount: conv1(d.monto, d.moneda) }));
  const internalTot = internalDeals.reduce((s, d) => s + d.amount, 0);
  const cajaNeta = income - socio - opexTotal - taxesTot - internalTot;
  const pct = (x) => income ? (x / income) * 100 : 0;
  const impGastos = (data.expenses || []).filter((e) => e.categoria === 'impuesto');

  const Row = ({ label, amount, cat, strong }) => (
    <tr className={strong ? 'fp-pnl-strong' : ''} onClick={cat ? () => setOpen((o) => ({ ...o, [cat]: !o[cat] })) : undefined} style={cat ? { cursor: 'pointer' } : undefined}>
      <td>{cat ? (open[cat] ? '▾ ' : '▸ ') : ''}{label}</td>
      <td className="fp-muted">{pct(amount).toFixed(0)}%</td>
      <td className="fp-cons">{fmt(amount)}</td>
    </tr>
  );
  const Sub = ({ label, amount, onDel }) => (
    <tr className="fp-pnl-sub"><td>{label}{onDel && <span onClick={onDel} style={{ cursor: 'pointer', color: '#b91c1c', marginLeft: 8 }}>×</span>}</td><td></td><td>{fmt(amount)}</td></tr>
  );

  return (
    <div>
      <div className="fp-bar">
        <strong>P&L post-agencia</strong>
        <span style={{ marginLeft: 'auto' }} className="fp-inline">Ver en
          <button className={`fp-btn ${cons === 'ARS' ? 'fp-btn--primary' : ''}`} onClick={() => setCons('ARS')}>ARS</button>
          <button className={`fp-btn ${cons === 'USD' ? 'fp-btn--primary' : ''}`} onClick={() => setCons('USD')}>USD</button>
        </span>
      </div>

      <div className="fp-card">
        <table className="fp-table">
          <thead><tr><th>Categoría</th><th>%</th><th>Monto ({cons})</th></tr></thead>
          <tbody>
            <Row label="Ingresos post-agencia" amount={income} strong />
            <Row label="Sueldo socios" amount={socio} cat="socio" />
            {open.socio && data.socioBreak.map((p, i) => <Sub key={i} label={p.person} amount={conv2(p)} />)}
            <Row label="OPEX" amount={opexTotal} cat="opex" />
            {open.opex && data.opexBreak.map((p, i) => <Sub key={'o' + i} label={`${p.person} (operador)`} amount={conv2(p)} />)}
            {open.opex && opexGastos.map((e) => <Sub key={e.id} label={`${e.concepto || 'Gasto'} · ${e.date}`} amount={conv1(e.monto, e.moneda)} onDel={() => delGasto(e.id)} />)}
            <Row label="Impuestos" amount={taxesTot} cat="imp" />
            {open.imp && taxes.map((t) => <Sub key={t.id} label={`${t.nombre}${t.quien_paga ? ' · ' + t.quien_paga : ''} (${t.modo === 'pct' ? t.valor + '%' : 'fijo'})`} amount={t.monto} />)}
            {open.imp && impGastos.map((e) => <Sub key={e.id} label={`Pago: ${e.concepto || 'impuesto'} · ${e.date}`} amount={conv1(e.monto, e.moneda)} onDel={() => delGasto(e.id)} />)}
            {internalDeals.length > 0 && <Row label="Deals internos (agencia)" amount={internalTot} cat="interno" />}
            {internalDeals.length > 0 && open.interno && internalDeals.map((d, i) => <Sub key={'id' + i} label={`${d.person}${d.concepto ? ' · ' + d.concepto : ''}`} amount={d.amount} />)}
            <Row label="Caja (neta)" amount={cajaNeta} strong />
          </tbody>
        </table>
        {!fx && <p className="fp-muted">Sin TC del mes: no se pueden mezclar monedas.</p>}
      </div>

      {/* Los gastos ahora se cargan en la pestaña Costos (modelo unificado). */}
      <p className="fp-muted" style={{ marginTop: 12 }}>Los gastos de la agencia se cargan en la pestaña <strong>Costos</strong> (como "Agencia (caja)"). Acá se ven reflejados en el P&L.</p>

      {/* Config impuestos */}
      <div className="fp-card">
        <div className="fp-card-head"><strong>Impuestos configurables</strong></div>
        {(data.taxConfigs || []).map((t) => (
          <div className="fp-deal-line" key={t.id}>
            <span>{t.nombre} · {t.modo === 'pct' ? `${t.valor}%` : `${t.moneda} ${fmt(t.valor)} fijo`}{t.quien_paga ? ` · paga ${t.quien_paga}` : ''}</span>
            <span onClick={() => delTax(t.id)} style={{ cursor: 'pointer', color: '#b91c1c' }}>×</span>
          </div>
        ))}
        <div className="fp-grid" style={{ marginTop: 8 }}>
          <label>Nombre<input value={tax.nombre} onChange={(e) => setTax({ ...tax, nombre: e.target.value })} /></label>
          <label>Modo<select value={tax.modo} onChange={(e) => setTax({ ...tax, modo: e.target.value })}><option value="pct">% de ingresos</option><option value="fijo">Monto fijo</option></select></label>
          <label>{tax.modo === 'pct' ? 'Valor %' : 'Monto'}<input {...numProps} value={tax.valor} onChange={(e) => setTax({ ...tax, valor: e.target.value })} /></label>
          {tax.modo === 'fijo' && <label>Moneda<select value={tax.moneda} onChange={(e) => setTax({ ...tax, moneda: e.target.value })}><option value="ARS">ARS</option><option value="USD">USD</option></select></label>}
          <label>Quién paga<select value={tax.quien_paga} onChange={(e) => setTax({ ...tax, quien_paga: e.target.value })}><option value="">—</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
        </div>
        <div style={{ textAlign: 'right', marginTop: 8 }}><button className="fp-btn" onClick={addTax}>+ Impuesto</button></div>
      </div>
    </div>
  );
}

// ─── Costos unificados (gastos de agencia, fijos internos, costos de una persona) ─
function CostosTab({ people, clients, month }) {
  const emptyForm = { concepto: '', monto: '', moneda: 'ARS', paid_by: '', bearer: 'agencia', bearer_person: '', bearer_client: '', beneficiary: '', recurrencia: 'once', from_month: month, to_month: '' };
  const [costs, setCosts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState('');
  const cname = (slug) => (clients || []).find((c) => c.slug === slug)?.name || slug;
  const load = () => apiClient.get('/admin/finance/costs').then((r) => setCosts(r.data.costs || [])).catch(() => setCosts([]));
  useEffect(() => { load(); }, []);
  useEffect(() => { setForm((f) => ({ ...f, from_month: f.from_month || month })); }, [month]);

  const reset = () => { setForm({ ...emptyForm, from_month: month }); setEditingId(null); };
  const save = () => {
    if (!(Number(parseMiles(form.monto)) > 0)) { setMsg('Cargá un monto.'); return; }
    if (form.bearer === 'persona' && !form.bearer_person) { setMsg('Elegí qué persona soporta el costo.'); return; }
    if (form.bearer === 'cliente' && !form.bearer_client) { setMsg('Elegí de qué cliente es el costo.'); return; }
    const payload = { ...form, monto: parseMiles(form.monto) };
    const req = editingId ? apiClient.put(`/admin/finance/costs/${editingId}`, payload) : apiClient.post('/admin/finance/costs', payload);
    req.then(() => { reset(); setMsg(editingId ? '✓ Costo actualizado' : '✓ Costo guardado'); setTimeout(() => setMsg(''), 1800); load(); })
      .catch((e) => setMsg(e?.response?.data?.message || 'Error al guardar'));
  };
  const edit = (c) => { setForm({ concepto: c.concepto || '', monto: formatMiles(String(c.monto)), moneda: c.moneda || 'ARS', paid_by: c.paid_by || '', bearer: c.bearer || 'agencia', bearer_person: c.bearer_person || '', bearer_client: c.bearer_client || '', beneficiary: c.beneficiary || '', recurrencia: c.recurrencia || 'once', from_month: c.from_month || month, to_month: c.to_month || '' }); setEditingId(c.id); };
  const del = (id) => { if (window.confirm('¿Borrar el costo?')) apiClient.delete(`/admin/finance/costs/${id}`).then(() => { if (editingId === id) reset(); load(); }).catch(() => {}); };

  const bearerLabel = (c) => c.bearer === 'agencia' ? 'Agencia (caja)' : c.bearer === 'persona' ? (c.bearer_person || 'Persona') : `Cliente: ${cname(c.bearer_client)}`;

  return (
    <div>
      <p className="fp-muted">Un costo lo <strong>paga</strong> alguien y lo <strong>soporta</strong> alguien. Quién lo soporta define de dónde sale: <strong>Agencia</strong> (baja la caja) · <strong>Persona</strong> (lo banca alguien de su bolsillo). Si es un fijo/sueldo a alguien, poné el <strong>beneficiario</strong>. <span className="fp-muted">(Los costos que son parte del servicio de un cliente —ej. automatización— se cargan en el servicio, en Deals Clientes.)</span></p>
      <div className="fp-card">
        <div className="fp-grid">
          <label>Concepto<input value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} placeholder="ej. WATI, contador, fijo edición" /></label>
          <label>Monto<input {...numProps} value={form.monto} onChange={(e) => setForm({ ...form, monto: formatMiles(e.target.value) })} /></label>
          <label>Moneda<select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}><option value="ARS">ARS</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
          <label>Quién lo pagó<select value={form.paid_by} onChange={(e) => setForm({ ...form, paid_by: e.target.value })}><option value="">La agencia (directo)</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
          <label>Quién lo soporta<select value={form.bearer} onChange={(e) => setForm({ ...form, bearer: e.target.value })}><option value="agencia">Agencia (caja)</option><option value="persona">Una persona</option></select></label>
          {form.bearer === 'persona' && <label>Persona que lo soporta<select value={form.bearer_person} onChange={(e) => setForm({ ...form, bearer_person: e.target.value })}><option value="">—</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>}
          <label title="Sólo si es un fijo/sueldo que RECIBE una persona">Beneficiario (opcional)<select value={form.beneficiary} onChange={(e) => setForm({ ...form, beneficiary: e.target.value })}><option value="">— (costo externo)</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
          <label>Recurrencia<select value={form.recurrencia} onChange={(e) => setForm({ ...form, recurrencia: e.target.value })}><option value="once">Una vez</option><option value="monthly">Mensual</option></select></label>
          <label>{form.recurrencia === 'monthly' ? 'Desde' : 'Mes'}<input type="month" value={form.from_month} onChange={(e) => setForm({ ...form, from_month: e.target.value })} /></label>
          {form.recurrencia === 'monthly' && <label>Hasta (opcional)<input type="month" value={form.to_month} onChange={(e) => setForm({ ...form, to_month: e.target.value })} /></label>}
        </div>
        {msg && <div className="fp-msg">{msg}</div>}
        <div className="fp-card-foot">
          {editingId && <button className="fp-btn" style={{ marginRight: 8 }} onClick={reset}>Cancelar</button>}
          <button className="fp-btn fp-btn--primary" onClick={save}>{editingId ? 'Guardar cambios' : 'Agregar costo'}</button>
        </div>
      </div>
      <table className="fp-table">
        <thead><tr><th>Concepto</th><th>Monto</th><th>Pagó</th><th>Lo soporta</th><th>Beneficiario</th><th>Vigencia</th><th></th></tr></thead>
        <tbody>
          {costs.length === 0 && <tr><td colSpan={7} className="fp-muted">Sin costos cargados.</td></tr>}
          {costs.map((c) => (
            <tr key={c.id}>
              <td>{c.concepto || '—'}</td>
              <td><strong>{c.moneda} {fmt(c.monto)}</strong></td>
              <td>{c.paid_by || <span className="fp-muted">agencia</span>}</td>
              <td><span className="fp-tag">{bearerLabel(c)}</span></td>
              <td>{c.beneficiary || '—'}</td>
              <td className="fp-muted">{c.recurrencia === 'monthly' ? `${c.from_month}${c.to_month ? ` → ${c.to_month}` : ' → sin fin'}` : c.from_month}</td>
              <td style={{ whiteSpace: 'nowrap' }}><button className="fp-btn" onClick={() => edit(c)}>✎</button> <button className="fp-btn fp-btn--danger" onClick={() => del(c.id)}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FinancePanel() {
  const [tab, setTab] = useState('deals');
  const [clients, setClients] = useState([]);
  const [people, setPeople] = useState([]);
  const [month, setMonth] = useState(currentYM());

  useEffect(() => {
    apiClient.get('/admin/clients').then((r) => setClients(r.data.clients || [])).catch(() => setClients([]));
    apiClient.get('/admin/users').then((r) => setPeople((r.data.users || []).map((u) => u.name))).catch(() => setPeople([]));
  }, []);

  return (
    <div className="ad-section">
      <h3 className="ad-section-title">Finanzas de la agencia</h3>
      <div className="fp-tabs">
        <button className={`fp-tab ${tab === 'deals' ? 'on' : ''}`} onClick={() => setTab('deals')}>Deals Clientes</button>
        <button className={`fp-tab ${tab === 'costos' ? 'on' : ''}`} onClick={() => setTab('costos')}>Costos</button>
        <button className={`fp-tab ${tab === 'reparto' ? 'on' : ''}`} onClick={() => setTab('reparto')}>Reparto del mes</button>
        <button className={`fp-tab ${tab === 'movimientos' ? 'on' : ''}`} onClick={() => setTab('movimientos')}>Movimientos</button>
        <button className={`fp-tab ${tab === 'pnl' ? 'on' : ''}`} onClick={() => setTab('pnl')}>P&amp;L</button>
        <label className="fp-inline" style={{ marginLeft: 'auto' }}>Mes
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>
      {tab === 'deals' && <DealsClientesTab clients={clients} people={people} month={month} setMonth={setMonth} />}
      {tab === 'costos' && <CostosTab people={people} clients={clients} month={month} />}
      {tab === 'reparto' && <RepartoTab month={month} clients={clients} />}
      {tab === 'movimientos' && <MovimientosTab people={people} clients={clients} month={month} />}
      {tab === 'pnl' && <PnlTab month={month} people={people} />}
    </div>
  );
}
