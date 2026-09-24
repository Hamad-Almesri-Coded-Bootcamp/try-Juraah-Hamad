'use client';

/**
 * The two photo steps B4 (add a prescription) and C3 (check a medicine) share, Daylight (CR-071):
 * the capture card (what the photo is for, then the design system's `PhotoInput` with its two real
 * file-input buttons) and the reading card (what is happening and roughly how long, UX §5). One
 * white card each, so the two screens read the same way. No fetch: the screen that owns the
 * request decides what "reading" means.
 */
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PhotoInput } from '@/components/ui/PhotoInput';
import type { Locale } from '@/i18n/locale';

export function CaptureCard({
  icon = 'camera',
  title,
  body,
  photoLabel,
  takeLabel,
  photo,
  onPhoto,
  locale,
}: {
  icon?: IconName;
  title: ReactNode;
  body: ReactNode;
  photoLabel: string;
  /** The camera button's words, when the photo is not of a prescription (C3: the medicine packet). */
  takeLabel?: string;
  photo: File | null;
  onPhoto: (file: File | null) => void;
  locale: Locale;
}) {
  return (
    <section className="jr-group flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <Icon name={icon} className="jr-fact__icon flex-none" />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="type-h2 m-0 text-navy">{title}</h2>
          <p className="type-body m-0 text-ink-muted">{body}</p>
        </div>
      </div>
      <PhotoInput value={photo} onChange={onPhoto} label={photoLabel} takeLabel={takeLabel} lang={locale} />
    </section>
  );
}

export function ReadingCard({ title, body }: { title: ReactNode; body: ReactNode }) {
  return (
    <section role="status" aria-busy="true" aria-live="polite" className="jr-group flex flex-col items-center gap-3 px-5 py-6 text-center">
      <span className="jr-fact__icon inline-flex items-center justify-center">
        <span className="wsf-spinner" aria-hidden="true" />
      </span>
      <p className="type-body-strong m-0 text-navy">{title}</p>
      <p className="type-body-small m-0 text-ink-muted">{body}</p>
    </section>
  );
}
