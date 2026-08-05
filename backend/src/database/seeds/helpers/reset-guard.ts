const ALLOWED_RESET_NODE_ENVS = ['development', 'test'];

export interface ResetGuardInput {
  nodeEnv: string | undefined;
  allowDatabaseReset: string | undefined;
  argv: string[];
  databaseName: string;
  /** Comma-separated exact database names permitted to be reset. */
  allowlist: string | undefined;
}

export interface ResetGuardResult {
  allowed: boolean;
  reasons: string[];
}

/**
 * All four conditions must hold simultaneously — this is intentionally
 * not "database name contains 'dev'" or any single cheap check. See
 * Ch12-B115 in the final report for why each layer exists.
 */
export function evaluateResetGuard(input: ResetGuardInput): ResetGuardResult {
  const reasons: string[] = [];

  if (!input.nodeEnv || !ALLOWED_RESET_NODE_ENVS.includes(input.nodeEnv)) {
    reasons.push(
      `NODE_ENV must be one of [${ALLOWED_RESET_NODE_ENVS.join(', ')}] (got "${input.nodeEnv ?? 'unset'}")`,
    );
  }

  if (input.allowDatabaseReset !== 'true') {
    reasons.push('ALLOW_DATABASE_RESET must be set to "true"');
  }

  if (!input.argv.includes('--confirm-reset')) {
    reasons.push('missing required --confirm-reset flag');
  }

  const allowlist = (input.allowlist ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowlist.length === 0) {
    reasons.push(
      'DB_RESET_ALLOWLIST is not configured — no database is allowed by default',
    );
  } else if (!allowlist.includes(input.databaseName)) {
    reasons.push(
      `database "${input.databaseName}" is not present in DB_RESET_ALLOWLIST`,
    );
  }

  return { allowed: reasons.length === 0, reasons };
}

/** Never includes the password — safe to print/log. */
export function sanitizeDatabaseTarget(target: {
  host: string;
  port: number;
  name: string;
  user: string;
}): string {
  return `postgres://${target.user}@${target.host}:${target.port}/${target.name}`;
}
