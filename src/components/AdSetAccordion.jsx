import React, { useState } from 'react';
import apiClient from '../api/client.js';

const formatCurrency = (value) => {
  if (value == null || isNaN(value)) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
};

function AdSetRow({ adset, onPause }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paused, setPaused] = useState(false);

  const m30 = adset.metrics_30d || adset.metrics?.['30d'] || {};

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
            <div className="metric-label" style={{ fontSize: '9px' }}>Gasto 30D</div>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: '700' }}>
              {formatCurrency(m30.spend)}
            </div>
          </div>
          <div>
            <div className="metric-label" style={{ fontSize: '9px' }}>Convs 30D</div>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: '700' }}>
              {m30.conversions != null ? m30.conversions : '—'}
            </div>
          </div>
          <div>
            <div className="metric-label" style={{ fontSize: '9px' }}>ROAS 30D</div>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: '700' }}>
              {m30.roas != null ? `${Number(m30.roas).toFixed(2)}x` : '—'}
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

export default function AdSetAccordion({ adsets, onPause }) {
  const [open, setOpen] = useState(false);

  if (!adsets || adsets.length === 0) return null;

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
          {adsets.map((adset) => (
            <AdSetRow key={adset.id} adset={adset} onPause={onPause} />
          ))}
        </div>
      )}
    </div>
  );
}
