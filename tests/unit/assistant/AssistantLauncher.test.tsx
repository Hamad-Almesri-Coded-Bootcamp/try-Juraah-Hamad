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
  voice: vi.fn(async (after: number | null): Promise<{ latest: number; turns: unknown[] }> => ({ latest: after ?? 7, turns: [] })),
  ask: vi.fn(async (text: string, locale: string): Promise<unknown> => { void text; void locale; return { ok: true, reply: 'جرعتك الجاية Calcium carbonate + vitamin D3 الساعة 1 الظهر.', telegramPrompted: false }; }),
}));
vi.mock('@/lib/assistant', () => ({ askAssistant: h.ask, assistantAudience: h.audience, voiceTurns: h.voice }));
const nav = vi.hoisted(() => ({ push: vi.fn(), pathname: '/ar' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }), usePathname: () => nav.pathname }));

import { AssistantLauncher } from '@/features/assistant/AssistantLauncher';
import { copy, t } from '@/i18n';
import { hasLatin, localizeText } from '@/i18n/localize';

beforeEach(() => { h.voice.mockClear(); h.voice.mockImplementation(async (after) => ({ latest: after ?? 7, turns: [] })); h.ask.mockClear(); h.audience.mockClear(); h.audience.mockResolvedValue('patient'); nav.push.mockClear(); nav.pathname = '/ar'; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

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

  // Premise changed (CR-071): the answer is shown in the reader's language: its words as received, a
  // known drug name in the page's script (Calcium carbonate → كربونات الكالسيوم), never a dash.
  it('a suggestion is sent as the patient’s words; the typing bubble shows while waiting; the answer is shown as received, in the reader’s language', async () => {
    let finish: (v: unknown) => void = () => {};
    h.ask.mockImplementationOnce(() => new Promise((r) => { finish = r; }));
    render(<AssistantLauncher locale="ar" />);
    await open();
    fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.suggestNext, 'ar') }));
    expect(h.ask).toHaveBeenCalledWith(t(copy.assistant.suggestNext, 'ar'), 'ar');
    await waitFor(() => expect(screen.getByTestId('assistant-thinking').textContent).toBe(t(copy.assistant.thinking, 'ar')));
    const received = 'جرعتك الجاية Calcium carbonate + vitamin D3 — الساعة 1 الظهر.';
    await act(async () => { finish({ ok: true, reply: received, telegramPrompted: false }); });
    const answer = () => screen.getByTestId('assistant-lines').querySelector('li[data-from="assistant"]');
    await waitFor(() => expect(answer()).toBeTruthy());
    const shown = answer()!.textContent!.replace(t(copy.assistant.assistantLabel, 'ar') + ': ', '');
    expect(shown).toBe(localizeText(received, 'ar'));
    expect(shown).toMatch(/^جرعتك الجاية /); // the words as received
    expect(hasLatin(shown)).toBe(false); // the seed's drug name reads in Arabic
    expect(shown).not.toMatch(/[—–]/);
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

  it('CR-069: a turn with Alexa opens the panel by itself, shows what was asked and what Alexa said, and opens its screen', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    h.voice.mockImplementationOnce(async () => ({ latest: 7, turns: [] })); // the starting point: nothing replayed
    h.voice.mockImplementationOnce(async () => ({ latest: 8, turns: [{ seq: 8, topic: 'today', language: 'ar', reply: 'عندك اليوم 3 جرعات…', page: 'today' }] }));
    nav.pathname = '/ar/app/safety';
    render(<AssistantLauncher locale="ar" />);
    await waitFor(() => expect(h.voice).toHaveBeenCalledWith(null));
    expect(screen.queryByTestId('assistant-panel')).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(2600); });
    await waitFor(() => expect(screen.getByText('عندك اليوم 3 جرعات…')).toBeTruthy());
    expect(h.voice).toHaveBeenCalledWith(7); // the next poll asks for turns AFTER the starting point
    expect(screen.getByTestId('assistant-panel')).toBeTruthy();
    expect(screen.getByText(t(copy.assistant.suggestToday, 'ar'))).toBeTruthy();
    expect(screen.getByText(t(copy.assistant.voiceSaid, 'ar'))).toBeTruthy();
    expect(nav.push).toHaveBeenCalledWith('/ar/app');
  });

  it('CR-069: Alexa did not understand -> the four voice topics, worded as Alexa hears them; tapping one asks the web chat', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    h.voice.mockImplementationOnce(async () => ({ latest: 3, turns: [] }));
    h.voice.mockImplementationOnce(async () => ({ latest: 4, turns: [{ seq: 4, topic: 'unclear', language: 'en', reply: 'You can ask me…', page: null }] }));
    render(<AssistantLauncher locale="en" />);
    await waitFor(() => expect(h.voice).toHaveBeenCalledWith(null));
    await act(async () => { await vi.advanceTimersByTimeAsync(2600); });
    await waitFor(() => expect(screen.getByText(t(copy.assistant.clarifyVoiceAsk, 'en'))).toBeTruthy());
    const chips = [...screen.getByTestId('assistant-clarify-voice').querySelectorAll('button')].map((b) => b.textContent);
    expect(chips).toEqual(['What is my next dose?', 'How much do I take?', 'What are my medicines today?', 'I forgot my medicine']);
    expect(nav.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'I forgot my medicine' }));
    expect(h.ask).toHaveBeenLastCalledWith('I forgot my medicine', 'en');
  });

  it('CR-071: an Alexa reply in the other language is declared, with its drug names and dashes normalised', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const reply = 'جرعتك الجاية Eltroxin الساعة 7 المغرب — تبي شي ثاني؟';
    h.voice.mockImplementationOnce(async () => ({ latest: 1, turns: [] }));
    h.voice.mockImplementationOnce(async () => ({ latest: 2, turns: [{ seq: 2, topic: 'next_dose', language: 'ar', reply, page: 'today' }] }));
    nav.pathname = '/en/app';
    render(<AssistantLauncher locale="en" />);
    await waitFor(() => expect(h.voice).toHaveBeenCalledWith(null));
    await act(async () => { await vi.advanceTimersByTimeAsync(2600); });
    const shown = localizeText(reply, 'ar');
    await waitFor(() => expect(screen.getByText(shown)).toBeTruthy());
    const li = screen.getByText(shown).closest('li')!;
    expect(li.getAttribute('lang')).toBe('ar');
    expect(li.getAttribute('dir')).toBe('rtl');
    expect(hasLatin(shown)).toBe(false); // Eltroxin reads in Arabic script
    expect(li.textContent).not.toMatch(/[—–]/);
    // The page's own words on that line keep the page's language.
    expect(screen.getByText(t(copy.assistant.voiceAnswered, 'en')).getAttribute('lang')).toBe('en');
  });

  it('CR-071: on a page marked data-no-assistant (first-run setup, the invitation) a voice turn neither opens the panel nor moves', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const marker = document.createElement('div');
    marker.setAttribute('data-no-assistant', '');
    document.body.appendChild(marker);
    try {
      h.voice.mockImplementationOnce(async () => ({ latest: 4, turns: [] }));
      h.voice.mockImplementationOnce(async () => ({ latest: 5, turns: [{ seq: 5, topic: 'today', language: 'ar', reply: 'عندك اليوم 3 جرعات…', page: 'today' }] }));
      nav.pathname = '/ar/app';
      render(<AssistantLauncher locale="ar" />);
      await waitFor(() => expect(h.voice).toHaveBeenCalledWith(null));
      await act(async () => { await vi.advanceTimersByTimeAsync(2600); });
      await waitFor(() => expect(h.voice).toHaveBeenCalledWith(4));
      await act(async () => { await vi.advanceTimersByTimeAsync(2600); });
      expect(h.voice).toHaveBeenCalledWith(5); // counted, so never replayed later
      expect(screen.queryByTestId('assistant-panel')).toBeNull();
      expect(screen.queryByText('عندك اليوم 3 جرعات…')).toBeNull();
      expect(nav.push).not.toHaveBeenCalled();
    } finally {
      marker.remove();
    }
  });

  it('CR-071: when the person changes (sign-out, then a guest), the conversation is cleared and asked again', async () => {
    nav.pathname = '/ar/app';
    const { rerender } = render(<AssistantLauncher locale="ar" />);
    await open();
    fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.suggestNext, 'ar') }));
    const reply = localizeText('جرعتك الجاية Calcium carbonate + vitamin D3 الساعة 1 الظهر.', 'ar');
    await waitFor(() => expect(screen.getByText(reply)).toBeTruthy());
    expect(h.audience).toHaveBeenCalledTimes(1);
    // Moving inside one shell does not ask again, and the conversation stays.
    nav.pathname = '/ar/app/medicines';
    rerender(<AssistantLauncher locale="ar" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(h.audience).toHaveBeenCalledTimes(1);
    expect(screen.getByText(reply)).toBeTruthy();
    // Signed out: the landing, where the server now answers "guest".
    h.audience.mockResolvedValue('guest');
    nav.pathname = '/ar';
    rerender(<AssistantLauncher locale="ar" />);
    await waitFor(() => expect(h.audience).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId('assistant-panel')).toBeNull());
    await open();
    expect(screen.queryByText(reply)).toBeNull();
    expect(screen.getByText(t(copy.assistant.guestIntro, 'ar'))).toBeTruthy();
  });

  it('CR-069: a guest (not a signed-in patient) never polls for voice turns', async () => {
    h.audience.mockResolvedValue('guest');
    render(<AssistantLauncher locale="ar" />);
    await waitFor(() => expect(h.audience).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(h.voice).not.toHaveBeenCalled();
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
