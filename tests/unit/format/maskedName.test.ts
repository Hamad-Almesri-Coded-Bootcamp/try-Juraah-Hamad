/**
 * maskName, unit-tested against docs/Seed Dataset.md's nine worked examples verbatim, plus none /
 * one / several middle names and the honorific-prefix rule (CR-021).
 */
import { describe, expect, it } from 'vitest';
import { maskName } from '@/lib/format/maskedName';

describe('maskName — the seed\'s worked examples, verbatim', () => {
  it.each([
    ['عبدالله محمد عبدالعزيز المطيري', 'عبدالله م*** ع*** المطيري'],
    ['ناصر حمد المطيري', 'ناصر ح*** المطيري'],
    ['سارة يوسف العجمي', 'سارة ي*** العجمي'],
    ['منى خالد المطيري', 'منى خ*** المطيري'],
    ['بدر فهد العنزي', 'بدر ف*** العنزي'],
    ['طلال عبدالله المطيري', 'طلال ع*** المطيري'],
    ['دلال عبدالرحمن المطيري', 'دلال ع*** المطيري'],
    ['حمد المطيري', 'حمد المطيري'],
  ])('%s → %s', (input, expected) => {
    expect(maskName(input)).toBe(expected);
  });
});

describe('maskName — none / one / several middle names', () => {
  it('no middle name (two parts): unchanged', () => {
    expect(maskName('حمد المطيري')).toBe('حمد المطيري');
  });

  it('one middle name: one initial + three asterisks', () => {
    expect(maskName('ناصر حمد المطيري')).toBe('ناصر ح*** المطيري');
  });

  it('several middle names: one initial + three asterisks each', () => {
    expect(maskName('عبدالله محمد عبدالعزيز سالم المطيري')).toBe('عبدالله م*** ع*** س*** المطيري');
  });

  it('always exactly three asterisks regardless of the real middle-name length', () => {
    expect(maskName('طلال عبدالله المطيري')).toContain('ع***');
    expect(maskName('طلال عبدالله المطيري')).not.toContain('****');
  });
});

describe('maskName — honorific prefixes are not a name part', () => {
  it('strips "د." before masking', () => {
    expect(maskName('د. خالد عبدالرحمن الرشيد')).toBe('خالد ع*** الرشيد');
  });

  it('strips "م." before masking', () => {
    expect(maskName('م. دانة فهد السالم')).toBe('دانة ف*** السالم');
  });
});
