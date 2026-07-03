import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../api/client.js';
import './Onboarding.css';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fmtLongDate(d) {
  if (!d) return '';
  const [y, m, dd] = d.split('-').map(Number);
  return `${dd} de ${MESES[m - 1]}`;
}
function fmtWhen(when) {
  if (!when) return '';
  if (when.mode === 'weeks') {
    if (when.fromWeek && when.toWeek && when.fromWeek !== when.toWeek) return `Semana ${when.fromWeek} a ${when.toWeek}`;
    if (when.fromWeek) return `Semana ${when.fromWeek}`;
    return '';
  }
  if (when.mode === 'dates') {
    if (when.fromDate && when.toDate) return `Del ${fmtLongDate(when.fromDate)} al ${fmtLongDate(when.toDate)}`;
    if (when.fromDate) return `Desde el ${fmtLongDate(when.fromDate)}`;
    if (when.toDate) return `Hasta el ${fmtLongDate(when.toDate)}`;
    return '';
  }
  return when.date ? `Para el ${fmtLongDate(when.date)}` : '';
}

const STATUS = {
  pendiente: { label: 'Pendiente', cls: 'ob-st--pending' },
  en_curso: { label: 'En curso', cls: 'ob-st--progress' },
  hecho: { label: 'Finalizado', cls: 'ob-st--done' },
};

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
// ¿El hito/entregable cae en este día (YYYY-MM-DD)? (modo semanas no se ubica en el calendario)
function itemOnDay(it, ds) {
  const w = it.when || {};
  if (w.mode === 'dates') {
    if (w.fromDate && w.toDate) return ds >= w.fromDate && ds <= w.toDate;
    return w.fromDate === ds || w.toDate === ds;
  }
  return w.date === ds;
}
// Si abarca varios días devuelve {from,to}; si es de un solo día, null (va como pill).
function rangeBounds(it) {
  const w = it.when || {};
  if (w.mode === 'dates' && w.fromDate && w.toDate && w.fromDate !== w.toDate) return { from: w.fromDate, to: w.toDate };
  return null;
}

/* ── Gate de clave (validado contra el backend) ── */
function Gate({ slug, onPass }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = () => {
    if (!key.trim()) return;
    setLoading(true); setError('');
    apiClient.get(`/onboarding/${slug}`, { params: { key } })
      .then((r) => onPass(key, r.data))
      .catch((e) => setError(e.response?.status === 401 ? 'Clave incorrecta.' : 'No se pudo acceder.'))
      .finally(() => setLoading(false));
  };
  return (
    <div className="ob-gate">
      <div className="ob-gate-box">
        <div className="ob-brand">alquimia.</div>
        <div className="ob-gate-eyebrow">Onboarding</div>
        <p className="ob-gate-msg">Ingresá tu clave de acceso para comenzar.</p>
        <input
          type="password" className="ob-gate-input" placeholder="Clave de acceso" value={key}
          onChange={(e) => { setKey(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        {error && <div className="ob-gate-error">{error}</div>}
        <button className="ob-btn" onClick={submit} disabled={loading}>{loading ? 'Entrando…' : 'Ingresar'}</button>
      </div>
    </div>
  );
}

/* ── Animación de bienvenida ── */
export function Welcome({ name, onDone }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 1400);
    const t2 = setTimeout(() => setStep(2), 2900);
    const t3 = setTimeout(() => setStep(3), 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);
  return (
    <div className="ob-welcome">
      <div className="ob-welcome-inner">
        <div className="ob-welcome-cross ob-fade">
          <span className="ob-welcome-alq">alquimia.</span>
          <span className="ob-welcome-x">×</span>
          <span className="ob-welcome-client">{name}</span>
        </div>
        <p className={`ob-welcome-line ${step >= 1 ? 'ob-show' : ''}`}>Gracias por confiar en nosotros.</p>
        <p className={`ob-welcome-line ob-welcome-q ${step >= 2 ? 'ob-show' : ''}`}>¿Están listos para crear un nuevo caso de éxito?</p>
        <button className={`ob-btn ob-welcome-btn ${step >= 3 ? 'ob-show' : ''}`} onClick={onDone}>Comenzar →</button>
      </div>
    </div>
  );
}

/* ── Pantalla bloqueada: reunión 1 ── */
function LockedView({ name, meeting1 }) {
  const m = meeting1 || {};
  const when = m.date ? `${fmtLongDate(m.date)}${m.time ? ` a las ${m.time} hs` : ''}` : '';
  return (
    <div className="ob-locked">
      <div className="ob-card ob-card--meeting">
        <div className="ob-lock-eyebrow">🔒 Tu espacio se abre pronto</div>
        <h2 className="ob-lock-title">{m.date ? `Nos vemos el ${when}` : 'Nos vemos pronto'}</h2>
        <p className="ob-lock-sub">Primer hito del camino</p>

        <div className="ob-meeting">
          <div className="ob-meeting-head">
            <span className="ob-meeting-num">1</span>
            <div>
              <div className="ob-meeting-title">{m.title || 'Reunión de transferencia de accesos'}</div>
              {when && <div className="ob-meeting-date">{when}</div>}
            </div>
          </div>
          <div className="ob-meeting-objlabel">Objetivo de la reunión</div>
          <ul className="ob-meeting-obj">
            {(m.objectives || []).map((o, i) => <li key={i}>{o}</li>)}
          </ul>
          {m.disclaimer && <div className="ob-disclaimer">💳 {m.disclaimer}</div>}
          {m.meetLink && (
            <a className="ob-btn ob-meet-btn" href={m.meetLink} target="_blank" rel="noopener noreferrer">
              🎥 Unirse a la reunión
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

const SECTIONS = [
  { key: 'marca', label: 'Marca' },
  { key: 'producto', label: 'Producto' },
  { key: 'audiencia', label: 'Audiencia' },
];

// Clave de respuesta: simple por questionId, o compuesta si es de un buyer persona.
const akey = (qid, personaId) => (personaId ? `${qid}::${personaId}` : qid);

// Texto FIJO (no editable) que explica audiencia vs buyer personas. Siempre se
// muestra arriba de la 1ª pregunta general de Audiencia.
const AUDIENCE_INTRO = `Primero definimos la audiencia general y después los buyer personas.

La audiencia es a quién le hablamos a grandes rasgos. Los buyer personas son perfiles concretos dentro de esa audiencia, definidos a fondo.

Por ejemplo: una marca que vende bidones de agua le habla a gente cansada de pagar de más por el agua del supermercado y de andar cargando botellas. Pero si vamos a fondo, sus buyer personas pueden ser: el recién mudado que estudia y cuida cada gasto hormiga, o la familia donde quien antes compraba el agua hoy busca comodidad y logística más que precio.

Entender esto nos permite interpelar bien a cada uno el día de mañana. Algunas marcas tienen 1 buyer persona, otras 2, 3 o más: pensá brevemente la tuya y cargá los que consideres.

La primera pregunta es general, para toda la audiencia. Lo que viene después ya son las preguntas del Buyer persona 1.`;

const PERSONA_Q = 'Describime en una oración quién es este buyer persona: edad, género y una breve descripción.';
const PERSONA_Q_PH = 'Ej: El padre de familia de 40 que no quiere ir hasta el supermercado a comprar agua.';

// Id de la respuesta de "audiencia general" (el recuadro editable). No es una
// pregunta del banco: es la descripción libre de la audiencia general.
const AUD_GENERAL_ID = '__aud_general__';

// Guía fija de cómo organizar la carpeta de contenido.
const CONTENT_GUIDE = `Compartinos el material (fotos y videos) en una carpeta de Drive, ordenada así:

1. Separá primero por temporada o contexto. Ej: si estás vendiendo la temporada de verano, la primera carpeta sería "SS26".

2. Dentro de esa carpeta, creá dos: FOTOS y VIDEOS.

3. Dentro de cada una, organizá con tu propio criterio. Ej: "Producción ecommerce", "Producción street", etc.

Cuando esté lista, pegá abajo el link de la carpeta y asegurate de darnos permiso de visualización.`;

/* ── Formulario de onboarding (3 secciones, progreso, resumable, buyer personas) ── */
export function OnboardingForm({ slug, authKey, questions, initialAnswers, initialPersonas, intros, onClose, onSaved }) {
  // Mapa { akey: answer } inicial desde lo ya respondido.
  const [answers, setAnswers] = useState(() => {
    const m = {};
    (initialAnswers || []).forEach((a) => { m[akey(a.questionId, a.personaId)] = a.answer; });
    return m;
  });
  const [personas, setPersonas] = useState(() =>
    (initialPersonas && initialPersonas.length) ? initialPersonas.map((p) => ({ id: p.id, description: p.description || '' })) : [{ id: 'p1', description: '' }]);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const sectionsWithQs = SECTIONS.map((s) => ({ ...s, qs: questions.filter((q) => q.section === s.key) })).filter((s) => s.qs.length);
  const cur = sectionsWithQs[sectionIdx] || sectionsWithQs[0];

  // En Audiencia: TODAS las preguntas del banco se repiten por buyer persona.
  // La "audiencia general" es una respuesta libre aparte (el recuadro editable).
  const hasAud = sectionsWithQs.some((s) => s.key === 'audiencia');
  const audGeneralText = (intros || {}).audiencia || '';
  const isPersonaQ = (q) => q.section === 'audiencia';

  // "Slots" de respuesta (expandiendo preguntas por persona) + el general de audiencia.
  const slotsOf = (qs) => {
    const out = [];
    qs.forEach((q) => { if (isPersonaQ(q)) personas.forEach((p) => out.push(akey(q.id, p.id))); else out.push(q.id); });
    return out;
  };
  const allSlots = [...slotsOf(questions), ...(hasAud ? [AUD_GENERAL_ID] : [])];
  const total = allSlots.length;
  const answered = allSlots.filter((k) => (answers[k] || '').trim()).length;
  const pct = total ? Math.round((answered / total) * 100) : 0;

  const buildPayload = (submitted, pAns = answers, pPers = personas) => {
    const out = [];
    questions.forEach((q) => {
      if (isPersonaQ(q)) pPers.forEach((p) => out.push({ questionId: q.id, questionText: q.text, answer: pAns[akey(q.id, p.id)] || '', personaId: p.id }));
      else out.push({ questionId: q.id, questionText: q.text, answer: pAns[q.id] || '' });
    });
    if (hasAud) out.push({ questionId: AUD_GENERAL_ID, questionText: audGeneralText || 'Audiencia general', answer: pAns[AUD_GENERAL_ID] || '' });
    return { answers: out, personas: pPers, ...(submitted != null ? { formSubmitted: submitted } : {}) };
  };
  const persist = (submitted, pAns, pPers) => {
    setSaving(true);
    return apiClient.patch(`/onboarding/${slug}`, buildPayload(submitted, pAns, pPers), { params: { key: authKey } })
      .then(() => { setSavedMsg('✓ Guardado'); setTimeout(() => setSavedMsg(''), 1500); })
      .catch(() => setSavedMsg('Error al guardar'))
      .finally(() => setSaving(false));
  };

  const addPersona = () => { const next = [...personas, { id: `p${Date.now()}`, description: '' }]; setPersonas(next); persist(undefined, answers, next); };
  const removePersona = (id) => {
    const next = personas.filter((p) => p.id !== id);
    const na = { ...answers }; Object.keys(na).forEach((k) => { if (k.endsWith(`::${id}`)) delete na[k]; });
    setPersonas(next); setAnswers(na); persist(undefined, na, next);
  };
  const setPersonaDesc = (id, v) => setPersonas((ps) => ps.map((p) => (p.id === id ? { ...p, description: v } : p)));

  const goSection = (i) => { persist(); setSectionIdx(i); };
  const finish = () => { persist(true).then(() => { onSaved && onSaved(); onClose(); }); };
  const closeSaving = () => { persist().then(() => { onSaved && onSaved(); onClose(); }); };

  const renderQ = (q, personaId) => {
    const k = akey(q.id, personaId);
    return (
      <div key={k} className="ob-form-q">
        <label>{q.text}</label>
        <textarea
          value={answers[k] || ''}
          onChange={(e) => setAnswers((m) => ({ ...m, [k]: e.target.value }))}
          onBlur={() => persist()}
          placeholder="Tu respuesta…"
        />
      </div>
    );
  };

  const sectionIntro = cur ? (intros || {})[cur.key] : '';

  return (
    <div className="ob-form-overlay">
      <div className="ob-form">
        <div className="ob-form-head">
          <div>
            <div className="ob-brand">alquimia.</div>
            <div className="ob-head-eyebrow">Formulario de onboarding</div>
          </div>
          <button className="ob-form-close" onClick={closeSaving} aria-label="Cerrar">×</button>
        </div>

        <div className="ob-progresswrap" style={{ margin: '0 0 18px' }}>
          <div className="ob-progress-top"><span>Progreso</span><span>{answered}/{total} respondidas</span></div>
          <div className="ob-progress"><div className="ob-progress-fill" style={{ width: `${pct}%` }} /></div>
        </div>

        <div className="ob-form-tabs">
          {sectionsWithQs.map((s, i) => {
            const ss = [...slotsOf(s.qs), ...(s.key === 'audiencia' ? [AUD_GENERAL_ID] : [])];
            const sa = ss.filter((k) => (answers[k] || '').trim()).length;
            return (
              <button key={s.key} className={`ob-form-tab ${i === sectionIdx ? 'ob-form-tab--on' : ''}`} onClick={() => goSection(i)}>
                {s.label} <span className="ob-form-tab-count">{sa}/{ss.length}</span>
              </button>
            );
          })}
        </div>

        <div className="ob-form-body">
          {cur && cur.key !== 'audiencia' && sectionIntro && sectionIntro.trim() && <p className="ob-section-intro">{sectionIntro}</p>}

          {cur && cur.key === 'audiencia' ? (
            <>
              {/* 1) Explicación fija: audiencia general vs buyer personas */}
              <div className="ob-fixed-intro">{AUDIENCE_INTRO}</div>

              {/* 2) Audiencia general: recuadro editable + su campo de respuesta */}
              {audGeneralText && audGeneralText.trim() && <p className="ob-section-intro">{audGeneralText}</p>}
              <div className="ob-form-q">
                <label>Describí en pocas líneas a tu audiencia general</label>
                <textarea
                  value={answers[AUD_GENERAL_ID] || ''}
                  onChange={(e) => setAnswers((m) => ({ ...m, [AUD_GENERAL_ID]: e.target.value }))}
                  onBlur={() => persist()}
                  placeholder="Tu respuesta…"
                />
              </div>

              {/* 3) Buyer personas: cada uno con su descripción + TODAS las preguntas */}
              <p className="ob-personas-note">Ahora vamos a definir tus buyer personas. Completá el primero y, si tu marca lo necesita, al final encontrás un botón para agregar más.</p>
              {personas.map((p, idx) => (
                <div key={p.id} className="ob-persona">
                  <div className="ob-persona-head">
                    <span className="ob-persona-title">Buyer persona {idx + 1}</span>
                    {personas.length > 1 && <button className="ob-persona-del" onClick={() => removePersona(p.id)}>Quitar</button>}
                  </div>
                  <div className="ob-form-q">
                    <label>{PERSONA_Q}</label>
                    <textarea
                      value={p.description || ''}
                      onChange={(e) => setPersonaDesc(p.id, e.target.value)}
                      onBlur={() => persist()}
                      placeholder={PERSONA_Q_PH}
                    />
                  </div>
                  {cur.qs.map((q) => renderQ(q, p.id))}
                </div>
              ))}
              <button className="ob-btn ob-btn--ghost ob-persona-add" onClick={addPersona}>+ Agregar otro buyer persona</button>
            </>
          ) : (
            cur && cur.qs.map((q) => renderQ(q, null))
          )}
        </div>

        <div className="ob-form-foot">
          <span className="ob-form-saved">{saving ? 'Guardando…' : savedMsg}</span>
          <div className="ob-form-nav">
            {sectionIdx > 0 && <button className="ob-btn ob-btn--ghost" onClick={() => goSection(sectionIdx - 1)}>← Anterior</button>}
            {sectionIdx < sectionsWithQs.length - 1
              ? <button className="ob-btn" onClick={() => goSection(sectionIdx + 1)}>Siguiente →</button>
              : <button className="ob-btn" onClick={finish}>Finalizar ✓</button>}
          </div>
        </div>
        <p className="ob-form-hint">Tus respuestas se guardan solas. Podés cerrar y continuar más tarde.</p>
      </div>
    </div>
  );
}

/* ── Modal: compartir carpeta de contenido (link de Drive) ── */
export function ContentModal({ slug, authKey, initialLink, onClose, onSaved }) {
  const [link, setLink] = useState(initialLink || '');
  const [saving, setSaving] = useState(false);
  const save = () => {
    setSaving(true);
    apiClient.patch(`/onboarding/${slug}`, { driveLink: link.trim() }, { params: { key: authKey } })
      .then(() => { onSaved && onSaved(); onClose(); })
      .catch(() => {})
      .finally(() => setSaving(false));
  };
  return (
    <div className="ob-form-overlay">
      <div className="ob-form">
        <div className="ob-form-head">
          <div>
            <div className="ob-brand">alquimia.</div>
            <div className="ob-head-eyebrow">Compartir contenido</div>
          </div>
          <button className="ob-form-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="ob-fixed-intro">{CONTENT_GUIDE}</div>
        <div className="ob-form-q">
          <label>Link de la carpeta de contenido</label>
          <input className="ob-link-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/…" />
        </div>
        <div className="ob-form-foot">
          <span className="ob-form-saved" />
          <button className="ob-btn" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar link'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Roadmap (desbloqueado) ── */
// Tarjetas de entregables (formulario + contenido) — reusable en el portal.
export function OnboardingDeliverables({ slug, authKey, data, refetch }) {
  const [showForm, setShowForm] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const questions = data.questions || [];
  const ansCount = (data.answers || []).filter((a) => (a.answer || '').trim()).length;
  return (
    <div className="ob-deliverables">
      <div className="ob-deliv-grid" style={{ gridTemplateColumns: '1fr', display: 'grid', gap: 10 }}>
        <button className={`ob-deliv-card ${data.formSubmitted ? 'ob-deliv-card--done' : ''}`} onClick={() => questions.length && setShowForm(true)} disabled={!questions.length}>
          <span className="ob-deliv-icon">📝</span>
          <span className="ob-deliv-name">Responder formulario de onboarding</span>
          <span className="ob-deliv-status">
            {data.formSubmitted ? '✓ Enviado' : questions.length ? `${ansCount}/${questions.length} respondidas` : 'Próximamente'}
          </span>
        </button>
        <button className={`ob-deliv-card ${data.contentSubmitted ? 'ob-deliv-card--done' : ''}`} onClick={() => setShowContent(true)}>
          <span className="ob-deliv-icon">📁</span>
          <span className="ob-deliv-name">Compartir carpeta de contenido</span>
          <span className="ob-deliv-status">{data.contentSubmitted ? '✓ Link cargado' : 'Pegá el link de Drive'}</span>
        </button>
      </div>
      {showForm && (
        <OnboardingForm slug={slug} authKey={authKey} questions={questions} initialAnswers={data.answers}
          initialPersonas={data.personas} intros={data.sectionIntros}
          onClose={() => setShowForm(false)} onSaved={refetch} />
      )}
      {showContent && (
        <ContentModal slug={slug} authKey={authKey} initialLink={data.content?.driveLink}
          onClose={() => setShowContent(false)} onSaved={refetch} />
      )}
    </div>
  );
}

// Calendario semanal del onboarding — reusable en el portal.
// extraItems: hitos/tareas con fecha que vienen de otras fuentes (tareas con deadline, eventos).
export function OnboardingCalendar({ data, extraItems = [], onDeleteItem }) {
  // Merge + dedupe por id (evita duplicados si un item viene de dos fuentes).
  const seen = new Set();
  const items = [...(data.roadmap || []), ...extraItems].filter((it) => {
    if (!it.id) return true;
    if (seen.has(it.id)) return false;
    seen.add(it.id); return true;
  });
  const [weekOffset, setWeekOffset] = useState(0);
  const [selDay, setSelDay] = useState(null); // día abierto para ver/eliminar sus items
  const weekStart = (() => { const d = new Date(); const dow = (d.getDay() + 6) % 7; d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - dow + weekOffset * 7); return d; })();
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
  const todayStr = ymd(new Date());
  const weekStartStr = ymd(weekDays[0]);
  const weekEndStr = ymd(weekDays[6]);
  const multiDayBars = items.map((it) => {
    const b = rangeBounds(it);
    if (!b || b.to < weekStartStr || b.from > weekEndStr) return null;
    const from = b.from < weekStartStr ? weekStartStr : b.from;
    const to = b.to > weekEndStr ? weekEndStr : b.to;
    const s = weekDays.findIndex((d) => ymd(d) === from);
    const e = weekDays.findIndex((d) => ymd(d) === to);
    return { it, s, e };
  }).filter(Boolean);
  const weekLabel = `${weekStart.getDate()} ${MESES[weekStart.getMonth()]} – ${weekDays[6].getDate()} ${MESES[weekDays[6].getMonth()]}`;
  const weekTitle = weekOffset === 0 ? 'Esta semana' : weekOffset === 1 ? 'Próxima semana' : weekOffset === -1 ? 'Semana pasada' : weekLabel;
  if (!items.length) return <p className="ob-empty">Todavía no hay fechas cargadas. Cuando la agencia agregue hitos o reuniones, van a aparecer acá.</p>;
  return (
    <div className="ob-cal">
      <div className="ob-cal-head">
        <button className="ob-cal-nav" onClick={() => setWeekOffset((o) => o - 1)} aria-label="Semana anterior">←</button>
        <span className="ob-cal-range"><strong>{weekTitle}</strong>{weekOffset !== 0 && <span className="ob-cal-sub"> · {weekLabel}</span>}</span>
        <div className="ob-cal-headright">
          {weekOffset !== 0 && <button className="ob-cal-today" onClick={() => setWeekOffset(0)}>Semana actual</button>}
          <button className="ob-cal-nav" onClick={() => setWeekOffset((o) => o + 1)} aria-label="Semana siguiente">→</button>
        </div>
      </div>
      <div className="ob-cal-grid">
        {weekDays.map((d, i) => {
          const ds = ymd(d);
          const dayItems = items.filter((it) => itemOnDay(it, ds) && !rangeBounds(it));
          return (
            <div key={ds} className={`ob-cal-day ${ds === todayStr ? 'ob-cal-day--today' : ''} ${ds === selDay ? 'ob-cal-day--sel' : ''}`}
              onClick={() => setSelDay(ds === selDay ? null : ds)} style={{ cursor: dayItems.length ? 'pointer' : 'default' }}>
              <div className="ob-cal-dow">{DOW[i]}</div>
              <div className="ob-cal-dom">{d.getDate()}</div>
              {dayItems.map((it, j) => (
                <div key={it.id || j} className={`ob-cal-pill ${it.kind === 'task' ? 'ob-cal-pill--task' : ''}`} title={it.title}>{it.title}</div>
              ))}
            </div>
          );
        })}
      </div>
      {multiDayBars.length > 0 && (
        <div className="ob-cal-bars">
          {multiDayBars.map(({ it, s, e }, k) => (
            <div key={it.id || k} className={`ob-cal-bar ${it.kind === 'task' ? 'ob-cal-pill--task' : ''}`} style={{ gridColumn: `${s + 1} / ${e + 2}` }} title={it.title}>{it.title}</div>
          ))}
        </div>
      )}
      {selDay && (
        <div style={{ marginTop: 12, borderTop: '0.5px solid var(--color-gray-mid,#e3e1d8)', paddingTop: 10 }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
            {new Date(selDay + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          {(() => {
            const dayItems = items.filter((it) => itemOnDay(it, selDay) && !rangeBounds(it));
            if (!dayItems.length) return <div style={{ fontSize: 13, color: '#94a3b8' }}>Sin eventos este día.</div>;
            return dayItems.map((it, k) => (
              <div key={it.id || k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 14 }}>
                <span style={{ flex: 1 }}>{it.kind === 'task' ? '📋' : '📌'} {it.title}</span>
                {it.deletable && onDeleteItem && (
                  <button onClick={() => { onDeleteItem(it); setSelDay(null); }} title="Eliminar" style={{ color: '#b91c1c', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                )}
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

function Roadmap({ name, data, slug, authKey, refetch }) {
  const items = data.roadmap || [];
  const done = items.filter((i) => i.status === 'hecho').length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const [showForm, setShowForm] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const questions = data.questions || [];
  const ansCount = (data.answers || []).filter((a) => (a.answer || '').trim()).length;

  // Separamos en dos columnas: hitos y entregables. Los hitos van ordenados por fecha.
  const whenSortKey = (it) => {
    const w = it.when || {};
    return w.date || w.fromDate || (w.fromWeek ? `W${String(w.fromWeek).padStart(3, '0')}` : '~~~');
  };
  const tasks = items.filter((it) => it.kind === 'task');
  const hitos = items.filter((it) => it.kind !== 'task').sort((a, b) => whenSortKey(a).localeCompare(whenSortKey(b)));

  // El cliente cambia el estado desde un select (pendiente / en curso / finalizado).
  const setStatus = (it, next) => {
    if (!it.id) return;
    apiClient.patch(`/onboarding/${slug}`, { roadmapStatuses: { [it.id]: next } }, { params: { key: authKey } })
      .then(refetch).catch(() => {});
  };

  const renderCard = (it, idx) => {
    const st = STATUS[it.status] || STATUS.pendiente;
    const when = fmtWhen(it.when);
    const isHito = it.kind !== 'task';
    return (
      <div key={it.id || idx} className={`ob-rc ${it.status === 'hecho' ? 'ob-rc--done' : ''}`}>
        <div className="ob-tl-top">
          <span className={`ob-tl-kind ${it.kind === 'task' ? 'ob-tl-kind--task' : ''}`}>{it.kind === 'task' ? 'Entregable' : 'Hito'}</span>
          <select className={`ob-st-select ${st.cls}`} value={it.status || 'pendiente'} onChange={(e) => setStatus(it, e.target.value)} title="Cambiar estado">
            <option value="pendiente">Pendiente</option>
            <option value="en_curso">En curso</option>
            <option value="hecho">Finalizado</option>
          </select>
        </div>
        {isHito && when && <div className="ob-rc-date">🗓 {when}</div>}
        <div className="ob-tl-title">{it.title}</div>
        {it.detail && <div className="ob-tl-detail">{it.detail}</div>}
        {!isHito && when && <div className="ob-tl-meta"><span>🗓 {when}</span></div>}
      </div>
    );
  };

  // Calendario: semana actual (lunes a domingo) + desplazamiento.
  const weekStart = (() => { const d = new Date(); const dow = (d.getDay() + 6) % 7; d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - dow + weekOffset * 7); return d; })();
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
  const todayStr = ymd(new Date());
  const weekStartStr = ymd(weekDays[0]);
  const weekEndStr = ymd(weekDays[6]);
  // Barras de tareas multi-día (estilo Notion): una sola barra que se extiende por los días.
  const multiDayBars = items.map((it) => {
    const b = rangeBounds(it);
    if (!b || b.to < weekStartStr || b.from > weekEndStr) return null;
    const from = b.from < weekStartStr ? weekStartStr : b.from;
    const to = b.to > weekEndStr ? weekEndStr : b.to;
    const s = weekDays.findIndex((d) => ymd(d) === from);
    const e = weekDays.findIndex((d) => ymd(d) === to);
    return { it, s, e };
  }).filter(Boolean);
  const weekLabel = `${weekStart.getDate()} ${MESES[weekStart.getMonth()]} – ${weekDays[6].getDate()} ${MESES[weekDays[6].getMonth()]}`;
  const weekTitle = weekOffset === 0 ? 'Esta semana' : weekOffset === 1 ? 'Próxima semana' : weekOffset === -1 ? 'Semana pasada' : weekLabel;

  return (
    <div className="ob-roadmap">
      <header className="ob-head">
        <div className="ob-brand">alquimia.</div>
        <div className="ob-head-eyebrow">Onboarding · {name}</div>
      </header>

      {/* Entregables de la primera semana */}
      <div className="ob-deliverables">
        <div className="ob-deliv-title">Tus entregables de la primera semana</div>
        <div className="ob-deliv-grid">
          <button className={`ob-deliv-card ${data.formSubmitted ? 'ob-deliv-card--done' : ''}`} onClick={() => questions.length && setShowForm(true)} disabled={!questions.length}>
            <span className="ob-deliv-icon">📝</span>
            <span className="ob-deliv-name">Responder formulario de onboarding</span>
            <span className="ob-deliv-status">
              {data.formSubmitted ? '✓ Enviado' : questions.length ? `${ansCount}/${questions.length} respondidas` : 'Próximamente'}
            </span>
          </button>
          <button className={`ob-deliv-card ${data.contentSubmitted ? 'ob-deliv-card--done' : ''}`} onClick={() => setShowContent(true)}>
            <span className="ob-deliv-icon">📁</span>
            <span className="ob-deliv-name">Compartir carpeta de contenido</span>
            <span className="ob-deliv-status">{data.contentSubmitted ? '✓ Link cargado' : 'Pegá el link de Drive'}</span>
          </button>
        </div>
      </div>

      {showForm && (
        <OnboardingForm
          slug={slug} authKey={authKey} questions={questions} initialAnswers={data.answers}
          initialPersonas={data.personas} intros={data.sectionIntros}
          onClose={() => setShowForm(false)} onSaved={refetch}
        />
      )}

      {showContent && (
        <ContentModal
          slug={slug} authKey={authKey} initialLink={data.content?.driveLink}
          onClose={() => setShowContent(false)} onSaved={refetch}
        />
      )}

      <div className="ob-progresswrap">
        <div className="ob-progress-top"><span>Tu camino de onboarding</span><span>{done}/{items.length} hitos</span></div>
        <div className="ob-progress"><div className="ob-progress-fill" style={{ width: `${pct}%` }} /></div>
      </div>

      {items.length === 0 && <p className="ob-empty">Estamos preparando los próximos pasos. ¡Muy pronto vas a ver tu camino acá!</p>}

      {items.length > 0 && (
        <div className="ob-cal">
          <div className="ob-cal-head">
            <button className="ob-cal-nav" onClick={() => setWeekOffset((o) => o - 1)} aria-label="Semana anterior">←</button>
            <span className="ob-cal-range"><strong>{weekTitle}</strong>{weekOffset !== 0 && <span className="ob-cal-sub"> · {weekLabel}</span>}</span>
            <div className="ob-cal-headright">
              {weekOffset !== 0 && <button className="ob-cal-today" onClick={() => setWeekOffset(0)}>Semana actual</button>}
              <button className="ob-cal-nav" onClick={() => setWeekOffset((o) => o + 1)} aria-label="Semana siguiente">→</button>
            </div>
          </div>
          <div className="ob-cal-grid">
            {weekDays.map((d, i) => {
              const ds = ymd(d);
              const dayItems = items.filter((it) => itemOnDay(it, ds) && !rangeBounds(it));
              return (
                <div key={ds} className={`ob-cal-day ${ds === todayStr ? 'ob-cal-day--today' : ''}`}>
                  <div className="ob-cal-dow">{DOW[i]}</div>
                  <div className="ob-cal-dom">{d.getDate()}</div>
                  {dayItems.map((it, j) => (
                    <div key={it.id || j} className={`ob-cal-pill ${it.kind === 'task' ? 'ob-cal-pill--task' : ''}`} title={it.title}>{it.title}</div>
                  ))}
                </div>
              );
            })}
          </div>
          {multiDayBars.length > 0 && (
            <div className="ob-cal-bars">
              {multiDayBars.map(({ it, s, e }, k) => (
                <div key={it.id || k} className={`ob-cal-bar ${it.kind === 'task' ? 'ob-cal-pill--task' : ''}`} style={{ gridColumn: `${s + 1} / ${e + 2}` }} title={it.title}>{it.title}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="ob-cols">
          <div className="ob-col">
            <div className="ob-col-title">Hitos</div>
            {hitos.length ? hitos.map(renderCard) : <p className="ob-col-empty">Todavía no hay hitos cargados.</p>}
          </div>
          <div className="ob-col">
            <div className="ob-col-title">Entregables</div>
            {tasks.length ? tasks.map(renderCard) : <p className="ob-col-empty">Todavía no hay entregables cargados.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Onboarding() {
  const { slug } = useParams();
  const [authKey, setAuthKey] = useState('');
  const [data, setData] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);

  const onPass = (key, payload) => {
    setAuthKey(key);
    setData(payload);
    // Bloqueado → la animación aparece SIEMPRE en cada ingreso.
    // Desbloqueado → solo la primera vez (después queda marcada como vista).
    setShowWelcome(payload.locked ? true : !payload.welcomeSeen);
  };

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    // Solo la marcamos como "vista" cuando ya está desbloqueado; mientras está
    // bloqueado no se persiste, para que reaparezca en cada ingreso.
    if (data && !data.locked) {
      apiClient.patch(`/onboarding/${slug}`, { welcomeSeen: true }, { params: { key: authKey } }).catch(() => {});
    }
  }, [slug, authKey, data]);

  const refetch = useCallback(() => {
    apiClient.get(`/onboarding/${slug}`, { params: { key: authKey } }).then((r) => setData(r.data)).catch(() => {});
  }, [slug, authKey]);

  if (!data) return <Gate slug={slug} onPass={onPass} />;
  if (showWelcome) return <Welcome name={data.name} onDone={dismissWelcome} />;
  if (data.locked) return <LockedView name={data.name} meeting1={data.meeting1} />;
  return <Roadmap name={data.name} data={data} slug={slug} authKey={authKey} refetch={refetch} />;
}
