import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import './Control.css';
import './Home.css';

const ALL_AMS = ['Todos', 'Juan Ignacio', 'Franco', 'Agustín', 'Chachi'];
const TYPES = [
  { k: 'todos', l: 'Ver todos' },
  { k: 'ecommerce', l: 'Ecommerce' },
  { k: 'servicios', l: 'Servicios' },
];

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}
function daysInMonth() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate(); }
// Días transcurridos "efectivos" para el ritmo: días completos (hasta ayer) + fracción de hoy.
// La fracción arranca a las 10am y llega a 1 a las 22hs → a la mañana no figurás atrasado por un día.
function elapsedPace() {
  const now = new Date();
  const todayFrac = Math.min(1, Math.max(0, (now.getHours() + now.getMinutes() / 60 - 10) / 12));
  return Math.max(0, now.getDate() - 1) + todayFrac;
}

// Bandas de estado según el ratio (valor / objetivo).
function statusByRatio(r) {
  if (r == null || !isFinite(r)) return null;
  if (r >= 1.10) return { key: 'margen', label: 'En objetivo y con margen', color: '#166534', bg: '#bbf7d0' };
  if (r >= 1.00) return { key: 'objetivo', label: 'En objetivo', color: '#15803d', bg: '#dcfce7' };
  if (r >= 0.80) return { key: 'cerca', label: 'Cerca', color: '#a16207', bg: '#fef9c3' };
  if (r >= 0.70) return { key: 'alejado', label: 'Alejado', color: '#c2410c', bg: '#ffedd5' };
  return { key: 'emergencia', label: 'Emergencia', color: '#b91c1c', bg: '#fee2e2' };
}
// Etiquetas distintas por métrica: en ROAS "con margen" tiene sentido; en facturación es "adelantada".
function bandLabel(key, kind) {
  const fact = { margen: 'Adelantada', objetivo: 'En objetivo', cerca: 'Cerca', alejado: 'Alejada', emergencia: 'Emergencia' };
  const roas = { margen: 'En objetivo y con margen', objetivo: 'En objetivo', cerca: 'Cerca', alejado: 'Alejado', emergencia: 'Emergencia' };
  return (kind === 'fact' ? fact : roas)[key] || '';
}
function Badge({ band, prefix, kind }) {
  if (!band) return null;
  return <span className="hm-badge" style={{ color: band.color, background: band.bg }}>{prefix ? `${prefix} ` : ''}{bandLabel(band.key, kind)}</span>;
}

function ClientCard({ c, onOpen }) {
  const health = c.health;
  const revGoal = parseFloat(c.goals?.revenue) || 0;
  const roasGoal = parseFloat(c.goals?.roas) || 0;
  const spend = health?.spend || 0;
  const purchaseValue = health?.purchaseValue || 0;
  const roas = health?.roas || 0;

  const expected = revGoal > 0 ? (revGoal / daysInMonth()) * elapsedPace() : 0;
  // Desvío: cuánto te alejaste del esperado (no el % del 100). Ej: vas 100, debías 150 → -33%.
  const dev = expected > 0 ? ((purchaseValue - expected) / expected) * 100 : null;
  const roasBand = roasGoal > 0 && health ? statusByRatio(roas / roasGoal) : null;
  const paceBand = expected > 0 && health ? statusByRatio(purchaseValue / expected) : null;
  const revPct = revGoal > 0 ? Math.min((purchaseValue / revGoal) * 100, 999) : 0;

  return (
    <button className="hm-card" onClick={() => onOpen(c.slug)}>
      <div className="ctrl-card-head">
        <div className="ctrl-card-info">
          <div className="ctrl-card-brand">{c.name}</div>
          <div className="ctrl-card-am">👤 {c.am || '—'} · {c.type === 'servicios' ? 'Servicios' : 'Ecommerce'}</div>
        </div>
        <div className="ctrl-card-badges">
          <Badge band={roasBand} prefix="ROAS" kind="roas" />
          <Badge band={paceBand} prefix="Fact." kind="fact" />
        </div>
      </div>

      {!c.metaAccountId ? (
        <div className="hm-noaccount">Sin cuenta de Meta asignada · entrá y asignala en Admin</div>
      ) : !health ? (
        <div className="hm-noaccount">No se pudieron traer las métricas.</div>
      ) : (
        <>
          <div className="ctrl-metrics">
            <div className="ctrl-metric"><div className="ctrl-metric-label">Gasto</div><div className="ctrl-metric-value">{fmtMoney(spend)}</div></div>
            <div className="ctrl-metric"><div className="ctrl-metric-label">Valor compras</div><div className="ctrl-metric-value">{purchaseValue ? fmtMoney(purchaseValue) : '—'}</div></div>
            <div className="ctrl-metric"><div className="ctrl-metric-label">ROAS</div><div className="ctrl-metric-value" style={roasBand ? { color: roasBand.color } : undefined}>{roas > 0 ? roas.toFixed(2) + '×' : '—'}</div></div>
          </div>
          {paceBand && (
            <div className="hm-pace" style={{ background: paceBand.bg, color: paceBand.color }}>
              <span>
                {dev >= 0
                  ? `✓ Adelantado un ${dev.toFixed(0)}% sobre el ritmo`
                  : `⚠ Te desviaste un ${Math.abs(dev).toFixed(0)}% del ritmo`}
                <span className="hm-pace-exp"> · esperado {fmtMoney(expected)}</span>
              </span>
            </div>
          )}
          {revGoal > 0 && (
            <div className="ctrl-goals">
              <div className="ctrl-goal-row">
                <div className="ctrl-goal-top"><span>Objetivo facturación</span><span>{revPct.toFixed(0)}%</span></div>
                <div className="ctrl-bar"><div className="ctrl-bar-fill" style={{ width: Math.min(revPct, 100) + '%', background: (paceBand || {}).color }} /></div>
              </div>
            </div>
          )}
        </>
      )}
      <div className="hm-card-cta">Abrir cliente →</div>
    </button>
  );
}

export default function Home({ onOpenClient, onOptimize, onNewClient }) {
  const { logout } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAM, setSelectedAM] = useState('Todos');
  const [type, setType] = useState('todos');
  const [showHide, setShowHide] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try { return JSON.parse(localStorage.getItem('home_hidden_clients')) || []; } catch { return []; }
  });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiClient.get('/admin/overview');
      setClients(res.data.clients || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'No se pudo cargar.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleHidden = (slug) => {
    setHidden((h) => {
      const next = h.includes(slug) ? h.filter((s) => s !== slug) : [...h, slug];
      localStorage.setItem('home_hidden_clients', JSON.stringify(next));
      return next;
    });
  };

  const visible = useMemo(() => clients.filter((c) => {
    if (hidden.includes(c.slug)) return false;
    if (selectedAM !== 'Todos' && c.am !== selectedAM) return false;
    if (type !== 'todos' && (c.type || 'ecommerce') !== type) return false;
    return true;
  }), [clients, hidden, selectedAM, type]);

  return (
    <div className="ctrl-page">
      <div className="ctrl-header">
        <div className="ctrl-header-top">
          <div>
            <div className="ctrl-brand ctrl-brand--lg">alquimia.</div>
          </div>
          <div className="ctrl-header-actions">
            <button className="ctrl-btn" onClick={onOptimize}>⚡ Optimizar</button>
            <button className="ctrl-btn ctrl-btn--ghost" onClick={load} disabled={loading}>{loading ? 'Cargando…' : 'Actualizar'}</button>
            <button className="ctrl-btn ctrl-btn--ghost" onClick={logout}>Cerrar sesión</button>
          </div>
        </div>
        <div className="ctrl-filters">
          <div className="ctrl-filter-group">
            <span className="ctrl-filter-label">Tipo</span>
            <div className="ctrl-filter-pills">
              {TYPES.map((t) => (
                <button key={t.k} className={`ctrl-pill ${type === t.k ? 'ctrl-pill--active' : ''}`} onClick={() => setType(t.k)}>{t.l}</button>
              ))}
            </div>
          </div>
          <div className="ctrl-filter-group">
            <span className="ctrl-filter-label">Responsable</span>
            <div className="ctrl-filter-pills">
              {ALL_AMS.map((am) => (
                <button key={am} className={`ctrl-pill ${selectedAM === am ? 'ctrl-pill--active' : ''}`} onClick={() => setSelectedAM(am)}>{am}</button>
              ))}
            </div>
          </div>
          <div className="ctrl-filters-right">
            <button className="ctrl-btn ctrl-btn--ghost ctrl-btn--sm" onClick={onNewClient}>+ Nuevo cliente</button>
            <button className="ctrl-btn ctrl-btn--ghost ctrl-btn--sm" onClick={() => setShowHide((v) => !v)}>
              {showHide ? 'Cerrar filtro' : `Filtrar clientes${hidden.length ? ` (${hidden.length})` : ''}`}
            </button>
          </div>
        </div>

        {showHide && (
          <div className="hm-hide-panel">
            <div className="hm-hide-title">Mostrar / ocultar marcas</div>
            <div className="hm-hide-grid">
              {clients.map((c) => (
                <label key={c.slug} className="hm-hide-item">
                  <input type="checkbox" checked={!hidden.includes(c.slug)} onChange={() => toggleHidden(c.slug)} />
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="ctrl-divider" />

      {error && <div className="ctrl-error">⚠ {error}</div>}
      {loading && <div className="ctrl-loading">Consultando Meta…</div>}
      {!loading && visible.length === 0 && <div className="ctrl-loading">No hay clientes para mostrar. Creá uno con "+ Nuevo cliente".</div>}

      <div className="ctrl-grid">
        {visible.map((c) => <ClientCard key={c.slug} c={c} onOpen={onOpenClient} />)}
      </div>
    </div>
  );
}
