import React, { useState, useEffect } from 'react';
import apiClient from '../api/client.js';
import './TasksSection.css';

const STATUSES = [
  { key: 'sin_empezar', label: 'Sin empezar', cls: 'tk-st--todo' },
  { key: 'en_proceso', label: 'En proceso', cls: 'tk-st--doing' },
  { key: 'terminada', label: 'Terminada', cls: 'tk-st--done' },
];

const AUTHORS = ['Juanpi', 'Agus', 'Fran', 'Equipo de Agus'];

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch { return ''; }
}
function fmtDateTime(iso) {
  try {
    return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function TaskCard({ task, slug, accessKey, onChange, onRemove }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(task.detail || '');
  const [savingDetail, setSavingDetail] = useState(false);
  const [author, setAuthor] = useState(() => localStorage.getItem('tk_author') || AUTHORS[0]);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const comments = Array.isArray(task.comments) ? task.comments : [];

  const setStatus = async (status) => {
    onChange({ ...task, status });
    try { await apiClient.patch(`/tasks/${slug}/${task.id}`, { key: accessKey, status }); }
    catch { /* noop */ }
  };

  const saveDetail = async () => {
    setSavingDetail(true);
    try {
      const res = await apiClient.patch(`/tasks/${slug}/${task.id}`, { key: accessKey, detail });
      onChange(res.data.task);
    } catch { /* noop */ } finally { setSavingDetail(false); }
  };

  const sendMsg = async () => {
    if (!msg.trim()) return;
    setSending(true);
    localStorage.setItem('tk_author', author);
    try {
      const res = await apiClient.post(`/tasks/${slug}/${task.id}/comment`, { key: accessKey, author, body: msg });
      onChange(res.data.task);
      setMsg('');
    } catch { /* noop */ } finally { setSending(false); }
  };

  return (
    <div className={`tk-item ${task.status === 'terminada' ? 'tk-item--done' : ''}`}>
      <div className="tk-row">
        <div className="tk-date">{fmtDate(task.created_at)}</div>
        <div className="tk-item-body">
          <div className="tk-item-title">{task.title}</div>
        </div>
        <div className="tk-item-right">
          <div className="tk-status">
            {STATUSES.map((s) => (
              <button
                key={s.key}
                className={`tk-st ${s.cls} ${task.status === s.key ? 'tk-st--active' : ''}`}
                onClick={() => setStatus(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            className="tk-del"
            title="Eliminar"
            onClick={() => { if (window.confirm(`¿Eliminar la tarea "${task.title}"? No se puede deshacer.`)) onRemove(); }}
          >×</button>
        </div>
      </div>

      {/* Toggle desplegable (distinto de los estados) */}
      <button className={`tk-toggle ${open ? 'tk-toggle--open' : ''}`} onClick={() => setOpen((o) => !o)}>
        <span className="tk-toggle-caret">{open ? '▾' : '▸'}</span>
        Info y consultas{comments.length ? ` · ${comments.length} mensaje${comments.length > 1 ? 's' : ''}` : ''}
      </button>

      {open && (
        <div className="tk-detail-box">
          {/* Información de la tarea */}
          <div className="tk-block">
            <div className="tk-block-lbl">Información de la tarea</div>
            <textarea
              className="tk-input tk-textarea"
              placeholder="Agregá info, links o instrucciones sobre esta tarea…"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
            <button className="tk-save tk-save--sm" onClick={saveDetail} disabled={savingDetail}>
              {savingDetail ? 'Guardando…' : 'Guardar info'}
            </button>
          </div>

          {/* Chat de consultas */}
          <div className="tk-block">
            <div className="tk-block-lbl">Consultas</div>
            <div className="tk-chat">
              {comments.length === 0 && <div className="tk-chat-empty">Todavía no hay consultas.</div>}
              {comments.map((c, i) => (
                <div key={i} className="tk-msg">
                  <div className="tk-msg-head">
                    <span className="tk-msg-author">{c.author}</span>
                    <span className="tk-msg-time">{fmtDateTime(c.at)}</span>
                  </div>
                  <div className="tk-msg-body">{c.body}</div>
                </div>
              ))}
            </div>
            <div className="tk-chat-form">
              <select
                className="tk-input tk-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              >
                {AUTHORS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <div className="tk-chat-send">
                <input
                  className="tk-input"
                  placeholder="Escribí una consulta…"
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendMsg(); }}
                />
                <button className="tk-save tk-save--sm" onClick={sendMsg} disabled={sending || !msg.trim()}>
                  {sending ? '…' : 'Enviar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TasksSection({ slug, accessKey }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiClient
      .get(`/tasks/${slug}`, { params: { key: accessKey } })
      .then((res) => setTasks(res.data.tasks || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug, accessKey]);

  const addTask = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await apiClient.post(`/tasks/${slug}`, { key: accessKey, title, detail });
      setTasks((t) => [...t, res.data.task]);
      setTitle(''); setDetail(''); setShowAdd(false);
    } catch { /* noop */ } finally { setSaving(false); }
  };

  const updateTask = (updated) => setTasks((t) => t.map((x) => (x.id === updated.id ? updated : x)));
  const removeTask = async (id) => {
    setTasks((t) => t.filter((x) => x.id !== id));
    try { await apiClient.delete(`/tasks/${slug}/${id}`, { params: { key: accessKey } }); } catch { load(); }
  };

  const [showArchive, setShowArchive] = useState(false);
  const active = tasks.filter((t) => t.status !== 'terminada');
  const done = tasks.filter((t) => t.status === 'terminada');

  const card = (t) => (
    <TaskCard
      key={t.id}
      task={t}
      slug={slug}
      accessKey={accessKey}
      onChange={updateTask}
      onRemove={() => removeTask(t.id)}
    />
  );

  return (
    <div className="cp-card">
      <div className="tk-head">
        <span className="tk-count">
          {loading ? 'Cargando…' : `${active.length} pendiente${active.length === 1 ? '' : 's'}`}
        </span>
        <button className="tk-add-btn" onClick={() => setShowAdd((s) => !s)}>
          {showAdd ? 'Cancelar' : '+ Agregar tarea'}
        </button>
      </div>

      {showAdd && (
        <div className="tk-add">
          <input className="tk-input" placeholder="Título de la tarea" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="tk-input tk-textarea" placeholder="Info inicial (opcional)" value={detail} onChange={(e) => setDetail(e.target.value)} />
          <button className="tk-save" onClick={addTask} disabled={saving || !title.trim()}>
            {saving ? 'Guardando…' : 'Guardar tarea'}
          </button>
        </div>
      )}

      {error && <p className="cp-placeholder">No se pudieron cargar las tareas.</p>}
      {!loading && !error && tasks.length === 0 && <p className="cp-placeholder">No hay tareas todavía.</p>}

      <div className="tk-list">{active.map(card)}</div>

      {done.length > 0 && (
        <div className="tk-archive">
          <button className="tk-archive-head" onClick={() => setShowArchive((s) => !s)}>
            <span className="tk-toggle-caret">{showArchive ? '▾' : '▸'}</span>
            Archivo de tareas terminadas ({done.length})
          </button>
          {showArchive && <div className="tk-list tk-list--archive">{done.map(card)}</div>}
        </div>
      )}
    </div>
  );
}
