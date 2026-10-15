import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../api/client.js';
import './Control.css';
import './Library.css';

// Biblioteca creativa: formatos de referencia, marcas referencia e ideas de contenido.
// Mismas tablas que usa el conector MCP del brief (creative_formats, competitor_refs, content_ideas).

const TABS = [
  { k: 'formats', l: 'Formatos' },
  { k: 'competitors', l: 'Marcas referencia' },
  { k: 'ideas', l: 'Ideas' },
];
const ETAPAS = ['tofu', 'mofu', 'bofu'];
const PRODUCCION = ['bajo', 'medio', 'alto'];
const CONSCIENCIA = ['inconsciente', 'problema', 'solucion', 'producto', 'decision'];
const ESTADOS = ['nueva', 'aprobada', 'en_produccion', 'publicada', 'descartada'];

// Campos de cada formulario: [clave, etiqueta, tipo, opciones]
const FIELDS = {
  formats: [
    ['nombre', 'Nombre *', 'text'],
    ['link', 'Link (video / anuncio)', 'url'],
    ['industria', 'Industria', 'text'],
    ['client_slug', 'Marca (vacío = referencia de industria)', 'client'],
    ['formato', 'Formato (UGC, fotopiso, hablado…)', 'text'],
    ['etapa_embudo', 'Etapa', 'select', ETAPAS],
    ['requiere_cara', 'Requiere cara', 'bool'],
    ['nivel_produccion', 'Producción', 'select', PRODUCCION],
    ['nivel_consciencia', 'Nivel de consciencia', 'select', CONSCIENCIA],
    ['persona', 'Persona', 'text'],
    ['concepto', 'Concepto', 'text'],
    ['angulo', 'Ángulo', 'text'],
    ['hook', 'Hook', 'textarea'],
    ['ganador', 'Ganador', 'bool'],
    ['notas', 'Notas', 'textarea'],
  ],
  competitors: [
    ['marca', 'Marca *', 'text'],
    ['industria', 'Industria *', 'text'],
    ['link', 'Link (IG, Ads Library, web)', 'url'],
    ['que_tomar', 'Qué tomar', 'textarea'],
    ['marcas_aplica', 'Aplica a (slugs separados por coma)', 'text'],
    ['formato', 'Formato', 'text'],
    ['angulo', 'Ángulo', 'text'],
    ['page_id', 'ID página Facebook', 'text'],
    ['notas', 'Notas', 'textarea'],
  ],
  ideas: [
    ['client_slug', 'Marca *', 'client'],
    ['idea', 'Idea *', 'textarea'],
    ['estado', 'Estado', 'select', ESTADOS],
    ['formato', 'Formato', 'text'],
    ['persona', 'Persona', 'text'],
    ['concepto', 'Concepto', 'text'],
    ['publico_nuevo', 'Apunta a público nuevo', 'bool'],
    ['origen', 'Origen', 'text'],
  ],
};
const LIST_KEY = { formats: 'formats', competitors: 'competitors', ideas: 'ideas' };

const label = (s) => (s ? String(s).replace(/_/g, ' ') : '');
function LinkOut({ href }) {
  if (!href) return null;
  return <a className="lib-link" href={href} target="_blank" rel="noopener noreferrer">Link ↗</a>;
}

function CardActions({ href, onEdit }) {
  return (
    <div className="lib-card-actions">
      <LinkOut href={href} />
      <button className="ctrl-btn ctrl-btn--ghost ctrl-btn--sm" onClick={onEdit}>Editar</button>
    </div>
  );
}

function Chips({ items }) {
  const list = items.filter(Boolean);
  if (!list.length) return null;
  return <div className="lib-chips">{list.map((c) => <span key={c} className="lib-chip">{c}</span>)}</div>;
}

function FormatCard({ f, onEdit }) {
  return (
    <div className="lib-card">
      <div className="lib-card-top">
        <div className="lib-card-title">
          {f.nombre}
          {/* En referencias (sin marca) ganador=false es el default, no un resultado: el badge va solo en anuncios de una marca. */}
          {f.client_slug && (f.ganador
            ? <span className="lib-win">ganador</span>
            : <span className="lib-win lib-lose">perdedor</span>)}
        </div>
        <CardActions href={f.link} onEdit={onEdit} />
      </div>
      <Chips items={[f.client_slug || 'referencia', f.industria, f.formato, f.etapa_embudo && f.etapa_embudo.toUpperCase(),
        f.requiere_cara === true ? 'con cara' : f.requiere_cara === false ? 'sin cara' : null,
        f.nivel_produccion && `producción ${f.nivel_produccion}`, label(f.nivel_consciencia)]} />
      {f.hook && <div className="lib-text"><b>Hook:</b> {f.hook}</div>}
      {(f.concepto || f.angulo) && <div className="lib-text">{[f.concepto, f.angulo].filter(Boolean).join(' · ')}</div>}
      {f.notas && <div className="lib-text lib-muted">{f.notas}</div>}
    </div>
  );
}

function CompetitorCard({ c, onEdit }) {
  return (
    <div className="lib-card">
      <div className="lib-card-top">
        <div className="lib-card-title">{c.marca}</div>
        <CardActions href={c.link} onEdit={onEdit} />
      </div>
      <Chips items={[c.industria, c.formato, ...(c.marcas_aplica || []).map((m) => `→ ${m}`)]} />
      {c.que_tomar && <div className="lib-text"><b>Qué tomar:</b> {c.que_tomar}</div>}
      {c.angulo && <div className="lib-text">{c.angulo}</div>}
      {c.notas && <div className="lib-text lib-muted">{c.notas}</div>}
    </div>
  );
}

function IdeaCard({ i, onEdit }) {
  return (
    <div className="lib-card">
      <div className="lib-card-top">
        <div className="lib-card-title">{i.client_slug}</div>
        <button className="ctrl-btn ctrl-btn--ghost ctrl-btn--sm" onClick={onEdit}>Editar</button>
      </div>
      <div className="lib-text">{i.idea}</div>
      <Chips items={[label(i.estado), i.formato, i.persona, i.publico_nuevo ? 'público nuevo' : null, i.origen]} />
    </div>
  );
}

function EditForm({ tab, item, clients, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    const f = { ...(item || {}) };
    if (tab === 'competitors' && Array.isArray(f.marcas_aplica)) f.marcas_aplica = f.marcas_aplica.join(', ');
    return f;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const fields = Object.fromEntries(FIELDS[tab].map(([k]) => [k, form[k] === undefined ? '' : form[k]]));
      if (item?.id) await apiClient.put(`/library/${tab}/${item.id}`, fields);
      else await apiClient.post(`/library/${tab}`, fields);
      onSaved();
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
    } finally { setSaving(false); }
  };

  return (
    <div className="lib-modal-bg" onClick={onClose}>
      <form className="lib-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="lib-modal-title">{item?.id ? 'Editar' : 'Agregar'} · {TABS.find((t) => t.k === tab).l}</div>
        <div className="lib-form-grid">
          {FIELDS[tab].filter(([k]) => !(tab === 'formats' && k === 'ganador' && !form.client_slug)).map(([k, l, type, opts]) => {
            const v = form[k] ?? '';
            let input;
            if (type === 'textarea') input = <textarea rows={3} value={v} onChange={(e) => set(k, e.target.value)} />;
            else if (type === 'select') input = (
              <select value={v} onChange={(e) => set(k, e.target.value)}>
                <option value="">—</option>
                {opts.map((o) => <option key={o} value={o}>{label(o)}</option>)}
              </select>
            );
            else if (type === 'bool') input = (
              <select value={v === true ? 'true' : v === false ? 'false' : ''}
                onChange={(e) => set(k, e.target.value === '' ? '' : e.target.value === 'true')}>
                <option value="">—</option><option value="true">Sí</option><option value="false">No</option>
              </select>
            );
            else if (type === 'client') input = (
              // La marca de una idea no se cambia al editar (la idea queda atada a su marca).
              <select value={v} disabled={tab === 'ideas' && !!item?.id} onChange={(e) => set(k, e.target.value)}>
                <option value="">{tab === 'ideas' ? 'Elegí una marca' : 'Referencia de industria'}</option>
                {clients.map((c) => <option key={c.slug} value={c.slug}>{c.name || c.slug}</option>)}
                {v && !clients.some((c) => c.slug === v) && <option value={v}>{v}</option>}
              </select>
            );
            else input = <input type={type} value={v} onChange={(e) => set(k, e.target.value)} />;
            return (
              <label key={k} className={`lib-field${type === 'textarea' || k === 'link' ? ' lib-field--wide' : ''}`}>
                <span>{l}</span>{input}
              </label>
            );
          })}
        </div>
        {error && <div className="lib-error">{error}</div>}
        <div className="lib-modal-actions">
          <button type="button" className="ctrl-btn ctrl-btn--ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="ctrl-btn" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  );
}

const EMPTY_FILTERS = { industria: '', etapa_embudo: '', formato: '', requiere_cara: '', nivel_produccion: '', client_slug: '', estado: '', text: '' };

export default function Library({ onBack }) {
  const [tab, setTab] = useState('formats');
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [editing, setEditing] = useState(null); // null | {} (nuevo) | item
  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    apiClient.get('/admin/clients').then((r) => setClients(r.data.clients || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let params = {};
      if (tab === 'formats') {
        params = { industria: filters.industria, etapa_embudo: filters.etapa_embudo, formato: filters.formato,
          requiere_cara: filters.requiere_cara, nivel_produccion: filters.nivel_produccion, text: filters.text };
        if (filters.client_slug === '__ref') params.solo_referencias = 'true';
        else params.client_slug = filters.client_slug;
      } else if (tab === 'competitors') params = { industria: filters.industria, marca_aplica: filters.client_slug };
      else params = { client_slug: filters.client_slug, estado: filters.estado };
      params = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
      const res = await apiClient.get(`/library/${tab}`, { params });
      setItems(res.data[LIST_KEY[tab]] || []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar.');
    } finally { setLoading(false); }
  }, [tab, filters]);

  // Debounce corto para los filtros de texto.
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const changeTab = (k) => { setTab(k); setFilters(EMPTY_FILTERS); setItems([]); };
  const clientOpts = useMemo(() => clients.map((c) => <option key={c.slug} value={c.slug}>{c.name || c.slug}</option>), [clients]);

  return (
    <div className="ctrl-page">
      <div className="ctrl-header">
        <div className="ctrl-header-top">
          <div>
            <button className="ctrl-btn ctrl-btn--ghost ctrl-btn--sm" onClick={onBack}>← Volver</button>
            <div className="ctrl-brand ctrl-brand--lg" style={{ marginTop: 12 }}>Biblioteca creativa</div>
          </div>
          <div className="ctrl-header-actions">
            <button className="ctrl-btn" onClick={() => setEditing({})}>+ Agregar</button>
          </div>
        </div>

        <div className="lib-tabs">
          {TABS.map((t) => (
            <button key={t.k} className={`lib-tab${tab === t.k ? ' lib-tab--on' : ''}`} onClick={() => changeTab(t.k)}>{t.l}</button>
          ))}
        </div>

        <div className="lib-filters">
          {tab !== 'ideas' && <input placeholder="Industria" value={filters.industria} onChange={(e) => setF('industria', e.target.value)} />}
          {tab === 'formats' && <>
            <input placeholder="Formato" value={filters.formato} onChange={(e) => setF('formato', e.target.value)} />
            <select value={filters.etapa_embudo} onChange={(e) => setF('etapa_embudo', e.target.value)}>
              <option value="">Etapa</option>{ETAPAS.map((x) => <option key={x} value={x}>{x.toUpperCase()}</option>)}
            </select>
            <select value={filters.requiere_cara} onChange={(e) => setF('requiere_cara', e.target.value)}>
              <option value="">Cara</option><option value="true">Con cara</option><option value="false">Sin cara</option>
            </select>
            <select value={filters.nivel_produccion} onChange={(e) => setF('nivel_produccion', e.target.value)}>
              <option value="">Producción</option>{PRODUCCION.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </>}
          <select value={filters.client_slug} onChange={(e) => setF('client_slug', e.target.value)}>
            <option value="">{tab === 'competitors' ? 'Aplica a: todas' : 'Todas las marcas'}</option>
            {tab === 'formats' && <option value="__ref">Solo referencias</option>}
            {clientOpts}
          </select>
          {tab === 'ideas' && (
            <select value={filters.estado} onChange={(e) => setF('estado', e.target.value)}>
              <option value="">Estado</option>{ESTADOS.map((x) => <option key={x} value={x}>{label(x)}</option>)}
            </select>
          )}
          {tab === 'formats' && <input placeholder="Buscar (hook, concepto…)" value={filters.text} onChange={(e) => setF('text', e.target.value)} />}
        </div>
      </div>

      {error && <div className="lib-error">{error}</div>}
      {loading ? (
        <div className="loading-center"><span className="spinner" /><span>Cargando…</span></div>
      ) : !items.length ? (
        <div className="lib-empty">No hay nada cargado con estos filtros.</div>
      ) : (
        <>
          <div className="lib-count">{items.length} {items.length === 1 ? 'resultado' : 'resultados'}</div>
          <div className="lib-grid">
            {items.map((x) => (
              tab === 'formats' ? <FormatCard key={x.id} f={x} onEdit={() => setEditing(x)} />
                : tab === 'competitors' ? <CompetitorCard key={x.id} c={x} onEdit={() => setEditing(x)} />
                  : <IdeaCard key={x.id} i={x} onEdit={() => setEditing(x)} />
            ))}
          </div>
        </>
      )}

      {editing && (
        <EditForm tab={tab} item={editing} clients={clients}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}
