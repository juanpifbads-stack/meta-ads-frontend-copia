import React, { useState } from 'react';
import './BankBlock.css';

export default function BankBlock({ bankInfo }) {
  const [copied, setCopied] = useState(null);
  if (!bankInfo) return null;

  const copy = (text, label) => {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const validCbu = bankInfo.cbu && !/^0+$/.test(bankInfo.cbu);

  return (
    <div className="bb">
      {bankInfo.titular && (
        <div className="bb-row">
          <span className="bb-lbl">Titular</span>
          <strong>{bankInfo.titular}</strong>
        </div>
      )}
      {bankInfo.alias && (
        <div className="bb-row">
          <span className="bb-lbl">Alias</span>
          <div className="bb-copy">
            <strong>{bankInfo.alias}</strong>
            <button onClick={() => copy(bankInfo.alias, 'alias')}>{copied === 'alias' ? '✓' : 'Copiar'}</button>
          </div>
        </div>
      )}
      {validCbu && (
        <div className="bb-row">
          <span className="bb-lbl">CBU / CVU</span>
          <div className="bb-copy">
            <strong className="bb-mono">{bankInfo.cbu}</strong>
            <button onClick={() => copy(bankInfo.cbu, 'cbu')}>{copied === 'cbu' ? '✓' : 'Copiar'}</button>
          </div>
        </div>
      )}
      {bankInfo.cuenta && (
        <div className="bb-row">
          <span className="bb-lbl">Cuenta</span>
          <strong>{bankInfo.cuenta}</strong>
        </div>
      )}
      {bankInfo.banco && (
        <div className="bb-row">
          <span className="bb-lbl">Banco</span>
          <strong>{bankInfo.banco}</strong>
        </div>
      )}
      {bankInfo.cuil && (
        <div className="bb-row">
          <span className="bb-lbl">CUIL / CUIT</span>
          <div className="bb-copy">
            <strong className="bb-mono">{bankInfo.cuil}</strong>
            <button onClick={() => copy(bankInfo.cuil, 'cuil')}>{copied === 'cuil' ? '✓' : 'Copiar'}</button>
          </div>
        </div>
      )}
      {bankInfo.observaciones && <div className="bb-obs">{bankInfo.observaciones}</div>}
    </div>
  );
}
