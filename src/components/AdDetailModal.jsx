import React, { useState, useEffect } from 'react';
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

const WINDOWS = ['7d', '14d', '30d'];

export default function AdDetailModal({ adsetId, adsetName, accountId, onClose }) {
  const [activeWindow, setActiveWindow] = useState('7d');
  const [adsData, setAdsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // Close on overlay click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const getAdsForWindow = () => {
    if (!adsData) return [];
    return adsData[activeWindow] || adsData.ads || [];
  };

  const ads = getAdsForWindow();

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={adsetName}>
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
                    <th>Anuncio</th>
                    <th style={{ textAlign: 'right' }}>Gasto</th>
                    <th style={{ textAlign: 'right' }}>Convs.</th>
                    <th style={{ textAlign: 'right' }}>Costo/Conv</th>
                    <th style={{ textAlign: 'right' }}>ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {ads.map((ad) => (
                    <tr key={ad.id || ad.ad_id}>
                      <td>
                        <div
                          style={{
                            fontWeight: '400',
                            maxWidth: '220px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={ad.name || ad.ad_name}
                        >
                          {ad.name || ad.ad_name || '—'}
                        </div>
                        {ad.status && (
                          <div
                            style={{
                              fontSize: '10px',
                              color: 'var(--color-text-muted)',
                              marginTop: '1px',
                            }}
                          >
                            {ad.status}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {formatCurrency(ad.spend)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {ad.conversions != null ? ad.conversions : '—'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          color: 'var(--color-brand-blue)',
                          fontWeight: '700',
                        }}
                      >
                        {ad.cost_per_conversion != null
                          ? formatCurrency(ad.cost_per_conversion)
                          : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {ad.roas != null ? `${Number(ad.roas).toFixed(2)}x` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
