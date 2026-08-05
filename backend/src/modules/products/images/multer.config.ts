import { BadRequestException } from '@nestjs/common';
import { memoryStorage, Options } from 'multer';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGES_PER_BULK_UPLOAD,
} from './upload-validation.constants';

/**
 * Memory storage: the file is uploaded straight through to Supabase, never
 * written to the working directory as a temp file.
 *
 * `fileFilter` here is only a cheap first-pass rejection on the
 * client-declared `mimetype`/extension (Multer has no access to the full
 * buffer content at this point for every transport). It is NOT the
 * authoritative check — `detectImageMimeType` (magic bytes, run in
 * ProductImagesService once the buffer is fully in memory) is what
 * actually decides whether a file is accepted. This just fails fast and
 * cheaply for the obviously-wrong case.
 */
function fileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (
    !ALLOWED_IMAGE_MIME_TYPES.includes(
      file.mimetype as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
    )
  ) {
    callback(
      new BadRequestException({
        code: 'UNSUPPORTED_IMAGE_MIME_TYPE',
        message: `Định dạng file không được hỗ trợ. Chỉ chấp nhận: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`,
      }),
      false,
    );
    return;
  }
  callback(null, true);
}

export const singleImageUploadOptions: Options = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: 1,
  },
  fileFilter,
};

export const bulkImageUploadOptions: Options = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: MAX_IMAGES_PER_BULK_UPLOAD,
  },
  fileFilter,
};
