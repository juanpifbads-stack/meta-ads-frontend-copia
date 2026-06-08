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
  return (
    <div className="ob-locked">
      <div className="ob-card ob-card--meeting">
        <div className="ob-lock-eyebrow">🔒 Tu espacio se abre pronto</div>
        <h2 className="ob-lock-title">{m.date ? `Nos vemos el ${fmtLongDate(m.date)}` : 'Nos vemos pronto'}</h2>
        <p className="ob-lock-sub">Primer hito del camino</p>

        <div className="ob-meeting">
          <div className="ob-meeting-head">
            <span className="ob-meeting-num">1</span>
            <div>
              <div className="ob-meeting-title">{m.title || 'Reunión de transferencia de accesos'}</div>
              {m.date && <div className="ob-meeting-date">{fmtLongDate(m.date)}</div>}
            </div>
          </div>
          <div className="ob-meeting-objlabel">Objetivo de la reunión</div>
          <ul className="ob-meeting-obj">
            {(m.objectives || []).map((o, i) => <li key={i}>{o}</li>)}
          </ul>
          {m.disclaimer && <div className="ob-disclaimer">💳 {m.disclaimer}</div>}
        </div>
      </div>
    </div>
  );
}

/* ── Roadmap (desbloqueado) ── */
function Roadmap({ name, data }) {
  const items = data.roadmap || [];
  const done = items.filter((i) => i.status === 'hecho').length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  return (
    <div className="ob-roadmap">
      <header className="ob-head">
        <div className="ob-brand">alquimia.</div>
        <div className="ob-head-eyebrow">Onboarding · {name}</div>
      </header>

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
    setShowWelcome(!payload.welcomeSeen);
  };

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    apiClient.patch(`/onboarding/${slug}`, { welcomeSeen: true }, { params: { key: authKey } }).catch(() => {});
  }, [slug, authKey]);

  if (!data) return <Gate slug={slug} onPass={onPass} />;
  if (showWelcome) return <Welcome name={data.name} onDone={dismissWelcome} />;
  if (data.locked) return <LockedView name={data.name} meeting1={data.meeting1} />;
  return <Roadmap name={data.name} data={data} />;
}
