import React, { useState, useEffect, useCallback, useRef } from 'react';
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
function roasFmt(v) { return v ? `${v}×` : '—'; }

// ---- Series del gráfico de tendencia (sin ventas) ----
const SERIES = [
  { key: 'roas', label: 'ROAS', color: '#1b1fe8', fmt: roasFmt },
  { key: 'facturacion', label: 'Facturación', color: '#f59e0b', fmt: money },
  { key: 'inversion', label: 'Inversión', color: '#16a34a', fmt: money },
];

const blank = () => ({
  clientInput: '',
  metaSource: false, // true cuando los números vienen de Meta (no editables)
  lastMonthMeta: { facturacion: 0, inversion: 0, roas: 0 },
  lastYearMeta: { facturacion: 0, inversion: 0, roas: 0 },
  objective: { ecommerce: 0, facturacion: 0, roas: 0, inversion: 0 },
  trend: [
    { label: '', roas: 0, facturacion: 0, inversion: 0 },
    { label: '', roas: 0, facturacion: 0, inversion: 0 },
    { label: '', roas: 0, facturacion: 0, inversion: 0 },
  ],
  trendLastYear: [],
  trendNote: '',
  context: { dates: '', dateItems: [], products: '' },
  objectiveJustification: '',
  considerations: [''],
  nextPlanning: '',
  include: { clientInput: false, lastMonth: true, lastYear: true, trend: true, contextDates: true, contextProducts: true, considerations: true },
});

function normalize(raw) {
  const b = blank();
  const p = raw || {};
  const inc = p.include || {};
  return {
    ...b,
    ...p,
    lastMonthMeta: { ...b.lastMonthMeta, ...(p.lastMonthMeta || p.lastMonth || {}) },
    lastYearMeta: { ...b.lastYearMeta, ...(p.lastYearMeta || {}) },
    trend: Array.isArray(p.trend) && p.trend.length ? p.trend.map((t) => ({ label: t.label || '', roas: t.roas || 0, facturacion: t.facturacion || 0, inversion: t.inversion || 0 })) : b.trend,
    trendLastYear: Array.isArray(p.trendLastYear) ? p.trendLastYear : [],
    context: { ...b.context, ...(p.context || {}), dateItems: Array.isArray(p.context?.dateItems) ? p.context.dateItems : [] },
    considerations: Array.isArray(p.considerations) ? p.considerations : b.considerations,
    objective: (() => {
      const o = { ...b.objective, ...(p.objective || {}) };
      // Compat: si un plan viejo no tiene inversión guardada, la derivamos (fact ÷ ROAS).
      if (!o.inversion && o.roas > 0) o.inversion = o.facturacion / o.roas;
      return o;
    })(),
    include: {
      ...b.include,
      ...inc,
      contextDates: inc.contextDates != null ? inc.contextDates : (inc.context != null ? inc.context : true),
      contextProducts: inc.contextProducts != null ? inc.contextProducts : (inc.context != null ? inc.context : true),
    },
  };
}

// ---- Gráfico de tendencia (SVG puro) ----
export function buildTrendSvg(points, { w = 640, h = 240, visible = ['roas', 'facturacion', 'inversion'], staticLabels = false } = {}) {
  const pts = (points || []).filter((p) => (p.label || '').trim() || p.roas || p.facturacion || p.inversion);
  if (pts.length < 2) return '';
  const series = SERIES.filter((s) => visible.includes(s.key));
  const padL = 16, padR = 16, padT = 24, padB = 34;
  const cw = w - padL - padR, ch = h - padT - padB;
  const n = pts.length;
  const x = (i) => padL + (n === 1 ? cw / 2 : (cw * i) / (n - 1));

  let body = '';
  series.forEach((s, si) => {
    const vals = pts.map((p) => Number(p[s.key]) || 0);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    const y = (v) => padT + (1 - (v - min) / range) * ch;
    const coords = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    body += `<polyline fill="none" stroke="${s.color}" stroke-width="2.5" points="${coords.join(' ')}" />`;
    coords.forEach((c, i) => {
      const [cx, cy] = c.split(',');
      // punto con tooltip nativo al pasar el cursor + área de hover invisible más grande
      body += `<circle cx="${cx}" cy="${cy}" r="3" fill="${s.color}" />`;
      body += `<circle cx="${cx}" cy="${cy}" r="9" fill="transparent"><title>${s.label}: ${s.fmt(vals[i])}</title></circle>`;
      if (staticLabels) {
        const dy = -8 - (si * 11);
        body += `<text x="${cx}" y="${(parseFloat(cy) + dy).toFixed(1)}" font-size="8.5" fill="${s.color}" text-anchor="middle" font-family="monospace">${s.fmt(vals[i])}</text>`;
      }
    });
  });
  let labels = '';
  pts.forEach((p, i) => {
    labels += `<text x="${x(i).toFixed(1)}" y="${h - 12}" font-size="11" fill="#5b5e66" text-anchor="middle">${(p.label || `Mes ${i + 1}`)}</text>`;
  });
  let legend = '';
  series.forEach((s, i) => {
    const lx = padL + i * 130;
    legend += `<rect x="${lx}" y="2" width="9" height="9" rx="2" fill="${s.color}" /><text x="${lx + 14}" y="10" font-size="9.5" fill="#15161a" font-family="monospace">${s.label}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg">${legend}${body}${labels}</svg>`;
}

const DISCLAIMER = 'Esto es una proyección.';

export default function MediaPlan({ onBack, lockedSlug, initialMonth }) {
  const [clients, setClients] = useState([]);
  const [slug, setSlug] = useState(lockedSlug || '');
  const [months, setMonths] = useState([]);
  const [month, setMonth] = useState('');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [pulling, setPulling] = useState(false);
  const [visibleSeries, setVisibleSeries] = useState({ roas: true, facturacion: true, inversion: true });
  const [trendCompare, setTrendCompare] = useState('current'); // 'current' | 'lastyear'

  useEffect(() => {
    apiClient.get('/admin/clients').then((r) => {
      setClients(r.data.clients || []);
      if (lockedSlug) setSlug(lockedSlug);
      else if (r.data.clients?.[0]) setSlug(r.data.clients[0].slug);
    }).catch(() => {});
  }, [lockedSlug]);

  const loadMonths = useCallback((s) => {
    apiClient.get(`/admin/${s}/media-months`).then((r) => setMonths(r.data.months || [])).catch(() => setMonths([]));
  }, []);

  useEffect(() => { if (slug) { loadMonths(slug); setMonth(initialMonth || currentYM()); } }, [slug, loadMonths, initialMonth]);

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

  const pullMeta = () => {
    if (!slug || !month) return;
    setPulling(true);
    setMsg('Trayendo de Meta…');
    apiClient.get(`/admin/${slug}/meta-trend`, { params: { month } })
      .then((r) => {
        const d = r.data || {};
        upd((p) => {
          p.metaSource = true;
          if (d.lastMonth) p.lastMonthMeta = { ...p.lastMonthMeta, ...d.lastMonth };
          if (d.lastYear) p.lastYearMeta = { ...p.lastYearMeta, ...d.lastYear };
          if (Array.isArray(d.trend) && d.trend.length) p.trend = d.trend;
          if (Array.isArray(d.trendLastYear)) p.trendLastYear = d.trendLastYear;
        });
        setMsg('✓ Datos traídos de Meta'); setTimeout(() => setMsg(''), 2500);
      })
      .catch((e) => setMsg(e.response?.data?.message || 'No se pudo traer de Meta'))
      .finally(() => setPulling(false));
  };

  const year = new Date().getFullYear();
  const allMonths = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const monthOptions = Array.from(new Set([...allMonths, ...months])).sort();

  const inv = plan ? (plan.objective.inversion || 0) : 0;
  const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
  // Las 3 métricas del objetivo están relacionadas: facturación = ROAS × inversión.
  // La facturación es el ancla: si editás ROAS recalculamos inversión, y si editás
  // inversión recalculamos ROAS. Así se puede cargar fact+ROAS o fact+inversión.
  const setObjFact = (v) => upd((p) => {
    p.objective.facturacion = v;
    if (p.objective.roas > 0) p.objective.inversion = round2(v / p.objective.roas);
    else if (p.objective.inversion > 0) p.objective.roas = round2(v / p.objective.inversion);
  });
  const setObjRoas = (v) => upd((p) => {
    p.objective.roas = v;
    p.objective.inversion = v > 0 ? round2((p.objective.facturacion || 0) / v) : 0;
  });
  const setObjInv = (v) => upd((p) => {
    p.objective.inversion = v;
    p.objective.roas = v > 0 ? round2((p.objective.facturacion || 0) / v) : 0;
  });
  // Objetivo de facturación ECOMMERCE (tienda completa) — independiente del de Meta.
  const setObjEcom = (v) => upd((p) => { p.objective.ecommerce = v; });
  const lastYearComparable = plan && (plan.lastYearMeta.inversion || 0) > 0;
  const visibleKeys = SERIES.map((s) => s.key).filter((k) => visibleSeries[k]);
  const trendData = plan ? (trendCompare === 'lastyear' ? plan.trendLastYear : plan.trend) : [];

  const tgl = (key) => upd((p) => { p.include[key] = !p.include[key]; });

  const exportPdf = () => {
    if (!plan) return;
    const clientName = clients.find((c) => c.slug === slug)?.name || slug;
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inc = plan.include;
    const cons = (plan.considerations || []).filter((c) => c.trim()).map((c) => `<li>${esc(c)}</li>`).join('');
    const fmtDate = (d) => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${dd}/${m}`; };

    const sections = [];
    if (inc.lastMonth) {
      sections.push(`<div class="sec"><div class="sec-t sec-t--sec">Cómo nos fue el mes pasado</div><div class="kpis">
        <div class="kpi kpi--sec"><div class="lbl">Facturación</div><div class="val">${money(plan.lastMonthMeta.facturacion)}</div></div>
        <div class="kpi kpi--sec"><div class="lbl">Inversión pauta</div><div class="val">${money(plan.lastMonthMeta.inversion)}</div></div>
        <div class="kpi kpi--sec"><div class="lbl">ROAS</div><div class="val">${roasFmt(plan.lastMonthMeta.roas)}</div></div></div></div>`);
    }
    if (inc.lastYear) {
      if (lastYearComparable) {
        sections.push(`<div class="sec"><div class="sec-t sec-t--sec">Mismo período del año pasado</div><div class="kpis">
          <div class="kpi kpi--sec"><div class="lbl">Facturación</div><div class="val">${money(plan.lastYearMeta.facturacion)}</div></div>
          <div class="kpi kpi--sec"><div class="lbl">Inversión pauta</div><div class="val">${money(plan.lastYearMeta.inversion)}</div></div>
          <div class="kpi kpi--sec"><div class="lbl">ROAS</div><div class="val">${roasFmt(plan.lastYearMeta.roas)}</div></div></div></div>`);
      } else {
        sections.push(`<div class="sec"><div class="sec-t sec-t--sec">Mismo período del año pasado</div><div class="txt">No se puede comparar con el mismo período del año pasado ya que no hubo inversión publicitaria.</div></div>`);
      }
    }
    if (inc.trend) {
      const svg = buildTrendSvg(trendData, { visible: visibleKeys, staticLabels: false });
      if (svg) sections.push(`<div class="sec"><div class="sec-t">Tendencia ${trendCompare === 'lastyear' ? '(año pasado)' : 'últimos 3 meses'}</div><div class="chart">${svg}</div>${plan.trendNote?.trim() ? `<div class="txt" style="margin-top:8px">${esc(plan.trendNote)}</div>` : ''}</div>`);
    }
    if (inc.contextDates && (plan.context.dates?.trim() || (plan.context.dateItems || []).length)) {
      let c = plan.context.dates?.trim() ? `<div class="txt">${esc(plan.context.dates)}</div>` : '';
      const items = (plan.context.dateItems || []).filter((it) => it.date || it.name);
      if (items.length) c += `<ul>${items.map((it) => `<li><strong>${fmtDate(it.date)}${it.endDate ? ` al ${fmtDate(it.endDate)}` : ''}</strong> — ${esc(it.name)}</li>`).join('')}</ul>`;
      sections.push(`<div class="sec"><div class="sec-t">Fechas importantes del mes</div>${c}</div>`);
    }
    if (inc.contextProducts && plan.context.products?.trim())
      sections.push(`<div class="sec"><div class="sec-t">Stock y reposición de productos clave</div><div class="txt">${esc(plan.context.products)}</div></div>`);
    if (inc.considerations && (plan.objectiveJustification?.trim() || cons || plan.nextPlanning?.trim())) {
      let c = '';
      if (plan.objectiveJustification?.trim()) c += `<div class="block"><div class="lbl">Justificación de objetivos</div><div class="txt">${esc(plan.objectiveJustification)}</div></div>`;
      if (cons) c += `<div class="block" style="margin-top:8px"><div class="lbl">Consideraciones y riesgos</div><ul>${cons}</ul></div>`;
      if (plan.nextPlanning?.trim()) c += `<div class="block" style="margin-top:8px"><div class="lbl">Planificación de próximos meses</div><div class="txt">${esc(plan.nextPlanning)}</div></div>`;
      sections.push(`<div class="sec"><div class="sec-t">Justificación y consideraciones</div>${c}</div>`);
    }

    const clientProposal = (inc.clientInput && plan.clientInput?.trim())
      ? `<div class="sec"><div class="sec-t">Propuesto por el cliente</div><div class="txt">${esc(plan.clientInput)}</div></div>`
      : '';

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>Plan de medios — ${esc(clientName)} ${esc(fmtMonth(month))}</title>
    <style>
      @page { margin: 0; size: A4; }
      * { box-sizing: border-box; }
      /* Que el PDF imprima fondos y colores (Chrome los descarta por defecto). */
      html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { font-family: -apple-system, system-ui, Helvetica, Arial, sans-serif; color: #15161a; margin: 0; padding: 0; line-height: 1.55; }
      /* Hoja A4 (96dpi = 794x1123px). #doc se auto-escala por JS para entrar SIEMPRE en una sola carilla. */
      #page { width: 794px; min-height: 1123px; margin: 0 auto; padding: 48px 52px; }
      .brand { font-family: 'SF Mono', Menlo, Consolas, monospace; color: #1b1fe8; font-weight: 700; font-size: 14px; letter-spacing: 0.04em; }
      .eyebrow { font-family: 'SF Mono', Menlo, Consolas, monospace; text-transform: uppercase; letter-spacing: 0.1em; font-size: 10px; color: #8a8d96; margin-top: 3px; }
      h1 { font-size: 25px; margin: 6px 0 2px; }
      .sub { color: #5b5e66; font-size: 13px; margin-bottom: 18px; }
      .rule { height: 2px; background: #15161a; margin: 12px 0 22px; }
      .sec { margin-bottom: 22px; page-break-inside: avoid; }
      .sec-t { font-family: 'SF Mono', Menlo, Consolas, monospace; text-transform: uppercase; letter-spacing: 0.05em; font-size: 12px; font-weight: 700; border-bottom: 2px solid #15161a; padding-bottom: 5px; margin-bottom: 11px; }
      /* Secundario: menos jerarquía que el objetivo del mes. */
      .sec-t--sec { font-size: 10px; color: #6b6e76; border-bottom: 1px solid #c9cbd2; padding-bottom: 4px; margin-bottom: 8px; }
      .txt { white-space: pre-wrap; font-size: 13px; }
      .lbl { font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #8a8d96; margin-bottom: 3px; }
      ul { margin: 0; padding-left: 18px; } li { font-size: 13px; margin-bottom: 6px; line-height: 1.45; }
      .kpis { display: flex; gap: 12px; }
      .kpi { flex: 1; border: 1.5px solid #e5e6ea; border-radius: 13px; padding: 15px; background: #fafafa; }
      .kpi .lbl { margin-bottom: 6px; } .kpi .val { font-size: 22px; font-weight: 700; color: #15161a; }
      /* KPI secundario (mes pasado / año pasado): más chico y discreto. */
      .kpi--sec { border-radius: 10px; padding: 10px 12px; background: #f4f5f7; border-color: #ebecef; }
      .kpi--sec .lbl { font-size: 8px; margin-bottom: 2px; }
      .kpi--sec .val { font-size: 15px; font-weight: 600; color: #4b4e56; }
      .chart { border: 1.5px solid #e5e6ea; border-radius: 11px; padding: 10px; }
      .disc { background: #fef9c3; color: #854d0e; border-radius: 10px; padding: 11px 15px; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 11px; font-weight: 600; margin-top: 22px; }
      .foot { margin-top: 22px; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 9px; color: #b0b2ba; text-align: center; }
    </style></head><body>
      <div id="page">
      <div class="brand">alquimia.</div>
      <div class="eyebrow">Plan de medios</div>
      <h1>${esc(clientName)}</h1>
      <div class="sub">${esc(fmtMonth(month))}</div>
      <div class="rule"></div>

      ${clientProposal}

      <div class="sec"><div class="sec-t">Objetivo propuesto</div>
        <div class="kpis">
          <div class="kpi"><div class="lbl">Facturación objetivo (en Meta)</div><div class="val">${money(plan.objective.facturacion)}</div></div>
          <div class="kpi"><div class="lbl">ROAS objetivo</div><div class="val">${roasFmt(plan.objective.roas)}</div></div>
          <div class="kpi"><div class="lbl">Inversión necesaria</div><div class="val">${money(inv)}</div></div>
        </div>
      </div>

      ${sections.join('')}

      <div class="disc">⚠ ${DISCLAIMER}</div>
      <div class="foot">Generado por alquimia. · ${new Date().toLocaleDateString('es-AR')}</div>
      </div>
      <script>
        // Garantiza UNA sola carilla: si el contenido se pasa del alto de A4,
        // lo escala hacia abajo lo justo (nunca agranda). El "aire" base se
        // mantiene cuando el contenido entra holgado.
        (function () {
          var PAGE_H = 1123; // alto A4 a 96dpi
          var el = document.getElementById('page');
          function fit() {
            // Medimos sin zoom (zoom reflowea el layout, a diferencia de transform
            // que Chrome ignora al paginar la impresión).
            el.style.zoom = 1;
            el.style.minHeight = '0px';
            var h = el.scrollHeight;
            var scale = Math.min(1, (PAGE_H - 4) / h);
            el.style.zoom = scale;
            // Si entra holgado, ocupamos la hoja completa (centrado vertical natural).
            if (scale >= 1) el.style.minHeight = PAGE_H + 'px';
          }
          fit();
          window.__fit = fit;
        })();
      </script>
    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Permití las ventanas emergentes para exportar el PDF.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    // Re-medir tras cargar fuentes/SVG y recién ahí imprimir (así la escala
    // a una carilla queda exacta).
    setTimeout(() => { try { w.__fit && w.__fit(); } catch (e) {} w.print(); }, 500);
  };

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
        {!lockedSlug && (
          <div className="ad-field">
            <label>Cliente</label>
            <select value={slug} onChange={(e) => setSlug(e.target.value)}>
              {clients.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div className="ad-field">
          <label>Mes del plan</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {monthOptions.map((m) => <option key={m} value={m}>{fmtMonth(m)}{months.includes(m) ? '' : ' (vacío)'}</option>)}
          </select>
        </div>
        <button className="ad-btn ad-btn--ghost" onClick={pullMeta} disabled={!plan || pulling}>{pulling ? 'Trayendo…' : '↧ Traer de Meta'}</button>
        <div className="ad-save">
          {msg && <span className="ad-msg">{msg}</span>}
          <button className="ad-btn ad-btn--ghost" onClick={exportPdf} disabled={!plan}>Exportar PDF</button>
          <button className="ad-btn" onClick={save} disabled={!plan}>Guardar plan de medios</button>
        </div>
      </div>

      {loading && <p className="ad-muted">Cargando…</p>}

      {plan && !loading && (
        <div className="ad-plan">
          {/* OBJETIVO — siempre arriba */}
          <Section title="Objetivo propuesto" tone="objective">
            <div className="mp-kpis" style={{ marginBottom: 10 }}>
              <KpiEditable label="Objetivo de facturación ecommerce (tienda)" kind="money" value={plan.objective.ecommerce} onChange={setObjEcom} />
            </div>
            <div className="mp-calc" style={{ marginBottom: 14 }}>Es el objetivo de facturación TOTAL de la tienda (lo que se ve en "Facturación ecommerce" del portal). Es distinto del objetivo atribuido a Meta de abajo.</div>
            <div className="mp-kpis">
              <KpiEditable label="Facturación objetivo (en Meta)" kind="money" value={plan.objective.facturacion} onChange={setObjFact} />
              <KpiEditable label="ROAS objetivo" kind="roas" value={plan.objective.roas} onChange={setObjRoas} />
              <KpiEditable label="Inversión necesaria" kind="money" value={plan.objective.inversion} onChange={setObjInv} />
            </div>
            <div className="mp-calc">Las 3 están relacionadas: facturación (en Meta) = ROAS × inversión. Cargá dos y la tercera se calcula sola (la facturación es la base).</div>
          </Section>

          <div className="mp-internal-banner">
            ↓ <strong>Trabajo interno</strong> para definir el objetivo. En el entregable van siempre el mes pasado y el año pasado; el resto solo si lo tildás.
          </div>

          <Section title="Propuesto por el cliente" include={plan.include.clientInput} onToggle={() => tgl('clientInput')}>
            <p className="ad-muted" style={{ margin: '0 0 6px' }}>Si lo tildás, aparece arriba de todo en el entregable.</p>
            <Area value={plan.clientInput} onChange={(v) => upd((p) => { p.clientInput = v; })} ph="Qué busca el cliente este mes (objetivo, volumen, acciones, eventos…). Si propone un objetivo, cargalo arriba; se puede ajustar luego." />
          </Section>

          {/* Mes pasado */}
          <Section title="Cómo nos fue el mes pasado (Meta)" include={plan.include.lastMonth} onToggle={() => tgl('lastMonth')}
            action={plan.metaSource ? <button className="mp-edit-link" onClick={() => upd((p) => { p.metaSource = false; })}>✎ Editar a mano</button> : null}>
            {plan.metaSource
              ? <KpiCards data={plan.lastMonthMeta} />
              : (
                <div className="ad-row">
                  <Num label="Facturación (ARS)" value={plan.lastMonthMeta.facturacion} onChange={(v) => upd((p) => { p.lastMonthMeta.facturacion = v; })} />
                  <Num label="Inversión en pauta (ARS)" value={plan.lastMonthMeta.inversion} onChange={(v) => upd((p) => { p.lastMonthMeta.inversion = v; })} />
                  <Num label="ROAS" value={plan.lastMonthMeta.roas} onChange={(v) => upd((p) => { p.lastMonthMeta.roas = v; })} />
                </div>
              )}
          </Section>

          {/* Año pasado */}
          <Section title="Mismo período del año pasado (Meta)" include={plan.include.lastYear} onToggle={() => tgl('lastYear')}>
            {plan.metaSource
              ? (lastYearComparable ? <KpiCards data={plan.lastYearMeta} /> : <p className="mp-rule-note">No hubo inversión el año pasado → en el entregable aparece: <em>"No se puede comparar con el mismo período del año pasado ya que no hubo inversión publicitaria."</em></p>)
              : (
                <>
                  <div className="ad-row">
                    <Num label="Facturación (ARS)" value={plan.lastYearMeta.facturacion} onChange={(v) => upd((p) => { p.lastYearMeta.facturacion = v; })} />
                    <Num label="Inversión en pauta (ARS)" value={plan.lastYearMeta.inversion} onChange={(v) => upd((p) => { p.lastYearMeta.inversion = v; })} />
                    <Num label="ROAS" value={plan.lastYearMeta.roas} onChange={(v) => upd((p) => { p.lastYearMeta.roas = v; })} />
                  </div>
                  {!lastYearComparable && <p className="mp-rule-note">Sin inversión el año pasado → en el entregable aparece el texto explicativo.</p>}
                </>
              )}
          </Section>

          {/* Tendencia */}
          <Section title="Tendencia (Meta)" internal include={plan.include.trend} onToggle={() => tgl('trend')}>
            <div className="mp-trend-toggle">
              <button className={`mp-seg ${trendCompare === 'current' ? 'mp-seg--on' : ''}`} onClick={() => setTrendCompare('current')}>Últimos 3 meses</button>
              <button className={`mp-seg ${trendCompare === 'lastyear' ? 'mp-seg--on' : ''}`} onClick={() => setTrendCompare('lastyear')}>Mismo tramo del año pasado</button>
            </div>

            {plan.metaSource
              ? <TrendReadonly rows={trendData} />
              : (
                <table className="mp-trend-table mp-trend-table--t">
                  <thead>
                    <tr>
                      <th className="mp-t-corner"></th>
                      {plan.trend.map((row, i) => (
                        <th key={i}><input value={row.label} placeholder={`Mes ${i + 1}`} onChange={(e) => upd((p) => { p.trend[i].label = e.target.value; })} /></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="mp-t-rowlbl">ROAS</td>
                      {plan.trend.map((row, i) => (
                        <td key={i}><input type="number" value={row.roas === 0 ? '' : row.roas} placeholder="0" onChange={(e) => upd((p) => { p.trend[i].roas = e.target.value === '' ? 0 : parseFloat(e.target.value); })} /></td>
                      ))}
                    </tr>
                    <tr>
                      <td className="mp-t-rowlbl">Facturación (ARS)</td>
                      {plan.trend.map((row, i) => (
                        <td key={i}><input type="number" value={row.facturacion === 0 ? '' : row.facturacion} placeholder="0" onChange={(e) => upd((p) => { p.trend[i].facturacion = e.target.value === '' ? 0 : parseFloat(e.target.value); })} /></td>
                      ))}
                    </tr>
                    <tr>
                      <td className="mp-t-rowlbl">Inversión (ARS)</td>
                      {plan.trend.map((row, i) => (
                        <td key={i}><input type="number" value={row.inversion === 0 ? '' : row.inversion} placeholder="0" onChange={(e) => upd((p) => { p.trend[i].inversion = e.target.value === '' ? 0 : parseFloat(e.target.value); })} /></td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              )}

            <div className="mp-series-checks">
              {SERIES.map((s) => (
                <label key={s.key} className="mp-check">
                  <input type="checkbox" checked={!!visibleSeries[s.key]} onChange={() => setVisibleSeries((v) => ({ ...v, [s.key]: !v[s.key] }))} />
                  <span className="mp-check-dot" style={{ background: s.color }} />{s.label}
                </label>
              ))}
            </div>

            <TrendPreview points={trendData} visible={visibleKeys} />
            {trendCompare === 'lastyear' && !(plan.trendLastYear || []).length && <p className="ad-muted mp-hint">Tocá "↧ Traer de Meta" para cargar la comparación del año pasado.</p>}
            <Area label="Conclusión breve (qué se ve en el gráfico)" value={plan.trendNote} onChange={(v) => upd((p) => { p.trendNote = v; })} ph="Ej. ROAS estable, facturación creciendo, inversión en alza…" />
          </Section>

          {/* Contexto — fechas */}
          <Section title="Fechas importantes del mes" internal include={plan.include.contextDates} onToggle={() => tgl('contextDates')}>
            <Area label="¿Hay fechas importantes? (negocio o macro: día del padre, navidad, hot sale…)" value={plan.context.dates} onChange={(v) => upd((p) => { p.context.dates = v; })} />
            <div className="mp-dates">
              {(plan.context.dateItems || []).map((it, i) => (
                <div key={i} className="ad-row mp-date-row">
                  <div className="ad-field"><label>Desde</label><input type="date" value={it.date || ''} onChange={(e) => upd((p) => { p.context.dateItems[i].date = e.target.value; p.context.dateItems.sort((a, b) => { if (!a.date) return 1; if (!b.date) return -1; return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }); })} /></div>
                  <div className="ad-field"><label>Hasta (opcional)</label><input type="date" value={it.endDate || ''} onChange={(e) => upd((p) => { p.context.dateItems[i].endDate = e.target.value; })} /></div>
                  <div className="ad-field ad-field--grow"><label>Nombre</label><input value={it.name || ''} placeholder="Ej. Día del padre" onChange={(e) => upd((p) => { p.context.dateItems[i].name = e.target.value; })} /></div>
                  <button className="ad-del" onClick={() => upd((p) => { p.context.dateItems.splice(i, 1); })}>×</button>
                </div>
              ))}
              <button className="ad-add" onClick={() => upd((p) => { p.context.dateItems = p.context.dateItems || []; p.context.dateItems.push({ date: '', endDate: '', name: '' }); })}>+ Sumar fecha</button>
            </div>
          </Section>

          {/* Contexto — productos */}
          <Section title="Stock y reposición de productos clave" internal include={plan.include.contextProducts} onToggle={() => tgl('contextProducts')}>
            <Area label="¿Hay stock de los productos que mueven la aguja? ¿Capacidad de reposición?" value={plan.context.products} onChange={(v) => upd((p) => { p.context.products = v; })} />
          </Section>

          {/* Consideraciones */}
          <Section title="Justificación, consideraciones y planificación" internal include={plan.include.considerations} onToggle={() => tgl('considerations')}>
            <Area label="Justificación de objetivos" value={plan.objectiveJustification} onChange={(v) => upd((p) => { p.objectiveJustification = v; })} ph="Por qué el objetivo es viable (estacionalidad, stock, acciones, contenido, estrategia…)" />

            <div className="ad-sublabel">Consideraciones y riesgos</div>
            {(plan.considerations || []).map((c, i) => (
              <div key={i} className="ad-row">
                <div className="ad-field ad-field--grow">
                  <label>{`Punto ${i + 1}`}</label>
                  <input value={c} placeholder="Ej. contexto país (elecciones, inflación) o particularidad del dueño (viaje, licencia)…" onChange={(e) => upd((p) => { p.considerations[i] = e.target.value; })} />
                </div>
                <button className="ad-del" onClick={() => upd((p) => { p.considerations.splice(i, 1); })}>×</button>
              </div>
            ))}
            <button className="ad-add" onClick={() => upd((p) => { p.considerations = p.considerations || []; p.considerations.push(''); })}>+ Consideración</button>

            <Area label="¿Hay que empezar a planificar algo de los próximos meses?" value={plan.nextPlanning} onChange={(v) => upd((p) => { p.nextPlanning = v; })} ph="Ej. preparar campaña de día de la madre, anticipar reposición de temporada, lanzamiento previsto…" />
          </Section>

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

function KpiEditable({ label, value, onChange, kind }) {
  const [edit, setEdit] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (edit && ref.current) ref.current.focus(); }, [edit]);
  const display = kind === 'roas' ? roasFmt(value) : money(value);
  return (
    <div className="mp-kpi mp-kpi--edit">
      <div className="mp-kpi-lbl">{label}</div>
      {edit
        ? <input ref={ref} className="mp-kpi-input" type="number" value={value === 0 || value == null ? '' : value} placeholder="0"
            onChange={(e) => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))} onBlur={() => setEdit(false)} />
        : <div className="mp-kpi-val mp-kpi-val--clickable" onClick={() => setEdit(true)}>{display === '—' ? <span className="mp-kpi-ph">Cargar</span> : display}</div>}
    </div>
  );
}

function KpiCards({ data }) {
  return (
    <div className="mp-kpis">
      <div className="mp-kpi"><div className="mp-kpi-lbl">Facturación</div><div className="mp-kpi-val">{money(data.facturacion)}</div></div>
      <div className="mp-kpi"><div className="mp-kpi-lbl">Inversión pauta</div><div className="mp-kpi-val">{money(data.inversion)}</div></div>
      <div className="mp-kpi"><div className="mp-kpi-lbl">ROAS</div><div className="mp-kpi-val">{roasFmt(data.roas)}</div></div>
    </div>
  );
}

function TrendReadonly({ rows }) {
  if (!rows || !rows.length) return <p className="ad-muted mp-hint">Sin datos. Tocá "↧ Traer de Meta".</p>;
  return (
    <table className="mp-trend-table mp-trend-table--ro mp-trend-table--t">
      <thead>
        <tr>
          <th className="mp-t-corner"></th>
          {rows.map((r, i) => <th key={i} className="mp-ro-month">{r.label || `Mes ${i + 1}`}</th>)}
        </tr>
      </thead>
      <tbody>
        <tr><td className="mp-t-rowlbl">ROAS</td>{rows.map((r, i) => <td key={i} className="mp-ro-val">{roasFmt(r.roas)}</td>)}</tr>
        <tr><td className="mp-t-rowlbl">Facturación</td>{rows.map((r, i) => <td key={i} className="mp-ro-val">{money(r.facturacion)}</td>)}</tr>
        <tr><td className="mp-t-rowlbl">Inversión</td>{rows.map((r, i) => <td key={i} className="mp-ro-val">{money(r.inversion)}</td>)}</tr>
      </tbody>
    </table>
  );
}

function TrendPreview({ points, visible }) {
  const svg = buildTrendSvg(points, { visible });
  if (!svg) return <p className="ad-muted mp-hint">Cargá al menos 2 meses para ver el gráfico.</p>;
  return <div className="mp-chart" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function ShowToggle({ on, onClick }) {
  return (
    <button type="button" className={`mp-show ${on ? 'mp-show--on' : ''}`} onClick={onClick}>
      <span className="mp-show-dot">{on ? '✓' : ''}</span>
      {on ? 'Se muestra al cliente' : 'Mostrar al cliente'}
    </button>
  );
}

function Section({ title, children, internal, required, include, onToggle, tone, action }) {
  return (
    <section className={`ad-section ${internal ? 'mp-sec--internal' : ''} ${tone === 'objective' ? 'mp-sec--objective' : ''} ${required ? 'mp-sec--required' : ''}`}>
      <div className="mp-sec-head">
        <h3 className="ad-section-title">{title}</h3>
        <div className="mp-sec-head-right">
          {action}
          {onToggle && <ShowToggle on={include} onClick={onToggle} />}
          {required && <span className="mp-req-tag">Siempre en el entregable</span>}
        </div>
      </div>
      {children}
    </section>
  );
}
function Area({ label, value, onChange, ph }) {
  return <div className="ad-field ad-field--grow"><label>{label || ''}</label><textarea value={value} placeholder={ph || ''} onChange={(e) => onChange(e.target.value)} /></div>;
}
function Num({ label, value, onChange }) {
  return <div className="ad-field"><label>{label}</label><input className="mp-num" type="number" value={value === 0 || value == null ? '' : value} placeholder="0" onChange={(e) => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))} /></div>;
}
