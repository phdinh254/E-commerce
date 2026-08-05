/**
 * Authoritative image type detection by magic bytes — never trust
 * `file.mimetype` (client-declared) or the original filename/extension.
 * Deliberately hand-rolled instead of adding a file-type-sniffing
 * dependency: only three formats are in the allowlist, and each has a
 * short, stable, well-documented signature.
 */
export type DetectedImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export function detectImageMimeType(
  buffer: Buffer,
): DetectedImageMimeType | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }

  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

export function extensionForImageMimeType(
  mimeType: DetectedImageMimeType,
): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
  }
}
