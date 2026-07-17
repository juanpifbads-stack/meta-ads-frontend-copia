import React from 'react';

export default function AccountSelector({ accounts, selectedAccount, onSelect, loading, onRename, canRename }) {
  const storedName = typeof window !== 'undefined' ? localStorage.getItem('selectedAccountName') : null;
  const current = (accounts || []).find((a) => String(a.id).replace(/^act_/, '') === String(selectedAccount || '').replace(/^act_/, ''));
  const renameCurrent = () => {
    if (!current || !onRename) return;
    const actual = current.alias || '';
    const val = window.prompt(`Nombre para "${current.metaName || current.name}"\n(vacío = usar el nombre de Meta)`, actual);
    if (val === null) return; // canceló
    onRename(current.id, val.trim());
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="spinner spinner-sm" />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {selectedAccount && storedName
            ? `${storedName}`
            : 'Cargando cuentas...'}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
              {account.name}
            </option>
          ))}
        </select>
        {canRename && onRename && current && (
          <button
            type="button"
            onClick={renameCurrent}
            title="Renombrar esta cuenta"
            style={{ border: '1px solid var(--color-border, #ccc)', background: 'transparent', borderRadius: 8, padding: '6px 9px', cursor: 'pointer', fontSize: 13 }}
          >
            ✎
          </button>
        )}
      </div>
    </div>
  );
}
