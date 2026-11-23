import { describe, expect, it } from 'vitest'
import {
  Availability,
  blockingOnSave,
  CONDITION_SRC,
  computeFreeTimeline,
  computeSegments,
  type Demand,
  type LineRef,
} from './availability'
import {
  at,
  gig,
  gigA,
  gigBInitial,
  gigBResolved,
  gigC,
  gigCUnchained,
  gigD,
  gigE,
  gigF,
  gigW,
  item,
  items,
  line,
  OWN_STUDIO_IDS,
  STUDIO,
  CLARION,
} from './__fixtures__/scenario'
import { dayRange, HOUR, MINUTE, parseDate } from './time'
import type { Gig } from './types'

const model = (gigs: Gig[], now = at('2026-11-23 12:00'), its = items) =>
  new Availability({ items: its, gigs, ownStudioLocationIds: OWN_STUDIO_IDS, now })

const ref = (m: Availability, gigId: string, lineId: string): LineRef => {
  const r = m.line(gigId, lineId)
  if (!r) throw new Error(`no line ${gigId}/${lineId}`)
  return r
}

/** Minimum free quantity per Helsinki day, Mon 30.11. – Fri 4.12. */
const xlrPerDay = (m: Availability) =>
  ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04'].map((d) =>
    m.minFree('xlr', dayRange(parseDate(d)!)),
  )

const confirmed = (g: Gig): Gig => ({ ...g, status: 'vahvistettu' })

describe('half-open intervals (rule 1)', () => {
  const d = (start: number, end: number, src: string): Demand => ({
    start,
    end,
    qty: 1,
    firm: true,
    src,
  })

  it('a booking ending at 17.00 and one starting at 17.00 do not overlap', () => {
    expect(computeSegments(1, [d(0, 17, 'x'), d(17, 20, 'y')])).toEqual([])
  })

  it('a one-minute overlap is a conflict', () => {
    const segs = computeSegments(1, [d(0, 17 * MINUTE, 'x'), d(16 * MINUTE, 20 * MINUTE, 'y')])
    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({ start: 16 * MINUTE, end: 17 * MINUTE, red: true })
  })
})

describe('severity per segment (rule 7)', () => {
  it('confirmed excess on [t1,t2) is red; tentative increasing it on [t2,t3) is also yellow', () => {
    const demands: Demand[] = [
      { start: 0, end: 30, qty: 2, firm: true, src: 'f' },
      { start: 20, end: 30, qty: 1, firm: false, src: 't' },
    ]
    const segs = computeSegments(1, demands)
    expect(segs.map((s) => [s.start, s.end, s.red, s.yellow])).toEqual([
      [0, 20, true, false],
      [20, 30, true, true],
    ])
  })

  it('srcs are sorted and unique', () => {
    const demands: Demand[] = [
      { start: 0, end: 10, qty: 1, firm: true, src: 'zeta' },
      { start: 0, end: 10, qty: 1, firm: true, src: 'alpha' },
      { start: 0, end: 10, qty: 1, firm: true, src: 'alpha' },
    ]
    expect(computeSegments(1, demands)[0]?.redSrcs).toEqual(['alpha', 'zeta'])
  })
})

describe('two gigs want KAM-01 (section 4.3, rule 9)', () => {
  it('tentative B gets a yellow warning; confirmed W sees the tentative competitor', () => {
    const m = model([gigA(), gigW(), gigBInitial()])
    const b = m.lineConflicts(ref(m, 'B', 'b1'))
    expect(b).toHaveLength(1)
    expect(b[0]).toMatchObject({
      severity: 'yellow',
      start: at('2026-12-01 08:00'),
      end: at('2026-12-01 17:00'),
      competitors: ['W'],
    })
    expect(m.lineConflicts(ref(m, 'W', 'w1'))[0]?.severity).toBe('yellow')
  })

  it('confirming B with KAM-01 is blocked: new red combination KAM-01|B,W', () => {
    const before = model([gigA(), gigW(), gigBInitial()]).redSegments()
    const after = model([gigA(), gigW(), confirmed(gigBInitial())]).redSegments()
    expect(blockingOnSave(before, after)).toContain('kam01|B,W')
  })

  it('swapping KAM-01 to KAM-04 and chaining the PTZs lets B be confirmed', () => {
    const before = model([gigA(), gigW(), gigBInitial()]).redSegments()
    const after = model([gigA(), gigW(), gigBResolved()]).redSegments()
    expect(blockingOnSave(before, after)).toEqual([])
  })

  it('KAM-03 is in service until Fri 16.00: blocks a booking ending 15.59, not one starting 16.00', () => {
    const until = (end: string) =>
      gig('G', {
        status: 'vahvistettu',
        equipStart: at('2026-12-04 10:00'),
        eventStart: at('2026-12-04 10:00'),
        eventEnd: at(end),
        equipEnd: at(end),
        lines: [line('g1', 'kam03')],
      })
    const m1 = model([until('2026-12-04 15:59')])
    expect(m1.lineConflicts(ref(m1, 'G', 'g1'))[0]).toMatchObject({
      severity: 'red',
      competitors: [CONDITION_SRC],
    })
    const after = gig('H', {
      status: 'vahvistettu',
      equipStart: at('2026-12-04 16:00'),
      eventStart: at('2026-12-04 16:00'),
      eventEnd: at('2026-12-04 18:00'),
      equipEnd: at('2026-12-04 18:00'),
      lines: [line('h1', 'kam03')],
    })
    const m2 = model([after])
    expect(m2.lineConflicts(ref(m2, 'H', 'h1'))).toEqual([])
  })

  it('first to confirm wins: the second confirmation is blocked', () => {
    const w = { ...gigW(), status: 'alustava' as const }
    const b = gigBInitial()
    const wConfirmed = model([gigA(), confirmed(w), b]).redSegments()
    const bothConfirmed = model([gigA(), confirmed(w), confirmed(b)]).redSegments()
    expect(blockingOnSave(wConfirmed, bothConfirmed)).toContain('kam01|B,W')
  })

  it('an existing red conflict does not block unrelated edits', () => {
    const red = [gigA(), gigW(), confirmed(gigBInitial())]
    const before = model(red).redSegments()
    const edited = red.map((g) => (g.id === 'B' ? { ...g, notes: 'muistiinpano' } : g))
    expect(blockingOnSave(before, model(edited).redSegments())).toEqual([])
  })
})

describe('XLR quantities after section 4.4 (A, W, B confirmed, C tentative)', () => {
  const resolved = () => [gigA(), gigW(), gigBResolved(), gigC()]

  it('all gigs included: 10, 12, 20, 28, 40 free per day', () => {
    expect(xlrPerDay(model(resolved()))).toEqual([10, 12, 20, 28, 40])
  })

  it('confirmed only: 10, 12, 32, 40, 40 free per day', () => {
    // Tentative C still takes 12 of B's XLR at Tue 17.00; only its own demand is left out.
    const firm = model(resolved())
      .demandsFor('xlr')
      .filter((d) => d.firm)
    const perDay = ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04'].map((d) =>
      Math.min(...computeFreeTimeline(40, firm, dayRange(parseDate(d)!)).map((s) => s.free)),
    )
    expect(perDay).toEqual([10, 12, 32, 40, 40])
  })

  it('without the B → C transfer, Tue 14.00–17.00 has 0 free', () => {
    const m = model([gigA(), gigW(), gigBResolved(), gigCUnchained()])
    expect(m.minFree('xlr', { start: at('2026-12-01 14:00'), end: at('2026-12-01 17:00') })).toBe(0)
  })

  it('B can see that other gigs leave at least 30 free during its booking (section 4.2)', () => {
    const m = model([gigA(), gigW(), gigBInitial()])
    const b = m.gig('B')!
    expect(m.minFree('xlr', { start: b.equipStart, end: b.equipEnd }, 'B')).toBe(30)
  })
})

describe('direct transfers (rules 3, 4, 8, 11)', () => {
  it('a chained device does not conflict with itself', () => {
    const m = model([gigA(), gigW(), gigBResolved(), gigC()])
    for (const [g, l] of [
      ['A', 'a1'],
      ['B', 'b2'],
      ['C', 'c1'],
    ] as const) {
      expect(m.lineConflicts(ref(m, g, l))).toEqual([])
    }
    expect(m.lineStart(ref(m, 'B', 'b2'))).toBe(at('2026-11-30 17:00'))
  })

  it('slack: 16 h 30 min for A → B and 15 h 25 min for B → C', () => {
    const m = model([gigA(), gigW(), gigBResolved(), gigC()])
    expect(m.slack(ref(m, 'B', 'b2'))).toMatchObject({ kind: 'ok', slack: 16.5 * HOUR })
    expect(m.slack(ref(m, 'C', 'c1'))).toMatchObject({ kind: 'ok', slack: 15 * HOUR + 25 * MINUTE })
  })

  it('"Ei ehdi": handover 9.40 + 30 min travel for an event at 10.00', () => {
    const b = gigBResolved()
    const late = {
      ...b,
      lines: b.lines.map((l) =>
        l.from ? { ...l, from: { ...l.from, handoverAt: at('2026-12-01 09:40') } } : l,
      ),
    }
    const a = { ...gigA(), equipEnd: at('2026-12-01 10:00') }
    const m = model([a, late])
    expect(m.chainCheck(ref(m, 'B', 'b2')).ok).toBe(true)
    expect(m.slack(ref(m, 'B', 'b2'))).toMatchObject({ kind: 'too-late', slack: -10 * MINUTE })
  })

  it('a partial quantity: C takes 12 of B’s 20, the other 8 stay on B until Wed 12.00', () => {
    const m = model([gigA(), gigW(), gigBResolved(), gigC()])
    expect(m.lineDemands(ref(m, 'B', 'b4'))).toEqual([
      expect.objectContaining({
        qty: 8,
        start: at('2026-11-30 14:00'),
        end: at('2026-12-02 12:00'),
      }),
      expect.objectContaining({
        qty: 12,
        start: at('2026-11-30 14:00'),
        end: at('2026-12-01 17:00'),
      }),
    ])
  })

  it('cancelling C returns B’s lines to B’s own end', () => {
    const m = model([gigA(), gigW(), gigBResolved(), { ...gigC(), status: 'peruttu' }])
    expect(m.lineDemands(ref(m, 'B', 'b2'))).toEqual([
      expect.objectContaining({ qty: 1, end: at('2026-12-02 12:00') }),
    ])
  })

  it('handover outside the source line’s booking is "ei täsmää"', () => {
    const m = model([gigA(), gigW(), gigBResolved(), gigC(at('2026-12-02 12:30'))])
    expect(m.chainCheck(ref(m, 'C', 'c1'))).toEqual({
      ok: false,
      problem: 'handover-outside-source',
    })
  })

  it('a missing source line is "ei täsmää"', () => {
    const b = gigBResolved()
    const m = model([gigA(), { ...b, lines: b.lines.filter((l) => l.id !== 'b2') }, gigC()])
    expect(m.chainCheck(ref(m, 'C', 'c1'))).toEqual({ ok: false, problem: 'source-missing' })
  })

  it('two live receivers of one source line are both "ei täsmää"; a cancelled one does not count', () => {
    const second = gig('C2', {
      equipStart: at('2026-12-01 14:00'),
      eventStart: at('2026-12-02 09:00'),
      eventEnd: at('2026-12-02 12:00'),
      equipEnd: at('2026-12-03 12:00'),
      lines: [
        line('x1', 'ptz01', {
          from: { gigId: 'B', lineId: 'b2', handoverAt: at('2026-12-01 17:00') },
        }),
      ],
    })
    const m = model([gigA(), gigBResolved(), gigC(), second])
    expect(m.chainCheck(ref(m, 'C', 'c1'))).toEqual({ ok: false, problem: 'multiple-receivers' })
    expect(m.chainCheck(ref(m, 'C2', 'x1'))).toEqual({ ok: false, problem: 'multiple-receivers' })
    const m2 = model([gigA(), gigBResolved(), gigC(), { ...second, status: 'peruttu' }])
    expect(m2.chainCheck(ref(m2, 'C', 'c1')).ok).toBe(true)
  })

  it('a receiving line whose own end is before the handover is "ei täsmää"', () => {
    const c = gigC()
    const cut = {
      ...c,
      lines: c.lines.map((l) => (l.id === 'c1' ? { ...l, end: at('2026-12-01 16:00') } : l)),
    }
    const m = model([gigA(), gigBResolved(), cut])
    expect(m.chainCheck(ref(m, 'C', 'c1'))).toEqual({
      ok: false,
      problem: 'handover-after-receiver-end',
    })
  })

  it('self-referencing and mutually referencing lines are a cycle and do not crash', () => {
    const t = {
      equipStart: at('2026-12-10 08:00'),
      eventStart: at('2026-12-10 09:00'),
      eventEnd: at('2026-12-10 16:00'),
      equipEnd: at('2026-12-10 17:00'),
    }
    const self = gig('S', {
      ...t,
      lines: [
        line('s1', 'ptz03', {
          from: { gigId: 'S', lineId: 's1', handoverAt: at('2026-12-10 10:00') },
        }),
      ],
    })
    const p = gig('P', {
      ...t,
      lines: [
        line('p1', 'kam02', {
          from: { gigId: 'Q', lineId: 'q1', handoverAt: at('2026-12-10 10:00') },
        }),
      ],
    })
    const q = gig('Q', {
      ...t,
      lines: [
        line('q1', 'kam02', {
          from: { gigId: 'P', lineId: 'p1', handoverAt: at('2026-12-10 09:30') },
        }),
      ],
    })
    const m = model([self, p, q])
    expect(m.chainCheck(ref(m, 'S', 's1'))).toEqual({ ok: false, problem: 'cycle' })
    expect(m.chainCheck(ref(m, 'P', 'p1'))).toEqual({ ok: false, problem: 'cycle' })
    expect(m.chainCheck(ref(m, 'Q', 'q1'))).toEqual({ ok: false, problem: 'cycle' })
    expect(() => m.redSegments()).not.toThrow()
  })

  it('an item mismatch or a larger quantity than the source is "ei täsmää"', () => {
    const c = gigC()
    const wrong = {
      ...c,
      lines: [{ ...c.lines[0]!, itemId: 'ptz03' }, c.lines[1]!, { ...c.lines[2]!, qty: 21 }],
    }
    const m = model([gigA(), gigBResolved(), wrong])
    expect(m.chainCheck(ref(m, 'C', 'c1'))).toEqual({ ok: false, problem: 'item-mismatch' })
    expect(m.chainCheck(ref(m, 'C', 'c3'))).toEqual({ ok: false, problem: 'qty-exceeds-source' })
  })

  it('default handover: source event end + 1 h (Mon 17.00 for A → B)', () => {
    const m = model([gigA(), gigBInitial()])
    expect(m.defaultHandover(ref(m, 'A', 'a1'), m.gig('B')!)).toBe(at('2026-11-30 17:00'))
  })

  it('transfer candidates: A’s PTZ lines are offered to B', () => {
    const m = model([gigA(), gigW(), gigBInitial()])
    expect(m.transferCandidates(ref(m, 'B', 'b2')).map((r) => r.line.id)).toEqual(['a1'])
    expect(m.transferCandidates(ref(m, 'A', 'a1'))).toEqual([])
  })

  it('a tentative gig’s transfer change that turns a confirmed gig red is blocked (rule 9)', () => {
    const h = gig('H', {
      status: 'vahvistettu',
      equipStart: at('2026-12-02 08:00'),
      eventStart: at('2026-12-02 08:30'),
      eventEnd: at('2026-12-02 09:30'),
      equipEnd: at('2026-12-02 10:00'),
      lines: [line('h1', 'xlr', { qty: 30 })],
    })
    const before = model([gigA(), gigBResolved(), gigC(), h]).redSegments()
    // C moves its handover from Tue 17.00 to Wed 11.00: B's 12 XLR stay firm longer.
    const after = model([gigA(), gigBResolved(), gigC(at('2026-12-02 11:00')), h]).redSegments()
    expect(before.some((r) => r.itemId === 'xlr')).toBe(false)
    expect(blockingOnSave(before, after)).toContain('xlr|B,H')
  })
})

describe('unreturned equipment (rule 5, section 4.5)', () => {
  const thuNine = at('2026-12-03 09:00')

  it('KAM-04 not returned from B is red for confirmed D on Thu 9.00, yellow for tentative D', () => {
    const m = model([gigA(), gigBResolved(), gigD()], thuNine)
    expect(m.lineConflicts(ref(m, 'D', 'd1'))[0]).toMatchObject({
      severity: 'red',
      competitors: ['B'],
      late: [{ gigId: 'B', lineId: 'b1', dueAt: at('2026-12-02 12:00') }],
    })
    // "myöhässä 21 h": now − dueAt
    expect(thuNine - at('2026-12-02 12:00')).toBe(21 * HOUR)
    const m2 = model([gigA(), gigBResolved(), gigD('alustava')], thuNine)
    expect(m2.lineConflicts(ref(m2, 'D', 'd1'))[0]?.severity).toBe('yellow')
  })

  it('not yet late at Wed 11.59', () => {
    const m = model([gigA(), gigBResolved(), gigD()], at('2026-12-02 11:59'))
    expect(m.lineConflicts(ref(m, 'D', 'd1'))).toEqual([])
  })

  it('tentative undeparted and own-studio gigs never keep blocking', () => {
    const tentativeB = { ...gigBResolved(), status: 'alustava' as const }
    const m = model([gigA(), tentativeB, gigD()], thuNine)
    expect(m.lineConflicts(ref(m, 'D', 'd1'))).toEqual([])
    const studioGig = gig('S', {
      status: 'vahvistettu',
      equipStart: at('2026-12-02 08:00'),
      eventStart: at('2026-12-02 09:00'),
      eventEnd: at('2026-12-02 10:00'),
      equipEnd: at('2026-12-02 11:00'),
      lines: [line('s1', 'kam04')],
    })
    const m2 = model([studioGig, gigD()], thuNine)
    expect(m2.lineConflicts(ref(m2, 'D', 'd1'))).toEqual([])
  })

  it('an early "Palautettu" frees the equipment', () => {
    const returned = { ...gigBResolved(), returnedAt: at('2026-12-02 10:00') }
    const m = model([gigA(), returned, gigD()], thuNine)
    expect(m.lineDemands(ref(m, 'B', 'b1'))[0]?.end).toBe(at('2026-12-02 10:00'))
    expect(m.lineConflicts(ref(m, 'D', 'd1'))).toEqual([])
  })

  it('awaitingReturn: external confirmed gig not returned; own studio never', () => {
    const m = model([gigA(), gigBResolved()])
    expect(m.awaitingReturn(m.gig('B')!)).toBe(true)
    expect(m.awaitingReturn(m.gig('A')!)).toBe(false)
  })
})

describe('multi-day gig with equipment leaving mid-gig (section 4.6)', () => {
  const tuesdayGig = gig('G', {
    status: 'vahvistettu',
    equipStart: at('2026-12-08 09:00'),
    eventStart: at('2026-12-08 10:00'),
    eventEnd: at('2026-12-08 14:00'),
    equipEnd: at('2026-12-08 15:00'),
    lines: [line('g1', 'ptz03')],
  })

  it('without a transfer, KAM-01 is red between Messut and Studiohaastattelu', () => {
    const m = model([gigE(), gigF(false)])
    expect(m.lineConflicts(ref(m, 'F', 'f1'))[0]).toMatchObject({
      severity: 'red',
      competitors: ['E'],
    })
  })

  it('handover Mon 18.00 in the middle of Messut is valid, slack 14 h 30 min, no conflict', () => {
    const m = model([gigE(), gigF(true)])
    expect(m.chainCheck(ref(m, 'F', 'f1')).ok).toBe(true)
    expect(m.slack(ref(m, 'F', 'f1'))).toMatchObject({ kind: 'ok', slack: 14.5 * HOUR })
    expect(m.lineConflicts(ref(m, 'F', 'f1'))).toEqual([])
    expect(m.lineDemands(ref(m, 'E', 'e1'))).toEqual([
      expect.objectContaining({
        qty: 1,
        start: at('2026-12-06 14:00'),
        end: at('2026-12-07 18:00'),
      }),
    ])
  })

  it('default handover for E → F is F’s departure (Tue 8.00), since Tue 17.00 is after F’s event', () => {
    const m = model([gigE(), gigF(false)])
    expect(m.defaultHandover(ref(m, 'E', 'e1'), m.gig('F')!)).toBe(at('2026-12-08 08:00'))
  })

  it('PTZ-03 returning early: free from Mon 19.00 once marked, red for Tuesday if not marked', () => {
    const tueNine = at('2026-12-08 09:00')
    const unmarked = model([gigE(), tuesdayGig], tueNine)
    expect(unmarked.lineConflicts(ref(unmarked, 'G', 'g1'))[0]).toMatchObject({
      severity: 'red',
      late: [{ gigId: 'E', lineId: 'e3', dueAt: at('2026-12-07 19:00') }],
    })

    const marked = {
      ...gigE(),
      lineMarks: { e3: { returnedAt: at('2026-12-07 19:30'), returnedBy: 'anna' } },
    }
    const m = model([marked, tuesdayGig], tueNine)
    expect(m.lineDemands(ref(m, 'E', 'e3'))[0]?.end).toBe(at('2026-12-07 19:00'))
    expect(m.lineConflicts(ref(m, 'G', 'g1'))).toEqual([])
  })

  it('the gig’s own "Palautettu" also covers an unmarked early line', () => {
    const returned = { ...gigE(), returnedAt: at('2026-12-09 12:00') }
    const m = model([returned, tuesdayGig], at('2026-12-09 13:00'))
    expect(m.lineDemands(ref(m, 'E', 'e3'))[0]?.end).toBe(at('2026-12-07 19:00'))
  })

  it('handover after the source line’s own end is "ei täsmää"', () => {
    const fromPtz = gig('K', {
      status: 'vahvistettu',
      equipStart: at('2026-12-08 08:00'),
      eventStart: at('2026-12-08 09:00'),
      eventEnd: at('2026-12-08 12:00'),
      equipEnd: at('2026-12-08 13:00'),
      lines: [
        line('k1', 'ptz03', {
          from: { gigId: 'E', lineId: 'e3', handoverAt: at('2026-12-07 20:00') },
        }),
      ],
    })
    const m = model([gigE(), fromPtz])
    expect(m.chainCheck(ref(m, 'K', 'k1'))).toEqual({
      ok: false,
      problem: 'handover-outside-source',
    })
  })

  it('equipment joining mid-event without "needed from" is informational, not red', () => {
    const joining = gig('J', {
      locationId: CLARION,
      status: 'vahvistettu',
      equipStart: at('2026-12-07 08:00'),
      eventStart: at('2026-12-07 09:00'),
      eventEnd: at('2026-12-08 16:00'),
      equipEnd: at('2026-12-09 12:00'),
      lines: [
        line('j1', 'kam04', {
          from: { gigId: 'D', lineId: 'd1', handoverAt: at('2026-12-07 12:00') },
        }),
      ],
    })
    const d = {
      ...gigD(),
      equipStart: at('2026-12-07 06:00'),
      eventStart: at('2026-12-07 07:00'),
      eventEnd: at('2026-12-07 11:00'),
      equipEnd: at('2026-12-07 13:00'),
    }
    const m = model([d, joining])
    expect(m.chainCheck(ref(m, 'J', 'j1')).ok).toBe(true)
    expect(m.slack(ref(m, 'J', 'j1'))).toMatchObject({ kind: 'arrives-mid-event' })
    const withNeeded = {
      ...joining,
      lines: [{ ...joining.lines[0]!, start: at('2026-12-08 07:00') }],
    }
    const m2 = model([d, withNeeded])
    expect(m2.slack(ref(m2, 'J', 'j1'))).toMatchObject({ kind: 'ok', slack: 19 * HOUR })
  })
})

describe('capacity edge cases', () => {
  it('an archived item has capacity 0, so any confirmed booking is red', () => {
    const its = [item('old', 'OLD-01', { archived: true })]
    const g = gig('G', {
      status: 'vahvistettu',
      equipStart: at('2026-12-01 08:00'),
      eventStart: at('2026-12-01 09:00'),
      eventEnd: at('2026-12-01 10:00'),
      equipEnd: at('2026-12-01 11:00'),
      lines: [line('g1', 'old')],
    })
    const m = model([g], undefined, its)
    expect(m.redKeys()).toEqual(new Set(['old|G']))
  })

  it('a cancelled gig has no demand unless it departed and was not returned', () => {
    const cancelled = { ...gigW(), status: 'peruttu' as const }
    expect(model([cancelled]).demandsFor('kam01')).toEqual([])
    const departed = { ...cancelled, locationId: STUDIO, departedAt: at('2026-12-01 08:00') }
    expect(model([departed]).demandsFor('kam01')).toHaveLength(1)
  })
  it('an archived item in service or broken creates no conflict on its own', () => {
    const its = [
      item('x', 'X-01', { archived: true, condition: 'rikki' }),
      item('y', 'Y-01', {
        archived: true,
        condition: 'huollossa',
        conditionUntil: at('2026-12-31 12:00'),
      }),
    ]
    expect(model([], undefined, its).redKeys()).toEqual(new Set())
  })
})

describe('rule 9 compares red segments, not just keys', () => {
  const t = (from: string, to: string) => ({
    status: 'vahvistettu' as const,
    equipStart: at(from),
    eventStart: at(from),
    eventEnd: at(to),
    equipEnd: at(to),
  })
  const three = () => [
    gig('P', { ...t('2026-12-10 08:00', '2026-12-10 12:00'), lines: [line('p', 'kam02')] }),
    gig('Q', { ...t('2026-12-10 09:00', '2026-12-10 13:00'), lines: [line('q', 'kam02')] }),
    gig('R', { ...t('2026-12-10 10:00', '2026-12-10 14:00'), lines: [line('r', 'kam02')] }),
  ]

  it('leaving a 3-way conflict is not blocked', () => {
    const before = model(three()).redSegments()
    const after = model(three().filter((g) => g.id !== 'P')).redSegments()
    expect(blockingOnSave(before, after)).toEqual([])
  })

  it('shortening a gig inside an existing conflict is not blocked', () => {
    const before = model(three()).redSegments()
    const shorter = three().map((g) =>
      g.id === 'R' ? { ...g, ...t('2026-12-10 10:00', '2026-12-10 11:00') } : g,
    )
    expect(blockingOnSave(before, model(shorter).redSegments())).toEqual([])
  })

  it('the same pair clashing on a new, separate day is blocked', () => {
    const p = gig('P', {
      ...t('2026-12-10 08:00', '2026-12-10 12:00'),
      lines: [line('p', 'kam02')],
    })
    const q = gig('Q', {
      ...t('2026-12-10 09:00', '2026-12-10 13:00'),
      lines: [line('q', 'kam02')],
    })
    const before = model([p, q]).redSegments()
    const qTwoDays = { ...q, ...t('2026-12-10 09:00', '2026-12-11 13:00') }
    const p2 = gig('P', {
      ...t('2026-12-10 08:00', '2026-12-11 12:00'),
      lines: [line('p', 'kam02')],
    })
    // P and Q already clash on the 10th; extending both so they also clash on the 11th
    // overlaps the old segment, so it is treated as the same conflict.
    expect(blockingOnSave(before, model([p2, qTwoDays]).redSegments())).toEqual([])
    const r = gig('R', {
      ...t('2026-12-12 08:00', '2026-12-12 12:00'),
      lines: [line('r', 'kam02')],
    })
    const s = gig('S', {
      ...t('2026-12-12 09:00', '2026-12-12 13:00'),
      lines: [line('s', 'kam02')],
    })
    expect(blockingOnSave(before, model([p, q, r, s]).redSegments())).toEqual(['kam02|R,S'])
  })
})

describe('review regressions', () => {
  const receiverAt = (id: string, from: string, to: string, extra: Partial<Gig> = {}) =>
    gig(id, {
      status: 'vahvistettu',
      equipStart: at(from),
      eventStart: at(from),
      eventEnd: at(to),
      equipEnd: at(to),
      ...extra,
    })

  it('handover at or before the source line’s start is "ei täsmää" (strict bound)', () => {
    const k = (h: string) =>
      receiverAt('K', '2026-12-08 08:00', '2026-12-08 13:00', {
        lines: [line('k1', 'ptz03', { from: { gigId: 'E', lineId: 'e3', handoverAt: at(h) } })],
      })
    for (const h of ['2026-12-06 14:00', '2026-12-06 13:00']) {
      const m = model([gigE(), k(h)])
      expect(m.chainCheck(ref(m, 'K', 'k1'))).toEqual({
        ok: false,
        problem: 'handover-outside-source',
      })
    }
    const m = model([gigE(), k('2026-12-06 14:01')])
    expect(m.chainCheck(ref(m, 'K', 'k1')).ok).toBe(true)
  })

  it('default handover falls back to the source line’s end, or is undefined when nothing fits', () => {
    const thursday = receiverAt('T', '2026-12-10 08:00', '2026-12-10 16:00')
    const m = model([gigE(), thursday])
    // Messut + 1 h (Tue 17.00) is after PTZ-03's own end; Mon 19.00 (line end) fits.
    expect(m.defaultHandover(ref(m, 'E', 'e3'), thursday)).toBe(at('2026-12-07 19:00'))
    const saturday = receiverAt('U', '2026-12-05 08:00', '2026-12-05 16:00')
    const m2 = model([gigE(), saturday])
    expect(m2.defaultHandover(ref(m2, 'E', 'e1'), saturday)).toBeUndefined()
  })

  it('transfer candidates do not depend on object identity of the ref', () => {
    const m = model([gigA(), gigBResolved()])
    const r = ref(m, 'B', 'b2')
    const copy = { gig: { ...r.gig }, line: { ...r.line } }
    expect(m.transferCandidates(copy).map((x) => x.line.id)).toEqual(['a1'])
  })

  it('a receiving line keeps its booking ("needed from") if the source gig is cancelled', () => {
    const f = gigF(true)
    const withNeeded = { ...f, lines: [{ ...f.lines[0]!, start: at('2026-12-08 08:30') }] }
    const m = model([{ ...gigE(), status: 'peruttu' }, withNeeded])
    expect(m.chainCheck(ref(m, 'F', 'f1'))).toEqual({ ok: false, problem: 'gig-not-live' })
    expect(m.lineDemands(ref(m, 'F', 'f1'))).toEqual([
      expect.objectContaining({ start: at('2026-12-08 08:30'), end: at('2026-12-08 13:00') }),
    ])
  })

  it('shared results are read-only snapshots and stay stable', () => {
    const m = model([gigA(), gigW(), gigBInitial()])
    const first = m.segments('kam01')
    expect(m.segments('kam01')).toBe(first)
    expect(first.toSorted((a, b) => b.start - a.start)).not.toBe(first)
  })
})
