import { describe, expect, it } from 'vitest'
import { locations } from '../../core/__fixtures__/scenario'
import { locationSchema } from '../../data/schemas'
import {
  CLARION_PRESET,
  EMPTY_LOCATION_FORM,
  formToLocationInput,
  hasLocationNamed,
  locationToForm,
  OWN_STUDIO_PRESET,
  sortLocations,
  validateLocationForm,
} from './locationForm'
import { t } from './texts'
import { sortUsers, suggestInitials } from './users'

describe('formToLocationInput', () => {
  it('trims texts, drops empty optional fields and duplicate rooms', () => {
    expect(
      formToLocationInput({
        ...EMPTY_LOCATION_FORM,
        name: '  Kulttuuritalo ',
        rooms: ['Iso sali', ' iso sali ', '', 'Pieni sali'],
        address: '  ',
        contact: ' Pekka 040 123 ',
      }),
    ).toEqual({
      name: 'Kulttuuritalo',
      isOwnStudio: false,
      rooms: ['Iso sali', 'Pieni sali'],
      contact: 'Pekka 040 123',
      archived: false,
    })
  })

  it('round-trips a stored location', () => {
    for (const l of locations) {
      const { id, ...input } = l
      expect(formToLocationInput(locationToForm(l))).toEqual(input)
      expect(id).toBeTruthy()
    }
  })
})

describe('validateLocationForm', () => {
  const msg = t.locations.form
  it('requires a name', () => {
    expect(validateLocationForm({ ...EMPTY_LOCATION_FORM, name: ' ' }, msg)).toEqual({
      name: msg.nameRequired,
    })
  })
  it('limits lengths', () => {
    const errors = validateLocationForm(
      { ...EMPTY_LOCATION_FORM, name: 'X', rooms: ['a'.repeat(81)], address: 'a'.repeat(301) },
      msg,
    )
    expect(errors).toEqual({ rooms: msg.roomTooLong(80), address: msg.tooLong(300) })
  })
  it('accepts a valid form', () => {
    expect(validateLocationForm({ ...EMPTY_LOCATION_FORM, name: 'Talo' }, msg)).toEqual({})
  })
})

describe('presets', () => {
  it('match the stored schema', () => {
    for (const p of [OWN_STUDIO_PRESET, CLARION_PRESET]) {
      expect(locationSchema.omit({ updatedAt: true, updatedBy: true }).safeParse(p).success).toBe(
        true,
      )
    }
  })
  it('have the rooms of plan 2.4', () => {
    expect(OWN_STUDIO_PRESET.isOwnStudio).toBe(true)
    expect(OWN_STUDIO_PRESET.rooms).toHaveLength(5)
    expect(CLARION_PRESET.rooms).toHaveLength(14)
    expect(CLARION_PRESET.address).toBe('Tyynenmerenkatu 2, Helsinki')
  })
})

describe('hasLocationNamed', () => {
  it('ignores case and surrounding spaces', () => {
    expect(hasLocationNamed(locations, ' clarion hotel HELSINKI ')).toBe(true)
    expect(hasLocationNamed(locations, 'Clarion')).toBe(false)
  })
})

describe('sortLocations', () => {
  it('puts own studios first and archived last', () => {
    const sorted = sortLocations([
      { ...locations[1]!, archived: true },
      locations[2]!,
      locations[0]!,
    ])
    expect(sorted.map((l) => l.id)).toEqual(['studio', 'espoo', 'clarion'])
  })
})

describe('suggestInitials', () => {
  it.each([
    ['Anna Virtanen', 'AV'],
    ['anna-liisa virtanen', 'AV'],
    ['Mikko', 'MI'],
    ['  Äijä  Östman ', 'ÄÖ'],
    ['Jean Claude van Damme', 'JD'],
    ['', ''],
    ['  ', ''],
  ])('%s → %s', (name, initials) => {
    expect(suggestInitials(name)).toBe(initials)
  })
})

describe('sortUsers', () => {
  it('puts the signed-in user first, then by name', () => {
    const users = [
      { email: 'c@x.fi', name: 'Öberg', initials: 'Ö' },
      { email: 'b@x.fi', name: 'Bertta', initials: 'B' },
      { email: 'a@x.fi', name: 'Aatu', initials: 'A' },
    ]
    expect(sortUsers(users, 'c@x.fi').map((u) => u.email)).toEqual(['c@x.fi', 'a@x.fi', 'b@x.fi'])
  })
})
