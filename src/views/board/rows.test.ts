import { describe, expect, it } from 'vitest'
import { Availability } from '../../core/availability'
import {
  at,
  gigA,
  gigBResolved,
  gigC,
  gigD,
  gigW,
  item,
  items,
  OWN_STUDIO_IDS,
} from '../../core/__fixtures__/scenario'
import type { Gig, Item } from '../../core/types'
import { boardDays } from './layout'
import { periodStart, periodWeeks, periodWindow, shiftPeriod } from './period'
import {
  barText,
  categories,
  conditionText,
  normalize,
  rangeText,
  rowCache,
  rowLayout,
  visibleItems,
} from './rows'

const days = boardDays({ year: 2026, month: 11, day: 30 }, 7)
const names: Record<string, string> = {
  A: 'Lanseeraus',
  W: 'Webinaari X',
  B: 'Hybridiseminaari',
  C: 'Asiakastilaisuus',
  D: 'Tuotevideo',
}
const gigName = (id: string) => names[id] ?? id

function model(gigs: Gig[], now = at('2026-11-30 08:00')) {
  return new Availability({ items, gigs, ownStudioLocationIds: OWN_STUDIO_IDS, now })
}

const itemById = (id: string): Item => items.find((i) => i.id === id)!

describe('rowLayout with the plan example after section 4.4', () => {
  const av = model([gigA(), gigW(), gigBResolved(), gigC()])

  it('chains PTZ-01 through Lanseeraus, Hybridiseminaari and Asiakastilaisuus', () => {
    const row = rowLayout(itemById('ptz01'), days, av, gigName)
    if (row.kind !== 'device') throw new Error('device expected')
    expect(row.bars.map((b) => [b.label, b.kind, b.transferIn, b.lane])).toEqual([
      ['Lanseeraus', 'confirmed', false, 0],
      ['Hybridiseminaari', 'confirmed', true, 0],
      ['Asiakastilaisuus', 'tentative', true, 0],
    ])
    expect(row.marks).toEqual([])
    expect(row.lanes).toBe(1)
  })

  it('shows KAM-03 as in service until Friday', () => {
    const row = rowLayout(itemById('kam03'), days, av, gigName)
    if (row.kind !== 'device') throw new Error('device expected')
    expect(row.bars).toHaveLength(1)
    expect(row.bars[0]).toMatchObject({
      kind: 'condition',
      label: 'Huollossa, takaisin pe 4.12. klo 16.00',
      startCol: 0,
      clippedStart: true,
    })
    expect(row.bars[0]?.endCol).toBeCloseTo(4 + 16 / 24)
  })

  it('gives the cable row the minimum free quantity per day (wireframe 3.3)', () => {
    const row = rowLayout(itemById('xlr'), days, av, gigName)
    if (row.kind !== 'quantity') throw new Error('quantity expected')
    expect(row.cells.map((c) => c.free)).toEqual([10, 12, 20, 28, 40, 40, 40])
    expect(row.cells.every((c) => c.capacity === 40 && c.severity === undefined)).toBe(true)
  })
})

describe('rowLayout conflicts', () => {
  it('marks a red overlap and a late, unreturned booking (section 4.5)', () => {
    const av = model([gigBResolved(), gigD()], at('2026-12-03 09:00'))
    const row = rowLayout(itemById('kam04'), days, av, gigName)
    if (row.kind !== 'device') throw new Error('device expected')
    expect(row.bars.map((b) => [b.label, b.kind])).toEqual([
      ['Hybridiseminaari', 'confirmed'],
      ['Hybridiseminaari', 'late'],
      ['Tuotevideo', 'confirmed'],
    ])
    expect(row.bars.find((b) => b.kind === 'late')).toMatchObject({ clippedEnd: true, lane: 0 })
    expect(row.lanes).toBe(2)
    expect(row.marks).toEqual([
      expect.objectContaining({
        severity: 'red',
        start: at('2026-12-03 08:00'),
        end: at('2026-12-03 17:00'),
      }),
    ])
  })

  it('reports a yellow warning on a quantity day when a tentative gig overbooks', () => {
    const big = gigC()
    big.lines = [{ id: 'c9', itemId: 'xlr', qty: 40 }]
    const av = model([gigA(), big])
    const row = rowLayout(itemById('xlr'), days, av, gigName)
    if (row.kind !== 'quantity') throw new Error('quantity expected')
    expect(row.cells[1]).toEqual({ free: 0, capacity: 40, severity: undefined })
    const av2 = model([gigW(), big])
    const row2 = rowLayout(itemById('xlr'), days, av2, gigName)
    if (row2.kind !== 'quantity') throw new Error('quantity expected')
    expect(row2.cells[1]).toEqual({ free: -8, capacity: 40, severity: 'yellow' })
  })
})

describe('rowCache', () => {
  it('computes each row once per snapshot and stays fast for 200 items × 14 days', () => {
    const many = Array.from({ length: 200 }, (_, i) => item(`i${i}`, `KAM-${i}`))
    const gigs = Array.from({ length: 300 }, (_, i) => ({
      ...gigA(),
      id: `g${i}`,
      lines: [{ id: 'l', itemId: `i${i % 200}`, qty: 1 }],
    }))
    const av = new Availability({ items: many, gigs, ownStudioLocationIds: OWN_STUDIO_IDS, now: 0 })
    const rowOf = rowCache(boardDays({ year: 2026, month: 11, day: 30 }, 14), av, gigName)
    const t0 = performance.now()
    const rows = many.map(rowOf)
    expect(performance.now() - t0).toBeLessThan(500)
    expect(rowOf(many[0]!)).toBe(rows[0])
  })
})

describe('texts', () => {
  it('formats bars and ranges', () => {
    expect(barText({ kind: 'tentative', label: 'B', transferIn: true })).toBe('> alust. B')
    expect(barText({ kind: 'late', label: 'B', transferIn: false })).toBe('Palauttamatta: B')
    expect(rangeText(-Infinity, Infinity)).toBe('– toistaiseksi')
    expect(rangeText(at('2026-11-30 14:00'), at('2026-12-02 12:00'))).toBe(
      'ma 30.11. klo 14.00 – ke 2.12. klo 12.00',
    )
  })
})

describe('filtering and sorting', () => {
  const list = [
    item('k10', 'KAM-10', { category: 'Kamerat', name: 'Sony FX6' }),
    item('k2', 'KAM-2', { category: 'Kamerat', name: 'Sony FX6' }),
    item('l1', 'VAL-01', { category: 'Valot', name: 'Läpivalo' }),
    item('old', 'KAM-99', { category: 'Kamerat', archived: true }),
  ]

  it('hides archived items and sorts by category and tag', () => {
    expect(visibleItems(list, { category: '', query: '' }).map((i) => i.tag)).toEqual([
      'KAM-2',
      'KAM-10',
      'VAL-01',
    ])
  })

  it('filters by category and by tag or name, ignoring case, dashes and diacritics', () => {
    expect(visibleItems(list, { category: 'Valot', query: '' }).map((i) => i.id)).toEqual(['l1'])
    expect(visibleItems(list, { category: '', query: 'lapi' }).map((i) => i.id)).toEqual(['l1'])
    expect(visibleItems(list, { category: '', query: 'kam10' }).map((i) => i.id)).toEqual(['k10'])
    expect(visibleItems(list, { category: '', query: 'fx6' })).toHaveLength(2)
    expect(normalize('  Äänipöytä ')).toBe('aanipoyta')
  })

  it('lists categories of non-archived items', () => {
    expect(categories([...list, item('x', 'X', { category: 'Arkisto', archived: true })])).toEqual([
      'Kamerat',
      'Valot',
    ])
  })

  it('describes conditions', () => {
    expect(conditionText(item('a', 'A'))).toBe('')
    expect(conditionText(item('a', 'A', { condition: 'rikki' }))).toBe('Rikki')
  })
})

describe('period', () => {
  it('starts on the Monday of the requested or current week', () => {
    expect(periodStart('2026-12-03', 0)).toBe('2026-11-30')
    expect(periodStart(null, at('2026-11-26 12:00'))).toBe('2026-11-23')
    expect(periodStart('roska', at('2026-11-26 12:00'))).toBe('2026-11-23')
    // Sunday 23.30 in Helsinki is still Sunday, although it is Monday nowhere else yet.
    expect(periodStart(null, at('2026-11-29 23:30'))).toBe('2026-11-23')
  })

  it('builds the window from an ISO date', () => {
    const w = periodWindow('2027-03-24', 14)
    expect(w).toHaveLength(14)
    expect(w[0]?.start).toBe(at('2027-03-22 00:00'))
    expect(() => periodWindow('x', 7)).toThrow(RangeError)
  })

  it('moves by whole periods and reports week numbers', () => {
    expect(shiftPeriod('2026-11-30', 14, 1)).toBe('2026-12-14')
    expect(shiftPeriod('2026-11-30', 7, -1)).toBe('2026-11-23')
    expect(periodWeeks(periodWindow('2026-11-30', 7))).toEqual({ from: 49, to: 49 })
    expect(periodWeeks(periodWindow('2026-11-30', 14))).toEqual({ from: 49, to: 50 })
    expect(periodWeeks(periodWindow('2026-12-28', 14))).toEqual({ from: 53, to: 1 })
    expect(periodWeeks([])).toEqual({ from: 0, to: 0 })
  })
})
