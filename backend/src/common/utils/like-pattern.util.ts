/**
 * Escapes `%`, `_`, and the escape character itself so a user-typed keyword
 * is always treated as a literal substring by ILIKE — never as a SQL
 * wildcard. Callers must pass `ESCAPE '\'` alongside any pattern built from
 * this.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
