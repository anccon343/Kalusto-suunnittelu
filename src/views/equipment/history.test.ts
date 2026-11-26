import { describe, expect, it } from 'vitest'
import { gigA, gigBInitial, gigE, gigW } from '../../core/__fixtures__/scenario'
import { gigsUsingItem } from './history'

describe('gigsUsingItem', () => {
  it('lists gigs that book the item, newest first, with the quantity', () => {
    const uses = gigsUsingItem([gigA(), gigW(), gigBInitial(), gigE()], 'xlr')
    expect(uses.map((u) => [u.gig.id, u.qty])).toEqual([
      ['E', 16],
      ['W', 8],
      ['B', 20],
      ['A', 10],
    ])
  })

  it('leaves out gigs without the item', () => {
    expect(gigsUsingItem([gigA(), gigW()], 'kam01').map((u) => u.gig.id)).toEqual(['W'])
  })
})
