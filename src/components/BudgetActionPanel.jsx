import React, { useState, useMemo } from 'react';
import apiClient from '../api/client.js';

const formatCurrency = (value) => {
  if (value == null || isNaN(value)) return '—';
  return `$${new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}`;
};

const PERCENTAGE_STEPS = [10, 15, 20, 25, 30, 35];

export default function BudgetActionPanel({
  currentBudget,
  entityId,
  entityType,
  adAccountId,
  direction,
  onSuccess,
  onCancel,
}) {
  const [mode, setMode] = useState('percentage');
  const [percentage, setPercentage] = useState(20);
  const [fixedAmount, setFixedAmount] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const newBudget = useMemo(() => {
    if (mode === 'percentage') {
      const factor = direction === 'increase' ? 1 + percentage / 100 : 1 - percentage / 100;
      return currentBudget * factor;
    } else {
      const amt = parseFloat(fixedAmount);
      if (isNaN(amt) || amt <= 0) return null;
      return amt; // fixed mode = presupuesto final directo
    }
  }, [mode, percentage, fixedAmount, currentBudget, direction]);

  const directionLabel = direction === 'increase' ? 'Subir' : 'Bajar';
  const directionColor = direction === 'increase' ? '#16a34a' : '#d97706';

  const handleConfirm = async () => {
    if (newBudget == null || newBudget <= 0) {
      setError('El presupuesto resultante debe ser mayor a 0.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiClient.post('/actions/budget', {
        entityId,
        entityType,
        adAccountId,
        direction,
        mode,
        value: mode === 'percentage' ? percentage : Math.round(newBudget * 100) / 100,
      });
      setSuccess(true);
      setTimeout(() => {
        onSuccess && onSuccess(newBudget);
      }, 800);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error al actualizar el presupuesto.');
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="action-panel">
        <div className="alert alert-success">
          Presupuesto actualizado correctamente a{' '}
          <strong>{formatCurrency(newBudget)}</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="action-panel">
      <div className="action-panel-title">
        {directionLabel} presupuesto —{' '}
        <span style={{ color: directionColor }}>
          {entityType === 'campaign' ? 'Campaña' : 'Conjunto'}
        </span>
      </div>

      {!confirming ? (
        <>
          {/* Mode tabs */}
          <div className="tabs" style={{ marginBottom: '14px' }}>
            <button
              className={`tab-btn ${mode === 'percentage' ? 'active' : ''}`}
              onClick={() => setMode('percentage')}
            >
              % porcentaje
            </button>
            <button
              className={`tab-btn ${mode === 'fixed' ? 'active' : ''}`}
              onClick={() => setMode('fixed')}
            >
              $ monto fijo
            </button>
          </div>

          {mode === 'percentage' ? (
            <div>
              {/* Percentage labels */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                {PERCENTAGE_STEPS.map((p) => (
                  <span
                    key={p}
                    onClick={() => setPercentage(p)}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      color: percentage === p ? 'var(--color-brand-blue)' : 'var(--color-text-muted)',
                      cursor: 'pointer',
                      fontWeight: percentage === p ? '700' : '400',
                    }}
                  >
                    {p}%
                  </span>
                ))}
              </div>
              <input
                type="range"
                min={10}
                max={35}
                step={5}
                value={percentage}
                onChange={(e) => setPercentage(Number(e.target.value))}
                style={{ marginBottom: '8px' }}
              />
              <div className="budget-preview">
                Presupuesto actual:{' '}
                <strong>{formatCurrency(currentBudget)}</strong>
                {' → '}
                <strong style={{ color: 'var(--color-brand-blue)' }}>
                  {newBudget != null ? formatCurrency(newBudget) : '—'}
                </strong>
                <span
                  style={{
                    marginLeft: '6px',
                    color: directionColor,
                    fontWeight: '700',
                  }}
                >
                  ({direction === 'increase' ? '+' : '-'}{percentage}%)
                </span>
              </div>
            </div>
          ) : (
            <div>
              <input
                type="number"
                className="input"
                placeholder="Nuevo presupuesto total"
                value={fixedAmount}
                onChange={(e) => setFixedAmount(e.target.value)}
                min={0}
                step={0.01}
                style={{ marginBottom: '8px', maxWidth: '240px' }}
              />
              <div className="budget-preview">
                Presupuesto actual:{' '}
                <strong>{formatCurrency(currentBudget)}</strong>
                {' → '}
                <strong style={{ color: 'var(--color-brand-blue)' }}>
                  {newBudget != null && !isNaN(newBudget)
                    ? formatCurrency(newBudget)
                    : '—'}
                </strong>
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-error" style={{ marginTop: '10px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (mode === 'fixed' && (!fixedAmount || isNaN(parseFloat(fixedAmount)))) {
                  setError('Ingresá un monto válido.');
                  return;
                }
                if (newBudget != null && newBudget > 0) {
                  setError(null);
                  setConfirming(true);
                }
              }}
              style={{ fontSize: '11px', padding: '6px 14px' }}
            >
              Continuar
            </button>
            <button
              className="btn btn-secondary"
              onClick={onCancel}
              style={{ fontSize: '11px', padding: '6px 14px' }}
            >
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
              lineHeight: '1.5',
              marginBottom: '14px',
            }}
          >
            El presupuesto pasará de{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>
              {formatCurrency(currentBudget)}
            </strong>{' '}
            a{' '}
            <strong style={{ color: 'var(--color-brand-blue)' }}>
              {formatCurrency(newBudget)}
            </strong>
            . ¿Confirmar?
          </p>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '10px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={loading}
              style={{ fontSize: '11px', padding: '6px 14px' }}
            >
              {loading ? (
                <>
                  <span className="spinner spinner-sm" /> Procesando...
                </>
              ) : (
                'Confirmar'
              )}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setConfirming(false)}
              disabled={loading}
              style={{ fontSize: '11px', padding: '6px 14px' }}
            >
              Atrás
            </button>
          </div>
        </>
      )}
    </div>
  );
}
