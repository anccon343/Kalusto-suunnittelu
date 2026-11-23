/**
 * All writes to Firestore. Every write carries `updatedBy` (the signed-in email in
 * lower case) and `updatedAt` (server time), which the security rules require.
 *
 * Edits use optimistic concurrency per field (plan 2.2, principle 4): the form keeps
 * the version it was opened with (`baseline`); on save, a transaction re-reads the
 * document and aborts with `ConflictError` if any field the user changed has since
 * been changed by someone else. Only the changed fields are written, so concurrent
 * edits to different fields (and departure/return marks) are never overwritten.
 */
import {
  collection,
  deleteField,
  doc,
  FieldPath,
  runTransaction,
  serverTimestamp,
  setDoc,
  deleteDoc,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from 'firebase/firestore'
import { computeAwaitingReturn } from '../core/availability'
import type { Gig, Item, Location, Package } from '../core/types'
import {
  gigToWire,
  itemToWire,
  locationToWire,
  packageToWire,
  parseGig,
  parseItem,
  parseLocation,
  parsePackage,
  type Collection,
  type GigInput,
  type ItemInput,
  type LocationInput,
  type PackageInput,
  type Parsed,
} from './schemas'

export class ConflictError extends Error {
  readonly fields: readonly string[]
  constructor(fields: readonly string[]) {
    super(`Changed elsewhere: ${fields.join(', ')}`)
    this.name = 'ConflictError'
    this.fields = fields
  }
}

export class NotFoundError extends Error {
  constructor(collectionName: Collection, id: string) {
    super(`${collectionName}/${id} not found`)
    this.name = 'NotFoundError'
  }
}

export class InvalidStateError extends Error {
  readonly reason: string
  constructor(reason: string) {
    super(reason)
    this.name = 'InvalidStateError'
    this.reason = reason
  }
}

/** Lower-cased email of the signed-in user; the rules compare against this. */
export type Author = string

const stamp = (by: Author) => ({ updatedBy: by.toLowerCase(), updatedAt: serverTimestamp() })

/** Structural equality for plain JSON-like values (domain objects). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined)
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined)
  if (ka.length !== kb.length) return false
  return ka.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  )
}

/** Keys whose values differ between two versions (ignores `id` and write stamps). */
export function changedKeys<T extends object>(before: T, after: T): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const k of ['id', 'updatedAt', 'updatedBy']) keys.delete(k)
  return [...keys]
    .filter(
      (k) =>
        !deepEqual((before as Record<string, unknown>)[k], (after as Record<string, unknown>)[k]),
    )
    .sort()
}

interface EditSpec<T extends object> {
  db: Firestore
  collectionName: Collection
  id: string
  parse: (id: string, data: unknown) => Parsed<T>
  baseline: T
  edited: T
  toWire: (value: T) => Record<string, unknown>
  /** Fields written on every save even if unchanged (derived fields). */
  alwaysWrite?: readonly string[]
  by: Author
}

async function saveEdit<T extends object>(spec: EditSpec<T>): Promise<string[]> {
  const changed = changedKeys(spec.baseline, spec.edited)
  if (changed.length === 0) return []
  const ref = doc(spec.db, spec.collectionName, spec.id)
  await runTransaction(spec.db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new NotFoundError(spec.collectionName, spec.id)
    const current = spec.parse(spec.id, snap.data({ serverTimestamps: 'estimate' }))
    if (!current.ok) throw new InvalidStateError(current.issue.message)
    const conflicts = changed.filter(
      (k) =>
        !deepEqual(
          (current.value as Record<string, unknown>)[k],
          (spec.baseline as Record<string, unknown>)[k],
        ),
    )
    if (conflicts.length > 0) throw new ConflictError(conflicts)
    const wire = spec.toWire(spec.edited)
    const update: Record<string, unknown> = {}
    for (const k of [...changed, ...(spec.alwaysWrite ?? [])]) {
      update[k] = wire[k] === undefined ? deleteField() : wire[k]
    }
    tx.update(ref, { ...update, ...stamp(spec.by) })
  })
  return changed
}

/** Generates a new document id without writing. */
export function newId(db: Firestore, collectionName: Collection): string {
  return doc(collection(db, collectionName)).id
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export async function createItem(db: Firestore, input: ItemInput, by: Author): Promise<string> {
  const ref = doc(collection(db, 'items'))
  await setDoc(ref, { ...itemToWire(input), ...stamp(by) })
  return ref.id
}

export function saveItem(db: Firestore, baseline: Item, edited: Item, by: Author) {
  return saveEdit({
    db,
    collectionName: 'items',
    id: baseline.id,
    parse: parseItem,
    baseline: strip(baseline),
    edited: strip(edited),
    toWire: itemToWire,
    by,
  })
}

// ---------------------------------------------------------------------------
// Locations and packages
// ---------------------------------------------------------------------------

export async function createLocation(db: Firestore, input: LocationInput, by: Author) {
  const ref = doc(collection(db, 'locations'))
  await setDoc(ref, { ...locationToWire(input), ...stamp(by) })
  return ref.id
}

export function saveLocation(db: Firestore, baseline: Location, edited: Location, by: Author) {
  return saveEdit({
    db,
    collectionName: 'locations',
    id: baseline.id,
    parse: parseLocation,
    baseline: strip(baseline),
    edited: strip(edited),
    toWire: locationToWire,
    by,
  })
}

export async function createPackage(db: Firestore, input: PackageInput, by: Author) {
  const ref = doc(collection(db, 'packages'))
  await setDoc(ref, { ...packageToWire(input), ...stamp(by) })
  return ref.id
}

export function savePackage(db: Firestore, baseline: Package, edited: Package, by: Author) {
  return saveEdit({
    db,
    collectionName: 'packages',
    id: baseline.id,
    parse: parsePackage,
    baseline: strip(baseline),
    edited: strip(edited),
    toWire: packageToWire,
    by,
  })
}

export function deletePackage(db: Firestore, id: string) {
  return deleteDoc(doc(db, 'packages', id))
}

// ---------------------------------------------------------------------------
// Gigs
// ---------------------------------------------------------------------------

export async function createGig(
  db: Firestore,
  input: GigInput,
  isOwnStudio: boolean,
  by: Author,
  id: string = newId(db, 'gigs'),
): Promise<string> {
  const awaiting = computeAwaitingReturn({ ...input, id }, isOwnStudio)
  await setDoc(doc(db, 'gigs', id), { ...gigToWire(input, awaiting), ...stamp(by) })
  return id
}

/**
 * Saves a gig edited in the form. Marks (Lähti/Palautettu, line marks) are not part
 * of the form and are never written here; the edited copy must carry the baseline's
 * marks so they do not show up as changes.
 */
export function saveGig(
  db: Firestore,
  baseline: Gig,
  edited: Gig,
  isOwnStudio: boolean,
  by: Author,
) {
  const markKeys = [
    'departedAt',
    'departedBy',
    'returnedAt',
    'returnedBy',
    'lineMarks',
  ] as const satisfies readonly (keyof Gig)[]
  const editedWithBaselineMarks: Gig = { ...edited }
  for (const k of markKeys) {
    if (baseline[k] === undefined) delete editedWithBaselineMarks[k]
    else Object.assign(editedWithBaselineMarks, { [k]: baseline[k] })
  }
  return saveEdit({
    db,
    collectionName: 'gigs',
    id: baseline.id,
    parse: parseGig,
    baseline: strip(baseline),
    edited: strip(editedWithBaselineMarks),
    toWire: (g) => gigToWire(g, computeAwaitingReturn({ ...g, id: baseline.id }, isOwnStudio)),
    alwaysWrite: ['awaitingReturn'],
    by,
  })
}

export function deleteTentativeGig(db: Firestore, id: string) {
  return deleteDoc(doc(db, 'gigs', id))
}

export type MarkKind = 'departed' | 'returned'

/**
 * Lähti / Palautettu for a whole gig. Departure requires a confirmed gig; return
 * marks a confirmed gig as done (valmis). Facts are always recorded (rule 10).
 */
export async function markGig(
  db: Firestore,
  gigId: string,
  kind: MarkKind,
  isOwnStudio: boolean,
  by: Author,
): Promise<void> {
  const ref = doc(db, 'gigs', gigId)
  await runTransaction(db, async (tx) => {
    const gig = await readGig(tx, ref, gigId)
    const author = by.toLowerCase()
    const update: Record<string, unknown> = {}
    if (kind === 'departed') {
      if (gig.status !== 'vahvistettu') throw new InvalidStateError('not-confirmed')
      update.departedAt = serverTimestamp()
      update.departedBy = author
    } else {
      update.returnedAt = serverTimestamp()
      update.returnedBy = author
      if (gig.status === 'vahvistettu') update.status = 'valmis'
    }
    const next: Gig = {
      ...gig,
      ...(kind === 'departed' ? { departedAt: 0 } : { returnedAt: 0 }),
    }
    update.awaitingReturn = computeAwaitingReturn(next, isOwnStudio)
    tx.update(ref, { ...update, ...stamp(by) })
  })
}

/** Lähti / Palautettu for one line with its own start or end (plan 2.3, `lineMarks`). */
export async function markLine(
  db: Firestore,
  gigId: string,
  lineId: string,
  kind: MarkKind,
  by: Author,
): Promise<void> {
  const ref = doc(db, 'gigs', gigId)
  await runTransaction(db, async (tx) => {
    const gig = await readGig(tx, ref, gigId)
    if (!gig.lines.some((l) => l.id === lineId)) throw new InvalidStateError('line-missing')
    const at = new FieldPath('lineMarks', lineId, `${kind}At`)
    const who = new FieldPath('lineMarks', lineId, `${kind}By`)
    const s = stamp(by)
    tx.update(
      ref,
      at,
      serverTimestamp(),
      who,
      by.toLowerCase(),
      'updatedBy',
      s.updatedBy,
      'updatedAt',
      s.updatedAt,
    )
  })
}

async function readGig(tx: Transaction, ref: DocumentReference, gigId: string): Promise<Gig> {
  const snap = await tx.get(ref)
  if (!snap.exists()) throw new NotFoundError('gigs', gigId)
  const parsed = parseGig(gigId, snap.data({ serverTimestamps: 'estimate' }))
  if (!parsed.ok) throw new InvalidStateError(parsed.issue.message)
  return parsed.value
}

/** Removes write stamps so they are not compared or written as edits. */
function strip<T extends object>(v: T): T {
  const {
    updatedAt: _a,
    updatedBy: _b,
    ...rest
  } = v as T & {
    updatedAt?: unknown
    updatedBy?: unknown
  }
  return rest as T
}
