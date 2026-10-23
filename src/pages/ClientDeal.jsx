import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client.js';
import { ConfigTab, servLabel } from '../components/FinancePanel.jsx';

const currentYM = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; };

// Página de Configuración del cliente (admin): el DEAL (servicios/fees).
// El estado del cliente (activo / de baja) vive en el encabezado; la baja se hace en un modal.
export default function ClientDeal({ slug, onBack }) {
  const [people, setPeople] = useState([]);
  const [month, setMonth] = useState(currentYM());
  const [client, setClient] = useState(null);   // { name, active }
  const [servicios, setServicios] = useState([]); // servicios vigentes (para baja parcial)

  const loadClient = useCallback(() => {
    apiClient.get('/admin/clients?all=1').then((r) => {
      const c = (r.data.clients || []).find((x) => x.slug === slug);
      setClient(c || { name: slug, active: true });
    }).catch(() => setClient({ name: slug, active: true }));
    apiClient.get(`/admin/finance/services?client=${slug}`).then((r) => setServicios((r.data.lines || []).map((l) => l.servicio))).catch(() => setServicios([]));
  }, [slug]);

  useEffect(() => {
    apiClient.get('/admin/users').then((r) => setPeople((r.data.users || []).map((u) => u.name))).catch(() => setPeople([]));
    loadClient();
  }, [slug, loadClient]);

  const name = client?.name || slug;

  return (
    <div className="ad-section" style={{ maxWidth: 960, margin: '0 auto' }}>
      <ConfigTab
        slug={slug} clientName={name} people={people} month={month} setMonth={setMonth} onBack={onBack}
        headerExtra={<EstadoCliente slug={slug} name={name} active={client?.active !== false} servicios={servicios} onChange={loadClient} />}
      />
    </div>
  );
}

// Estado del cliente en el encabezado: etiqueta + acción (Dar de baja / Dar de alta).
function EstadoCliente({ slug, name, active, servicios, onChange }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');

  const darAlta = () => {
    if (!window.confirm(`¿Dar de alta a ${name}? Vuelve a estar activo.`)) return;
    apiClient.post(`/admin/${slug}/reactivate`, {}).then(() => onChange && onChange()).catch((e) => setErr(e?.response?.data?.message || 'No se pudo dar de alta'));
  };

  return (
    <>
      <span className={`fp-status-pill ${active ? 'fp-status-pill--on' : 'fp-status-pill--off'}`}>{active ? 'Activo' : 'De baja'}</span>
      {active
        ? <button className="fp-btn fp-btn--danger" onClick={() => setOpen(true)}>Dar de baja</button>
        : <button className="fp-btn" onClick={darAlta}>Dar de alta</button>}
      {err && <span className="fp-status--error" style={{ fontSize: 13 }}>{err}</span>}
      {open && <BajaModal slug={slug} name={name} servicios={servicios} onClose={() => setOpen(false)} onDone={() => { setOpen(false); onChange && onChange(); }} />}
    </>
  );
}

// Estilo de cada opción de alcance (todo el cliente / algunos servicios). Resalta la elegida.
const optCard = (on) => ({
  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', cursor: 'pointer',
  border: `1.5px solid ${on ? '#b91c1c' : '#e5e6ea'}`, borderRadius: 12,
  background: on ? '#fff5f5' : '#fff',
});

function BajaModal({ slug, name, servicios, onClose, onDone }) {
  const [alcance, setAlcance] = useState('cliente'); // 'cliente' | 'servicios'
  const [sel, setSel] = useState([]);
  const [motivo, setMotivo] = useState('');
  const [ultimoMes, setUltimoMes] = useState(currentYM());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const toggleServ = (s) => setSel((xs) => (xs.includes(s) ? xs.filter((x) => x !== s) : [...xs, s]));

  const confirmar = () => {
    if (alcance === 'servicios' && sel.length === 0) { setErr('Elegí al menos un servicio.'); return; }
    setBusy(true); setErr('');
    apiClient.post(`/admin/${slug}/churn`, { motivo, ultimoMes, servicios: alcance === 'servicios' ? sel : [] })
      .then(onDone)
      .catch((e) => { setBusy(false); setErr(e?.response?.data?.message || 'No se pudo dar de baja'); });
  };

  return (
    <div className="fp-modal-overlay" onClick={onClose}>
      <div className="fp-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="fp-modal-head">
          <strong>Dar de baja — {name}</strong>
          <button className="fp-modal-x" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="fp-sub" style={{ fontWeight: 700, marginBottom: 8 }}>¿Qué querés dar de baja?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          <label style={optCard(alcance === 'cliente')}>
            <input type="radio" name="alcance-baja" checked={alcance === 'cliente'} onChange={() => setAlcance('cliente')} style={{ marginTop: 3 }} />
            <div>
              <div style={{ fontWeight: 600 }}>Todo el cliente</div>
              <div className="fp-muted" style={{ fontSize: 12, padding: 0 }}>Deja de ser cliente: sale de Finanzas y del semáforo.</div>
            </div>
          </label>
          <label style={optCard(alcance === 'servicios')}>
            <input type="radio" name="alcance-baja" checked={alcance === 'servicios'} onChange={() => setAlcance('servicios')} style={{ marginTop: 3 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>Solo algunos servicios</div>
              <div className="fp-muted" style={{ fontSize: 12, padding: 0 }}>El cliente sigue activo; se dan de baja únicamente los servicios que tildes.</div>
              {alcance === 'servicios' && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #eee' }}>
                  {servicios.length === 0
                    ? <div className="fp-muted">Este cliente no tiene servicios cargados.</div>
                    : servicios.map((s) => (
                      <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0', cursor: 'pointer' }}>
                        <input type="checkbox" checked={sel.includes(s)} onChange={() => toggleServ(s)} /> {servLabel(s)}
                      </label>
                    ))}
                </div>
              )}
            </div>
          </label>
        </div>

        <div className="fp-grid">
          <label>Último mes que cobra<input type="month" value={ultimoMes} onChange={(e) => setUltimoMes(e.target.value)} /></label>
          <label>Motivo<input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ej. se pausó, se fue…" /></label>
        </div>

        {err && <div className="fp-alert fp-alert--error">⚠ {err}</div>}

        <div className="fp-modal-foot">
          <button className="fp-btn" onClick={onClose}>Cancelar</button>
          <button className="fp-btn fp-btn--danger fp-btn--danger-solid" disabled={busy} onClick={confirmar}>
            {busy ? 'Dando de baja…' : alcance === 'servicios' ? 'Dar de baja los servicios elegidos' : 'Dar de baja todo el cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}
