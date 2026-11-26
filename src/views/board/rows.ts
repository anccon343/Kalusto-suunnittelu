/**
 * Builds the rows of the equipment board from the availability model: bars for
 * devices, per-day free quantities for quantity items, and filtering and sorting.
 */
import type { Availability } from '../../core/availability'
import { formatShortDate, formatTime, type Ms } from '../../core/time'
import type { Item } from '../../core/types'
import {
  conflictMarks,
  daySeverity,
  demandsToBarInputs,
  layoutBars,
  type Bar,
  type BoardDay,
  type ConflictMark,
  type Severity,
} from './layout'
import { t } from './texts'

export interface DeviceRowLayout {
  kind: 'device'
  bars: Bar[]
  marks: ConflictMark[]
  lanes: number
}

export interface QuantityCell {
  free: number
  capacity: number
  severity: Severity | undefined
}

export interface QuantityRowLayout {
  kind: 'quantity'
  cells: QuantityCell[]
}

export type RowLayout = DeviceRowLayout | QuantityRowLayout

export const isQuantityItem = (item: Item): boolean => item.quantity > 1

/** "Huollossa, takaisin pe 4.12. klo 16.00", "Rikki"; empty for a usable item. */
export function conditionText(item: Item): string {
  if (item.condition === 'ok') return ''
  const label = t.condition[item.condition]
  if (item.conditionUntil === undefined) return label
  return t.conditionUntil(
    label,
    `${formatShortDate(item.conditionUntil)} ${formatTime(item.conditionUntil)}`,
  )
}

export function rowLayout(
  item: Item,
  days: readonly BoardDay[],
  availability: Availability,
  gigName: (gigId: string) => string,
): RowLayout {
  const segments = availability.segments(item.id)
  if (isQuantityItem(item)) {
    const capacity = availability.capacity(item.id)
    return {
      kind: 'quantity',
      cells: days.map((day) => ({
        free: availability.minFree(item.id, day),
        capacity,
        severity: daySeverity(segments, day),
      })),
    }
  }
  const inputs = demandsToBarInputs(availability.demandsFor(item.id), {
    gigName,
    conditionLabel: conditionText(item),
    isTransferIn: (gigId, lineId) => {
      const ref = availability.line(gigId, lineId)
      return ref?.line.from !== undefined && availability.chainCheck(ref).ok
    },
  })
  const bars = layoutBars(inputs, days)
  return {
    kind: 'device',
    bars,
    marks: conflictMarks(segments, days),
    lanes: Math.max(1, ...bars.map((b) => b.lane + 1)),
  }
}

/**
 * A lazily filled per-item cache of row layouts for one data snapshot and window.
 * Filtering and typing then never recompute bars, and memoised rows keep their props.
 */
export function rowCache(
  days: readonly BoardDay[],
  availability: Availability,
  gigName: (gigId: string) => string,
): (item: Item) => RowLayout {
  const cache = new Map<string, RowLayout>()
  return (item) => {
    let row = cache.get(item.id)
    if (!row) {
      row = rowLayout(item, days, availability, gigName)
      cache.set(item.id, row)
    }
    return row
  }
}

/** Lower case without diacritics, so "lahto" finds "Lähtö". */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

export interface BoardFilter {
  category: string
  query: string
}

/** Non-archived items matching the filter, sorted by category and tag ("KAM-2" before "KAM-10"). */
export function visibleItems<T extends Item>(items: readonly T[], filter: BoardFilter): T[] {
  const q = normalize(filter.query)
  return items
    .filter((it) => !it.archived)
    .filter((it) => filter.category === '' || it.category === filter.category)
    .filter(
      (it) =>
        q === '' ||
        normalize(it.tag).includes(q) ||
        normalize(it.name).includes(q) ||
        normalize(it.tag.replace(/[\s-]/g, '')).includes(q.replace(/[\s-]/g, '')),
    )
    .toSorted(
      (a, b) =>
        a.category.localeCompare(b.category, 'fi') ||
        a.tag.localeCompare(b.tag, 'fi', { numeric: true }),
    )
}

const instantText = (ms: Ms) => `${formatShortDate(ms)} ${formatTime(ms)}`

/** "ma 30.11. klo 14.00 – ke 2.12. klo 12.00"; an open end reads "toistaiseksi". */
export function rangeText(start: Ms, end: Ms): string {
  const to = Number.isFinite(end) ? instantText(end) : t.untilFurtherNotice
  return Number.isFinite(start) ? `${instantText(start)} – ${to}` : `– ${to}`
}

/** The visible text of a bar: "alust. Hybridiseminaari", "Palauttamatta: Messut", "> Lanseeraus". */
export function barText(bar: Pick<Bar, 'kind' | 'label' | 'transferIn'>): string {
  const base =
    bar.kind === 'tentative'
      ? `${t.tentativePrefix} ${bar.label}`
      : bar.kind === 'late'
        ? t.lateLabel(bar.label)
        : bar.label
  return bar.transferIn ? `> ${base}` : base
}

/** The accessible name and tooltip of a bar. */
export function barDescription(bar: Pick<Bar, 'kind' | 'label' | 'transferIn' | 'start' | 'end'>) {
  return t.barAria({
    label: bar.kind === 'late' ? t.lateLabel(bar.label) : bar.label,
    status: t.status[bar.kind],
    range: rangeText(bar.start, bar.end),
    transfer: bar.transferIn,
  })
}

/** Categories of non-archived items, sorted. */
export function categories(items: readonly Item[]): string[] {
  return [...new Set(items.filter((it) => !it.archived).map((it) => it.category))].sort((a, b) =>
    a.localeCompare(b, 'fi'),
  )
}
