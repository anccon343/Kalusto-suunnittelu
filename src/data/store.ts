/**
 * Live data: one set of Firestore listeners shared by the whole app.
 *
 * Loads (plan 2.3): all users, settings, locations, items and packages; gigs whose
 * equipment period ended within the last 60 days or later; and every gig still
 * awaiting return, however old. Invalid documents are left out and listed in
 * `issues` so the UI can show them under "Korjattavaa".
 */
import {
  collection,
  doc,
  onSnapshot,
  query,
  Timestamp,
  where,
  type DocumentData,
  type Firestore,
  type Query,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import type { AllowedUser, AppSettings, Gig, Item, Location, Package, Stored } from '../core/types'
import { HOUR, type Ms } from '../core/time'
import {
  parseAllowedUser,
  parseGig,
  parseItem,
  parseLocation,
  parsePackage,
  parseSettings,
  type Collection,
  type DataIssue,
  type Parsed,
} from './schemas'

export const GIG_HISTORY_DAYS = 60

export interface DataState {
  status: 'loading' | 'ready' | 'error'
  error?: string
  users: readonly Stored<AllowedUser>[]
  settings: AppSettings
  locations: readonly Stored<Location>[]
  items: readonly Stored<Item>[]
  packages: readonly Stored<Package>[]
  gigs: readonly Stored<Gig>[]
  issues: readonly DataIssue[]
}

const EMPTY: DataState = {
  status: 'loading',
  users: [],
  settings: {},
  locations: [],
  items: [],
  packages: [],
  gigs: [],
  issues: [],
}

type Key = 'users' | 'locations' | 'items' | 'packages' | 'gigsRecent' | 'gigsAwaiting'

export class DataStore {
  private state: DataState = EMPTY
  private readonly listeners = new Set<() => void>()
  private readonly unsubscribes: Unsubscribe[] = []
  private readonly loaded = new Set<Key | 'settings'>()
  private readonly docs = new Map<Key, ReadonlyMap<string, unknown>>()
  private readonly issueByKey = new Map<Key | 'settings', readonly DataIssue[]>()

  private readonly db: Firestore
  private readonly now: () => Ms

  constructor(db: Firestore, now: () => Ms = Date.now) {
    this.db = db
    this.now = now
  }

  /** For `useSyncExternalStore`. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getSnapshot = (): DataState => this.state

  start(): void {
    if (this.unsubscribes.length > 0) return
    const since = Timestamp.fromMillis(this.now() - GIG_HISTORY_DAYS * 24 * HOUR)
    const gigs = collection(this.db, 'gigs')
    this.listen('users', collection(this.db, 'allowedUsers'), 'allowedUsers', parseAllowedUser)
    this.listen('locations', collection(this.db, 'locations'), 'locations', parseLocation)
    this.listen('items', collection(this.db, 'items'), 'items', parseItem)
    this.listen('packages', collection(this.db, 'packages'), 'packages', parsePackage)
    this.listen('gigsRecent', query(gigs, where('equipEnd', '>=', since)), 'gigs', parseGig)
    this.listen('gigsAwaiting', query(gigs, where('awaitingReturn', '==', true)), 'gigs', parseGig)
    this.unsubscribes.push(
      onSnapshot(
        doc(this.db, 'settings', 'app'),
        (snap) => {
          const parsed = snap.exists()
            ? parseSettings(snap.id, snap.data({ serverTimestamps: 'estimate' }))
            : ({ ok: true, value: {} } as const)
          this.issueByKey.set('settings', parsed.ok ? [] : [parsed.issue])
          this.loaded.add('settings')
          this.publish({ settings: parsed.ok ? parsed.value : {} })
        },
        (e) => this.fail(e),
      ),
    )
  }

  stop(): void {
    for (const u of this.unsubscribes.splice(0)) u()
    this.loaded.clear()
    this.docs.clear()
    this.issueByKey.clear()
    this.state = EMPTY
    this.emit()
  }

  private listen<T>(
    key: Key,
    q: Query<DocumentData>,
    collectionName: Collection,
    parse: (id: string, data: unknown) => Parsed<T>,
  ): void {
    this.unsubscribes.push(
      onSnapshot(
        q,
        (snap) => this.receive(key, snap, collectionName, parse),
        (e) => this.fail(e),
      ),
    )
  }

  private receive<T>(
    key: Key,
    snap: QuerySnapshot<DocumentData>,
    _collectionName: Collection,
    parse: (id: string, data: unknown) => Parsed<T>,
  ): void {
    const values = new Map<string, T>()
    const issues: DataIssue[] = []
    for (const d of snap.docs) {
      const parsed = parse(d.id, d.data({ serverTimestamps: 'estimate' }))
      if (parsed.ok) values.set(d.id, parsed.value)
      else issues.push(parsed.issue)
    }
    this.docs.set(key, values)
    this.issueByKey.set(key, issues)
    this.loaded.add(key)
    this.publish({})
  }

  private publish(patch: Partial<DataState>): void {
    const values = <T>(key: Key): T[] => [
      ...((this.docs.get(key) ?? new Map()) as Map<string, T>).values(),
    ]
    const gigs = new Map<string, Stored<Gig>>()
    for (const g of values<Stored<Gig>>('gigsRecent')) gigs.set(g.id, g)
    for (const g of values<Stored<Gig>>('gigsAwaiting')) gigs.set(g.id, g)
    const ready = this.loaded.size === 7
    this.state = {
      ...this.state,
      ...patch,
      status: this.state.status === 'error' ? 'error' : ready ? 'ready' : 'loading',
      users: values<Stored<AllowedUser>>('users'),
      locations: values<Stored<Location>>('locations'),
      items: values<Stored<Item>>('items'),
      packages: values<Stored<Package>>('packages'),
      gigs: [...gigs.values()],
      issues: this.dedupedIssues(gigs),
    }
    this.emit()
  }

  /** One entry per document; a gig valid in one listener is not reported from the other. */
  private dedupedIssues(validGigs: ReadonlyMap<string, unknown>): DataIssue[] {
    const issues = new Map<string, DataIssue>()
    for (const list of this.issueByKey.values()) {
      for (const issue of list) {
        if (issue.collection === 'gigs' && validGigs.has(issue.id)) continue
        issues.set(`${issue.collection}/${issue.id}`, issue)
      }
    }
    return [...issues.values()]
  }

  private fail(e: unknown): void {
    this.state = {
      ...this.state,
      status: 'error',
      error: e instanceof Error ? e.message : String(e),
    }
    this.emit()
  }

  private emit(): void {
    for (const l of this.listeners) l()
  }
}
