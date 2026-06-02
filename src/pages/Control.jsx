import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../api/client.js';
import './Control.css';

/* ── Account manager mapping ── */
const ACCOUNT_MAP = [
  { metaName: 'CAMEO ADS 2025',                    brand: 'Cameo',              am: 'Juan Ignacio' },
  { metaName: 'Chung Thoma',                        brand: 'Cameo',              am: 'Juan Ignacio' },
  { metaName: '708620227018166',                    brand: 'Moka Knit',          am: 'Juan Ignacio' },
  { metaName: 'Viasek',                             brand: 'Viasek',             am: 'Juan Ignacio' },
  { metaName: 'ESTANCIAS_CHIRIPA_RHD_LINEA_PP_FA', brand: 'Estancias',          am: 'Juan Ignacio' },
  { metaName: 'Cuenta Vale',                        brand: 'Estancias',          am: 'Juan Ignacio' },
  { metaName: 'CENIDOR_073_RHD_LINEA_PP_FA',        brand: 'Cenidor',            am: 'Juan Ignacio' },
  { metaName: 'Uniq Chic 2024 EDM',                 brand: 'Uniq Chic',          am: 'Juan Ignacio' },
  { metaName: '366123282554987',                    brand: 'Deux',               am: 'Juan Ignacio' },
  { metaName: 'Bradley Jacovides',                  brand: 'Bradley Jacovides',  am: 'Juan Ignacio' },
  { metaName: 'Cuenta Publicitaria DUNKS',          brand: 'DUNKS',              am: 'Juan Ignacio' },
  { metaName: 'Offline Arg',                        brand: 'Offline Arg',        am: 'Juan Ignacio' },
  { metaName: 'tiger time arg',                     brand: 'Lucas Tiger Time',   am: 'Franco' },
  { metaName: 'Chenal',                             brand: 'Chenal',             am: 'Franco' },
  { metaName: 'Amalti ads',                         brand: 'Amalti',             am: 'Franco' },
  { metaName: 'Cero',                               brand: 'Somos Cero',         am: 'Franco' },
  { metaName: 'Cardinal Assistance',                brand: 'Cardinal Assistance',am: 'Franco' },
  { metaName: 'Cardinal Rent a Car',                brand: 'Cardinal Rent',      am: 'Franco' },
  { metaName: 'Proyecto Charcos (cuenta publicitaria)', brand: 'Proyecto Charcos', am: 'Agustín' },
  { metaName: '800869509584808',                     brand: 'Lateckel',           am: 'Agustín' },
  { metaName: 'La Teckel Ads',                      brand: 'Lateckel',           am: 'Agustín' },
  { metaName: 'Cueva Estudios',                     brand: 'Cuevas Estudio',     am: 'Agustín' },
  { metaName: 'DASHA- Cuenta publicitaria',         brand: 'Dasha Accesorios',   am: 'Chachi' },
];

function getAccountInfo(name, id) {
  const found = ACCOUNT_MAP.find(
    (a) =>
      a.metaName === name ||
      a.metaName === id ||
      name?.toLowerCase().includes(a.metaName.toLowerCase()) ||
      a.metaName.toLowerCase().includes(name?.toLowerCase())
  );
  return found || { brand: name, am: '—' };
}

const GOALS_KEY = 'alquimia_control_goals_v2';
const ALL_AMS = ['Todos', 'Juan Ignacio', 'Franco', 'Agustín', 'Chachi'];

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

/* días transcurridos en el mes actual */
function daysElapsed() {
  const now = new Date();
  return now.getDate();
}

function daysInMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

/* ── Alerta tendencia 4 días ── */
function trendAlert(dailyGoal, last4Spend) {
  if (!dailyGoal || dailyGoal <= 0) return null;
  const threshold = dailyGoal * 4 * 0.7;
  if (last4Spend < threshold) {
    return {
      expected: dailyGoal * 4,
      actual: last4Spend,
      threshold,
    };
  }
  return null;
}

/* ── Desvío de objetivo mensual ── */
function paceStatus(monthlyGoal, currentSpend) {
  if (!monthlyGoal || monthlyGoal <= 0) return null;
  const elapsed = daysElapsed();
  const total = daysInMonth();
  const expected = (monthlyGoal / total) * elapsed;
  const pct = (currentSpend / expected) * 100;
  return { expected, pct, onTrack: pct >= 90 };
}

/* ── Card de cuenta ── */
function AccountCard({ account, goal, onGoalChange }) {
  const info = getAccountInfo(account.name, account.id);
  const revGoal = parseFloat(goal?.revenue) || 0;
  const roasGoal = parseFloat(goal?.roas) || 0;
  const dailyGoal = revGoal > 0 ? revGoal / daysInMonth() : 0;

  const spend = account.spend || 0;
  const purchaseValue = account.purchaseValue || account.purchase_value || 0;
  const roas = spend > 0 ? purchaseValue / spend : 0;

  const revPct = revGoal > 0 ? Math.min((purchaseValue / revGoal) * 100, 999) : 0;
  const roasPct = roasGoal > 0 ? Math.min((roas / roasGoal) * 100, 999) : 0;

  const pace = paceStatus(revGoal, purchaseValue);
  const alert = trendAlert(dailyGoal, account.last4PurchaseValue || 0);

  const roasStatus = roasGoal > 0
    ? roas >= roasGoal ? 'good' : roas >= roasGoal * 0.7 ? 'warn' : 'bad'
    : null;

  const revStatus = revGoal > 0
    ? revPct >= 100 ? 'good' : revPct >= 70 ? 'warn' : 'bad'
    : null;

  return (
    <div className="ctrl-card">
      <div className="ctrl-card-head">
        <div className="ctrl-card-info">
          <div className="ctrl-card-brand">{info.brand}</div>
          <div className="ctrl-card-meta">{account.name} · {account.currency}</div>
          <div className="ctrl-card-am">👤 {info.am}</div>
        </div>
        <div className="ctrl-card-badges">
          {roasStatus && (
            <span className={`ctrl-badge ctrl-badge--${roasStatus}`}>
              {roasStatus === 'good' ? 'En meta ROAS' : roasStatus === 'warn' ? 'ROAS cerca' : 'ROAS bajo'}
            </span>
          )}
          {revStatus && (
            <span className={`ctrl-badge ctrl-badge--${revStatus}`}>
              {revStatus === 'good' ? 'En meta facturación' : revStatus === 'warn' ? 'Facturación cerca' : 'Facturación baja'}
            </span>
          )}
        </div>
      </div>

      {/* Métricas principales */}
      <div className="ctrl-metrics">
        <div className="ctrl-metric">
          <div className="ctrl-metric-label">Gasto</div>
          <div className="ctrl-metric-value">{fmtMoney(spend)}</div>
        </div>
        <div className="ctrl-metric">
          <div className="ctrl-metric-label">Valor compras</div>
          <div className="ctrl-metric-value">{purchaseValue ? fmtMoney(purchaseValue) : '—'}</div>
        </div>
        <div className="ctrl-metric">
          <div className="ctrl-metric-label">ROAS</div>
          <div className={`ctrl-metric-value ${roasStatus ? 'ctrl-metric-value--' + roasStatus : ''}`}>
            {roas > 0 ? roas.toFixed(2) + '×' : '—'}
          </div>
        </div>
      </div>

      {/* Desvío de objetivo */}
      {pace && (
        <div className={`ctrl-pace ${pace.onTrack ? 'ctrl-pace--ok' : 'ctrl-pace--warn'}`}>
          {pace.onTrack
            ? `✓ En ritmo — esperado al día ${daysElapsed()}: ${fmtMoney(pace.expected)}`
            : `⚠ Desviado — deberías estar en ${fmtMoney(pace.expected)} (día ${daysElapsed()}/${daysInMonth()})`
          }
          <span className="ctrl-pace-pct">{pace.pct.toFixed(0)}%</span>
        </div>
      )}

      {/* Alerta tendencia 4 días */}
      {alert && (
        <div className="ctrl-trend-alert">
          ⚠ OJO con la tendencia — últimos 4 días: {fmtMoney(alert.actual)} (mínimo esperado: {fmtMoney(alert.threshold)})
        </div>
      )}

      {/* Barras de objetivo */}
      <div className="ctrl-goals">
        <div className="ctrl-goal-row">
          <div className="ctrl-goal-top">
            <span>Objetivo facturación</span>
            <span>{revGoal > 0 ? revPct.toFixed(0) + '%' : '—'}</span>
          </div>
          <div className="ctrl-bar">
            <div
              className={`ctrl-bar-fill ctrl-bar-fill--${revStatus || 'none'}`}
              style={{ width: Math.min(revPct, 100) + '%' }}
            />
          </div>
          <div className="ctrl-goal-input">
            <label>Meta ARS</label>
            <input
              type="number"
              placeholder="ej. 5000000"
              value={goal?.revenue ?? ''}
              onChange={(e) => onGoalChange('revenue', e.target.value)}
            />
          </div>
        </div>

        <div className="ctrl-goal-row">
          <div className="ctrl-goal-top">
            <span>Objetivo ROAS</span>
            <span>{roasGoal > 0 ? roasPct.toFixed(0) + '%' : '—'}</span>
          </div>
          <div className="ctrl-bar">
            <div
              className={`ctrl-bar-fill ctrl-bar-fill--${roasStatus || 'none'}`}
              style={{ width: Math.min(roasPct, 100) + '%' }}
            />
          </div>
          <div className="ctrl-goal-input">
            <label>Meta ×</label>
            <input
              type="number"
              step="0.1"
              placeholder="ej. 3.5"
              value={goal?.roas ?? ''}
              onChange={(e) => onGoalChange('roas', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Página principal de Control ── */
export default function Control({ onBack }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [goals, setGoals] = useState(() => {
    try { return JSON.parse(localStorage.getItem(GOALS_KEY)) || {}; } catch { return {}; }
  });

  // Filtros
  const [selectedAM, setSelectedAM] = useState('Todos');
  const [hiddenAccounts, setHiddenAccounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ctrl_hidden_accounts')) || []; } catch { return []; }
  });
  const [showAccountFilter, setShowAccountFilter] = useState(false);

  const saveGoals = useCallback((next) => {
    setGoals(next);
    localStorage.setItem(GOALS_KEY, JSON.stringify(next));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/accounts');
      const raw = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.accounts) ? res.data.accounts : [];

      // Para cada cuenta pedimos insights del mes actual
      const withMetrics = await Promise.all(
        raw.map(async (acc) => {
          try {
            const ins = await apiClient.get(`/accounts/${acc.id}/insights/monthly`);
            return { ...acc, ...ins.data };
          } catch {
            return { ...acc, spend: 0, purchaseValue: 0, last4Spend: 0 };
          }
        })
      );
      setAccounts(withMetrics);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las cuentas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function setGoal(accountId, field, value) {
    const next = {
      ...goals,
      [accountId]: { ...(goals[accountId] || {}), [field]: value === '' ? '' : parseFloat(value) },
    };
    saveGoals(next);
  }

  function toggleAccount(id) {
    const next = hiddenAccounts.includes(id)
      ? hiddenAccounts.filter((x) => x !== id)
      : [...hiddenAccounts, id];
    setHiddenAccounts(next);
    localStorage.setItem('ctrl_hidden_accounts', JSON.stringify(next));
  }

  const visible = useMemo(() => {
    return accounts.filter((acc) => {
      if (hiddenAccounts.includes(acc.id)) return false;
      if (selectedAM !== 'Todos') {
        const info = getAccountInfo(acc.name, acc.id);
        if (info.am !== selectedAM) return false;
      }
      return true;
    });
  }, [accounts, hiddenAccounts, selectedAM]);

  const monthName = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return (
    <div className="ctrl-page">
      {/* Header */}
      <div className="ctrl-header">
        <div className="ctrl-header-top">
          <div>
            <div className="ctrl-brand">alquimia.</div>
            <div className="ctrl-eyebrow">Control · {monthName}</div>
            <h1 className="ctrl-title">Rendimiento del mes</h1>
          </div>
          <div className="ctrl-header-actions">
            <button className="ctrl-btn" onClick={load} disabled={loading}>
              {loading ? 'Cargando…' : 'Actualizar'}
            </button>
            <button className="ctrl-btn ctrl-btn--ghost" onClick={onBack}>← Volver</button>
          </div>
        </div>

        {/* Filtros */}
        <div className="ctrl-filters">
          <div className="ctrl-filter-group">
            <span className="ctrl-filter-label">Responsable</span>
            <div className="ctrl-filter-pills">
              {ALL_AMS.map((am) => (
                <button
                  key={am}
                  className={`ctrl-pill ${selectedAM === am ? 'ctrl-pill--active' : ''}`}
                  onClick={() => setSelectedAM(am)}
                >
                  {am}
                </button>
              ))}
            </div>
          </div>

          <div className="ctrl-filter-group">
            <button
              className="ctrl-btn ctrl-btn--ghost ctrl-btn--sm"
              onClick={() => setShowAccountFilter(!showAccountFilter)}
            >
              {showAccountFilter ? 'Ocultar filtro cuentas' : 'Filtrar cuentas'}
            </button>
          </div>
        </div>

        {showAccountFilter && (
          <div className="ctrl-account-filter">
            <div className="ctrl-account-filter-title">Mostrar / ocultar cuentas</div>
            <div className="ctrl-account-checkboxes">
              {accounts.map((acc) => {
                const info = getAccountInfo(acc.name, acc.id);
                const hidden = hiddenAccounts.includes(acc.id);
                return (
                  <label key={acc.id} className="ctrl-checkbox-label">
                    <input
                      type="checkbox"
                      checked={!hidden}
                      onChange={() => toggleAccount(acc.id)}
                    />
                    <span>{info.brand}</span>
                    <span className="ctrl-checkbox-am">({info.am})</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="ctrl-divider" />

      {/* Contenido */}
      {error && <div className="ctrl-error">⚠ {error}</div>}
      {loading && <div className="ctrl-loading">Consultando Meta…</div>}

      {!loading && visible.length === 0 && (
        <div className="ctrl-loading">No hay cuentas para mostrar.</div>
      )}

      <div className="ctrl-grid">
        {visible.map((acc) => (
          <AccountCard
            key={acc.id}
            account={acc}
            goal={goals[acc.id] || {}}
            onGoalChange={(field, val) => setGoal(acc.id, field, val)}
          />
        ))}
      </div>
    </div>
  );
}
