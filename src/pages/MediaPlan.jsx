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

// ---- Modelo del plan ----
const SERIES = [
  { key: 'roas', label: 'ROAS', color: '#1b1fe8', fmt: (v) => `${v}×` },
  { key: 'ventas', label: 'Ventas (u)', color: '#16a34a', fmt: (v) => new Intl.NumberFormat('es-AR').format(v) },
  { key: 'facturacion', label: 'Facturación', color: '#f59e0b', fmt: (v) => money(v) },
];

const blank = () => ({
  // INTERNO
  clientInput: '',
  lastMonthMeta: { facturacion: 0, inversion: 0, roas: 0 },
  lastYearMeta: { facturacion: 0, inversion: 0, roas: 0 },
  trend: [
    { label: '', roas: 0, ventas: 0, facturacion: 0 },
    { label: '', roas: 0, ventas: 0, facturacion: 0 },
    { label: '', roas: 0, ventas: 0, facturacion: 0 },
  ],
  trendNote: '',
  context: { dates: '', products: '' },
  considerations: [''],
  // ENTREGABLE (siempre arriba)
  objective: { facturacion: 0, roas: 0 },
  explanation: '',
  // Qué se muestra al cliente
  include: {
    clientInput: false,
    lastMonthMeta: true,
    lastYearMeta: false,
    trend: true,
    context: true,
    considerations: true,
    explanation: true,
  },
});

function normalize(raw) {
  const b = blank();
  const p = raw || {};
  return {
    ...b,
    ...p,
    lastMonthMeta: { ...b.lastMonthMeta, ...(p.lastMonthMeta || p.lastMonth || {}) },
    lastYearMeta: { ...b.lastYearMeta, ...(p.lastYearMeta || {}) },
    trend: Array.isArray(p.trend) && p.trend.length ? p.trend : b.trend,
    context: { ...b.context, ...(p.context || {}) },
    considerations: Array.isArray(p.considerations) ? p.considerations : b.considerations,
    objective: { ...b.objective, ...(p.objective || {}) },
    include: { ...b.include, ...(p.include || {}) },
  };
}

// ---- Gráfico de tendencia (SVG puro, reutilizable en pantalla y PDF) ----
function buildTrendSvg(points, { w = 620, h = 230 } = {}) {
  const pts = (points || []).filter((p) => (p.label || '').trim() || p.roas || p.ventas || p.facturacion);
  if (pts.length < 2) return '';
  const padL = 16, padR = 16, padT = 20, padB = 34;
  const cw = w - padL - padR, ch = h - padT - padB;
  const n = pts.length;
  const x = (i) => padL + (n === 1 ? cw / 2 : (cw * i) / (n - 1));

  let body = '';
  for (const s of SERIES) {
    const vals = pts.map((p) => Number(p[s.key]) || 0);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    const y = (v) => padT + (1 - (v - min) / range) * ch;
    const coords = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    body += `<polyline fill="none" stroke="${s.color}" stroke-width="2.5" points="${coords.join(' ')}" />`;
    coords.forEach((c, i) => {
      const [cx, cy] = c.split(',');
      body += `<circle cx="${cx}" cy="${cy}" r="3.2" fill="${s.color}" />`;
      body += `<text x="${cx}" y="${(parseFloat(cy) - 7).toFixed(1)}" font-size="9" fill="${s.color}" text-anchor="middle" font-family="monospace">${s.fmt(vals[i])}</text>`;
    });
  }
  // etiquetas de mes
  let labels = '';
  pts.forEach((p, i) => {
    labels += `<text x="${x(i).toFixed(1)}" y="${h - 14}" font-size="11" fill="#5b5e66" text-anchor="middle">${(p.label || `Mes ${i + 1}`)}</text>`;
  });
  // leyenda
  let legend = '';
  SERIES.forEach((s, i) => {
    const lx = padL + i * 150;
    legend += `<rect x="${lx}" y="2" width="10" height="10" rx="2" fill="${s.color}" /><text x="${lx + 15}" y="11" font-size="10" fill="#15161a" font-family="monospace">${s.label}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg">${legend}${body}${labels}</svg>`;
}

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
      .then((r) => setPlan(normalize(r.data.plan)))
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

  const exportPdf = () => {
    if (!plan) return;
    const clientName = clients.find((c) => c.slug === slug)?.name || slug;
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inc = plan.include;
    const cons = (plan.considerations || []).filter((c) => c.trim()).map((c) => `<li>${esc(c)}</li>`).join('');

    const sections = [];
    if (inc.clientInput && plan.clientInput?.trim())
      sections.push(`<div class="sec"><div class="sec-t">Qué pedimos resolver este mes</div><div class="txt">${esc(plan.clientInput)}</div></div>`);
    if (inc.lastMonthMeta)
      sections.push(`<div class="sec"><div class="sec-t">Cómo nos fue el mes pasado</div><div class="kpis">
        <div class="kpi"><div class="lbl">Facturación</div><div class="val">${money(plan.lastMonthMeta.facturacion)}</div></div>
        <div class="kpi"><div class="lbl">Inversión pauta</div><div class="val">${money(plan.lastMonthMeta.inversion)}</div></div>
        <div class="kpi"><div class="lbl">ROAS</div><div class="val">${plan.lastMonthMeta.roas || '—'}×</div></div></div></div>`);
    if (inc.lastYearMeta)
      sections.push(`<div class="sec"><div class="sec-t">Mismo período del año pasado</div><div class="kpis">
        <div class="kpi"><div class="lbl">Facturación</div><div class="val">${money(plan.lastYearMeta.facturacion)}</div></div>
        <div class="kpi"><div class="lbl">Inversión pauta</div><div class="val">${money(plan.lastYearMeta.inversion)}</div></div>
        <div class="kpi"><div class="lbl">ROAS</div><div class="val">${plan.lastYearMeta.roas || '—'}×</div></div></div></div>`);
    if (inc.trend) {
      const svg = buildTrendSvg(plan.trend);
      if (svg) sections.push(`<div class="sec"><div class="sec-t">Tendencia últimos 3 meses (Meta)</div><div class="chart">${svg}</div>${plan.trendNote?.trim() ? `<div class="txt" style="margin-top:8px">${esc(plan.trendNote)}</div>` : ''}</div>`);
    }
    if (inc.context && (plan.context.dates?.trim() || plan.context.products?.trim())) {
      let c = '';
      if (plan.context.dates?.trim()) c += `<div class="block"><div class="lbl">Fechas importantes del mes</div><div class="txt">${esc(plan.context.dates)}</div></div>`;
      if (plan.context.products?.trim()) c += `<div class="block"><div class="lbl">Stock y reposición de productos clave</div><div class="txt">${esc(plan.context.products)}</div></div>`;
      sections.push(`<div class="sec"><div class="sec-t">Contexto</div>${c}</div>`);
    }
    if (inc.considerations && cons)
      sections.push(`<div class="sec"><div class="sec-t">Consideraciones</div><ul>${cons}</ul></div>`);
    if (inc.explanation && plan.explanation?.trim())
      sections.push(`<div class="sec"><div class="sec-t">Por qué este objetivo</div><div class="txt">${esc(plan.explanation)}</div></div>`);

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>Plan de medios — ${esc(clientName)} ${esc(fmtMonth(month))}</title>
    <style>
      @page { margin: 36px; }
      * { box-sizing: border-box; }
      body { font-family: -apple-system, system-ui, Helvetica, Arial, sans-serif; color: #15161a; margin: 0; padding: 40px; line-height: 1.5; }
      .brand { font-family: 'SF Mono', Menlo, Consolas, monospace; color: #1b1fe8; font-weight: 700; font-size: 15px; letter-spacing: 0.04em; }
      .eyebrow { font-family: 'SF Mono', Menlo, Consolas, monospace; text-transform: uppercase; letter-spacing: 0.1em; font-size: 11px; color: #8a8d96; margin-top: 4px; }
      h1 { font-size: 30px; margin: 6px 0 2px; }
      .sub { color: #5b5e66; font-size: 14px; margin-bottom: 22px; }
      .rule { height: 3px; background: #15161a; margin: 14px 0 24px; }
      .sec { margin-bottom: 22px; page-break-inside: avoid; }
      .sec-t { font-family: 'SF Mono', Menlo, Consolas, monospace; text-transform: uppercase; letter-spacing: 0.05em; font-size: 13px; font-weight: 700; border-bottom: 2px solid #15161a; padding-bottom: 5px; margin-bottom: 10px; }
      .txt { white-space: pre-wrap; font-size: 14px; }
      .block { margin-bottom: 10px; }
      .lbl { font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #8a8d96; margin-bottom: 2px; }
      ul { margin: 0; padding-left: 18px; } li { font-size: 14px; margin-bottom: 4px; }
      .kpis { display: flex; gap: 12px; }
      .kpi { flex: 1; border: 1.5px solid #e5e6ea; border-radius: 12px; padding: 14px; }
      .kpi .lbl { margin-bottom: 6px; } .kpi .val { font-size: 20px; font-weight: 700; }
      .chart { border: 1.5px solid #e5e6ea; border-radius: 12px; padding: 12px; }
      .obj { background: #1b1fe8; color: #fff; border-radius: 14px; padding: 20px; display: flex; gap: 20px; margin-bottom: 26px; }
      .obj .val { font-size: 24px; font-weight: 700; } .obj .lbl { color: #c7c9ff; }
      .disc { background: #fef9c3; color: #854d0e; border-radius: 10px; padding: 12px 16px; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 12px; font-weight: 600; margin-top: 22px; }
      .foot { margin-top: 28px; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 10px; color: #b0b2ba; text-align: center; }
    </style></head><body>
      <div class="brand">alquimia.</div>
      <div class="eyebrow">Plan de medios</div>
      <h1>${esc(clientName)}</h1>
      <div class="sub">${esc(fmtMonth(month))}</div>
      <div class="rule"></div>

      <div class="sec"><div class="sec-t">Objetivo propuesto</div>
        <div class="obj">
          <div><div class="lbl">Facturación objetivo</div><div class="val">${money(plan.objective.facturacion)}</div></div>
          <div><div class="lbl">ROAS objetivo</div><div class="val">${plan.objective.roas || '—'}×</div></div>
          <div><div class="lbl">Inversión necesaria</div><div class="val">${money(inv)}</div></div>
        </div>
      </div>

      ${sections.join('')}

      <div class="disc">⚠ Esto es una proyección, no una garantía.</div>
      <div class="foot">Generado por alquimia. · ${new Date().toLocaleDateString('es-AR')}</div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Permití las ventanas emergentes para exportar el PDF.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const tgl = (key) => upd((p) => { p.include[key] = !p.include[key]; });

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
          <button className="ad-btn ad-btn--ghost" onClick={exportPdf} disabled={!plan}>Exportar PDF</button>
          <button className="ad-btn" onClick={save} disabled={!plan}>Guardar plan de medios</button>
        </div>
      </div>

      {loading && <p className="ad-muted">Cargando…</p>}

      {plan && !loading && (
        <div className="ad-plan">
          {/* OBJETIVO — primero, va arriba del entregable */}
          <Section title="Objetivo propuesto" tone="objective">
            <div className="ad-row">
              <Num label="Facturación objetivo (ARS)" value={plan.objective.facturacion} onChange={(v) => upd((p) => { p.objective.facturacion = v; })} />
              <Num label="ROAS objetivo (×)" value={plan.objective.roas} onChange={(v) => upd((p) => { p.objective.roas = v; })} />
            </div>
            <div className="mp-calc">
              Inversión en pauta necesaria (facturación ÷ ROAS): <strong>{money(inv)}</strong>
            </div>
            <Area label="Por qué este objetivo (explicación)" value={plan.explanation} onChange={(v) => upd((p) => { p.explanation = v; })} ph="Por qué el objetivo es viable (estacionalidad, stock, acciones, contenido, estrategia…)" />
            <ShowToggle on={plan.include.explanation} onClick={() => tgl('explanation')} label="Mostrar la explicación al cliente" />
          </Section>

          <div className="mp-internal-banner">
            ↓ Lo de abajo es <strong>trabajo interno</strong> para definir el objetivo. Solo aparece en el entregable lo que tildes con <em>"Mostrar al cliente"</em>.
          </div>

          <Section title="Qué pidió el cliente" internal include={plan.include.clientInput} onToggle={() => tgl('clientInput')}>
            <Area value={plan.clientInput} onChange={(v) => upd((p) => { p.clientInput = v; })} ph="Qué busca el cliente este mes (volumen, acciones, eventos, etc.)" />
          </Section>

          <Section title="Cómo nos fue el mes pasado (Meta)" internal include={plan.include.lastMonthMeta} onToggle={() => tgl('lastMonthMeta')}>
            <div className="ad-row">
              <Num label="Facturación (ARS)" value={plan.lastMonthMeta.facturacion} onChange={(v) => upd((p) => { p.lastMonthMeta.facturacion = v; })} />
              <Num label="Inversión en pauta (ARS)" value={plan.lastMonthMeta.inversion} onChange={(v) => upd((p) => { p.lastMonthMeta.inversion = v; })} />
              <Num label="ROAS" value={plan.lastMonthMeta.roas} onChange={(v) => upd((p) => { p.lastMonthMeta.roas = v; })} />
            </div>
          </Section>

          <Section title="Mismo período del año pasado (Meta)" internal include={plan.include.lastYearMeta} onToggle={() => tgl('lastYearMeta')}>
            <div className="ad-row">
              <Num label="Facturación (ARS)" value={plan.lastYearMeta.facturacion} onChange={(v) => upd((p) => { p.lastYearMeta.facturacion = v; })} />
              <Num label="Inversión en pauta (ARS)" value={plan.lastYearMeta.inversion} onChange={(v) => upd((p) => { p.lastYearMeta.inversion = v; })} />
              <Num label="ROAS" value={plan.lastYearMeta.roas} onChange={(v) => upd((p) => { p.lastYearMeta.roas = v; })} />
            </div>
          </Section>

          <Section title="Tendencia últimos 3 meses (Meta)" internal include={plan.include.trend} onToggle={() => tgl('trend')}>
            <p className="ad-muted mp-hint">Cargá los 3 meses. Más adelante esto se va a traer solo desde Meta.</p>
            <table className="mp-trend-table">
              <thead><tr><th>Mes</th><th>ROAS</th><th>Ventas (u)</th><th>Facturación (ARS)</th></tr></thead>
              <tbody>
                {plan.trend.map((row, i) => (
                  <tr key={i}>
                    <td><input value={row.label} placeholder={`Mes ${i + 1}`} onChange={(e) => upd((p) => { p.trend[i].label = e.target.value; })} /></td>
                    <td><input type="number" value={row.roas ?? ''} onChange={(e) => upd((p) => { p.trend[i].roas = e.target.value === '' ? 0 : parseFloat(e.target.value); })} /></td>
                    <td><input type="number" value={row.ventas ?? ''} onChange={(e) => upd((p) => { p.trend[i].ventas = e.target.value === '' ? 0 : parseFloat(e.target.value); })} /></td>
                    <td><input type="number" value={row.facturacion ?? ''} onChange={(e) => upd((p) => { p.trend[i].facturacion = e.target.value === '' ? 0 : parseFloat(e.target.value); })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TrendPreview points={plan.trend} />
            <Area label="Conclusión breve (qué se ve en el gráfico)" value={plan.trendNote} onChange={(v) => upd((p) => { p.trendNote = v; })} ph="Ej. ROAS estable, facturación creciendo, ventas en alza…" />
          </Section>

          <Section title="Contexto" internal include={plan.include.context} onToggle={() => tgl('context')}>
            <Area label="¿Hay fechas importantes este mes? (negocio o macro: día del padre, navidad, hot sale…)" value={plan.context.dates} onChange={(v) => upd((p) => { p.context.dates = v; })} />
            <Area label="Productos clave: ¿hay stock? ¿capacidad de reposición?" value={plan.context.products} onChange={(v) => upd((p) => { p.context.products = v; })} />
          </Section>

          <Section title="Consideraciones extra" internal include={plan.include.considerations} onToggle={() => tgl('considerations')}>
            {(plan.considerations || []).map((c, i) => (
              <div key={i} className="ad-row">
                <Input label={`Punto ${i + 1}`} value={c} onChange={(v) => upd((p) => { p.considerations[i] = v; })} />
                <button className="ad-del" onClick={() => upd((p) => { p.considerations.splice(i, 1); })}>×</button>
              </div>
            ))}
            <button className="ad-add" onClick={() => upd((p) => { p.considerations = p.considerations || []; p.considerations.push(''); })}>+ Consideración</button>
          </Section>

          <div className="mp-disclaimer">⚠ Esto es una proyección, no una garantía.</div>

          <div className="ad-save-bottom">
            {msg && <span className="ad-msg">{msg}</span>}
            <button className="ad-btn ad-btn--ghost" onClick={exportPdf}>Exportar PDF</button>
            <button className="ad-btn" onClick={save}>Guardar plan de medios</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TrendPreview({ points }) {
  const svg = buildTrendSvg(points);
  if (!svg) return <p className="ad-muted mp-hint">Cargá al menos 2 meses para ver el gráfico.</p>;
  return <div className="mp-chart" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function ShowToggle({ on, onClick, label }) {
  return (
    <label className={`mp-show ${on ? 'mp-show--on' : ''}`} onClick={(e) => { e.preventDefault(); onClick(); }}>
      <input type="checkbox" checked={on} readOnly />
      <span>{label || 'Mostrar al cliente'}</span>
    </label>
  );
}

function Section({ title, children, internal, include, onToggle, tone }) {
  return (
    <section className={`ad-section ${internal ? 'mp-sec--internal' : ''} ${tone === 'objective' ? 'mp-sec--objective' : ''}`}>
      <div className="mp-sec-head">
        <h3 className="ad-section-title">{title}</h3>
        {internal && <ShowToggle on={include} onClick={onToggle} />}
      </div>
      {children}
    </section>
  );
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
