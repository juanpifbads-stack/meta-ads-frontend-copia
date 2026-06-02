import React from 'react';
import { CLIENT_LIST } from '../data/clients.js';
import './ClientsList.css';

export default function ClientsList({ onBack }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="cl-page">
      <div className="cl-header">
        <div>
          <div className="cl-brand">alquimia.</div>
          <div className="cl-eyebrow">Clientes</div>
          <h1 className="cl-title">Portales de cliente</h1>
        </div>
        <button className="cl-btn cl-btn--ghost" onClick={onBack}>← Volver</button>
      </div>

      <div className="cl-grid">
        {CLIENT_LIST.map((c) => {
          const link = `${origin}/cliente/${c.slug}`;
          return (
            <div key={c.slug} className={`cl-card ${!c.active ? 'cl-card--off' : ''}`}>
              <div className="cl-card-head">
                <span className="cl-card-name">{c.name}</span>
                <span className={`cl-tag ${c.active ? 'cl-tag--on' : 'cl-tag--off'}`}>
                  {c.active ? 'Activo' : 'Próximamente'}
                </span>
              </div>
              {c.active ? (
                <>
                  <div className="cl-block">
                    <div className="cl-block-label">Panel completo (cliente)</div>
                    <div className="cl-card-link">{link}</div>
                    <div className="cl-card-key">Clave: <strong>{c.accessKey}</strong></div>
                    <div className="cl-card-actions">
                      <a className="cl-btn" href={link} target="_blank" rel="noreferrer">Abrir panel</a>
                      <button className="cl-btn cl-btn--ghost" onClick={() => navigator.clipboard?.writeText(link)}>
                        Copiar link
                      </button>
                    </div>
                  </div>
                  <div className="cl-block">
                    <div className="cl-block-label">Solo pagos (administración)</div>
                    <div className="cl-card-link">{link}/pagos</div>
                    <div className="cl-card-key">Clave: <strong>{c.paymentsKey}</strong></div>
                    <div className="cl-card-actions">
                      <a className="cl-btn cl-btn--ghost" href={`${link}/pagos`} target="_blank" rel="noreferrer">Abrir pagos</a>
                      <button className="cl-btn cl-btn--ghost" onClick={() => navigator.clipboard?.writeText(`${link}/pagos`)}>
                        Copiar link
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="cl-card-soon">En desarrollo</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
