/**
 * Pure mapping from gigs to calendar entries and FullCalendar event inputs. Kept free
 * of React so the rules (which gigs show, how conflicts are flagged, how times are
 * labelled in Helsinki time) are unit tested on their own.
 */
import type { EventInput } from '@fullcalendar/react'
import type { Availability } from '../../core/availability'
import { dateOf, formatDate, formatTime, parseDate, toIsoDate, type Ms } from '../../core/time'
import type { Gig, GigStatus } from '../../core/types'
import { t } from './texts'

export type ConflictLevel = 'red' | 'yellow'

/** One gig as the calendar shows it: the event time ("tapahtuma"), labelled with the name. */
export interface CalendarEntry {
  gigId: string
  title: string
  status: GigStatus
  start: Ms
  end: Ms
  conflict: ConflictLevel | undefined
  /** Full description for screen readers and tooltips. */
  label: string
}

/**
 * The worst conflict on any line of the gig: red (päällekkäin) beats yellow (varoitus).
 * Undefined when no line has a conflict.
 */
export function gigConflict(availability: Availability, gig: Gig): ConflictLevel | undefined {
  let worst: ConflictLevel | undefined
  for (const line of gig.lines) {
    const ref = availability.line(gig.id, line.id) ?? { gig, line }
    for (const c of availability.lineConflicts(ref)) {
      if (c.severity === 'red') return 'red'
      worst = 'yellow'
    }
  }
  return worst
}

const isoDay = (ms: Ms) => toIsoDate(dateOf(ms))
/** "9.00" (formatTime without "klo"). */
const clock = (ms: Ms) => formatTime(ms).replace('klo ', '')

/** "ti 1.12.2026 klo 10.00–16.00", or both dates when the event continues to another day. */
export function formatEventRange(start: Ms, end: Ms): string {
  // An event ending exactly at midnight still belongs to its start day.
  if (isoDay(start) === isoDay(Math.max(start, end - 1))) {
    return `${formatDate(start)} ${formatTime(start)}–${clock(end)}`
  }
  return `${formatDate(start)} ${formatTime(start)} – ${formatDate(end)} ${formatTime(end)}`
}

/** "Hybridiseminaari, Alustava, ti 1.12.2026 klo 10.00–16.00, varoitus" */
export function entryLabel(
  e: Pick<CalendarEntry, 'title' | 'status' | 'start' | 'end' | 'conflict'>,
): string {
  const parts = [e.title, t.status[e.status], formatEventRange(e.start, e.end)]
  if (e.conflict) parts.push(t.conflictAria[e.conflict])
  return parts.join(', ')
}

/**
 * Calendar entries for the gigs, sorted by start and name. Cancelled gigs are left
 * out unless `showCancelled` is set.
 */
export function calendarEntries(
  gigs: readonly Gig[],
  availability: Availability,
  opts: { showCancelled: boolean },
): CalendarEntry[] {
  return gigs
    .filter((g) => opts.showCancelled || g.status !== 'peruttu')
    .map((g) => {
      const base = {
        gigId: g.id,
        title: g.name,
        status: g.status,
        start: g.eventStart,
        end: g.eventEnd,
        conflict: gigConflict(availability, g),
      }
      return { ...base, label: entryLabel(base) }
    })
    .sort((a, b) => a.start - b.start || a.title.localeCompare(b.title, 'fi'))
}

/**
 * FullCalendar inputs. Instants are passed as UTC ISO strings; the calendar shows
 * them in Europe/Helsinki. The colours are CSS variables that the view's stylesheet
 * sets per status.
 */
export function toEventInputs(entries: readonly CalendarEntry[]): EventInput[] {
  return entries.map((entry) => ({
    id: entry.gigId,
    title: entry.title,
    start: new Date(entry.start).toISOString(),
    end: new Date(entry.end).toISOString(),
    color: 'var(--cal-event-bg)',
    contrastColor: 'var(--cal-event-fg)',
    extendedProps: { entry },
  }))
}

/** Reads our entry back from a FullCalendar event's `extendedProps`. */
export function entryOf(extendedProps: Record<string, unknown>): CalendarEntry | undefined {
  const { entry } = extendedProps
  return entry && typeof entry === 'object' && 'gigId' in entry
    ? (entry as CalendarEntry)
    : undefined
}

/**
 * The calendar date of a FullCalendar date string ("2026-12-01" or
 * "2026-12-01T10:00:00+02:00", already in Helsinki time), or null if invalid.
 */
export function isoDateOf(dateStr: string): string | null {
  const d = parseDate(dateStr.slice(0, 10))
  return d ? toIsoDate(d) : null
}

/** Where a click on a day leads: a new gig on that day. */
export function newGigPath(isoDate: string): string {
  return `/keikat/uusi?${new URLSearchParams({ paiva: isoDate }).toString()}`
}

/** Which part of a multi-day event a list row shows. */
export type DayPart = 'whole' | 'first' | 'middle' | 'last'

export function dayPart(isStart: boolean, isEnd: boolean): DayPart {
  if (isStart) return isEnd ? 'whole' : 'first'
  return isEnd ? 'last' : 'middle'
}

/** Time of a list row: "10.00–16.00", "alkaa klo 9.00", "jatkuu" or "päättyy klo 16.00". */
export function listTimeText(entry: Pick<CalendarEntry, 'start' | 'end'>, part: DayPart): string {
  switch (part) {
    case 'whole':
      return `${clock(entry.start)}–${clock(entry.end)}`
    case 'first':
      return t.startsAt(formatTime(entry.start))
    case 'middle':
      return t.continues
    case 'last':
      return t.endsAt(formatTime(entry.end))
  }
}
