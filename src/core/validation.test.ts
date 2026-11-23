import { describe, expect, it } from 'vitest'
import { at, gig, gigE, gigF, item, line } from './__fixtures__/scenario'
import { validateGig, validateLine } from './validation'

const base = gig('G', {
  equipStart: at('2026-12-01 08:00'),
  eventStart: at('2026-12-01 09:00'),
  eventEnd: at('2026-12-01 16:00'),
  equipEnd: at('2026-12-01 17:00'),
})

describe('gig validation', () => {
  it('accepts ordered times and rejects out-of-order ones', () => {
    expect(validateGig(base)).toEqual([])
    expect(validateGig({ ...base, eventStart: at('2026-12-01 07:00') })).toEqual([
      'times-out-of-order',
    ])
    expect(validateGig({ ...base, eventEnd: base.eventStart })).toEqual(['times-out-of-order'])
  })

  it('rejects the same item twice on one gig', () => {
    expect(validateGig({ ...base, lines: [line('1', 'x'), line('2', 'x')] })).toEqual([
      'duplicate-item',
    ])
  })
})

describe('line validation', () => {
  const cam = item('cam', 'KAM-01')
  const cables = item('xlr', 'XLR10', { quantity: 40 })

  it('checks quantities', () => {
    expect(validateLine(base, line('1', 'cam'), cam)).toEqual([])
    expect(validateLine(base, line('1', 'cam', { qty: 2 }), cam)).toEqual(['unit-qty-not-one'])
    expect(validateLine(base, line('1', 'xlr', { qty: 41 }), cables)).toEqual(['qty-exceeds-item'])
    expect(validateLine(base, line('1', 'xlr', { qty: 0 }), cables)).toEqual([
      'qty-not-positive-integer',
    ])
    expect(validateLine(base, line('1', 'xlr', { qty: 1.5 }), cables)).toEqual([
      'qty-not-positive-integer',
    ])
    expect(validateLine(base, line('1', 'gone'), undefined)).toEqual(['item-missing'])
    expect(validateLine(base, line('1', 'cam'), { ...cam, archived: true })).toEqual([
      'item-archived',
    ])
  })

  it('keeps own times inside the equipment period (rule 12)', () => {
    const inside = line('1', 'cam', { end: at('2026-12-01 12:00') })
    expect(validateLine(base, inside, cam)).toEqual([])
    const outside = line('1', 'cam', { end: at('2026-12-01 18:00') })
    expect(validateLine(base, outside, cam)).toEqual(['own-time-out-of-range'])
    const reversed = line('1', 'cam', {
      start: at('2026-12-01 12:00'),
      end: at('2026-12-01 11:00'),
    })
    expect(validateLine(base, reversed, cam)).toEqual(['own-end-before-start'])
  })

  it('allows a direct transfer whose handover is before this gig’s departure', () => {
    const f = gigF(true)
    expect(validateLine(f, f.lines[0]!, item('kam01', 'KAM-01'))).toEqual([])
    const e = gigE()
    expect(validateLine(e, e.lines[2]!, item('ptz03', 'PTZ-03'))).toEqual([])
  })
})
