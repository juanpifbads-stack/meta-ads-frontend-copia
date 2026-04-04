import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  CartesianGrid,
} from 'recharts';

const METRIC_OPTIONS = [
  { key: 'spend', label: 'gasto' },
  { key: 'conversions', label: 'conversiones' },
  { key: 'cost_per_conversion', label: 'costo/conv' },
  { key: 'roas', label: 'ROAS' },
];

const formatCurrency = (value) => {
  if (value == null) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
};

function formatValue(key, value) {
  if (value == null) return '—';
  if (key === 'spend' || key === 'cost_per_conversion') return formatCurrency(value);
  if (key === 'roas') return `${Number(value).toFixed(2)}x`;
  return String(Math.round(value));
}

function CustomTooltip({ active, payload, label, metricKey }) {
  if (!active || !payload || !payload.length) return null;
  const value = payload[0]?.value;

  return (
    <div
      style={{
        backgroundColor: '#111111',
        border: 'none',
        borderRadius: '6px',
        padding: '8px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        color: '#ffffff',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      }}
    >
      <div style={{ color: '#999997', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontWeight: '700', color: '#ffffff' }}>{formatValue(metricKey, value)}</div>
    </div>
  );
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

export default function TrendChart({ data, currency }) {
  const [activeMetric, setActiveMetric] = useState('spend');

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height: '120px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-gray-light)',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--color-text-muted)',
        }}
      >
        Sin datos para el gráfico
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    date: d.date,
  }));

  return (
    <div style={{ marginTop: '12px' }}>
      {/* Metric selector tabs */}
      <div className="tabs" style={{ marginBottom: '10px' }}>
        {METRIC_OPTIONS.map((m) => (
          <button
            key={m.key}
            className={`tab-btn ${activeMetric === m.key ? 'active' : ''}`}
            onClick={() => setActiveMetric(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div
        style={{
          backgroundColor: 'var(--color-gray-light)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 4px 4px',
        }}
      >
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1B1FE8" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#1B1FE8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E6" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              tick={{
                fontFamily: 'Courier New, monospace',
                fontSize: 9,
                fill: '#999997',
              }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{
                fontFamily: 'Courier New, monospace',
                fontSize: 9,
                fill: '#999997',
              }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v) => {
                if (activeMetric === 'spend' || activeMetric === 'cost_per_conversion') {
                  return `$${v}`;
                }
                if (activeMetric === 'roas') return `${v}x`;
                return v;
              }}
            />
            <Tooltip content={<CustomTooltip metricKey={activeMetric} />} />
            <Area
              type="monotone"
              dataKey={activeMetric}
              stroke="#1B1FE8"
              strokeWidth={2}
              fill="url(#chartGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#1B1FE8', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
