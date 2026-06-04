import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../api/client.js';
import './Control.css';
import './Home.css';

const ALL_AMS = ['Todos', 'Juan Ignacio', 'Franco', 'Agustín', 'Chachi'];

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}
function daysElapsed() { return new Date().getDate(); }
function daysInMonth() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate(); }

function ClientCard({ c, onOpen }) {
  const health = c.health;
  const revGoal = parseFloat(c.goals?.revenue) || 0;
  const roasGoal = parseFloat(c.goals?.roas) || 0;
  const spend = health?.spend || 0;
  const purchaseValue = health?.purchaseValue || 0;
  const roas = health?.roas || 0;
  const revPct = revGoal > 0 ? Math.min((purchaseValue / revGoal) * 100, 999) : 0;
  const roasPct = roasGoal > 0 ? Math.min((roas / roasGoal) * 100, 999) : 0;
  const revStatus = revGoal > 0 ? (revPct >= 100 ? 'good' : revPct >= 70 ? 'warn' : 'bad') : null;
  const roasStatus = roasGoal > 0 ? (roas >= roasGoal ? 'good' : roas >= roasGoal * 0.7 ? 'warn' : 'bad') : null;

  let pace = null;
  if (revGoal > 0) {
    const expected = (revGoal / daysInMonth()) * daysElapsed();
    pace = { expected, pct: expected > 0 ? (purchaseValue / expected) * 100 : 0, onTrack: expected > 0 && (purchaseValue / expected) >= 0.9 };
  }

  return (
    <button className="hm-card" onClick={() => onOpen(c.slug)}>
      <div className="ctrl-card-head">
        <div className="ctrl-card-info">
          <div className="ctrl-card-brand">{c.name}</div>
          <div className="ctrl-card-am">👤 {c.am || '—'}</div>
        </div>
        <div className="ctrl-card-badges">
          {roasStatus && <span className={`ctrl-badge ctrl-badge--${roasStatus}`}>{roasStatus === 'good' ? 'En meta ROAS' : roasStatus === 'warn' ? 'ROAS cerca' : 'ROAS bajo'}</span>}
          {revStatus && <span className={`ctrl-badge ctrl-badge--${revStatus}`}>{revStatus === 'good' ? 'En meta fact.' : revStatus === 'warn' ? 'Fact. cerca' : 'Fact. baja'}</span>}
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
            <div className="ctrl-metric"><div className="ctrl-metric-label">ROAS</div><div className={`ctrl-metric-value ${roasStatus ? 'ctrl-metric-value--' + roasStatus : ''}`}>{roas > 0 ? roas.toFixed(2) + '×' : '—'}</div></div>
          </div>
          {pace && (
            <div className={`ctrl-pace ${pace.onTrack ? 'ctrl-pace--ok' : 'ctrl-pace--warn'}`}>
              {pace.onTrack ? `✓ En ritmo (día ${daysElapsed()}/${daysInMonth()})` : `⚠ Desviado — esperado ${fmtMoney(pace.expected)}`}
              <span className="ctrl-pace-pct">{pace.pct.toFixed(0)}%</span>
            </div>
          )}
          {(revGoal > 0 || roasGoal > 0) && (
            <div className="ctrl-goals">
              {revGoal > 0 && (
                <div className="ctrl-goal-row">
                  <div className="ctrl-goal-top"><span>Objetivo facturación</span><span>{revPct.toFixed(0)}%</span></div>
                  <div className="ctrl-bar"><div className={`ctrl-bar-fill ctrl-bar-fill--${revStatus || 'none'}`} style={{ width: Math.min(revPct, 100) + '%' }} /></div>
                </div>
              )}
              {roasGoal > 0 && (
                <div className="ctrl-goal-row">
                  <div className="ctrl-goal-top"><span>Objetivo ROAS</span><span>{roasPct.toFixed(0)}%</span></div>
                  <div className="ctrl-bar"><div className={`ctrl-bar-fill ctrl-bar-fill--${roasStatus || 'none'}`} style={{ width: Math.min(roasPct, 100) + '%' }} /></div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <div className="hm-card-cta">Abrir cliente →</div>
    </button>
  );
}

export default function Home({ onOpenClient, onOptimize, onNewClient }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAM, setSelectedAM] = useState('Todos');
  const [migrating, setMigrating] = useState(false);

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

  const migrate = () => {
    if (!window.confirm('Crear los clientes a partir de las marcas existentes? (no pisa los ya creados)')) return;
    setMigrating(true);
    apiClient.post('/admin/migrate-brands').then((r) => {
      alert(`Listo: ${r.data.created} creados, ${r.data.skipped} ya existían.`);
      load();
    }).catch((e) => alert(e.response?.data?.message || 'Error')).finally(() => setMigrating(false));
  };

  const visible = useMemo(() => clients.filter((c) => selectedAM === 'Todos' || c.am === selectedAM), [clients, selectedAM]);
  const monthName = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return (
    <div className="ctrl-page">
      <div className="ctrl-header">
        <div className="ctrl-header-top">
          <div>
            <div className="ctrl-brand">alquimia.</div>
            <div className="ctrl-eyebrow">Inicio · {monthName}</div>
            <h1 className="ctrl-title">Salud de los clientes</h1>
          </div>
          <div className="ctrl-header-actions">
            <button className="ctrl-btn" onClick={onOptimize}>⚡ Optimizar</button>
            <button className="ctrl-btn ctrl-btn--ghost" onClick={onNewClient}>+ Nuevo cliente</button>
            <button className="ctrl-btn ctrl-btn--ghost" onClick={load} disabled={loading}>{loading ? 'Cargando…' : 'Actualizar'}</button>
          </div>
        </div>
        <div className="ctrl-filters">
          <div className="ctrl-filter-group">
            <span className="ctrl-filter-label">Responsable</span>
            <div className="ctrl-filter-pills">
              {ALL_AMS.map((am) => (
                <button key={am} className={`ctrl-pill ${selectedAM === am ? 'ctrl-pill--active' : ''}`} onClick={() => setSelectedAM(am)}>{am}</button>
              ))}
            </div>
          </div>
          <button className="ctrl-btn ctrl-btn--ghost ctrl-btn--sm" onClick={migrate} disabled={migrating}>{migrating ? 'Migrando…' : 'Migrar marcas existentes'}</button>
        </div>
      </div>

      <div className="ctrl-divider" />

      {error && <div className="ctrl-error">⚠ {error}</div>}
      {loading && <div className="ctrl-loading">Consultando Meta…</div>}
      {!loading && visible.length === 0 && <div className="ctrl-loading">No hay clientes. Tocá "Migrar marcas existentes" o creá uno nuevo.</div>}

      <div className="ctrl-grid">
        {visible.map((c) => <ClientCard key={c.slug} c={c} onOpen={onOpenClient} />)}
      </div>
    </div>
  );
}
