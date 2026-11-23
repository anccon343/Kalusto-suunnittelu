/**
 * Firestore document shapes ("wire format") and their conversion to and from the
 * domain types in `src/core/types.ts`.
 *
 * Every document read from Firestore is validated here. A document that does not
 * match is not passed to the app; it is reported as a `DataIssue` instead, so one
 * bad document never breaks the whole view. Times are `Timestamp`s on the wire and
 * UTC milliseconds in the domain.
 */
import { Timestamp } from 'firebase/firestore'
import { z } from 'zod'
import type {
  AllowedUser,
  AppSettings,
  Gig,
  Item,
  Line,
  Location,
  Marks,
  Package,
  Stored,
} from '../core/types'

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const ms = z.instanceof(Timestamp).transform((t) => t.toMillis())
const text = (max: number) => z.string().max(max)
const name = (max: number) => z.string().min(1).max(max)

const meta = {
  updatedAt: ms,
  updatedBy: z.string(),
}

const marks = {
  departedAt: ms.exactOptional(),
  departedBy: z.string().exactOptional(),
  returnedAt: ms.exactOptional(),
  returnedBy: z.string().exactOptional(),
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export const allowedUserSchema = z.object({
  name: name(100),
  initials: name(4),
  ...meta,
})

export const settingsSchema = z.object({
  lastBackupAt: ms.exactOptional(),
  updatedAt: ms.exactOptional(),
  updatedBy: z.string().exactOptional(),
})

export const locationSchema = z.object({
  name: name(120),
  isOwnStudio: z.boolean(),
  rooms: z.array(name(80)).max(50),
  address: text(300).exactOptional(),
  loadingNotes: text(2000).exactOptional(),
  contact: text(300).exactOptional(),
  archived: z.boolean(),
  ...meta,
})

export const itemSchema = z.object({
  tag: name(20),
  name: name(120),
  category: text(60),
  manufacturer: text(80).exactOptional(),
  model: text(80).exactOptional(),
  quantity: z.int().min(1).max(100_000),
  serialNo: text(80).exactOptional(),
  condition: z.enum(['ok', 'huollossa', 'rikki']),
  conditionUntil: ms.exactOptional(),
  homeLocationId: z.string().min(1),
  responsible: z.string().exactOptional(),
  notes: text(2000).exactOptional(),
  locationOverride: z.object({ text: text(200), at: ms, by: z.string() }).exactOptional(),
  archived: z.boolean(),
  ...meta,
})

export const packageSchema = z.object({
  name: name(120),
  lines: z.array(z.object({ itemId: z.string().min(1), qty: z.int().min(1) })).max(300),
  ...meta,
})

const lineSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().min(1),
  qty: z.int().min(1),
  note: text(500).exactOptional(),
  start: ms.exactOptional(),
  end: ms.exactOptional(),
  from: z
    .object({
      gigId: z.string().min(1),
      lineId: z.string().min(1),
      handoverAt: ms,
      travelMin: z.int().min(0).exactOptional(),
    })
    .exactOptional(),
})

export const gigSchema = z.object({
  name: name(120),
  client: text(120).exactOptional(),
  locationId: z.string().min(1),
  room: text(80).exactOptional(),
  responsible: z.string(),
  crew: z.array(z.string()).max(20),
  notes: text(4000).exactOptional(),
  status: z.enum(['alustava', 'vahvistettu', 'valmis', 'peruttu']),
  confirmedAt: ms.exactOptional(),
  confirmedBy: z.string().exactOptional(),
  equipStart: ms,
  eventStart: ms,
  eventEnd: ms,
  equipEnd: ms,
  lines: z.array(lineSchema).max(300),
  lineMarks: z.record(z.string(), z.object(marks)).exactOptional(),
  awaitingReturn: z.boolean(),
  ...marks,
  ...meta,
})

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type Collection = 'allowedUsers' | 'settings' | 'locations' | 'items' | 'packages' | 'gigs'

export interface DataIssue {
  collection: Collection
  id: string
  /** Human-readable summary of what did not match (developer facing). */
  message: string
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; issue: DataIssue }

function parseWith<S extends z.ZodType, T>(
  schema: S,
  collection: Collection,
  id: string,
  data: unknown,
  build: (v: z.output<S>) => T,
): Parsed<T> {
  const r = schema.safeParse(data)
  if (r.success) return { ok: true, value: build(r.data) }
  return { ok: false, issue: { collection, id, message: z.prettifyError(r.error) } }
}

export const parseAllowedUser = (id: string, data: unknown): Parsed<Stored<AllowedUser>> =>
  parseWith(allowedUserSchema, 'allowedUsers', id, data, (v) => ({ email: id, ...v }))

export const parseSettings = (id: string, data: unknown): Parsed<AppSettings> =>
  parseWith(settingsSchema, 'settings', id, data, (v) =>
    v.lastBackupAt === undefined ? {} : { lastBackupAt: v.lastBackupAt },
  )

export const parseLocation = (id: string, data: unknown): Parsed<Stored<Location>> =>
  parseWith(locationSchema, 'locations', id, data, (v) => ({ id, ...v }))

export const parseItem = (id: string, data: unknown): Parsed<Stored<Item>> =>
  parseWith(itemSchema, 'items', id, data, (v) => ({ id, ...v }))

export const parsePackage = (id: string, data: unknown): Parsed<Stored<Package>> =>
  parseWith(packageSchema, 'packages', id, data, (v) => ({ id, ...v }))

export const parseGig = (id: string, data: unknown): Parsed<Stored<Gig>> =>
  parseWith(gigSchema, 'gigs', id, data, ({ awaitingReturn: _derived, ...v }) => ({ id, ...v }))

// ---------------------------------------------------------------------------
// Writing (domain → wire). Ms becomes Timestamp; absent optional fields are omitted.
// ---------------------------------------------------------------------------

const ts = (v: number) => Timestamp.fromMillis(v)

type Wire = Record<string, unknown>

/** Drops keys whose value is `undefined`; Firestore rejects them. */
export function compact<T extends Wire>(o: T): Wire {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
}

const optTs = (v: number | undefined) => (v === undefined ? undefined : ts(v))

function marksToWire(m: Marks): Wire {
  return compact({
    departedAt: optTs(m.departedAt),
    departedBy: m.departedBy,
    returnedAt: optTs(m.returnedAt),
    returnedBy: m.returnedBy,
  })
}

export function lineToWire(l: Line): Wire {
  return compact({
    id: l.id,
    itemId: l.itemId,
    qty: l.qty,
    note: l.note,
    start: optTs(l.start),
    end: optTs(l.end),
    from: l.from
      ? compact({
          gigId: l.from.gigId,
          lineId: l.from.lineId,
          handoverAt: ts(l.from.handoverAt),
          travelMin: l.from.travelMin,
        })
      : undefined,
  })
}

export type ItemInput = Omit<Item, 'id'>
export type GigInput = Omit<Gig, 'id'>
export type LocationInput = Omit<Location, 'id'>
export type PackageInput = Omit<Package, 'id'>

export function itemToWire(i: ItemInput): Wire {
  return compact({
    tag: i.tag,
    name: i.name,
    category: i.category,
    manufacturer: i.manufacturer,
    model: i.model,
    quantity: i.quantity,
    serialNo: i.serialNo,
    condition: i.condition,
    conditionUntil: optTs(i.conditionUntil),
    homeLocationId: i.homeLocationId,
    responsible: i.responsible,
    notes: i.notes,
    locationOverride: i.locationOverride
      ? { text: i.locationOverride.text, at: ts(i.locationOverride.at), by: i.locationOverride.by }
      : undefined,
    archived: i.archived,
  })
}

export function locationToWire(l: LocationInput): Wire {
  return compact({
    name: l.name,
    isOwnStudio: l.isOwnStudio,
    rooms: l.rooms,
    address: l.address,
    loadingNotes: l.loadingNotes,
    contact: l.contact,
    archived: l.archived,
  })
}

export function packageToWire(p: PackageInput): Wire {
  return { name: p.name, lines: p.lines.map((l) => ({ itemId: l.itemId, qty: l.qty })) }
}

/** `awaitingReturn` is derived (core `computeAwaitingReturn`) and must be passed in. */
export function gigToWire(g: GigInput, awaitingReturn: boolean): Wire {
  return compact({
    name: g.name,
    client: g.client,
    locationId: g.locationId,
    room: g.room,
    responsible: g.responsible,
    crew: g.crew,
    notes: g.notes,
    status: g.status,
    confirmedAt: optTs(g.confirmedAt),
    confirmedBy: g.confirmedBy,
    equipStart: ts(g.equipStart),
    eventStart: ts(g.eventStart),
    eventEnd: ts(g.eventEnd),
    equipEnd: ts(g.equipEnd),
    lines: g.lines.map(lineToWire),
    lineMarks: g.lineMarks
      ? Object.fromEntries(Object.entries(g.lineMarks).map(([k, m]) => [k, marksToWire(m)]))
      : undefined,
    awaitingReturn,
    ...marksToWire(g),
  })
}
