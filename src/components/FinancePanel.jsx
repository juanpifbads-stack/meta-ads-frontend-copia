import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client.js';
import './FinancePanel.css';

const SERVICIOS = [
  { k: 'meta', l: 'Meta Ads' }, { k: 'tiktok', l: 'TikTok' }, { k: 'contenido', l: 'Contenido' },
  { k: 'ecommerce', l: 'Ecommerce' }, { k: 'web', l: 'Web' }, { k: 'automatizacion', l: 'Automatización' },
];
const servLabel = (k) => (SERVICIOS.find((s) => s.k === k) || {}).l || k;
const currentYM = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; };
const fmt = (x) => Math.round(x || 0).toLocaleString('es-AR');

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

  // Cargamos la config VIGENTE DEL MES elegido (así ves el fee que corresponde a ese mes).
  const loadLines = useCallback((s) => {
    if (!s) return;
    apiClient.get(`/admin/finance/services?client=${s}&month=${month}`).then((r) => setLines((r.data.lines || []).map(normalizePost))).catch(() => setLines([]));
  }, [month]);
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
    // Automatización: se reparte el fee NETO de costos mensuales.
    const costos = l.servicio === 'automatizacion' ? (l.costos || []).reduce((s, c) => s + (Number(c.monto) || 0), 0) : 0;
    const fee = Math.max(0, (Number(l.fee) || 0) - costos);
    if (fee <= 0) return 'Cargá el fee mensual (o los costos se comen todo el fee).';
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
            <label>{l.servicio === 'automatizacion' ? 'Mantenimiento (mensual)' : 'Fee mensual'}<input {...numProps} value={l.fee ?? ''} onChange={(e) => setLine(i, { fee: e.target.value })} /></label>
          </div>

          {l.servicio === 'automatizacion' && (
            <>
              <div className="fp-grid">
                <label>Implementación (one-shot)<input {...numProps} value={l.setup_fee ?? ''} onChange={(e) => setLine(i, { setup_fee: e.target.value })} /></label>
                <label>Mes del cobro de implementación<input type="month" value={l.setup_month || ''} onChange={(e) => setLine(i, { setup_month: e.target.value })} /></label>
              </div>
              <div className="fp-pre">
                <div className="fp-sub">Costos mensuales (se restan antes de repartir)</div>
                {(l.costos || []).map((c, ci) => (
                  <div className="fp-pre-row" key={ci}>
                    <input placeholder="Nombre del costo" value={c.nombre || ''} onChange={(e) => setLine(i, { costos: l.costos.map((x, xi) => xi === ci ? { ...x, nombre: e.target.value } : x) })} style={{ flex: 1 }} />
                    <input {...numProps} placeholder="Monto" value={c.monto ?? ''} style={{ width: 110 }} onChange={(e) => setLine(i, { costos: l.costos.map((x, xi) => xi === ci ? { ...x, monto: e.target.value } : x) })} /><span className="fp-pct">{l.moneda}</span>
                    <button className="fp-btn fp-btn--danger" onClick={() => setLine(i, { costos: l.costos.filter((_, xi) => xi !== ci) })}>×</button>
                  </div>
                ))}
                <button className="fp-btn" onClick={() => setLine(i, { costos: [...(l.costos || []), { nombre: '', monto: '' }] })}>+ Costo</button>
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
            <label>Cobro<select value={l.cobro?.tipo || 'inicio_mes'} onChange={(e) => setLine(i, { cobro: { ...l.cobro, tipo: e.target.value } })}><option value="inicio_mes">Inicio de mes</option><option value="fecha">Fecha fija</option></select></label>
          </div>

          <div className="fp-card-foot"><button className="fp-btn fp-btn--primary" onClick={() => saveLine(i)}>Guardar {servLabel(l.servicio)}</button></div>
        </div>
      ))}

      {lines.length < SERVICIOS.length && <button className="fp-btn" onClick={addService}>+ Agregar servicio</button>}
    </div>
  );
}

// ─── Reparto del mes ──────────────────────────────────────────────────────────
const FUENTE_LBL = { 'pre': 'Pre-agencia', 'pre (fijo)': 'Pre-agencia (fijo)', 'sueldo socio': 'Sueldo socio', 'opex': 'OPEX' };
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
                              <td>{cname(s.client)}{s.descripcion ? <span className="fp-muted"> · {s.descripcion}</span> : ''}</td>
                              <td>{servLabel(s.servicio)} <span className="fp-tag">{s.tipo}</span></td>
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
function MovimientosTab({ people }) {
  const [accounts, setAccounts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [balances, setBalances] = useState(null);
  const [newAcc, setNewAcc] = useState('');
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), account_id: '', person: '', amount: '', moneda: 'ARS', note: '' });
  const [msg, setMsg] = useState('');
  const [cons, setCons] = useState('USD');

  const load = useCallback(() => {
    apiClient.get('/admin/finance/accounts').then((r) => setAccounts(r.data.accounts || [])).catch(() => {});
    apiClient.get('/admin/finance/transfers').then((r) => setTransfers(r.data.transfers || [])).catch(() => {});
    apiClient.get('/admin/finance/balances').then((r) => setBalances(r.data)).catch(() => setBalances({ rows: [], fx: null }));
  }, []);
  useEffect(() => { load(); }, [load]);

  const addAccount = () => {
    if (!newAcc.trim()) return;
    apiClient.post('/admin/finance/accounts', { name: newAcc.trim() }).then(() => { setNewAcc(''); load(); }).catch(() => {});
  };
  const delAccount = (id) => { if (window.confirm('¿Borrar la cuenta?')) apiClient.delete(`/admin/finance/accounts/${id}`).then(load).catch(() => {}); };
  const addTransfer = () => {
    if (!form.person || !(Number(form.amount) > 0)) { setMsg('Falta persona o monto'); return; }
    apiClient.post('/admin/finance/transfers', form).then(() => {
      setForm({ ...form, amount: '', note: '' }); setMsg('✓ Transferencia cargada'); setTimeout(() => setMsg(''), 2000); load();
    }).catch((e) => setMsg(e?.response?.data?.message || 'Error'));
  };
  const delTransfer = (id) => { if (window.confirm('¿Borrar la transferencia?')) apiClient.delete(`/admin/finance/transfers/${id}`).then(load).catch(() => {}); };

  const accName = (id) => accounts.find((a) => a.id === id)?.name || '—';
  const fx = balances?.fx || 0;
  const consSaldo = (s) => cons === 'USD' ? (s.USD + (fx ? s.ARS / fx : 0)) : (s.ARS + s.USD * fx);

  return (
    <div>
      {/* Cuentas */}
      <div className="fp-card">
        <div className="fp-card-head"><strong>Cuentas</strong></div>
        <div className="fp-cl-break" style={{ gap: 8, marginBottom: 10 }}>
          {accounts.map((a) => (
            <span key={a.id} className="fp-tag" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              {a.name} <span onClick={() => delAccount(a.id)} style={{ cursor: 'pointer', color: '#b91c1c' }}>×</span>
            </span>
          ))}
          {accounts.length === 0 && <span className="fp-muted">Sin cuentas todavía.</span>}
        </div>
        <div className="fp-inline">
          <input placeholder="Nueva cuenta (ej. Mercado Pago Agus)" value={newAcc} onChange={(e) => setNewAcc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addAccount()} style={{ width: 260 }} />
          <button className="fp-btn" onClick={addAccount}>+ Cuenta</button>
        </div>
      </div>

      {/* Nueva transferencia */}
      <div className="fp-card">
        <div className="fp-card-head"><strong>Cargar transferencia</strong>{msg && <span className="fp-msg" style={{ marginLeft: 'auto' }}>{msg}</span>}</div>
        <div className="fp-grid">
          <label>Fecha<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label>Cuenta<select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}><option value="">—</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label>Le entró a<select value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })}><option value="">—</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
          <label>Moneda<select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}><option value="ARS">ARS</option><option value="USD">USD</option></select></label>
          <label>Monto<input {...numProps} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          <label>Nota<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        </div>
        <div style={{ textAlign: 'right', marginTop: 8 }}><button className="fp-btn fp-btn--primary" onClick={addTransfer}>Cargar</button></div>
      </div>

      {/* Saldos acumulados */}
      <div className="fp-card">
        <div className="fp-card-head"><strong>Saldos por cobrar (acumulado)</strong>
          <span style={{ marginLeft: 'auto' }} className="fp-inline">Consolidar a
            <button className={`fp-btn ${cons === 'USD' ? 'fp-btn--primary' : ''}`} onClick={() => setCons('USD')}>USD</button>
            <button className={`fp-btn ${cons === 'ARS' ? 'fp-btn--primary' : ''}`} onClick={() => setCons('ARS')}>ARS</button>
          </span>
        </div>
        {!balances ? <div className="fp-muted">Cargando…</div> : (
          <table className="fp-table">
            <thead><tr><th>Persona</th><th>Le corresponde (USD/ARS)</th><th>Recibido (USD/ARS)</th><th>Saldo (USD/ARS)</th><th>Saldo consolidado ({cons})</th></tr></thead>
            <tbody>
              {balances.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.person}</td>
                  <td>{fmt(r.owed.USD)} / {fmt(r.owed.ARS)}</td>
                  <td>{fmt(r.received.USD)} / {fmt(r.received.ARS)}</td>
                  <td>{fmt(r.saldo.USD)} / {fmt(r.saldo.ARS)}</td>
                  <td className="fp-cons">{fmt(consSaldo(r.saldo))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="fp-muted" style={{ marginTop: 6 }}>Saldo = lo que le corresponde del reparto (histórico) − lo que ya recibió. Positivo = le deben; negativo = tiene plata de más.</p>
      </div>

      {/* Últimas transferencias */}
      <div className="fp-card">
        <div className="fp-card-head"><strong>Transferencias cargadas</strong></div>
        {transfers.length === 0 ? <div className="fp-muted">Ninguna todavía.</div> : (
          <table className="fp-table">
            <thead><tr><th>Fecha</th><th>Persona</th><th>Cuenta</th><th>Monto</th><th></th></tr></thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td><td>{t.person}</td><td>{accName(t.account_id)}{t.note ? <span className="fp-muted"> · {t.note}</span> : ''}</td>
                  <td>{t.moneda} {fmt(t.amount)}</td>
                  <td><span onClick={() => delTransfer(t.id)} style={{ cursor: 'pointer', color: '#b91c1c' }}>×</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
        <button className={`fp-tab ${tab === 'reparto' ? 'on' : ''}`} onClick={() => setTab('reparto')}>Reparto del mes</button>
        <button className={`fp-tab ${tab === 'movimientos' ? 'on' : ''}`} onClick={() => setTab('movimientos')}>Movimientos</button>
        {tab !== 'movimientos' && (
          <label className="fp-inline" style={{ marginLeft: 'auto' }}>Mes
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
        )}
      </div>
      {tab === 'deals' && <DealsClientesTab clients={clients} people={people} month={month} setMonth={setMonth} />}
      {tab === 'reparto' && <RepartoTab month={month} clients={clients} />}
      {tab === 'movimientos' && <MovimientosTab people={people} />}
    </div>
  );
}
