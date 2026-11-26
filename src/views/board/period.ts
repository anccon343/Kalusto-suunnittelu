/**
 * The visible period of the board: a Monday-first window of one or two weeks. The
 * period is identified by the ISO date of its Monday, which is also the `?alku=` value.
 */
import {
  addDays,
  dateOf,
  isoWeek,
  parseDate,
  toIsoDate,
  type LocalDate,
  type Ms,
} from '../../core/time'
import { boardDays, mondayOf, type BoardDay } from './layout'

/** Phones show one week, wider screens two. */
export const periodDays = (wide: boolean): number => (wide ? 14 : 7)

/** The Monday of `?alku=YYYY-MM-DD`, or of the current Helsinki week, as an ISO date. */
export function periodStart(param: string | null, now: Ms): string {
  const parsed = param === null ? null : parseDate(param)
  return toIsoDate(mondayOf(parsed ?? dateOf(now)))
}

function parseStart(startIso: string): LocalDate {
  const d = parseDate(startIso)
  if (!d) throw new RangeError(`Invalid period start: ${startIso}`)
  return mondayOf(d)
}

/** The days of the period starting on the week of `startIso`. */
export function periodWindow(startIso: string, count: number): BoardDay[] {
  return boardDays(parseStart(startIso), count)
}

/** The start of the previous or next period. */
export function shiftPeriod(startIso: string, count: number, direction: 1 | -1): string {
  return toIsoDate(addDays(parseStart(startIso), direction * count))
}

/** ISO week numbers of the first and last day of the period. */
export function periodWeeks(days: readonly BoardDay[]): { from: number; to: number } {
  const first = days[0]
  const last = days.at(-1)
  if (!first || !last) return { from: 0, to: 0 }
  return { from: isoWeek(first.date), to: isoWeek(last.date) }
}

export const sameDate = (a: LocalDate, b: LocalDate): boolean =>
  a.year === b.year && a.month === b.month && a.day === b.day
