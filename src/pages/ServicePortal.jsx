import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../api/client.js';
import './ServicePortal.css';

const fmt = (n) => (n == null || isNaN(n)) ? '—' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const fmtDate = (iso) => { if (!iso) return '—'; try { return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }); } catch { return iso; } };
const today = () => new Date().toISOString().slice(0, 10);

// Portal de clientes de servicios (D'Floor). El cliente carga sus obras y cobros.
export default function ServicePortal({ client }) {
  const { slug, accessKey, name } = client;
  const [tab, setTab] = useState('obras');
  const [sales, setSales] = useState(null);
  const [config, setConfig] = useState({ vendedores: [], canales: [] });
  const [analytics, setAnalytics] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    apiClient.get(`/service/${slug}/sales`, { params: { key: accessKey } }).then((r) => setSales(r.data.sales || [])).catch(() => setSales([]));
    apiClient.get(`/service/${slug}/analytics`, { params: { key: accessKey } }).then((r) => setAnalytics(r.data)).catch(() => setAnalytics(null));
  }, [slug, accessKey]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiClient.get(`/service/${slug}/config`, { params: { key: accessKey } }).then((r) => setConfig(r.data.config || {})).catch(() => {});
  }, [slug, accessKey]);

  const vendedores = useMemo(() => uniq([...(config.vendedores || []), ...((sales || []).map((s) => s.vendedor))]), [config, sales]);
  const canales = useMemo(() => uniq([...(config.canales || []), ...((sales || []).map((s) => s.canal))]), [config, sales]);
  const totalImporte = (sales || []).reduce((a, s) => a + (Number(s.importe) || 0), 0);
  const totalSaldo = (sales || []).reduce((a, s) => a + (Number(s.saldo) || 0), 0);

  // Conversor de moneda: todo se guarda/calcula en ARS; el toggle lo muestra en la moneda elegida.
  const [cons, setCons] = useState('ARS');
  const dolar = (analytics && analytics.dolar) || 0;
  const money = useCallback((ars) => {
    const v = cons === 'USD' ? (dolar ? (Number(ars) || 0) / dolar : 0) : (Number(ars) || 0);
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: cons === 'USD' ? 'USD' : 'ARS', maximumFractionDigits: 0 }).format(v);
  }, [cons, dolar]);

  return (
    <div className="sp-page">
      <div className="sp-head">
        <span className="sp-brand">alquimia.</span>
        <span className="sp-brand-x">×</span>
        <span className="sp-client">{name}</span>
        <div className="sp-curr">
          {['ARS', 'USD'].map((c) => <button key={c} className={cons === c ? 'on' : ''} onClick={() => setCons(c)}>{c}</button>)}
          {cons === 'USD' && dolar > 0 && <span className="sp-curr-note">dólar oficial ${dolar}</span>}
        </div>
      </div>

      <div className="sp-tabs">
        {[['obras', 'Obras'], ['dashboard', 'Dashboard'], ['pnl', 'Rentabilidad'], ['embudo', 'Embudo']].map(([k, l]) => (
          <button key={k} className={`sp-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'obras' && (
        <>
          <div className="sp-kpis">
            <Kpi label="Obras cargadas" value={(sales || []).length} raw />
            <Kpi label="Vendido total" value={money(totalImporte)} />
            <Kpi label="Por cobrar" value={money(totalSaldo)} />
          </div>
          <div className="sp-section-head">
            <h2>Obras</h2>
            {!adding && <button className="sp-btn sp-btn--primary" onClick={() => setAdding(true)}>+ Cargar obra</button>}
          </div>
          {adding && <SaleForm slug={slug} accessKey={accessKey} vendedores={vendedores} canales={canales}
            onDone={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />}
          {sales === null ? <div className="sp-muted">Cargando…</div>
            : sales.length === 0 ? <div className="sp-muted">Todavía no cargaste ninguna obra. Tocá “+ Cargar obra”.</div>
              : <div className="sp-list">{sales.map((s) => <SaleCard key={s.id} slug={slug} accessKey={accessKey} sale={s} reload={load} money={money} />)}</div>}
        </>
      )}

      {tab === 'dashboard' && <DashboardTab a={analytics} money={money} />}
      {tab === 'pnl' && <PnlTab a={analytics} slug={slug} accessKey={accessKey} reload={load} money={money} />}
      {tab === 'embudo' && <FunnelTab slug={slug} accessKey={accessKey} money={money} />}
    </div>
  );
}

const curYM = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; };
const pctf = (x) => `${((x || 0) * 100).toFixed(0)}%`;

function FunnelTab({ slug, accessKey, money }) {
  const [month, setMonth] = useState(curYM());
  const [data, setData] = useState(null);
  const [manual, setManual] = useState({ visitas_agendadas: '', visitas_canceladas: '', recompras: '' });

  const load = useCallback(() => {
    setData(null);
    apiClient.get(`/service/${slug}/funnel`, { params: { key: accessKey, month } }).then((r) => {
      setData(r.data);
      const e = r.data.entradas;
      setManual({ visitas_agendadas: e.agendadas || '', visitas_canceladas: e.canceladas || '', recompras: e.recompras || '' });
    }).catch(() => setData(null));
  }, [slug, accessKey, month]);
  useEffect(() => { load(); }, [load]);

  const saveManual = () => {
    apiClient.put(`/service/${slug}/funnel`, { key: accessKey, month, ...manual }).then(load).catch(() => {});
  };

  return (
    <div>
      <div className="sp-section-head">
        <h2>Embudo — {month}</h2>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ padding: '7px 10px', border: '1px solid #d8d6cf', borderRadius: 8 }} />
      </div>
      {!data ? <div className="sp-muted">Cargando…</div> : (
        <>
          <Card title="Datos de Meta (automático)">
            <div className="sp-kpis sp-kpis--4">
              <Kpi label="Inversión (pauta)" value={money(data.entradas.spend)} />
              <Kpi label="Consultas" value={data.entradas.consultas} raw />
              <Kpi label="CPR (costo x consulta)" value={money(data.entradas.cpr)} />
              <Kpi label="Ventas del mes" value={data.entradas.ventas} raw />
            </div>
            {data.meta.source === 'error' && <div className="sp-muted">No se pudo traer Meta ({data.meta.error}). Cargá manual si hace falta.</div>}
            {data.meta.source === 'none' && <div className="sp-muted">Sin cuenta de Meta asignada a este cliente.</div>}
          </Card>

          <Card title="Carga manual (lo que Meta no da)">
            <div className="sp-form-grid">
              <label>Visitas agendadas<input inputMode="decimal" value={manual.visitas_agendadas} onChange={(e) => setManual({ ...manual, visitas_agendadas: e.target.value })} /></label>
              <label>Visitas canceladas / no-show<input inputMode="decimal" value={manual.visitas_canceladas} onChange={(e) => setManual({ ...manual, visitas_canceladas: e.target.value })} /></label>
              <label>Recompras (cliente repite)<input inputMode="decimal" value={manual.recompras} onChange={(e) => setManual({ ...manual, recompras: e.target.value })} /></label>
            </div>
            <div className="sp-form-actions"><button className="sp-btn sp-btn--primary" onClick={saveManual}>Guardar</button></div>
          </Card>

          <Card title="El embudo">
            <FunnelBars e={data.entradas} />
          </Card>

          <div className="sp-2col">
            <Card title="Costo por etapa">
              <Row2 l="Costo por consulta" v={money(data.costos.porConsulta)} />
              <Row2 l="Costo por visita efectiva" v={money(data.costos.porVisita)} />
              <Row2 l="Costo por venta (CAC)" v={money(data.costos.cac)} />
            </Card>
            <Card title="ROAS">
              <Row2 l="Económico (vendido ÷ pauta)" v={`${data.roas.economico.toFixed(1)}x`} />
              <Row2 l="Financiero (cobrado ÷ pauta)" v={`${data.roas.financiero.toFixed(1)}x`} />
              <Row2 l="Sobre margen bruto" v={`${data.roas.margen.toFixed(1)}x`} />
            </Card>
          </div>

          <Card title="Tasas de conversión">
            <Row2 l="Consulta → visita agendada" v={pctf(data.tasas.consultaVisitaAgendada)} hint="10-20% sano" />
            <Row2 l="Consulta → visita efectiva" v={pctf(data.tasas.consultaVisitaEfectiva)} hint=">10%" />
            <Row2 l="Tasa de cancelación / no-show" v={pctf(data.tasas.cancelacion)} hint="<15%" />
            <Row2 l="Visita efectiva → venta (cierre)" v={pctf(data.tasas.cierre)} hint="15-25% sano" />
            <Row2 l="Cierre solo leads nuevos" v={pctf(data.tasas.cierreNuevos)} />
            <Row2 l="Consulta → venta (global)" v={pctf(data.tasas.consultaVenta)} hint="2-4%" />
          </Card>

          <Card title="Veredicto">
            {data.veredicto.map((v, i) => <div key={i} style={{ fontSize: 14, marginBottom: 6 }}>{v}</div>)}
          </Card>
        </>
      )}
    </div>
  );
}

function Row2({ l, v, hint }) {
  return <div className="sp-rank-top" style={{ padding: '6px 0', borderBottom: '0.5px solid #f0efe9' }}><span>{l}{hint ? <span className="sp-muted" style={{ marginLeft: 6 }}>· {hint}</span> : ''}</span><strong>{v}</strong></div>;
}

function FunnelBars({ e }) {
  const stages = [
    { name: 'Consultas', v: e.consultas, color: '#1b1fe8' },
    { name: 'Visitas agendadas', v: e.agendadas, color: '#4b6bff' },
    { name: 'Visitas efectivas', v: e.efectivas, color: '#5bc48a' },
    { name: 'Ventas', v: e.ventas, color: '#178048' },
  ];
  const max = Math.max(1, ...stages.map((s) => s.v));
  return (
    <div className="sp-funnel">
      {stages.map((s) => (
        <div className="sp-funnel-row" key={s.name}>
          <div className="sp-funnel-label">{s.name}</div>
          <div className="sp-funnel-bar"><div style={{ width: `${(s.v / max) * 100}%`, background: s.color }}>{s.v}</div></div>
        </div>
      ))}
    </div>
  );
}

// ── Gráfico de columnas SVG (una o dos series por mes) ──
function ColumnChart({ rows, series, height = 150 }) {
  if (!rows || !rows.length) return <div className="sp-muted">Sin datos.</div>;
  const bw = 22, inner = 3, gap = 20, pad = 6;
  const groupW = series.length * (bw + inner) + gap;
  const W = rows.length * groupW + pad * 2;
  const max = Math.max(1, ...rows.flatMap((r) => series.map((s) => Math.abs(r[s.key] || 0))));
  return (
    <div className="sp-chart-scroll">
      <svg viewBox={`0 0 ${W} ${height + 26}`} width={Math.max(W, 280)} height={height + 26}>
        {rows.map((r, i) => {
          const x0 = pad + i * groupW;
          return (
            <g key={i}>
              {series.map((s, si) => {
                const v = r[s.key] || 0;
                const h = Math.abs(v) / max * height;
                const x = x0 + si * (bw + inner);
                const neg = v < 0;
                return <rect key={si} x={x} y={neg ? height : height - h} width={bw} height={h} fill={neg ? '#e05656' : s.color} rx="3" />;
              })}
              <text x={x0 + (series.length * (bw + inner)) / 2 - inner / 2} y={height + 16} fontSize="10" textAnchor="middle" fill="#8a8d96">{r.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Legend({ items }) {
  return <div className="sp-legend">{items.map((i) => <span key={i.name}><i style={{ background: i.color }} />{i.name}</span>)}</div>;
}

// ── Ranking horizontal (canal / vendedor / demografía) ──
function Ranking({ items, money }) {
  if (!items || !items.length) return <div className="sp-muted">Sin datos.</div>;
  const val = (i) => (i.monto != null ? i.monto : i.n);
  const max = Math.max(1, ...items.map(val));
  return (
    <div className="sp-rank">
      {items.map((i) => (
        <div className="sp-rank-row" key={i.nombre}>
          <div className="sp-rank-top"><span>{i.nombre}</span><span>{i.monto != null && money ? `${money(i.monto)} · ` : ''}{(i.pct * 100).toFixed(0)}% · {i.n}</span></div>
          <div className="sp-rank-bar"><div style={{ width: `${(val(i) / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function DashboardTab({ a, money }) {
  if (!a) return <div className="sp-muted">Cargando…</div>;
  const r = a.resumen;
  const ins = a.insights || {};
  return (
    <div>
      <div className="sp-kpis sp-kpis--4">
        <Kpi label="Vendido total" value={money(r.ventasTotales)} />
        <Kpi label="Colocado" value={money(r.colocadoTotal)} />
        <Kpi label="Obras" value={r.cantidad} raw />
        <Kpi label="Ticket promedio" value={money(r.ticketProm)} />
      </div>
      <Card title="Ventas y colocaciones por mes">
        <Legend items={[{ name: 'Vendido', color: '#1b1fe8' }, { name: 'Colocado', color: '#5bc48a' }]} />
        <ColumnChart rows={a.porMes} series={[{ key: 'ventas', color: '#1b1fe8' }, { key: 'colocado', color: '#5bc48a' }]} />
      </Card>
      <div className="sp-2col">
        <Card title="Por canal / anuncio"><Ranking items={a.porCanal} money={money} /></Card>
        <Card title="Por vendedor"><Ranking items={a.porVendedor} money={money} /></Card>
      </div>

      <Card title="Dispersión de tickets">
        <Row2 l="Mediano" v={money(r.ticketMediano)} /><Row2 l="Mínimo" v={money(r.ticketMin)} /><Row2 l="Máximo" v={money(r.ticketMax)} />
        <div style={{ marginTop: 10 }}><Ranking items={(a.tickets || []).map((t) => ({ nombre: t.label, n: t.n, monto: t.monto, pct: t.pct }))} money={money} /></div>
      </Card>

      {ins.conDatos > 0 && (
        <>
          <div className="sp-2col">
            <Card title="Género"><Ranking items={ins.genero} /></Card>
            <Card title="Tipo de propiedad"><Ranking items={ins.tipo} /></Card>
          </div>
          <div className="sp-2col">
            <Card title="Barrios (top)"><Ranking items={(ins.barrio || []).slice(0, 8)} /></Card>
            <Card title="Colores más elegidos"><Ranking items={(ins.color || []).slice(0, 8)} /></Card>
          </div>
          <Card title="Promedios">
            <Row2 l="m² promedio" v={(ins.m2Promedio || 0).toFixed(0)} />
            <Row2 l="m² total colocado" v={(ins.m2Total || 0).toFixed(0)} />
            <Row2 l="Edad promedio" v={ins.edadPromedio ? ins.edadPromedio.toFixed(0) : '—'} />
          </Card>
        </>
      )}
    </div>
  );
}

function PnlTab({ a, slug, accessKey, reload, money }) {
  const [editParams, setEditParams] = useState(false);
  if (!a) return <div className="sp-muted">Cargando…</div>;
  const rows = [
    ['Ventas firmadas', 'firmado'], ['Cobrado en el mes', 'cobrado'], ['(−) Costo variable', 'costoVariable'],
    ['(=) Margen bruto', 'margenBruto'], ['(−) Comisión vendedor', 'comVendedor'], ['(−) Comisión agencia', 'comAgencia'],
    ['(=) Margen tras comisiones', 'margenTrasCom'], ['(−) Costos fijos', 'costosFijos'], ['(=) Resultado neto', 'resultadoNeto'],
  ];
  return (
    <div>
      <div className="sp-kpis sp-kpis--4">
        <Kpi label="Facturado acum." value={money(a.totales.cobrado)} />
        <Kpi label="Resultado neto acum." value={money(a.totales.resultadoNeto)} />
        <Kpi label="Facturación de equilibrio" value={money(a.equilibrio.facturacion)} />
        <Kpi label="Obras para equilibrio" value={a.equilibrio.obras.toFixed(1)} raw />
      </div>

      <Card title="Resultado neto por mes">
        <ColumnChart rows={a.pnl} series={[{ key: 'resultadoNeto', color: '#5bc48a' }]} />
      </Card>

      <Card title="Estado de resultados mensual">
        <div className="sp-table-scroll">
          <table className="sp-table">
            <thead><tr><th>Concepto</th>{a.pnl.map((m) => <th key={m.month}>{m.label}</th>)}</tr></thead>
            <tbody>
              {rows.map(([label, key]) => (
                <tr key={key} className={key.startsWith('resultadoNeto') ? 'sp-tr-strong' : ''}>
                  <td>{label}</td>
                  {a.pnl.map((m) => <td key={m.month} className={m[key] < 0 ? 'sp-neg' : ''}>{m[key] ? money(m[key]) : '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="sp-section-head">
        <h2>Parámetros del negocio</h2>
        <button className="sp-btn" onClick={() => setEditParams(!editParams)}>{editParams ? 'Cerrar' : 'Editar'}</button>
      </div>
      {editParams
        ? <ParamsEditor slug={slug} accessKey={accessKey} sup={a.supuestos} onSaved={() => { setEditParams(false); reload(); }} />
        : <ParamsSummary sup={a.supuestos} />}
    </div>
  );
}

function ParamsSummary({ sup }) {
  return (
    <div className="sp-form">
      <div className="sp-cl-break">
        <span>Rentabilidad por obra: <strong>{(sup.pctRentabilidad * 100).toFixed(0)}%</strong></span>
        <span>Comisión vendedor: <strong>{(sup.comisionVendedorPct * 100).toFixed(0)}%</strong></span>
        <span>Costos fijos: <strong>{fmt(sup.costosFijosTotal)}</strong></span>
      </div>
    </div>
  );
}

function ParamsEditor({ slug, accessKey, sup, onSaved }) {
  const [pct, setPct] = useState(String((sup.pctRentabilidad * 100) || 0));
  const [comVend, setComVend] = useState(String((sup.comisionVendedorPct * 100) || 0));
  const [fijos, setFijos] = useState(sup.costosFijos && sup.costosFijos.length ? sup.costosFijos : [{ nombre: '', monto: '' }]);
  const [tramos, setTramos] = useState(sup.comisionTramos || []);
  const save = () => {
    const supuestos = {
      pctRentabilidad: (Number(pct) || 0) / 100,
      comisionVendedorPct: (Number(comVend) || 0) / 100,
      costosFijos: fijos.filter((f) => f.nombre && Number(f.monto) > 0).map((f) => ({ nombre: f.nombre, monto: Number(f.monto) })),
      comisionTramos: tramos.map((t) => ({ hasta: t.hasta === '' || t.hasta == null ? null : Number(t.hasta), pct: Number(t.pct) || 0 })),
    };
    apiClient.put(`/service/${slug}/config`, { key: accessKey, config: { supuestos } }).then(onSaved).catch(() => {});
  };
  return (
    <div className="sp-form">
      <div className="sp-form-grid">
        <label>Rentabilidad por obra (%)<input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} /></label>
        <label>Comisión vendedor (%)<input inputMode="decimal" value={comVend} onChange={(e) => setComVend(e.target.value)} /></label>
      </div>
      <div className="sp-pays-title" style={{ marginTop: 12 }}>Costos fijos mensuales</div>
      {fijos.map((f, i) => (
        <div className="sp-pay-add" key={i}>
          <input placeholder="Concepto" value={f.nombre} onChange={(e) => setFijos(fijos.map((x, xi) => xi === i ? { ...x, nombre: e.target.value } : x))} />
          <input inputMode="decimal" placeholder="Monto" value={f.monto} onChange={(e) => setFijos(fijos.map((x, xi) => xi === i ? { ...x, monto: e.target.value } : x))} />
          <span className="sp-x" onClick={() => setFijos(fijos.filter((_, xi) => xi !== i))}>×</span>
        </div>
      ))}
      <button className="sp-btn" onClick={() => setFijos([...fijos, { nombre: '', monto: '' }])}>+ Costo fijo</button>
      <div className="sp-pays-title" style={{ marginTop: 12 }}>Comisión agencia — % sobre el TOTAL facturado del mes según el tramo (ej. hasta $20M · 0% = se activa recién arriba de $20M)</div>
      {tramos.map((t, i) => (
        <div className="sp-pay-add" key={i}>
          <input inputMode="decimal" placeholder="Hasta $ (vacío = ∞)" value={t.hasta ?? ''} onChange={(e) => setTramos(tramos.map((x, xi) => xi === i ? { ...x, hasta: e.target.value } : x))} />
          <input inputMode="decimal" placeholder="% (ej 0.03)" value={t.pct} onChange={(e) => setTramos(tramos.map((x, xi) => xi === i ? { ...x, pct: e.target.value } : x))} />
          <span className="sp-x" onClick={() => setTramos(tramos.filter((_, xi) => xi !== i))}>×</span>
        </div>
      ))}
      <button className="sp-btn" onClick={() => setTramos([...tramos, { hasta: '', pct: 0 }])}>+ Tramo</button>
      <div className="sp-form-actions"><button className="sp-btn sp-btn--primary" onClick={save}>Guardar parámetros</button></div>
    </div>
  );
}

function Card({ title, children }) {
  return <div className="sp-block"><div className="sp-block-title">{title}</div>{children}</div>;
}

function uniq(arr) { return [...new Set(arr.filter((x) => x && String(x).trim()))]; }

function Kpi({ label, value, raw }) {
  return <div className="sp-kpi"><div className="sp-kpi-label">{label}</div><div className="sp-kpi-value">{raw ? value : value}</div></div>;
}

function SaleForm({ slug, accessKey, vendedores, canales, onDone, onCancel, initial }) {
  const base = { fecha_venta: today(), cliente_nombre: '', importe: '', vendedor: '', canal: '', fecha_visita: '', fecha_colocacion: '', m2: '', genero: '', barrio: '', edad: '', tipo: '', color: '' };
  // Al editar, aplanamos el jsonb extra en los campos del form.
  const [f, setF] = useState(initial ? { ...base, ...initial, ...(initial.extra || {}) } : base);
  const [showDatos, setShowDatos] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const save = () => {
    if (!f.cliente_nombre.trim() || !(Number(f.importe) > 0)) return;
    setSaving(true);
    const extra = {};
    for (const k of ['genero', 'barrio', 'edad', 'tipo', 'color']) if (f[k] !== '' && f[k] != null) extra[k] = f[k];
    const payload = { key: accessKey, fecha_venta: f.fecha_venta, cliente_nombre: f.cliente_nombre, importe: f.importe, vendedor: f.vendedor, canal: f.canal, m2: f.m2, fecha_visita: f.fecha_visita, fecha_colocacion: f.fecha_colocacion, extra };
    const req = initial?.id
      ? apiClient.patch(`/service/${slug}/sales/${initial.id}`, payload)
      : apiClient.post(`/service/${slug}/sales`, payload);
    req.then(onDone).catch(() => setSaving(false));
  };
  return (
    <div className="sp-form">
      <div className="sp-form-grid">
        <label>Fecha de venta<input type="date" value={f.fecha_venta || ''} onChange={(e) => set('fecha_venta', e.target.value)} /></label>
        <label>Cliente<input value={f.cliente_nombre} onChange={(e) => set('cliente_nombre', e.target.value)} placeholder="Nombre" /></label>
        <label>Importe<input inputMode="decimal" value={f.importe} onChange={(e) => set('importe', e.target.value)} placeholder="$" /></label>
        <label>Vendedor<input list="sp-vendedores" value={f.vendedor} onChange={(e) => set('vendedor', e.target.value)} /><datalist id="sp-vendedores">{vendedores.map((v) => <option key={v} value={v} />)}</datalist></label>
        <label>Canal / anuncio (opcional)<input list="sp-canales" value={f.canal} onChange={(e) => set('canal', e.target.value)} /><datalist id="sp-canales">{canales.map((v) => <option key={v} value={v} />)}</datalist></label>
        <label>m² (opcional)<input inputMode="decimal" value={f.m2} onChange={(e) => set('m2', e.target.value)} /></label>
        <label>Fecha de visita<input type="date" value={f.fecha_visita || ''} onChange={(e) => set('fecha_visita', e.target.value)} /></label>
        <label>Fecha de colocación<input type="date" value={f.fecha_colocacion || ''} onChange={(e) => set('fecha_colocacion', e.target.value)} /></label>
      </div>
      <button className="sp-btn" style={{ marginTop: 10 }} onClick={() => setShowDatos(!showDatos)}>{showDatos ? '− Datos del cliente' : '+ Datos del cliente (opcional)'}</button>
      {showDatos && (
        <div className="sp-form-grid" style={{ marginTop: 10 }}>
          <label>Género<select value={f.genero} onChange={(e) => set('genero', e.target.value)}><option value="">—</option><option>Mujer</option><option>Hombre</option><option>Otro/NS</option></select></label>
          <label>Edad<input inputMode="decimal" value={f.edad} onChange={(e) => set('edad', e.target.value)} /></label>
          <label>Barrio<input value={f.barrio} onChange={(e) => set('barrio', e.target.value)} /></label>
          <label>Tipo de propiedad<select value={f.tipo} onChange={(e) => set('tipo', e.target.value)}><option value="">—</option><option>Casa</option><option>Departamento</option><option>PH</option><option>Local/Comercial</option></select></label>
          <label>Color elegido<input value={f.color} onChange={(e) => set('color', e.target.value)} /></label>
        </div>
      )}
      <div className="sp-form-actions">
        <button className="sp-btn" onClick={onCancel}>Cancelar</button>
        <button className="sp-btn sp-btn--primary" onClick={save} disabled={saving}>{initial?.id ? 'Guardar' : 'Cargar obra'}</button>
      </div>
    </div>
  );
}

function SaleCard({ slug, accessKey, sale, reload, money }) {
  const m = money || fmt;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pay, setPay] = useState({ fecha: today(), monto: '' });
  const pagado = sale.saldo <= 0.5;

  const addPay = () => {
    if (!(Number(pay.monto) > 0)) return;
    apiClient.post(`/service/${slug}/sales/${sale.id}/payments`, { key: accessKey, ...pay }).then(() => { setPay({ fecha: today(), monto: '' }); reload(); }).catch(() => {});
  };
  const delPay = (pid) => apiClient.delete(`/service/${slug}/payments/${pid}`, { params: { key: accessKey } }).then(reload).catch(() => {});
  const delSale = () => { if (window.confirm(`¿Borrar la obra de ${sale.cliente_nombre}?`)) apiClient.delete(`/service/${slug}/sales/${sale.id}`, { params: { key: accessKey } }).then(reload).catch(() => {}); };

  if (editing) return <SaleForm slug={slug} accessKey={accessKey} vendedores={[]} canales={[]} initial={{ ...sale }} onDone={() => { setEditing(false); reload(); }} onCancel={() => setEditing(false)} />;

  return (
    <div className="sp-card">
      <div className="sp-card-top" onClick={() => setOpen(!open)}>
        <div>
          <div className="sp-card-name">{open ? '▾' : '▸'} {sale.cliente_nombre || 'Sin nombre'}</div>
          <div className="sp-card-sub">{fmtDate(sale.fecha_venta)}{sale.vendedor ? ` · ${sale.vendedor}` : ''}{sale.canal ? ` · ${sale.canal}` : ''}{sale.m2 ? ` · ${sale.m2} m²` : ''}</div>
        </div>
        <div className="sp-card-right">
          <div className="sp-card-imp">{m(sale.importe)}</div>
          <div className={`sp-chip ${pagado ? 'sp-chip--ok' : 'sp-chip--pend'}`}>{pagado ? 'Cobrado' : `Saldo ${m(sale.saldo)}`}</div>
        </div>
      </div>
      {open && (
        <div className="sp-card-body">
          <div className="sp-pays-title">Cobros</div>
          {(sale.payments || []).length === 0 ? <div className="sp-muted">Sin cobros cargados.</div>
            : sale.payments.map((p) => (
              <div className="sp-pay-row" key={p.id}><span>{fmtDate(p.fecha)}</span><strong>{m(p.monto)}</strong><span className="sp-x" onClick={() => delPay(p.id)}>×</span></div>
            ))}
          <div className="sp-pay-add">
            <input type="date" value={pay.fecha} onChange={(e) => setPay({ ...pay, fecha: e.target.value })} />
            <input inputMode="decimal" placeholder="Monto del cobro" value={pay.monto} onChange={(e) => setPay({ ...pay, monto: e.target.value })} />
            <button className="sp-btn sp-btn--primary" onClick={addPay}>+ Cobro</button>
          </div>
          <div className="sp-card-actions">
            <button className="sp-btn" onClick={() => setEditing(true)}>Editar obra</button>
            <button className="sp-btn sp-btn--danger" onClick={delSale}>Borrar obra</button>
          </div>
        </div>
      )}
    </div>
  );
}
