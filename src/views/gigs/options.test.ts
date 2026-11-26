import { describe, expect, it } from 'vitest'
import { items, locations } from '../../core/__fixtures__/scenario'
import { itemLabel, itemOptions, locationOptions, roomOptions, userOptions } from './options'

describe('locationOptions', () => {
  it('puts the own studio first and hides archived locations except the current one', () => {
    const all = [...locations, { ...locations[1]!, id: 'old', name: 'Vanha', archived: true }]
    expect(locationOptions(all, null).map((o) => o.value)).toEqual(['studio', 'espoo', 'clarion'])
    expect(locationOptions(all, 'old').map((o) => o.value)).toContain('old')
    expect(locationOptions(all, null)[0]?.label).toBe('Oma studio (oma studio)')
  })
})

describe('roomOptions', () => {
  it('keeps a stored room that is no longer on the list', () => {
    expect(roomOptions(locations[1], 'Sonck')).toEqual(['Bysa 1', 'Bysa 2', 'Sonck'])
    expect(roomOptions(undefined, null)).toEqual([])
  })
})

describe('userOptions', () => {
  it('sorts by name and keeps emails no longer on the allowlist', () => {
    const users = [
      { email: 'mikko@example.com', name: 'Mikko', initials: 'MI' },
      { email: 'anna@example.com', name: 'Anna', initials: 'AN' },
    ]
    expect(userOptions(users, ['entinen@example.com', 'anna@example.com'])).toEqual([
      { value: 'anna@example.com', label: 'Anna' },
      { value: 'mikko@example.com', label: 'Mikko' },
      { value: 'entinen@example.com', label: 'entinen@example.com' },
    ])
  })
})

describe('itemOptions', () => {
  it('lists non-archived items by tag and disables devices already on the gig', () => {
    const all = [...items, { ...items[0]!, id: 'arch', tag: 'KAM-99', archived: true }]
    const opts = itemOptions(all, new Set(['kam01', 'xlr']))
    expect(opts.map((o) => o.label)).not.toContain('KAM-99 Sony FX6')
    expect(opts.find((o) => o.value === 'kam01')).toMatchObject({ disabled: true })
    // A quantity item can have several lines.
    expect(opts.find((o) => o.value === 'xlr')).not.toHaveProperty('disabled')
    expect(itemLabel({ tag: 'PTZ-01', name: 'PTZ-01' })).toBe('PTZ-01')
  })
})
