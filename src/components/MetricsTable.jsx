import React from 'react';

const formatCurrency = (value) => {
  if (value == null || isNaN(value)) return '—';
  return `$${new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}`;
};

function MetricCell({ label, value, isCost }) {
  return (
    <div className="metric-row">
      <span className="metric-label">{label}</span>
      <span className={`metric-value ${isCost ? 'cost' : ''}`} style={{ fontSize: '13px' }}>
        {value}
      </span>
    </div>
  );
}

function WindowColumn({ label, metrics }) {
  if (!metrics) {
    return (
      <div className="metric-window">
        <span className="metric-window-label">{label}</span>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--color-text-muted)',
          }}
        >
          Sin datos
        </p>
      </div>
    );
  }

  const spend =
    metrics.spend != null ? formatCurrency(metrics.spend) : '—';
  const conversions =
    metrics.conversions != null ? String(metrics.conversions) : '—';
  const cpc =
    metrics.cost_per_conversion != null
      ? formatCurrency(metrics.cost_per_conversion)
      : '—';
  const roas =
    metrics.roas != null ? `${Number(metrics.roas).toFixed(2)}x` : '—';

  return (
    <div className="metric-window">
      <span className="metric-window-label">{label}</span>
      <MetricCell label="Gasto" value={spend} />
      <MetricCell label="Convs." value={conversions} />
      <MetricCell label="Costo/Conv" value={cpc} isCost />
      <MetricCell label="ROAS" value={roas} />
    </div>
  );
}

export default function MetricsTable({ metrics_7d, metrics_14d, metrics_30d }) {
  return (
    <div className="metric-windows">
      <WindowColumn label="7D" metrics={metrics_7d} />
      <WindowColumn label="14D" metrics={metrics_14d} />
      <WindowColumn label="30D" metrics={metrics_30d} />
    </div>
  );
}
