/** Pure helpers for the location form and the starter locations (plan 2.4). */
import type { Location } from '../../core/types'
import type { LocationInput } from '../../data/schemas'

/** Limits of the stored schema (src/data/schemas.ts). */
export const LOCATION_LIMITS = {
  name: 120,
  room: 80,
  rooms: 50,
  address: 300,
  loadingNotes: 2000,
  contact: 300,
} as const

export interface LocationFormValues {
  name: string
  isOwnStudio: boolean
  rooms: string[]
  address: string
  loadingNotes: string
  contact: string
  archived: boolean
}

export const EMPTY_LOCATION_FORM: LocationFormValues = {
  name: '',
  isOwnStudio: false,
  rooms: [],
  address: '',
  loadingNotes: '',
  contact: '',
  archived: false,
}

export function locationToForm(l: Location): LocationFormValues {
  return {
    name: l.name,
    isOwnStudio: l.isOwnStudio,
    rooms: [...l.rooms],
    address: l.address ?? '',
    loadingNotes: l.loadingNotes ?? '',
    contact: l.contact ?? '',
    archived: l.archived,
  }
}

/** Trims every text and drops empty optional fields and duplicate or empty rooms. */
export function formToLocationInput(v: LocationFormValues): LocationInput {
  const rooms: string[] = []
  const seen = new Set<string>()
  for (const r of v.rooms) {
    const room = r.trim()
    const key = room.toLocaleLowerCase('fi')
    if (room === '' || seen.has(key)) continue
    seen.add(key)
    rooms.push(room)
  }
  const address = v.address.trim()
  const loadingNotes = v.loadingNotes.trim()
  const contact = v.contact.trim()
  return {
    name: v.name.trim(),
    isOwnStudio: v.isOwnStudio,
    rooms,
    ...(address ? { address } : {}),
    ...(loadingNotes ? { loadingNotes } : {}),
    ...(contact ? { contact } : {}),
    archived: v.archived,
  }
}

/** Form validation; returns Finnish messages keyed by field, or null when valid. */
export function validateLocationForm(
  v: LocationFormValues,
  msg: {
    nameRequired: string
    tooLong: (max: number) => string
    tooManyRooms: (max: number) => string
    roomTooLong: (max: number) => string
  },
): Partial<Record<keyof LocationFormValues, string>> {
  const errors: Partial<Record<keyof LocationFormValues, string>> = {}
  const L = LOCATION_LIMITS
  const name = v.name.trim()
  if (name === '') errors.name = msg.nameRequired
  else if (name.length > L.name) errors.name = msg.tooLong(L.name)
  if (v.rooms.length > L.rooms) errors.rooms = msg.tooManyRooms(L.rooms)
  else if (v.rooms.some((r) => r.trim().length > L.room)) errors.rooms = msg.roomTooLong(L.room)
  if (v.address.trim().length > L.address) errors.address = msg.tooLong(L.address)
  if (v.loadingNotes.trim().length > L.loadingNotes) {
    errors.loadingNotes = msg.tooLong(L.loadingNotes)
  }
  if (v.contact.trim().length > L.contact) errors.contact = msg.tooLong(L.contact)
  return errors
}

/** Own studio and its rooms (plan 2.4, answer T4). */
export const OWN_STUDIO_PRESET: LocationInput = {
  name: 'Oma studio',
  isOwnStudio: true,
  rooms: ['Iso studio', 'Pikku studio', 'Keittiöstudio', 'Pikku tarkkaamo', 'Iso tarkkaamo'],
  archived: false,
}

/** Clarion Hotel Helsinki from the hotel's 2016 brochure (plan 2.4). */
export const CLARION_PRESET: LocationInput = {
  name: 'Clarion Hotel Helsinki',
  isOwnStudio: false,
  rooms: [
    'Bysa 1',
    'Bysa 2',
    'Bysa 3',
    'Sonck',
    'Crusell',
    'Tallberg',
    'Sandis',
    'Saukko',
    'Brygga',
    'Kraana',
    'Bunkkeri',
    'Hiili',
    'Ulappa 1',
    'Ulappa 2',
  ],
  address: 'Tyynenmerenkatu 2, Helsinki',
  loadingNotes:
    'Ulappa 1–2 tornin 16. krs, kalusto hissillä. Tiedot hotellin esitteestä 2016, tarkista.',
  archived: false,
}

const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase('fi') === b.trim().toLocaleLowerCase('fi')

/** Whether a location with this name exists (archived ones included). */
export function hasLocationNamed(locations: readonly Location[], name: string): boolean {
  return locations.some((l) => sameName(l.name, name))
}

/** Own studios first, then by name; archived last. */
export function sortLocations<T extends Location>(locations: readonly T[]): T[] {
  return [...locations].sort(
    (a, b) =>
      Number(a.archived) - Number(b.archived) ||
      Number(b.isOwnStudio) - Number(a.isOwnStudio) ||
      a.name.localeCompare(b.name, 'fi'),
  )
}
