/**
 * JSON backup of all collections (plan 6.4). Pure: takes the domain collections and
 * returns a JSON-ready value. Every time field is written as `{"_ts": "<ISO 8601 UTC>"}`
 * so that a restore script can turn it back into a Firestore Timestamp.
 *
 * Documents are keyed by their Firestore id and hold the fields as stored, including
 * the derived `awaitingReturn` of gigs, so a restore produces readable documents.
 */
import { computeAwaitingReturn } from '../../core/availability'
import { dateOf, HOUR, toIsoDate, type Ms } from '../../core/time'
import type {
  AllowedUser,
  AppSettings,
  Gig,
  Item,
  Location,
  Package,
  Stored,
} from '../../core/types'

export const BACKUP_VERSION = 1

/** Backups older than this are flagged (plan 6.4). */
export const BACKUP_MAX_AGE_DAYS = 30

const DAY: Ms = 24 * HOUR

export interface BackupSource {
  users: readonly Stored<AllowedUser>[]
  settings: AppSettings
  locations: readonly Stored<Location>[]
  items: readonly Stored<Item>[]
  packages: readonly Stored<Package>[]
  gigs: readonly Stored<Gig>[]
}

export interface TimeValue {
  _ts: string
}

type Json = string | number | boolean | null | TimeValue | Json[] | { [key: string]: Json }
type JsonObject = { [key: string]: Json }

export interface Backup {
  app: 'roudari'
  version: typeof BACKUP_VERSION
  exportedAt: TimeValue
  collections: {
    allowedUsers: Record<string, JsonObject>
    settings: Record<string, JsonObject>
    locations: Record<string, JsonObject>
    items: Record<string, JsonObject>
    packages: Record<string, JsonObject>
    gigs: Record<string, JsonObject>
  }
}

/**
 * Field names that hold instants anywhere in the stored documents: updatedAt,
 * conditionUntil, locationOverride.at, the four gig times, confirmedAt, departedAt,
 * returnedAt, lineMarks.*.departedAt/returnedAt, lines[].start/end,
 * lines[].from.handoverAt and settings.lastBackupAt. No other numeric field uses
 * these names (quantities are `qty`, `quantity` and `travelMin`).
 */
const TIME_KEYS: ReadonlySet<string> = new Set([
  'updatedAt',
  'conditionUntil',
  'at',
  'equipStart',
  'eventStart',
  'eventEnd',
  'equipEnd',
  'confirmedAt',
  'departedAt',
  'returnedAt',
  'start',
  'end',
  'handoverAt',
  'lastBackupAt',
])

export function timeValue(ms: Ms): TimeValue {
  return { _ts: new Date(ms).toISOString() }
}

/** Copies a domain value, tagging time fields and dropping undefined values. */
function toJson(value: unknown, key?: string): Json | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'number') {
    return key !== undefined && TIME_KEYS.has(key) ? timeValue(value) : value
  }
  if (typeof value === 'string' || typeof value === 'boolean' || value === null) return value
  if (Array.isArray(value)) {
    return value.map((v) => toJson(v) ?? null)
  }
  if (typeof value === 'object') {
    const out: JsonObject = {}
    for (const [k, v] of Object.entries(value)) {
      const j = toJson(v, k)
      if (j !== undefined) out[k] = j
    }
    return out
  }
  throw new TypeError(`Unsupported value in backup: ${typeof value}`)
}

/** Converts a document to JSON fields, leaving out the given id keys. */
function fields(doc: object, omit: readonly string[]): JsonObject {
  const rest = Object.fromEntries(Object.entries(doc).filter(([k]) => !omit.includes(k)))
  return toJson(rest) as JsonObject
}

function keyed<T extends { id: string }>(
  docs: readonly T[],
  extra?: (doc: T) => JsonObject,
): Record<string, JsonObject> {
  return Object.fromEntries(
    docs.map((d) => [d.id, { ...fields(d, ['id']), ...(extra?.(d) ?? {}) }]),
  )
}

export function buildBackup(src: BackupSource, exportedAt: Ms): Backup {
  const ownStudios = new Set(src.locations.filter((l) => l.isOwnStudio).map((l) => l.id))
  return {
    app: 'roudari',
    version: BACKUP_VERSION,
    exportedAt: timeValue(exportedAt),
    collections: {
      allowedUsers: Object.fromEntries(src.users.map((u) => [u.email, fields(u, ['email'])])),
      settings: { app: fields(src.settings, []) },
      locations: keyed(src.locations),
      items: keyed(src.items),
      packages: keyed(src.packages),
      gigs: keyed(src.gigs, (g) => ({
        awaitingReturn: computeAwaitingReturn(g, ownStudios.has(g.locationId)),
      })),
    },
  }
}

export function backupJson(src: BackupSource, exportedAt: Ms): string {
  return `${JSON.stringify(buildBackup(src, exportedAt), null, 2)}\n`
}

/** "roudari-varmuuskopio-2026-11-26.json", dated in Helsinki time. */
export function backupFileName(exportedAt: Ms): string {
  return `roudari-varmuuskopio-${toIsoDate(dateOf(exportedAt))}.json`
}

export type BackupAge =
  { kind: 'never' } | { kind: 'ok'; days: number } | { kind: 'stale'; days: number }

/** Whole days since the last backup and whether it is older than 30 days. */
export function backupAge(lastBackupAt: Ms | undefined, now: Ms): BackupAge {
  if (lastBackupAt === undefined) return { kind: 'never' }
  const age = Math.max(0, now - lastBackupAt)
  const days = Math.floor(age / DAY)
  return age > BACKUP_MAX_AGE_DAYS * DAY ? { kind: 'stale', days } : { kind: 'ok', days }
}
