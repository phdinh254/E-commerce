import { resolve, sep } from 'path';

export class PathTraversalError extends Error {}

/**
 * Resolves `relativePath` against `root` and throws `PathTraversalError`
 * if the result would land outside `root` — shared by read-from-file.ts
 * (seed data JSON) and the product-images seeder (fixture asset binaries),
 * so both seed-owned directories get the identical guard instead of two
 * slightly-different copies.
 */
export function resolveWithinRoot(root: string, relativePath: string): string {
  if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
    throw new PathTraversalError(
      `Absolute paths are not allowed: "${relativePath}"`,
    );
  }
  if (/^[a-zA-Z]:/.test(relativePath)) {
    throw new PathTraversalError(
      `Absolute paths are not allowed: "${relativePath}"`,
    );
  }

  const resolved = resolve(root, relativePath);
  const rootWithSep = root.endsWith(sep) ? root : root + sep;

  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    throw new PathTraversalError(
      `"${relativePath}" resolves outside "${root}"`,
    );
  }
  return resolved;
}
