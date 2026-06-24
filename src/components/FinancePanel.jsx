import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client.js';
import './FinancePanel.css';

const SERVICIOS = [
  { k: 'meta', l: 'Meta Ads' }, { k: 'tiktok', l: 'TikTok' }, { k: 'contenido', l: 'Contenido' },
  { k: 'ecommerce', l: 'Ecommerce' }, { k: 'web', l: 'Web' },
];
const servLabel = (k) => (SERVICIOS.find((s) => s.k === k) || {}).l || k;
const currentYM = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; };
const fmt = (x) => Math.round(x || 0).toLocaleString('es-AR');

function defaultLine(servicio) {
  return {
    servicio, tipo: 'post', moneda: 'ARS', fee: 0, socio_pct: 50, opex_pct: 30, opex_operador: '',
    reparto: [{ persona: '', pct: 100 }], variable: { modo: 'none', base: 0, rate: 0, fuente: 'manual' },
    cobro: { tipo: 'inicio_mes' },
  };
}

// ─── Configuración ───────────────────────────────────────────────────────────
function ConfigTab({ clients, people, month }) {
  const [slug, setSlug] = useState(clients[0]?.slug || '');
  const [lines, setLines] = useState([]);
  const [fx, setFx] = useState('');
  const [msg, setMsg] = useState('');

  const loadLines = useCallback((s) => {
    if (!s) return;
    apiClient.get(`/admin/finance/services?client=${s}`).then((r) => setLines(r.data.lines || [])).catch(() => setLines([]));
  }, []);
  useEffect(() => { loadLines(slug); }, [slug, loadLines]);
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
  const saveLine = (i) => {
    const l = lines[i];
    apiClient.post('/admin/finance/services', { client_slug: slug, ...l })
      .then(() => { setMsg(`✓ ${servLabel(l.servicio)} guardado`); setTimeout(() => setMsg(''), 2000); loadLines(slug); })
      .catch(() => setMsg('Error al guardar'));
  };
  const delLine = (l) => {
    if (!l.id) { setLines((ls) => ls.filter((x) => x !== l)); return; }
    apiClient.delete(`/admin/finance/services/${slug}/${l.servicio}`).then(() => loadLines(slug)).catch(() => {});
  };

  return (
    <div>
      <div className="fp-bar">
        <label className="fp-inline">Cliente
          <select value={slug} onChange={(e) => setSlug(e.target.value)}>
            {clients.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </label>
        <label className="fp-inline" style={{ marginLeft: 'auto' }}>Tipo de cambio (ARS por USD)
          <input type="number" value={fx} onChange={(e) => setFx(e.target.value)} style={{ width: 90 }} />
          <button className="fp-btn" onClick={saveFx}>Guardar</button>
        </label>
      </div>
      {msg && <div className="fp-msg">{msg}</div>}

      {lines.map((l, i) => (
        <div className="fp-card" key={l.id || `new-${i}`}>
          <div className="fp-card-head">
            <strong>{servLabel(l.servicio)}</strong>
            <span className="fp-tag">{l.tipo === 'pre' ? 'pre-agencia' : 'post-agencia'}</span>
            <button className="fp-btn fp-btn--danger" style={{ marginLeft: 'auto' }} onClick={() => delLine(l)}>Quitar</button>
          </div>
          <div className="fp-grid">
            <label>Tipo<select value={l.tipo} onChange={(e) => setLine(i, { tipo: e.target.value })}><option value="post">Post-agencia</option><option value="pre">Pre-agencia</option></select></label>
            <label>Moneda<select value={l.moneda} onChange={(e) => setLine(i, { moneda: e.target.value })}><option value="ARS">ARS</option><option value="USD">USD</option></select></label>
            <label>Fee mensual<input type="number" value={l.fee} onChange={(e) => setLine(i, { fee: parseFloat(e.target.value) || 0 })} /></label>
          </div>

          {l.tipo === 'post' ? (
            <div className="fp-grid">
              <label>Sueldo socios %<input type="number" value={l.socio_pct} onChange={(e) => setLine(i, { socio_pct: parseFloat(e.target.value) || 0 })} /></label>
              <label>OPEX %<select value={l.opex_pct} onChange={(e) => setLine(i, { opex_pct: parseFloat(e.target.value) })}><option value="30">30 %</option><option value="40">40 %</option></select></label>
              <label>Operador (OPEX)<select value={l.opex_operador || ''} onChange={(e) => setLine(i, { opex_operador: e.target.value })}><option value="">—</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
            </div>
          ) : (
            <div className="fp-pre">
              <div className="fp-sub">Operadores (suma 100%)</div>
              {(l.reparto || []).map((r, ri) => (
                <div className="fp-pre-row" key={ri}>
                  <select value={r.persona || ''} onChange={(e) => setLine(i, { reparto: l.reparto.map((x, xi) => xi === ri ? { ...x, persona: e.target.value } : x) })}><option value="">—</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                  <input type="number" value={r.pct} style={{ width: 70 }} onChange={(e) => setLine(i, { reparto: l.reparto.map((x, xi) => xi === ri ? { ...x, pct: parseFloat(e.target.value) || 0 } : x) })} /><span className="fp-pct">%</span>
                  {l.reparto.length > 1 && <button className="fp-btn fp-btn--danger" onClick={() => setLine(i, { reparto: l.reparto.filter((_, xi) => xi !== ri) })}>×</button>}
                </div>
              ))}
              <button className="fp-btn" onClick={() => setLine(i, { reparto: [...l.reparto, { persona: '', pct: 0 }] })}>+ Operador</button>
            </div>
          )}

          <div className="fp-grid">
            <label>Variable<select value={l.variable?.modo || 'none'} onChange={(e) => setVar(i, { modo: e.target.value })}><option value="none">Sin variable</option><option value="differential">Diferencial</option><option value="percent">Sobre total</option></select></label>
            {l.variable?.modo !== 'none' && <label>Base<input type="number" value={l.variable?.base || 0} onChange={(e) => setVar(i, { base: parseFloat(e.target.value) || 0 })} /></label>}
            {l.variable?.modo !== 'none' && <label>Rate %<input type="number" value={l.variable?.rate || 0} onChange={(e) => setVar(i, { rate: parseFloat(e.target.value) || 0 })} /></label>}
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
function RepartoTab({ month }) {
  const [data, setData] = useState(null);
  const [cons, setCons] = useState('USD');
  useEffect(() => { apiClient.get(`/admin/finance/reparto?month=${month}`).then((r) => setData(r.data)).catch(() => setData(null)); }, [month]);
  if (!data) return <div className="fp-muted">Cargando…</div>;
  const fx = data.fx || 0;
  const consolidate = (p) => cons === 'USD' ? (p.USD.total + (fx ? p.ARS.total / fx : 0)) : (p.ARS.total + p.USD.total * fx);

  const rows = [...data.people, { person: 'Caja de la agencia', USD: data.caja.USD, ARS: data.caja.ARS, caja: true }];
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
        <thead><tr><th>Persona</th><th>Gana USD</th><th>Gana ARS</th><th>Consolidado ({cons})</th></tr></thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={i} className={p.caja ? 'fp-caja' : ''}>
              <td>{p.person}</td>
              <td>{p.USD.total ? fmt(p.USD.total) : '—'}</td>
              <td>{p.ARS.total ? fmt(p.ARS.total) : '—'}</td>
              <td className="fp-cons">{fmt(consolidate(p))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!fx && <p className="fp-muted">Cargá el tipo de cambio en la pestaña Configuración para que el consolidado mezcle monedas.</p>}
    </div>
  );
}

// ─── Por cliente ──────────────────────────────────────────────────────────────
function ByClientTab({ month, clients }) {
  const [data, setData] = useState(null);
  const name = (slug) => (clients.find((c) => c.slug === slug) || {}).name || slug;
  useEffect(() => { apiClient.get(`/admin/finance/by-client?month=${month}`).then((r) => setData(r.data.clients || [])).catch(() => setData([])); }, [month]);
  if (!data) return <div className="fp-muted">Cargando…</div>;
  if (!data.length) return <div className="fp-muted">No hay líneas de servicio cargadas todavía.</div>;
  return (
    <div>
      {data.map((c) => (
        <div className="fp-card" key={c.client}>
          <div className="fp-card-head"><strong>{name(c.client)}</strong></div>
          {c.lines.map((l, i) => (
            <div key={i} className="fp-cl-line">
              <div className="fp-cl-head"><span>{servLabel(l.servicio)} · {l.moneda} {fmt(l.total)}</span><span className="fp-tag">{l.tipo}{l.variable ? ` · var ${fmt(l.variable)}` : ''}</span></div>
              <div className="fp-cl-break">{l.breakdown.map((b, bi) => <span key={bi}>{b.label}: <strong>{fmt(b.amount)}</strong></span>)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function FinancePanel() {
  const [tab, setTab] = useState('config');
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
        <button className={`fp-tab ${tab === 'config' ? 'on' : ''}`} onClick={() => setTab('config')}>Configuración</button>
        <button className={`fp-tab ${tab === 'reparto' ? 'on' : ''}`} onClick={() => setTab('reparto')}>Reparto del mes</button>
        <button className={`fp-tab ${tab === 'porCliente' ? 'on' : ''}`} onClick={() => setTab('porCliente')}>Por cliente</button>
        <label className="fp-inline" style={{ marginLeft: 'auto' }}>Mes
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>
      {tab === 'config' && <ConfigTab clients={clients} people={people} month={month} />}
      {tab === 'reparto' && <RepartoTab month={month} />}
      {tab === 'porCliente' && <ByClientTab month={month} clients={clients} />}
    </div>
  );
}
