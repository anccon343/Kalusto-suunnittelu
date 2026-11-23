/**
 * Item tags such as "KAM-03". Tags are unique regardless of letter case and
 * whitespace, and "Monista" (duplicate) suggests the next free number.
 */

/** Canonical form used for uniqueness checks: upper case, no whitespace. */
export function normalizeTag(tag: string): string {
  return tag.normalize('NFC').replace(/\s+/g, '').toLocaleUpperCase('fi-FI')
}

/** Display form: trimmed, inner whitespace collapsed, upper case. */
export function cleanTag(tag: string): string {
  return tag.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('fi-FI')
}

export function isTagTaken(tag: string, existing: Iterable<string>): boolean {
  const n = normalizeTag(tag)
  for (const t of existing) if (normalizeTag(t) === n) return true
  return false
}

const TRAILING_NUMBER = /^(.*?)(\d+)$/

/**
 * Suggests the next free tag after `tag`, keeping its prefix and zero padding:
 * "KAM-03" → "KAM-04" (or the next unused number). Tags without a trailing
 * number get "-2", "-3", …
 */
export function nextTag(tag: string, existing: Iterable<string>): string {
  const taken = new Set([...existing].map(normalizeTag))
  const base = cleanTag(tag)
  const m = TRAILING_NUMBER.exec(base)
  const prefix = m ? (m[1] ?? '') : `${base}-`
  const digits = m ? (m[2] ?? '') : '1'
  const width = m ? digits.length : 1
  for (let n = Number(digits) + 1; ; n++) {
    const candidate = `${prefix}${String(n).padStart(width, '0')}`
    if (!taken.has(normalizeTag(candidate))) return candidate
  }
}
