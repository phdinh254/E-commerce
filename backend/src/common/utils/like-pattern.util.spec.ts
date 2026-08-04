import { escapeLikePattern } from './like-pattern.util';

describe('escapeLikePattern', () => {
  it('escapes % so it is treated literally', () => {
    expect(escapeLikePattern('50%')).toBe('50\\%');
  });

  it('escapes _ so it is treated literally', () => {
    expect(escapeLikePattern('a_b')).toBe('a\\_b');
  });

  it('escapes a literal backslash first so it does not double-escape', () => {
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeLikePattern('áo thun nam')).toBe('áo thun nam');
  });
});
