import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../api/client.js';
import './ServicePortal.css';

const fmt = (n) => (n == null || isNaN(n)) ? '—' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const fmtDate = (iso) => { if (!iso) return '—'; try { return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }); } catch { return iso; } };
const today = () => new Date().toISOString().slice(0, 10);

// Portal de clientes de servicios (D'Floor). El cliente carga sus obras y cobros.
export default function ServicePortal({ client }) {
  const { slug, accessKey, name } = client;
  const [tab, setTab] = useState('dashboard');
  const [sales, setSales] = useState(null);
  const [config, setConfig] = useState({ vendedores: [], canales: [] });
  const [analytics, setAnalytics] = useState(null);

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
        {[['dashboard', 'Dashboard'], ['analitica', 'Analítica'], ['pnl', 'Rentabilidad'], ['ventas', 'Ventas']].map(([k, l]) => (
          <button key={k} className={`sp-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'dashboard' && <HomeTab a={analytics} slug={slug} accessKey={accessKey} money={money} />}
      {tab === 'analitica' && <AnaliticaTab a={analytics} money={money} />}
      {tab === 'pnl' && <PnlTab a={analytics} slug={slug} accessKey={accessKey} reload={load} money={money} />}
      {tab === 'ventas' && <VentasTab slug={slug} accessKey={accessKey} sales={sales} reload={load} money={money} vendedores={vendedores} canales={canales} />}
    </div>
  );
}

// ── Dashboard (home): métricas de negocio + adquisición del mes ──
function HomeTab({ a, slug, accessKey, money }) {
  const months = useMemo(() => (a?.porMes || []).map((m) => m.month), [a]);
  const [sel, setSel] = useState('');
  useEffect(() => { if (!sel && months.length) setSel(months[months.length - 1]); }, [months, sel]);
  const [funnel, setFunnel] = useState(null);
  useEffect(() => {
    if (!sel || sel === 'todos') { setFunnel(null); return; }
    apiClient.get(`/service/${slug}/funnel`, { params: { key: accessKey, month: sel } }).then((r) => setFunnel(r.data)).catch(() => setFunnel(null));
  }, [slug, accessKey, sel]);

  if (!a) return <div className="sp-muted">Cargando…</div>;
  const isAll = sel === 'todos';
  const pm = a.porMes.find((m) => m.month === sel);
  const pn = a.pnl.find((m) => m.month === sel);
  const facturado = isAll ? a.totales.cobrado : (pn ? pn.cobrado : 0);
  const vendido = isAll ? a.resumen.ventasTotales : (pm ? pm.ventas : 0);
  const nVentas = isAll ? a.resumen.cantidad : (pm ? pm.nVentas : 0);
  const colocado = isAll ? a.porMes.reduce((s, m) => s + m.colocado, 0) : (pm ? pm.colocado : 0);
  const nColoc = isAll ? a.porMes.reduce((s, m) => s + m.nColocaciones, 0) : (pm ? pm.nColocaciones : 0);

  return (
    <div>
      <div className="sp-section-head">
        <h2>Métricas del negocio</h2>
        <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ padding: '7px 10px', border: '1px solid #d8d6cf', borderRadius: 8 }}>
          {a.porMes.map((m) => <option key={m.month} value={m.month}>{m.label}</option>)}
          <option value="todos">Todos los meses</option>
        </select>
      </div>
      <div className="sp-kpis">
        <Kpi label="Facturación (cobrado)" value={money(facturado)} />
        <Kpi label="Ventas firmadas" value={`${nVentas} · ${money(vendido)}`} raw />
        <Kpi label="Colocaciones" value={`${nColoc} · ${money(colocado)}`} raw />
      </div>

      {!isAll && funnel && (
        <>
          <div className="sp-kpis sp-kpis--4">
            <Kpi label="Inversión (pauta)" value={money(funnel.entradas.spend)} />
            <Kpi label="Consultas" value={funnel.entradas.consultas} raw />
            <Kpi label="CPR (costo x consulta)" value={money(funnel.entradas.cpr)} />
            <Kpi label="CAC (costo x venta)" value={money(funnel.costos.cac)} />
          </div>
          <div className="sp-kpis sp-kpis--4 sp-kpis--sm">
            <Kpi label="Costo por visita" value={money(funnel.costos.porVisita)} />
            <Kpi label="ROAS económico" value={`${funnel.roas.economico.toFixed(1)}x`} raw />
            <Kpi label="ROAS s/ margen" value={`${funnel.roas.margen.toFixed(1)}x`} raw />
            <Kpi label="Cierre" value={pctf(funnel.tasas.cierre)} raw />
          </div>
          <Card title="Embudo de adquisición">
            <FunnelChart e={funnel.entradas} tasas={funnel.tasas} />
            <div className="sp-funnel2-legend"><span><i style={{ background: '#5bc48a' }} />sano</span><span><i style={{ background: '#e8b93b' }} />a mejorar</span><span><i style={{ background: '#e05656' }} />bajo</span><span className="sp-muted">· solo visitas que ya pasaron</span></div>
          </Card>
        </>
      )}
      {isAll && <div className="sp-muted">Elegí un mes para ver la adquisición (pauta, consultas, embudo).</div>}
    </div>
  );
}

// ── Ventas: cargar venta / cargar pago + listado desplegable ──
function VentasTab({ slug, accessKey, sales, reload, money, vendedores, canales }) {
  const [mode, setMode] = useState(null); // 'venta' | 'pago'
  const [showList, setShowList] = useState(true);
  const totalImporte = (sales || []).reduce((a, s) => a + (Number(s.importe) || 0), 0);
  const totalSaldo = (sales || []).reduce((a, s) => a + (Number(s.saldo) || 0), 0);
  return (
    <div>
      <div className="sp-kpis">
        <Kpi label="Obras cargadas" value={(sales || []).length} raw />
        <Kpi label="Vendido total" value={money(totalImporte)} />
        <Kpi label="Por cobrar" value={money(totalSaldo)} />
      </div>
      <div className="sp-section-head">
        <h2>Ventas</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="sp-btn sp-btn--primary" onClick={() => setMode(mode === 'venta' ? null : 'venta')}>+ Cargar venta</button>
          <button className="sp-btn" onClick={() => setMode(mode === 'pago' ? null : 'pago')}>+ Cargar pago</button>
        </div>
      </div>
      {mode === 'venta' && <SaleForm slug={slug} accessKey={accessKey} vendedores={vendedores} canales={canales} onDone={() => { setMode(null); reload(); }} onCancel={() => setMode(null)} />}
      {mode === 'pago' && <PaymentForm slug={slug} accessKey={accessKey} sales={sales || []} money={money} onDone={() => { setMode(null); reload(); }} onCancel={() => setMode(null)} />}

      <button className="sp-btn" style={{ margin: '4px 0 10px' }} onClick={() => setShowList(!showList)}>{showList ? '▾' : '▸'} Ver ventas ({(sales || []).length})</button>
      {showList && (sales === null ? <div className="sp-muted">Cargando…</div>
        : sales.length === 0 ? <div className="sp-muted">Todavía no cargaste ninguna venta.</div>
          : <div className="sp-list">{sales.map((s) => <SaleCard key={s.id} slug={slug} accessKey={accessKey} sale={s} reload={reload} money={money} />)}</div>)}
    </div>
  );
}

// ── Cargar pago: elegís la venta, ves el saldo avanzar ──
function PaymentForm({ slug, accessKey, sales, money, onDone, onCancel }) {
  const pendientes = sales.filter((s) => s.saldo > 0.5);
  const [saleId, setSaleId] = useState('');
  const [fecha, setFecha] = useState(today());
  const [monto, setMonto] = useState('');
  const sale = sales.find((s) => s.id === saleId);
  const pct = sale && sale.importe ? Math.min(100, ((sale.cobrado + (Number(monto) || 0)) / sale.importe) * 100) : 0;
  const add = () => {
    if (!saleId || !(Number(monto) > 0)) return;
    apiClient.post(`/service/${slug}/sales/${saleId}/payments`, { key: accessKey, fecha, monto }).then(onDone).catch(() => {});
  };
  return (
    <div className="sp-form">
      <div className="sp-form-grid">
        <label>Venta<select value={saleId} onChange={(e) => setSaleId(e.target.value)}><option value="">— Elegí una obra —</option>{pendientes.map((s) => <option key={s.id} value={s.id}>{s.cliente_nombre} · saldo {money(s.saldo)}</option>)}</select></label>
        <label>Fecha del pago<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
        <label>Monto<input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="$" /></label>
      </div>
      {sale && (
        <div style={{ marginTop: 12 }}>
          <div className="sp-rank-top"><span>Cobrado {money(sale.cobrado)} de {money(sale.importe)}</span><strong>Falta {money(Math.max(0, sale.importe - sale.cobrado - (Number(monto) || 0)))}</strong></div>
          <div className="sp-prog"><div className="sp-prog-done" style={{ width: `${(sale.cobrado / sale.importe) * 100}%` }} /><div className="sp-prog-new" style={{ width: `${Math.max(0, pct - (sale.cobrado / sale.importe) * 100)}%` }} /></div>
        </div>
      )}
      <div className="sp-form-actions">
        <button className="sp-btn" onClick={onCancel}>Cancelar</button>
        <button className="sp-btn sp-btn--primary" onClick={add} disabled={!saleId || !(Number(monto) > 0)}>Cargar pago</button>
      </div>
    </div>
  );
}

const curYM = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; };
const pctf = (x) => `${((x || 0) * 100).toFixed(0)}%`;

function Row2({ l, v, hint }) {
  return <div className="sp-rank-top" style={{ padding: '6px 0', borderBottom: '0.5px solid #f0efe9' }}><span>{l}{hint ? <span className="sp-muted" style={{ marginLeft: 6 }}>· {hint}</span> : ''}</span><strong>{v}</strong></div>;
}

// Embudo estándar (forma fija, no proporcional a los números) con semáforo por tasa.
function FunnelChart({ e, tasas }) {
  const light = (r, good, ok) => (r >= good ? '#5bc48a' : r >= ok ? '#e8b93b' : '#e05656');
  const stages = [
    { name: 'Consultas', v: e.consultas, w: 100, color: '#1b1fe8', sub: 'origen' },
    { name: 'Visitas agendadas', v: e.agendadas, w: 78, color: light(tasas.consultaVisitaAgendada, 0.10, 0.05), sub: `${pctf(tasas.consultaVisitaAgendada)} de consultas` },
    { name: 'Visitas efectivas', v: e.efectivas, w: 56, color: light(tasas.consultaVisitaEfectiva, 0.10, 0.05), sub: `${pctf(tasas.consultaVisitaEfectiva)} de consultas` },
    { name: 'Ventas', v: e.ventas, w: 36, color: light(tasas.cierre, 0.15, 0.10), sub: `cierre ${pctf(tasas.cierre)}` },
  ];
  return (
    <div className="sp-funnel2">
      {stages.map((s) => (
        <div className="sp-funnel2-row" key={s.name}>
          <div className="sp-funnel2-seg" style={{ width: `${s.w}%`, background: s.color }}>
            <span className="sp-funnel2-n">{s.v}</span>
            <span className="sp-funnel2-name">{s.name}</span>
          </div>
          <div className="sp-funnel2-sub">{s.sub}</div>
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

function AnaliticaTab({ a, money }) {
  if (!a) return <div className="sp-muted">Cargando…</div>;
  const r = a.resumen;
  const ins = a.insights || {};
  return (
    <div>
      <div className="sp-kpis sp-kpis--4 sp-kpis--sm">
        <Kpi label="Ticket promedio" value={money(r.ticketProm)} />
        <Kpi label="Ticket mediano" value={money(r.ticketMediano)} />
        <Kpi label="Ticket mínimo" value={money(r.ticketMin)} />
        <Kpi label="Ticket máximo" value={money(r.ticketMax)} />
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
        <Ranking items={(a.tickets || []).map((t) => ({ nombre: t.label, n: t.n, monto: t.monto, pct: t.pct }))} money={money} />
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
        <Kpi label="Total facturado (cobrado)" value={money(a.totales.cobrado)} />
        <Kpi label="Ganancia neta (total)" value={money(a.totales.resultadoNeto)} />
        <Kpi label="Facturación de equilibrio (mensual)" value={money(a.equilibrio.facturacion)} />
        <Kpi label="Obras para cubrir fijos" value={a.equilibrio.obras.toFixed(1)} raw />
      </div>
      <p className="sp-muted" style={{ margin: '2px 0 12px' }}>Total facturado = todo lo cobrado. Ganancia neta = suma de resultados de cada mes. Facturación de equilibrio = cuánto facturar por mes para cubrir los costos fijos con el margen de la marca.</p>

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
  const [f, setF] = useState(initial ? { ...base, ...initial, ...(initial.extra || {}) } : base);
  const [step, setStep] = useState(1);       // 1 = venta, 2 = datos del cliente (solo alta)
  const [saleId, setSaleId] = useState(initial?.id || null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const baseFields = () => ({ fecha_venta: f.fecha_venta, cliente_nombre: f.cliente_nombre, importe: f.importe, vendedor: f.vendedor, canal: f.canal, m2: f.m2, fecha_visita: f.fecha_visita, fecha_colocacion: f.fecha_colocacion });
  const extraOf = () => { const e = {}; for (const k of ['genero', 'barrio', 'edad', 'tipo', 'color']) if (f[k] !== '' && f[k] != null) e[k] = f[k]; return e; };

  const step1Ok = f.cliente_nombre.trim() && Number(f.importe) > 0;
  const goStep2 = () => { // alta: crea la venta y pasa a datos del cliente
    if (!step1Ok) return; setSaving(true);
    apiClient.post(`/service/${slug}/sales`, { key: accessKey, ...baseFields(), extra: {} })
      .then((r) => { setSaleId(r.data.sale.id); setStep(2); setSaving(false); }).catch(() => setSaving(false));
  };
  const saveDatos = () => apiClient.patch(`/service/${slug}/sales/${saleId}`, { key: accessKey, ...baseFields(), extra: extraOf() }).then(onDone).catch(onDone);
  const saveEdit = () => { if (!step1Ok) return; setSaving(true); apiClient.patch(`/service/${slug}/sales/${initial.id}`, { key: accessKey, ...baseFields(), extra: extraOf() }).then(onDone).catch(() => setSaving(false)); };

  const ventaFields = (
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
  );
  const datosFields = (
    <div className="sp-form-grid">
      <label>Género<select value={f.genero} onChange={(e) => set('genero', e.target.value)}><option value="">—</option><option>Mujer</option><option>Hombre</option><option>Otro/NS</option></select></label>
      <label>Edad<input inputMode="decimal" value={f.edad} onChange={(e) => set('edad', e.target.value)} /></label>
      <label>Barrio<input value={f.barrio} onChange={(e) => set('barrio', e.target.value)} /></label>
      <label>Tipo de propiedad<select value={f.tipo} onChange={(e) => set('tipo', e.target.value)}><option value="">—</option><option>Casa</option><option>Departamento</option><option>PH</option><option>Local/Comercial</option></select></label>
      <label>Color elegido<input value={f.color} onChange={(e) => set('color', e.target.value)} /></label>
    </div>
  );

  // Editar: todo en una pantalla.
  if (initial?.id) {
    return (
      <div className="sp-form">
        {ventaFields}
        <div className="sp-block-title" style={{ margin: '14px 0 6px' }}>Datos del cliente</div>
        {datosFields}
        <div className="sp-form-actions">
          <button className="sp-btn" onClick={onCancel}>Cancelar</button>
          <button className="sp-btn sp-btn--primary" onClick={saveEdit} disabled={saving || !step1Ok}>Guardar</button>
        </div>
      </div>
    );
  }
  // Alta: 2 pasos.
  return (
    <div className="sp-form">
      <div className="sp-step-badge">Paso {step} de 2 · {step === 1 ? 'Datos de la venta' : 'Datos del cliente (opcional)'}</div>
      {step === 1 ? ventaFields : datosFields}
      <div className="sp-form-actions">
        {step === 1 ? (
          <>
            <button className="sp-btn" onClick={onCancel}>Cancelar</button>
            <button className="sp-btn sp-btn--primary" onClick={goStep2} disabled={saving || !step1Ok}>Siguiente →</button>
          </>
        ) : (
          <>
            <button className="sp-btn" onClick={onDone}>Omitir</button>
            <button className="sp-btn sp-btn--primary" onClick={saveDatos}>Guardar datos</button>
          </>
        )}
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
