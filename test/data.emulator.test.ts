/**
 * The data layer (src/data) against the Firestore emulator with the real security
 * rules: every write the app makes must pass the rules, edits must detect
 * conflicting changes, and marks must never be overwritten by a form save.
 */
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { gigBResolved, gigE, items } from '../src/core/__fixtures__/scenario'
import type { Gig, Item } from '../src/core/types'
import { parseGig, parseItem, ValidationError } from '../src/data/schemas'
import { HOUR } from '../src/core/time'
import { DataStore } from '../src/data/store'
import {
  addAllowedUser,
  ConflictError,
  createGig,
  createItem,
  createLocation,
  deleteTentativeGig,
  InvalidStateError,
  markGig,
  markLine,
  recordBackup,
  removeAllowedUser,
  saveGig,
  saveItem,
  saveLocation,
} from '../src/data/writes'
import { parseLocation } from '../src/data/schemas'

const ANNA = 'anna@example.com'
const EXTERNAL = () => false
const OWN = () => true
const JUSSI = 'jussi@example.com'
let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-roudari',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    for (const [email, name] of [
      [ANNA, 'Anna'],
      [JUSSI, 'Jussi'],
    ] as const) {
      await setDoc(doc(db, 'allowedUsers', email), {
        name,
        initials: name.slice(0, 2),
        updatedBy: email,
        updatedAt: serverTimestamp(),
      })
    }
  })
})

function as(email: string): Firestore {
  return env
    .authenticatedContext(`uid-${email}`, {
      email,
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    })
    .firestore() as unknown as Firestore
}

async function readItem(db: Firestore, id: string): Promise<Item> {
  const snap = await getDoc(doc(db, 'items', id))
  const r = parseItem(id, snap.data({ serverTimestamps: 'estimate' }))
  if (!r.ok) throw new Error(r.issue.message)
  return r.value
}

async function readGig(db: Firestore, id: string): Promise<Gig & { awaitingReturn?: boolean }> {
  const snap = await getDoc(doc(db, 'gigs', id))
  const data = snap.data({ serverTimestamps: 'estimate' })
  const r = parseGig(id, data)
  if (!r.ok) throw new Error(r.issue.message)
  return { ...r.value, awaitingReturn: (data as { awaitingReturn: boolean }).awaitingReturn }
}

const kam01Input = () => {
  const { id: _id, ...input } = items[0]!
  return input
}

describe('items', () => {
  it('creates an item that passes the rules and reads back identically', async () => {
    const db = as(ANNA)
    const id = await createItem(db, kam01Input(), ANNA)
    const back = await readItem(db, id)
    expect(back).toMatchObject({ ...kam01Input(), id, updatedBy: ANNA })
  })

  it('writes only changed fields and keeps a concurrent edit of another field', async () => {
    const id = await createItem(as(ANNA), kam01Input(), ANNA)
    const baseline = await readItem(as(ANNA), id)
    // Jussi changes the notes while Anna has the form open.
    await saveItem(as(JUSSI), baseline, { ...baseline, notes: 'Jussin huomio' }, JUSSI)
    // Anna changes the serial number from her stale baseline: no conflict.
    const changed = await saveItem(as(ANNA), baseline, { ...baseline, serialNo: 'SN 1' }, ANNA)
    expect(changed).toEqual(['serialNo'])
    const after = await readItem(as(ANNA), id)
    expect(after).toMatchObject({ notes: 'Jussin huomio', serialNo: 'SN 1', updatedBy: ANNA })
  })

  it('aborts with ConflictError when the same field changed elsewhere', async () => {
    const id = await createItem(as(ANNA), kam01Input(), ANNA)
    const baseline = await readItem(as(ANNA), id)
    await saveItem(as(JUSSI), baseline, { ...baseline, name: 'Sony FX6 (Jussi)' }, JUSSI)
    const attempt = saveItem(as(ANNA), baseline, { ...baseline, name: 'Sony FX6 (Anna)' }, ANNA)
    await expect(attempt).rejects.toBeInstanceOf(ConflictError)
    await expect(attempt).rejects.toMatchObject({ fields: ['name'] })
    expect((await readItem(as(ANNA), id)).name).toBe('Sony FX6 (Jussi)')
  })

  it('clears an optional field with deleteField', async () => {
    const id = await createItem(as(ANNA), { ...kam01Input(), serialNo: 'SN 9' }, ANNA)
    const baseline = await readItem(as(ANNA), id)
    const { serialNo: _drop, ...without } = baseline
    await saveItem(as(ANNA), baseline, without, ANNA)
    expect('serialNo' in (await readItem(as(ANNA), id))).toBe(false)
  })
})

describe('gigs and marks', () => {
  const external = () => {
    const { id: _id, ...b } = gigBResolved()
    return b
  }

  it('creates a gig with awaitingReturn derived from status and location', async () => {
    const id = await createGig(as(ANNA), external(), EXTERNAL, ANNA)
    expect((await readGig(as(ANNA), id)).awaitingReturn).toBe(true)
    const own = await createGig(as(ANNA), external(), OWN, ANNA)
    expect((await readGig(as(ANNA), own)).awaitingReturn).toBe(false)
  })

  it('Lähti requires a confirmed gig; Palautettu makes it done and not awaiting return', async () => {
    const tentative = await createGig(
      as(ANNA),
      { ...external(), status: 'alustava' },
      EXTERNAL,
      ANNA,
    )
    await expect(markGig(as(ANNA), tentative, 'departed', EXTERNAL, ANNA)).rejects.toBeInstanceOf(
      InvalidStateError,
    )
    const id = await createGig(as(ANNA), external(), EXTERNAL, ANNA)
    await markGig(as(ANNA), id, 'departed', EXTERNAL, ANNA)
    await markGig(as(JUSSI), id, 'returned', EXTERNAL, JUSSI)
    const g = await readGig(as(ANNA), id)
    expect(g).toMatchObject({
      status: 'valmis',
      departedBy: ANNA,
      returnedBy: JUSSI,
      awaitingReturn: false,
    })
    expect(g.departedAt).toBeTypeOf('number')
  })

  it('a form save never overwrites marks made after the form was opened', async () => {
    const { id: _id, ...e } = gigE()
    const id = await createGig(as(ANNA), e, EXTERNAL, ANNA)
    const baseline = await readGig(as(ANNA), id)
    await markGig(as(JUSSI), id, 'departed', EXTERNAL, JUSSI)
    await markLine(as(JUSSI), id, 'e3', 'returned', JUSSI)
    const { awaitingReturn: _a, ...base } = baseline
    await saveGig(as(ANNA), base, { ...base, notes: 'Lisätty muistiinpano' }, EXTERNAL, ANNA)
    const g = await readGig(as(ANNA), id)
    expect(g).toMatchObject({
      notes: 'Lisätty muistiinpano',
      departedBy: JUSSI,
      lineMarks: { e3: { returnedBy: JUSSI } },
    })
  })

  it('a line mark for a line that does not exist is rejected', async () => {
    const id = await createGig(as(ANNA), external(), EXTERNAL, ANNA)
    await expect(markLine(as(ANNA), id, 'nope', 'returned', ANNA)).rejects.toBeInstanceOf(
      InvalidStateError,
    )
  })
})

describe('live store', () => {
  it('loads recent and awaiting-return gigs and reports invalid documents', async () => {
    const db = as(ANNA)
    const now = Date.UTC(2026, 11, 1)
    const { id: _id, ...b } = gigBResolved()
    const recent = await createGig(db, b, EXTERNAL, ANNA)
    await env.withSecurityRulesDisabled(async (ctx) => {
      const raw = ctx.firestore() as unknown as Firestore
      await setDoc(doc(raw, 'items', 'broken'), {
        tag: '',
        updatedBy: ANNA,
        updatedAt: serverTimestamp(),
      })
    })
    const store = new DataStore(db, () => now)
    store.start()
    try {
      await expect.poll(() => store.getSnapshot().status, { timeout: 10_000 }).toBe('ready')
      const s = store.getSnapshot()
      expect(s.gigs.map((g) => g.id)).toEqual([recent])
      expect(s.users.map((u) => u.email).sort()).toEqual([ANNA, JUSSI])
      expect(s.issues).toEqual([expect.objectContaining({ collection: 'items', id: 'broken' })])
    } finally {
      store.stop()
    }
  })
})

describe('review regressions: gigs', () => {
  const external = () => {
    const { id: _id, ...b } = gigBResolved()
    return b
  }
  const baselineOf = async (id: string): Promise<Gig> => {
    const { awaitingReturn: _a, ...g } = await readGig(as(ANNA), id)
    return g
  }

  it('cancelling in a stale form after a concurrent Lähti is refused', async () => {
    const id = await createGig(as(ANNA), external(), EXTERNAL, ANNA)
    const base = await baselineOf(id)
    await markGig(as(JUSSI), id, 'departed', EXTERNAL, JUSSI)
    await expect(
      saveGig(as(ANNA), base, { ...base, status: 'peruttu' }, EXTERNAL, ANNA),
    ).rejects.toMatchObject({ reason: 'departed-not-returned' })
    expect((await readGig(as(ANNA), id)).status).toBe('vahvistettu')
  })

  it('a form save after a concurrent Palautettu keeps awaitingReturn false', async () => {
    const id = await createGig(as(ANNA), external(), EXTERNAL, ANNA)
    await markGig(as(ANNA), id, 'departed', EXTERNAL, ANNA)
    const base = await baselineOf(id)
    await markGig(as(JUSSI), id, 'returned', EXTERNAL, JUSSI)
    await saveGig(as(ANNA), base, { ...base, notes: 'x' }, EXTERNAL, ANNA)
    expect(await readGig(as(ANNA), id)).toMatchObject({
      status: 'valmis',
      awaitingReturn: false,
      notes: 'x',
    })
  })

  it('after return the gig can be cancelled', async () => {
    const id = await createGig(as(ANNA), external(), EXTERNAL, ANNA)
    await markGig(as(ANNA), id, 'departed', EXTERNAL, ANNA)
    await markGig(as(ANNA), id, 'returned', EXTERNAL, ANNA)
    const base = await baselineOf(id)
    await saveGig(as(ANNA), base, { ...base, status: 'peruttu' }, EXTERNAL, ANNA)
    expect((await readGig(as(ANNA), id)).status).toBe('peruttu')
  })

  it('a second Lähti keeps the first time and author', async () => {
    const id = await createGig(as(ANNA), external(), EXTERNAL, ANNA)
    expect(await markGig(as(ANNA), id, 'departed', EXTERNAL, ANNA)).toEqual({ already: false })
    const first = await readGig(as(ANNA), id)
    const again = await markGig(as(JUSSI), id, 'departed', EXTERNAL, JUSSI)
    expect(again).toEqual({ already: true, at: first.departedAt, by: ANNA })
    expect(await readGig(as(ANNA), id)).toMatchObject({
      departedBy: ANNA,
      departedAt: first.departedAt,
    })
  })

  it('two concurrent Lähti presses record exactly one author', async () => {
    const id = await createGig(as(ANNA), external(), EXTERNAL, ANNA)
    const results = await Promise.all([
      markGig(as(ANNA), id, 'departed', EXTERNAL, ANNA),
      markGig(as(JUSSI), id, 'departed', EXTERNAL, JUSSI),
    ])
    expect(results.filter((r) => !r.already)).toHaveLength(1)
  })

  it('a second line Palautettu keeps the first mark', async () => {
    const { id: _id, ...e } = gigE()
    const id = await createGig(as(ANNA), e, EXTERNAL, ANNA)
    await markLine(as(ANNA), id, 'e3', 'returned', ANNA)
    const again = await markLine(as(JUSSI), id, 'e3', 'returned', JUSSI)
    expect(again).toMatchObject({ already: true, by: ANNA })
  })

  it('only a tentative gig that never left can be deleted', async () => {
    const tentative = await createGig(
      as(ANNA),
      { ...external(), status: 'alustava' },
      EXTERNAL,
      ANNA,
    )
    await deleteTentativeGig(as(ANNA), tentative)
    expect((await getDoc(doc(as(ANNA), 'gigs', tentative))).exists()).toBe(false)
    const confirmed = await createGig(as(ANNA), external(), EXTERNAL, ANNA)
    await expect(deleteTentativeGig(as(ANNA), confirmed)).rejects.toMatchObject({
      reason: 'not-deletable',
    })
  })

  it('an invalid gig is rejected before writing and nothing is created', async () => {
    const bad = { ...external(), lines: [{ id: '', itemId: 'kam01', qty: 0 }] }
    await expect(createGig(as(ANNA), bad, EXTERNAL, ANNA)).rejects.toBeInstanceOf(ValidationError)
    expect((await getDocs(collection(as(ANNA), 'gigs'))).size).toBe(0)
  })
})

describe('review regressions: locations, users, settings, store', () => {
  it('changing "own studio" recomputes awaitingReturn of the location’s gigs', async () => {
    const db = as(ANNA)
    const locId = await createLocation(
      db,
      { name: 'Varasto', isOwnStudio: true, rooms: [], archived: false },
      ANNA,
    )
    const { id: _id, ...b } = gigBResolved()
    const isOwn = (want: boolean) => (l: string) => (l === locId ? want : false)
    const gigId = await createGig(db, { ...b, locationId: locId }, isOwn(true), ANNA)
    expect((await readGig(db, gigId)).awaitingReturn).toBe(false)

    const readLoc = async () => {
      const snap = await getDoc(doc(db, 'locations', locId))
      const r = parseLocation(locId, snap.data({ serverTimestamps: 'estimate' }))
      if (!r.ok) throw new Error(r.issue.message)
      return r.value
    }
    const loc = await readLoc()
    await saveLocation(db, loc, { ...loc, isOwnStudio: false }, ANNA)
    expect((await readGig(db, gigId)).awaitingReturn).toBe(true)
    const loc2 = await readLoc()
    await saveLocation(db, loc2, { ...loc2, isOwnStudio: true }, ANNA)
    expect((await readGig(db, gigId)).awaitingReturn).toBe(false)
  })

  it('adds users with a lower-case id and refuses duplicates and self-removal', async () => {
    const db = as(ANNA)
    const id = await addAllowedUser(
      db,
      { email: ' Mikko@Example.com ', name: 'Mikko', initials: 'mk' },
      ANNA,
    )
    expect(id).toBe('mikko@example.com')
    expect((await getDoc(doc(db, 'allowedUsers', id))).data()).toMatchObject({ initials: 'MK' })
    await expect(
      addAllowedUser(db, { email: 'mikko@example.com', name: 'M', initials: 'M' }, ANNA),
    ).rejects.toMatchObject({ reason: 'already-exists' })
    await expect(
      addAllowedUser(db, { email: 'not-an-email', name: 'M', initials: 'M' }, ANNA),
    ).rejects.toMatchObject({ reason: 'invalid-email' })
    await expect(removeAllowedUser(db, 'Anna@Example.com', ANNA)).rejects.toMatchObject({
      reason: 'cannot-remove-self',
    })
    await removeAllowedUser(db, JUSSI, ANNA)
    expect((await getDoc(doc(db, 'allowedUsers', JUSSI))).exists()).toBe(false)
  })

  it('records a backup time through the rules', async () => {
    await recordBackup(as(ANNA), ANNA)
    const data = (await getDoc(doc(as(ANNA), 'settings', 'app'))).data()
    expect(data?.lastBackupAt).toBeInstanceOf(Timestamp)
  })

  it('reports an invalid gig matching both queries only once', async () => {
    const now = Date.UTC(2026, 11, 1)
    await env.withSecurityRulesDisabled(async (ctx) => {
      const raw = ctx.firestore() as unknown as Firestore
      await setDoc(doc(raw, 'gigs', 'bad'), {
        name: '',
        equipEnd: Timestamp.fromMillis(now + HOUR),
        awaitingReturn: true,
      })
    })
    const store = new DataStore(as(ANNA), () => now)
    store.start()
    try {
      await expect.poll(() => store.getSnapshot().status, { timeout: 10_000 }).toBe('ready')
      expect(store.getSnapshot().issues).toEqual([
        expect.objectContaining({ collection: 'gigs', id: 'bad' }),
      ])
    } finally {
      store.stop()
    }
  })
})
