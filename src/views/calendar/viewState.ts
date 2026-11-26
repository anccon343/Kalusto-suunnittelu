/**
 * The calendar's view and date live in the address (?nakyma=kuukausi&paiva=2026-12-01),
 * so coming back from a gig returns to the same month or week.
 */
import { addDays, isoWeek, parseDate, toIsoDate, type LocalDate } from '../../core/time'
import { t } from './texts'

export type CalendarMode = 'kuukausi' | 'viikko' | 'lista'

export const MODES: readonly CalendarMode[] = ['kuukausi', 'viikko', 'lista']

/** FullCalendar view names for each mode. The list is a two-week agenda. */
export const VIEW_OF_MODE: Record<CalendarMode, string> = {
  kuukausi: 'dayGridMonth',
  viikko: 'timeGridWeek',
  lista: 'listTwoWeeks',
}

export function modeOfView(viewType: string): CalendarMode | undefined {
  return MODES.find((m) => VIEW_OF_MODE[m] === viewType)
}

export function isMode(s: string | null): s is CalendarMode {
  return s !== null && (MODES as readonly string[]).includes(s)
}

export interface ViewState {
  mode: CalendarMode
  /** Helsinki date (YYYY-MM-DD) the calendar opens at; undefined = today. */
  date: string | undefined
}

/** Reads the state from the address; phones default to the list, wide screens to the month. */
export function readViewState(params: URLSearchParams, wide: boolean): ViewState {
  const m = params.get('nakyma')
  const d = parseDate(params.get('paiva') ?? '')
  return { mode: isMode(m) ? m : wide ? 'kuukausi' : 'lista', date: d ? toIsoDate(d) : undefined }
}

/** The address parameters for a state, keeping unrelated parameters as they are. */
export function writeViewState(params: URLSearchParams, s: ViewState): URLSearchParams {
  const next = new URLSearchParams(params)
  next.set('nakyma', s.mode)
  if (s.date) next.set('paiva', s.date)
  else next.delete('paiva')
  return next
}

const dm = (d: LocalDate) => `${d.day}.${d.month}.`

/**
 * Toolbar title for the shown period (`first` and `last` are inclusive Helsinki dates):
 * "joulukuu 2026", "vk 49 · 30.11.–6.12.2026" or "30.11.–13.12.2026".
 */
export function periodTitle(mode: CalendarMode, first: string, last: string): string {
  const a = parseDate(first)
  const b = parseDate(last)
  if (!a || !b) return ''
  if (mode === 'kuukausi') return `${t.months[a.month - 1] ?? ''} ${a.year}`
  const range =
    a.year === b.year ? `${dm(a)}–${dm(b)}${b.year}` : `${dm(a)}${a.year}–${dm(b)}${b.year}`
  return mode === 'viikko' ? `${t.week(isoWeek(a))} · ${range}` : range
}

/** The last day of a period whose exclusive end FullCalendar reports as `endExclusive`. */
export function lastDayOf(endExclusive: string): string {
  const d = parseDate(endExclusive)
  return d ? toIsoDate(addDays(d, -1)) : ''
}
