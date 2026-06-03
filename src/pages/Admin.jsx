import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client.js';
import './Admin.css';

const STATUS_OPTS = [
  { v: 'pendiente', l: 'Pendiente' },
  { v: 'en_curso', l: 'En curso' },
  { v: 'finalizada', l: 'Finalizada' },
];

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

const blankPlan = () => ({
  strategyMonthly: { month: '', objective: '', description: '' },
  ecommerceGoal: { target: 0 },
  metaGoal: { revenueTarget: 0, roasTarget: 0, spendTarget: 0 },
  roadmap: [],
  strategicProducts: [],
  hypotheses: { points: [], conclusion: '' },
  considerations: [],
  budgetItems: [],
});

export default function Admin({ onBack }) {
  const [clients, setClients] = useState([]);
  const [slug, setSlug] = useState('');
  const [clientData, setClientData] = useState(null);
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

  const loadClient = useCallback((s) => {
    apiClient.get(`/admin/${s}`).then((r) => {
      setClientData(r.data);
      const m = r.data.months?.includes(currentYM()) ? currentYM() : (r.data.months?.[0] || currentYM());
      setMonth(m);
    }).catch(() => {});
  }, []);

  useEffect(() => { if (slug) loadClient(slug); }, [slug, loadClient]);

  const loadPlan = useCallback(() => {
    if (!slug || !month) return;
    setLoading(true);
    apiClient.get(`/admin/${slug}/plan/${month}`)
      .then((r) => setPlan(r.data.plan || blankPlan()))
      .catch(() => setPlan(blankPlan()))
      .finally(() => setLoading(false));
  }, [slug, month]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const upd = (fn) => setPlan((p) => { const next = structuredClone(p); fn(next); return next; });

  const savePlan = () => {
    setMsg('Guardando…');
    apiClient.put(`/admin/${slug}/plan/${month}`, { plan })
      .then(() => { setMsg('✓ Guardado'); setTimeout(() => setMsg(''), 2000); })
      .catch(() => setMsg('Error al guardar'));
  };

  const duplicate = () => {
    const to = prompt('¿A qué mes duplicar? Formato AAAA-MM (ej. 2026-07)');
    if (!to) return;
    apiClient.post(`/admin/${slug}/duplicate`, { from: month, to })
      .then(() => { loadClient(slug); setMonth(to); setMsg('✓ Mes duplicado'); setTimeout(() => setMsg(''), 2000); })
      .catch(() => setMsg('Error al duplicar'));
  };

  const newMonth = () => {
    const to = prompt('Nuevo mes en blanco. Formato AAAA-MM (ej. 2026-07)');
    if (!to) return;
    apiClient.put(`/admin/${slug}/plan/${to}`, { plan: blankPlan() })
      .then(() => { loadClient(slug); setMonth(to); })
      .catch(() => setMsg('Error'));
  };

  return (
    <div className="ad-page">
      <header className="ad-header">
        <div>
          <div className="ad-brand">alquimia.</div>
          <div className="ad-eyebrow">Panel de administración</div>
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
          <label>Mes</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {(clientData?.months || []).map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          </select>
        </div>
        <button className="ad-btn ad-btn--ghost" onClick={duplicate}>Duplicar mes →</button>
        <button className="ad-btn ad-btn--ghost" onClick={newMonth}>+ Mes en blanco</button>
        <div className="ad-save">
          {msg && <span className="ad-msg">{msg}</span>}
          <button className="ad-btn" onClick={savePlan} disabled={!plan}>Guardar plan</button>
        </div>
      </div>

      {clientData && <MacroEditor slug={slug} macros={clientData.macros} reload={() => loadClient(slug)} />}

      {loading && <p className="ad-muted">Cargando plan…</p>}

      {plan && !loading && (
        <div className="ad-plan">
          {/* Estrategia mensual */}
          <Section title="Estrategia del mes">
            <Field label="Etiqueta del mes (ej. Junio 2026)" value={plan.strategyMonthly?.month || ''} onChange={(v) => upd((p) => { p.strategyMonthly = { ...p.strategyMonthly, month: v }; })} />
            <Field label="Objetivo del mes" value={plan.strategyMonthly?.objective || ''} onChange={(v) => upd((p) => { p.strategyMonthly = { ...p.strategyMonthly, objective: v }; })} />
            <Field label="Descripción" textarea value={plan.strategyMonthly?.description || ''} onChange={(v) => upd((p) => { p.strategyMonthly = { ...p.strategyMonthly, description: v }; })} />
          </Section>

          {/* Objetivos */}
          <Section title="Objetivos">
            <NumField label="Objetivo facturación ecommerce (ARS)" value={plan.ecommerceGoal?.target} onChange={(v) => upd((p) => { p.ecommerceGoal = { ...p.ecommerceGoal, target: v }; })} />
            <NumField label="Meta — facturación objetivo (ARS)" value={plan.metaGoal?.revenueTarget} onChange={(v) => upd((p) => { p.metaGoal = { ...p.metaGoal, revenueTarget: v }; })} />
            <NumField label="Meta — ROAS objetivo (×)" value={plan.metaGoal?.roasTarget} onChange={(v) => upd((p) => { p.metaGoal = { ...p.metaGoal, roasTarget: v }; })} />
            <NumField label="Meta — inversión objetivo (ARS)" value={plan.metaGoal?.spendTarget} onChange={(v) => upd((p) => { p.metaGoal = { ...p.metaGoal, spendTarget: v }; })} />
          </Section>

          {/* Roadmap */}
          <Section title="Roadmap del mes">
            {(plan.roadmap || []).map((w, i) => (
              <div key={i} className="ad-row-box">
                <div className="ad-row">
                  <Field label="Semana" value={w.week} onChange={(v) => upd((p) => { p.roadmap[i].week = v; })} />
                  <div className="ad-field">
                    <label>Estado</label>
                    <select value={w.status} onChange={(e) => upd((p) => { p.roadmap[i].status = e.target.value; })}>
                      {STATUS_OPTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                    </select>
                  </div>
                  <button className="ad-del" onClick={() => upd((p) => { p.roadmap.splice(i, 1); })}>×</button>
                </div>
                <Field label="Objetivo de la semana" value={w.goal} onChange={(v) => upd((p) => { p.roadmap[i].goal = v; })} />
                <div className="ad-sublabel">Grabaciones</div>
                {(w.recordings || []).map((r, j) => (
                  <div key={j} className="ad-row">
                    <Field label="Fecha (AAAA-MM-DD)" value={r.date} onChange={(v) => upd((p) => { p.roadmap[i].recordings[j].date = v; })} />
                    <Field label="Actriz" value={r.actress} onChange={(v) => upd((p) => { p.roadmap[i].recordings[j].actress = v; })} />
                    <Field label="Nota" value={r.note} onChange={(v) => upd((p) => { p.roadmap[i].recordings[j].note = v; })} />
                    <button className="ad-del" onClick={() => upd((p) => { p.roadmap[i].recordings.splice(j, 1); })}>×</button>
                  </div>
                ))}
                <button className="ad-add" onClick={() => upd((p) => { p.roadmap[i].recordings = p.roadmap[i].recordings || []; p.roadmap[i].recordings.push({ date: '', actress: '', note: '' }); })}>+ Grabación</button>
              </div>
            ))}
            <button className="ad-add" onClick={() => upd((p) => { p.roadmap = p.roadmap || []; p.roadmap.push({ week: `Semana ${p.roadmap.length + 1}`, goal: '', status: 'pendiente', recordings: [] }); })}>+ Semana</button>
          </Section>

          {/* Productos estratégicos */}
          <Section title="Productos estratégicos">
            {(plan.strategicProducts || []).map((pr, i) => (
              <div key={i} className="ad-row">
                <Field label="SKU" value={pr.sku} onChange={(v) => upd((p) => { p.strategicProducts[i].sku = v; })} />
                <Field label="Nombre" value={pr.name} onChange={(v) => upd((p) => { p.strategicProducts[i].name = v; })} />
                <button className="ad-del" onClick={() => upd((p) => { p.strategicProducts.splice(i, 1); })}>×</button>
              </div>
            ))}
            <button className="ad-add" onClick={() => upd((p) => { p.strategicProducts = p.strategicProducts || []; p.strategicProducts.push({ sku: '', name: '' }); })}>+ Producto</button>
          </Section>

          {/* Presupuesto */}
          <Section title="Presupuesto y fees">
            {(plan.budgetItems || []).map((it, i) => (
              <div key={i} className="ad-row-box">
                <div className="ad-row">
                  <Field label="Concepto" value={it.concept} onChange={(v) => upd((p) => { p.budgetItems[i].concept = v; })} />
                  <Field label="Detalle" value={it.detail || ''} onChange={(v) => upd((p) => { p.budgetItems[i].detail = v; })} />
                </div>
                {!it.breakdown && !it.isVariable && !it.editable && (
                  <div className="ad-row">
                    <NumField label="Monto" value={it.amount} onChange={(v) => upd((p) => { p.budgetItems[i].amount = v; })} />
                    <CurField value={it.currency} onChange={(v) => upd((p) => { p.budgetItems[i].currency = v; })} />
                  </div>
                )}
                {it.editable && <div className="ad-note">Monto editable desde el portal de pagos.</div>}
                {it.breakdown && (
                  <div className="ad-breakdown">
                    {it.breakdown.map((b, j) => (
                      <div key={j} className="ad-row">
                        <Field label="Sub-concepto" value={b.concept} onChange={(v) => upd((p) => { p.budgetItems[i].breakdown[j].concept = v; })} />
                        {b.isVariable
                          ? <div className="ad-note">Variable (se calcula solo)</div>
                          : <><NumField label="Monto" value={b.amount} onChange={(v) => upd((p) => { p.budgetItems[i].breakdown[j].amount = v; })} /><CurField value={b.currency} onChange={(v) => upd((p) => { p.budgetItems[i].breakdown[j].currency = v; })} /></>}
                        <Field label="Bonificado (texto, vacío = no)" value={b.bonificado || ''} onChange={(v) => upd((p) => { p.budgetItems[i].breakdown[j].bonificado = v || undefined; })} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Section>

          {/* Hipótesis */}
          <Section title="Justificación de objetivos (hipótesis)">
            {(plan.hypotheses?.points || []).map((pt, i) => (
              <div key={i} className="ad-row">
                <Field label={`Punto ${i + 1}`} value={pt} onChange={(v) => upd((p) => { p.hypotheses.points[i] = v; })} />
                <button className="ad-del" onClick={() => upd((p) => { p.hypotheses.points.splice(i, 1); })}>×</button>
              </div>
            ))}
            <button className="ad-add" onClick={() => upd((p) => { p.hypotheses = p.hypotheses || { points: [], conclusion: '' }; p.hypotheses.points.push(''); })}>+ Punto</button>
            <Field label="Conclusión" value={plan.hypotheses?.conclusion || ''} onChange={(v) => upd((p) => { p.hypotheses = { ...p.hypotheses, conclusion: v }; })} />
          </Section>

          {/* Consideraciones */}
          <Section title="Consideraciones y riesgos">
            {(plan.considerations || []).map((c, i) => (
              <div key={i} className="ad-row-box">
                <div className="ad-row">
                  <Field label="Título" value={c.title} onChange={(v) => upd((p) => { p.considerations[i].title = v; })} />
                  <button className="ad-del" onClick={() => upd((p) => { p.considerations.splice(i, 1); })}>×</button>
                </div>
                <Field label="Texto" textarea value={c.text} onChange={(v) => upd((p) => { p.considerations[i].text = v; })} />
              </div>
            ))}
            <button className="ad-add" onClick={() => upd((p) => { p.considerations = p.considerations || []; p.considerations.push({ title: '', text: '' }); })}>+ Consideración</button>
          </Section>

          <div className="ad-save-bottom">
            {msg && <span className="ad-msg">{msg}</span>}
            <button className="ad-btn" onClick={savePlan}>Guardar plan</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="ad-section">
      <h3 className="ad-section-title">{title}</h3>
      {children}
    </section>
  );
}
function Field({ label, value, onChange, textarea }) {
  return (
    <div className="ad-field ad-field--grow">
      <label>{label}</label>
      {textarea
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} />
        : <input value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}
function NumField({ label, value, onChange }) {
  return (
    <div className="ad-field">
      <label>{label}</label>
      <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))} />
    </div>
  );
}
function CurField({ value, onChange }) {
  return (
    <div className="ad-field">
      <label>Moneda</label>
      <select value={value || 'ARS'} onChange={(e) => onChange(e.target.value)}>
        <option value="ARS">ARS</option>
        <option value="USD">USD</option>
      </select>
    </div>
  );
}

function MacroEditor({ slug, macros, reload }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);

  const save = (m) => {
    const body = { start_ym: m.start_ym, end_ym: m.end_ym, period: m.period, objective: m.objective, description: m.description };
    const req = m.id ? apiClient.put(`/admin/${slug}/macro/${m.id}`, body) : apiClient.post(`/admin/${slug}/macro`, body);
    req.then(() => { setDraft(null); reload(); }).catch(() => {});
  };
  const del = (id) => { if (window.confirm('¿Borrar esta estrategia macro?')) apiClient.delete(`/admin/${slug}/macro/${id}`).then(reload).catch(() => {}); };

  return (
    <div className="ad-macro">
      <button className="ad-macro-head" onClick={() => setOpen(!open)}>
        <span>{open ? '▾' : '▸'}</span> Estrategia macro ({macros.length})
      </button>
      {open && (
        <div className="ad-macro-body">
          {macros.map((m) => (
            <div key={m.id} className="ad-row-box">
              <div className="ad-row">
                <Field label="Desde (AAAA-MM)" value={m.start_ym} onChange={(v) => save({ ...m, start_ym: v })} />
                <Field label="Hasta (AAAA-MM)" value={m.end_ym} onChange={(v) => save({ ...m, end_ym: v })} />
                <button className="ad-del" onClick={() => del(m.id)}>×</button>
              </div>
              <Field label="Período (ej. Junio – Julio 2026)" value={m.period} onChange={(v) => save({ ...m, period: v })} />
              <Field label="Objetivo macro" value={m.objective || ''} onChange={(v) => save({ ...m, objective: v })} />
              <Field label="Descripción" textarea value={m.description || ''} onChange={(v) => save({ ...m, description: v })} />
            </div>
          ))}
          {draft
            ? (
              <div className="ad-row-box">
                <div className="ad-row">
                  <Field label="Desde (AAAA-MM)" value={draft.start_ym} onChange={(v) => setDraft({ ...draft, start_ym: v })} />
                  <Field label="Hasta (AAAA-MM)" value={draft.end_ym} onChange={(v) => setDraft({ ...draft, end_ym: v })} />
                </div>
                <Field label="Período" value={draft.period} onChange={(v) => setDraft({ ...draft, period: v })} />
                <Field label="Objetivo macro" value={draft.objective} onChange={(v) => setDraft({ ...draft, objective: v })} />
                <Field label="Descripción" textarea value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} />
                <button className="ad-btn" onClick={() => save(draft)}>Crear macro</button>
              </div>
            )
            : <button className="ad-add" onClick={() => setDraft({ start_ym: '', end_ym: '', period: '', objective: '', description: '' })}>+ Nueva macro</button>}
          <p className="ad-muted">Los cambios en macro se guardan al editar cada campo.</p>
        </div>
      )}
    </div>
  );
}
