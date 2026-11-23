import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayRange,
  formatDate,
  formatDateTime,
  formatDuration,
  formatShortDate,
  formatTime,
  formatWeek,
  HOUR,
  instantToLocal,
  isoWeek,
  localToInstant,
  localToInstantOrThrow,
  MINUTE,
  parseDate,
  parseTime,
  toIsoDate,
} from './time'

const local = (year: number, month: number, day: number, hour = 0, minute = 0) => ({
  year,
  month,
  day,
  hour,
  minute,
})

describe('Helsinki wall clock ↔ instant', () => {
  it('converts winter and summer times with the right offset', () => {
    expect(localToInstantOrThrow(local(2026, 12, 1, 9, 0))).toBe(Date.UTC(2026, 11, 1, 7, 0))
    expect(localToInstantOrThrow(local(2026, 6, 15, 9, 0))).toBe(Date.UTC(2026, 5, 15, 6, 0))
  })

  it('rejects a time skipped by spring forward (28.3.2027 3.30)', () => {
    expect(localToInstant(local(2027, 3, 28, 3, 30))).toEqual({ ok: false, reason: 'nonexistent' })
    expect(localToInstant(local(2027, 3, 28, 2, 59)).ok).toBe(true)
    expect(localToInstant(local(2027, 3, 28, 4, 0)).ok).toBe(true)
  })

  it('resolves a repeated fall-back time to the earlier instant (summer time)', () => {
    expect(localToInstantOrThrow(local(2027, 10, 31, 3, 30))).toBe(Date.UTC(2027, 9, 31, 0, 30))
    expect(localToInstantOrThrow(local(2026, 10, 25, 3, 30))).toBe(Date.UTC(2026, 9, 25, 0, 30))
  })

  it('rejects impossible dates and times', () => {
    expect(localToInstant(local(2026, 2, 29)).ok).toBe(false)
    expect(localToInstant(local(2026, 13, 1)).ok).toBe(false)
    expect(localToInstant(local(2026, 1, 1, 24, 0)).ok).toBe(false)
    expect(localToInstant(local(2028, 2, 29)).ok).toBe(true)
  })

  it('round-trips instants across a whole year in 15-minute steps', () => {
    const start = Date.UTC(2026, 0, 1)
    for (let ms = start; ms < start + 366 * 24 * HOUR; ms += 15 * MINUTE) {
      const l = instantToLocal(ms)
      const back = localToInstant(l)
      expect(back.ok).toBe(true)
      // In the repeated hour the earlier instant is chosen, so allow exactly -1 h there.
      if (back.ok && back.ms !== ms) expect(ms - back.ms).toBe(HOUR)
    }
  })

  it('a gig from Sat 27.3.2027 14.00 to Mon 29.3. 12.00 lasts 45 h (spring forward)', () => {
    const a = localToInstantOrThrow(local(2027, 3, 27, 14, 0))
    const b = localToInstantOrThrow(local(2027, 3, 29, 12, 0))
    expect(b - a).toBe(45 * HOUR)
  })

  it('calendar days are 23 h and 25 h on transition days', () => {
    const len = (y: number, m: number, d: number) => {
      const r = dayRange({ year: y, month: m, day: d })
      return r.end - r.start
    }
    expect(len(2027, 3, 28)).toBe(23 * HOUR)
    expect(len(2027, 10, 31)).toBe(25 * HOUR)
    expect(len(2026, 12, 1)).toBe(24 * HOUR)
  })

  it('adds calendar days across month and year ends', () => {
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 })
    expect(addDays({ year: 2028, month: 3, day: 1 }, -1)).toEqual({ year: 2028, month: 2, day: 29 })
  })
})

describe('Finnish formatting', () => {
  const t = localToInstantOrThrow(local(2026, 12, 1, 9, 0))

  it('formats dates, times and weeks', () => {
    expect(formatDate(t)).toBe('ti 1.12.2026')
    expect(formatShortDate(t)).toBe('ti 1.12.')
    expect(formatTime(t)).toBe('klo 9.00')
    expect(formatDateTime(t)).toBe('ti 1.12.2026 klo 9.00')
    expect(formatWeek(t)).toBe('vk 49')
  })

  it('computes ISO weeks at year boundaries', () => {
    expect(isoWeek({ year: 2026, month: 12, day: 28 })).toBe(53)
    expect(isoWeek({ year: 2027, month: 1, day: 3 })).toBe(53)
    expect(isoWeek({ year: 2027, month: 1, day: 4 })).toBe(1)
    expect(isoWeek({ year: 2026, month: 1, day: 1 })).toBe(1)
  })

  it('formats durations', () => {
    expect(formatDuration(16.5 * HOUR)).toBe('16 h 30 min')
    expect(formatDuration(15 * HOUR + 25 * MINUTE)).toBe('15 h 25 min')
    expect(formatDuration(45 * MINUTE)).toBe('45 min')
    expect(formatDuration(21 * HOUR)).toBe('21 h')
    expect(formatDuration(-10 * MINUTE)).toBe('-10 min')
  })
})

describe('parsing form values', () => {
  it('parses dates', () => {
    expect(parseDate('2026-12-01')).toEqual({ year: 2026, month: 12, day: 1 })
    expect(parseDate('2026-02-30')).toBeNull()
    expect(parseDate('1.12.2026')).toBeNull()
    expect(toIsoDate({ year: 2026, month: 3, day: 5 })).toBe('2026-03-05')
  })

  it('parses times with a colon or the Finnish dot', () => {
    expect(parseTime('9.00')).toEqual({ hour: 9, minute: 0 })
    expect(parseTime('17:30')).toEqual({ hour: 17, minute: 30 })
    expect(parseTime('24:00')).toBeNull()
    expect(parseTime('9')).toBeNull()
  })
})
