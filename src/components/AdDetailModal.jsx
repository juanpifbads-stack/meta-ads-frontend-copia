import React, { useState, useEffect } from 'react';
import apiClient from '../api/client.js';

const formatCurrency = (value) => {
  if (value == null || isNaN(value)) return '—';
  return `$${new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}`;
};

function MetricCell({ label, value, color }) {
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '14px', color: color || 'var(--color-text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

const SALES_OBJECTIVES = ['OUTCOME_SALES', 'CONVERSIONS', 'CATALOG_SALES'];
function AdMetricWindows({ metrics_7d, metrics_14d, metrics_30d, objective }) {
  const sales = !objective || SALES_OBJECTIVES.includes(objective);
  const windows = [
    { label: '7D', m: metrics_7d },
    { label: '14D', m: metrics_14d },
    { label: '30D', m: metrics_30d },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '8px' }}>
      {windows.map(({ label, m }) => (
        <div
          key={label}
          style={{
            backgroundColor: 'var(--color-gray-light)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 10px',
          }}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            {label}
          </div>
          <MetricCell label="Gasto"      value={m?.spend != null ? formatCurrency(m.spend) : '—'} />
          <MetricCell label={sales ? 'Convs.' : 'Resultados'} value={m?.conversions != null ? m.conversions : '—'} />
          <MetricCell label={sales ? 'Costo/Conv' : 'CPR'} value={m?.cost_per_conversion != null ? formatCurrency(m.cost_per_conversion) : '—'} color="var(--color-brand-blue)" />
          {sales && <MetricCell label="ROAS" value={m?.roas != null ? `${Number(m.roas).toFixed(2)}x` : '—'} />}
        </div>
      ))}
    </div>
  );
}

function AdPreview({ ad, onExpand }) {
  if (ad.video_url) {
    return (
      <video
        src={ad.video_url}
        poster={ad.thumbnail_url || undefined}
        controls
        style={{
          width: '64px',
          height: '64px',
          objectFit: 'cover',
          borderRadius: '6px',
          border: '0.5px solid var(--color-gray-mid)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      />
    );
  }
  if (ad.thumbnail_url) {
    return (
      <img
        src={ad.thumbnail_url}
        alt=""
        style={{
          width: '64px',
          height: '64px',
          objectFit: 'cover',
          borderRadius: '6px',
          border: '0.5px solid var(--color-gray-mid)',
          cursor: 'zoom-in',
          flexShrink: 0,
          display: 'block',
        }}
        onClick={() => onExpand(ad.thumbnail_url)}
      />
    );
  }
  return (
    <div
      style={{
        width: '64px',
        height: '64px',
        borderRadius: '6px',
        backgroundColor: 'var(--color-gray-light)',
        border: '0.5px solid var(--color-gray-mid)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        color: 'var(--color-text-muted)',
        flexShrink: 0,
      }}
    >
      ◻
    </div>
  );
}

export default function AdDetailModal({ adsetId, adsetName, accountId, campaignObjective, onClose }) {
  const [adsData, setAdsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pausingId, setPausingId] = useState(null);
  const [pausedIds, setPausedIds] = useState(new Set());
  const [pauseErrors, setPauseErrors] = useState({});
  const [lightboxUrl, setLightboxUrl] = useState(null);

  useEffect(() => {
    const fetchAds = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = campaignObjective ? { objective: campaignObjective } : {};
        const response = await apiClient.get(`/accounts/${accountId}/adsets/${adsetId}/ads`, { params });
        setAdsData(response.data);
      } catch (err) {
        setError(err.message || 'Error al cargar los anuncios.');
      } finally {
        setLoading(false);
      }
    };
    fetchAds();
  }, [adsetId, accountId]);

  const handleOverlayClick = (e) => {
    if (lightboxUrl) { setLightboxUrl(null); return; }
    if (e.target === e.currentTarget) onClose();
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (lightboxUrl) setLightboxUrl(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, lightboxUrl]);

  const handlePauseAd = async (ad) => {
    setPausingId(ad.id);
    setPauseErrors((prev) => ({ ...prev, [ad.id]: null }));
    try {
      await apiClient.post('/actions/pause', {
        entityId: ad.id,
        entityType: 'ad',
        entityName: ad.name,
        adAccountId: accountId,
      });
      setPausedIds((prev) => new Set([...prev, ad.id]));
    } catch (err) {
      setPauseErrors((prev) => ({ ...prev, [ad.id]: err.response?.data?.message || err.message || 'Error al pausar.' }));
    } finally {
      setPausingId(null);
    }
  };

  const ads = Array.isArray(adsData) ? adsData : [];

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      {/* Image lightbox */}
      {lightboxUrl && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            backgroundColor: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', cursor: 'zoom-out',
          }}
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt=""
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: '8px', objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{adsetName}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Anuncios activos — comparativa 7D / 14D / 30D
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="loading-center" style={{ padding: '40px 0' }}>
              <span className="spinner" />
              <span>Cargando anuncios...</span>
            </div>
          )}

          {error && !loading && (
            <div className="alert alert-error">{error}</div>
          )}

          {!loading && !error && ads.length === 0 && (
            <div className="empty-state">
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏹</div>
              <p>No hay anuncios activos en este conjunto.</p>
            </div>
          )}

          {!loading && !error && ads.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {ads.map((ad) => {
                const isPaused = pausedIds.has(ad.id);
                const isPausing = pausingId === ad.id;
                const pauseErr = pauseErrors[ad.id];

                return (
                  <div
                    key={ad.id}
                    style={{
                      border: '0.5px solid var(--color-gray-mid)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px',
                      opacity: isPaused ? 0.5 : 1,
                      backgroundColor: isPaused ? 'var(--color-gray-light)' : 'var(--color-white)',
                    }}
                  >
                    {/* Ad header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <AdPreview ad={ad} onExpand={setLightboxUrl} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: '700',
                              fontSize: '13px',
                              color: isPaused ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                              textDecoration: isPaused ? 'line-through' : 'none',
                              wordBreak: 'break-word',
                            }}
                          >
                            {ad.name || '—'}
                          </div>
                          {!isPaused ? (
                            <button
                              className="btn-pause"
                              style={{ fontSize: '10px', padding: '3px 10px', flexShrink: 0 }}
                              onClick={() => handlePauseAd(ad)}
                              disabled={isPausing}
                            >
                              {isPausing ? '...' : '⏹ pausar'}
                            </button>
                          ) : (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                              Pausado
                            </span>
                          )}
                        </div>
                        {ad.destination_url && (
                          <div style={{ marginTop: '6px', display: 'flex', alignItems: 'baseline', gap: '6px', minWidth: 0 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                              URL destino
                            </span>
                            <a
                              href={ad.destination_url}
                              target="_blank"
                              rel="noreferrer"
                              title={ad.destination_url}
                              style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-brand-blue)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {ad.destination_url}
                            </a>
                          </div>
                        )}
                        {pauseErr && (
                          <div className="alert alert-error" style={{ fontSize: '11px', padding: '4px 10px', marginTop: '6px' }}>
                            {pauseErr}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metric windows 7D / 14D / 30D */}
                    <AdMetricWindows
                      metrics_7d={ad.metrics_7d}
                      metrics_14d={ad.metrics_14d}
                      metrics_30d={ad.metrics_30d}
                      objective={campaignObjective}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
