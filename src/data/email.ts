/** Email helpers shared by auth and writes (no Firebase imports). */

/** Lower-cased, trimmed email: the allowlist document id and the `updatedBy` value. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** A deliberately loose check: one "@", something on both sides, a dot in the domain. */
export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}
