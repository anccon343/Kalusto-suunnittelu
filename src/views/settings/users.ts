/** Pure helpers for the user list. */
import type { AllowedUser } from '../../core/types'

export const INITIALS_MAX = 4
export const USER_NAME_MAX = 100

const segmenter = new Intl.Segmenter('fi', { granularity: 'grapheme' })
const graphemes = (s: string) => Array.from(segmenter.segment(s), (x) => x.segment)

/**
 * Suggests initials from a name: first letters of the first and last word
 * ("Anna Virtanen" → "AV"), or the first two letters of a single word ("Anna" → "AN").
 */
export function suggestInitials(name: string): string {
  const words = name
    .trim()
    .split(/[\s-]+/u)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w !== '')
  const first = words[0]
  if (first === undefined) return ''
  const last = words.length > 1 ? words[words.length - 1] : undefined
  const letters =
    last === undefined ? graphemes(first).slice(0, 2) : [graphemes(first)[0], graphemes(last)[0]]
  return letters.join('').toLocaleUpperCase('fi')
}

/** Signed-in user first, then by name. */
export function sortUsers<T extends AllowedUser>(users: readonly T[], me: string): T[] {
  return [...users].sort(
    (a, b) => Number(b.email === me) - Number(a.email === me) || a.name.localeCompare(b.name, 'fi'),
  )
}
