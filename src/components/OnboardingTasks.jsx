import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client.js';
import { OnboardingForm, ContentModal } from '../pages/Onboarding.jsx';

// Tareas de onboarding (formulario + carpeta de contenido) dentro del panel del cliente.
// Reusa los modales del onboarding. Se muestra solo si los toggles están prendidos.
export default function OnboardingTasks({ slug, accessKey, toggles, onChange }) {
  const [ob, setOb] = useState(null);
  const [modal, setModal] = useState(null); // 'form' | 'content'

  const load = useCallback(() => {
    apiClient.get(`/onboarding/${slug}`, { params: { key: accessKey } })
      .then((r) => setOb(r.data)).catch(() => setOb(null));
  }, [slug, accessKey]);
  useEffect(() => { load(); }, [load]);
  const saved = () => { setModal(null); load(); if (onChange) onChange(); };

  const wantForm = !!toggles?.pedirFormulario;
  const wantContent = !!toggles?.pedirContenido;
  if (!ob || (!wantForm && !wantContent)) return null;

  const card = (title, done, onOpen) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '0.5px solid var(--color-gray-mid, #d8d6cf)', borderRadius: 10, background: 'var(--color-white,#fff)' }}>
      <span style={{ fontSize: 16, color: done ? '#15803d' : '#94a3b8', flexShrink: 0 }}>{done ? '✓' : '○'}</span>
      <span style={{ flex: 1, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: done ? 'line-through' : 'none', color: done ? '#64748b' : 'inherit' }}>{title}</span>
      <button onClick={onOpen} style={{ flexShrink: 0, padding: '6px 16px', fontSize: 13, borderRadius: 8, border: '1.5px solid #15161a', background: done ? 'transparent' : 'var(--color-brand-blue,#2c4cff)', color: done ? '#15161a' : '#fff', borderColor: done ? '#15161a' : 'transparent', cursor: 'pointer', fontWeight: 500 }}>{done ? 'Revisar' : 'Completar'}</button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
      {wantForm && card('Completar formulario de marca', !!ob.formSubmitted, () => setModal('form'))}
      {wantContent && card('Subir carpeta de contenido', !!ob.contentSubmitted, () => setModal('content'))}
      {modal === 'form' && (
        <OnboardingForm slug={slug} authKey={accessKey} questions={ob.questions || []} initialAnswers={ob.answers || []}
          initialPersonas={ob.personas || [{ id: 'p1', description: '' }]} intros={ob.sectionIntros || {}}
          onClose={() => setModal(null)} onSaved={saved} />
      )}
      {modal === 'content' && (
        <ContentModal slug={slug} authKey={accessKey} initialLink={ob.content?.driveLink || ''}
          onClose={() => setModal(null)} onSaved={saved} />
      )}
    </div>
  );
}
