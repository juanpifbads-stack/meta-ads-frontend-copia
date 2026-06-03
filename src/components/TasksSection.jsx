import React, { useState, useEffect } from 'react';
import apiClient from '../api/client.js';
import './TasksSection.css';

const STATUSES = [
  { key: 'sin_empezar', label: 'Sin empezar', cls: 'tk-st--todo' },
  { key: 'en_proceso', label: 'En proceso', cls: 'tk-st--doing' },
  { key: 'terminada', label: 'Terminada', cls: 'tk-st--done' },
];

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

  const setStatus = async (id, status) => {
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, status } : x))); // optimista
    try {
      await apiClient.patch(`/tasks/${slug}/${id}`, { key: accessKey, status });
    } catch { load(); }
  };

  const remove = async (id) => {
    setTasks((t) => t.filter((x) => x.id !== id));
    try { await apiClient.delete(`/tasks/${slug}/${id}`, { params: { key: accessKey } }); }
    catch { load(); }
  };

  const pending = tasks.filter((t) => t.status !== 'terminada').length;

  return (
    <div className="cp-card">
      <div className="tk-head">
        <span className="tk-count">
          {loading ? 'Cargando…' : `${pending} pendiente${pending === 1 ? '' : 's'} de ${tasks.length}`}
        </span>
        <button className="tk-add-btn" onClick={() => setShowAdd((s) => !s)}>
          {showAdd ? 'Cancelar' : '+ Agregar tarea'}
        </button>
      </div>

      {showAdd && (
        <div className="tk-add">
          <input
            className="tk-input"
            placeholder="Título de la tarea"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="tk-input tk-textarea"
            placeholder="Detalle (opcional)"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
          <button className="tk-save" onClick={addTask} disabled={saving || !title.trim()}>
            {saving ? 'Guardando…' : 'Guardar tarea'}
          </button>
        </div>
      )}

      {error && <p className="cp-placeholder">No se pudieron cargar las tareas.</p>}

      {!loading && !error && tasks.length === 0 && (
        <p className="cp-placeholder">No hay tareas todavía.</p>
      )}

      <div className="tk-list">
        {tasks.map((t) => (
          <div key={t.id} className={`tk-item ${t.status === 'terminada' ? 'tk-item--done' : ''}`}>
            <div className="tk-item-body">
              <div className="tk-item-title">{t.title}</div>
              {t.detail && <div className="tk-item-detail">{t.detail}</div>}
            </div>
            <div className="tk-item-right">
              <div className="tk-status">
                {STATUSES.map((s) => (
                  <button
                    key={s.key}
                    className={`tk-st ${s.cls} ${t.status === s.key ? 'tk-st--active' : ''}`}
                    onClick={() => setStatus(t.id, s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <button className="tk-del" title="Eliminar" onClick={() => remove(t.id)}>×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
