import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { plainToInstance, ClassConstructor } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { PathTraversalError, resolveWithinRoot } from './resolve-within-root';

/**
 * All seed data files must live under `src/database/seeds/data/` — this is
 * resolved once, from this module's own location, never from
 * `process.cwd()` (the seed runner must behave identically no matter which
 * directory `ts-node`/`node` was invoked from).
 */
export const SEED_DATA_ROOT = resolve(__dirname, '..', 'data');

export class SeedFileNotFoundError extends Error {}
export class SeedFileMalformedError extends Error {}
export const SeedPathTraversalError = PathTraversalError;
export class SeedValidationError extends Error {
  constructor(
    public readonly fileName: string,
    public readonly errors: ValidationError[],
  ) {
    super(
      `Seed file "${fileName}" failed validation:\n` +
        errors
          .map(
            (e) =>
              `  - record[${e.property}]: ${Object.values(e.constraints ?? {}).join(', ')}`,
          )
          .join('\n'),
    );
  }
}

/**
 * Resolves `relativePath` against `SEED_DATA_ROOT` and rejects anything
 * that would escape it (see resolveWithinRoot). This is a fixed,
 * developer-controlled directory (never a request-supplied path), but the
 * same discipline applies: resolve first, then verify containment, never
 * trust the input string's shape alone.
 */
function resolveSeedDataPath(relativePath: string): string {
  return resolveWithinRoot(SEED_DATA_ROOT, relativePath);
}

/**
 * Reads and parses a JSON seed file, then validates every record against
 * `itemClass` using class-validator (the validation library already used
 * throughout this codebase — no new dependency). Returns the validated,
 * transformed array.
 *
 * Distinguishes "file not found" from "malformed JSON" from "fails
 * schema" so callers (and the seed runner's error reporting) can give an
 * actionable message instead of one generic failure.
 */
export async function readFromFile<T extends object>(
  relativePath: string,
  itemClass: ClassConstructor<T>,
): Promise<T[]> {
  const absolutePath = resolveSeedDataPath(relativePath);

  let raw: string;
  try {
    raw = await readFile(absolutePath, { encoding: 'utf-8' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new SeedFileNotFoundError(
        `Seed file not found: "${relativePath}" (resolved to ${absolutePath})`,
      );
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new SeedFileMalformedError(
      `Seed file "${relativePath}" is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new SeedFileMalformedError(
      `Seed file "${relativePath}" must contain a top-level JSON array`,
    );
  }

  const instances = plainToInstance(itemClass, parsed as object[]);
  const allErrors: ValidationError[] = [];
  for (const instance of instances) {
    const errors = validateSync(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });
    allErrors.push(...errors);
  }
  if (allErrors.length > 0) {
    throw new SeedValidationError(relativePath, allErrors);
  }

  return instances;
}
