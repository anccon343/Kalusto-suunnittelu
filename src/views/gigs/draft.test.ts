import { describe, expect, it } from 'vitest'
import { Availability } from '../../core/availability'
import {
  at,
  gigA,
  gigBInitial,
  gigD,
  gigW,
  items,
  locations,
  OWN_STUDIO_IDS,
} from '../../core/__fixtures__/scenario'
import type { Gig } from '../../core/types'
import {
  conflictCounts,
  draftModel,
  formatSpan,
  freeHint,
  lineConflictViews,
  saveBlockers,
  swapCandidates,
} from './draft'

const now = at('2026-11-30 10:00')

function setup(gigs: Gig[], when = now) {
  const input = { items, gigs, locations, now: when }
  const current = new Availability({ items, gigs, ownStudioLocationIds: OWN_STUDIO_IDS, now: when })
  return { input, current }
}

const withB = (patch: Partial<Gig>): Gig => ({ ...gigBInitial(), ...patch })

describe('saveBlockers (rule 9)', () => {
  it('blocks confirming B because W already holds KAM-01 and A the PTZs', () => {
    const { input, current } = setup([gigA(), gigW(), gigBInitial()])
    const confirmed = withB({ status: 'vahvistettu' })
    const blockers = saveBlockers(current, draftModel(input, confirmed), confirmed)
    expect(blockers.map((b) => b.text)).toEqual([
      'KAM-01: Hybridiseminaari, Webinaari X',
      'PTZ-01: Lanseeraus, Hybridiseminaari',
      'PTZ-02: Lanseeraus, Hybridiseminaari',
    ])
  })

  it('lets a tentative gig save despite yellow warnings', () => {
    const { input, current } = setup([gigA(), gigW(), gigBInitial()])
    const edited = withB({ notes: 'Uusi muistiinpano' })
    expect(saveBlockers(current, draftModel(input, edited), edited)).toEqual([])
  })

  it('allows confirming B once KAM-04 replaces KAM-01 and the PTZs are gone', () => {
    const { input, current } = setup([gigA(), gigW(), gigBInitial()])
    const b = gigBInitial()
    const fixed = withB({
      status: 'vahvistettu',
      lines: [{ ...b.lines[0]!, itemId: 'kam04' }, b.lines[3]!],
    })
    expect(saveBlockers(current, draftModel(input, fixed), fixed)).toEqual([])
  })

  it('names the condition for an item in service and a new gig by its draft name', () => {
    const { input, current } = setup([])
    const draft: Gig = {
      ...gigW(),
      id: '#uusi',
      name: 'Uusi keikka',
      lines: [{ id: 'x', itemId: 'kam03', qty: 1 }],
    }
    expect(saveBlockers(current, draftModel(input, draft), draft).map((b) => b.text)).toEqual([
      'KAM-03: huollossa pe 4.12. klo 16.00 asti, Uusi keikka',
    ])
  })

  it('never blocks a cancellation (rule 10)', () => {
    const { input, current } = setup([gigW()])
    const cancelled: Gig = { ...gigW(), status: 'peruttu' }
    expect(saveBlockers(current, draftModel(input, cancelled), cancelled)).toEqual([])
  })
})

describe('line conflicts', () => {
  it('shows a yellow warning on tentative B for KAM-01 with the competitor and span', () => {
    const { input } = setup([gigA(), gigW()])
    const b = gigBInitial()
    const model = draftModel(input, b)
    expect(lineConflictViews(model, b, b.lines[0]!)).toEqual([
      {
        severity: 'yellow',
        label: 'Varoitus',
        who: 'myös Webinaari X',
        span: 'ti 1.12. klo 8.00–17.00',
      },
    ])
    expect(conflictCounts(model, b)).toEqual({ red: 0, yellow: 3 })
  })

  it('shows unreturned equipment as red with how late it is', () => {
    const b: Gig = {
      ...gigBInitial(),
      status: 'vahvistettu',
      departedAt: at('2026-11-30 14:10'),
      lines: [{ id: 'b1', itemId: 'kam04', qty: 1 }],
    }
    const d = gigD('vahvistettu')
    const { input } = setup([b], at('2026-12-03 09:00'))
    const model = draftModel(input, d)
    const [view] = lineConflictViews(model, d, d.lines[0]!)
    expect(view?.severity).toBe('red')
    expect(view?.label).toBe('Päällekkäin')
    expect(view?.who).toBe('ei palautettu keikalta Hybridiseminaari (myöhässä 21 h)')
  })
})

describe('free hints and swapping', () => {
  it('shows free quantities for the equipment period, excluding the gig itself', () => {
    const { input } = setup([gigA(), gigW()])
    const b = gigBInitial()
    const model = draftModel(input, b)
    const window = { start: b.equipStart, end: b.equipEnd }
    const xlr = items.find((i) => i.id === 'xlr')!
    expect(freeHint(model, xlr, window, b.id).text).toBe('vapaana 30/40')
    expect(
      freeHint(
        model,
        items.find((i) => i.id === 'kam01')!,
        window,
        b.id,
      ).text,
    ).toBe('varattu')
    expect(
      freeHint(
        model,
        items.find((i) => i.id === 'kam04')!,
        window,
        b.id,
      ).text,
    ).toBe('vapaa')
  })

  it('suggests KAM-04 for KAM-01 (KAM-02 is on W, KAM-03 in service)', () => {
    const { input } = setup([gigA(), gigW()])
    const b = gigBInitial()
    const model = draftModel(input, b)
    expect(swapCandidates(model, items, b, b.lines[0]!).map((i) => i.tag)).toEqual(['KAM-04'])
  })

  it('falls back to the same category when no same-named device is free', () => {
    const { input } = setup([gigA()])
    const b = gigBInitial()
    const model = draftModel(input, b)
    // PTZ-03 shares the name pattern only with itself; same category "Testi" lists the free FX6s.
    const tags = swapCandidates(model, items, b, b.lines[1]!).map((i) => i.tag)
    expect(tags).toContain('PTZ-03')
  })
})

describe('formatSpan', () => {
  it('formats same-day, multi-day and open-ended spans', () => {
    expect(formatSpan(at('2026-12-01 08:00'), at('2026-12-01 17:00'))).toBe(
      'ti 1.12. klo 8.00–17.00',
    )
    expect(formatSpan(at('2026-11-30 14:00'), at('2026-12-02 12:00'))).toBe(
      'ma 30.11. klo 14.00 – ke 2.12. klo 12.00',
    )
    expect(formatSpan(at('2026-12-02 12:00'), Infinity)).toBe('ke 2.12. klo 12.00 alkaen')
  })
})
