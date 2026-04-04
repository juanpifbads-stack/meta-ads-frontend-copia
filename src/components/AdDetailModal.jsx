import React, { useState, useEffect } from 'react';
import apiClient from '../api/client.js';

const formatCurrency = (value) => {
  if (value == null || isNaN(value)) return '—';
  return `$${new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}`;
};

const WINDOWS = ['7d', '14d', '30d'];

export default function AdDetailModal({ adsetId, adsetName, accountId, onClose }) {
  const [activeWindow, setActiveWindow] = useState('7d');
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
        const response = await apiClient.get(
          `/accounts/${accountId}/adsets/${adsetId}/ads`
        );
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
      setPauseErrors((prev) => ({ ...prev, [ad.id]: err.message || 'Error al pausar.' }));
    } finally {
      setPausingId(null);
    }
  };

  const ads = Array.isArray(adsData) ? adsData : [];
  const windowKey = `metrics_${activeWindow}`;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            cursor: 'zoom-out',
          }}
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Vista previa del anuncio"
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: '8px', objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="modal" role="dialog" aria-modal="true" aria-label={adsetName} style={{ maxWidth: '720px' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{adsetName}</div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--color-text-muted)',
                marginTop: '2px',
              }}
            >
              Anuncios activos del conjunto
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Window tabs */}
          <div style={{ marginBottom: '16px' }}>
            <div className="tabs">
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  className={`tab-btn ${activeWindow === w ? 'active' : ''}`}
                  onClick={() => setActiveWindow(w)}
                >
                  {w.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

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
              <p>No hay anuncios activos en este período.</p>
            </div>
          )}

          {!loading && !error && ads.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '52px' }}>Prev.</th>
                    <th>Anuncio</th>
                    <th style={{ textAlign: 'right' }}>Gasto</th>
                    <th style={{ textAlign: 'right' }}>Convs.</th>
                    <th style={{ textAlign: 'right' }}>Costo/Conv</th>
                    <th style={{ textAlign: 'right' }}>ROAS</th>
                    <th style={{ textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {ads.map((ad) => {
                    const m = ad[windowKey] || {};
                    const isPaused = pausedIds.has(ad.id);
                    const isPausing = pausingId === ad.id;
                    const pauseErr = pauseErrors[ad.id];

                    return (
                      <React.Fragment key={ad.id}>
                        <tr style={{ opacity: isPaused ? 0.45 : 1 }}>
                          {/* Thumbnail */}
                          <td style={{ padding: '6px 8px' }}>
                            {ad.thumbnail_url ? (
                              <img
                                src={ad.thumbnail_url}
                                alt=""
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  objectFit: 'cover',
                                  borderRadius: '4px',
                                  cursor: 'zoom-in',
                                  display: 'block',
                                  border: '0.5px solid var(--color-gray-mid)',
                                }}
                                onClick={() => setLightboxUrl(ad.thumbnail_url)}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '4px',
                                  backgroundColor: 'var(--color-gray-light)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '16px',
                                  color: 'var(--color-text-muted)',
                                }}
                              >
                                ◻
                              </div>
                            )}
                          </td>

                          {/* Name */}
                          <td>
                            <div
                              style={{
                                fontWeight: '400',
                                maxWidth: '180px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                textDecoration: isPaused ? 'line-through' : 'none',
                              }}
                              title={ad.name}
                            >
                              {ad.name || '—'}
                            </div>
                            {isPaused && (
                              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                                Pausado
                              </div>
                            )}
                          </td>

                          <td style={{ textAlign: 'right' }}>{formatCurrency(m.spend)}</td>
                          <td style={{ textAlign: 'right' }}>{m.conversions != null ? m.conversions : '—'}</td>
                          <td style={{ textAlign: 'right', color: 'var(--color-brand-blue)', fontWeight: '700' }}>
                            {m.cost_per_conversion != null ? formatCurrency(m.cost_per_conversion) : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {m.roas != null ? `${Number(m.roas).toFixed(2)}x` : '—'}
                          </td>

                          {/* Pause action */}
                          <td style={{ textAlign: 'center' }}>
                            {!isPaused ? (
                              <button
                                className="btn-pause"
                                style={{ fontSize: '10px', padding: '3px 8px', whiteSpace: 'nowrap' }}
                                onClick={() => handlePauseAd(ad)}
                                disabled={isPausing}
                              >
                                {isPausing ? '...' : '⏹ pausar'}
                              </button>
                            ) : (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                        {pauseErr && (
                          <tr>
                            <td colSpan={7} style={{ padding: '4px 8px' }}>
                              <div className="alert alert-error" style={{ fontSize: '11px', padding: '4px 10px' }}>
                                {pauseErr}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
