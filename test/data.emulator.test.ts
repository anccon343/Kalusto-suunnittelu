/**
 * The data layer (src/data) against the Firestore emulator with the real security
 * rules: every write the app makes must pass the rules, edits must detect
 * conflicting changes, and marks must never be overwritten by a form save.
 */
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { gigBResolved, gigE, items } from '../src/core/__fixtures__/scenario'
import type { Gig, Item } from '../src/core/types'
import { parseGig, parseItem } from '../src/data/schemas'
import { DataStore } from '../src/data/store'
import {
  ConflictError,
  createGig,
  createItem,
  InvalidStateError,
  markGig,
  markLine,
  saveGig,
  saveItem,
} from '../src/data/writes'

const ANNA = 'anna@example.com'
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
    const id = await createGig(as(ANNA), external(), false, ANNA)
    expect((await readGig(as(ANNA), id)).awaitingReturn).toBe(true)
    const own = await createGig(as(ANNA), external(), true, ANNA)
    expect((await readGig(as(ANNA), own)).awaitingReturn).toBe(false)
  })

  it('Lähti requires a confirmed gig; Palautettu makes it done and not awaiting return', async () => {
    const tentative = await createGig(as(ANNA), { ...external(), status: 'alustava' }, false, ANNA)
    await expect(markGig(as(ANNA), tentative, 'departed', false, ANNA)).rejects.toBeInstanceOf(
      InvalidStateError,
    )
    const id = await createGig(as(ANNA), external(), false, ANNA)
    await markGig(as(ANNA), id, 'departed', false, ANNA)
    await markGig(as(JUSSI), id, 'returned', false, JUSSI)
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
    const id = await createGig(as(ANNA), e, false, ANNA)
    const baseline = await readGig(as(ANNA), id)
    await markGig(as(JUSSI), id, 'departed', false, JUSSI)
    await markLine(as(JUSSI), id, 'e3', 'returned', JUSSI)
    const { awaitingReturn: _a, ...base } = baseline
    await saveGig(as(ANNA), base, { ...base, notes: 'Lisätty muistiinpano' }, false, ANNA)
    const g = await readGig(as(ANNA), id)
    expect(g).toMatchObject({
      notes: 'Lisätty muistiinpano',
      departedBy: JUSSI,
      lineMarks: { e3: { returnedBy: JUSSI } },
    })
  })

  it('a line mark for a line that does not exist is rejected', async () => {
    const id = await createGig(as(ANNA), external(), false, ANNA)
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
    const recent = await createGig(db, b, false, ANNA)
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
