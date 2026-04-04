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

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(d);
  } catch {
    return dateStr;
  }
}

function ActionBadge({ actionType }) {
  const type = (actionType || '').toLowerCase();

  if (type.includes('increase') || type === 'budget_increase') {
    return <span className="badge badge-increase">↑ Aumento</span>;
  }
  if (type.includes('decrease') || type === 'budget_decrease') {
    return <span className="badge badge-decrease">↓ Reducción</span>;
  }
  if (type.includes('pause')) {
    return <span className="badge badge-pause">⏹ Pausa</span>;
  }
  return (
    <span
      className="badge"
      style={{
        backgroundColor: 'var(--color-gray-light)',
        border: '1px solid var(--color-gray-mid)',
        color: 'var(--color-text-secondary)',
      }}
    >
      {actionType || '—'}
    </span>
  );
}

function formatValue(value, actionType) {
  if (value == null) return '—';
  const numVal = parseFloat(value);
  if (!isNaN(numVal) && (actionType || '').toLowerCase().includes('budget')) {
    return formatCurrency(numVal);
  }
  return String(value);
}

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAudit = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get('/audit');
        setEntries(response.data || []);
      } catch (err) {
        setError(err.message || 'Error al cargar el historial.');
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, []);

  if (loading) {
    return (
      <div className="loading-center">
        <span className="spinner" />
        <span>Cargando historial...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error" style={{ marginBottom: '16px' }}>
        {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>📋</div>
        <p style={{ fontWeight: '700' }}>Sin registros</p>
        <p>Aún no se han realizado acciones.</p>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--color-text-muted)',
          marginBottom: '12px',
        }}
      >
        {entries.length} {entries.length === 1 ? 'registro' : 'registros'} encontrados
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha / Hora</th>
              <th>Cuenta</th>
              <th>Entidad</th>
              <th>Acción</th>
              <th style={{ textAlign: 'right' }}>Valor anterior</th>
              <th style={{ textAlign: 'right' }}>Valor nuevo</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => (
              <tr key={entry.id || idx}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {formatDateTime(entry.created_at || entry.timestamp)}
                </td>
                <td>
                  <div
                    style={{
                      maxWidth: '140px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={entry.account_name || entry.ad_account_id}
                  >
                    {entry.account_name || entry.ad_account_id || '—'}
                  </div>
                </td>
                <td>
                  <div
                    style={{
                      maxWidth: '180px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={entry.entity_name || entry.entity_id}
                  >
                    {entry.entity_name || entry.entity_id || '—'}
                  </div>
                  {entry.entity_type && (
                    <div
                      style={{
                        fontSize: '10px',
                        color: 'var(--color-text-muted)',
                        marginTop: '1px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {entry.entity_type}
                    </div>
                  )}
                </td>
                <td>
                  <ActionBadge actionType={entry.action_type || entry.action} />
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {formatValue(
                    entry.previous_value || entry.old_value,
                    entry.action_type || entry.action
                  )}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    color: 'var(--color-brand-blue)',
                    fontWeight: '700',
                  }}
                >
                  {formatValue(
                    entry.new_value || entry.next_value,
                    entry.action_type || entry.action
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
