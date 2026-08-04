import { slugify } from './slug.util';

describe('slugify', () => {
  it('converts Vietnamese diacritics to plain ASCII', () => {
    expect(slugify('Điện thoại')).toBe('dien-thoai');
  });

  it('converts đ/Đ (not decomposable via NFD) to d/D', () => {
    expect(slugify('Đồ gia dụng')).toBe('do-gia-dung');
  });

  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Thời Trang Nam')).toBe('thoi-trang-nam');
  });

  it('collapses non-alphanumeric runs into a single hyphen', () => {
    expect(slugify('Điện tử & Phụ kiện!!!')).toBe('dien-tu-phu-kien');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  --Laptop--  ')).toBe('laptop');
  });

  it('produces an empty string for input with no alphanumeric characters', () => {
    expect(slugify('!!!')).toBe('');
  });

  it('is idempotent on an already-normalized slug', () => {
    expect(slugify('dien-thoai')).toBe('dien-thoai');
  });
});
