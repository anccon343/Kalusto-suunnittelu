/**
 * All writes to Firestore. Every write carries `updatedBy` (the signed-in email in
 * lower case) and `updatedAt` (server time), which the security rules require, and
 * is validated with the same Zod schema that reads it back (plan 6.1).
 *
 * Edits use optimistic concurrency per field (plan 2.2, principle 4): the form keeps
 * the version it was opened with (`baseline`); on save, a transaction re-reads the
 * document and aborts with `ConflictError` if any field the user changed has since
 * been changed by someone else. Only the changed fields are written, so concurrent
 * edits to other fields and departure/return marks are never overwritten. Derived
 * fields (`awaitingReturn`) are computed from the document as it will be after the
 * write, never from the possibly stale baseline.
 */
import { FirebaseError } from 'firebase/app'
import {
  collection,
  deleteField,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type Transaction,
} from 'firebase/firestore'
import { computeAwaitingReturn } from '../core/availability'
import type { Ms } from '../core/time'
import type { AllowedUser, Gig, Item, Location, Marks, Package } from '../core/types'
import { isPlausibleEmail, normalizeEmail } from './email'
import {
  allowedUserToWire,
  assertWritable,
  gigToWire,
  itemToWire,
  locationToWire,
  packageToWire,
  parseAllowedUser,
  parseGig,
  parseItem,
  parseLocation,
  parsePackage,
  type GigInput,
  type ItemInput,
  type LocationInput,
  type PackageInput,
  type Parsed,
  type WritableCollection,
} from './schemas'

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Someone else changed a field this user also changed; reload and retry. */
export class ConflictError extends Error {
  readonly fields: readonly string[]
  constructor(fields: readonly string[]) {
    super(`Changed elsewhere: ${fields.join(', ')}`)
    this.name = 'ConflictError'
    this.fields = fields
  }
}

export class NotFoundError extends Error {
  constructor(collectionName: string, id: string) {
    super(`${collectionName}/${id} not found`)
    this.name = 'NotFoundError'
  }
}

export type InvalidStateReason =
  | 'not-confirmed' // Lähti only on a confirmed gig
  | 'departed-not-returned' // equipment is out: cannot cancel or make tentative
  | 'not-deletable' // only tentative gigs that never left can be deleted
  | 'line-missing'
  | 'unreadable' // the stored document does not match the schema
  | 'invalid-email'
  | 'already-exists'
  | 'cannot-remove-self'

export class InvalidStateError extends Error {
  readonly reason: InvalidStateReason
  constructor(reason: InvalidStateReason, detail?: string) {
    super(detail ? `${reason}: ${detail}` : reason)
    this.name = 'InvalidStateError'
    this.reason = reason
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lower-cased email of the signed-in user; the rules compare against this. */
export type Author = string

/** Whether a location is the company's own studio (affects `awaitingReturn`). */
export type IsOwnStudio = (locationId: string) => boolean

const stamp = (by: Author) => ({ updatedBy: normalizeEmail(by), updatedAt: serverTimestamp() })

type Rec = Record<string, unknown>

/** Structural equality for plain JSON-like values (domain objects). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a).filter((k) => (a as Rec)[k] !== undefined)
  const kb = Object.keys(b).filter((k) => (b as Rec)[k] !== undefined)
  if (ka.length !== kb.length) return false
  return ka.every((k) => deepEqual((a as Rec)[k], (b as Rec)[k]))
}

const IGNORED_KEYS = ['id', 'email', 'updatedAt', 'updatedBy']

/** Keys whose values differ between two versions (ignores ids and write stamps). */
export function changedKeys<T extends object>(before: T, after: T): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const k of IGNORED_KEYS) keys.delete(k)
  return [...keys].filter((k) => !deepEqual((before as Rec)[k], (after as Rec)[k])).sort()
}

/** Removes write stamps so they are neither compared nor written as edits. */
function withoutStamps<T extends object>(v: T): T {
  const { updatedAt: _a, updatedBy: _b, ...rest } = v as T & Rec
  return rest as T
}

/** `current` with the changed keys taken from `edited`: the document after the write. */
function applyChanges<T extends object>(current: T, edited: T, changed: readonly string[]): T {
  const next: Rec = { ...(current as Rec) }
  for (const k of changed) {
    const v = (edited as Rec)[k]
    if (v === undefined) delete next[k]
    else next[k] = v
  }
  return next as T
}

interface EditSpec<T extends object> {
  db: Firestore
  collectionName: WritableCollection
  id: string
  parse: (id: string, data: unknown) => Parsed<T>
  baseline: T
  edited: T
  toWire: (value: T) => Rec
  /** Throws `InvalidStateError` if the change is not allowed from the stored state. */
  check?: (current: T, next: T) => void
  /** Derived fields, computed from the document as it will be after the write. */
  derive?: (next: T) => Rec
  /** Further documents to read and update in the same transaction. */
  related?: {
    refs: readonly DocumentReference[]
    apply: (tx: Transaction, next: T, snaps: readonly DocumentSnapshot[]) => void
  }
  by: Author
}

/** Saves an edit; returns the changed field names (empty if nothing changed). */
async function saveEdit<T extends object>(spec: EditSpec<T>): Promise<string[]> {
  const changed = changedKeys(spec.baseline, spec.edited)
  if (changed.length === 0) return []
  const ref = doc(spec.db, spec.collectionName, spec.id)
  await runTransaction(spec.db, async (tx) => {
    // All reads come before any write in a transaction.
    const snap = await tx.get(ref)
    const relatedSnaps = await Promise.all((spec.related?.refs ?? []).map((r) => tx.get(r)))
    if (!snap.exists()) throw new NotFoundError(spec.collectionName, spec.id)
    const parsed = spec.parse(spec.id, snap.data({ serverTimestamps: 'estimate' }))
    if (!parsed.ok) throw new InvalidStateError('unreadable', parsed.issue.message)
    const current = withoutStamps(parsed.value)
    const conflicts = changed.filter(
      (k) => !deepEqual((current as Rec)[k], (spec.baseline as Rec)[k]),
    )
    if (conflicts.length > 0) throw new ConflictError(conflicts)
    const next = applyChanges(current, spec.edited, changed)
    spec.check?.(current, next)
    const wire = spec.toWire(next)
    const derived = spec.derive?.(next) ?? {}
    assertWritable(spec.collectionName, { ...wire, ...derived })
    const update: Rec = {}
    for (const k of changed) update[k] = wire[k] === undefined ? deleteField() : wire[k]
    tx.update(ref, { ...update, ...derived, ...stamp(spec.by) })
    spec.related?.apply(tx, next, relatedSnaps)
  })
  return changed
}

async function create(
  db: Firestore,
  collectionName: WritableCollection,
  wire: Rec,
  by: Author,
  id: string = newId(db, collectionName),
): Promise<string> {
  assertWritable(collectionName, wire)
  await setDoc(doc(db, collectionName, id), { ...wire, ...stamp(by) })
  return id
}

/** Generates a new document id without writing. */
export function newId(db: Firestore, collectionName: WritableCollection): string {
  return doc(collection(db, collectionName)).id
}

// ---------------------------------------------------------------------------
// Items, locations, packages
// ---------------------------------------------------------------------------

export function createItem(db: Firestore, input: ItemInput, by: Author): Promise<string> {
  return create(db, 'items', itemToWire(input), by)
}

export function saveItem(db: Firestore, baseline: Item, edited: Item, by: Author) {
  return saveEdit({
    db,
    collectionName: 'items',
    id: baseline.id,
    parse: parseItem,
    baseline: withoutStamps(baseline),
    edited: withoutStamps(edited),
    toWire: itemToWire,
    by,
  })
}

export function createLocation(db: Firestore, input: LocationInput, by: Author) {
  return create(db, 'locations', locationToWire(input), by)
}

/**
 * Saves a location. If "own studio" changes, `awaitingReturn` of every gig at the
 * location is recomputed in the same transaction (plan 2.3).
 */
export async function saveLocation(
  db: Firestore,
  baseline: Location,
  edited: Location,
  by: Author,
) {
  const studioFlagChanges = baseline.isOwnStudio !== edited.isOwnStudio
  // A web transaction cannot query, so find the gigs first and read them inside it.
  const gigRefs = studioFlagChanges
    ? (
        await getDocs(query(collection(db, 'gigs'), where('locationId', '==', baseline.id)))
      ).docs.map((d) => d.ref)
    : []
  return saveEdit({
    db,
    collectionName: 'locations',
    id: baseline.id,
    parse: parseLocation,
    baseline: withoutStamps(baseline),
    edited: withoutStamps(edited),
    toWire: locationToWire,
    related: {
      refs: gigRefs,
      apply: (tx, next, snaps) => {
        for (const snap of snaps) {
          if (!snap.exists()) continue
          const raw = snap.data({ serverTimestamps: 'estimate' })
          const parsed = parseGig(snap.id, raw)
          if (!parsed.ok || parsed.value.locationId !== baseline.id) continue
          const awaiting = computeAwaitingReturn(parsed.value, next.isOwnStudio)
          if ((raw as { awaitingReturn?: unknown }).awaitingReturn !== awaiting) {
            tx.update(snap.ref, { awaitingReturn: awaiting, ...stamp(by) })
          }
        }
      },
    },
    by,
  })
}

export function createPackage(db: Firestore, input: PackageInput, by: Author) {
  return create(db, 'packages', packageToWire(input), by)
}

export function savePackage(db: Firestore, baseline: Package, edited: Package, by: Author) {
  return saveEdit({
    db,
    collectionName: 'packages',
    id: baseline.id,
    parse: parsePackage,
    baseline: withoutStamps(baseline),
    edited: withoutStamps(edited),
    toWire: packageToWire,
    by,
  })
}

export async function deletePackage(db: Firestore, id: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'packages', id)
    if (!(await tx.get(ref)).exists()) throw new NotFoundError('packages', id)
    tx.delete(ref)
  })
}

// ---------------------------------------------------------------------------
// Gigs
// ---------------------------------------------------------------------------

const isOut = (g: Marks) => g.departedAt !== undefined && g.returnedAt === undefined

export function createGig(
  db: Firestore,
  input: GigInput,
  isOwnStudio: IsOwnStudio,
  by: Author,
  id: string = newId(db, 'gigs'),
): Promise<string> {
  const awaitingReturn = computeAwaitingReturn({ ...input, id }, isOwnStudio(input.locationId))
  return create(db, 'gigs', { ...gigToWire(input), awaitingReturn }, by, id)
}

const MARK_KEYS = [
  'departedAt',
  'departedBy',
  'returnedAt',
  'returnedBy',
  'lineMarks',
] as const satisfies readonly (keyof Gig)[]

/**
 * Saves a gig edited in the form. Marks are not edited in the form: they are taken
 * from the stored document, so a mark made after the form was opened is kept.
 * A gig whose equipment is out cannot be cancelled or made tentative (plan 4.5).
 */
export function saveGig(
  db: Firestore,
  baseline: Gig,
  edited: Gig,
  isOwnStudio: IsOwnStudio,
  by: Author,
) {
  const form: Gig = { ...edited }
  for (const k of MARK_KEYS) {
    if (baseline[k] === undefined) delete form[k]
    else Object.assign(form, { [k]: baseline[k] })
  }
  return saveEdit({
    db,
    collectionName: 'gigs',
    id: baseline.id,
    parse: parseGig,
    baseline: withoutStamps(baseline),
    edited: withoutStamps(form),
    toWire: gigToWire,
    check: (current, next) => {
      const toInactive = next.status === 'alustava' || next.status === 'peruttu'
      if (isOut(current) && toInactive && next.status !== current.status) {
        throw new InvalidStateError('departed-not-returned')
      }
    },
    derive: (next) => ({
      awaitingReturn: computeAwaitingReturn(
        { ...next, id: baseline.id },
        isOwnStudio(next.locationId),
      ),
    }),
    by,
  })
}

/** Deletes a tentative gig that never left; anything else is cancelled instead. */
export async function deleteTentativeGig(db: Firestore, id: string): Promise<void> {
  const ref = doc(db, 'gigs', id)
  await runTransaction(db, async (tx) => {
    const gig = await readGig(tx, ref, id)
    if (gig.status !== 'alustava' || gig.departedAt !== undefined) {
      throw new InvalidStateError('not-deletable')
    }
    tx.delete(ref)
  })
}

export type MarkKind = 'departed' | 'returned'

/** `already` when the fact was recorded before: the first mark is kept (first write wins). */
export type MarkResult = { already: false } | { already: true; at: Ms; by: string }

/**
 * Lähti / Palautettu for a whole gig. Departure requires a confirmed gig; return
 * marks a confirmed gig as done (valmis). Pressing again, or two people pressing at
 * once, keeps the first recorded time and author.
 */
export function markGig(
  db: Firestore,
  gigId: string,
  kind: MarkKind,
  isOwnStudio: IsOwnStudio,
  by: Author,
): Promise<MarkResult> {
  const ref = doc(db, 'gigs', gigId)
  const existing = (g: Gig): Marks => g
  return withMarkRace(ref, gigId, kind, existing, () =>
    markGigOnce(db, ref, gigId, kind, isOwnStudio, by),
  )
}

async function markGigOnce(
  db: Firestore,
  ref: DocumentReference,
  gigId: string,
  kind: MarkKind,
  isOwnStudio: IsOwnStudio,
  by: Author,
): Promise<MarkResult> {
  return runTransaction(db, async (tx): Promise<MarkResult> => {
    const gig = await readGig(tx, ref, gigId)
    const prevAt = kind === 'departed' ? gig.departedAt : gig.returnedAt
    const prevBy = kind === 'departed' ? gig.departedBy : gig.returnedBy
    if (prevAt !== undefined) return { already: true, at: prevAt, by: prevBy ?? '' }
    const author = normalizeEmail(by)
    const update: Rec = {}
    let next: Gig
    if (kind === 'departed') {
      if (gig.status !== 'vahvistettu') throw new InvalidStateError('not-confirmed')
      update.departedAt = serverTimestamp()
      update.departedBy = author
      next = { ...gig, departedAt: 0 }
    } else {
      update.returnedAt = serverTimestamp()
      update.returnedBy = author
      next = { ...gig, returnedAt: 0 }
      if (gig.status === 'vahvistettu') {
        update.status = 'valmis'
        next = { ...next, status: 'valmis' }
      }
    }
    update.awaitingReturn = computeAwaitingReturn(next, isOwnStudio(gig.locationId))
    tx.update(ref, { ...update, ...stamp(by) })
    return { already: false }
  })
}

/** Lähti / Palautettu for one line with its own start or end (plan 2.3, `lineMarks`). */
export function markLine(
  db: Firestore,
  gigId: string,
  lineId: string,
  kind: MarkKind,
  by: Author,
): Promise<MarkResult> {
  const ref = doc(db, 'gigs', gigId)
  const existing = (g: Gig): Marks | undefined => g.lineMarks?.[lineId]
  return withMarkRace(ref, gigId, kind, existing, () =>
    markLineOnce(db, ref, gigId, lineId, kind, by),
  )
}

async function markLineOnce(
  db: Firestore,
  ref: DocumentReference,
  gigId: string,
  lineId: string,
  kind: MarkKind,
  by: Author,
): Promise<MarkResult> {
  return runTransaction(db, async (tx): Promise<MarkResult> => {
    const gig = await readGig(tx, ref, gigId)
    if (!gig.lines.some((l) => l.id === lineId)) throw new InvalidStateError('line-missing')
    const m = gig.lineMarks?.[lineId]
    const prevAt = kind === 'departed' ? m?.departedAt : m?.returnedAt
    const prevBy = kind === 'departed' ? m?.departedBy : m?.returnedBy
    if (prevAt !== undefined) return { already: true, at: prevAt, by: prevBy ?? '' }
    const s = stamp(by)
    tx.update(
      ref,
      new FieldPath('lineMarks', lineId, `${kind}At`),
      serverTimestamp(),
      new FieldPath('lineMarks', lineId, `${kind}By`),
      s.updatedBy,
      'updatedBy',
      s.updatedBy,
      'updatedAt',
      s.updatedAt,
    )
    return { already: false }
  })
}

/**
 * Two people pressing the same button at once: the server evaluates the losing
 * write against the winner's document, and the rules (marks are kept once recorded)
 * deny it before the transaction can retry. Re-read and report the winner's mark.
 */
async function withMarkRace(
  ref: DocumentReference,
  gigId: string,
  kind: MarkKind,
  marksOf: (g: Gig) => Marks | undefined,
  attempt: () => Promise<MarkResult>,
): Promise<MarkResult> {
  try {
    return await attempt()
  } catch (e) {
    if (!(e instanceof FirebaseError && e.code === 'permission-denied')) throw e
    const snap = await getDoc(ref)
    const parsed = snap.exists()
      ? parseGig(gigId, snap.data({ serverTimestamps: 'estimate' }))
      : null
    const m = parsed?.ok ? marksOf(parsed.value) : undefined
    const at = kind === 'departed' ? m?.departedAt : m?.returnedAt
    const by = kind === 'departed' ? m?.departedBy : m?.returnedBy
    if (at === undefined) throw e
    return { already: true, at, by: by ?? '' }
  }
}

async function readGig(tx: Transaction, ref: DocumentReference, gigId: string): Promise<Gig> {
  const snap = await tx.get(ref)
  if (!snap.exists()) throw new NotFoundError('gigs', gigId)
  const parsed = parseGig(gigId, snap.data({ serverTimestamps: 'estimate' }))
  if (!parsed.ok) throw new InvalidStateError('unreadable', parsed.issue.message)
  return parsed.value
}

// ---------------------------------------------------------------------------
// Users and settings (Asetukset)
// ---------------------------------------------------------------------------

/** Adds a Google account to the allowlist. The id is the lower-cased email. */
export async function addAllowedUser(
  db: Firestore,
  input: { email: string; name: string; initials: string },
  by: Author,
): Promise<string> {
  if (!isPlausibleEmail(input.email)) throw new InvalidStateError('invalid-email')
  const id = normalizeEmail(input.email)
  const wire = allowedUserToWire(input)
  assertWritable('allowedUsers', wire)
  const ref = doc(db, 'allowedUsers', id)
  // A transaction, not setDoc: the rules allow update too, so setDoc would silently
  // overwrite an existing user.
  await runTransaction(db, async (tx) => {
    if ((await tx.get(ref)).exists()) throw new InvalidStateError('already-exists')
    tx.set(ref, { ...wire, ...stamp(by) })
  })
  return id
}

export function saveAllowedUser(
  db: Firestore,
  baseline: AllowedUser,
  edited: AllowedUser,
  by: Author,
) {
  return saveEdit({
    db,
    collectionName: 'allowedUsers',
    id: baseline.email,
    parse: parseAllowedUser,
    baseline: withoutStamps(baseline),
    edited: withoutStamps({ ...edited, email: baseline.email }),
    toWire: allowedUserToWire,
    by,
  })
}

/** Removes a user from the allowlist. Nobody can remove themselves. */
export async function removeAllowedUser(db: Firestore, email: string, by: Author): Promise<void> {
  const id = normalizeEmail(email)
  if (id === normalizeEmail(by)) throw new InvalidStateError('cannot-remove-self')
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'allowedUsers', id)
    if (!(await tx.get(ref)).exists()) throw new NotFoundError('allowedUsers', id)
    tx.delete(ref)
  })
}

/** Records that a JSON backup was downloaded (plan 6.4). */
export async function recordBackup(db: Firestore, by: Author): Promise<void> {
  await setDoc(
    doc(db, 'settings', 'app'),
    { lastBackupAt: serverTimestamp(), ...stamp(by) },
    { merge: true },
  )
}
