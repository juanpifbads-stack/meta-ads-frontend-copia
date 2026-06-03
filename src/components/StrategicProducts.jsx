import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../api/client.js';
import './StrategicProducts.css';

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

const WINDOWS = [
  { key: '7', label: '7 días' },
  { key: '14', label: '14 días' },
  { key: '30', label: '30 días' },
];

function stockoutCell(p) {
  if (p.stock == null) return <span className="sp-muted">sin seguimiento</span>;
  if (p.daysToStockout == null) {
    return <span className="sp-muted">{p.stock} u · sin ventas (21d)</span>;
  }
  const d = p.daysToStockout;
  const cls = d <= 14 ? 'sp-bad' : d <= 30 ? 'sp-warn' : 'sp-good';
  return <span className={cls}>≈ {d} días <span className="sp-stocknum">({p.stock} u)</span></span>;
}

export default function StrategicProducts({ slug, accessKey, products }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [win, setWin] = useState('30');

  const nameBySku = useMemo(() => {
    const m = {};
    for (const p of products) m[p.sku] = p.name;
    return m;
  }, [products]);

  useEffect(() => {
    let alive = true;
    const skus = products.map((p) => p.sku).join(',');
    apiClient
      .get(`/public/${slug}/products`, { params: { key: accessKey, skus }, timeout: 120000 })
      .then((res) => {
        if (!alive) return;
        if (res.data?.tnError || !res.data?.products) setError(true);
        else setData(res.data.products);
      })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug, accessKey, products]);

  // Ordenar por unidades vendidas en la ventana elegida (mayor a menor)
  const rows = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => (b.windows[win]?.units || 0) - (a.windows[win]?.units || 0));
  }, [data, win]);

  return (
    <div className="cp-card">
      <div className="sp-head">
        <span className="sp-head-lbl">Ventana de tiempo</span>
        <div className="sp-pills">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              className={`sp-pill ${win === w.key ? 'sp-pill--active' : ''}`}
              onClick={() => setWin(w.key)}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="cp-placeholder">Cargando productos de Tienda Nube… (puede tardar unos segundos)</p>}
      {!loading && error && <p className="cp-placeholder">No se pudieron cargar los productos de Tienda Nube.</p>}

      {!loading && !error && data && (
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>SKU</th>
                <th className="sp-r">Stock</th>
                <th className="sp-r">Ventas ({win}d)</th>
                <th className="sp-r">Facturación ({win}d)</th>
                <th className="sp-r">Quiebre de stock</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.sku}>
                  <td>{nameBySku[p.sku] || p.sku}</td>
                  <td className="sp-mono">{p.sku}</td>
                  <td className="sp-r">{p.stock == null ? '—' : `${p.stock} u`}</td>
                  <td className="sp-r"><strong>{p.windows[win]?.units || 0}</strong> u</td>
                  <td className="sp-r">{fmtMoney(p.windows[win]?.revenue || 0)}</td>
                  <td className="sp-r">{stockoutCell(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="sp-foot">La predicción de quiebre se calcula con el ritmo de ventas de los últimos 21 días.</p>
        </div>
      )}
    </div>
  );
}
