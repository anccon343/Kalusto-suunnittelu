/**
 * Availability for a gig being edited or confirmed: a draft model with the edited gig
 * in place of the stored one, and the rule-9 check against the current model
 * (plan 5.1, rules 7 and 9). Pure: no React, no Firebase.
 */
import {
  Availability,
  blockingOnSave,
  CONDITION_SRC,
  type LineConflict,
} from '../../core/availability'
import { formatDuration, formatShortDate, formatTime, type Ms } from '../../core/time'
import type { Gig, Item, Line, Location } from '../../core/types'
import { withConfirmation } from './gigForm'
import { t } from './texts'

export interface ModelInput {
  items: readonly Item[]
  gigs: readonly Gig[]
  locations: readonly Location[]
  now: Ms
}

/** A model of the data with `draft` replacing the stored gig of the same id (or added). */
export function draftModel(input: ModelInput, draft: Gig): Availability {
  return new Availability({
    items: input.items,
    gigs: [...input.gigs.filter((g) => g.id !== draft.id), draft],
    ownStudioLocationIds: input.locations.filter((l) => l.isOwnStudio).map((l) => l.id),
    now: input.now,
  })
}

/** One new red combination that blocks a save, e.g. "KAM-01: Webinaari X, Hybridiseminaari". */
export interface Blocking {
  key: string
  itemLabel: string
  sources: string[]
  text: string
}

/**
 * Rule 9: the red combinations the change would create. A cancellation is never
 * blocked (rule 10). `before` is the model of the stored data, `after` the draft model,
 * both at the same instant.
 */
export function saveBlockers(before: Availability, after: Availability, draft: Gig): Blocking[] {
  if (draft.status === 'peruttu') return []
  const keys = blockingOnSave(before.redSegments(), after.redSegments())
  return keys.map((key) => describeBlocking(key, after))
}

/** The data a confirmation check needs: the current model and the raw data it was built from. */
export interface ConfirmContext {
  availability: Availability
  data: Omit<ModelInput, 'now'>
  now: Ms
  author: string
}

/** Rule 9 for "Vahvista": the new red combinations confirming `gig` would create. */
export function confirmBlockers(ctx: ConfirmContext, gig: Gig): Blocking[] {
  const confirmed = withConfirmation(
    { ...gig, status: 'vahvistettu' },
    gig.status,
    ctx.now,
    ctx.author,
  )
  const after = draftModel({ ...ctx.data, now: ctx.now }, confirmed)
  return saveBlockers(ctx.availability, after, confirmed)
}

export function describeBlocking(key: string, model: Availability): Blocking {
  const sep = key.indexOf('|')
  const itemId = sep < 0 ? key : key.slice(0, sep)
  const srcs = sep < 0 ? [] : key.slice(sep + 1).split(',')
  const item = model.item(itemId)
  const itemLabel = item?.tag ?? itemId
  const sources = srcs.map((s) => sourceName(s, model, item))
  return { key, itemLabel, sources, text: `${itemLabel}: ${sources.join(', ')}` }
}

function sourceName(src: string, model: Availability, item: Item | undefined): string {
  if (src === CONDITION_SRC) return conditionText(item)
  return model.gig(src)?.name ?? src
}

function conditionText(item: Item | undefined): string {
  const label = t.conflicts.condition[item?.condition === 'rikki' ? 'rikki' : 'huollossa']
  if (item?.conditionUntil === undefined) return label
  return t.conflicts.conditionUntil(
    label,
    `${formatShortDate(item.conditionUntil)} ${formatTime(item.conditionUntil)}`,
  )
}

/** "ti 1.12. klo 8.00–17.00", "ma 30.11. klo 14.00 – ke 2.12. klo 12.00", "… alkaen". */
export function formatSpan(start: Ms, end: Ms): string {
  if (!Number.isFinite(start) && !Number.isFinite(end)) return ''
  if (!Number.isFinite(end))
    return t.conflicts.from(`${formatShortDate(start)} ${formatTime(start)}`)
  if (!Number.isFinite(start)) return `– ${formatShortDate(end)} ${formatTime(end)}`
  const s = `${formatShortDate(start)} ${formatTime(start)}`
  if (formatShortDate(start) === formatShortDate(end) && end - start < 24 * 3_600_000) {
    return `${s}–${formatTime(end).replace('klo ', '')}`
  }
  return `${s} – ${formatShortDate(end)} ${formatTime(end)}`
}

export interface ConflictView {
  severity: 'red' | 'yellow'
  label: string
  /** Competitors, e.g. "myös Webinaari X", "huollossa pe 4.12. klo 16.00 asti". */
  who: string
  span: string
}

/** Human-readable conflict of one line, for its badge. */
export function describeConflict(
  c: LineConflict,
  model: Availability,
  itemId: string,
): ConflictView {
  const item = model.item(itemId)
  const lateGigs = new Set(c.late.map((r) => r.gigId))
  const names = c.competitors.filter((s) => !lateGigs.has(s)).map((s) => sourceName(s, model, item))
  const late = c.late.map((r) => {
    const name = model.gig(r.gigId)?.name ?? r.gigId
    const overdue = model.now - r.dueAt
    return overdue > 0
      ? t.conflicts.notReturned(name, formatDuration(overdue))
      : t.conflicts.notReturnedYet(name)
  })
  const parts = [names.length ? t.conflicts.also(names.join(', ')) : '', ...late].filter(Boolean)
  return {
    severity: c.severity,
    label: c.severity === 'red' ? t.conflicts.red : t.conflicts.yellow,
    who: parts.join('; '),
    span: formatSpan(c.start, c.end),
  }
}

export function lineConflictViews(model: Availability, gig: Gig, line: Line): ConflictView[] {
  return model.lineConflicts({ gig, line }).map((c) => describeConflict(c, model, line.itemId))
}

/** Lines with at least one red conflict, and lines with only yellow ones. */
export function conflictCounts(model: Availability, gig: Gig): { red: number; yellow: number } {
  let red = 0
  let yellow = 0
  for (const line of gig.lines) {
    const cs = model.lineConflicts({ gig, line })
    if (cs.some((c) => c.severity === 'red')) red++
    else if (cs.length > 0) yellow++
  }
  return { red, yellow }
}

/** The booking window of a line for availability hints: own time, else the equipment period. */
export function lineWindow(gig: Gig, line: Pick<Line, 'start' | 'end'>): { start: Ms; end: Ms } {
  return { start: line.start ?? gig.equipStart, end: line.end ?? gig.equipEnd }
}

/** "vapaa" / "varattu" for a device, "vapaana 28/40" for a quantity item. */
export function freeHint(
  model: Availability,
  item: Item,
  window: { start: Ms; end: Ms },
  gigId: string,
): {
  text: string
  free: number
} {
  const free = model.minFree(item.id, window, gigId)
  if (item.quantity === 1) return { text: free >= 1 ? t.lines.free : t.lines.busy, free }
  return { text: free >= 1 ? t.lines.freeOf(free, item.quantity) : t.lines.busy, free }
}

/**
 * "Vaihda laite" (plan 4.3): other devices with the same name, or the same category
 * when none share the name, that are free for the whole window and not on the gig.
 */
export function swapCandidates(
  model: Availability,
  items: readonly Item[],
  gig: Gig,
  line: Line,
): Item[] {
  const current = model.item(line.itemId)
  if (!current) return []
  const onGig = new Set(gig.lines.map((l) => l.itemId))
  const window = lineWindow(gig, line)
  const pool = items.filter(
    (it) => !it.archived && it.quantity === 1 && it.id !== current.id && !onGig.has(it.id),
  )
  const free = pool.filter((it) => model.minFree(it.id, window, gig.id) >= 1)
  const sameName = free.filter((it) => it.name === current.name)
  const candidates = sameName.length
    ? sameName
    : free.filter((it) => it.category !== '' && it.category === current.category)
  return candidates.toSorted((a, b) => a.tag.localeCompare(b.tag, 'fi', { numeric: true }))
}
