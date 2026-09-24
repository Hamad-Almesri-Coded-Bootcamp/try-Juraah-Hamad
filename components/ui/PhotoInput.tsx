'use client';

import { useEffect, useId, useMemo, type ChangeEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { copy, t, type Locale } from '@/i18n';

export interface PhotoInputProps {
  value?: File | null;
  onChange: (file: File | null) => void;
  state?: 'idle' | 'preview' | 'analysing';
  label: ReactNode;
  takeLabel?: string;
  chooseLabel?: string;
  removeLabel?: string;
  analysingLabel?: string;
  lang?: Locale;
  className?: string;
}

/**
 * Capture-or-upload for prescription intake and the drug check (Build Prompts prompt 1, Forms).
 * Idle offers two real file-input affordances at 48px; preview shows the chosen image with a
 * Remove action; analysing disables everything and announces itself. Never uploads anything,
 * never calls fetch — the screen that owns the request decides what "analysing" means.
 */
export function PhotoInput({
  value,
  onChange,
  state,
  label,
  takeLabel,
  chooseLabel,
  removeLabel,
  analysingLabel,
  lang = 'en',
  className,
}: PhotoInputProps) {
  const takeId = useId();
  const chooseId = useId();
  const effectiveState = state ?? (value ? 'preview' : 'idle');
  // Created during render (memoised on `value`) rather than in an effect body, so revoking it is
  // the only side effect left for the effect below — never a setState synced from one.
  const objectUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.files?.[0] ?? null);
  };

  return (
    <div className={['wsf-photoinput', className].filter(Boolean).join(' ')}>
      <p className="wsf-photoinput__label type-label">{label}</p>

      {effectiveState === 'idle' && (
        <div className="wsf-photoinput__actions">
          <input
            id={takeId}
            type="file"
            accept="image/*"
            capture="environment"
            className="wsf-sr wsf-photoinput__input"
            onChange={handleFile}
          />
          <label htmlFor={takeId} className="wsf-btn wsf-btn--secondary type-label wsf-photoinput__opt">
            <Icon name="camera" />
            {takeLabel ?? t(copy.vocabulary.takePhoto, lang)}
          </label>
          <input
            id={chooseId}
            type="file"
            accept="image/*"
            className="wsf-sr wsf-photoinput__input"
            onChange={handleFile}
          />
          <label htmlFor={chooseId} className="wsf-btn wsf-btn--quiet type-label wsf-photoinput__opt">
            <Icon name="plus" />
            {chooseLabel ?? t(copy.vocabulary.choosePhoto, lang)}
          </label>
        </div>
      )}

      {(effectiveState === 'preview' || effectiveState === 'analysing') && objectUrl && (
        <div className="wsf-photoinput__preview" aria-busy={effectiveState === 'analysing' || undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a locally chosen File, never a remote src */}
          <img src={objectUrl} alt={typeof label === 'string' ? label : ''} className="wsf-photoinput__img" />
          {effectiveState === 'analysing' ? (
            <div className="wsf-photoinput__overlay">
              <span className="wsf-spinner" aria-hidden="true" />
              <span className="type-label">{analysingLabel ?? t(copy.vocabulary.analysing, lang)}</span>
            </div>
          ) : (
            <Button variant="quiet" icon="trash" lang={lang} onClick={() => onChange(null)}>
              {removeLabel ?? t(copy.vocabulary.remove, lang)}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
