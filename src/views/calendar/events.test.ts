import { describe, expect, it } from 'vitest'
import { Availability } from '../../core/availability'
import {
  at,
  gig,
  gigA,
  gigBInitial,
  gigD,
  gigE,
  gigF,
  gigW,
  items,
  OWN_STUDIO_IDS,
} from '../../core/__fixtures__/scenario'
import type { Gig } from '../../core/types'
import {
  calendarEntries,
  dayPart,
  entryLabel,
  entryOf,
  formatEventRange,
  gigConflict,
  isoDateOf,
  listTimeText,
  newGigPath,
  toEventInputs,
} from './events'

const model = (gigs: Gig[]) =>
  new Availability({
    items,
    gigs,
    ownStudioLocationIds: OWN_STUDIO_IDS,
    now: at('2026-11-30 09:00'),
  })

const cancelled = (): Gig => ({ ...gigD(), id: 'X', name: 'Peruttu', status: 'peruttu' })

describe('gigConflict', () => {
  it('is yellow when a tentative gig competes with confirmed ones (section 4.3)', () => {
    const av = model([gigA(), gigW(), gigBInitial()])
    expect(gigConflict(av, gigBInitial())).toBe('yellow')
    expect(gigConflict(av, gigW())).toBe('yellow')
    expect(gigConflict(av, gigA())).toBe('yellow')
  })

  it('is red when confirmed gigs overlap (section 4.6 without a transfer)', () => {
    const av = model([gigE(), gigF(false)])
    expect(gigConflict(av, gigE())).toBe('red')
    expect(gigConflict(av, gigF(false))).toBe('red')
  })

  it('prefers red over yellow on the same gig', () => {
    const tentative = gig('T', {
      name: 'Alustava',
      equipStart: at('2026-12-07 08:00'),
      eventStart: at('2026-12-07 09:00'),
      eventEnd: at('2026-12-07 12:00'),
      equipEnd: at('2026-12-07 13:00'),
      lines: [{ id: 't1', itemId: 'kam02', qty: 1 }],
    })
    const av = model([gigE(), gigF(false), tentative])
    expect(gigConflict(av, tentative)).toBe('yellow')
    expect(gigConflict(av, gigE())).toBe('red')
  })

  it('is undefined when nothing competes', () => {
    expect(gigConflict(model([gigD()]), gigD())).toBeUndefined()
    expect(gigConflict(model([]), { ...gigD(), lines: [] })).toBeUndefined()
  })

  it('does not fail for a gig the model does not know yet', () => {
    expect(gigConflict(model([gigW()]), gigBInitial())).toBeUndefined()
  })
})

describe('calendarEntries', () => {
  const gigs = [gigBInitial(), gigA(), cancelled(), gigW()]

  it('leaves out cancelled gigs by default and sorts by start', () => {
    const entries = calendarEntries(gigs, model(gigs), { showCancelled: false })
    expect(entries.map((e) => e.gigId)).toEqual(['A', 'W', 'B'])
  })

  it('includes cancelled gigs when asked', () => {
    const entries = calendarEntries(gigs, model(gigs), { showCancelled: true })
    expect(entries.map((e) => [e.gigId, e.status])).toContainEqual(['X', 'peruttu'])
  })

  it('spans the event time, not the equipment period', () => {
    const [b] = calendarEntries([gigBInitial()], model([gigBInitial()]), { showCancelled: false })
    expect(b).toMatchObject({
      gigId: 'B',
      title: 'Hybridiseminaari',
      status: 'alustava',
      start: at('2026-12-01 10:00'),
      end: at('2026-12-01 16:00'),
      conflict: undefined,
      label: 'Hybridiseminaari, Alustava, ti 1.12.2026 klo 10.00–16.00',
    })
  })

  it('names the conflict in the label', () => {
    const entries = calendarEntries([gigE(), gigF(false)], model([gigE(), gigF(false)]), {
      showCancelled: false,
    })
    expect(entries.map((e) => e.label)).toEqual([
      'Messut, Vahvistettu, ma 7.12.2026 klo 9.00 – ti 8.12.2026 klo 16.00, päällekkäisyys',
      'Studiohaastattelu, Vahvistettu, ti 8.12.2026 klo 9.00–12.00, päällekkäisyys',
    ])
  })
})

describe('Helsinki times', () => {
  it('formats in Helsinki time in winter and summer', () => {
    expect(formatEventRange(at('2026-12-01 10:00'), at('2026-12-01 16:00'))).toBe(
      'ti 1.12.2026 klo 10.00–16.00',
    )
    expect(formatEventRange(at('2026-07-01 09:30'), at('2026-07-01 12:00'))).toBe(
      'ke 1.7.2026 klo 9.30–12.00',
    )
  })

  it('keeps an event ending at midnight on its start day', () => {
    expect(formatEventRange(at('2026-12-04 20:00'), at('2026-12-05 00:00'))).toBe(
      'pe 4.12.2026 klo 20.00–0.00',
    )
  })

  it('labels a valmis gig with a warning', () => {
    expect(
      entryLabel({
        title: 'Tuotevideo',
        status: 'valmis',
        start: at('2026-12-03 09:00'),
        end: at('2026-12-03 16:00'),
        conflict: 'yellow',
      }),
    ).toBe('Tuotevideo, Valmis, to 3.12.2026 klo 9.00–16.00, varoitus')
  })
})

describe('toEventInputs', () => {
  it('passes instants as UTC and keeps the entry for click handling', () => {
    const entries = calendarEntries([gigBInitial()], model([gigBInitial()]), {
      showCancelled: false,
    })
    const [input] = toEventInputs(entries)
    expect(input).toMatchObject({
      id: 'B',
      title: 'Hybridiseminaari',
      start: '2026-12-01T08:00:00.000Z',
      end: '2026-12-01T14:00:00.000Z',
    })
    expect(entryOf(input?.extendedProps ?? {})).toBe(entries[0])
  })

  it('ignores foreign extended props', () => {
    expect(entryOf({})).toBeUndefined()
    expect(entryOf({ entry: 'x' })).toBeUndefined()
  })
})

describe('day clicks', () => {
  it('reads the date from FullCalendar date strings', () => {
    expect(isoDateOf('2026-12-01')).toBe('2026-12-01')
    expect(isoDateOf('2026-12-01T10:00:00+02:00')).toBe('2026-12-01')
    expect(isoDateOf('2026-02-30')).toBeNull()
    expect(isoDateOf('')).toBeNull()
  })

  it('leads to a new gig on that day', () => {
    expect(newGigPath('2026-12-01')).toBe('/keikat/uusi?paiva=2026-12-01')
  })
})

describe('list rows of multi-day events', () => {
  const e = { start: at('2026-12-07 09:00'), end: at('2026-12-08 16:00') }

  it('names the part of the event shown on each day', () => {
    expect(dayPart(true, true)).toBe('whole')
    expect(dayPart(true, false)).toBe('first')
    expect(dayPart(false, false)).toBe('middle')
    expect(dayPart(false, true)).toBe('last')
  })

  it('shows start, continuation and end in Helsinki time', () => {
    expect(listTimeText(e, 'whole')).toBe('9.00–16.00')
    expect(listTimeText(e, 'first')).toBe('alkaa klo 9.00')
    expect(listTimeText(e, 'middle')).toBe('jatkuu')
    expect(listTimeText(e, 'last')).toBe('päättyy klo 16.00')
  })
})
