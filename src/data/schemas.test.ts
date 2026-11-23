import { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import { gigBResolved, gigE, items } from '../core/__fixtures__/scenario'
import type { Gig, Item } from '../core/types'
import {
  assertWritable,
  compact,
  gigToWire,
  itemToWire,
  parseAllowedUser,
  parseGig,
  parseItem,
  ValidationError,
} from './schemas'
import { changedKeys, deepEqual } from './writes'

const meta = { updatedAt: Timestamp.fromMillis(1_700_000_000_000), updatedBy: 'anna@example.com' }

describe('items: wire format round trip', () => {
  it('keeps every field, converting times', () => {
    const kam03 = items.find((i) => i.id === 'kam03')!
    const withOverride: Item = {
      ...kam03,
      serialNo: 'SN 123',
      locationOverride: { text: 'Mikon auto', at: 1_700_000_000_000, by: 'mikko@example.com' },
    }
    const { id, ...input } = withOverride
    const wire = itemToWire(input)
    expect(wire.conditionUntil).toBeInstanceOf(Timestamp)
    const parsed = parseItem(id, { ...wire, ...meta })
    expect(parsed).toEqual({
      ok: true,
      value: { ...withOverride, updatedAt: 1_700_000_000_000, updatedBy: 'anna@example.com' },
    })
  })

  it('omits absent optional fields instead of writing undefined', () => {
    const { id: _id, ...input } = items[0]!
    const wire = itemToWire(input)
    expect(Object.values(wire)).not.toContain(undefined)
    expect('serialNo' in wire).toBe(false)
  })

  it('reports an invalid document instead of throwing', () => {
    const r = parseItem('bad', { tag: 'X', name: 'X', quantity: 0, ...meta })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.issue).toMatchObject({ collection: 'items', id: 'bad' })
      expect(r.issue.message.length).toBeGreaterThan(0)
    }
  })
})

describe('gigs: wire format round trip', () => {
  const roundTrip = (g: Gig) => {
    const { id, ...input } = g
    return parseGig(id, { ...gigToWire(input), awaitingReturn: true, ...meta })
  }

  it('keeps lines, direct transfers and own times', () => {
    const b = gigBResolved()
    expect(roundTrip(b)).toEqual({
      ok: true,
      value: { ...b, updatedAt: meta.updatedAt.toMillis(), updatedBy: meta.updatedBy },
    })
    const e = gigE()
    expect(roundTrip(e)).toMatchObject({ ok: true, value: { lines: e.lines } })
  })

  it('keeps gig and line marks', () => {
    const g: Gig = {
      ...gigE(),
      departedAt: 1_700_000_000_000,
      departedBy: 'anna@example.com',
      lineMarks: { e3: { returnedAt: 1_700_000_100_000, returnedBy: 'anna@example.com' } },
    }
    expect(roundTrip(g)).toMatchObject({
      ok: true,
      value: { departedAt: g.departedAt, lineMarks: g.lineMarks },
    })
  })

  it('does not leak the stored awaitingReturn into the domain value', () => {
    const r = roundTrip(gigE())
    expect(r.ok && 'awaitingReturn' in r.value).toBe(false)
  })
})

describe('change detection helpers', () => {
  it('deepEqual treats missing and undefined keys alike', () => {
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true)
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true)
    expect(deepEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false)
    expect(deepEqual([], {})).toBe(false)
  })

  it('changedKeys ignores id and write stamps', () => {
    expect(
      changedKeys(
        { id: '1', name: 'a', updatedAt: 1, notes: 'x' },
        { id: '2', name: 'b', updatedAt: 2 },
      ),
    ).toEqual(['name', 'notes'])
  })

  it('compact drops undefined values only', () => {
    expect(compact({ a: 0, b: '', c: undefined, d: null })).toEqual({ a: 0, b: '', d: null })
  })
})

describe('review regressions', () => {
  it('a user created by hand in the console (no stamps) is readable', () => {
    expect(parseAllowedUser('anna@example.com', { name: 'Anna', initials: 'AN' })).toEqual({
      ok: true,
      value: {
        email: 'anna@example.com',
        name: 'Anna',
        initials: 'AN',
        updatedAt: 0,
        updatedBy: '',
      },
    })
  })

  it('assertWritable rejects what reading would reject', () => {
    const { id: _id, ...b } = gigBResolved()
    const wire = { ...gigToWire(b), awaitingReturn: true }
    expect(() => assertWritable('gigs', wire)).not.toThrow()
    expect(() =>
      assertWritable('gigs', { ...wire, lines: [{ id: '', itemId: 'x', qty: 0 }] }),
    ).toThrow(ValidationError)
    const { id: _i, ...item } = items[0]!
    expect(() => assertWritable('items', { ...itemToWire(item), homeLocationId: '' })).toThrow(
      ValidationError,
    )
  })
})
