import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import apiClient from '../api/client.js';
import './AnalyticsPanel.css';

const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const label = (ym) => { const [y, m] = ym.split('-'); return `${MES[+m - 1]} ${y.slice(2)}`; };
const ratio = (a, b) => (a != null && b ? a / b : null);
const fmtMoney = (n) => `$ ${Math.round(n).toLocaleString('es-AR')}`;
const fmtInt = (n) => Math.round(n).toLocaleString('es-AR');
const fmtX = (n) => `${n.toFixed(2)}×`;
const short = (n) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n * 100) / 100));

// total: cómo se resume la ventana (las tasas se recalculan; nunca se promedian promedios).
const METRICAS = [
  { k: 'facturacion', l: 'Facturación', fmt: fmtMoney, hint: 'Tienda Nube', total: (s) => s.facturacion },
  { k: 'pedidos', l: 'Pedidos', fmt: fmtInt, hint: 'Tienda Nube', total: (s) => s.pedidos },
  { k: 'ticket', l: 'Ticket promedio', fmt: fmtMoney, hint: 'Tienda Nube', total: (s) => ratio(s.facturacion, s.pedidos) },
  { k: 'gasto', l: 'Inversión', fmt: fmtMoney, hint: 'Meta', total: (s) => s.gasto },
  { k: 'mer', l: 'ROAS real', fmt: fmtX, hint: 'Facturación / inversión', total: (s) => ratio(s.facturacion, s.gasto) },
  { k: 'valorMeta', l: 'Valor de compras', fmt: fmtMoney, hint: 'Atribuido por Meta', total: (s) => s.valorMeta },
  { k: 'roas', l: 'ROAS Meta', fmt: fmtX, hint: 'Atribuido por Meta', total: (s) => ratio(s.valorMeta, s.gasto) },
  { k: 'cpa', l: 'Costo por compra', fmt: fmtMoney, hint: 'Atribuido por Meta', total: (s) => ratio(s.gasto, s.comprasMeta) },
];
const COLORS = ['#1b1fe8', '#0f766e'];
const VENTANAS = [3, 6, 12, 24];

export default function AnalyticsPanel({ slug, name, onBack }) {
  const [months, setMonths] = useState(12);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(['facturacion']);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr('');
    // Tienda Nube se trae por tandas: repetimos solo mientras falten meses y haya avances.
    (async () => {
      let prev = -1;
      for (let i = 0; i < 20; i += 1) {
        const r = await apiClient.get(`/admin/${slug}/analytics`, { params: { months }, timeout: 90000 });
        if (cancelled) return;
        setData(r.data);
        const loaded = (r.data.months || []).filter((m) => m.facturacion != null).length;
        if (r.data.complete || loaded === prev) break;
        prev = loaded;
      }
      setLoading(false);
    })().catch((e) => { if (!cancelled) { setErr(e?.response?.data?.message || 'No se pudo cargar la analítica.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [slug, months]);

  const rows = useMemo(() => (data?.months || []).map((m) => ({
    ...m,
    name: label(m.ym) + (m.partial ? '*' : ''),
    ticket: ratio(m.facturacion, m.pedidos),
    mer: ratio(m.facturacion, m.gasto),
    roas: ratio(m.valorMeta, m.gasto),
    cpa: ratio(m.gasto, m.comprasMeta),
  })), [data]);

  // Los totales usan solo meses cerrados: el mes en curso está incompleto.
  const sum = useMemo(() => {
    const out = {};
    for (const k of ['facturacion', 'pedidos', 'gasto', 'valorMeta', 'comprasMeta']) {
      const vals = rows.filter((r) => !r.partial && r[k] != null).map((r) => r[k]);
      out[k] = vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    }
    return out;
  }, [rows]);

  const available = METRICAS.filter((m) => rows.some((r) => r[m.k] != null));
  const toggle = (k) => setSel((s) => {
    if (s.includes(k)) return s.length > 1 ? s.filter((x) => x !== k) : s;
    return s.length < 2 ? [...s, k] : [s[1], k]; // máximo 2: reemplaza la más vieja
  });
  const shown = sel.map((k) => METRICAS.find((m) => m.k === k));

  return (
    <div className="ctrl-page">
      <div className="hub-head">
        <div className="hub-cross"><span className="hub-cross-client">Analítica · {name}</span></div>
        <button className="ctrl-btn ctrl-btn--ghost" onClick={onBack}>← Volver</button>
      </div>

      <div className="an-toolbar">
        <span className="an-muted">{loading ? 'Trayendo meses… la primera vez puede tardar; después queda guardado.' : `Totales de los últimos ${months} meses cerrados`}</span>
        <label className="an-window">Ventana
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {VENTANAS.map((v) => <option key={v} value={v}>Últimos {v} meses</option>)}
          </select>
        </label>
      </div>

      {err && <div className="ctrl-error">⚠ {err}</div>}
      {data?.setupNeeded && <div className="ctrl-error">⚠ Falta crear la tabla de analítica: hay que correr <code>sql/client_month_stats.sql</code> en Supabase.</div>}
      {data && !data.setupNeeded && data.tnConnected === false && <div className="an-note">Este cliente no tiene Tienda Nube conectada: no hay facturación real para mostrar.</div>}
      {data?.tnError && <div className="ctrl-error">⚠ {data.tnError}</div>}
      {data?.metaError && <div className="ctrl-error">⚠ Meta: {data.metaError}</div>}

      <div className="an-cards">
        {available.map((m) => {
          const i = sel.indexOf(m.k);
          const t = m.total(sum);
          return (
            <button key={m.k} className={`an-card ${i >= 0 ? 'an-card--on' : ''}`} style={i >= 0 ? { borderColor: COLORS[i] } : undefined} onClick={() => toggle(m.k)} aria-pressed={i >= 0}>
              <span className="an-card-l">{m.l}</span>
              <span className="an-card-v">{t != null ? m.fmt(t) : '—'}</span>
              <span className="an-card-h">{m.hint}</span>
            </button>
          );
        })}
      </div>

      {rows.length > 0 && !data?.setupNeeded && (
        <div className="an-chart">
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={rows} margin={{ top: 10, right: 12, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ec" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              {shown.map((m, i) => <YAxis key={m.k} yAxisId={i} orientation={i ? 'right' : 'left'} tickFormatter={short} tick={{ fontSize: 12 }} width={56} />)}
              <Tooltip formatter={(v, n) => { const m = METRICAS.find((x) => x.l === n); return [v == null ? '—' : m.fmt(v), n]; }} />
              <Legend />
              {shown.map((m, i) => <Line key={m.k} yAxisId={i} type="monotone" dataKey={m.k} name={m.l} stroke={COLORS[i]} strokeWidth={2.5} dot={{ r: 3 }} />)}
            </LineChart>
          </ResponsiveContainer>
          <div className="an-muted">* Mes en curso, todavía incompleto. {data?.salesOnly ? 'Los datos de Meta incluyen solo campañas de ventas. ' : ''}Los montos de cuentas de Meta en USD se pasan a ARS con el TC de cada mes.</div>
        </div>
      )}

      {rows.length > 0 && !data?.setupNeeded && (
        <div className="an-table-wrap">
          <table className="an-table">
            <thead><tr><th>Mes</th>{available.map((m) => <th key={m.k}>{m.l}</th>)}</tr></thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.ym}><td>{r.name}</td>{available.map((m) => <td key={m.k}>{r[m.k] != null ? m.fmt(r[m.k]) : '—'}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
