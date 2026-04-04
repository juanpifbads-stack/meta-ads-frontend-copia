import React from 'react';

export default function AccountSelector({ accounts, selectedAccount, onSelect, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="spinner spinner-sm" />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
          }}
        >
          Cargando cuentas...
        </span>
      </div>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--color-text-muted)',
        }}
      >
        No se encontraron cuentas publicitarias.
      </p>
    );
  }

  return (
    <div>
      <label
        htmlFor="account-select"
        style={{
          display: 'block',
          fontFamily: 'var(--font-mono)',
          fontWeight: '700',
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--color-text-muted)',
          marginBottom: '6px',
        }}
      >
        Cuenta publicitaria
      </label>
      <select
        id="account-select"
        className="select-styled"
        value={selectedAccount || ''}
        onChange={(e) => onSelect(e.target.value || null)}
        style={{ maxWidth: '420px' }}
      >
        <option value="">Seleccionar cuenta...</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} — {account.id}
          </option>
        ))}
      </select>
    </div>
  );
}
