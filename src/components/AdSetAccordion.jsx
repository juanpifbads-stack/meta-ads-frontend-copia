import React, { useState } from 'react';
import apiClient from '../api/client.js';

const formatCurrency = (value) => {
  if (value == null || isNaN(value)) return '—';
  return `$${new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}`;
};

const WINDOWS = ['7d', '14d', '30d'];

function AdSetRow({ adset, onPause, window, sales }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paused, setPaused] = useState(false);

  const metricsKey = `metrics_${window}`;
  const m = adset[metricsKey] || adset.metrics_30d || adset.metrics?.['30d'] || {};

  const handlePauseConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onPause(adset.id);
      setPaused(true);
      setConfirming(false);
    } catch (err) {
      setError(err.message || 'Error al pausar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        borderBottom: '0.5px solid var(--color-gray-light)',
        paddingBottom: '10px',
        marginBottom: '10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        {/* Name */}
        <div style={{ flex: 1, minWidth: '120px' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: '700',
              fontSize: '12px',
              color: paused ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
              textDecoration: paused ? 'line-through' : 'none',
            }}
          >
            {adset.name}
          </div>
        </div>

        {/* Metrics */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
          }}
        >
          <div>
            <div className="metric-label" style={{ fontSize: '9px' }}>Gasto {window.toUpperCase()}</div>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: '700' }}>
              {formatCurrency(m.spend)}
            </div>
          </div>
          <div>
            <div className="metric-label" style={{ fontSize: '9px' }}>{sales ? 'Convs' : 'Result.'} {window.toUpperCase()}</div>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: '700' }}>
              {m.conversions != null ? m.conversions : '—'}
            </div>
          </div>
          <div>
            <div className="metric-label" style={{ fontSize: '9px' }}>{sales ? 'ROAS' : 'CPR'} {window.toUpperCase()}</div>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: '700' }}>
              {sales
                ? (m.roas != null ? `${Number(m.roas).toFixed(2)}x` : '—')
                : (m.cost_per_conversion ? formatCurrency(m.cost_per_conversion) : '—')}
            </div>
          </div>
        </div>

        {/* Pause button */}
        {!paused && (
          <button
            className="btn-pause"
            style={{ fontSize: '10px', padding: '4px 10px' }}
            onClick={() => setConfirming(true)}
          >
            ⏹ pausar
          </button>
        )}
        {paused && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--color-text-muted)',
              padding: '4px 10px',
            }}
          >
            Pausado
          </span>
        )}
      </div>

      {/* Confirmation */}
      {confirming && !paused && (
        <div
          style={{
            marginTop: '8px',
            backgroundColor: 'rgba(239,68,68,0.05)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--color-text-secondary)',
              marginBottom: '8px',
            }}
          >
            ¿Pausar "{adset.name}"?
          </p>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '8px', fontSize: '11px' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-danger"
              onClick={handlePauseConfirm}
              disabled={loading}
              style={{ fontSize: '10px', padding: '4px 10px' }}
            >
              {loading ? 'Pausando...' : 'Confirmar'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              disabled={loading}
              style={{ fontSize: '10px', padding: '4px 10px' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const SORTS = [
  { key: 'spend', label: 'Gasto' },
  { key: 'conversions', label: 'Convs' },
  { key: 'roas', label: 'ROAS' },
];

export default function AdSetAccordion({ adsets, onPause, objective }) {
  const sales = !objective || ['OUTCOME_SALES', 'CONVERSIONS', 'CATALOG_SALES'].includes(objective);
  const [open, setOpen] = useState(false);
  const [activeWindow, setActiveWindow] = useState('30d');
  const [sortBy, setSortBy] = useState(null); // 'spend' | 'conversions' | 'roas' | null
  const [sortDir, setSortDir] = useState('desc');

  if (!adsets || adsets.length === 0) return null;

  // Click en un criterio: si ya está activo, alterna asc/desc; si no, lo activa en desc.
  const toggleSort = (key) => {
    if (sortBy === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortBy(key); setSortDir('desc'); }
  };

  // Orden según la ventana activa. Los que no tienen dato van al fondo.
  const sortedAdsets = [...adsets];
  if (sortBy) {
    const mk = `metrics_${activeWindow}`;
    sortedAdsets.sort((a, b) => {
      const va = a[mk]?.[sortBy]; const vb = b[mk]?.[sortBy];
      const na = va == null || isNaN(Number(va)) ? -Infinity : Number(va);
      const nb = vb == null || isNaN(Number(vb)) ? -Infinity : Number(vb);
      return sortDir === 'asc' ? na - nb : nb - na;
    });
  }

  return (
    <div style={{ marginTop: '12px', borderTop: '0.5px solid var(--color-gray-light)' }}>
      <button
        className="collapsible-toggle"
        onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', justifyContent: 'space-between', marginTop: '12px' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{open ? '▾' : '▸'}</span>
          <span>
            conjuntos de anuncios ({adsets.length})
          </span>
        </span>
      </button>

      {open && (
        <div style={{ marginTop: '12px' }}>
          {/* Window selector tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setActiveWindow(w)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  padding: '2px 8px',
                  border: '0.5px solid var(--color-gray-mid)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  backgroundColor: activeWindow === w ? 'var(--color-brand-blue)' : 'transparent',
                  color: activeWindow === w ? '#fff' : 'var(--color-text-muted)',
                  fontWeight: activeWindow === w ? '700' : '400',
                }}
              >
                {w.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Ordenar por */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '2px' }}>Ordenar</span>
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => toggleSort(s.key)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  padding: '2px 8px',
                  border: '0.5px solid var(--color-gray-mid)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  backgroundColor: sortBy === s.key ? 'var(--color-brand-blue)' : 'transparent',
                  color: sortBy === s.key ? '#fff' : 'var(--color-text-muted)',
                  fontWeight: sortBy === s.key ? '700' : '400',
                }}
              >
                {s.label}{sortBy === s.key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
              </button>
            ))}
            {sortBy && (
              <button
                onClick={() => setSortBy(null)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '2px 8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', textDecoration: 'underline' }}
              >
                limpiar
              </button>
            )}
          </div>

          {sortedAdsets.map((adset) => (
            <AdSetRow key={adset.id} adset={adset} onPause={onPause} window={activeWindow} sales={sales} />
          ))}
        </div>
      )}
    </div>
  );
}
