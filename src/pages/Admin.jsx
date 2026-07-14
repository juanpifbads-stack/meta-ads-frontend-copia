import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import './Admin.css';

const ALL_AMS = ['Juan Ignacio', 'Franco', 'Agustín', 'Chachi'];

// Secciones OPCIONALES del panel (las obligatorias van siempre, no se preguntan).
const OPTIONAL_SECTIONS = [
  { key: 'presupuestoTotal', label: 'Presupuesto total del mes' },
  { key: 'pagos', label: 'Pagos del mes' },
  { key: 'roadmap', label: 'Roadmap del mes' },
  { key: 'productos', label: 'Productos estratégicos (Tienda Nube)' },
  { key: 'planificacion', label: 'Planificación de próximos meses' },
];
const MANDATORY_LABELS = ['Estrategia macro', 'Estrategia del mes', 'Facturación ecommerce', 'Ritmo del mes', 'Performance Meta', 'Justificación de objetivos', 'Consideraciones y riesgos', 'Tareas'];

// Servicios facturables (con monto por cada uno).
const SERVICES = [
  { k: 'meta', l: 'Pauta en Meta' },
  { k: 'tiktok', l: 'Pauta en TikTok' },
  { k: 'contenido', l: 'Contenido / grabaciones' },
  { k: 'web', l: 'Email mkt + gestión web' },
];
const fmtArs = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

function ServicesEditor({ caps, fees, onToggle, onFee }) {
  const total = SERVICES.reduce((s, sv) => s + (caps[sv.k] ? (Number(fees[sv.k]) || 0) : 0), 0);
  return (
    <div className="ad-services">
      {SERVICES.map((sv) => (
        <div key={sv.k} className="ad-service-row">
          <label className="ad-cap"><input type="checkbox" checked={!!caps[sv.k]} onChange={() => onToggle(sv.k)} /><span>{sv.l}</span></label>
          {caps[sv.k] && (
            <div className="ad-field ad-service-fee">
              <label>Monto (ARS)</label>
              <input className="mp-num" type="number" value={fees[sv.k] === 0 || fees[sv.k] == null ? '' : fees[sv.k]} placeholder="0" onChange={(e) => onFee(sv.k, e.target.value === '' ? 0 : parseFloat(e.target.value))} />
            </div>
          )}
        </div>
      ))}
      <div className="ad-service-total">Total servicios: <strong>{fmtArs(total)}</strong></div>
    </div>
  );
}

function VariableEditor({ variable, onChange }) {
  const v = variable || { mode: 'none', base: 0, rate: 0.03 };
  return (
    <div className="ad-variable">
      <div className="ad-field">
        <label>Componente variable</label>
        <select value={v.mode || 'none'} onChange={(e) => onChange({ ...v, mode: e.target.value })}>
          <option value="none">Sin variable</option>
          <option value="percent">Variable sobre % de facturación</option>
          <option value="differential">Variable sobre el diferencial (con base fija)</option>
        </select>
      </div>
      {v.mode === 'percent' && <NumField label="% sobre facturación" value={Math.round((v.rate || 0) * 1000) / 10} onChange={(x) => onChange({ ...v, rate: (Number(x) || 0) / 100 })} />}
      {v.mode === 'differential' && (
        <div className="ad-row">
          <NumField label="Base fija (ARS)" value={v.base} onChange={(x) => onChange({ ...v, base: Number(x) || 0 })} />
          <NumField label="% sobre el diferencial" value={Math.round((v.rate || 0) * 1000) / 10} onChange={(x) => onChange({ ...v, rate: (Number(x) || 0) / 100 })} />
        </div>
      )}
    </div>
  );
}

// Select de mes (para rangos de macro). Cubre año pasado, actual y próximo.
const MONTH_RANGE = (() => {
  const y = new Date().getFullYear();
  const out = [];
  for (let yr = y - 1; yr <= y + 1; yr++) for (let m = 1; m <= 12; m++) out.push(`${yr}-${String(m).padStart(2, '0')}`);
  return out;
})();
function MonthSelect({ label, value, onChange }) {
  const cur = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  return (
    <div className="ad-field">
      <label>{label}</label>
      <select value={value || cur} onChange={(e) => onChange(e.target.value)}>
        {MONTH_RANGE.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}
      </select>
    </div>
  );
}

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
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.legacy;
  const [clients, setClients] = useState([]);
  const [slug, setSlug] = useState(lockedSlug || '');
  const [clientData, setClientData] = useState(null);
  const [month, setMonth] = useState(currentYM()); // arranca en el mes actual → el micro siempre está disponible
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const [showNew, setShowNew] = useState(!!autoNew);
  const [showChurn, setShowChurn] = useState(false);
  // Apartado de configuración: 'cliente' (config del cliente) | 'portal' (lo que ve: secciones + estrategia)
  const [cfgSection, setCfgSection] = useState('cliente');

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
      // Autoseleccionar el mes: el último cargado o, si no hay, el mes actual.
      // Así el editor micro aparece siempre (antes quedaba '' y no se veía nada).
      const months = (r.data.months || []).slice().sort();
      // OJO: no hacer setPlan(null) acá. Si el mes elegido coincide con el que
      // ya estaba (p.ej. currentYM), el efecto de loadPlan NO se vuelve a disparar
      // y el editor quedaría oculto para siempre. loadPlan repone el plan solo
      // (depende de [slug, month]).
      setMonth(months.length ? months[months.length - 1] : currentYM());
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

  // Mover una sesión de grabación de una semana a otra.
  const moveRecording = (fromWeek, recIndex, toWeek) => {
    if (fromWeek === toWeek) return;
    upd((p) => {
      const rec = p.roadmap[fromWeek].recordings[recIndex];
      p.roadmap[fromWeek].recordings.splice(recIndex, 1);
      p.roadmap[toWeek].recordings = p.roadmap[toWeek].recordings || [];
      p.roadmap[toWeek].recordings.push(rec);
    });
  };

  const savePlan = () => {
    setMsg('Guardando…');
    // La etiqueta del mes es siempre la fecha del mes.
    const payload = { ...plan, strategyMonthly: { ...(plan.strategyMonthly || {}), month: fmtMonth(month) } };
    apiClient.put(`/admin/${slug}/plan/${month}`, { plan: payload })
      .then(() => { setMsg('✓ Guardado'); setTimeout(() => setMsg(''), 2000); })
      .catch(() => setMsg('Error al guardar'));
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

      {!showNew && !lockedSlug && (
        <div className="ad-controls">
          <div className="ad-field">
            <label>Cliente</label>
            <select value={slug} onChange={(e) => setSlug(e.target.value)}>
              {clients.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <button className="ad-btn ad-btn--ghost" onClick={() => setShowNew(true)}>+ Nuevo cliente</button>
          <button className="ad-btn ad-btn--ghost" onClick={() => setShowChurn((v) => !v)}>{showChurn ? 'Cerrar bajas' : 'Bajas'}</button>
        </div>
      )}

      {showChurn && <ChurnLog />}

      {showNew && <NewClientForm onClose={onBack} onCreated={(s) => { setShowNew(false); loadClients(s); }} />}

      {/* Sub-apartados de configuración: Cliente / Portal del cliente */}
      {!showNew && slug && (
        <div className="ad-cfg-tabs">
          <button className={`ad-cfg-tab ${cfgSection === 'cliente' ? 'ad-cfg-tab--on' : ''}`} onClick={() => setCfgSection('cliente')}>Cliente</button>
          <button className={`ad-cfg-tab ${cfgSection === 'portal' ? 'ad-cfg-tab--on' : ''}`} onClick={() => setCfgSection('portal')}>Portal del cliente</button>
          <button className={`ad-cfg-tab ${cfgSection === 'onboarding' ? 'ad-cfg-tab--on' : ''}`} onClick={() => setCfgSection('onboarding')}>Onboarding</button>
        </div>
      )}

      {/* Cliente: solo su config. Portal: Estrategia PRIMERO, y abajo la config del portal. */}
      {!showNew && slug && cfgSection === 'cliente' && <ClientConfigEditor slug={slug} section={cfgSection} />}

      {!showNew && clientData && cfgSection === 'portal' && (
        <div className="ad-strategy-head">
          <h2 className="ad-strategy-title">Estrategia</h2>
        </div>
      )}

      {!showNew && clientData && cfgSection === 'portal' && <MacroEditor slug={slug} macros={clientData.macros} reload={() => loadClient(slug)} />}

      {/* Estrategia micro (mensual): mismo globo que el macro. El mes se cambia
          en vivo (carga automática), y un único botón "Guardar micro" (full-width,
          adentro del globo, igual al macro) guarda la estrategia del mes. */}
      {!showNew && clientData && cfgSection === 'portal' && (
        <div className="ad-macro">
          <div className="ad-macro-head" style={{ cursor: 'default' }}>Estrategia micro</div>
          <div className="ad-macro-body">
            <div className="ad-row-box">
              <div className="ad-field">
                <label>Mes</label>
                <select value={month} onChange={(e) => setMonth(e.target.value)}>
                  {Array.from(new Set([...(clientData?.months || []), currentYM()])).sort().map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}
                </select>
              </div>
              {loading && <p className="ad-muted">Cargando plan…</p>}
              {plan && !loading && (
                <>
                  <Field label="Objetivo del mes" value={plan.strategyMonthly?.objective || ''} onChange={(v) => upd((p) => { p.strategyMonthly = { ...p.strategyMonthly, objective: v }; })} />
                  <Field label="Descripción" textarea value={plan.strategyMonthly?.description || ''} onChange={(v) => upd((p) => { p.strategyMonthly = { ...p.strategyMonthly, description: v }; })} />
                  {msg && <span className="ad-msg">{msg}</span>}
                  <button className="ad-btn" onClick={savePlan} disabled={!plan || !month}>Guardar micro</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Config del portal (secciones, onboarding, links) — DEBAJO de Estrategia. */}
      {!showNew && slug && cfgSection === 'portal' && <ClientConfigEditor slug={slug} section={cfgSection} />}
      {!showNew && slug && cfgSection === 'onboarding' && <ClientConfigEditor slug={slug} section="onboarding" />}
      {!showNew && slug && cfgSection === 'onboarding' && <OnboardingEditor slug={slug} clients={clients} />}
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
function Field({ label, value, onChange, textarea, ph, disabled }) {
  return (
    <div className="ad-field ad-field--grow">
      <label>{label}{disabled ? ' 🔒' : ''}</label>
      {textarea
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} disabled={disabled} />
        : <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} disabled={disabled} />}
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

function AdAccountSelect({ value, onChange, label, disabled, all }) {
  const [accounts, setAccounts] = useState(null);
  useEffect(() => {
    apiClient.get('/accounts', { params: all ? { scope: 'all' } : {} }).then((r) => setAccounts(r.data || [])).catch(() => setAccounts([]));
  }, [all]);
  const norm = (v) => String(v || '').replace('act_', '');
  const cur = norm(value);
  const inList = accounts && accounts.some((a) => norm(a.id) === cur);
  return (
    <div className="ad-field ad-field--grow">
      <label>{label || 'Cuenta publicitaria (Meta)'}{disabled ? ' 🔒' : ''}</label>
      {accounts === null
        ? <input value="Cargando cuentas…" readOnly />
        : (
          <select value={cur} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
            <option value="">— Sin cuenta —</option>
            {accounts.map((a) => <option key={a.id} value={norm(a.id)}>{a.name} ({norm(a.id)})</option>)}
            {cur && !inList && <option value={cur}>{cur} (guardada)</option>}
          </select>
        )}
    </div>
  );
}

// Selector de VARIAS cuentas publicitarias (para clientes con más de una cuenta).
function MultiAccountSelect({ ids, onChange, disabled, all }) {
  const [accounts, setAccounts] = useState(null);
  useEffect(() => {
    apiClient.get('/accounts', { params: all ? { scope: 'all' } : {} }).then((r) => setAccounts(r.data || [])).catch(() => setAccounts([]));
  }, [all]);
  const norm = (v) => String(v || '').replace('act_', '');
  const sel = (ids || []).map(norm);
  const nameOf = (id) => { const a = (accounts || []).find((x) => norm(x.id) === norm(id)); return a ? a.name : norm(id); };
  const add = (id) => { const n = norm(id); if (n && !sel.includes(n)) onChange([...sel, n]); };
  const remove = (id) => onChange(sel.filter((x) => x !== norm(id)));
  const available = (accounts || []).filter((a) => !sel.includes(norm(a.id)));
  return (
    <div className="ad-field ad-field--grow">
      <label>Cuentas publicitarias (Meta){disabled ? ' 🔒' : ''}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {sel.length === 0 && <span className="ad-muted">— Sin cuenta —</span>}
        {sel.map((id) => (
          <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eef0ff', color: '#1b1fe8', borderRadius: 999, padding: '4px 10px', fontSize: 13 }}>
            {nameOf(id)} <span className="ad-muted" style={{ fontSize: 11 }}>({id})</span>
            {!disabled && <button className="ad-del" style={{ marginLeft: 2 }} onClick={() => remove(id)}>×</button>}
          </span>
        ))}
      </div>
      {!disabled && (
        <select value="" onChange={(e) => { if (e.target.value) add(e.target.value); }}>
          <option value="">+ Agregar cuenta…</option>
          {accounts === null ? <option disabled>Cargando…</option> : available.map((a) => <option key={a.id} value={norm(a.id)}>{a.name} ({norm(a.id)})</option>)}
        </select>
      )}
    </div>
  );
}

const slugify = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function NewClientForm({ onClose, onCreated }) {
  const { user } = useAuth();
  const isPaid = user?.role === 'paid' && !user?.legacy;
  const [f, setF] = useState({ name: '', slug: '', type: 'ecommerce', am: '' });
  const [err, setErr] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setName = (v) => setF((s) => ({ ...s, name: v, slug: slugify(v) }));

  const create = () => {
    if (!f.name.trim()) { setErr('Poné el nombre del cliente.'); return; }
    // Mínimo: nombre, tipo y responsable. El resto se configura después.
    const config = {
      name: f.name.trim(), type: f.type, am: isPaid ? '' : (f.am || ''),
      accessKey: `${f.slug}2026`, paymentsKey: `${f.slug}2026`,
      capabilities: { ecommerce: f.type === 'ecommerce', meta: true },
      // Cliente nuevo arranca en onboarding (formulario + contenido + fechas).
      onboarding: { pedirFormulario: true, pedirContenido: true, mostrarFechas: true },
      // `panel` activa el modo portal moderno (progresivo). Sin esto caía a modo legacy (Moka).
      panel: { sections: {} },
    };
    apiClient.post('/admin/clients', { slug: f.slug, config })
      .then(() => onCreated(f.slug))
      .catch((e) => setErr(e.response?.data?.message || e.message || 'Error al crear'));
  };

  return (
    <div className="ad-section ad-new">
      <h3 className="ad-section-title">Nuevo cliente</h3>
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
        {!isPaid && (
          <div className="ad-field">
            <label>Responsable (AM)</label>
            <select value={f.am} onChange={(e) => set('am', e.target.value)}>
              <option value="">— Sin asignar —</option>
              {ALL_AMS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}
      </div>

      {err && <div className="ad-err">{err}</div>}
      <button className="ad-btn" onClick={create}>Crear cliente</button>
      <p className="ad-muted">El resto (cuenta de Meta, claves, servicios, estrategia, etc.) se configura después en la config del cliente.</p>
    </div>
  );
}

function ClientConfigEditor({ slug, section = 'cliente' }) {
  const { user } = useAuth();
  const isPaid = user?.role === 'paid' && !user?.legacy;
  const [open, setOpen] = useState(true);
  const [showLinks, setShowLinks] = useState(false);
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState('');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const portalLink = `${origin}/cliente/${slug}`;

  useEffect(() => {
    apiClient.get(`/admin/clients/${slug}/config`).then((r) => setCfg(r.data.config)).catch(() => {});
  }, [slug]);

  const save = () => {
    const config = { ...cfg };
    delete config.slug; delete config.active;
    if (config.tiendanube) delete config.tiendanube; // no pisar el token (lo preserva el backend)
    config.capabilities = {
      ...(config.capabilities || {}),
      ecommerce: (config.type || 'ecommerce') === 'ecommerce',
      // Un paid no edita la variable: no recalculamos esa capability (la preserva el backend).
      ...(isPaid ? {} : { variable: (config.variable?.mode || 'none') !== 'none' }),
    };
    apiClient.put(`/admin/clients/${slug}`, { config })
      .then(() => { setMsg('✓ Guardado'); setTimeout(() => setMsg(''), 2000); })
      .catch(() => setMsg('Error'));
  };

  const setCap = (k) => setCfg({ ...cfg, capabilities: { ...(cfg.capabilities || {}), [k]: !(cfg.capabilities || {})[k] } });
  const setFee = (k, v) => setCfg({ ...cfg, fees: { ...(cfg.fees || {}), [k]: v } });
  const tnUrl = `https://www.tiendanube.com/apps/${TN_APP_ID}/authorize?state=${slug}`;

  return (
    <>
    {section === 'portal' && <h2 className="ad-strategy-title" style={{ marginTop: 28 }}>Componentes que ve el cliente</h2>}
    <div className="ad-macro">
      {section !== 'portal' && (
        <div className="ad-macro-head" style={{ cursor: 'default' }}>
          {section === 'onboarding' ? 'Configuración de onboarding' : 'Datos del cliente'}
        </div>
      )}
      {cfg && (
        <div className="ad-macro-body">
          {section === 'cliente' && (
            <>
              {isPaid && <p className="ad-muted" style={{ margin: '0 0 8px' }}>🔒 Algunos campos solo los puede editar un administrador.</p>}
              <div className="ad-row">
                <Field label="Nombre" value={cfg.name || ''} onChange={(v) => setCfg({ ...cfg, name: v })} disabled={isPaid} />
                <MultiAccountSelect
                  ids={cfg.metaAccountIds && cfg.metaAccountIds.length ? cfg.metaAccountIds : (cfg.metaAccountId ? [cfg.metaAccountId] : [])}
                  onChange={(arr) => setCfg({ ...cfg, metaAccountIds: arr, metaAccountId: arr[0] || '' })}
                  disabled={isPaid}
                />
                {!isPaid && (
                  <div className="ad-field">
                    <label>Responsable (AM)</label>
                    <select value={cfg.am || ''} onChange={(e) => setCfg({ ...cfg, am: e.target.value })}>
                      <option value="">— Sin asignar —</option>
                      {ALL_AMS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                )}
                <div className="ad-field">
                  <label>Tipo de cliente{isPaid ? ' 🔒' : ''}</label>
                  <select value={cfg.type || (cfg.capabilities?.ecommerce ? 'ecommerce' : 'servicios')} onChange={(e) => setCfg({ ...cfg, type: e.target.value })} disabled={isPaid}>
                    <option value="ecommerce">Ecommerce</option>
                    <option value="servicios">Servicios</option>
                  </select>
                </div>
              </div>
              <div className="ad-row">
                <Field label="Email del cliente" value={cfg.email || ''} onChange={(v) => setCfg({ ...cfg, email: v })} />
              </div>
              <div className="ad-row">
                <Field label="Clave de acceso" value={cfg.accessKey || ''} onChange={(v) => setCfg({ ...cfg, accessKey: v })} />
                {!isPaid && <Field label="Clave de pagos" value={cfg.paymentsKey || ''} onChange={(v) => setCfg({ ...cfg, paymentsKey: v })} />}
              </div>

              {/* Servicios/monto y componente variable: se manejan en el panel de Finanzas
                  (fee por servicio + variable). Se sacaron de acá para no duplicar. */}

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

              {!isPaid && <ChurnBlock slug={slug} name={cfg.name || slug} />}
            </>
          )}

          {section === 'onboarding' && (
            <>
              <div className="ad-sublabel" style={{ marginTop: 0 }}>Qué se le pide al cliente</div>
              <div className="ad-caps">
                {[['pedirFormulario', 'Pedir formulario de marca'], ['pedirContenido', 'Pedir carpeta de contenido'], ['mostrarFechas', 'Mostrar fechas / calendario']].map(([k, label]) => {
                  const on = !!(cfg.onboarding || {})[k];
                  return (
                    <label key={k} className="ad-cap">
                      <input type="checkbox" checked={on} onChange={() => setCfg({ ...cfg, onboarding: { ...(cfg.onboarding || {}), [k]: !on } })} />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
              {/* Presentar: hasta prenderlo, el cliente ve SOLO tareas + calendario. */}
              <div style={{ marginTop: 14 }}>
                <button className={`ad-btn ${cfg.onboarding?.presentado ? 'ad-btn--ghost' : ''}`}
                  onClick={() => setCfg({ ...cfg, onboarding: { ...(cfg.onboarding || {}), presentado: !(cfg.onboarding?.presentado) } })}>
                  {cfg.onboarding?.presentado ? '✓ Portal presentado — volver a onboarding' : 'Presentar portal al cliente →'}
                </button>
                <p className="ad-muted" style={{ margin: '6px 0 0', fontSize: 12 }}>Hasta presentarlo, el cliente ve solo tareas y calendario. Al presentarlo, ve el resto (cada sección aparece cuando tiene datos). Acordate de <strong>Guardar config</strong>.</p>
              </div>
            </>
          )}

          {section === 'portal' && (
            <>
              {cfg.type === 'servicios' && (
                <div style={{ marginBottom: 18 }}>
                  <div className="ad-sublabel" style={{ marginTop: 0 }}>Calendario de visitas (Google · iCal)</div>
                  <Field label="URL secreta en formato iCal" value={cfg.service?.calendarIcs || ''} onChange={(v) => setCfg({ ...cfg, service: { ...(cfg.service || {}), calendarIcs: v } })} ph="https://calendar.google.com/…/basic.ics" />
                  <p className="ad-muted" style={{ margin: '4px 0 0' }}>El embudo del cliente autocompleta las visitas agendadas y canceladas desde este calendario (por el nombre del evento).</p>
                </div>
              )}
              <div className="ad-sublabel">Secciones opcionales</div>
              <div className="ad-caps">
                {OPTIONAL_SECTIONS.map((s) => {
                  const on = !!(cfg.panel?.sections || {})[s.key];
                  return (
                    <label key={s.key} className="ad-cap">
                      <input type="checkbox" checked={on} onChange={() => setCfg({ ...cfg, panel: { ...(cfg.panel || {}), sections: { ...((cfg.panel || {}).sections || {}), [s.key]: !on } } })} />
                      <span>{s.label}</span>
                    </label>
                  );
                })}
              </div>

              {/* Links del portal (toggle) */}
              <button className="ad-btn ad-btn--ghost ad-btn--sm" style={{ marginTop: 14 }} onClick={() => setShowLinks((v) => !v)}>
                {showLinks ? '▾ Links' : '▸ Links'}
              </button>
              {showLinks && (
                <div className="ad-row" style={{ flexDirection: 'column', gap: 12, marginTop: 10 }}>
                  <div className="ad-row-box">
                    <div className="ad-sublabel" style={{ marginTop: 0 }}>Panel completo (cliente)</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{portalLink}</div>
                    <div className="ad-muted">Clave: <strong>{cfg.accessKey || '—'}</strong></div>
                    <div className="ad-row" style={{ marginTop: 6 }}>
                      <a className="ad-btn ad-btn--ghost ad-btn--sm" href={portalLink} target="_blank" rel="noreferrer">Abrir</a>
                      <button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => navigator.clipboard?.writeText(portalLink)}>Copiar link</button>
                    </div>
                  </div>
                  {!isPaid && (
                    <div className="ad-row-box">
                      <div className="ad-sublabel" style={{ marginTop: 0 }}>Solo pagos (administración)</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{portalLink}/pagos</div>
                      <div className="ad-muted">Clave: <strong>{cfg.paymentsKey || '—'}</strong></div>
                      <div className="ad-row" style={{ marginTop: 6 }}>
                        <a className="ad-btn ad-btn--ghost ad-btn--sm" href={`${portalLink}/pagos`} target="_blank" rel="noreferrer">Abrir</a>
                        <button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => navigator.clipboard?.writeText(`${portalLink}/pagos`)}>Copiar link</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="ad-row" style={{ justifyContent: 'flex-end' }}>
            {msg && <span className="ad-msg">{msg}</span>}
            <button className="ad-btn" onClick={save}>Guardar config</button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

const OB_STATUS = [
  { v: 'pendiente', l: 'Pendiente' },
  { v: 'en_curso', l: 'En curso' },
  { v: 'hecho', l: 'Hecho' },
];

function OnboardingEditor({ slug, clients }) {
  const [open, setOpen] = useState(true); // en el tab Onboarding va abierto por defecto
  const [ob, setOb] = useState(null);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || ob) return;
    apiClient.get(`/admin/${slug}/onboarding`).then((r) => setOb(r.data.onboarding)).catch(() => {});
  }, [open, slug, ob]);
  useEffect(() => { setOb(null); }, [slug]);

  const upd = (fn) => setOb((p) => { const n = structuredClone(p); fn(n); return n; });
  const save = () => {
    setMsg('Guardando…');
    apiClient.put(`/admin/${slug}/onboarding`, { onboarding: ob })
      .then(() => { setMsg('✓ Guardado'); setTimeout(() => setMsg(''), 2000); })
      .catch(() => setMsg('Error al guardar'));
  };

  const link = `${window.location.origin}/cliente/${slug}/onboarding`;
  const copy = () => { navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); };

  // --- Banco de preguntas (global) ---
  const [bank, setBank] = useState(null);
  const [newQ, setNewQ] = useState({ marca: '', producto: '', audiencia: '' });
  const reloadBank = () => apiClient.get('/admin/onboarding/questions').then((r) => setBank(r.data.questions || [])).catch(() => {});
  useEffect(() => { if (open && bank === null) reloadBank(); }, [open, bank]);
  const addQ = (section) => {
    const text = (newQ[section] || '').trim();
    if (!text) return;
    apiClient.post('/admin/onboarding/questions', { section, text }).then(() => { setNewQ((s) => ({ ...s, [section]: '' })); reloadBank(); }).catch(() => {});
  };
  const setQActive = (q, active) => apiClient.put(`/admin/onboarding/questions/${q.id}`, { active }).then(reloadBank).catch(() => {});
  const editQText = (q, text) => apiClient.put(`/admin/onboarding/questions/${q.id}`, { text }).catch(() => {});
  const isSelected = (id) => (ob?.selectedQuestionIds || []).includes(id);
  const toggleSelect = (id) => upd((p) => { const set = new Set(p.selectedQuestionIds || []); set.has(id) ? set.delete(id) : set.add(id); p.selectedQuestionIds = [...set]; });

  // --- PDF de respuestas del cliente ---
  const downloadAnswersPdf = () => {
    const clientName = clients.find((c) => c.slug === slug)?.name || slug;
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const secOf = {}; (bank || []).forEach((q) => { secOf[q.id] = q.section; });
    const SEC_LBL = { marca: 'Marca', producto: 'Producto', audiencia: 'Audiencia', otras: 'Otras' };
    const groups = { marca: [], producto: [], audiencia: [], otras: [] };
    (ob.answers || []).forEach((a) => { (groups[a.questionId === '__aud_general__' ? 'audiencia' : (secOf[a.questionId] || 'otras')]).push(a); });
    // Etiqueta del buyer persona (orden según ob.personas).
    const personaIdx = {}; (ob.personas || []).forEach((p, i) => { personaIdx[p.id] = i + 1; });
    const personaLabel = (id) => `Buyer persona ${personaIdx[id] || '?'}`;
    const renderQA = (a) => `<div class="qa"><div class="q">${a.personaId ? `<span class="ptag">${esc(personaLabel(a.personaId))}</span> ` : ''}${esc(a.questionText)}</div><div class="a">${esc(a.answer) || '<span class="empty">— sin responder —</span>'}</div></div>`;
    const personaDescs = (ob.personas || []).filter((p) => (p.description || '').trim()).map((p, i) => `<div class="qa"><div class="q">${esc(`Buyer persona ${i + 1}`)} — quién es</div><div class="a">${esc(p.description)}</div></div>`).join('');
    const body = ['marca', 'producto', 'audiencia', 'otras'].filter((k) => groups[k].length).map((k) => `
      <div class="sec"><div class="sec-t">${SEC_LBL[k]}</div>${k === 'audiencia' ? personaDescs : ''}${groups[k].map(renderQA).join('')}</div>`).join('');
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Onboarding — ${esc(clientName)}</title>
      <style>@page{margin:36px;} body{font-family:-apple-system,system-ui,Helvetica,Arial,sans-serif;color:#15161a;padding:40px;line-height:1.5;}
      .brand{font-family:monospace;color:#1b1fe8;font-weight:700;font-size:15px;} h1{font-size:28px;margin:6px 0 2px;}
      .sub{color:#5b5e66;margin-bottom:22px;} .rule{height:3px;background:#15161a;margin:14px 0 24px;}
      .sec{margin-bottom:22px;page-break-inside:avoid;} .sec-t{font-family:monospace;text-transform:uppercase;letter-spacing:.05em;font-size:13px;font-weight:700;border-bottom:2px solid #15161a;padding-bottom:5px;margin-bottom:12px;}
      .qa{margin-bottom:14px;} .q{font-weight:700;font-size:14px;white-space:pre-line;} .a{font-size:14px;white-space:pre-wrap;margin-top:2px;} .empty{color:#b0b2ba;}
      .ptag{display:inline-block;background:#eef0ff;color:#1b1fe8;font-family:monospace;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:2px 6px;border-radius:5px;margin-right:4px;}
      .foot{margin-top:28px;font-family:monospace;font-size:10px;color:#b0b2ba;text-align:center;}</style></head><body>
      <div class="brand">alquimia.</div><h1>${esc(clientName)}</h1><div class="sub">Formulario de onboarding</div><div class="rule"></div>
      ${body || '<p>Sin respuestas todavía.</p>'}
      <div class="foot">Generado por alquimia. · ${new Date().toLocaleDateString('es-AR')}</div></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Permití las ventanas emergentes para exportar el PDF.'); return; }
    w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
  };

  return (
    <div className="ad-macro">
      <button className="ad-macro-head" onClick={() => setOpen(!open)}>
        <span>{open ? '▾' : '▸'}</span> Onboarding del cliente
      </button>
      {open && ob && (
        <div className="ad-macro-body">
          {/* Ciclo de vida del onboarding viejo (link a /onboarding, Reunión 1, Desbloquear,
              Roadmap/hitos) se sacó: la página standalone /onboarding se retiró y ahora todo
              vive en el portal unificado (tareas + calendario). Los datos existentes
              (meeting1/roadmap/flags de clientes como Baciver) NO se tocan: save() reenvía
              el objeto ob completo, así que se preservan en la DB. */}

          {/* Formulario de onboarding: banco de preguntas + selección */}
          <div className="ad-sublabel" style={{ marginTop: 18 }}>Formulario de onboarding — banco de preguntas</div>
          <p className="ad-muted" style={{ margin: '0 0 8px' }}>Tildá las preguntas que van para este cliente. El banco se guarda y se reutiliza para todos. "Archivar" = se deja de ofrecer pero no se borra (no afecta a quienes ya respondieron).</p>
          {['marca', 'producto', 'audiencia'].map((sec) => {
            const qs = (bank || []).filter((q) => q.section === sec);
            return (
              <div key={sec} className="ad-row-box">
                <div className="ad-sublabel" style={{ textTransform: 'capitalize', marginTop: 0 }}>{sec}</div>
                <Field label="Descripción de la sección (la ve el cliente arriba de las preguntas)" textarea value={ob.sectionIntros?.[sec] || ''} onChange={(v) => upd((p) => { p.sectionIntros = p.sectionIntros || {}; p.sectionIntros[sec] = v; })} ph={sec === 'audiencia' ? 'Ej: Definamos a quién le hablamos. La 1ª pregunta es general; después cargá uno o más buyer personas.' : ''} />
                {sec === 'audiencia' && <p className="ad-muted" style={{ margin: '0 0 8px' }}>En Audiencia, la 1ª pregunta es general y las siguientes se repiten por cada buyer persona que sume el cliente.</p>}
                {qs.map((q) => (
                  <div key={q.id} className="ad-row" style={{ alignItems: 'flex-start', opacity: q.active ? 1 : 0.5 }}>
                    <label className="ad-cap" style={{ flex: 1, alignItems: 'flex-start' }}>
                      <input type="checkbox" disabled={!q.active} checked={isSelected(q.id)} onChange={() => toggleSelect(q.id)} style={{ marginTop: 8 }} />
                      <textarea defaultValue={q.text} rows={1} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== q.text) editQText(q, e.target.value.trim()); }} style={{ flex: 1, padding: '7px 10px', fontSize: 13, lineHeight: 1.5, resize: 'vertical', minHeight: 36, fontFamily: 'inherit' }} />
                    </label>
                    <button className="ad-btn ad-btn--ghost" onClick={() => setQActive(q, !q.active)}>{q.active ? 'Archivar' : 'Reactivar'}</button>
                  </div>
                ))}
                <div className="ad-row" style={{ marginTop: 6, alignItems: 'flex-start' }}>
                  <textarea className="ad-field--grow" rows={1} placeholder={`Nueva pregunta de ${sec}…`} value={newQ[sec]} onChange={(e) => setNewQ((s) => ({ ...s, [sec]: e.target.value }))} style={{ flex: 1, padding: '7px 10px', lineHeight: 1.5, resize: 'vertical', minHeight: 36, fontFamily: 'inherit' }} />
                  <button className="ad-add" onClick={() => addQ(sec)}>+ Agregar</button>
                </div>
              </div>
            );
          })}

          <div className="ad-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <button className="ad-btn ad-btn--ghost" onClick={downloadAnswersPdf} disabled={!(ob.answers || []).length}>↧ Descargar respuestas (PDF)</button>
            <div className="ad-save">
              {msg && <span className="ad-msg">{msg}</span>}
              <button className="ad-btn" onClick={save}>Guardar onboarding</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const periodLabel = (a, b) => (a && b ? `${fmtMonth(a)} – ${fmtMonth(b)}` : '');

function MacroEditor({ slug, macros, reload }) {
  const [draft, setDraft] = useState(null);
  // Si el cliente no tiene macro, mostramos el formulario directamente (parado sobre el mes actual).
  useEffect(() => {
    if (macros.length === 0 && !draft) setDraft({ start_ym: currentYM(), end_ym: currentYM(), objective: '', description: '' });
    // eslint-disable-next-line
  }, [macros.length]);

  const save = (m) => {
    const body = { start_ym: m.start_ym, end_ym: m.end_ym, period: periodLabel(m.start_ym, m.end_ym), objective: m.objective, description: m.description };
    const req = m.id ? apiClient.put(`/admin/${slug}/macro/${m.id}`, body) : apiClient.post(`/admin/${slug}/macro`, body);
    req.then(() => { setDraft(null); reload(); }).catch(() => {});
  };
  const del = (id) => { if (window.confirm('¿Borrar esta estrategia macro?')) apiClient.delete(`/admin/${slug}/macro/${id}`).then(reload).catch(() => {}); };

  return (
    <div className="ad-macro">
      <div className="ad-macro-head" style={{ cursor: 'default' }}>Estrategia macro</div>
      <div className="ad-macro-body">
        {macros.map((m) => (
          <div key={m.id} className="ad-row-box">
            <div className="ad-row">
              <MonthSelect label="Desde" value={m.start_ym} onChange={(v) => save({ ...m, start_ym: v })} />
              <MonthSelect label="Hasta" value={m.end_ym} onChange={(v) => save({ ...m, end_ym: v })} />
              <span className="ad-muted" style={{ alignSelf: 'center' }}>{periodLabel(m.start_ym, m.end_ym)}</span>
              <button className="ad-del" onClick={() => del(m.id)}>×</button>
            </div>
            <Field label="Objetivo macro" value={m.objective || ''} onChange={(v) => save({ ...m, objective: v })} />
            <Field label="Descripción" textarea value={m.description || ''} onChange={(v) => save({ ...m, description: v })} />
          </div>
        ))}
        {draft && (
          <div className="ad-row-box">
            <div className="ad-row">
              <MonthSelect label="Desde" value={draft.start_ym} onChange={(v) => setDraft({ ...draft, start_ym: v })} />
              <MonthSelect label="Hasta" value={draft.end_ym} onChange={(v) => setDraft({ ...draft, end_ym: v })} />
              <span className="ad-muted" style={{ alignSelf: 'center' }}>{periodLabel(draft.start_ym, draft.end_ym)}</span>
            </div>
            <Field label="Objetivo macro" value={draft.objective} onChange={(v) => setDraft({ ...draft, objective: v })} />
            <Field label="Descripción" textarea value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} />
            <button className="ad-btn" onClick={() => save(draft)}>Guardar macro</button>
          </div>
        )}
        {!draft && macros.length > 0 && (
          <button className="ad-add" onClick={() => setDraft({ start_ym: currentYM(), end_ym: currentYM(), objective: '', description: '' })}>+ Otra macro</button>
        )}
      </div>
    </div>
  );
}

// Dar de baja a un cliente (queda inactivo, no se borra) + motivo.
function ChurnBlock({ slug, name }) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [done, setDone] = useState(false);
  const dar = () => {
    if (!window.confirm(`¿Dar de baja a ${name}? Queda inactivo (no se borra) y se registra la baja.`)) return;
    apiClient.post(`/admin/${slug}/churn`, { motivo, fecha }).then(() => setDone(true)).catch(() => {});
  };
  if (done) return <div className="ad-sublabel" style={{ color: '#b91c1c', marginTop: 18 }}>✓ {name} dado de baja. Recargá la página para actualizar el listado.</div>;
  return (
    <div style={{ marginTop: 20, borderTop: '0.5px solid #e3e1d8', paddingTop: 14 }}>
      {!open
        ? <button className="ad-btn ad-btn--ghost" style={{ color: '#b91c1c', borderColor: '#f0c9c9' }} onClick={() => setOpen(true)}>Dar de baja al cliente</button>
        : (
          <>
            <div className="ad-sublabel" style={{ marginTop: 0 }}>Dar de baja a {name}</div>
            <div className="ad-row">
              <div className="ad-field"><label>Fecha</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
              <Field label="Motivo" value={motivo} onChange={setMotivo} ph="Ej: dejó de pautar, se fue a otra agencia…" />
            </div>
            <div className="ad-row" style={{ marginTop: 8 }}>
              <button className="ad-btn ad-btn--ghost" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="ad-btn" style={{ background: '#b91c1c', color: '#fff' }} onClick={dar}>Confirmar baja</button>
            </div>
          </>
        )}
    </div>
  );
}

// Registro de bajas (fecha · cliente · motivo).
function ChurnLog() {
  const [rows, setRows] = useState(null);
  useEffect(() => { apiClient.get('/admin/churn').then((r) => setRows(r.data.churn || [])).catch(() => setRows([])); }, []);
  return (
    <div className="ad-macro">
      <div className="ad-macro-head" style={{ cursor: 'default' }}>Registro de bajas</div>
      <div className="ad-macro-body">
        {rows === null ? <p className="ad-muted">Cargando…</p>
          : rows.length === 0 ? <p className="ad-muted">Todavía no hay bajas registradas.</p>
            : rows.map((r) => (
              <div key={r.id} className="ad-row-box" style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                <strong style={{ minWidth: 90 }}>{r.fecha}</strong>
                <span style={{ minWidth: 140, fontWeight: 600 }}>{r.client_name || r.client_slug}</span>
                <span className="ad-muted">{r.motivo || '—'}</span>
              </div>
            ))}
      </div>
    </div>
  );
}
