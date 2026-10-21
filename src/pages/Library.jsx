import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../api/client.js';
import './Control.css';
import './Library.css';

// Biblioteca creativa: formatos de referencia, marcas referencia e ideas de contenido.
// Mismas tablas que usa el conector MCP del brief (creative_formats, competitor_refs, content_ideas).

const TABS = [
  { k: 'formats', l: 'Formatos' },
  { k: 'competitors', l: 'Marcas referencia' },
];
// La pestaña Ideas se sacó de la pantalla (las ideas siguen en la base y en el MCP).
const ETAPAS = ['tofu', 'mofu', 'bofu'];
const PRODUCCION = ['bajo', 'medio', 'alto'];
// Industrias fijas por ahora (se filtra por coincidencia exacta).
const INDUSTRIAS = ['indumentaria', 'indumentaria Avellaneda', 'joyas', 'beauty'];
// Lista fija de formatos: cómo se ve la pieza (de qué trata va en concepto / ángulo). Igual que en el backend.
const FORMATOS = [
  'Foto · Fotopiso', 'Foto · Modelo / estudio', 'Foto · Placa', 'Foto · Carrusel', 'Foto · Catálogo dinámico',
  'Video · Producto (sin cara)', 'Video · Modelo / lookbook', 'Video · Hablado a cámara', 'Video · UGC / creador',
  'Video · Detrás de escena / local', 'Video · Animado / GIF',
];
const ETAPA_CLASS = { tofu: 'lib-etapa--tofu', mofu: 'lib-etapa--mofu', bofu: 'lib-etapa--bofu' };
const CONSCIENCIA = ['inconsciente', 'problema', 'solucion', 'producto', 'decision'];
const ESTADOS = ['nueva', 'aprobada', 'en_produccion', 'publicada', 'descartada'];

// Campos de cada formulario: [clave, etiqueta, tipo, opciones]
const FIELDS = {
  formats: [
    ['nombre', 'Nombre *', 'text'],
    ['link', 'Link (video / anuncio)', 'url'],
    ['industria', 'Industria', 'select', INDUSTRIAS],
    ['client_slug', 'Marca (vacío = referencia de industria)', 'client'],
    ['competitor_ref_id', 'Marca referencia (de quién es el anuncio)', 'ref'],
    ['formato', 'Formato', 'select', FORMATOS],
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
    ['industria', 'Industria *', 'select', INDUSTRIAS],
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
function Chips({ items }) {
  const list = items.filter(Boolean);
  if (!list.length) return null;
  return <div className="lib-chips">{list.map((c) => <span key={c} className="lib-chip">{c}</span>)}</div>;
}

// En referencias (sin marca) ganador=false es el default, no un resultado: el badge va solo en anuncios de una marca.
const winBadge = (f) => f.client_slug && (f.ganador
  ? <span className="lib-win">ganador</span>
  : <span className="lib-win lib-lose">perdedor</span>);

// Marca normalizada (sin tildes, mayúsculas ni espacios de más): "Notre Succès" = "notre succes".
const normMarca = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Una tarjeta por marca referencia, aunque haya varias filas cargadas con la misma marca.
function groupCompetitors(rows, clientName) {
  const groups = new Map();
  for (const r of rows) {
    const k = normMarca(r.marca);
    if (!groups.has(k)) groups.set(k, { id: k, marca: r.marca, rows: [] });
    groups.get(k).rows.push(r);
  }
  return [...groups.values()].map((g) => {
    const aplica = [...new Set(g.rows.flatMap((r) => r.marcas_aplica || []))];
    return {
      ...g,
      aplica,
      refDe: aplica.length ? `Referencia de: ${aplica.map(clientName).join(', ')}` : 'Referencia de industria',
      link: g.rows.find((r) => r.link)?.link,
    };
  });
}

// Formatos de una marca referencia: los que apuntan a alguna de sus fichas (competitor_ref_id).
const formatsOf = (group, formats) => {
  const ids = new Set(group.rows.map((r) => r.id));
  return formats.filter((f) => f.competitor_ref_id && ids.has(f.competitor_ref_id));
};

const caraProd = (f) => [
  f.requiere_cara === true ? 'Con cara' : f.requiere_cara === false ? 'Sin cara' : 'Cara opcional',
  f.nivel_produccion && `prod. ${{ bajo: 'baja', medio: 'media', alto: 'alta' }[f.nivel_produccion] || f.nivel_produccion}`,
].filter(Boolean).join(' · ');

// Tarjeta en tres partes: arriba tipo + etapa, en el medio título (abre el detalle) y una línea, abajo datos y link.
const CARD = {
  formats: (f) => ({ head: f.formato, etapa: f.etapa_embudo, title: f.nombre, badge: winBadge(f), desc: f.concepto,
    foot: caraProd(f), link: f.link, linkLabel: f.formato?.startsWith('Foto') ? 'Ver pieza' : 'Ver video' }),
  competitors: (g) => ({ head: g.rows[0]?.industria, title: g.marca, desc: g.refDe, link: g.link, linkLabel: 'Ver anuncios' }),
  ideas: (i) => ({ title: i.idea, desc: [i.client_slug, label(i.estado)].filter(Boolean).join(' · ') }),
};

const EtapaPill = ({ etapa }) => (etapa ? <span className={`lib-etapa ${ETAPA_CLASS[etapa] || ''}`}>{etapa.toUpperCase()}</span> : null);

function SmallCard({ tab, item, onOpen }) {
  const c = CARD[tab](item);
  return (
    <div className="lib-card">
      {(c.head || c.etapa) && (
        <div className="lib-card-head"><span>{c.head || 'Sin formato'}</span><EtapaPill etapa={c.etapa} /></div>
      )}
      <button className="lib-card-title-btn" onClick={onOpen}>{c.title}{c.badge}</button>
      {c.desc && <div className="lib-card-desc">{c.desc}</div>}
      {(c.foot || c.link) && (
        <div className="lib-card-foot">
          <span>{c.foot}</span>
          {c.link && <a className="lib-link-btn" href={c.link} target="_blank" rel="noopener noreferrer">{c.linkLabel} ↗</a>}
        </div>
      )}
    </div>
  );
}

// Todo el detalle de un ítem, en un pop-up.
function DetailBody({ tab, x, formats = [], onEditRow }) {
  if (tab === 'formats') return <>
    <div className="lib-card-head"><span>{x.formato || 'Sin formato'}</span><EtapaPill etapa={x.etapa_embudo} /></div>
    <Chips items={[x.client_slug || 'referencia', x.industria,
      x.requiere_cara === true ? 'con cara' : x.requiere_cara === false ? 'sin cara' : null,
      x.nivel_produccion && `producción ${x.nivel_produccion}`, label(x.nivel_consciencia)]} />
    {x.hook && <div className="lib-text"><b>Hook:</b> {x.hook}</div>}
    {x.persona && <div className="lib-text"><b>Persona:</b> {x.persona}</div>}
    {(x.concepto || x.angulo) && <div className="lib-text"><b>Concepto:</b> {[x.concepto, x.angulo].filter(Boolean).join(' · ')}</div>}
    {x.notas && <div className="lib-text lib-muted">{x.notas}</div>}
  </>;
  if (tab === 'competitors') {
    const fs = formatsOf(x, formats);
    return <>
      <div className="lib-text lib-muted">{x.refDe}</div>
      {x.rows.map((r) => (
        <div key={r.id} className="lib-detail-row">
          <Chips items={[r.industria, r.formato, r.angulo]} />
          {r.que_tomar && <div className="lib-text"><b>Qué tomar:</b> {r.que_tomar}</div>}
          {r.notas && <div className="lib-text lib-muted">{r.notas}</div>}
          {x.rows.length > 1 && <button className="lib-mini" onClick={() => onEditRow(r)}>Editar esta ficha</button>}
        </div>
      ))}
      {!!fs.length && (
        <div className="lib-detail-row">
          <div className="lib-text"><b>Formatos de esta marca</b></div>
          {fs.map((f) => (
            <div key={f.id} className="lib-format-line">
              <span>{f.nombre}{f.etapa_embudo ? ` · ${f.etapa_embudo.toUpperCase()}` : ''}</span>
              {f.link && <a className="lib-link-btn" href={f.link} target="_blank" rel="noopener noreferrer">Link al video ↗</a>}
            </div>
          ))}
        </div>
      )}
    </>;
  }
  return <>
    <Chips items={[x.client_slug, label(x.estado), x.formato, x.persona, x.publico_nuevo ? 'público nuevo' : null, x.origen]} />
    {x.concepto && <div className="lib-text"><b>Concepto:</b> {x.concepto}</div>}
  </>;
}

function DetailModal({ tab, item, formats, onClose, onEdit, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const borrarMarca = async () => {
    if (!window.confirm(`¿Borrar la marca referencia "${item.marca}"? Sus formatos quedan en la biblioteca, sin marca.`)) return;
    setDeleting(true);
    try {
      for (const r of item.rows) await apiClient.delete(`/library/competitors/${r.id}`);
      onDeleted();
    } catch (err) {
      window.alert(err.message || 'No se pudo borrar.'); setDeleting(false);
    }
  };
  // En marcas referencia el ítem es un grupo: se edita la ficha (fila) que corresponda.
  const editTarget = tab === 'competitors' ? item.rows[0] : item;
  const c = CARD[tab](item);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="lib-modal-bg" onClick={onClose}>
      <div className="lib-modal lib-detail" onClick={(e) => e.stopPropagation()}>
        <div className="lib-detail-top">
          <div className="lib-modal-title">{c.title}{c.badge}</div>
          <button className="lib-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="lib-detail-body"><DetailBody tab={tab} x={item} formats={formats} onEditRow={onEdit} /></div>
        <div className="lib-modal-actions">
          {c.link && <a className="lib-link-btn" href={c.link} target="_blank" rel="noopener noreferrer">{c.linkLabel} ↗</a>}
          <div className="lib-detail-btns">
            {tab === 'competitors' && (
              <button className="lib-danger" onClick={borrarMarca} disabled={deleting}>{deleting ? 'Borrando…' : 'Borrar marca'}</button>
            )}
            <button className="ctrl-btn ctrl-btn--ghost ctrl-btn--sm" onClick={() => onEdit(editTarget)}>Editar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditForm({ tab, item, clients, refs = [], onClose, onSaved }) {
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
                {v && !opts.includes(v) && <option value={v}>{label(v)}</option>}
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
            else if (type === 'ref') input = (
              <select value={v} onChange={(e) => set(k, e.target.value)}>
                <option value="">—</option>
                {[...refs].sort((a, b) => a.marca.localeCompare(b.marca, 'es')).map((r) => <option key={r.id} value={r.id}>{r.marca}</option>)}
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

const EMPTY_FILTERS = { medio: '', industria: '', etapa_embudo: '', formato: '', requiere_cara: '', nivel_produccion: '', client_slug: '', estado: '', text: '' };

export default function Library({ onBack }) {
  const [tab, setTab] = useState('formats');
  const [items, setItems] = useState([]);
  const [refFormats, setRefFormats] = useState([]);
  const [refs, setRefs] = useState([]); // marcas referencia, para el selector del formulario de formatos // formatos, para mostrarlos dentro de cada marca referencia
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [editing, setEditing] = useState(null); // null | {} (nuevo) | item
  const [viewing, setViewing] = useState(null); // ítem abierto en el pop-up de detalle
  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    apiClient.get('/admin/clients').then((r) => setClients(r.data.clients || [])).catch(() => {});
    apiClient.get('/library/competitors').then((r) => setRefs(r.data.competitors || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let params = {};
      if (tab === 'formats') {
        params = { medio: filters.medio, industria: filters.industria, etapa_embudo: filters.etapa_embudo, formato: filters.formato,
          requiere_cara: filters.requiere_cara, nivel_produccion: filters.nivel_produccion, text: filters.text };
        if (filters.client_slug === '__ref') params.solo_referencias = 'true';
        else params.client_slug = filters.client_slug;
      } else if (tab === 'competitors') params = { industria: filters.industria, marca_aplica: filters.client_slug };
      else params = { client_slug: filters.client_slug, estado: filters.estado };
      params = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
      const res = await apiClient.get(`/library/${tab}`, { params });
      let rows = res.data[LIST_KEY[tab]] || [];
      // El backend busca industria por coincidencia parcial ("indumentaria" traería "indumentaria Avellaneda").
      if (filters.industria) rows = rows.filter((r) => normMarca(r.industria) === normMarca(filters.industria));
      setItems(rows);
      if (tab === 'competitors') {
        apiClient.get('/library/formats').then((r) => setRefFormats(r.data.formats || [])).catch(() => {});
      }
    } catch (err) {
      setError(err.message || 'No se pudo cargar.');
    } finally { setLoading(false); }
  }, [tab, filters]);

  // Debounce corto para los filtros de texto.
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const changeTab = (k) => { setTab(k); setFilters(EMPTY_FILTERS); setItems([]); };
  const clientName = useCallback((slug) => clients.find((c) => c.slug === slug)?.name || slug, [clients]);
  const shown = useMemo(() => (tab === 'competitors' ? groupCompetitors(items, clientName) : items), [tab, items, clientName]);
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
          {tab === 'formats' && (
            <div className="lib-seg" role="group" aria-label="Foto o video">
              {['', 'Foto', 'Video'].map((m) => (
                <button key={m || 'todo'} className={filters.medio === m ? 'lib-seg--on' : ''}
                  onClick={() => setFilters((f) => ({ ...f, medio: m, formato: m && f.formato && !f.formato.startsWith(m) ? '' : f.formato }))}>
                  {m || 'Todo'}
                </button>
              ))}
            </div>
          )}
          {tab !== 'ideas' && (
            <select value={filters.industria} onChange={(e) => setF('industria', e.target.value)}>
              <option value="">Todas las industrias</option>{INDUSTRIAS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          )}
          {tab === 'formats' && <>
            <select value={filters.formato} onChange={(e) => setF('formato', e.target.value)}>
              <option value="">Formato</option>
              {FORMATOS.filter((x) => !filters.medio || x.startsWith(filters.medio)).map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
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
            <option value="">{tab === 'competitors' ? 'Referencia de: todas' : 'Todas las marcas'}</option>
            {tab === 'formats' && <option value="__ref">Solo referencias</option>}
            {clientOpts}
          </select>
          {tab === 'ideas' && (
            <select value={filters.estado} onChange={(e) => setF('estado', e.target.value)}>
              <option value="">Estado</option>{ESTADOS.map((x) => <option key={x} value={x}>{label(x)}</option>)}
            </select>
          )}
          {tab === 'formats' && <input placeholder="Buscar (hook, concepto…)" value={filters.text} onChange={(e) => setF('text', e.target.value)} />}
          {Object.values(filters).some(Boolean) && (
            <button className="lib-clear" onClick={() => setFilters(EMPTY_FILTERS)}>Borrar filtros</button>
          )}
        </div>
      </div>

      {error && <div className="lib-error">{error}</div>}
      {loading ? (
        <div className="loading-center"><span className="spinner" /><span>Cargando…</span></div>
      ) : !shown.length ? (
        <div className="lib-empty">No hay nada cargado con estos filtros.</div>
      ) : (
        <>
          <div className="lib-count">{shown.length} {shown.length === 1 ? 'resultado' : 'resultados'}</div>
          <div className="lib-grid">
            {shown.map((x) => (
              <SmallCard key={x.id} tab={tab} item={x} onOpen={() => setViewing(x)} />
            ))}
          </div>
        </>
      )}

      {viewing && (
        <DetailModal tab={tab} item={viewing} formats={refFormats} onClose={() => setViewing(null)}
          onEdit={(target) => { setEditing(target); setViewing(null); }}
          onDeleted={() => {
            setViewing(null); load();
            apiClient.get('/library/competitors').then((r) => setRefs(r.data.competitors || [])).catch(() => {});
          }} />
      )}

      {editing && (
        <EditForm tab={tab} item={editing} clients={clients} refs={refs}
          onClose={() => setEditing(null)} onSaved={() => {
            setEditing(null); load();
            if (tab === 'competitors') apiClient.get('/library/competitors').then((r) => setRefs(r.data.competitors || [])).catch(() => {});
          }} />
      )}
    </div>
  );
}
