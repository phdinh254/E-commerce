/**
 * SVG is deliberately excluded: it is XML and can embed <script>, making it
 * an XSS vector if ever served inline — see Ch11-B100 in the final report.
 */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_IMAGES_PER_BULK_UPLOAD = 10;
