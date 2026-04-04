import React, { useState } from 'react';
import MetricsTable from './MetricsTable.jsx';
import TrendChart from './TrendChart.jsx';
import BudgetActionPanel from './BudgetActionPanel.jsx';
import AdDetailModal from './AdDetailModal.jsx';

const formatCurrency = (value) => {
  if (value == null || isNaN(value)) return '—';
  return `$${new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}`;
};

export default function AdSetCard({ adset, accountId, onAction }) {
  const [actionPanel, setActionPanel] = useState(null); // 'increase' | 'decrease' | null
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [showSecondaryMetrics, setShowSecondaryMetrics] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [pauseError, setPauseError] = useState(null);
  const [pauseSuccess, setPauseSuccess] = useState(false);

  const budget = adset.daily_budget || adset.lifetime_budget || 0;
  const budgetLabel = adset.daily_budget ? 'diario' : 'total';

  const handleCardClick = (e) => {
    // Don't open modal if clicking buttons or panels
    if (
      e.target.closest('button') ||
      e.target.closest('.action-panel') ||
      e.target.closest('.pause-confirm')
    ) {
      return;
    }
    setShowModal(true);
  };

  const handleActionToggle = (dir) => {
    setShowPauseConfirm(false);
    setActionPanel((prev) => (prev === dir ? null : dir));
  };

  const handlePauseToggle = () => {
    setActionPanel(null);
    setPauseError(null);
    setShowPauseConfirm((prev) => !prev);
  };

  const handlePauseConfirm = async () => {
    setPauseLoading(true);
    setPauseError(null);
    try {
      await onAction({ type: 'pause', entityId: adset.id, entityType: 'adset' });
      setPauseSuccess(true);
    } catch (err) {
      setPauseError(err.message || 'Error al pausar el conjunto.');
    } finally {
      setPauseLoading(false);
    }
  };

  const handleBudgetSuccess = (newBudget) => {
    setActionPanel(null);
    onAction && onAction({ type: 'budget_updated', entityId: adset.id, newBudget });
  };

  const metrics_7d = adset.metrics_7d || adset.metrics?.['7d'];
  const metrics_14d = adset.metrics_14d || adset.metrics?.['14d'];
  const metrics_30d = adset.metrics_30d || adset.metrics?.['30d'];
  const trendData = adset.trend_data || adset.daily_data || [];

  return (
    <>
      <div className="card" style={{ cursor: 'pointer' }} onClick={handleCardClick}>
        {/* Card Header */}
        <div className="card-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="card-title">{adset.name}</div>
            {adset.campaign_name && (
              <div className="card-subtitle">{adset.campaign_name}</div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span className="badge-active">Activo</span>
          </div>
        </div>

        {/* Budget info */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-text-muted)',
            marginBottom: '12px',
          }}
        >
          Presupuesto {budgetLabel}:{' '}
          <span
            style={{
              fontWeight: '700',
              color: 'var(--color-text-primary)',
            }}
          >
            {formatCurrency(budget)}
          </span>
        </div>

        {/* Metrics Windows */}
        <MetricsTable
          metrics_7d={metrics_7d}
          metrics_14d={metrics_14d}
          metrics_30d={metrics_30d}
        />

        {/* Secondary metrics collapsible */}
        <button
          className="collapsible-toggle"
          onClick={(e) => {
            e.stopPropagation();
            setShowSecondaryMetrics((v) => !v);
          }}
        >
          <span>{showSecondaryMetrics ? '▾' : '▸'}</span>
          <span>métricas secundarias</span>
        </button>

        {showSecondaryMetrics && (
          <div className="collapsible-content">
            <div className="metric-windows">
              {[
                { label: '7D', m: metrics_7d },
                { label: '14D', m: metrics_14d },
                { label: '30D', m: metrics_30d },
              ].map(({ label, m }) => (
                <div key={label} className="metric-window">
                  <span className="metric-window-label">{label}</span>
                  <div className="metric-row">
                    <span className="metric-label">CPM</span>
                    <span className="metric-value" style={{ fontSize: '13px' }}>
                      {m?.cpm != null ? formatCurrency(m.cpm) : '—'}
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Frecuencia</span>
                    <span className="metric-value" style={{ fontSize: '13px' }}>
                      {m?.frequency != null ? Number(m.frequency).toFixed(2) : '—'}
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">CTR</span>
                    <span className="metric-value" style={{ fontSize: '13px' }}>
                      {m?.ctr != null ? `${Number(m.ctr).toFixed(2)}%` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trend Chart */}
        {trendData.length > 0 && <TrendChart data={trendData} />}

        {/* Action Buttons */}
        {!pauseSuccess && (
          <div className="card-actions">
            <button
              className="btn-increase"
              onClick={(e) => {
                e.stopPropagation();
                handleActionToggle('increase');
              }}
            >
              ↑ subir
            </button>
            <button
              className="btn-decrease"
              onClick={(e) => {
                e.stopPropagation();
                handleActionToggle('decrease');
              }}
            >
              ↓ bajar
            </button>
            <button
              className="btn-pause"
              onClick={(e) => {
                e.stopPropagation();
                handlePauseToggle();
              }}
            >
              ⏹ pausar
            </button>
          </div>
        )}

        {pauseSuccess && (
          <div className="alert alert-success" style={{ marginTop: '12px' }}>
            Conjunto pausado correctamente.
          </div>
        )}

        {/* Budget Action Panel */}
        {actionPanel && (
          <div onClick={(e) => e.stopPropagation()}>
            <BudgetActionPanel
              currentBudget={budget}
              entityId={adset.id}
              entityType="adset"
              adAccountId={accountId}
              direction={actionPanel}
              onSuccess={handleBudgetSuccess}
              onCancel={() => setActionPanel(null)}
            />
          </div>
        )}

        {/* Pause Confirmation */}
        {showPauseConfirm && !pauseSuccess && (
          <div className="pause-confirm" onClick={(e) => e.stopPropagation()}>
            <p>
              Estás por pausar el conjunto{' '}
              <span className="budget-info">"{adset.name}"</span> con presupuesto{' '}
              <span className="budget-info">{formatCurrency(budget)}</span> {budgetLabel}.
              <br />
              Esta acción puede revertirse desde Meta Ads Manager.
            </p>
            {pauseError && (
              <div className="alert alert-error" style={{ marginBottom: '10px' }}>
                {pauseError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-danger"
                onClick={handlePauseConfirm}
                disabled={pauseLoading}
                style={{ fontSize: '11px', padding: '6px 14px' }}
              >
                {pauseLoading ? (
                  <>
                    <span className="spinner spinner-sm" /> Pausando...
                  </>
                ) : (
                  'Confirmar pausa'
                )}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowPauseConfirm(false);
                  setPauseError(null);
                }}
                disabled={pauseLoading}
                style={{ fontSize: '11px', padding: '6px 14px' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ad Detail Modal */}
      {showModal && (
        <AdDetailModal
          adsetId={adset.id}
          adsetName={adset.name}
          accountId={accountId}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
