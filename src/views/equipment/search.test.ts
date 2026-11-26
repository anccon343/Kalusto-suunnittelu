import { describe, expect, it } from 'vitest'
import { item } from '../../core/__fixtures__/scenario'
import type { Item } from '../../core/types'
import {
  categoriesOf,
  filterItems,
  fold,
  matchesQuery,
  sortByTag,
  type ListFilters,
} from './search'

const mixer = item('mix', 'MIX-01', {
  name: 'Äänipöytä',
  category: 'Ääni',
  manufacturer: 'Yamaha',
  model: 'QL1',
  serialNo: 'SN-778',
})
const cam = item('kam01', 'KAM-01', { name: 'Sony FX6', category: 'Kamerat', serialNo: 'A123' })

describe('fold', () => {
  it('removes case and diacritics the Finnish way', () => {
    expect(fold('Äänipöytä ÅSA')).toBe('aanipoyta asa')
  })
})

describe('matchesQuery', () => {
  it('matches name without accents and in any case', () => {
    expect(matchesQuery(mixer, 'aani')).toBe(true)
    expect(matchesQuery(mixer, 'ÄÄNI')).toBe(true)
  })

  it('matches tag, serial number, manufacturer and model', () => {
    expect(matchesQuery(cam, 'kam-01')).toBe(true)
    expect(matchesQuery(cam, 'kam01')).toBe(true)
    expect(matchesQuery(cam, 'a12')).toBe(true)
    expect(matchesQuery(mixer, 'yamaha ql1')).toBe(true)
    expect(matchesQuery(mixer, 'sn778')).toBe(true)
  })

  it('requires every word to match', () => {
    expect(matchesQuery(cam, 'sony fx6')).toBe(true)
    expect(matchesQuery(cam, 'sony yamaha')).toBe(false)
  })

  it('matches everything with an empty query', () => {
    expect(matchesQuery(cam, '  ')).toBe(true)
  })

  it('does not match on the category', () => {
    expect(matchesQuery(cam, 'kamerat')).toBe(false)
  })
})

describe('sortByTag', () => {
  it('sorts numerically and Finnish-alphabetically', () => {
    const tags = ['KAM-10', 'KAM-2', 'ÄÄNI-1', 'AV-1', 'ZOOM-1'].map((tag) => ({ tag }))
    expect(sortByTag(tags).map((x) => x.tag)).toEqual([
      'AV-1',
      'KAM-2',
      'KAM-10',
      'ZOOM-1',
      'ÄÄNI-1',
    ])
  })
})

describe('categoriesOf', () => {
  it('lists distinct non-empty categories sorted', () => {
    const list = [
      { category: 'Ääni' },
      { category: 'Kamerat' },
      { category: 'kamerat ' },
      { category: '' },
    ]
    expect(categoriesOf(list)).toEqual(['Kamerat', 'Ääni'])
  })
})

describe('filterItems', () => {
  const archived = item('old', 'OLD-01', { category: 'Kamerat', archived: true })
  const all: Item[] = [mixer, archived, cam]
  const none: ListFilters = { query: '', category: '', situation: undefined, showArchived: false }
  const ids = (xs: Item[]) => xs.map((x) => x.id)
  const situation = (i: Item) => (i.id === 'kam01' ? 'keikalla' : 'vapaa')

  it('hides archived items unless asked', () => {
    expect(ids(filterItems(all, none, situation))).toEqual(['kam01', 'mix'])
    expect(ids(filterItems(all, { ...none, showArchived: true }, situation))).toEqual([
      'kam01',
      'mix',
      'old',
    ])
  })

  it('filters by category and situation', () => {
    expect(ids(filterItems(all, { ...none, category: 'kamerat' }, situation))).toEqual(['kam01'])
    expect(ids(filterItems(all, { ...none, situation: 'vapaa' }, situation))).toEqual(['mix'])
  })
})
