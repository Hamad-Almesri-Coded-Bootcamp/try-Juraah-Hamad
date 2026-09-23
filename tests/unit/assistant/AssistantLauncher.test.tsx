/**
 * CR-067 — the assistant's launcher and panel (features/assistant/AssistantLauncher.tsx). The server
 * action is a spy: this proves the component — it opens, sends a suggestion or typed text, shows the
 * answer as received, shows the app's own copy for a refusal, and has no control that could record
 * a dose (rule 1).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ ask: vi.fn(async (text: string, locale: string): Promise<unknown> => { void text; void locale; return { ok: true, reply: 'جرعتك الجاية Calcium carbonate + vitamin D3 الساعة 1 الظهر.', telegramPrompted: false }; }) }));
vi.mock('@/lib/assistant', () => ({ askAssistant: h.ask }));

import { AssistantLauncher } from '@/features/assistant/AssistantLauncher';
import { copy, t } from '@/i18n';

beforeEach(() => h.ask.mockClear());
afterEach(() => cleanup());

const open = () => fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.launcherLabel, 'ar') }));

describe('AssistantLauncher', () => {
  it('opens a panel with the intro, four suggestions and the safety line', () => {
    render(<AssistantLauncher locale="ar" />);
    open();
    expect(screen.getByText(t(copy.assistant.intro, 'ar'))).toBeTruthy();
    for (const key of ['suggestNext', 'suggestAmount', 'suggestToday', 'suggestSafety'] as const) {
      expect(screen.getByRole('button', { name: t(copy.assistant[key], 'ar') })).toBeTruthy();
    }
    expect(screen.getByText(t(copy.assistant.safetyLine, 'ar'))).toBeTruthy();
  });

  it('a suggestion is sent as the patient’s words and the answer is shown as received', async () => {
    render(<AssistantLauncher locale="ar" />);
    open();
    fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.suggestNext, 'ar') }));
    expect(h.ask).toHaveBeenCalledWith(t(copy.assistant.suggestNext, 'ar'), 'ar');
    await waitFor(() => expect(screen.getByText(/جرعتك الجاية Calcium carbonate/)).toBeTruthy());
  });

  it('typed text is sent on submit; an empty draft cannot be sent', async () => {
    render(<AssistantLauncher locale="en" />);
    fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.launcherLabel, 'en') }));
    const send = screen.getByRole('button', { name: t(copy.assistant.send, 'en') }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(t(copy.assistant.inputLabel, 'en')), { target: { value: 'How much do I take?' } });
    fireEvent.submit(screen.getByTestId('assistant-form'));
    expect(h.ask).toHaveBeenCalledWith('How much do I take?', 'en');
  });

  it('a refusal shows the app’s own copy, never an invented answer; a Telegram prompt is noted', async () => {
    h.ask.mockResolvedValueOnce({ ok: false, reason: 'unavailable' });
    render(<AssistantLauncher locale="ar" />);
    open();
    fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.suggestToday, 'ar') }));
    await waitFor(() => expect(screen.getByText(t(copy.assistant.unavailable, 'ar'))).toBeTruthy());
    h.ask.mockResolvedValueOnce({ ok: true, reply: 'أرسلت لك أزرار الجرعة في تيليقرام', telegramPrompted: true });
    fireEvent.change(screen.getByLabelText(t(copy.assistant.inputLabel, 'ar')), { target: { value: 'أخذته' } });
    fireEvent.submit(screen.getByTestId('assistant-form'));
    await waitFor(() => expect(screen.getByText(t(copy.assistant.telegramPrompted, 'ar'))).toBeTruthy());
  });

  it('typing keeps the focus in the message field, character after character (never jumps to close)', () => {
    render(<AssistantLauncher locale="ar" />);
    open();
    const input = screen.getByLabelText(t(copy.assistant.inputLabel, 'ar')) as HTMLInputElement;
    input.focus();
    let typed = '';
    for (const ch of 'شنو جرعتي') {
      typed += ch;
      fireEvent.change(input, { target: { value: typed } });
      expect(document.activeElement).toBe(input);
    }
    expect(input.value).toBe('شنو جرعتي');
  });

  it('rule 1: the panel has no control that records a dose — only the suggestions, send and close', () => {
    render(<AssistantLauncher locale="ar" />);
    open();
    const panel = screen.getByRole('dialog');
    const names = [...panel.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') || b.textContent || '');
    const allowed = [t(copy.assistant.send, 'ar'), t(copy.assistant.closeLabel, 'ar'),
      ...(['suggestNext', 'suggestAmount', 'suggestToday', 'suggestSafety'] as const).map((k) => t(copy.assistant[k], 'ar'))];
    for (const n of names) expect(allowed.some((a) => n.includes(a))).toBe(true);
    expect(panel.querySelectorAll('[role="switch"], input[type="checkbox"], input[type="radio"]')).toHaveLength(0);
  });
});
