import {
  detectImageMimeType,
  extensionForImageMimeType,
} from './image-signature.util';

const JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const WEBP_BYTES = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
]);

describe('detectImageMimeType', () => {
  it('detects a real JPEG signature', () => {
    expect(detectImageMimeType(JPEG_BYTES)).toBe('image/jpeg');
  });

  it('detects a real PNG signature', () => {
    expect(detectImageMimeType(PNG_BYTES)).toBe('image/png');
  });

  it('detects a real WebP signature', () => {
    expect(detectImageMimeType(WEBP_BYTES)).toBe('image/webp');
  });

  it('rejects an empty buffer', () => {
    expect(detectImageMimeType(Buffer.alloc(0))).toBeNull();
  });

  it('rejects a too-short buffer', () => {
    expect(detectImageMimeType(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
  });

  it('rejects an HTML file renamed to .jpg (fake extension/MIME)', () => {
    const html = Buffer.from('<html><body>evil</body></html>', 'utf-8');
    expect(detectImageMimeType(html)).toBeNull();
  });

  it('rejects an SVG (XML text, not a raster magic-byte match)', () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
      'utf-8',
    );
    expect(detectImageMimeType(svg)).toBeNull();
  });

  it('rejects a PDF disguised with a .jpg name', () => {
    const pdf = Buffer.from('%PDF-1.4 fake content padding here', 'utf-8');
    expect(detectImageMimeType(pdf)).toBeNull();
  });

  it('does not trust a spoofed mimetype field — detection ignores it entirely', () => {
    // detectImageMimeType only ever receives a Buffer — there is no
    // mimetype parameter to spoof, which is the point.
    expect(detectImageMimeType(JPEG_BYTES)).not.toBeNull();
  });
});

describe('extensionForImageMimeType', () => {
  it('maps each detected type to its extension', () => {
    expect(extensionForImageMimeType('image/jpeg')).toBe('jpg');
    expect(extensionForImageMimeType('image/png')).toBe('png');
    expect(extensionForImageMimeType('image/webp')).toBe('webp');
  });
});
