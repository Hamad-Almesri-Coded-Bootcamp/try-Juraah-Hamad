'use client';

import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
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

// -------------------------------------------------------------------------------------------------
// A1 — client-side downscale. targetDimensions, nextQuality and undecodableOutcome below are pure
// and are imported and tested directly in PhotoInput.test.tsx (see the describe blocks of the same
// names); the component tests separately cover the resulting canvas cap and the quality step-down
// loop end to end.
// -------------------------------------------------------------------------------------------------

/** The re-encoded photo's long edge never exceeds this. */
export const PHOTO_MAX_EDGE_PX = 2000;
/** The re-encoded photo targets under this many bytes. */
export const PHOTO_TARGET_BYTES = 2 * 1024 * 1024;
/** A file the browser cannot decode at all is sent as-is only up to this size; over it, refused. */
export const PHOTO_PASSTHROUGH_MAX_BYTES = 3.5 * 1024 * 1024;
const PHOTO_INITIAL_QUALITY = 0.85;
const PHOTO_MIN_QUALITY = 0.4;
const PHOTO_QUALITY_STEP = 0.1;

/** The resized long edge, aspect ratio kept, integer pixels — never upscales. Pure. */
export function targetDimensions(width: number, height: number): { width: number; height: number } {
  const long = Math.max(width, height);
  if (!(long > PHOTO_MAX_EDGE_PX) || long <= 0) return { width, height };
  const scale = PHOTO_MAX_EDGE_PX / long;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** The next lower JPEG quality to try; null once there is no step left above PHOTO_MIN_QUALITY. Pure. */
export function nextQuality(current: number): number | null {
  const next = Math.round((current - PHOTO_QUALITY_STEP) * 100) / 100;
  return next >= PHOTO_MIN_QUALITY ? next : null;
}

/** The file could not be decoded at all (U7, e.g. HEIC on some Chromium builds): send it unresized
 * when it already fits, otherwise it must be refused and never sent. Pure. */
export function undecodableOutcome(originalBytes: number): 'passthrough' | 'refuse' {
  return originalBytes <= PHOTO_PASSTHROUGH_MAX_BYTES ? 'passthrough' : 'refuse';
}

function jpegName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, '').trim();
  return `${base || 'photo'}.jpg`;
}

interface Decoded {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  close: () => void;
}

async function decodeBitmap(file: File): Promise<Decoded | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const bmp = await createImageBitmap(file);
    return { width: bmp.width, height: bmp.height, draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h), close: () => bmp.close() };
  } catch {
    return null;
  }
}

/** Fallback decode (A1) for a file createImageBitmap could not read. Bounded: a photo whose <img>
 * fires neither load nor error must never hang the flow. */
function decodeImageElement(file: File): Promise<Decoded | null> {
  return new Promise((resolve) => {
    let settled = false;
    const url = URL.createObjectURL(file);
    const settle = (result: Decoded | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(result);
    };
    const timer = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      settle(null);
    }, 4000);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w <= 0 || h <= 0) {
        URL.revokeObjectURL(url);
        settle(null);
        return;
      }
      settle({ width: w, height: h, draw: (ctx, tw, th) => ctx.drawImage(img, 0, 0, tw, th), close: () => URL.revokeObjectURL(url) });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      settle(null);
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
}

/** A1 — downscale and re-encode `file` as a JPEG: long edge at most PHOTO_MAX_EDGE_PX, stepping the
 * quality down from 0.85 until under PHOTO_TARGET_BYTES. Decodes with createImageBitmap, falling
 * back to an <img> element (U7). null → the file must never be sent (undecodable and over
 * PHOTO_PASSTHROUGH_MAX_BYTES, or the canvas itself is unavailable and the file is too large).
 *
 * Wrapped in one outer try/catch on purpose: ANY failure anywhere in this pipeline (a decoder that
 * throws instead of rejecting, a canvas call unsupported on some browser, anything unforeseen) must
 * fall back to the same undecodable passthrough/refuse rule, never an unhandled rejection that
 * leaves the caller's "analysing" state stuck (A2) or, worse, an unresized file silently sent. */
async function downscalePhoto(file: File): Promise<File | null> {
  try {
    const decoded = (await decodeBitmap(file)) ?? (await decodeImageElement(file));
    if (!decoded) return undecodableOutcome(file.size) === 'passthrough' ? file : null;
    try {
      const { width, height } = targetDimensions(decoded.width, decoded.height);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undecodableOutcome(file.size) === 'passthrough' ? file : null;
      decoded.draw(ctx, width, height);
      let quality: number | null = PHOTO_INITIAL_QUALITY;
      let blob: Blob | null = null;
      while (quality !== null) {
        blob = await canvasToBlob(canvas, quality);
        if (blob && blob.size < PHOTO_TARGET_BYTES) break;
        quality = nextQuality(quality);
      }
      if (!blob) return undecodableOutcome(file.size) === 'passthrough' ? file : null;
      return new File([blob], jpegName(file.name), { type: 'image/jpeg' });
    } finally {
      decoded.close();
    }
  } catch {
    return undecodableOutcome(file.size) === 'passthrough' ? file : null;
  }
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

  // A1 — the file the browser could not decode AND could not send unresized either: shown here,
  // inline, and the file is never handed to `onChange`. Cleared the moment a new file is picked.
  const [error, setError] = useState<string | null>(null);
  // A picked file starts an async decode/re-encode before `onChange` ever fires; a later pick during
  // that window must win, never the one still resizing in the background.
  const pickSeq = useRef(0);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = ''; // clears the input so the same file can be re-picked after a refusal
    const seq = ++pickSeq.current;
    setError(null);
    if (!file) {
      onChange(null);
      return;
    }
    const sent = await downscalePhoto(file);
    if (seq !== pickSeq.current) return; // superseded by a later pick
    if (!sent) {
      setError(t(copy.vocabulary.photoTooLargeToSend, lang));
      return;
    }
    onChange(sent);
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

      {effectiveState === 'idle' && error && (
        <p role="alert" className="wsf-field__note wsf-field__note--error type-caption">
          <Icon name="warning" small />
          {error}
        </p>
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
