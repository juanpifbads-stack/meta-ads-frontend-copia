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
  return when.date ? `Para el ${fmtLongDate(when.date)}` : '';
}

const STATUS = {
  pendiente: { label: 'Pendiente', cls: 'ob-st--pending' },
  en_curso: { label: 'En curso', cls: 'ob-st--progress' },
  hecho: { label: 'Hecho', cls: 'ob-st--done' },
};

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
function Welcome({ name, onDone }) {
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

/* ── Formulario de onboarding (3 secciones, progreso, resumable, buyer personas) ── */
function OnboardingForm({ slug, authKey, questions, initialAnswers, initialPersonas, intros, onClose, onSaved }) {
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

  // En Audiencia, la 1ª pregunta es general; las que siguen se repiten por buyer persona.
  const audQs = questions.filter((q) => q.section === 'audiencia');
  const audRestIds = new Set(audQs.slice(1).map((q) => q.id));
  const isPersonaQ = (q) => audRestIds.has(q.id);

  // Todos los "slots" de respuesta (expandiendo las preguntas por persona).
  const slotsOf = (qs) => {
    const out = [];
    qs.forEach((q) => { if (isPersonaQ(q)) personas.forEach((p) => out.push(akey(q.id, p.id))); else out.push(q.id); });
    return out;
  };
  const allSlots = slotsOf(questions);
  const total = allSlots.length;
  const answered = allSlots.filter((k) => (answers[k] || '').trim()).length;
  const pct = total ? Math.round((answered / total) * 100) : 0;

  const buildPayload = (submitted, pAns = answers, pPers = personas) => {
    const out = [];
    questions.forEach((q) => {
      if (isPersonaQ(q)) pPers.forEach((p) => out.push({ questionId: q.id, questionText: q.text, answer: pAns[akey(q.id, p.id)] || '', personaId: p.id }));
      else out.push({ questionId: q.id, questionText: q.text, answer: pAns[q.id] || '' });
    });
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
            const ss = slotsOf(s.qs);
            const sa = ss.filter((k) => (answers[k] || '').trim()).length;
            return (
              <button key={s.key} className={`ob-form-tab ${i === sectionIdx ? 'ob-form-tab--on' : ''}`} onClick={() => goSection(i)}>
                {s.label} <span className="ob-form-tab-count">{sa}/{ss.length}</span>
              </button>
            );
          })}
        </div>

        <div className="ob-form-body">
          {sectionIntro && sectionIntro.trim() && <p className="ob-section-intro">{sectionIntro}</p>}

          {cur && cur.key === 'audiencia' ? (
            <>
              {cur.qs[0] && renderQ(cur.qs[0], null)}
              {personas.map((p, idx) => (
                <div key={p.id} className="ob-persona">
                  <div className="ob-persona-head">
                    <span className="ob-persona-title">Buyer persona {idx + 1}</span>
                    {personas.length > 1 && <button className="ob-persona-del" onClick={() => removePersona(p.id)}>Quitar</button>}
                  </div>
                  <div className="ob-form-q">
                    <label>Describí en dos oraciones quién es este buyer persona</label>
                    <textarea
                      value={p.description || ''}
                      onChange={(e) => setPersonaDesc(p.id, e.target.value)}
                      onBlur={() => persist()}
                      placeholder="Ej: Mujer de 30-40 años, profesional independiente, que busca…"
                    />
                  </div>
                  {cur.qs.slice(1).map((q) => renderQ(q, p.id))}
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

/* ── Roadmap (desbloqueado) ── */
function Roadmap({ name, data, slug, authKey, refetch }) {
  const items = data.roadmap || [];
  const done = items.filter((i) => i.status === 'hecho').length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const [showForm, setShowForm] = useState(false);
  const questions = data.questions || [];
  const ansCount = (data.answers || []).filter((a) => (a.answer || '').trim()).length;

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
        </div>
      </div>

      {showForm && (
        <OnboardingForm
          slug={slug} authKey={authKey} questions={questions} initialAnswers={data.answers}
          initialPersonas={data.personas} intros={data.sectionIntros}
          onClose={() => setShowForm(false)} onSaved={refetch}
        />
      )}

      <div className="ob-progresswrap">
        <div className="ob-progress-top"><span>Tu camino de onboarding</span><span>{done}/{items.length} hitos</span></div>
        <div className="ob-progress"><div className="ob-progress-fill" style={{ width: `${pct}%` }} /></div>
      </div>

      {items.length === 0 && <p className="ob-empty">Estamos preparando los próximos pasos. ¡Muy pronto vas a ver tu camino acá!</p>}

      <div className="ob-timeline">
        {items.map((it, i) => {
          const st = STATUS[it.status] || STATUS.pendiente;
          return (
            <div key={it.id || i} className={`ob-tl-item ${it.status === 'hecho' ? 'ob-tl-item--done' : ''}`}>
              <div className="ob-tl-dot">{it.status === 'hecho' ? '✓' : i + 1}</div>
              <div className="ob-tl-card">
                <div className="ob-tl-top">
                  <span className={`ob-tl-kind ${it.kind === 'task' ? 'ob-tl-kind--task' : ''}`}>{it.kind === 'task' ? 'Entregable' : 'Hito'}</span>
                  <span className={`ob-st ${st.cls}`}>{st.label}</span>
                </div>
                <div className="ob-tl-title">{it.title}</div>
                {it.detail && <div className="ob-tl-detail">{it.detail}</div>}
                <div className="ob-tl-meta">
                  {fmtWhen(it.when) && <span>🗓 {fmtWhen(it.when)}</span>}
                  {it.owner && <span className={`ob-owner ob-owner--${it.owner}`}>{it.owner === 'cliente' ? 'Lo hacés vos' : 'Lo hacemos nosotros'}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
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
