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
  voice: vi.fn(async (after: number | null): Promise<{ latest: number | null; turns: unknown[]; live: boolean }> => ({ latest: after ?? 7, turns: [], live: true })),
  ask: vi.fn(async (text: string, locale: string): Promise<unknown> => { void text; void locale; return { ok: true, reply: 'جرعتك الجاية Calcium carbonate + vitamin D3 الساعة 1 الظهر.', telegramPrompted: false }; }),
}));
vi.mock('@/lib/assistant', () => ({ askAssistant: h.ask, assistantAudience: h.audience, voiceTurns: h.voice }));
// One router for every render, as Next's useRouter() gives: a new object per render would restart the
// voice poll's effect (it depends on the router) on every re-render, which the real app never does.
const nav = vi.hoisted(() => { const push = vi.fn(); return { push, pathname: '/ar/app', router: { push } }; });
vi.mock('next/navigation', () => ({ useRouter: () => nav.router, usePathname: () => nav.pathname }));

import { AssistantLauncher } from '@/features/assistant/AssistantLauncher';
import { copy, t } from '@/i18n';
import { hasLatin, localizeText } from '@/i18n/localize';

beforeEach(() => { h.voice.mockReset(); h.voice.mockImplementation(async (after) => ({ latest: after ?? 7, turns: [], live: true })); h.ask.mockClear(); h.audience.mockClear(); h.audience.mockResolvedValue('patient'); nav.push.mockClear(); nav.pathname = '/ar/app'; });
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
    nav.pathname = '/en/care';
    render(<AssistantLauncher locale="en" />);
    await open('en');
    expect(screen.getByText(t(copy.assistant.guestIntro, 'en'))).toBeTruthy();
    for (const key of GUEST_KEYS) expect(screen.getByRole('button', { name: t(copy.assistant[key], 'en') })).toBeTruthy();
    for (const key of PATIENT_KEYS) expect(screen.queryByRole('button', { name: t(copy.assistant[key], 'en') })).toBeNull();
  });

  it('a guest answer is the copy catalogue’s text, in the reader’s language', async () => {
    nav.pathname = '/ar';
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
    nav.pathname = '/ar';
    h.ask.mockResolvedValueOnce({ ok: true, guestTopic: 'guestSignIn', page: 'signin' });
    render(<AssistantLauncher locale="ar" />);
    await open();
    fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.guestSuggestSignIn, 'ar') }));
    await waitFor(() => expect(screen.getByText(t(copy.assistant.movedSignin, 'ar'))).toBeTruthy());
    expect(nav.push).toHaveBeenCalledWith('/ar/signin');
  });

  // CR-102 (amends CR-069): a turn with Alexa moves the page, and nothing else. The panel never opens,
  // closes or gains a line for it; the move uses the page's language, whatever the Echo's.
  const turnsThen = (turn: Record<string, unknown>, start = 7) => {
    h.voice.mockImplementationOnce(async () => ({ latest: start, turns: [], live: true })); // the starting point: nothing replayed
    h.voice.mockImplementationOnce(async () => ({ latest: start + 1, turns: [{ seq: start + 1, ...turn }], live: true }));
  };
  const nextPoll = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(2600); }); };

  it('CR-102: a turn with Alexa about today moves the page to «اليوم» and does NOT open the chat', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    turnsThen({ topic: 'today', language: 'ar', reply: 'عندك اليوم 3 جرعات…', page: 'today' });
    nav.pathname = '/ar/app/safety';
    render(<AssistantLauncher locale="ar" />);
    await waitFor(() => expect(h.voice).toHaveBeenCalledWith(null));
    await nextPoll();
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/ar/app'));
    expect(h.voice).toHaveBeenCalledWith(7); // the next poll asks for turns AFTER the starting point
    expect(nav.push).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('sheet-layer')).toBeNull();
    expect(screen.queryByTestId('assistant-panel')).toBeNull();
    expect(screen.queryByText('عندك اليوم 3 جرعات…')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('CR-102: a record request by voice moves the page to Activity, and «نسيت دواي» too; the chat stays closed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    turnsThen({ topic: 'record', language: 'en', reply: 'I can’t record by voice; I’ve sent the buttons to your Telegram.', page: 'activity' });
    nav.pathname = '/en/app';
    render(<AssistantLauncher locale="en" />);
    await waitFor(() => expect(h.voice).toHaveBeenCalledWith(null));
    await nextPoll();
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/en/app/more/activity'));
    expect(screen.queryByTestId('assistant-panel')).toBeNull();
    cleanup();
    nav.push.mockClear();
    h.voice.mockReset();
    h.voice.mockImplementation(async (after) => ({ latest: after ?? 7, turns: [], live: true }));
    turnsThen({ topic: 'forgot', language: 'ar', reply: 'فاتتك جرعة Eltroxin…', page: 'activity' }, 20);
    nav.pathname = '/ar/app';
    render(<AssistantLauncher locale="ar" />);
    await waitFor(() => expect(h.voice).toHaveBeenCalledWith(null));
    await nextPoll();
    expect(h.voice).toHaveBeenCalledWith(20);
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/ar/app/more/activity'));
    expect(screen.queryByTestId('assistant-panel')).toBeNull();
  });

  it('CR-102: an Arabic turn on the English page moves to the English page (the page keeps its language); the chat stays closed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    turnsThen({ topic: 'next_dose', language: 'ar', reply: 'جرعتك الجاية Eltroxin الساعة 7 المغرب — تبي شي ثاني؟', page: 'today' }, 1);
    nav.pathname = '/en/app/more/help';
    render(<AssistantLauncher locale="en" />);
    await waitFor(() => expect(h.voice).toHaveBeenCalledWith(null));
    await nextPoll();
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/en/app'));
    expect(screen.queryByTestId('assistant-panel')).toBeNull();
  });

  it('CR-102: Alexa did not understand, or the conversation ended: nothing moves and nothing opens', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    h.voice.mockImplementationOnce(async () => ({ latest: 3, turns: [], live: true }));
    h.voice.mockImplementationOnce(async () => ({ latest: 5, turns: [
      { seq: 4, topic: 'unclear', language: 'en', reply: 'You can ask me…', page: null },
      { seq: 5, topic: 'bye', language: 'en', reply: 'Goodbye, take care.', page: null },
    ], live: true }));
    render(<AssistantLauncher locale="en" />);
    await waitFor(() => expect(h.voice).toHaveBeenCalledWith(null));
    await nextPoll();
    await waitFor(() => expect(h.voice).toHaveBeenCalledWith(3));
    await nextPoll();
    expect(h.voice).toHaveBeenCalledWith(5); // counted, so never replayed later
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.queryByTestId('assistant-panel')).toBeNull();
    expect(screen.queryByText('You can ask me…')).toBeNull();
  });

  it('CR-102: a chat the patient opened stays exactly as it was: open, the same lines, no voice line and no chips; the page moves behind it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    nav.pathname = '/ar/app/safety';
    render(<AssistantLauncher locale="ar" />);
    await waitFor(() => expect(h.voice).toHaveBeenCalledWith(null)); // starting point: latest 7
    await open();
    fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.suggestNext, 'ar') }));
    await waitFor(() => expect(screen.getByText(localizeText('جرعتك الجاية Calcium carbonate + vitamin D3 الساعة 1 الظهر.', 'ar'))).toBeTruthy());
    const before = screen.getByTestId('assistant-lines').innerHTML;
    const groupsBefore = screen.queryAllByRole('group').length;
    h.voice.mockImplementationOnce(async () => ({ latest: 8, turns: [{ seq: 8, topic: 'today', language: 'ar', reply: 'عندك اليوم 3 جرعات…', page: 'today' }], live: true }));
    await nextPoll(); // the poll right after the tap is skipped (CR-071)
    await nextPoll();
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/ar/app'));
    expect(screen.getByTestId('assistant-panel')).toBeTruthy();
    expect(screen.getByTestId('assistant-lines').innerHTML).toBe(before);
    expect(screen.queryAllByRole('group').length).toBe(groupsBefore);
    expect(screen.queryByText('عندك اليوم 3 جرعات…')).toBeNull();
  });

  it('CR-071: on a page marked data-no-assistant (first-run setup, the invitation) a voice turn neither opens the panel nor moves', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const marker = document.createElement('div');
    marker.setAttribute('data-no-assistant', '');
    document.body.appendChild(marker);
    try {
      h.voice.mockImplementationOnce(async () => ({ latest: 4, turns: [], live: true }));
      h.voice.mockImplementationOnce(async () => ({ latest: 5, turns: [{ seq: 5, topic: 'today', language: 'ar', reply: 'عندك اليوم 3 جرعات…', page: 'today' }], live: true }));
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

  it('CR-071: when the person changes (sign-out, then a guest), the conversation is cleared', async () => {
    nav.pathname = '/ar/app';
    const { rerender } = render(<AssistantLauncher locale="ar" />);
    await open();
    fireEvent.click(screen.getByRole('button', { name: t(copy.assistant.suggestNext, 'ar') }));
    const reply = localizeText('جرعتك الجاية Calcium carbonate + vitamin D3 الساعة 1 الظهر.', 'ar');
    await waitFor(() => expect(screen.getByText(reply)).toBeTruthy());
    // Moving inside one shell keeps the conversation.
    nav.pathname = '/ar/app/medicines';
    rerender(<AssistantLauncher locale="ar" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText(reply)).toBeTruthy();
    // Signed out: the landing, a guest's page.
    nav.pathname = '/ar';
    rerender(<AssistantLauncher locale="ar" />);
    await waitFor(() => expect(screen.queryByTestId('assistant-panel')).toBeNull());
    await open();
    expect(screen.queryByText(reply)).toBeNull();
    expect(screen.getByText(t(copy.assistant.guestIntro, 'ar'))).toBeTruthy();
    expect(h.audience).not.toHaveBeenCalled(); // the audience is the shell on screen, never a server call
  });

  it('CR-069: a guest (not a signed-in patient) never polls for voice turns', async () => {
    nav.pathname = '/ar/signin';
    render(<AssistantLauncher locale="ar" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(h.voice).not.toHaveBeenCalled();
  });

  // CR-071: Next runs a page's Server Actions one at a time, so a background one holds up the page's
  // own (sign-in, F0's open). The launcher sends none on a guest page, and asks nobody who is talking.
  it('CR-071: a page load sends no Server Action of the assistant’s own on a guest page, and never asks the audience', async () => {
    for (const path of ['/ar', '/ar/signin', '/ar/invitation', '/ar/care', '/ar/clinic/review']) {
      nav.pathname = path;
      render(<AssistantLauncher locale="ar" />);
      await new Promise((r) => setTimeout(r, 30));
      cleanup();
    }
    expect(h.voice).not.toHaveBeenCalled();
    expect(h.audience).not.toHaveBeenCalled();
    expect(h.ask).not.toHaveBeenCalled();
  });

  it('CR-071: where no voice turn can ever arrive (the mock backend), the patient panel asks once and stops', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    h.voice.mockImplementation(async (after) => ({ latest: after, turns: [], live: false }));
    render(<AssistantLauncher locale="ar" />);
    await waitFor(() => expect(h.voice).toHaveBeenCalledWith(null));
    await act(async () => { await vi.advanceTimersByTimeAsync(2600 * 3); });
    expect(h.voice).toHaveBeenCalledTimes(1);
  });

  it('CR-071: right after the patient taps or types, the next poll is skipped, so their own action never waits behind it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<AssistantLauncher locale="ar" />);
    await waitFor(() => expect(h.voice).toHaveBeenCalledTimes(1)); // the starting point
    fireEvent.pointerDown(document.body);
    await act(async () => { await vi.advanceTimersByTimeAsync(2600); });
    expect(h.voice).toHaveBeenCalledTimes(1); // skipped once
    await act(async () => { await vi.advanceTimersByTimeAsync(2600); });
    await waitFor(() => expect(h.voice).toHaveBeenCalledTimes(2)); // and back to its pace
    fireEvent.keyDown(document.body, { key: 'a' });
    await act(async () => { await vi.advanceTimersByTimeAsync(2600); });
    expect(h.voice).toHaveBeenCalledTimes(2);
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
