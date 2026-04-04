import React, { useState } from 'react';
import MetricsTable from './MetricsTable.jsx';
import TrendChart from './TrendChart.jsx';
import BudgetActionPanel from './BudgetActionPanel.jsx';
import AdSetAccordion from './AdSetAccordion.jsx';
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

export default function CampaignCard({ campaign, onAction }) {
  const [actionPanel, setActionPanel] = useState(null); // 'increase' | 'decrease' | null
  const [showSecondaryMetrics, setShowSecondaryMetrics] = useState(false);

  const budget = campaign.daily_budget || campaign.lifetime_budget || 0;
  const budgetLabel = campaign.daily_budget ? 'diario' : 'total';

  const metrics_7d = campaign.metrics_7d || campaign.metrics?.['7d'];
  const metrics_14d = campaign.metrics_14d || campaign.metrics?.['14d'];
  const metrics_30d = campaign.metrics_30d || campaign.metrics?.['30d'];
  const trendData = campaign.trend_data || campaign.daily_data || [];
  const adsets = campaign.adsets || [];

  const handleActionToggle = (dir) => {
    setActionPanel((prev) => (prev === dir ? null : dir));
  };

  const handleBudgetSuccess = (newBudget) => {
    setActionPanel(null);
    onAction && onAction({ type: 'budget_updated', entityId: campaign.id, newBudget });
  };

  const handlePauseAdset = async (adsetId) => {
    const response = await apiClient.post('/actions/pause', {
      entity_id: adsetId,
      entity_type: 'adset',
      ad_account_id: campaign.account_id || campaign.ad_account_id,
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
          <div className="card-title">{campaign.name}</div>
          {campaign.objective && (
            <div className="card-subtitle">{campaign.objective}</div>
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

      {/* Trend Chart */}
      {trendData.length > 0 && <TrendChart data={trendData} />}

      {/* AdSet Accordion */}
      <AdSetAccordion adsets={adsets} onPause={handlePauseAdset} />

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
          entityId={campaign.id}
          entityType="campaign"
          adAccountId={campaign.account_id || campaign.ad_account_id}
          direction={actionPanel}
          onSuccess={handleBudgetSuccess}
          onCancel={() => setActionPanel(null)}
        />
      )}
    </div>
  );
}
