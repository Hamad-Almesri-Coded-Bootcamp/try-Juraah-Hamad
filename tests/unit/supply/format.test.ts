/**
 * Pure formatting helpers behind D1 (features/supply/format.ts). No clock read anywhere — every
 * date/status comes in as an argument (G3/rule 9).
 */
import { describe, expect, it } from 'vitest';
import {
  alreadyRequestedBody,
  destinationLabel,
  pendingRequestFor,
  requestLineDescription,
  requestStatusLabel,
  sectorFromRoutedTo,
} from '@/features/supply/format';
import type { RefillRequest } from '@/types/views';

function request(overrides: Partial<RefillRequest> = {}): RefillRequest {
  return {
    id: 'rf-01',
    patientId: 'pt-01',
    prescriptionId: 'rx-003',
    requestedAt: '2026-09-20T18:05:00+03:00',
    routedTo: 'public_pharmacy',
    status: 'requested',
    ...overrides,
  };
}

describe('sectorFromRoutedTo', () => {
  it('maps public_pharmacy to public and private_pharmacy to private', () => {
    expect(sectorFromRoutedTo('public_pharmacy')).toBe('public');
    expect(sectorFromRoutedTo('private_pharmacy')).toBe('private');
  });
});

describe('destinationLabel', () => {
  it('names the routing destination in the catalogue’s own words, never the raw contract value', () => {
    expect(destinationLabel('public_pharmacy', 'en')).not.toMatch(/public_pharmacy/);
    expect(destinationLabel('private_pharmacy', 'en')).not.toMatch(/private_pharmacy/);
    expect(destinationLabel('public_pharmacy', 'ar')).toMatch(/[؀-ۿ]/);
  });
});

describe('requestStatusLabel', () => {
  it('gives a distinct human label per status, never the raw contract word', () => {
    const labels = (['requested', 'approved', 'denied'] as const).map((status) => requestStatusLabel(status, 'en'));
    expect(new Set(labels).size).toBe(3);
    expect(labels).not.toContain('requested');
    expect(labels).not.toContain('approved');
    expect(labels).not.toContain('denied');
  });
});

describe('requestLineDescription', () => {
  it('names both the requested date and the routing destination', () => {
    const line = requestLineDescription(request({ requestedAt: '2026-09-20T18:05:00+03:00', routedTo: 'public_pharmacy' }), 'en');
    expect(line).toMatch(/September/);
    expect(line).toMatch(/public pharmacy/);
  });
});

describe('alreadyRequestedBody', () => {
  it('names the destination for the already-requested InlineNotice', () => {
    expect(alreadyRequestedBody('private_pharmacy', 'en')).toMatch(/private pharmacy/);
  });
});

describe('pendingRequestFor', () => {
  it('finds only a status: "requested" row — an approved or denied one is a resolved past cycle', () => {
    const requests = [request({ id: 'rf-02', prescriptionId: 'rx-001', status: 'approved' }), request({ id: 'rf-01', prescriptionId: 'rx-003', status: 'requested' })];
    expect(pendingRequestFor(requests, 'rx-003')?.id).toBe('rf-01');
    expect(pendingRequestFor(requests, 'rx-001')).toBeUndefined();
  });

  it('returns undefined for a denied request too', () => {
    const requests = [request({ prescriptionId: 'rx-002', status: 'denied' })];
    expect(pendingRequestFor(requests, 'rx-002')).toBeUndefined();
  });
});
