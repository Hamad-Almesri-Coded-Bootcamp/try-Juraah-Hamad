'use client';

/**
 * CR-067 — the patient's web-app assistant: a launcher button over the patient shell and a `Sheet`
 * (bottom sheet below 834px, centred modal above) holding the conversation.
 *
 * READ-ONLY by construction (CLAUDE.md rule 1): this component can only call `askAssistant`, a
 * server action that writes nothing; the answers come from the agents track and are shown as data.
 * "I took it" / "I forgot" are answered by sending that dose's buttons to the patient's own Telegram
 * chat — the tap there records it. No design-system component draws a chat, so the conversation is
 * plain text rows in the design system's own surfaces; the launcher uses the existing `inbox` glyph
 * (no chat glyph exists in the 26). Every string is from i18n/copy/assistant.ts (guard 7).
 */
import { useCallback, useRef, useState, useTransition, type FormEvent } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { askAssistant } from '@/lib/assistant';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

type Line = { from: 'you' | 'assistant'; text: string; note?: string };

const SUGGESTIONS = ['suggestNext', 'suggestAmount', 'suggestToday', 'suggestSafety'] as const;

export function AssistantLauncher({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLLIElement>(null);
  const c = copy.assistant;
  // STABLE on purpose: Sheet re-runs its focus trap whenever onClose changes identity, and it moves
  // focus to its first control (the close button). A new arrow per render sent every keystroke there.
  const close = useCallback(() => setOpen(false), []);

  function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setDraft('');
    setLines((prev) => [...prev, { from: 'you', text: message }]);
    startTransition(() => {
      void (async () => {
        const r = await askAssistant(message, locale);
        const line: Line = r.ok
          ? { from: 'assistant', text: r.reply, ...(r.telegramPrompted ? { note: t(c.telegramPrompted, locale) } : {}) }
          : { from: 'assistant', text: t(r.reason === 'invalid' ? c.invalid : r.reason === 'not_a_patient' ? c.notPatient : c.unavailable, locale) };
        setLines((prev) => [...prev, line]);
        requestAnimationFrame(() => endRef.current?.scrollIntoView?.({ block: 'end' }));
      })();
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(draft);
  }

  return (
    <>
      <div className="fixed bottom-24 end-4 z-10 tablet:bottom-6" data-testid="assistant-launcher">
        <Button variant="primary" icon="inbox" onClick={() => setOpen(true)} lang={locale} aria-haspopup="dialog">
          {t(c.launcherLabel, locale)}
        </Button>
      </div>
      <Sheet
        open={open}
        onClose={close}
        closeLabel={t(c.closeLabel, locale)}
        title={t(c.title, locale)}
        footer={
          <form onSubmit={onSubmit} className="flex w-full items-end gap-2" data-testid="assistant-form">
            <TextField
              className="flex-1"
              label={t(c.inputLabel, locale)}
              placeholder={t(c.inputPlaceholder, locale)}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              lang={locale}
              dir={locale === 'ar' ? 'rtl' : 'ltr'}
              autoComplete="off"
            />
            <Button type="submit" variant="primary" loading={pending} disabled={pending || draft.trim().length === 0} lang={locale}>
              {t(c.send, locale)}
            </Button>
          </form>
        }
      >
        <div className="flex flex-col gap-3" data-testid="assistant-panel">
          <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto" aria-live="polite" data-testid="assistant-lines">
            <li className="rounded-lg bg-surface-card p-3 type-body">{t(c.intro, locale)}</li>
            {lines.map((line, i) => (
              <li
                key={i}
                className={['rounded-lg p-3 type-body whitespace-pre-line', line.from === 'you' ? 'bg-navy-tint text-navy self-end' : 'bg-surface-card'].join(' ')}
                data-from={line.from}
              >
                <span className="sr-only">{t(line.from === 'you' ? c.youLabel : c.assistantLabel, locale)}: </span>
                {line.text}
                {line.note && <span className="mt-1 block type-caption text-ink-muted">{line.note}</span>}
              </li>
            ))}
            <li ref={endRef} aria-hidden="true" />
          </ul>
          {lines.length === 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label={t(c.suggestionsLabel, locale)}>
              {SUGGESTIONS.map((key) => (
                <Button key={key} variant="secondary" onClick={() => send(t(c[key], locale))} disabled={pending} lang={locale}>
                  {t(c[key], locale)}
                </Button>
              ))}
            </div>
          )}
          <p className="type-caption text-ink-muted">{t(c.safetyLine, locale)}</p>
        </div>
      </Sheet>
    </>
  );
}
