import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client.js';
import { ConfigTab, servLabel } from '../components/FinancePanel.jsx';

const currentYM = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; };

// Página de Configuración del cliente (admin): el DEAL (servicios/fees) + dar de baja/alta.
// El deal es una característica del cliente, por eso vive acá y no en Finanzas.
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
      <ConfigTab slug={slug} clientName={name} people={people} month={month} setMonth={setMonth} onBack={onBack} />
      <BajaAlta slug={slug} name={name} active={client?.active !== false} servicios={servicios} onChange={loadClient} />
    </div>
  );
}

// Bloque de baja / alta. Un solo botón que alterna según el estado del cliente.
function BajaAlta({ slug, name, active, servicios, onChange }) {
  const [open, setOpen] = useState(false);
  const [alcance, setAlcance] = useState('cliente'); // 'cliente' | 'servicios'
  const [sel, setSel] = useState([]);                // servicios elegidos si alcance='servicios'
  const [motivo, setMotivo] = useState('');
  const [ultimoMes, setUltimoMes] = useState(currentYM());
  const [msg, setMsg] = useState('');

  const toggleServ = (s) => setSel((xs) => xs.includes(s) ? xs.filter((x) => x !== s) : [...xs, s]);

  const darBaja = () => {
    if (alcance === 'servicios' && sel.length === 0) { setMsg('Elegí al menos un servicio.'); return; }
    const body = { motivo, ultimoMes, servicios: alcance === 'servicios' ? sel : [] };
    const label = alcance === 'servicios' ? `los servicios (${sel.map(servLabel).join(', ')})` : `TODO el cliente ${name}`;
    if (!window.confirm(`¿Dar de baja ${label}? El fee deja de contar después de ${ultimoMes}.`)) return;
    apiClient.post(`/admin/${slug}/churn`, body).then(() => { setOpen(false); setMsg(''); setSel([]); setMotivo(''); onChange && onChange(); })
      .catch((e) => setMsg(e?.response?.data?.message || 'Error al dar de baja'));
  };
  const darAlta = () => {
    if (!window.confirm(`¿Dar de alta a ${name}? Vuelve a estar activo.`)) return;
    apiClient.post(`/admin/${slug}/reactivate`, {}).then(() => onChange && onChange()).catch((e) => setMsg(e?.response?.data?.message || 'Error'));
  };

  return (
    <div className="fp-card" style={{ marginTop: 18, borderColor: '#f0c9c9' }}>
      <div style={{ textAlign: 'center', padding: '4px 0 2px' }}>
        <div className="fp-sub" style={{ fontWeight: 700, marginBottom: 8 }}>Estado del cliente</div>
        <span style={{ display: 'inline-block', fontSize: 14, fontWeight: 700, padding: '5px 18px', borderRadius: 999, background: active ? '#dcfce7' : '#fee2e2', color: active ? '#15803d' : '#b91c1c' }}>{active ? 'Activo' : 'De baja'}</span>
        <div style={{ marginTop: 12 }}>
          {active
            ? <button className="fp-btn fp-btn--danger" style={{ fontSize: 15, padding: '10px 24px' }} onClick={() => setOpen((o) => !o)}>Dar de baja</button>
            : <button className="fp-btn fp-btn--primary" style={{ fontSize: 15, padding: '10px 24px' }} onClick={darAlta}>Dar de alta</button>}
        </div>
      </div>
      {active && open && (
        <div style={{ marginTop: 6 }}>
          <div className="fp-grid">
            <label>Alcance<select value={alcance} onChange={(e) => setAlcance(e.target.value)}><option value="cliente">Todo el cliente</option><option value="servicios">Solo algunos servicios</option></select></label>
            <label>Último mes que cobra<input type="month" value={ultimoMes} onChange={(e) => setUltimoMes(e.target.value)} /></label>
            <label>Motivo<input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ej. se pausó, se fue…" /></label>
          </div>
          {alcance === 'servicios' && (
            <div className="fp-pre" style={{ marginTop: 8 }}>
              <div className="fp-sub">Servicios a dar de baja</div>
              {servicios.length === 0 ? <div className="fp-muted">Este cliente no tiene servicios cargados.</div> : servicios.map((s) => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                  <input type="checkbox" checked={sel.includes(s)} onChange={() => toggleServ(s)} /> {servLabel(s)}
                </label>
              ))}
            </div>
          )}
          {msg && <div className="fp-msg" style={{ color: '#b91c1c' }}>{msg}</div>}
          <div className="fp-card-foot">
            <button className="fp-btn" style={{ marginRight: 8 }} onClick={() => setOpen(false)}>Cancelar</button>
            <button className="fp-btn fp-btn--danger" onClick={darBaja}>Confirmar baja</button>
          </div>
        </div>
      )}
      {!active && <p className="fp-muted" style={{ marginTop: 6 }}>El cliente está de baja: no aparece en Finanzas ni en el semáforo. Podés darlo de alta cuando vuelva.</p>}
    </div>
  );
}
