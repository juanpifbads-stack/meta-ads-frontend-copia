import React, { useState } from 'react';
import MetricsTable from './MetricsTable.jsx';
import TrendChart from './TrendChart.jsx';
import BudgetActionPanel from './BudgetActionPanel.jsx';
import AdSetAccordion from './AdSetAccordion.jsx';
import apiClient from '../api/client.js';

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

export default function CampaignCard({ campaign, accountId, onAction }) {
  const [actionPanel, setActionPanel] = useState(null); // 'increase' | 'decrease' | null
  const [showSecondaryMetrics, setShowSecondaryMetrics] = useState(false);
  const [showTrend, setShowTrend] = useState(false);
  const [postEdit, setPostEdit] = useState(null);
  const [postEditLoading, setPostEditLoading] = useState(false);
  const [postEditError, setPostEditError] = useState(null);

  const entityId = campaign.campaign_id || campaign.id;
  const fetchPostEdit = async () => {
    if (!campaign.updated_time) return;
    setPostEditLoading(true);
    setPostEditError(null);
    try {
      const since = String(campaign.updated_time).slice(0, 10);
      const res = await apiClient.get(`/accounts/${accountId}/entity/${entityId}/insights-since`, {
        params: { since, objective: campaign.objective || '' },
        timeout: 30000,
      });
      setPostEdit(res.data);
    } catch (err) {
      setPostEditError(err.response?.data?.message || 'No se pudieron traer las métricas.');
    } finally {
      setPostEditLoading(false);
    }
  };

  const budget = campaign.campaign_budget || campaign.daily_budget || 0;
  const budgetLabel = (campaign.campaign_budget || campaign.daily_budget) ? 'diario' : 'total';

  const metrics_7d = campaign.metrics_7d || campaign.metrics?.['7d'];
  const metrics_14d = campaign.metrics_14d || campaign.metrics?.['14d'];
  const metrics_30d = campaign.metrics_30d || campaign.metrics?.['30d'];
  const trendData = campaign.daily_trend || campaign.trend_data || campaign.daily_data || [];
  const updatedAt = formatUpdatedTime(campaign.updated_time);
  const adsets = campaign.adsets || [];

  const handleActionToggle = (dir) => {
    setActionPanel((prev) => (prev === dir ? null : dir));
  };

  const handleBudgetSuccess = (newBudget) => {
    setActionPanel(null);
    onAction && onAction({ type: 'budget_updated', entityId: campaign.campaign_id || campaign.id, newBudget });
  };

  const handlePauseAdset = async (adsetId) => {
    const response = await apiClient.post('/actions/pause', {
      entityId: adsetId,
      entityType: 'adset',
      adAccountId: accountId,
    });
    return response.data;
  };

  return (
    <div className="card">
      {/* Card Header */}
      <div className="card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-brand-blue)',
              marginBottom: '4px',
            }}
          >
            CBO — Campaign Budget
          </div>
          <div className="card-title">{campaign.campaign_name || campaign.name}</div>
          {campaign.objective && (
            <div className="card-subtitle">{campaign.objective}</div>
          )}
          {updatedAt && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#92400e', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', padding: '2px 8px' }}>
              ✎ Última edición: <strong>{updatedAt}</strong>
            </div>
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
        objective={campaign.objective || null}
      />

      {/* Métricas post última edición */}
      {campaign.updated_time && (
        <div style={{ marginTop: '10px' }}>
          <button className="btn btn-secondary" onClick={fetchPostEdit} disabled={postEditLoading} style={{ fontSize: '11px', padding: '7px 12px', width: '100%' }}>
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
                  {(() => { const sales = !campaign.objective || ['OUTCOME_SALES','CONVERSIONS','CATALOG_SALES'].includes(campaign.objective); return (<>
                  <div className="metric-row"><span className="metric-label">Gasto</span><span className="metric-value" style={{ fontSize: '13px' }}>{formatCurrency(postEdit.spend)}</span></div>
                  <div className="metric-row"><span className="metric-label">{sales ? 'Conversiones' : 'Resultados'}</span><span className="metric-value" style={{ fontSize: '13px' }}>{Number(postEdit.conversions || 0).toLocaleString('es-AR')}</span></div>
                  <div className="metric-row"><span className="metric-label">{sales ? 'Costo/conv.' : 'CPR'}</span><span className="metric-value" style={{ fontSize: '13px' }}>{formatCurrency(postEdit.cost_per_conversion)}</span></div>
                  {sales && <div className="metric-row"><span className="metric-label">ROAS</span><span className="metric-value" style={{ fontSize: '13px', fontWeight: 700 }}>{Number(postEdit.roas || 0).toFixed(2)}×</span></div>}
                  </>); })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Secondary metrics collapsible */}
      <button
        className="collapsible-toggle"
        onClick={() => setShowSecondaryMetrics((v) => !v)}
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
            onClick={() => setShowTrend((v) => !v)}
          >
            <span>{showTrend ? '▾' : '▸'}</span>
            <span>evolución 7 días</span>
          </button>
          {showTrend && (
            <div className="collapsible-content">
              <TrendChart data={trendData} />
            </div>
          )}
        </>
      )}

      {/* AdSet Accordion */}
      <AdSetAccordion adsets={adsets} onPause={handlePauseAdset} objective={campaign.objective || null} />

      {/* Action Buttons — NO pause at campaign level */}
      <div className="card-actions">
        <button
          className="btn-increase"
          onClick={() => handleActionToggle('increase')}
        >
          ↑ subir presupuesto
        </button>
        <button
          className="btn-decrease"
          onClick={() => handleActionToggle('decrease')}
        >
          ↓ bajar presupuesto
        </button>
      </div>

      {/* Budget Action Panel */}
      {actionPanel && (
        <BudgetActionPanel
          currentBudget={budget}
          entityId={campaign.campaign_id || campaign.id}
          entityName={campaign.campaign_name || campaign.name}
          entityType="campaign"
          adAccountId={accountId}
          direction={actionPanel}
          onSuccess={handleBudgetSuccess}
          onCancel={() => setActionPanel(null)}
        />
      )}
    </div>
  );
}
