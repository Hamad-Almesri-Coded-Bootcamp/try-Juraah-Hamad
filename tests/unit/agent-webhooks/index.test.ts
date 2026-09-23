// @vitest-environment node
/**
 * CR-066 — lib/agent-webhooks/index.ts, the I/O half, with fetch stubbed. Proves: unset → null (the
 * caller keeps the stub) and no network call; set → one POST to exactly that URL with the header
 * secret and the workflow's body; any failure → the conservative outcome, never the stub's answer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const URLS = {
  JURAH_AGENT_TRAVEL_CHECK_URL: 'https://n8n.example/webhook/jurah/travel-check',
  JURAH_AGENT_EXTRACTION_URL: 'https://n8n.example/webhook/jurah/extract-prescription',
  JURAH_AGENT_SCREENING_URL: 'https://n8n.example/webhook/jurah/screen-prescription',
};
const JPEG = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], { type: '' });

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import('@/lib/agent-webhooks');
}

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const reply = (status: number, body: unknown) => ({ status, json: async () => body });

describe('not configured', () => {
  it('every call answers null / false and nothing is fetched', async () => {
    const m = await load({ JURAH_AGENT_INBOUND_SECRET: 'secret-value', JURAH_AGENT_TRAVEL_CHECK_URL: '', JURAH_AGENT_EXTRACTION_URL: '', JURAH_AGENT_SCREENING_URL: '' });
    expect(await m.askTravelCheck('pt-01', JPEG(), 'ar')).toBeNull();
    expect(await m.askExtraction('pt-01', JPEG(), 'ar')).toBeNull();
    expect(await m.requestScreening('pt-01', 'rx-1', 'ar')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('a URL without the secret, or a /webhook-test/ URL, is not configured', async () => {
    let m = await load({ ...URLS, JURAH_AGENT_INBOUND_SECRET: '' });
    expect(await m.askTravelCheck('pt-01', JPEG(), 'ar')).toBeNull();
    m = await load({ JURAH_AGENT_INBOUND_SECRET: 's', JURAH_AGENT_TRAVEL_CHECK_URL: 'https://n8n.example/webhook-test/jurah/travel-check' });
    expect(await m.askTravelCheck('pt-01', JPEG(), 'ar')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('configured', () => {
  it('travel check: one POST with the header secret and the workflow body; the appOutcome comes back', async () => {
    const m = await load({ ...URLS, JURAH_AGENT_INBOUND_SECRET: 'secret-value' });
    fetchMock.mockResolvedValueOnce(reply(200, { ok: true, appOutcome: { kind: 'identified', drugName: 'Clarithromycin', verdict: 'no_interaction' } }));
    const r = await m.askTravelCheck('pt-03', JPEG(), 'en');
    expect(r).toEqual({ kind: 'identified', drugName: 'Clarithromycin', verdict: 'no_interaction' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(URLS.JURAH_AGENT_TRAVEL_CHECK_URL);
    expect(init.method).toBe('POST');
    expect(init.headers['x-jurah-secret']).toBe('secret-value');
    const body = JSON.parse(init.body);
    expect(body).toEqual({ patientId: 'pt-03', imageBase64: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]).toString('base64'), mimeType: 'image/jpeg', language: 'en' });
  });

  it('travel check: a network error, a timeout or a non-image is could_not_identify — never the stub', async () => {
    const m = await load({ ...URLS, JURAH_AGENT_INBOUND_SECRET: 'secret-value' });
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
    expect(await m.askTravelCheck('pt-03', JPEG(), 'ar')).toEqual({ kind: 'could_not_identify' });
    fetchMock.mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'));
    expect(await m.askTravelCheck('pt-03', JPEG(), 'ar')).toEqual({ kind: 'could_not_identify' });
    expect(await m.askTravelCheck('pt-03', new Blob(['hello'], { type: 'text/plain' }), 'ar')).toEqual({ kind: 'could_not_identify' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('extraction: save:false, the validated draft, and the image to store with it', async () => {
    const m = await load({ ...URLS, JURAH_AGENT_INBOUND_SECRET: 'secret-value' });
    fetchMock.mockResolvedValueOnce(reply(200, { ok: true, appOutcome: { kind: 'unreadable' } }));
    const r = await m.askExtraction('pt-03', JPEG(), 'ar');
    expect(r?.draft).toEqual({ kind: 'unreadable' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(URLS.JURAH_AGENT_EXTRACTION_URL);
    expect(JSON.parse(init.body).save).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error('down'));
    expect((await m.askExtraction('pt-03', JPEG(), 'ar'))?.draft).toEqual({ kind: 'unreadable' });
  });

  it('screening: true only when n8n accepted the job; a failure never throws', async () => {
    const m = await load({ ...URLS, JURAH_AGENT_INBOUND_SECRET: 'secret-value' });
    fetchMock.mockResolvedValueOnce(reply(200, { message: 'Workflow was started' }));
    expect(await m.requestScreening('pt-03', 'rx-9', 'ar')).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ patientId: 'pt-03', newPrescriptionId: 'rx-9', language: 'ar' });
    fetchMock.mockResolvedValueOnce(reply(403, null));
    expect(await m.requestScreening('pt-03', 'rx-9', 'ar')).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error('down'));
    expect(await m.requestScreening('pt-03', 'rx-9', 'ar')).toBe(false);
  });
});
