import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../api/client.js';
import './ServicePortal.css';

const fmt = (n) => (n == null || isNaN(n)) ? '—' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const fmtDate = (iso) => { if (!iso) return '—'; try { return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }); } catch { return iso; } };
const today = () => new Date().toISOString().slice(0, 10);

// Portal de clientes de servicios (D'Floor). El cliente carga sus obras y cobros.
export default function ServicePortal({ client }) {
  const { slug, accessKey, name } = client;
  const [sales, setSales] = useState(null);
  const [config, setConfig] = useState({ vendedores: [], canales: [] });
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    apiClient.get(`/service/${slug}/sales`, { params: { key: accessKey } }).then((r) => setSales(r.data.sales || [])).catch(() => setSales([]));
  }, [slug, accessKey]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiClient.get(`/service/${slug}/config`, { params: { key: accessKey } }).then((r) => setConfig(r.data.config || {})).catch(() => {});
  }, [slug, accessKey]);

  // Sugerencias de vendedor/canal: config + los que ya aparecen en obras cargadas.
  const vendedores = useMemo(() => uniq([...(config.vendedores || []), ...((sales || []).map((s) => s.vendedor))]), [config, sales]);
  const canales = useMemo(() => uniq([...(config.canales || []), ...((sales || []).map((s) => s.canal))]), [config, sales]);

  const totalImporte = (sales || []).reduce((a, s) => a + (Number(s.importe) || 0), 0);
  const totalSaldo = (sales || []).reduce((a, s) => a + (Number(s.saldo) || 0), 0);

  return (
    <div className="sp-page">
      <div className="sp-head">
        <span className="sp-brand">alquimia.</span>
        <span className="sp-brand-x">×</span>
        <span className="sp-client">{name}</span>
      </div>

      <div className="sp-kpis">
        <Kpi label="Obras cargadas" value={(sales || []).length} raw />
        <Kpi label="Vendido total" value={fmt(totalImporte)} />
        <Kpi label="Por cobrar" value={fmt(totalSaldo)} />
      </div>

      <div className="sp-section-head">
        <h2>Obras</h2>
        {!adding && <button className="sp-btn sp-btn--primary" onClick={() => setAdding(true)}>+ Cargar obra</button>}
      </div>

      {adding && <SaleForm slug={slug} accessKey={accessKey} vendedores={vendedores} canales={canales}
        onDone={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />}

      {sales === null ? <div className="sp-muted">Cargando…</div>
        : sales.length === 0 ? <div className="sp-muted">Todavía no cargaste ninguna obra. Tocá “+ Cargar obra”.</div>
          : <div className="sp-list">{sales.map((s) => <SaleCard key={s.id} slug={slug} accessKey={accessKey} sale={s} reload={load} />)}</div>}
    </div>
  );
}

function uniq(arr) { return [...new Set(arr.filter((x) => x && String(x).trim()))]; }

function Kpi({ label, value, raw }) {
  return <div className="sp-kpi"><div className="sp-kpi-label">{label}</div><div className="sp-kpi-value">{raw ? value : value}</div></div>;
}

function SaleForm({ slug, accessKey, vendedores, canales, onDone, onCancel, initial }) {
  const [f, setF] = useState(initial || { fecha_venta: today(), cliente_nombre: '', importe: '', vendedor: '', canal: '', fecha_visita: '', fecha_colocacion: '', m2: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const save = () => {
    if (!f.cliente_nombre.trim() || !(Number(f.importe) > 0)) return;
    setSaving(true);
    const req = initial?.id
      ? apiClient.patch(`/service/${slug}/sales/${initial.id}`, { key: accessKey, ...f })
      : apiClient.post(`/service/${slug}/sales`, { key: accessKey, ...f });
    req.then(onDone).catch(() => setSaving(false));
  };
  return (
    <div className="sp-form">
      <div className="sp-form-grid">
        <label>Fecha de venta<input type="date" value={f.fecha_venta || ''} onChange={(e) => set('fecha_venta', e.target.value)} /></label>
        <label>Cliente<input value={f.cliente_nombre} onChange={(e) => set('cliente_nombre', e.target.value)} placeholder="Nombre" /></label>
        <label>Importe<input inputMode="decimal" value={f.importe} onChange={(e) => set('importe', e.target.value)} placeholder="$" /></label>
        <label>Vendedor<input list="sp-vendedores" value={f.vendedor} onChange={(e) => set('vendedor', e.target.value)} /><datalist id="sp-vendedores">{vendedores.map((v) => <option key={v} value={v} />)}</datalist></label>
        <label>Canal / anuncio<input list="sp-canales" value={f.canal} onChange={(e) => set('canal', e.target.value)} /><datalist id="sp-canales">{canales.map((v) => <option key={v} value={v} />)}</datalist></label>
        <label>m² (opcional)<input inputMode="decimal" value={f.m2} onChange={(e) => set('m2', e.target.value)} /></label>
        <label>Fecha de visita<input type="date" value={f.fecha_visita || ''} onChange={(e) => set('fecha_visita', e.target.value)} /></label>
        <label>Fecha de colocación<input type="date" value={f.fecha_colocacion || ''} onChange={(e) => set('fecha_colocacion', e.target.value)} /></label>
      </div>
      <div className="sp-form-actions">
        <button className="sp-btn" onClick={onCancel}>Cancelar</button>
        <button className="sp-btn sp-btn--primary" onClick={save} disabled={saving}>{initial?.id ? 'Guardar' : 'Cargar obra'}</button>
      </div>
    </div>
  );
}

function SaleCard({ slug, accessKey, sale, reload }) {
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
          <div className="sp-card-imp">{fmt(sale.importe)}</div>
          <div className={`sp-chip ${pagado ? 'sp-chip--ok' : 'sp-chip--pend'}`}>{pagado ? 'Cobrado' : `Saldo ${fmt(sale.saldo)}`}</div>
        </div>
      </div>
      {open && (
        <div className="sp-card-body">
          <div className="sp-pays-title">Cobros</div>
          {(sale.payments || []).length === 0 ? <div className="sp-muted">Sin cobros cargados.</div>
            : sale.payments.map((p) => (
              <div className="sp-pay-row" key={p.id}><span>{fmtDate(p.fecha)}</span><strong>{fmt(p.monto)}</strong><span className="sp-x" onClick={() => delPay(p.id)}>×</span></div>
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
