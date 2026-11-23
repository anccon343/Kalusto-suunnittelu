/**
 * Time handling for the app.
 *
 * All instants are stored and computed as UTC milliseconds (`Ms`). Wall-clock
 * values (what users type and read) are always interpreted in Europe/Helsinki,
 * independent of the device's own time zone.
 *
 * Conversions use `Intl.DateTimeFormat` directly instead of a date library's
 * time-zone plugin, so daylight-saving transitions are handled by the platform's
 * time-zone database and can be tested explicitly.
 */

export type Ms = number

export const HELSINKI = 'Europe/Helsinki'

export const MINUTE: Ms = 60_000
export const HOUR: Ms = 60 * MINUTE

/** A calendar date without a time zone. `month` is 1–12. */
export interface LocalDate {
  year: number
  month: number
  day: number
}

/** A wall-clock date and time without a time zone. */
export interface LocalDateTime extends LocalDate {
  hour: number
  minute: number
}

export type LocalToInstantResult =
  { ok: true; ms: Ms } | { ok: false; reason: 'invalid' | 'nonexistent' }

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    formatterCache.set(timeZone, f)
  }
  return f
}

function zonedParts(ms: Ms, timeZone: string) {
  const out = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 }
  for (const p of partsFormatter(timeZone).formatToParts(new Date(ms))) {
    if (p.type in out) out[p.type as keyof typeof out] = Number(p.value)
  }
  return out
}

/** Offset of `timeZone` from UTC at instant `ms`, in milliseconds (Helsinki: +2 h or +3 h). */
export function offsetAt(ms: Ms, timeZone: string = HELSINKI): Ms {
  const p = zonedParts(ms, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  // Drop sub-second precision so the offset is exact.
  return asUtc - (ms - (((ms % 1000) + 1000) % 1000))
}

/** Years the app accepts. Also keeps `Date.UTC` away from its 0–99 → 1900–1999 remapping. */
export const MIN_YEAR = 2000
export const MAX_YEAR = 2100

function isValidLocal(t: LocalDateTime): boolean {
  if (![t.year, t.month, t.day, t.hour, t.minute].every(Number.isInteger)) return false
  if (t.year < MIN_YEAR || t.year > MAX_YEAR) return false
  if (t.month < 1 || t.month > 12 || t.hour < 0 || t.hour > 23 || t.minute < 0 || t.minute > 59) {
    return false
  }
  return t.day >= 1 && t.day <= daysInMonth(t.year, t.month)
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Converts a Helsinki wall-clock time to an instant.
 *
 * - A time skipped by the spring-forward transition (e.g. 28.3.2027 03:30) is
 *   rejected with `nonexistent`.
 * - A time repeated by the fall-back transition (e.g. 25.10.2026 03:30) resolves
 *   to the earlier instant (summer time), as specified in the plan.
 */
export function localToInstant(
  t: LocalDateTime,
  timeZone: string = HELSINKI,
): LocalToInstantResult {
  if (!isValidLocal(t)) return { ok: false, reason: 'invalid' }
  const wall = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute)
  // The zone's offset is one of the offsets in force half a day either side.
  const offsets = new Set([
    offsetAt(wall - 12 * HOUR, timeZone),
    offsetAt(wall + 12 * HOUR, timeZone),
  ])
  const candidates = [...offsets]
    .map((off) => wall - off)
    .filter((ms) => offsetAt(ms, timeZone) === wall - ms)
    .sort((a, b) => a - b)
  const first = candidates[0]
  return first === undefined ? { ok: false, reason: 'nonexistent' } : { ok: true, ms: first }
}

/** Like `localToInstant` but throws; for fixtures and values already validated. */
export function localToInstantOrThrow(t: LocalDateTime, timeZone: string = HELSINKI): Ms {
  const r = localToInstant(t, timeZone)
  if (!r.ok) throw new RangeError(`Local time is ${r.reason}: ${JSON.stringify(t)}`)
  return r.ms
}

/** Converts an instant to Helsinki wall-clock time. */
export function instantToLocal(ms: Ms, timeZone: string = HELSINKI): LocalDateTime {
  const { year, month, day, hour, minute } = zonedParts(ms, timeZone)
  return { year, month, day, hour, minute }
}

/** Adds calendar days (not 24-hour periods) to a date. */
export function addDays(d: LocalDate, days: number): LocalDate {
  const x = new Date(Date.UTC(d.year, d.month - 1, d.day + days))
  return { year: x.getUTCFullYear(), month: x.getUTCMonth() + 1, day: x.getUTCDate() }
}

/** The instant a Helsinki calendar day starts. */
export function startOfDay(d: LocalDate, timeZone: string = HELSINKI): Ms {
  // Midnight always exists in Helsinki (transitions happen at 03:00/04:00).
  return localToInstantOrThrow({ ...d, hour: 0, minute: 0 }, timeZone)
}

/** Half-open range `[start, end)` covering one Helsinki calendar day (23, 24 or 25 hours). */
export function dayRange(d: LocalDate, timeZone: string = HELSINKI): { start: Ms; end: Ms } {
  return { start: startOfDay(d, timeZone), end: startOfDay(addDays(d, 1), timeZone) }
}

export function dateOf(ms: Ms, timeZone: string = HELSINKI): LocalDate {
  const { year, month, day } = instantToLocal(ms, timeZone)
  return { year, month, day }
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(d: LocalDate): number {
  return (new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay() + 6) % 7
}

/** ISO 8601 week number (weeks start on Monday; week 1 contains the first Thursday). */
export function isoWeek(d: LocalDate): number {
  const thursday = addDays(d, 3 - weekdayIndex(d))
  const jan1 = Date.UTC(thursday.year, 0, 1)
  const t = Date.UTC(thursday.year, thursday.month - 1, thursday.day)
  return Math.floor((t - jan1) / (24 * HOUR) / 7) + 1
}

// ---------------------------------------------------------------------------
// Parsing of form values
// ---------------------------------------------------------------------------

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^(\d{1,2})[.:](\d{2})$/

/** Parses `YYYY-MM-DD` (the value of `<input type="date">`). */
export function parseDate(s: string): LocalDate | null {
  const m = DATE_RE.exec(s.trim())
  if (!m) return null
  const d = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
  return isValidLocal({ ...d, hour: 0, minute: 0 }) ? d : null
}

/** Parses `H:mm`, `HH:mm` or the Finnish `H.mm`. */
export function parseTime(s: string): { hour: number; minute: number } | null {
  const m = TIME_RE.exec(s.trim())
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  return hour <= 23 && minute <= 59 ? { hour, minute } : null
}

export function toIsoDate(d: LocalDate): string {
  return `${d.year}-${pad2(d.month)}-${pad2(d.day)}`
}

// ---------------------------------------------------------------------------
// Finnish formatting
// ---------------------------------------------------------------------------

const WEEKDAYS_FI = ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su'] as const

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** "ti 1.12.2026" */
export function formatDate(ms: Ms): string {
  const d = dateOf(ms)
  return `${WEEKDAYS_FI[weekdayIndex(d)]} ${d.day}.${d.month}.${d.year}`
}

/** "ti 1.12." */
export function formatShortDate(ms: Ms): string {
  const d = dateOf(ms)
  return `${WEEKDAYS_FI[weekdayIndex(d)]} ${d.day}.${d.month}.`
}

/** "klo 9.00" */
export function formatTime(ms: Ms): string {
  const t = instantToLocal(ms)
  return `klo ${t.hour}.${pad2(t.minute)}`
}

/** "ti 1.12.2026 klo 9.00" */
export function formatDateTime(ms: Ms): string {
  return `${formatDate(ms)} ${formatTime(ms)}`
}

/** "vk 49" */
export function formatWeek(ms: Ms): string {
  return `vk ${isoWeek(dateOf(ms))}`
}

/** "16 h 30 min", "45 min", "-20 min" */
export function formatDuration(ms: Ms): string {
  const sign = ms < 0 ? '-' : ''
  const totalMin = Math.round(Math.abs(ms) / MINUTE)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${sign}${m} min`
  return m === 0 ? `${sign}${h} h` : `${sign}${h} h ${m} min`
}
