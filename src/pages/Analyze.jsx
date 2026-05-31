import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client.js';
import './Analyze.css';

const EVENT_TYPE_LABELS = {
  UPDATE_AD_SET_BUDGET: 'Cambio de presupuesto',
  UPDATE_AD_SET_BID: 'Cambio de puja',
  UPDATE_AD_SET_STATUS: 'Estado conjunto',
  UPDATE_AD_STATUS: 'Estado anuncio',
  UPDATE_CAMPAIGN_STATUS: 'Estado campaña',
  UPDATE_CAMPAIGN_BUDGET: 'Presupuesto campaña',
  CREATE_AD_SET: 'Nuevo conjunto',
  CREATE_AD: 'Nuevo anuncio',
  CREATE_CAMPAIGN: 'Nueva campaña',
  DELETE_AD_SET: 'Conjunto eliminado',
  DELETE_AD: 'Anuncio eliminado',
  DELETE_CAMPAIGN: 'Campaña eliminada',
  UPDATE_AD_CREATIVE: 'Cambio de creativo',
  UPDATE_AD_SET_TARGET: 'Cambio de targeting',
};

function labelEvent(type) {
  return EVENT_TYPE_LABELS[type] || type || '—';
}

function parseExtra(extra) {
  if (!extra) return '—';
  try {
    const obj = typeof extra === 'string' ? JSON.parse(extra) : extra;
    const parts = [];
    if (obj.old_value !== undefined && obj.new_value !== undefined) {
      parts.push(`${obj.old_value} → ${obj.new_value}`);
    } else if (obj.new_status) {
      parts.push(obj.new_status);
    } else {
      return JSON.stringify(obj).slice(0, 80);
    }
    return parts.join(' | ');
  } catch {
    return String(extra).slice(0, 80);
  }
}

function toCSV(activities) {
  const headers = ['Fecha', 'Tipo de cambio', 'Objeto', 'Tipo de objeto', 'Detalle', 'Actor'];
  const rows = activities.map((a) => [
    new Date(a.event_time * 1000).toLocaleString('es-AR'),
    labelEvent(a.event_type),
    a.object_name || '—',
    a.object_type || '—',
    parseExtra(a.extra_data),
    a.actor_name || '—',
  ]);
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  return [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
}

export default function Analyze({ onBack }) {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [since, setSince] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [until, setUntil] = useState(() => new Date().toISOString().slice(0, 10));
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    apiClient.get('/accounts').then((res) => {
      const raw = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.accounts) ? res.data.accounts : [];
      setAccounts(raw);
      if (raw.length > 0) setSelectedAccount(raw[0].id);
    }).catch(() => {});
  }, []);

  const fetch = useCallback(async () => {
    if (!selectedAccount) return;
    setLoading(true);
    setError(null);
    setFetched(false);
    try {
      const res = await apiClient.get(`/accounts/${selectedAccount}/activities`, {
        params: { since, until },
      });
      setActivities(res.data.activities || []);
      setFetched(true);
    } catch (err) {
      setError(err.message || 'No se pudo obtener el historial.');
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, since, until]);

  function downloadCSV() {
    const csv = toCSV(activities);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const accountName = accounts.find((a) => a.id === selectedAccount)?.name || selectedAccount;
    a.href = url;
    a.download = `historial_${accountName}_${since}_${until}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="analyze-page">
      <div className="analyze-header">
        <div>
          <div className="analyze-brand">alquimia.</div>
          <div className="analyze-eyebrow">Analizar cuenta</div>
          <h1 className="analyze-title">Historial de cambios</h1>
        </div>
        <button className="analyze-btn analyze-btn--ghost" onClick={onBack}>← Volver</button>
      </div>

      <div className="analyze-controls">
        <div className="analyze-field">
          <label>Cuenta publicitaria</label>
          <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="analyze-field">
          <label>Desde</label>
          <input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
        </div>
        <div className="analyze-field">
          <label>Hasta</label>
          <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </div>
        <div className="analyze-field analyze-field--actions">
          <button className="analyze-btn" onClick={fetch} disabled={loading}>
            {loading ? 'Consultando…' : 'Ver historial'}
          </button>
          {fetched && activities.length > 0 && (
            <button className="analyze-btn analyze-btn--ghost" onClick={downloadCSV}>
              Descargar CSV
            </button>
          )}
        </div>
      </div>

      {error && <div className="analyze-error">⚠ {error}</div>}

      {fetched && activities.length === 0 && !loading && (
        <div className="analyze-empty">No hay cambios registrados en ese período.</div>
      )}

      {activities.length > 0 && (
        <div className="analyze-table-wrap">
          <div className="analyze-count">{activities.length} cambios encontrados</div>
          <table className="analyze-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo de cambio</th>
                <th>Objeto</th>
                <th>Tipo</th>
                <th>Detalle</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a, i) => (
                <tr key={i}>
                  <td className="analyze-td--date">
                    {new Date(a.event_time * 1000).toLocaleString('es-AR', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td><span className="analyze-tag">{labelEvent(a.event_type)}</span></td>
                  <td className="analyze-td--name">{a.object_name || '—'}</td>
                  <td className="analyze-td--type">{a.object_type || '—'}</td>
                  <td className="analyze-td--detail">{parseExtra(a.extra_data)}</td>
                  <td className="analyze-td--actor">{a.actor_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
