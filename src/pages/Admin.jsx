import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client.js';
import './Admin.css';

const ALL_AMS = ['Juan Ignacio', 'Franco', 'Agustín', 'Chachi'];

// Catálogo de secciones del panel del cliente (elegibles por cliente).
const PANEL_SECTIONS = [
  { key: 'macro', label: 'Estrategia macro (largo plazo)' },
  { key: 'estrategiaMes', label: 'Estrategia del mes' },
  { key: 'facturacion', label: 'Facturación ecommerce' },
  { key: 'ritmo', label: 'Ritmo del mes' },
  { key: 'presupuestoTotal', label: 'Presupuesto total del mes' },
  { key: 'pagos', label: 'Pagos del mes' },
  { key: 'performanceMeta', label: 'Performance Meta' },
  { key: 'roadmap', label: 'Roadmap del mes' },
  { key: 'productos', label: 'Productos estratégicos' },
  { key: 'justificacion', label: 'Justificación de objetivos' },
  { key: 'consideraciones', label: 'Consideraciones y riesgos' },
  { key: 'planificacion', label: 'Planificación de próximos meses' },
  { key: 'tareas', label: 'Tareas' },
];

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

export default function Admin({ onBack, lockedSlug, autoNew }) {
  const [clients, setClients] = useState([]);
  const [slug, setSlug] = useState(lockedSlug || '');
  const [clientData, setClientData] = useState(null);
  const [month, setMonth] = useState('');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const [showNew, setShowNew] = useState(!!autoNew);

  const loadClients = useCallback((selectSlug) => {
    apiClient.get('/admin/clients').then((r) => {
      setClients(r.data.clients || []);
      if (lockedSlug) setSlug(lockedSlug);
      else if (selectSlug) setSlug(selectSlug);
      else if (!slug && r.data.clients?.[0]) setSlug(r.data.clients[0].slug);
    }).catch(() => {});
  }, [slug, lockedSlug]);

  useEffect(() => { loadClients(); /* eslint-disable-next-line */ }, []);

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
        {!lockedSlug && (
          <div className="ad-field">
            <label>Cliente</label>
            <select value={slug} onChange={(e) => setSlug(e.target.value)}>
              {clients.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div className="ad-field">
          <label>Mes</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {(clientData?.months || []).map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          </select>
        </div>
        <button className="ad-btn ad-btn--ghost" onClick={duplicate}>Duplicar mes →</button>
        <button className="ad-btn ad-btn--ghost" onClick={newMonth}>+ Mes en blanco</button>
        {!lockedSlug && <button className="ad-btn ad-btn--ghost" onClick={() => setShowNew(true)}>+ Nuevo cliente</button>}
        <div className="ad-save">
          {msg && <span className="ad-msg">{msg}</span>}
          <button className="ad-btn" onClick={savePlan} disabled={!plan}>Guardar plan</button>
        </div>
      </div>

      {showNew && <NewClientForm onClose={() => setShowNew(false)} onCreated={(s) => { setShowNew(false); loadClients(s); }} />}

      {slug && <ClientConfigEditor slug={slug} />}

      {clientData && (
        <div className="ad-strategy-head">
          <h2 className="ad-strategy-title">Estrategia</h2>
          <p className="ad-muted">La <strong>macro</strong> (largo plazo, por temporada) + los <strong>meses (micro)</strong>. Lo micro de cada mes se alimenta de su Plan de medios. Elegí el mes arriba para editar su contenido.</p>
        </div>
      )}

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

const TN_APP_ID = '33450';
const CAPS = [
  { k: 'ecommerce', l: 'Ecommerce (Tienda Nube)' },
  { k: 'meta', l: 'Pauta en Meta' },
  { k: 'tiktok', l: 'Pauta en TikTok' },
  { k: 'contenido', l: 'Contenido / grabaciones' },
  { k: 'variable', l: 'Cobra componente variable' },
  { k: 'web', l: 'Email mkt + gestión web' },
];

function AdAccountSelect({ value, onChange, label }) {
  const [accounts, setAccounts] = useState(null);
  useEffect(() => {
    apiClient.get('/accounts').then((r) => setAccounts(r.data || [])).catch(() => setAccounts([]));
  }, []);
  const norm = (v) => String(v || '').replace('act_', '');
  const cur = norm(value);
  const inList = accounts && accounts.some((a) => norm(a.id) === cur);
  return (
    <div className="ad-field ad-field--grow">
      <label>{label || 'Cuenta publicitaria (Meta)'}</label>
      {accounts === null
        ? <input value="Cargando cuentas…" readOnly />
        : (
          <select value={cur} onChange={(e) => onChange(e.target.value)}>
            <option value="">— Sin cuenta —</option>
            {accounts.map((a) => <option key={a.id} value={norm(a.id)}>{a.name} ({norm(a.id)})</option>)}
            {cur && !inList && <option value={cur}>{cur} (guardada)</option>}
          </select>
        )}
    </div>
  );
}

function CapsEditor({ caps, onToggle }) {
  return (
    <div className="ad-caps">
      {CAPS.map((c) => (
        <label key={c.k} className="ad-cap">
          <input type="checkbox" checked={!!caps[c.k]} onChange={() => onToggle(c.k)} />
          <span>{c.l}</span>
        </label>
      ))}
    </div>
  );
}

const slugify = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const YEAR_NOW = new Date().getFullYear();
const MONTH_OPTS = Array.from({ length: 12 }, (_, i) => `${YEAR_NOW}-${String(i + 1).padStart(2, '0')}`);

function NewClientForm({ onClose, onCreated }) {
  const [f, setF] = useState({
    name: '', slug: '', accessKey: '', paymentsKey: '', metaAccountId: '', am: '', type: 'ecommerce',
    capabilities: { meta: true, ecommerce: true, tiktok: true, contenido: true, variable: true, web: true },
    variableBase: 0,
    bankInfo: { titular: '', alias: '', cbu: '', observaciones: '' },
    months: [`${YEAR_NOW}-${String(new Date().getMonth() + 1).padStart(2, '0')}`],
  });
  const [err, setErr] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setName = (v) => setF((s) => ({ ...s, name: v, slug: slugify(v), accessKey: s.accessKey || `${slugify(v)}2026` }));
  const setBank = (k, v) => setF((s) => ({ ...s, bankInfo: { ...s.bankInfo, [k]: v } }));
  const toggleCap = (k) => setF((s) => ({ ...s, capabilities: { ...s.capabilities, [k]: !s.capabilities[k] } }));
  const toggleMonth = (m) => setF((s) => ({ ...s, months: s.months.includes(m) ? s.months.filter((x) => x !== m) : [...s.months, m] }));

  const create = () => {
    if (!f.name) { setErr('Poné el nombre del cliente.'); return; }
    if (!f.metaAccountId) { setErr('Tenés que asociar una cuenta publicitaria de tu portfolio.'); return; }
    if (!f.accessKey) { setErr('Falta la clave de acceso.'); return; }
    const config = {
      name: f.name, accessKey: f.accessKey, paymentsKey: f.paymentsKey || f.accessKey,
      metaAccountId: f.metaAccountId || null, am: f.am || '', type: f.type,
      capabilities: { ...f.capabilities, ecommerce: f.type === 'ecommerce' ? f.capabilities.ecommerce : false },
      variable: { base: Number(f.variableBase) || 0, rate: 0.03 }, bankInfo: f.bankInfo,
    };
    apiClient.post('/admin/clients', { slug: f.slug, config, months: f.months })
      .then(() => onCreated(f.slug))
      .catch((e) => setErr(e.response?.data?.message || e.message || 'Error al crear'));
  };

  return (
    <div className="ad-section ad-new">
      <div className="ad-row" style={{ justifyContent: 'space-between' }}>
        <h3 className="ad-section-title">Nuevo cliente</h3>
        <button className="ad-del" onClick={onClose}>×</button>
      </div>
      <Field label="Nombre del cliente" value={f.name} onChange={setName} />
      {f.slug && <p className="ad-muted" style={{ margin: '-4px 0 8px' }}>URL: /cliente/<strong>{f.slug}</strong></p>}

      <div className="ad-row">
        <div className="ad-field">
          <label>Tipo de cliente</label>
          <select value={f.type} onChange={(e) => set('type', e.target.value)}>
            <option value="ecommerce">Ecommerce</option>
            <option value="servicios">Servicios</option>
          </select>
        </div>
        <div className="ad-field">
          <label>Responsable (AM)</label>
          <select value={f.am} onChange={(e) => set('am', e.target.value)}>
            <option value="">— Sin asignar —</option>
            {ALL_AMS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <AdAccountSelect value={f.metaAccountId} onChange={(v) => set('metaAccountId', v)} label="Cuenta publicitaria (Meta) — obligatoria" />

      <div className="ad-row">
        <Field label="Clave de acceso (cliente)" value={f.accessKey} onChange={(v) => set('accessKey', v)} />
        <Field label="Clave de pagos (admin)" value={f.paymentsKey} onChange={(v) => set('paymentsKey', v)} />
      </div>

      <div className="ad-sublabel">Estrategia — meses de trabajo (micro)</div>
      <p className="ad-muted" style={{ margin: '0 0 8px' }}>Elegí los meses que vas a trabajar. Cada uno se va a alimentar de su Plan de medios.</p>
      <div className="ad-caps">
        {MONTH_OPTS.map((m) => (
          <label key={m} className="ad-cap">
            <input type="checkbox" checked={f.months.includes(m)} onChange={() => toggleMonth(m)} />
            <span>{fmtMonth(m)}</span>
          </label>
        ))}
      </div>

      <div className="ad-sublabel">¿Qué le ofrecés?</div>
      <CapsEditor caps={f.capabilities} onToggle={toggleCap} />
      {f.capabilities.variable && <NumField label="Base fija del variable (ARS)" value={f.variableBase} onChange={(v) => set('variableBase', v)} />}
      <div className="ad-sublabel">Datos bancarios de alquimia</div>
      <div className="ad-row">
        <Field label="Titular" value={f.bankInfo.titular} onChange={(v) => setBank('titular', v)} />
        <Field label="Alias" value={f.bankInfo.alias} onChange={(v) => setBank('alias', v)} />
      </div>
      <Field label="CBU / CVU" value={f.bankInfo.cbu} onChange={(v) => setBank('cbu', v)} />
      {err && <div className="ad-err">{err}</div>}
      <button className="ad-btn" onClick={create}>Crear cliente</button>
      <p className="ad-muted">Después de crearlo: cargá su plan mensual, y si tiene ecommerce conectá Tienda Nube desde la config del cliente.</p>
    </div>
  );
}

function ClientConfigEditor({ slug }) {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!open || cfg) return;
    apiClient.get(`/admin/clients/${slug}/config`).then((r) => setCfg(r.data.config)).catch(() => {});
  }, [open, slug, cfg]);
  useEffect(() => { setCfg(null); }, [slug]);

  const save = () => {
    const config = { ...cfg };
    delete config.slug; delete config.active;
    if (config.tiendanube) delete config.tiendanube; // no pisar el token
    apiClient.put(`/admin/clients/${slug}`, { config })
      .then(() => { setMsg('✓ Guardado'); setTimeout(() => setMsg(''), 2000); })
      .catch(() => setMsg('Error'));
  };

  const tnUrl = `https://www.tiendanube.com/apps/${TN_APP_ID}/authorize?state=${slug}`;

  return (
    <div className="ad-macro">
      <button className="ad-macro-head" onClick={() => setOpen(!open)}>
        <span>{open ? '▾' : '▸'}</span> Config del cliente
      </button>
      {open && cfg && (
        <div className="ad-macro-body">
          <div className="ad-row">
            <Field label="Nombre" value={cfg.name || ''} onChange={(v) => setCfg({ ...cfg, name: v })} />
            <AdAccountSelect value={cfg.metaAccountId || ''} onChange={(v) => setCfg({ ...cfg, metaAccountId: v })} />
            <div className="ad-field">
              <label>Responsable (AM)</label>
              <select value={cfg.am || ''} onChange={(e) => setCfg({ ...cfg, am: e.target.value })}>
                <option value="">— Sin asignar —</option>
                {ALL_AMS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="ad-field">
              <label>Tipo de cliente</label>
              <select value={cfg.type || (cfg.capabilities?.ecommerce ? 'ecommerce' : 'servicios')} onChange={(e) => setCfg({ ...cfg, type: e.target.value })}>
                <option value="ecommerce">Ecommerce</option>
                <option value="servicios">Servicios</option>
              </select>
            </div>
          </div>
          <div className="ad-row">
            <Field label="Clave de acceso" value={cfg.accessKey || ''} onChange={(v) => setCfg({ ...cfg, accessKey: v })} />
            <Field label="Clave de pagos" value={cfg.paymentsKey || ''} onChange={(v) => setCfg({ ...cfg, paymentsKey: v })} />
          </div>
          <div className="ad-sublabel">Capacidades</div>
          <CapsEditor caps={cfg.capabilities || {}} onToggle={(k) => setCfg({ ...cfg, capabilities: { ...(cfg.capabilities || {}), [k]: !(cfg.capabilities || {})[k] } })} />

          <div className="ad-sublabel">Secciones del panel del cliente</div>
          <div className="ad-caps">
            {PANEL_SECTIONS.map((s) => {
              const on = !!(cfg.panel?.sections || {})[s.key];
              return (
                <label key={s.key} className="ad-cap">
                  <input type="checkbox" checked={on} onChange={() => setCfg({ ...cfg, panel: { ...(cfg.panel || {}), sections: { ...((cfg.panel || {}).sections || {}), [s.key]: !on } } })} />
                  <span>{s.label}</span>
                </label>
              );
            })}
          </div>
          {(cfg.capabilities || {}).variable && (
            <NumField label="Base fija del variable (ARS)" value={cfg.variable?.base} onChange={(v) => setCfg({ ...cfg, variable: { ...(cfg.variable || { rate: 0.03 }), base: v } })} />
          )}
          <div className="ad-sublabel">Tienda Nube</div>
          <div className="ad-tn">
            {cfg.tiendanube?.connected
              ? (
                <>
                  <span className="ad-tn-ok">✓ Tienda Nube conectada (#{cfg.tiendanube.storeId})</span>
                  <a className="ad-btn ad-btn--ghost" href={tnUrl} target="_blank" rel="noreferrer">Reconectar</a>
                </>
              )
              : (
                <>
                  <a className="ad-btn" href={tnUrl} target="_blank" rel="noreferrer">Conectar Tienda Nube</a>
                  <span className="ad-muted">Conectá la tienda de este cliente para traer facturación y productos.</span>
                </>
              )}
          </div>
          <div className="ad-row" style={{ justifyContent: 'flex-end' }}>
            {msg && <span className="ad-msg">{msg}</span>}
            <button className="ad-btn" onClick={save}>Guardar config</button>
          </div>
        </div>
      )}
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
