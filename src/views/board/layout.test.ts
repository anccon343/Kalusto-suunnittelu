import { describe, expect, it } from 'vitest'
import { CONDITION_SRC, type Demand, type Segment } from '../../core/availability'
import { at } from '../../core/__fixtures__/scenario'
import { HOUR } from '../../core/time'
import {
  boardDays,
  columnAt,
  conflictMarks,
  daySeverity,
  demandsToBarInputs,
  layoutBars,
  mondayOf,
  type BarInput,
} from './layout'

const week = (y: number, m: number, d: number) => boardDays({ year: y, month: m, day: d }, 7)

const input = (start: string, end: string, extra: Partial<BarInput> = {}): BarInput => ({
  start: at(start),
  end: at(end),
  kind: 'confirmed',
  label: 'X',
  src: 'X',
  transferIn: false,
  ...extra,
})

const segment = (start: string, end: string, red: boolean, yellow: boolean): Segment => ({
  start: at(start),
  end: at(end),
  red,
  yellow,
  free: -1,
  redSrcs: [],
  allSrcs: [],
  late: [],
})

describe('boardDays and mondayOf', () => {
  it('starts weeks on Monday', () => {
    expect(mondayOf({ year: 2026, month: 12, day: 3 })).toEqual({ year: 2026, month: 11, day: 30 })
    expect(mondayOf({ year: 2026, month: 11, day: 30 })).toEqual({
      year: 2026,
      month: 11,
      day: 30,
    })
    expect(mondayOf({ year: 2027, month: 3, day: 28 })).toEqual({ year: 2027, month: 3, day: 22 })
  })

  it('uses Helsinki calendar days, including the 23-hour spring-forward day', () => {
    const days = week(2027, 3, 22)
    expect(days.map((d) => (d.end - d.start) / HOUR)).toEqual([24, 24, 24, 24, 24, 24, 23])
    expect(days[0]?.start).toBe(at('2027-03-22 00:00'))
    for (let i = 1; i < days.length; i++) expect(days[i]?.start).toBe(days[i - 1]?.end)
  })

  it('has a 25-hour day in the fall-back week', () => {
    const days = week(2027, 10, 25)
    expect(days.at(-1)?.end).toBe(at('2027-11-01 00:00'))
    expect((days.at(-1)!.end - days.at(-1)!.start) / HOUR).toBe(25)
  })
})

describe('columnAt', () => {
  const days = week(2027, 3, 22)

  it('maps an instant to a fractional day column', () => {
    expect(columnAt(at('2027-03-22 00:00'), days)).toBe(0)
    expect(columnAt(at('2027-03-23 12:00'), days)).toBe(1.5)
  })

  it('measures the short DST day in its own hours', () => {
    // Sunday 28.3.2027 has 23 hours; 12.00 local time is 11 hours after midnight.
    expect(columnAt(at('2027-03-28 12:00'), days)).toBeCloseTo(6 + 11 / 23)
    expect(columnAt(at('2027-03-29 00:00'), days)).toBe(7)
  })

  it('clamps to the window', () => {
    expect(columnAt(at('2027-03-01 10:00'), days)).toBe(0)
    expect(columnAt(at('2027-04-10 10:00'), days)).toBe(7)
    expect(columnAt(-Infinity, days)).toBe(0)
    expect(columnAt(Infinity, days)).toBe(7)
    expect(columnAt(0, [])).toBe(0)
  })
})

describe('layoutBars', () => {
  const days = week(2026, 11, 30)

  it('clips bookings that start before and end after the window', () => {
    const [bar] = layoutBars([input('2026-11-20 10:00', '2026-12-20 10:00')], days)
    expect(bar).toMatchObject({ startCol: 0, endCol: 7, clippedStart: true, clippedEnd: true })
  })

  it('handles open-ended intervals (condition until further notice)', () => {
    const [bar] = layoutBars(
      [{ ...input('2026-11-30 10:00', '2026-11-30 11:00'), start: -Infinity, end: Infinity }],
      days,
    )
    expect(bar).toMatchObject({ startCol: 0, endCol: 7, clippedStart: true, clippedEnd: true })
  })

  it('drops intervals outside the window, including ones that only touch it', () => {
    const bars = layoutBars(
      [
        input('2026-11-20 10:00', '2026-11-30 00:00'),
        input('2026-12-07 00:00', '2026-12-08 00:00'),
      ],
      days,
    )
    expect(bars).toEqual([])
  })

  it('places a booking by its Helsinki hours', () => {
    const [bar] = layoutBars([input('2026-12-01 06:00', '2026-12-02 18:00')], days)
    expect(bar?.startCol).toBeCloseTo(1.25)
    expect(bar?.endCol).toBeCloseTo(2.75)
    expect(bar).toMatchObject({ clippedStart: false, clippedEnd: false })
  })

  it('puts overlapping bars on separate lanes and touching bars on the same lane', () => {
    const bars = layoutBars(
      [
        input('2026-11-30 17:00', '2026-12-02 12:00', { src: 'B' }),
        input('2026-11-30 11:00', '2026-11-30 17:00', { src: 'A' }),
        input('2026-12-01 08:00', '2026-12-01 17:00', { src: 'W' }),
      ],
      days,
    )
    expect(bars.map((b) => [b.src, b.lane])).toEqual([
      ['A', 0],
      ['B', 0],
      ['W', 1],
    ])
  })

  it('returns nothing without days', () => {
    expect(layoutBars([input('2026-11-30 10:00', '2026-11-30 11:00')], [])).toEqual([])
  })
})

describe('demandsToBarInputs', () => {
  const ctx = {
    gigName: (id: string) => `Keikka ${id}`,
    conditionLabel: 'Huollossa',
    isTransferIn: (gigId: string, lineId: string) => gigId === 'B' && lineId === 'b2',
  }
  const demand = (extra: Partial<Demand> & Pick<Demand, 'src'>): Demand => ({
    start: at('2026-11-30 14:00'),
    end: at('2026-12-02 12:00'),
    qty: 1,
    firm: false,
    ...extra,
  })

  it('maps firm, tentative and condition demands', () => {
    const out = demandsToBarInputs(
      [
        demand({ src: 'A', firm: true, lineId: 'a1' }),
        demand({ src: 'B', lineId: 'b2' }),
        demand({ src: CONDITION_SRC, firm: true, start: -Infinity }),
      ],
      ctx,
    )
    expect(out.map((b) => [b.kind, b.label, b.transferIn])).toEqual([
      ['confirmed', 'Keikka A', false],
      ['tentative', 'Keikka B', true],
      ['condition', 'Huollossa', false],
    ])
  })

  it('splits an unreturned booking into its planned part and a late part', () => {
    const due = at('2026-12-02 12:00')
    const out = demandsToBarInputs(
      [demand({ src: 'B', firm: true, lineId: 'b1', end: Infinity, dueAt: due })],
      ctx,
    )
    expect(out).toEqual([
      expect.objectContaining({ kind: 'confirmed', end: due }),
      expect.objectContaining({ kind: 'late', start: due, end: Infinity, label: 'Keikka B' }),
    ])
  })
})

describe('conflictMarks and daySeverity', () => {
  const days = week(2026, 11, 30)

  it('merges touching segments of equal severity and keeps others apart', () => {
    const marks = conflictMarks(
      [
        segment('2026-11-29 10:00', '2026-11-29 12:00', true, false), // before the window
        segment('2026-12-01 08:00', '2026-12-01 12:00', true, false),
        segment('2026-12-01 12:00', '2026-12-01 17:00', true, true),
        segment('2026-12-01 17:00', '2026-12-02 12:00', false, true),
      ],
      days,
    )
    expect(marks.map((m) => [m.severity, m.start, m.end])).toEqual([
      ['red', at('2026-12-01 08:00'), at('2026-12-01 17:00')],
      ['yellow', at('2026-12-01 17:00'), at('2026-12-02 12:00')],
    ])
    expect(marks[0]?.endCol).toBeCloseTo(1 + 17 / 24)
  })

  it('reports the worst conflict of a day', () => {
    const segs = [
      segment('2026-12-01 08:00', '2026-12-01 12:00', false, true),
      segment('2026-12-02 08:00', '2026-12-02 12:00', true, false),
    ]
    const [mon, tue, wed] = days
    expect(daySeverity(segs, mon!)).toBeUndefined()
    expect(daySeverity(segs, tue!)).toBe('yellow')
    expect(daySeverity(segs, wed!)).toBe('red')
  })
})
