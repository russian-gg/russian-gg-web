/**
 * Joins class names, dropping falsy entries so conditional classes read inline.
 * Lives outside the component modules so fast refresh keeps working there.
 */
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}
