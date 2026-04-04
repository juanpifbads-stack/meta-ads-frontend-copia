import React, { useState } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

// Metric definitions: key, label, color, which Y-axis, value format
const METRIC_CONFIG = [
  { key: 'spend',               label: 'Gasto',        color: '#1B1FE8', axis: 'left',  format: 'currency' },
  { key: 'conversions',         label: 'Convs',         color: '#22C55E', axis: 'right', format: 'number'   },
  { key: 'cost_per_conversion', label: 'Costo/Conv',    color: '#F59E0B', axis: 'left',  format: 'currency' },
  { key: 'roas',                label: 'ROAS',          color: '#8B5CF6', axis: 'right', format: 'roas'     },
  { key: 'cpm',                 label: 'CPM',           color: '#06B6D4', axis: 'left',  format: 'currency' },
  { key: 'frequency',           label: 'Frec.',         color: '#F97316', axis: 'right', format: 'decimal'  },
  { key: 'ctr',                 label: 'CTR',           color: '#EC4899', axis: 'right', format: 'percent'  },
];

const METRIC_MAP = Object.fromEntries(METRIC_CONFIG.map((m) => [m.key, m]));

function formatValue(format, value) {
  if (value == null || isNaN(value)) return '—';
  switch (format) {
    case 'currency':
      if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000)     return `$${(value / 1_000).toFixed(0)}K`;
      return `$${Math.round(value)}`;
    case 'number':   return String(Math.round(value));
    case 'roas':     return `${Number(value).toFixed(1)}x`;
    case 'decimal':  return Number(value).toFixed(1);
    case 'percent':  return `${Number(value).toFixed(1)}%`;
    default:         return String(value);
  }
}

function formatXAxis(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return days[d.getUTCDay()];
  } catch {
    return dateStr;
  }
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        backgroundColor: '#111111',
        borderRadius: '6px',
        padding: '10px 14px',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        color: '#ffffff',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      <div style={{ color: '#999997', marginBottom: '6px', fontSize: '10px' }}>{label}</div>
      {payload.map((p) => {
        const cfg = METRIC_MAP[p.dataKey];
        if (!cfg) return null;
        return (
          <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '3px' }}>
            <span style={{ color: cfg.color }}>{cfg.label}</span>
            <span style={{ fontWeight: '700', color: '#fff' }}>{formatValue(cfg.format, p.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

// Custom dot that always renders the value label
function makeDot(color, format, showLabel) {
  return function CustomDot(props) {
    const { cx, cy, value } = props;
    if (cx == null || cy == null || value == null) return null;
    const label = formatValue(format, value);
    return (
      <g>
        <circle cx={cx} cy={cy} r={3} fill={color} stroke="none" />
        {showLabel && (
          <text
            x={cx}
            y={cy - 8}
            textAnchor="middle"
            fontSize={8}
            fill={color}
            fontFamily="Courier New, monospace"
            fontWeight="700"
          >
            {label}
          </text>
        )}
      </g>
    );
  };
}

export default function TrendChart({ data }) {
  const [activeMetrics, setActiveMetrics] = useState(['spend']);

  const toggleMetric = (key) => {
    setActiveMetrics((prev) =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter((k) => k !== key) : prev // keep at least 1
        : [...prev, key]
    );
  };

  if (!data || data.length === 0) return null;

  const hasLeft  = activeMetrics.some((k) => METRIC_MAP[k]?.axis === 'left');
  const hasRight = activeMetrics.some((k) => METRIC_MAP[k]?.axis === 'right');
  const showLabel = activeMetrics.length === 1;

  return (
    <div style={{ marginTop: '10px' }}>
      {/* Metric toggles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
        {METRIC_CONFIG.map((m) => {
          const isActive = activeMetrics.includes(m.key);
          return (
            <button
              key={m.key}
              onClick={() => toggleMetric(m.key)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: '700',
                padding: '3px 9px',
                border: `1px solid ${isActive ? m.color : 'var(--color-gray-mid)'}`,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                backgroundColor: isActive ? m.color : 'transparent',
                color: isActive ? '#fff' : 'var(--color-text-muted)',
                transition: 'all 0.15s ease',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div
        style={{
          backgroundColor: 'var(--color-gray-light)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 4px 6px',
        }}
      >
        <ResponsiveContainer width="100%" height={140}>
          <ComposedChart data={data} margin={{ top: showLabel ? 16 : 6, right: hasRight ? 10 : 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E6" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              tick={{ fontFamily: 'Courier New, monospace', fontSize: 9, fill: '#999997' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            {hasLeft && (
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontFamily: 'Courier New, monospace', fontSize: 8, fill: '#999997' }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v) => formatValue('currency', v)}
              />
            )}
            {hasRight && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontFamily: 'Courier New, monospace', fontSize: 8, fill: '#999997' }}
                axisLine={false}
                tickLine={false}
                width={32}
                tickFormatter={(v) => {
                  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                  return Number(v).toFixed(Number(v) < 10 ? 1 : 0);
                }}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            {activeMetrics.map((key) => {
              const cfg = METRIC_MAP[key];
              if (!cfg) return null;
              // If the required axis isn't present (only one axis rendered), fall back
              const yAxisId = (cfg.axis === 'left' && hasLeft) ? 'left'
                            : (cfg.axis === 'right' && hasRight) ? 'right'
                            : (hasLeft ? 'left' : 'right');
              return (
                <Line
                  key={key}
                  yAxisId={yAxisId}
                  type="monotone"
                  dataKey={key}
                  stroke={cfg.color}
                  strokeWidth={2}
                  dot={makeDot(cfg.color, cfg.format, showLabel)}
                  activeDot={{ r: 5, fill: cfg.color, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
