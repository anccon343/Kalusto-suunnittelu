import { describe, expect, it } from 'vitest'
import { Availability } from '../../core/availability'
import {
  at,
  gigA,
  gigBInitial,
  gigBResolved,
  gigW,
  item,
  items,
  OWN_STUDIO_IDS,
} from '../../core/__fixtures__/scenario'
import type { Gig, Item } from '../../core/types'
import { isOutOfService, nextGigDemand, situationOf } from './status'

function model(gigs: Gig[], now: number, extraItems: Item[] = []) {
  const all = [...items, ...extraItems]
  const availability = new Availability({
    items: all,
    gigs,
    ownStudioLocationIds: OWN_STUDIO_IDS,
    now,
  })
  const byId = new Map(all.map((i) => [i.id, i]))
  const get = (id: string) => {
    const it = byId.get(id)
    if (!it) throw new Error(id)
    return it
  }
  return { availability, situation: (id: string) => situationOf(get(id), availability, now) }
}

describe('isOutOfService', () => {
  const kam03 = items.find((i) => i.id === 'kam03') as Item

  it('is out of service while the condition lasts', () => {
    expect(isOutOfService(kam03, at('2026-12-04 15:59'))).toBe(true)
    expect(isOutOfService(kam03, at('2026-12-04 16:00'))).toBe(false)
  })

  it('treats an open-ended condition and archived items as out of service', () => {
    expect(isOutOfService(item('x', 'X', { condition: 'rikki' }), 0)).toBe(true)
    expect(isOutOfService(item('x', 'X', { archived: true }), 0)).toBe(true)
    expect(isOutOfService(item('x', 'X'), 0)).toBe(false)
  })
})

describe('situationOf', () => {
  it('is Vapaa when nothing holds the item', () => {
    const { situation } = model([gigA()], at('2026-11-30 12:00'))
    expect(situation('ptz03')).toEqual({ kind: 'vapaa', gigIds: [] })
  })

  it('is Keikalla while a gig books the item, also on a tentative gig', () => {
    const { situation } = model([gigW(), gigBInitial()], at('2026-12-01 12:00'))
    expect(situation('kam01')).toMatchObject({ kind: 'keikalla', gigIds: ['W', 'B'] })
  })

  it('uses half-open intervals: the booking has ended at equipment return', () => {
    const { situation } = model([gigW()], at('2026-12-01 17:00'))
    expect(situation('kam01').kind).toBe('vapaa')
  })

  it('shows free quantity of a quantity item', () => {
    // Mon 15.00: A holds 10 and B 20 of the 40 cables.
    const { situation } = model([gigA(), gigBInitial()], at('2026-11-30 15:00'))
    expect(situation('xlr')).toEqual({
      kind: 'keikalla',
      gigIds: ['A', 'B'],
      free: 10,
      total: 40,
    })
  })

  it('is Palauttamatta when an external confirmed gig has not been returned', () => {
    const { situation } = model([gigA(), gigBResolved()], at('2026-12-02 13:00'))
    expect(situation('kam04')).toEqual({
      kind: 'palauttamatta',
      gigIds: ['B'],
      dueAt: at('2026-12-02 12:00'),
    })
  })

  it('is Pois käytöstä in service, which wins over a booking', () => {
    const { situation } = model([], at('2026-12-01 12:00'))
    expect(situation('kam03').kind).toBe('pois-kaytosta')
  })

  it('is Pois käytöstä when archived, without a free quantity', () => {
    const old = item('old', 'OLD-01', { quantity: 5, archived: true })
    const { situation } = model([], 0, [old])
    expect(situation('old')).toEqual({ kind: 'pois-kaytosta', gigIds: [] })
  })
})

describe('nextGigDemand', () => {
  it('finds the earliest booking that starts later, ignoring the condition', () => {
    const { availability } = model([gigW(), gigBInitial()], at('2026-11-29 12:00'))
    expect(nextGigDemand(availability.demandsFor('kam01'), at('2026-11-29 12:00'))?.src).toBe('B')
    expect(nextGigDemand(availability.demandsFor('kam01'), at('2026-11-30 15:00'))?.src).toBe('W')
    expect(nextGigDemand(availability.demandsFor('kam03'), 0)).toBeUndefined()
  })
})
