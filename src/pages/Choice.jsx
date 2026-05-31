import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import './Choice.css';

export default function Choice({ onPick }) {
  const { logout } = useAuth();
  return (
    <div className="choice-screen">
      <div className="choice-box">
        <div className="choice-brand">alquimia.</div>
        <div className="choice-eyebrow">¿Qué vas a hacer hoy?</div>
        <h1 className="choice-title">Elegí modo</h1>
        <div className="choice-grid">
          <div className="choice-card" onClick={() => onPick('optimize')}>
            <div className="choice-num">— 01</div>
            <div className="choice-name">Optimizar</div>
            <div className="choice-desc">
              Ver campañas y conjuntos activos en 3 ventanas (7D / 14D / 30D)
              para tomar decisiones. Cambios reales en Meta.
            </div>
            <div className="choice-arrow">Ir a optimizar →</div>
          </div>
          <div className="choice-card" onClick={() => onPick('control')}>
            <div className="choice-num">— 02</div>
            <div className="choice-name">Control</div>
            <div className="choice-desc">
              Pantallazo de todas las cuentas: gasto, ROAS y avance contra
              objetivo del mes. Filtros por cuenta y responsable.
            </div>
            <div className="choice-arrow">Ir al control →</div>
          </div>
          <div className="choice-card" onClick={() => onPick('analyze')}>
            <div className="choice-num">— 03</div>
            <div className="choice-name">Analizar cuenta</div>
            <div className="choice-desc">
              Descargá el historial completo de cambios de cualquier cuenta:
              presupuestos, estados, nuevos conjuntos y más. Elegís cuenta y período.
            </div>
            <div className="choice-arrow">Ir a analizar →</div>
          </div>
        </div>
        <button className="choice-logout" onClick={logout}>Cerrar sesión</button>
      </div>
    </div>
  );
}
