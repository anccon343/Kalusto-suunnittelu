/**
 * Firestore security rules (firestore.rules) against the local emulator.
 * Run with `pnpm test:rules`; it starts the emulator for a demo project, so these
 * tests can never touch the real database.
 */
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const PROJECT_ID = 'demo-roudari'
const ANNA = 'anna@example.com'
const STRANGER = 'stranger@example.com'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
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
    await setDoc(doc(db, 'allowedUsers', ANNA), user('Anna', ANNA))
    await setDoc(doc(db, 'allowedUsers', 'jussi@example.com'), user('Jussi', 'jussi@example.com'))
    await setDoc(doc(db, 'gigs', 'confirmed'), gig('jussi@example.com', { status: 'vahvistettu' }))
    await setDoc(doc(db, 'gigs', 'tentative'), gig('jussi@example.com'))
    await setDoc(doc(db, 'items', 'kam01'), item('jussi@example.com'))
  })
})

type TokenOverrides = { provider?: 'google.com' | 'password'; verified?: boolean }

function signedIn(email: string, o: TokenOverrides = {}): Firestore {
  const db = env
    .authenticatedContext(`uid-${email}`, {
      email,
      email_verified: o.verified ?? true,
      firebase: { sign_in_provider: o.provider ?? 'google.com' },
    })
    .firestore()
  // The test context returns the compat type; the modular functions accept it at runtime,
  // as documented for @firebase/rules-unit-testing.
  return db as unknown as Firestore
}

function stamp(by: string) {
  return { updatedBy: by, updatedAt: serverTimestamp() }
}

function user(name: string, by: string) {
  return { name, initials: name.slice(0, 2).toUpperCase(), ...stamp(by) }
}

const ts = (iso: string) => Timestamp.fromDate(new Date(iso))

function item(by: string, extra: Record<string, unknown> = {}) {
  return {
    tag: 'KAM-01',
    name: 'Sony FX6',
    category: 'Kamerat',
    quantity: 1,
    condition: 'ok',
    homeLocationId: 'studio',
    archived: false,
    ...stamp(by),
    ...extra,
  }
}

function gig(by: string, extra: Record<string, unknown> = {}) {
  return {
    name: 'Hybridiseminaari',
    status: 'alustava',
    locationId: 'clarion',
    responsible: by,
    crew: [],
    equipStart: ts('2026-11-30T12:00:00Z'),
    eventStart: ts('2026-12-01T08:00:00Z'),
    eventEnd: ts('2026-12-01T14:00:00Z'),
    equipEnd: ts('2026-12-02T10:00:00Z'),
    lines: [],
    awaitingReturn: false,
    ...stamp(by),
    ...extra,
  }
}

describe('who gets in', () => {
  it('denies unauthenticated users', async () => {
    const db = env.unauthenticatedContext().firestore() as unknown as Firestore
    await assertFails(getDoc(doc(db, 'items', 'kam01')))
  })

  it('denies a Google account that is not on the allowlist', async () => {
    await assertFails(getDoc(doc(signedIn(STRANGER), 'items', 'kam01')))
  })

  it('allows a listed Google account, also when the token email has capitals', async () => {
    await assertSucceeds(getDoc(doc(signedIn(ANNA), 'items', 'kam01')))
    await assertSucceeds(getDoc(doc(signedIn('Anna@Example.com'), 'items', 'kam01')))
  })

  it('denies other sign-in providers and unverified emails', async () => {
    await assertFails(getDoc(doc(signedIn(ANNA, { provider: 'password' }), 'items', 'kam01')))
    await assertFails(getDoc(doc(signedIn(ANNA, { verified: false }), 'items', 'kam01')))
  })

  it('denies collections the app does not use', async () => {
    await assertFails(setDoc(doc(signedIn(ANNA), 'secrets', 'x'), { a: 1 }))
    await assertFails(getDoc(doc(signedIn(ANNA), 'secrets', 'x')))
  })
})

describe('write stamps', () => {
  it('requires updatedBy = own email and updatedAt = server time', async () => {
    const db = signedIn(ANNA)
    await assertSucceeds(setDoc(doc(db, 'items', 'kam02'), item(ANNA, { tag: 'KAM-02' })))
    await assertFails(setDoc(doc(db, 'items', 'kam03'), item('jussi@example.com')))
    await assertFails(
      setDoc(doc(db, 'items', 'kam03'), item(ANNA, { updatedAt: ts('2026-11-23T12:00:00Z') })),
    )
    const { updatedBy: _omit, ...noStamp } = item(ANNA)
    await assertFails(setDoc(doc(db, 'items', 'kam03'), noStamp))
  })

  it('applies to field-path updates such as departure marks', async () => {
    const db = signedIn(ANNA)
    await assertSucceeds(
      updateDoc(doc(db, 'gigs', 'confirmed'), {
        departedAt: serverTimestamp(),
        departedBy: ANNA,
        ...stamp(ANNA),
      }),
    )
    await assertFails(updateDoc(doc(db, 'gigs', 'confirmed'), { departedBy: ANNA }))
  })
})

describe('items', () => {
  it('validates basic shape', async () => {
    const db = signedIn(ANNA)
    await assertFails(setDoc(doc(db, 'items', 'x'), item(ANNA, { quantity: 0 })))
    await assertFails(setDoc(doc(db, 'items', 'x'), item(ANNA, { quantity: 1.5 })))
    await assertFails(setDoc(doc(db, 'items', 'x'), item(ANNA, { condition: 'kadonnut' })))
    await assertFails(setDoc(doc(db, 'items', 'x'), item(ANNA, { tag: '' })))
    await assertSucceeds(
      setDoc(
        doc(db, 'items', 'x'),
        item(ANNA, { condition: 'huollossa', conditionUntil: ts('2026-12-04T14:00:00Z') }),
      ),
    )
  })

  it('cannot be deleted (archived instead)', async () => {
    await assertFails(deleteDoc(doc(signedIn(ANNA), 'items', 'kam01')))
    await assertSucceeds(
      updateDoc(doc(signedIn(ANNA), 'items', 'kam01'), { archived: true, ...stamp(ANNA) }),
    )
  })
})

describe('gigs', () => {
  it('rejects times out of order', async () => {
    const db = signedIn(ANNA)
    await assertFails(
      setDoc(doc(db, 'gigs', 'x'), gig(ANNA, { eventStart: ts('2026-11-30T11:00:00Z') })),
    )
    await assertFails(
      setDoc(doc(db, 'gigs', 'x'), gig(ANNA, { eventEnd: ts('2026-12-01T08:00:00Z') })),
    )
    await assertSucceeds(setDoc(doc(db, 'gigs', 'x'), gig(ANNA)))
  })

  it('rejects an unknown status', async () => {
    await assertFails(setDoc(doc(signedIn(ANNA), 'gigs', 'x'), gig(ANNA, { status: 'poistettu' })))
  })

  it('only tentative gigs can be deleted', async () => {
    await assertSucceeds(deleteDoc(doc(signedIn(ANNA), 'gigs', 'tentative')))
    await assertFails(deleteDoc(doc(signedIn(ANNA), 'gigs', 'confirmed')))
  })
})

describe('allowedUsers', () => {
  it('lets a user add another user with a lower-case id', async () => {
    const db = signedIn(ANNA)
    await assertSucceeds(setDoc(doc(db, 'allowedUsers', 'mikko@example.com'), user('Mikko', ANNA)))
    await assertFails(setDoc(doc(db, 'allowedUsers', 'Mikko@Example.com'), user('Mikko', ANNA)))
    await assertFails(
      setDoc(doc(db, 'allowedUsers', 'x@example.com'), { ...user('X', ANNA), admin: true }),
    )
  })

  it('lets a user remove others but never themselves', async () => {
    const db = signedIn(ANNA)
    await assertFails(deleteDoc(doc(db, 'allowedUsers', ANNA)))
    await assertSucceeds(deleteDoc(doc(db, 'allowedUsers', 'jussi@example.com')))
  })

  it('a stranger cannot add themselves', async () => {
    await assertFails(
      setDoc(doc(signedIn(STRANGER), 'allowedUsers', STRANGER), user('S', STRANGER)),
    )
  })
})

describe('settings', () => {
  it('only the app document, with a stamp', async () => {
    const db = signedIn(ANNA)
    await assertSucceeds(
      setDoc(doc(db, 'settings', 'app'), { lastBackupAt: serverTimestamp(), ...stamp(ANNA) }),
    )
    await assertFails(setDoc(doc(db, 'settings', 'other'), { ...stamp(ANNA) }))
  })
})

describe('review regressions', () => {
  const departed = (extra: Record<string, unknown> = {}) =>
    gig('jussi@example.com', {
      status: 'vahvistettu',
      departedAt: ts('2026-11-30T12:10:00Z'),
      departedBy: 'jussi@example.com',
      awaitingReturn: true,
      ...extra,
    })

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      await setDoc(doc(db, 'gigs', 'out'), departed())
      await setDoc(doc(db, 'gigs', 'outTentative'), departed({ status: 'alustava' }))
    })
  })

  it('a departed, unreturned gig cannot be made tentative, cancelled or deleted', async () => {
    const db = signedIn(ANNA)
    await assertFails(updateDoc(doc(db, 'gigs', 'out'), { status: 'alustava', ...stamp(ANNA) }))
    await assertFails(updateDoc(doc(db, 'gigs', 'out'), { status: 'peruttu', ...stamp(ANNA) }))
    await assertFails(deleteDoc(doc(db, 'gigs', 'outTentative')))
  })

  it('marks cannot be removed or changed once recorded', async () => {
    const db = signedIn(ANNA)
    await assertFails(setDoc(doc(db, 'gigs', 'out'), gig(ANNA, { status: 'alustava' })))
    await assertFails(updateDoc(doc(db, 'gigs', 'out'), { departedBy: ANNA, ...stamp(ANNA) }))
  })

  it('Palautettu is accepted, and after it the gig can be cancelled', async () => {
    const db = signedIn(ANNA)
    await assertSucceeds(
      updateDoc(doc(db, 'gigs', 'out'), {
        returnedAt: serverTimestamp(),
        returnedBy: ANNA,
        status: 'valmis',
        awaitingReturn: false,
        ...stamp(ANNA),
      }),
    )
    await assertSucceeds(updateDoc(doc(db, 'gigs', 'out'), { status: 'peruttu', ...stamp(ANNA) }))
  })

  it('rejects unknown fields in every collection', async () => {
    const db = signedIn(ANNA)
    await assertFails(setDoc(doc(db, 'items', 'x'), item(ANNA, { junk: 'x' })))
    await assertFails(setDoc(doc(db, 'gigs', 'x'), gig(ANNA, { junk: 'x' })))
    await assertFails(
      setDoc(doc(db, 'locations', 'x'), {
        name: 'Studio',
        isOwnStudio: true,
        rooms: [],
        archived: false,
        junk: 'x',
        ...stamp(ANNA),
      }),
    )
    await assertFails(
      setDoc(doc(db, 'packages', 'x'), { name: 'P', lines: [], junk: 'x', ...stamp(ANNA) }),
    )
    await assertFails(setDoc(doc(db, 'settings', 'app'), { junk: 'x', ...stamp(ANNA) }))
  })

  it('settings: lastBackupAt must be a time, and the document cannot be deleted', async () => {
    const db = signedIn(ANNA)
    await assertFails(setDoc(doc(db, 'settings', 'app'), { lastBackupAt: 'never', ...stamp(ANNA) }))
    await assertSucceeds(setDoc(doc(db, 'settings', 'app'), { ...stamp(ANNA) }))
    await assertFails(deleteDoc(doc(db, 'settings', 'app')))
  })
})
