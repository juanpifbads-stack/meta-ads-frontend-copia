import React, { useState } from 'react';
import apiClient from '../api/client.js';
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

function formatUpdatedTime(isoString) {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

export default function AdSetCard({ adset, accountId, onAction }) {
  const [actionPanel, setActionPanel] = useState(null); // 'increase' | 'decrease' | null
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [showSecondaryMetrics, setShowSecondaryMetrics] = useState(false);
  const [showTrend, setShowTrend] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [pauseError, setPauseError] = useState(null);
  const [pauseSuccess, setPauseSuccess] = useState(false);
  const [currentBudgetOverride, setCurrentBudgetOverride] = useState(null);
  const [updatedAtOverride, setUpdatedAtOverride] = useState(null);
  const [postEdit, setPostEdit] = useState(null);
  const [postEditLoading, setPostEditLoading] = useState(false);
  const [postEditError, setPostEditError] = useState(null);

  const budget = currentBudgetOverride ?? adset.daily_budget ?? adset.lifetime_budget ?? 0;
  const budgetLabel = adset.daily_budget ? 'diario' : 'total';

  const handleCardClick = (e) => {
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
    setCurrentBudgetOverride(newBudget);
    setUpdatedAtOverride(new Date().toISOString());
    onAction && onAction({ type: 'budget_updated', entityId: adset.id, newBudget });
  };

  const metrics_7d = adset.metrics_7d || adset.metrics?.['7d'];
  const metrics_14d = adset.metrics_14d || adset.metrics?.['14d'];
  const metrics_30d = adset.metrics_30d || adset.metrics?.['30d'];
  const trendData = adset.daily_trend || adset.trend_data || adset.daily_data || [];
  const updatedIso = updatedAtOverride || adset.updated_time;
  const updatedAt = formatUpdatedTime(updatedIso);

  const fetchPostEdit = async () => {
    if (!updatedIso) return;
    setPostEditLoading(true);
    setPostEditError(null);
    try {
      const since = String(updatedIso).slice(0, 10);
      const res = await apiClient.get(`/accounts/${accountId}/entity/${adset.id}/insights-since`, {
        params: { since, objective: adset.campaign_objective || '' },
        timeout: 30000,
      });
      setPostEdit(res.data);
    } catch (err) {
      setPostEditError(err.response?.data?.message || 'No se pudieron traer las métricas.');
    } finally {
      setPostEditLoading(false);
    }
  };

  return (
    <>
      <div className="card" style={{ cursor: 'pointer' }} onClick={handleCardClick}>
        {/* Campaign tag */}
        {adset.campaign_name && (
          <div style={{ marginBottom: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: '700',
                color: 'var(--color-brand-blue)',
                backgroundColor: 'var(--color-brand-blue-light)',
                border: '0.5px solid var(--color-brand-blue-mid)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 8px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              ◆ {adset.campaign_name}
            </span>
          </div>
        )}

        {/* Card Header */}
        <div className="card-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="card-title">{adset.name}</div>
            {updatedAt && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#92400e', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', padding: '2px 8px' }}>
                ✎ Última edición: <strong>{updatedAt}</strong>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {pauseSuccess
              ? <span className="badge-paused">Pausado</span>
              : <span className="badge-active">Activo</span>
            }
          </div>
        </div>

        {/* Budget info */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            marginBottom: '14px',
          }}
        >
          Presupuesto {budgetLabel}:{' '}
          <span style={{ fontWeight: '700', color: 'var(--color-text-primary)' }}>
            {formatCurrency(budget)}
          </span>
        </div>

        {/* Metrics Windows */}
        <MetricsTable
          metrics_7d={metrics_7d}
          metrics_14d={metrics_14d}
          metrics_30d={metrics_30d}
        />

        {/* Métricas post última edición */}
        {updatedIso && (
          <div style={{ marginTop: '10px' }} onClick={(e) => e.stopPropagation()}>
            <button
              className="btn btn-secondary"
              onClick={fetchPostEdit}
              disabled={postEditLoading}
              style={{ fontSize: '11px', padding: '7px 12px', width: '100%' }}
            >
              {postEditLoading ? <><span className="spinner spinner-sm" /> Trayendo…</> : '📊 Ver métricas post última edición'}
            </button>
            {postEditError && <div className="alert alert-error" style={{ marginTop: '8px' }}>{postEditError}</div>}
            {postEdit && (
              <div style={{ marginTop: '10px', border: '1px solid var(--color-gray-light)', borderRadius: 'var(--radius-md)', padding: '12px', background: '#fafafa' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                  Desde la última edición ({postEdit.since} → hoy · {postEdit.days} día{postEdit.days > 1 ? 's' : ''})
                </div>
                <div className="metric-windows">
                  <div className="metric-window">
                    <div className="metric-row"><span className="metric-label">Gasto</span><span className="metric-value" style={{ fontSize: '13px' }}>{formatCurrency(postEdit.spend)}</span></div>
                    <div className="metric-row"><span className="metric-label">Conversiones</span><span className="metric-value" style={{ fontSize: '13px' }}>{Number(postEdit.conversions || 0).toLocaleString('es-AR')}</span></div>
                    <div className="metric-row"><span className="metric-label">Costo/conv.</span><span className="metric-value" style={{ fontSize: '13px' }}>{formatCurrency(postEdit.cost_per_conversion)}</span></div>
                    <div className="metric-row"><span className="metric-label">ROAS</span><span className="metric-value" style={{ fontSize: '13px', fontWeight: 700 }}>{Number(postEdit.roas || 0).toFixed(2)}×</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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

        {/* Daily trend collapsible */}
        {trendData.length > 0 && (
          <>
            <button
              className="collapsible-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setShowTrend((v) => !v);
              }}
            >
              <span>{showTrend ? '▾' : '▸'}</span>
              <span>evolución 7 días</span>
            </button>
            {showTrend && (
              <div className="collapsible-content" onClick={(e) => e.stopPropagation()}>
                <TrendChart data={trendData} />
              </div>
            )}
          </>
        )}

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
          campaignObjective={adset.campaign_objective || null}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
