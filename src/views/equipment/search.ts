/**
 * Finnish-aware search, filtering and sorting of the equipment list. Matching ignores
 * case and accents ("aani" finds "Äänipöytä") and punctuation inside tags ("kam01"
 * finds "KAM-01"); every word of the query must match some field.
 */
import type { Item } from '../../core/types'
import type { SituationKind } from './status'

/** Lower case without diacritics: "Äänipöytä" → "aanipoyta". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fi')
}

/** Folded and without separators: "KAM-01" → "kam01". */
const compact = (s: string) => fold(s).replace(/[^\p{L}\p{N}]/gu, '')

function haystack(item: Item): string[] {
  const fields = [item.tag, item.name, item.serialNo, item.manufacturer, item.model]
  if (item.manufacturer && item.model) fields.push(`${item.manufacturer} ${item.model}`)
  return fields.filter((f): f is string => !!f)
}

export function matchesQuery(item: Item, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const folded = haystack(item).map(fold)
  const compacted = folded.map(compact)
  return words.every((w) => {
    const cw = compact(w)
    return folded.some((f) => f.includes(w)) || (cw !== '' && compacted.some((f) => f.includes(cw)))
  })
}

export const collator = new Intl.Collator('fi', { numeric: true, sensitivity: 'base' })

/** Sorted by tag ("KAM-2" before "KAM-10"). */
export function sortByTag<T extends Pick<Item, 'tag'>>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => collator.compare(a.tag, b.tag))
}

/** Distinct non-empty categories, sorted. Equal categories differing only in case merge. */
export function categoriesOf(items: readonly Pick<Item, 'category'>[]): string[] {
  const byKey = new Map<string, string>()
  for (const i of items) {
    const c = i.category.trim()
    if (c && !byKey.has(fold(c))) byKey.set(fold(c), c)
  }
  return [...byKey.values()].sort(collator.compare)
}

export interface ListFilters {
  query: string
  /** Empty = all categories. */
  category: string
  /** Undefined = all. */
  situation: SituationKind | undefined
  showArchived: boolean
}

export function filterItems<T extends Item>(
  items: readonly T[],
  f: ListFilters,
  situationOf: (item: T) => SituationKind,
): T[] {
  return sortByTag(
    items.filter(
      (i) =>
        (f.showArchived || !i.archived) &&
        (f.category === '' || fold(i.category.trim()) === fold(f.category)) &&
        (f.situation === undefined || situationOf(i) === f.situation) &&
        matchesQuery(i, f.query),
    ),
  )
}
