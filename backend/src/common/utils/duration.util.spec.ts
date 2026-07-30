import { parseDurationToSeconds } from './duration.util';

describe('parseDurationToSeconds', () => {
  it('parses seconds', () => {
    expect(parseDurationToSeconds('30s')).toBe(30);
  });

  it('parses minutes', () => {
    expect(parseDurationToSeconds('15m')).toBe(900);
  });

  it('parses hours', () => {
    expect(parseDurationToSeconds('2h')).toBe(7200);
  });

  it('parses days', () => {
    expect(parseDurationToSeconds('7d')).toBe(604800);
  });

  it('throws on invalid format', () => {
    expect(() => parseDurationToSeconds('invalid')).toThrow();
  });
});
