import { describe, expect, it } from 'vitest'
import { at, gig, gigE, gigF, item, line } from './__fixtures__/scenario'
import type { Item } from './types'
import { validateGig, validateLine } from './validation'

const base = gig('G', {
  equipStart: at('2026-12-01 08:00'),
  eventStart: at('2026-12-01 09:00'),
  eventEnd: at('2026-12-01 16:00'),
  equipEnd: at('2026-12-01 17:00'),
})

const cam = item('cam', 'KAM-01')
const cables = item('xlr', 'XLR10', { quantity: 40 })
const catalogue = new Map<string, Item>([
  ['cam', cam],
  ['xlr', cables],
])
const lookup = (id: string) => catalogue.get(id)

describe('gig validation', () => {
  it('accepts ordered times and rejects out-of-order ones', () => {
    expect(validateGig(base, lookup)).toEqual([])
    expect(validateGig({ ...base, eventStart: at('2026-12-01 07:00') }, lookup)).toEqual([
      'times-out-of-order',
    ])
    expect(validateGig({ ...base, eventEnd: base.eventStart }, lookup)).toEqual([
      'times-out-of-order',
    ])
  })

  it('rejects the same device twice on one gig', () => {
    const twice = { ...base, lines: [line('1', 'cam'), line('2', 'cam')] }
    expect(validateGig(twice, lookup)).toEqual(['duplicate-device'])
  })

  it('allows several lines of a quantity item (own times, partial transfers)', () => {
    const lines = [
      line('1', 'xlr', { qty: 16 }),
      line('2', 'xlr', { qty: 8, start: at('2026-12-01 12:00') }),
    ]
    expect(validateGig({ ...base, lines }, lookup)).toEqual([])
  })
})

describe('line validation', () => {
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
  })

  it('flags an archived item or too large a quantity only when chosen now', () => {
    const archived = { ...cam, archived: true }
    expect(validateLine(base, line('1', 'cam'), archived)).toEqual(['item-archived'])
    expect(validateLine(base, line('1', 'cam'), archived, line('1', 'cam'))).toEqual([])
    expect(validateLine(base, line('1', 'cam'), archived, line('1', 'other'))).toEqual([
      'item-archived',
    ])

    const fewer = { ...cables, quantity: 30 }
    const stored = line('1', 'xlr', { qty: 32 })
    expect(validateLine(base, line('1', 'xlr', { qty: 32 }), fewer, stored)).toEqual([])
    expect(validateLine(base, line('1', 'xlr', { qty: 33 }), fewer, stored)).toEqual([
      'qty-exceeds-item',
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

  it('checks "needed from" on a receiving line against the equipment period', () => {
    const f = gigF(true)
    const kam = item('kam01', 'KAM-01')
    const withStart = (s: string) => ({ ...f.lines[0]!, start: at(s) })
    expect(validateLine(f, withStart('2026-12-08 14:00'), kam)).toEqual(['own-time-out-of-range'])
    expect(validateLine(f, withStart('2026-12-08 07:00'), kam)).toEqual(['own-time-out-of-range'])
    expect(validateLine(f, withStart('2026-12-08 08:30'), kam)).toEqual([])
  })

  it('checks travel time and handover values', () => {
    const f = gigF(true)
    const kam = item('kam01', 'KAM-01')
    const from = f.lines[0]!.from!
    expect(validateLine(f, { ...f.lines[0]!, from: { ...from, travelMin: -5 } }, kam)).toEqual([
      'travel-not-non-negative-integer',
    ])
    expect(validateLine(f, { ...f.lines[0]!, from: { ...from, handoverAt: NaN } }, kam)).toEqual([
      'handover-invalid',
    ])
  })
})
