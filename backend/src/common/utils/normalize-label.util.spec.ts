import { normalizeLabel } from './normalize-label.util';

describe('normalizeLabel', () => {
  it('trims leading/trailing whitespace', () => {
    expect(normalizeLabel('  Đỏ  ')).toBe('đỏ');
  });

  it('collapses internal whitespace runs into one space', () => {
    expect(normalizeLabel('Màu   sắc')).toBe('màu sắc');
  });

  it('lowercases', () => {
    expect(normalizeLabel('ĐỎ')).toBe('đỏ');
  });

  it('does NOT strip Vietnamese diacritics (unlike slugify)', () => {
    expect(normalizeLabel('Đỏ')).not.toBe(normalizeLabel('Do'));
  });

  it('treats case-only variants as equal after normalization', () => {
    expect(normalizeLabel('Đỏ')).toBe(normalizeLabel('đỏ'));
  });
});
