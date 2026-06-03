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
  const [sortKey, setSortKey] = useState('units');
  const [sortDir, setSortDir] = useState('desc');
  const [expanded, setExpanded] = useState({});

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

  const sortVal = (p, key) => {
    switch (key) {
      case 'name': return (nameBySku[p.sku] || p.sku).toLowerCase();
      case 'sku': return p.sku.toLowerCase();
      case 'stock': return p.stock == null ? -1 : p.stock;
      case 'units': return p.windows[win]?.units || 0;
      case 'revenue': return p.windows[win]?.revenue || 0;
      case 'stockout': return p.daysToStockout == null ? Infinity : p.daysToStockout;
      default: return 0;
    }
  };

  const rows = useMemo(() => {
    if (!data) return [];
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const va = sortVal(a, sortKey);
      const vb = sortVal(b, sortKey);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [data, win, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'name' || key === 'sku' ? 'asc' : 'desc'); }
  };
  const arrow = (key) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

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

      {loading && <p className="cp-placeholder"><span className="dots">Cargando productos de Tienda Nube</span> (puede tardar unos segundos)</p>}
      {!loading && error && <p className="cp-placeholder">No se pudieron cargar los productos de Tienda Nube.</p>}

      {!loading && !error && data && (
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th className="sp-th" onClick={() => toggleSort('name')}>Producto{arrow('name')}</th>
                <th className="sp-th" onClick={() => toggleSort('sku')}>SKU{arrow('sku')}</th>
                <th className="sp-th sp-r" onClick={() => toggleSort('stock')}>Stock{arrow('stock')}</th>
                <th className="sp-th sp-r" onClick={() => toggleSort('units')}>Ventas ({win}d){arrow('units')}</th>
                <th className="sp-th sp-r" onClick={() => toggleSort('revenue')}>Facturación ({win}d){arrow('revenue')}</th>
                <th className="sp-th sp-r" onClick={() => toggleSort('stockout')}>Quiebre de stock{arrow('stockout')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const isOpen = !!expanded[p.sku];
                const vs = p.variants || [];
                return (
                  <React.Fragment key={p.sku}>
                    <tr className="sp-prow" onClick={() => setExpanded((e) => ({ ...e, [p.sku]: !e[p.sku] }))}>
                      <td>
                        {vs.length > 0 && <span className="sp-caret">{isOpen ? '▾' : '▸'}</span>}
                        {nameBySku[p.sku] || p.sku}
                      </td>
                      <td className="sp-mono">{p.sku}</td>
                      <td className="sp-r">{p.stock == null ? '—' : `${p.stock} u`}</td>
                      <td className="sp-r"><strong>{p.windows[win]?.units || 0}</strong> u</td>
                      <td className="sp-r">{fmtMoney(p.windows[win]?.revenue || 0)}</td>
                      <td className="sp-r">{stockoutCell(p)}</td>
                    </tr>
                    {isOpen && vs.map((v, i) => (
                      <tr key={p.sku + '-' + i} className="sp-vrow">
                        <td className="sp-vlabel">↳ {v.label}</td>
                        <td></td>
                        <td className="sp-r">{v.stock == null ? '—' : `${v.stock} u`}</td>
                        <td className="sp-r">{v.windows[win]?.units || 0} u</td>
                        <td className="sp-r">{fmtMoney(v.windows[win]?.revenue || 0)}</td>
                        <td className="sp-r">{stockoutCell(v)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          <p className="sp-foot">Tocá un producto para ver sus variantes. El quiebre a nivel producto es el de la <strong>variante más urgente</strong>; se calcula con el ritmo de ventas de los últimos 21 días.</p>
        </div>
      )}
    </div>
  );
}
