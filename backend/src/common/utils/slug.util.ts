const VIETNAMESE_D_MAP: Record<string, string> = { đ: 'd', Đ: 'D' };
const COMBINING_DIACRITICS_REGEX = new RegExp('[\\u0300-\\u036f]', 'g');

/**
 * Converts arbitrary text (including Vietnamese diacritics) into a
 * lowercase, hyphen-separated slug. "đ"/"Đ" do not decompose under Unicode
 * NFD normalization (they are not d + combining mark), so they are mapped
 * explicitly before stripping the rest of the diacritics.
 */
export function slugify(input: string): string {
  const withoutDStroke = input.replace(
    /[đĐ]/g,
    (char) => VIETNAMESE_D_MAP[char],
  );
  const withoutDiacritics = withoutDStroke
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS_REGEX, '');

  return withoutDiacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
