import { describe, expect, it } from 'vitest'
import { at, item } from '../../core/__fixtures__/scenario'
import {
  duplicateValues,
  emptyValues,
  toEditedItem,
  toNewItem,
  validateValues,
  valuesFromItem,
  type ItemFormValues,
} from './itemForm'

const filled = (over: Partial<ItemFormValues> = {}): ItemFormValues => ({
  ...emptyValues('studio'),
  tag: ' kam-05 ',
  name: ' Sony FX6 ',
  category: 'Kamerat',
  ...over,
})

describe('validateValues', () => {
  it('accepts a complete device', () => {
    expect(validateValues(filled(), ['KAM-01'])).toEqual({})
  })

  it('requires tag, name and home location', () => {
    const e = validateValues({ ...emptyValues(undefined) }, [])
    expect(Object.keys(e).sort()).toEqual(['homeLocationId', 'name', 'tag'])
  })

  it('rejects a tag taken regardless of case and spaces, archived items included', () => {
    expect(validateValues(filled({ tag: 'kam 01' }), ['KAM01']).tag).toMatch(/käytössä/)
  })

  it('accepts only positive integer quantities', () => {
    expect(validateValues(filled({ quantity: 0 }), []).quantity).toBeDefined()
    expect(validateValues(filled({ quantity: 2.5 }), []).quantity).toBeDefined()
    expect(validateValues(filled({ quantity: '' }), []).quantity).toBeDefined()
    expect(validateValues(filled({ quantity: 40 }), []).quantity).toBeUndefined()
  })

  it('limits text lengths to what the database accepts', () => {
    expect(validateValues(filled({ tag: 'X'.repeat(21) }), []).tag).toMatch(/20/)
    expect(validateValues(filled({ notes: 'x'.repeat(2001) }), []).notes).toMatch(/2000/)
  })
})

describe('toNewItem', () => {
  it('cleans values and leaves empty optional fields out', () => {
    expect(toNewItem(filled({ manufacturer: '  ', responsible: null }))).toEqual({
      tag: 'KAM-05',
      name: 'Sony FX6',
      category: 'Kamerat',
      quantity: 1,
      condition: 'ok',
      homeLocationId: 'studio',
      archived: false,
    })
  })

  it('keeps the return time only when the condition is not OK', () => {
    const until = at('2026-12-04 16:00')
    expect(
      toNewItem(filled({ condition: 'huollossa', conditionUntil: until })).conditionUntil,
    ).toBe(until)
    expect(toNewItem(filled({ condition: 'ok', conditionUntil: until }))).not.toHaveProperty(
      'conditionUntil',
    )
  })
})

describe('toEditedItem', () => {
  const stored = {
    ...item('kam03', 'KAM-03', {
      name: 'Sony FX6',
      serialNo: 'S1',
      condition: 'huollossa',
      conditionUntil: at('2026-12-04 16:00'),
      locationOverride: { text: 'Mikon auto', at: 1, by: 'mikko@example.com' },
    }),
    updatedAt: 5,
    updatedBy: 'anna@example.com',
  }

  it('round-trips unchanged values', () => {
    expect(toEditedItem(stored, valuesFromItem(stored))).toEqual(stored)
  })

  it('removes emptied fields and keeps fields the form does not own', () => {
    const edited = toEditedItem(stored, {
      ...valuesFromItem(stored),
      serialNo: '',
      condition: 'ok',
    })
    expect(edited).not.toHaveProperty('serialNo')
    expect(edited).not.toHaveProperty('conditionUntil')
    expect(edited.locationOverride?.text).toBe('Mikon auto')
    expect(edited.archived).toBe(false)
  })
})

describe('duplicateValues', () => {
  it('suggests the next free tag, an empty serial number and OK condition', () => {
    const v = duplicateValues(
      item('kam03', 'KAM-03', { serialNo: 'S1', condition: 'rikki', name: 'Sony FX6' }),
      ['KAM-01', 'KAM-03', 'KAM-04'],
    )
    expect(v).toMatchObject({ tag: 'KAM-05', serialNo: '', condition: 'ok', name: 'Sony FX6' })
    expect(v.conditionUntil).toBeUndefined()
  })
})
