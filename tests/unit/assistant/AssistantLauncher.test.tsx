/**
 * CR-067 — the assistant's launcher and panel (features/assistant/AssistantLauncher.tsx), mounted on
 * every page. Both server actions are spies: this proves the component — it opens on its own full-
 * viewport layer, asks who is talking, shows the patient's or the guest's suggestions, shows a typing
 * bubble while waiting, shows answers as received (guest answers from the copy catalogue), keeps the
 * focus in the field while typing, and has no control that could record a dose (rule 1).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  audience: vi.fn(async (): Promise<'patient' | 'guest'> => 'patient'),
  ask: vi.fn(async (text: string, locale: string): Promise<unknown> => { void text; void locale; return { ok: true, reply: 'جرعتك الجاية Calcium carbonate + vitamin D3 الساعة 1 الظهر.', telegramPrompted: false }; }),
}));
vi.mock('@/lib/assistant', () => ({ askAssistant: h.ask, assistantAudience: h.audience }));
const nav = vi.hoisted(() => ({ push: vi.fn(), pathname: '/ar' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }), usePathname: () => nav.pathname }));

import { AssistantLauncher } from '@/features/assistant/AssistantLauncher';
import { copy, t } from '@/i18n';

beforeEach(() => { h.ask.mockClear(); h.audience.mockClear(); h.audience.mockResolvedValue('patient'); nav.push.mockClear(); nav.pathname = '/ar'; });
afterEach(() => cleanup());

const open = async (locale: 'ar' | 'en' = 'ar') => {
  fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.launcherLabel, locale) }));
  await waitFor(() => expect(screen.getByTestId('assistant-panel').getAttribute('data-audience')).not.toBe('unknown'));
};
const PATIENT_KEYS = ['suggestNext', 'suggestAmount', 'suggestToday', 'suggestSafety'] as const;
const GUEST_KEYS = ['guestSuggestWhat', 'guestSuggestSignIn', 'guestSuggestTelegram'] as const;

describe('AssistantLauncher', () => {
  it('a patient: opens on its own fixed layer with the patient intro, four suggestions and the safety line', async () => {
    render(<AssistantLauncher locale="ar" />);
    expect(screen.queryByTestId('sheet-layer')).toBeNull();
    await open();
    expect(screen.getByTestId('sheet-layer').className).toMatch(/fixed inset-0/);
    expect(screen.getByText(t(copy.assistant.intro, 'ar'))).toBeTruthy();
    for (const key of PATIENT_KEYS) expect(screen.getByRole('button', { name: t(copy.assistant[key], 'ar') })).toBeTruthy();
    expect(screen.getByText(t(copy.assistant.safetyLine, 'ar'))).toBeTruthy();
  });

  it('a guest (landing, sign-in, caregiver, clinic): the guest intro and app-help suggestions, no personal ones', async () => {
    h.audience.mockResolvedValue('guest');
    render(<AssistantLauncher locale="en" />);
    await open('en');
    expect(screen.getByText(t(copy.assistant.guestIntro, 'en'))).toBeTruthy();
    for (const key of GUEST_KEYS) expect(screen.getByRole('button', { name: t(copy.assistant[key], 'en') })).toBeTruthy();
    for (const key of PATIENT_KEYS) expect(screen.queryByRole('button', { name: t(copy.assistant[key], 'en') })).toBeNull();
  });

  it('a guest answer is the copy catalogue’s text, in the reader’s language', async () => {
    h.audience.mockResolvedValue('guest');
    h.ask.mockResolvedValueOnce({ ok: true, guestTopic: 'guestTelegram' });
    render(<AssistantLauncher locale="ar" />);
    await open();
    fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.guestSuggestTelegram, 'ar') }));
    await waitFor(() => expect(screen.getByText(t(copy.assistant.guestTelegram, 'ar'))).toBeTruthy());
  });

  it('a suggestion is sent as the patient’s words; the typing bubble shows while waiting; the answer is shown as received', async () => {
    let finish: (v: unknown) => void = () => {};
    h.ask.mockImplementationOnce(() => new Promise((r) => { finish = r; }));
    render(<AssistantLauncher locale="ar" />);
    await open();
    fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.suggestNext, 'ar') }));
    expect(h.ask).toHaveBeenCalledWith(t(copy.assistant.suggestNext, 'ar'), 'ar');
    await waitFor(() => expect(screen.getByTestId('assistant-thinking').textContent).toBe(t(copy.assistant.thinking, 'ar')));
    await act(async () => { finish({ ok: true, reply: 'جرعتك الجاية Calcium carbonate', telegramPrompted: false }); });
    await waitFor(() => expect(screen.getByText(/جرعتك الجاية Calcium carbonate/)).toBeTruthy());
    expect(screen.queryByTestId('assistant-thinking')).toBeNull();
  });

  it('typed text is sent on submit; an empty draft cannot be sent', async () => {
    render(<AssistantLauncher locale="en" />);
    await open('en');
    const send = screen.getByRole('button', { name: t(copy.assistant.send, 'en') }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(t(copy.assistant.inputLabel, 'en')), { target: { value: 'How much do I take?' } });
    fireEvent.submit(screen.getByTestId('assistant-form'));
    expect(h.ask).toHaveBeenCalledWith('How much do I take?', 'en');
  });

  it('a refusal shows the app’s own copy, never an invented answer; a Telegram prompt is noted', async () => {
    h.ask.mockResolvedValueOnce({ ok: false, reason: 'unavailable' });
    render(<AssistantLauncher locale="ar" />);
    await open();
    fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.suggestToday, 'ar') }));
    await waitFor(() => expect(screen.getByText(t(copy.assistant.unavailable, 'ar'))).toBeTruthy());
    h.ask.mockResolvedValueOnce({ ok: true, reply: 'أرسلت لك أزرار الجرعة في تيليقرام', telegramPrompted: true });
    fireEvent.change(screen.getByLabelText(t(copy.assistant.inputLabel, 'ar')), { target: { value: 'أخذته' } });
    fireEvent.submit(screen.getByTestId('assistant-form'));
    await waitFor(() => expect(screen.getByText(t(copy.assistant.telegramPrompted, 'ar'))).toBeTruthy());
  });

  it('typing keeps the focus in the message field, character after character (never jumps to close)', async () => {
    render(<AssistantLauncher locale="ar" />);
    await open();
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

  it('an answer about a screen opens it behind the panel, then asks "is this what you were looking for?"', async () => {
    h.ask.mockResolvedValueOnce({ ok: true, reply: 'تنبيهات ملفك…', telegramPrompted: false, intent: 'safety', page: 'safety' });
    render(<AssistantLauncher locale="ar" />);
    await open();
    fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.suggestSafety, 'ar') }));
    await waitFor(() => expect(screen.getByText(t(copy.assistant.movedSafety, 'ar'))).toBeTruthy());
    expect(nav.push).toHaveBeenCalledWith('/ar/app/safety');
    expect(screen.getByTestId('sheet-layer')).toBeTruthy(); // the conversation stays open
    fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.confirmYes, 'ar') }));
    expect(screen.getByText(t(copy.assistant.confirmThanks, 'ar'))).toBeTruthy();
    expect(screen.queryByTestId('assistant-confirm')).toBeNull();
    expect(h.ask).toHaveBeenCalledTimes(1); // Yes is answered in the panel, nothing is sent
  });

  it('"No, not this" asks back with the topics; a topic is sent as a question', async () => {
    h.ask.mockResolvedValueOnce({ ok: true, reply: 'جرعتك الجاية…', telegramPrompted: false, intent: 'next_dose', page: 'today' });
    render(<AssistantLauncher locale="en" />);
    await open('en');
    fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.suggestNext, 'en') }));
    await waitFor(() => expect(screen.getByText(t(copy.assistant.movedToday, 'en'))).toBeTruthy());
    expect(nav.push).toHaveBeenCalledWith('/en/app');
    fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.confirmNo, 'en') }));
    expect(screen.getByText(t(copy.assistant.confirmOther, 'en'))).toBeTruthy();
    const group = screen.getByTestId('assistant-clarify');
    expect(group.querySelectorAll('button')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.suggestRefill, 'en') }));
    expect(h.ask).toHaveBeenLastCalledWith(t(copy.assistant.suggestRefill, 'en'), 'en');
  });

  it('not sure ("unclear"): asks back with choices instead of guessing, and moves nowhere', async () => {
    h.ask.mockResolvedValueOnce({ ok: true, reply: 'ما فهمت عليك', telegramPrompted: false, intent: 'unclear', page: null });
    render(<AssistantLauncher locale="ar" />);
    await open();
    fireEvent.change(screen.getByLabelText(t(copy.assistant.inputLabel, 'ar')), { target: { value: 'أبي أعرف عن الموضوع' } });
    fireEvent.submit(screen.getByTestId('assistant-form'));
    await waitFor(() => expect(screen.getByText(t(copy.assistant.clarifyAsk, 'ar'))).toBeTruthy());
    expect(screen.getByTestId('assistant-clarify')).toBeTruthy();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('already on that screen: no move and no "is this it?"', async () => {
    nav.pathname = '/ar/app/more/activity';
    h.ask.mockResolvedValueOnce({ ok: true, reply: 'نسيت جرعة…', telegramPrompted: true, intent: 'forgot', page: 'activity' });
    render(<AssistantLauncher locale="ar" />);
    await open();
    fireEvent.change(screen.getByLabelText(t(copy.assistant.inputLabel, 'ar')), { target: { value: 'نسيت' } });
    fireEvent.submit(screen.getByTestId('assistant-form'));
    await waitFor(() => expect(screen.getByText('نسيت جرعة…')).toBeTruthy());
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.queryByTestId('assistant-confirm')).toBeNull();
  });

  it('a signed-out guest asking how to sign in is taken to Sign in', async () => {
    h.audience.mockResolvedValue('guest');
    h.ask.mockResolvedValueOnce({ ok: true, guestTopic: 'guestSignIn', page: 'signin' });
    render(<AssistantLauncher locale="ar" />);
    await open();
    fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.guestSuggestSignIn, 'ar') }));
    await waitFor(() => expect(screen.getByText(t(copy.assistant.movedSignin, 'ar'))).toBeTruthy());
    expect(nav.push).toHaveBeenCalledWith('/ar/signin');
  });

  it('rule 1: the panel has no control that records a dose — only the suggestions, send and close', async () => {
    render(<AssistantLauncher locale="ar" />);
    await open();
    const panel = screen.getByRole('dialog');
    const names = [...panel.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') || b.textContent || '');
    const allowed = [t(copy.assistant.send, 'ar'), t(copy.assistant.closeLabel, 'ar'), ...PATIENT_KEYS.map((k) => t(copy.assistant[k], 'ar'))];
    for (const n of names) expect(allowed.some((a) => n.includes(a))).toBe(true);
    expect(panel.querySelectorAll('[role="switch"], input[type="checkbox"], input[type="radio"]')).toHaveLength(0);
  });
});
