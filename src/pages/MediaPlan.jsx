import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client.js';
import './Admin.css';
import './MediaPlan.css';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fmtMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const n = MESES[parseInt(m, 10) - 1] || ym;
  return `${n.charAt(0).toUpperCase() + n.slice(1)} ${y}`;
}
function currentYM() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}
function money(n) {
  if (n == null || isNaN(n) || n === 0) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

const blank = () => ({
  clientInput: '',
  lastMonth: { facturacion: 0, inversion: 0, roas: 0 },
  considerations: [''],
  analysis: { last3: '', lastYear: '', stock: '', benchmark: '' },
  objective: { facturacion: 0, roas: 0 },
  explanation: '',
});

export default function MediaPlan({ onBack }) {
  const [clients, setClients] = useState([]);
  const [slug, setSlug] = useState('');
  const [months, setMonths] = useState([]);
  const [month, setMonth] = useState('');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    apiClient.get('/admin/clients').then((r) => {
      setClients(r.data.clients || []);
      if (r.data.clients?.[0]) setSlug(r.data.clients[0].slug);
    }).catch(() => {});
  }, []);

  const loadMonths = useCallback((s) => {
    apiClient.get(`/admin/${s}/media-months`).then((r) => {
      const ms = r.data.months || [];
      setMonths(ms);
      setMonth(ms.includes(currentYM()) ? currentYM() : (ms[0] || currentYM()));
    }).catch(() => { setMonths([]); setMonth(currentYM()); });
  }, []);

  useEffect(() => { if (slug) loadMonths(slug); }, [slug, loadMonths]);

  useEffect(() => {
    if (!slug || !month) return;
    setLoading(true);
    apiClient.get(`/admin/${slug}/media/${month}`)
      .then((r) => setPlan(r.data.plan || blank()))
      .catch(() => setPlan(blank()))
      .finally(() => setLoading(false));
  }, [slug, month]);

  const upd = (fn) => setPlan((p) => { const n = structuredClone(p); fn(n); return n; });

  const save = () => {
    setMsg('Guardando…');
    apiClient.put(`/admin/${slug}/media/${month}`, { plan })
      .then(() => { setMsg('✓ Guardado'); if (!months.includes(month)) setMonths((m) => [month, ...m]); setTimeout(() => setMsg(''), 2000); })
      .catch(() => setMsg('Error al guardar'));
  };

  const newMonth = () => {
    const to = prompt('Mes del plan. Formato AAAA-MM (ej. 2026-07)');
    if (!to) return;
    setMonth(to); setPlan(blank());
  };

  const inv = plan && plan.objective.roas > 0 ? plan.objective.facturacion / plan.objective.roas : 0;

  return (
    <div className="ad-page">
      <header className="ad-header">
        <div>
          <div className="ad-brand">alquimia.</div>
          <div className="ad-eyebrow">Plan de medios</div>
        </div>
        <button className="ad-btn ad-btn--ghost" onClick={onBack}>← Volver</button>
      </header>

      <div className="ad-controls">
        <div className="ad-field">
          <label>Cliente</label>
          <select value={slug} onChange={(e) => setSlug(e.target.value)}>
            {clients.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div className="ad-field">
          <label>Mes del plan</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {!months.includes(month) && month && <option value={month}>{fmtMonth(month)} (nuevo)</option>}
            {months.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          </select>
        </div>
        <button className="ad-btn ad-btn--ghost" onClick={newMonth}>+ Nuevo mes</button>
        <div className="ad-save">
          {msg && <span className="ad-msg">{msg}</span>}
          <button className="ad-btn" onClick={save} disabled={!plan}>Guardar plan de medios</button>
        </div>
      </div>

      {loading && <p className="ad-muted">Cargando…</p>}

      {plan && !loading && (
        <div className="ad-plan">
          <Section title="1 · Qué pidió el cliente">
            <Area value={plan.clientInput} onChange={(v) => upd((p) => { p.clientInput = v; })} ph="Qué busca el cliente este mes (volumen, acciones, eventos, etc.)" />
          </Section>

          <Section title="2 · Cómo nos fue el mes pasado">
            <div className="ad-row">
              <Num label="Facturación (ARS)" value={plan.lastMonth.facturacion} onChange={(v) => upd((p) => { p.lastMonth.facturacion = v; })} />
              <Num label="Inversión en pauta (ARS)" value={plan.lastMonth.inversion} onChange={(v) => upd((p) => { p.lastMonth.inversion = v; })} />
              <Num label="ROAS" value={plan.lastMonth.roas} onChange={(v) => upd((p) => { p.lastMonth.roas = v; })} />
            </div>
          </Section>

          <Section title="3 · Contexto y consideraciones">
            {(plan.considerations || []).map((c, i) => (
              <div key={i} className="ad-row">
                <Input label={`Punto ${i + 1}`} value={c} onChange={(v) => upd((p) => { p.considerations[i] = v; })} />
                <button className="ad-del" onClick={() => upd((p) => { p.considerations.splice(i, 1); })}>×</button>
              </div>
            ))}
            <button className="ad-add" onClick={() => upd((p) => { p.considerations = p.considerations || []; p.considerations.push(''); })}>+ Consideración</button>
          </Section>

          <Section title="4 · Análisis para definir el objetivo">
            <Area label="Tendencia últimos 3 meses" value={plan.analysis.last3} onChange={(v) => upd((p) => { p.analysis.last3 = v; })} />
            <Area label="Mismo período del año pasado" value={plan.analysis.lastYear} onChange={(v) => upd((p) => { p.analysis.lastYear = v; })} />
            <Area label="Stock / reposición disponible" value={plan.analysis.stock} onChange={(v) => upd((p) => { p.analysis.stock = v; })} />
            <Area label="Benchmark / contexto" value={plan.analysis.benchmark} onChange={(v) => upd((p) => { p.analysis.benchmark = v; })} />
          </Section>

          <Section title="5 · Objetivo propuesto">
            <div className="ad-row">
              <Num label="Facturación objetivo (ARS)" value={plan.objective.facturacion} onChange={(v) => upd((p) => { p.objective.facturacion = v; })} />
              <Num label="ROAS objetivo (×)" value={plan.objective.roas} onChange={(v) => upd((p) => { p.objective.roas = v; })} />
            </div>
            <div className="mp-calc">
              Inversión en pauta necesaria (facturación ÷ ROAS): <strong>{money(inv)}</strong>
            </div>
          </Section>

          <Section title="6 · Explicación / justificación">
            <Area value={plan.explanation} onChange={(v) => upd((p) => { p.explanation = v; })} ph="Por qué el objetivo es viable (estacionalidad, stock, acciones, contenido, estrategia…)" />
          </Section>

          <div className="mp-disclaimer">⚠ Esto es una proyección, no una garantía.</div>

          <div className="ad-save-bottom">
            {msg && <span className="ad-msg">{msg}</span>}
            <button className="ad-btn" onClick={save}>Guardar plan de medios</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return <section className="ad-section"><h3 className="ad-section-title">{title}</h3>{children}</section>;
}
function Input({ label, value, onChange }) {
  return <div className="ad-field ad-field--grow"><label>{label}</label><input value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}
function Area({ label, value, onChange, ph }) {
  return <div className="ad-field ad-field--grow"><label>{label || ''}</label><textarea value={value} placeholder={ph || ''} onChange={(e) => onChange(e.target.value)} /></div>;
}
function Num({ label, value, onChange }) {
  return <div className="ad-field"><label>{label}</label><input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))} /></div>;
}
