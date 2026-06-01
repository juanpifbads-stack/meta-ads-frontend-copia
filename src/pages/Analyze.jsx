import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client.js';
import './Analyze.css';

// Solo estos tipos de eventos son cambios manuales relevantes
const MANUAL_EVENT_TYPES = new Set([
  'update_ad_set_budget',
  'update_ad_set_bid',
  'update_ad_set_run_status',
  'update_ad_run_status',
  'update_campaign_run_status',
  'update_campaign_budget',
  'create_ad_set',
  'create_ad',
  'create_campaign',
  'delete_ad_set',
  'delete_ad',
  'delete_campaign',
  'update_ad_set_target',
  'update_ad_creative',
  'update_ad_set_name',
  'update_campaign_name',
]);

const EVENT_TYPE_LABELS = {
  update_ad_set_budget:      '💰 Presupuesto conjunto',
  update_campaign_budget:    '💰 Presupuesto campaña',
  update_ad_set_bid:         '🎯 Cambio de puja',
  update_ad_set_run_status:  '⏯ Estado conjunto',
  update_ad_run_status:      '⏯ Estado anuncio',
  update_campaign_run_status:'⏯ Estado campaña',
  create_ad_set:             '✨ Nuevo conjunto',
  create_ad:                 '✨ Nuevo anuncio',
  create_campaign:           '✨ Nueva campaña',
  delete_ad_set:             '🗑 Conjunto eliminado',
  delete_ad:                 '🗑 Anuncio eliminado',
  delete_campaign:           '🗑 Campaña eliminada',
  update_ad_set_target:      '🎯 Cambio de targeting',
  update_ad_creative:        '🖼 Cambio de creativo',
  update_ad_set_name:        '✏️ Nombre conjunto',
  update_campaign_name:      '✏️ Nombre campaña',
};

const STATUS_LABELS = {
  ACTIVE: 'Activo',
  PAUSED: 'Pausado',
  DELETED: 'Eliminado',
  ARCHIVED: 'Archivado',
  1: 'Activo',
  2: 'Pausado',
};

function labelEvent(type) {
  return EVENT_TYPE_LABELS[type?.toLowerCase()] || EVENT_TYPE_LABELS[type] || type || '—';
}

function isManualEvent(type) {
  return MANUAL_EVENT_TYPES.has(type?.toLowerCase());
}

function extractBudget(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v > 10000 ? v / 100 : v;
  if (typeof v === 'object') {
    // {type: "payment_amount", currency: "ARS", amount: X}
    if (v.amount !== undefined) return Number(v.amount) > 10000 ? Number(v.amount) / 100 : Number(v.amount);
    if (v.value !== undefined) return Number(v.value) > 10000 ? Number(v.value) / 100 : Number(v.value);
    if (v.daily_budget !== undefined) return Number(v.daily_budget) / 100;
    if (v.lifetime_budget !== undefined) return Number(v.lifetime_budget) / 100;
  }
  return null;
}

function fmtMoney(n) {
  return `$${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function fmtVal(v) {
  if (v === null || v === undefined) return '—';
  if (STATUS_LABELS[v]) return STATUS_LABELS[v];
  if (typeof v === 'number') return fmtMoney(v > 10000 ? v / 100 : v);
  if (typeof v === 'object') {
    const b = extractBudget(v);
    if (b !== null) return fmtMoney(b);
    return JSON.stringify(v).slice(0, 40);
  }
  if (STATUS_LABELS[String(v)]) return STATUS_LABELS[String(v)];
  return String(v);
}

function parseExtra(extra, eventType) {
  if (!extra) return '—';
  try {
    const obj = typeof extra === 'string' ? JSON.parse(extra) : extra;
    if (typeof obj !== 'object' || obj === null) return fmtVal(obj);

    const oldVal = obj.old_value ?? obj.OLD_VALUE;
    const newVal = obj.new_value ?? obj.NEW_VALUE;

    const isBudget = eventType?.toLowerCase().includes('budget');

    if (oldVal !== undefined && newVal !== undefined) {
      if (isBudget) {
        const oldB = extractBudget(oldVal);
        const newB = extractBudget(newVal);
        if (oldB !== null && newB !== null && oldB > 0) {
          const pct = ((newB - oldB) / oldB * 100).toFixed(0);
          const arrow = newB > oldB ? '⬆' : '⬇';
          return `${fmtMoney(oldB)} → ${fmtMoney(newB)} (${arrow}${Math.abs(pct)}%)`;
        }
        if (oldB !== null && newB !== null) return `${fmtMoney(oldB)} → ${fmtMoney(newB)}`;
      }
      return `${fmtVal(oldVal)} → ${fmtVal(newVal)}`;
    }
    if (obj.new_status || obj.NEW_STATUS) {
      const s = obj.new_status || obj.NEW_STATUS;
      return STATUS_LABELS[s] || s;
    }
    if (isBudget) {
      const b = extractBudget(obj);
      if (b !== null) return fmtMoney(b);
    }
    return '—';
  } catch {
    return '—';
  }
}

function parseDate(eventTime) {
  if (!eventTime) return '—';
  // Meta returns either a Unix timestamp (number) or an ISO string
  const d = typeof eventTime === 'number'
    ? new Date(eventTime * 1000)
    : new Date(eventTime);
  if (isNaN(d.getTime())) return String(eventTime);
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function toCSV(activities) {
  const headers = ['Fecha', 'Tipo de cambio', 'Objeto', 'Tipo de objeto', 'Detalle', 'Actor'];
  const rows = activities.map((a) => [
    parseDate(a.event_time),
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
        timeout: 120000,
      });
      const all = res.data.activities || [];
      const manual = all.filter((a) => isManualEvent(a.event_type));
      setActivities(manual);
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
                  <td className="analyze-td--date">{parseDate(a.event_time)}</td>
                  <td><span className="analyze-tag">{labelEvent(a.event_type)}</span></td>
                  <td className="analyze-td--name">{a.object_name || '—'}</td>
                  <td className="analyze-td--type">{a.object_type || '—'}</td>
                  <td className="analyze-td--detail">{parseExtra(a.extra_data, a.event_type)}</td>
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
