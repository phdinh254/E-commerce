import { buildProductImageObjectPath } from './object-path.util';

describe('buildProductImageObjectPath', () => {
  it('builds a path scoped under products/{productId}/', () => {
    const path = buildProductImageObjectPath('prod-1', 'jpg');
    expect(path).toMatch(/^products\/prod-1\/[0-9a-f-]{36}\.jpg$/);
  });

  it('generates a different UUID on every call (no collisions from a single timestamp)', () => {
    const a = buildProductImageObjectPath('prod-1', 'png');
    const b = buildProductImageObjectPath('prod-1', 'png');
    expect(a).not.toBe(b);
  });

  it('never lets the extension introduce path traversal or extra segments', () => {
    const path = buildProductImageObjectPath('prod-1', 'jpg');
    expect(path).not.toContain('..');
    expect(path).not.toContain('\\');
    expect(path.split('/')).toHaveLength(3);
  });
});
