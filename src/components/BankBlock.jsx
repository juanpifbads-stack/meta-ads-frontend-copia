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

  return (
    <div className="bb">
      <div className="bb-row">
        <span className="bb-lbl">Titular</span>
        <strong>{bankInfo.titular}</strong>
      </div>
      <div className="bb-row">
        <span className="bb-lbl">Alias</span>
        <div className="bb-copy">
          <strong>{bankInfo.alias}</strong>
          <button onClick={() => copy(bankInfo.alias, 'alias')}>{copied === 'alias' ? '✓' : 'Copiar'}</button>
        </div>
      </div>
      <div className="bb-row">
        <span className="bb-lbl">CBU / CVU</span>
        <div className="bb-copy">
          <strong className="bb-mono">{bankInfo.cbu}</strong>
          <button onClick={() => copy(bankInfo.cbu, 'cbu')}>{copied === 'cbu' ? '✓' : 'Copiar'}</button>
        </div>
      </div>
      {bankInfo.observaciones && <div className="bb-obs">{bankInfo.observaciones}</div>}
    </div>
  );
}
