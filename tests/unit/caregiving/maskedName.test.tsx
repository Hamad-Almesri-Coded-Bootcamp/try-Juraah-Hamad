/**
 * Named invariant — masked name exactly three asterisks per middle name (WP4h ACCEPTANCE). Unit
 * test on the RENDERED output (`lib/format/maskedName.tsx`'s `MaskedName`), not just the plain
 * string `maskName` already covered by WP1's own `tests/unit/data/mock-store.test.ts` — this bundle
 * writes its own, against both seed lookups the brief names: عبدالله (two middle names) and ناصر
 * (one middle name).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MaskedName, maskName } from '@/lib/format/maskedName';
import { reset, getStore } from '@/lib/data/mock/store';
import { maskedNameFor } from '@/lib/data/mock/accounts';

afterEach(cleanup);

describe('masked name — exactly three asterisks per middle name, rendered output', () => {
  it('عبدالله محمد عبدالعزيز المطيري (two middle names) → عبدالله م*** ع*** المطيري, exactly three asterisks each', () => {
    const { container } = render(<MaskedName fullName="عبدالله محمد عبدالعزيز المطيري" />);
    expect(container.textContent).toBe('عبدالله م*** ع*** المطيري');
    expect(container.textContent?.match(/\*/g)?.length).toBe(6); // 3 asterisks × 2 middle names
    // The asterisk runs are decorative to assistive technology (CR-021).
    const hidden = container.querySelectorAll('[aria-hidden="true"]');
    expect(hidden.length).toBe(2);
    for (const node of hidden) expect(node.textContent).toBe('***');
  });

  it('ناصر حمد المطيري (one middle name) → ناصر ح*** المطيري, exactly three asterisks', () => {
    const { container } = render(<MaskedName fullName="ناصر حمد المطيري" />);
    expect(container.textContent).toBe('ناصر ح*** المطيري');
    expect(container.textContent?.match(/\*/g)?.length).toBe(3);
  });

  it('masking never keys off the real middle-name length — a nine-letter and a three-letter middle name both mask to exactly three asterisks', () => {
    expect(maskName('طلال عبدالله المطيري')).toBe('طلال ع*** المطيري'); // عبدالله is 7 letters
    expect(maskName('حمد المطيري')).toBe('حمد المطيري'); // two parts only — nothing masked
  });

  it('lookupMaskedName (the data-layer function F1 actually calls) agrees with the rendered form for both seed lookups', () => {
    reset();
    const store = getStore();
    expect(maskedNameFor(store, '285061400412').maskedName).toBe('عبدالله م*** ع*** المطيري');
    expect(maskedNameFor(store, '288110300229').maskedName).toBe('ناصر ح*** المطيري');
  });
});
