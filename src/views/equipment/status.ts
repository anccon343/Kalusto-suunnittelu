/**
 * "Tilanne" of an item (plan 2.1): what is happening to it right now. Computed from
 * the availability engine's demands, never stored.
 */
import { CONDITION_SRC, type Demand } from '../../core/availability'
import type { Ms } from '../../core/time'
import type { Item } from '../../core/types'

export type SituationKind = 'vapaa' | 'keikalla' | 'palauttamatta' | 'pois-kaytosta'

export const SITUATION_KINDS: readonly SituationKind[] = [
  'vapaa',
  'keikalla',
  'palauttamatta',
  'pois-kaytosta',
]

export interface Situation {
  kind: SituationKind
  /** Gigs holding the item now (unique, in demand order). */
  gigIds: readonly string[]
  /** Earliest planned return of unreturned equipment ("piti palata …"). */
  dueAt?: Ms
  /** Quantity items only: free now after all demand, and the quantity owned. */
  free?: number
  total?: number
}

/** The part of the availability model this helper needs. */
export interface DemandSource {
  demandsFor(itemId: string): readonly Demand[]
  minFree(itemId: string, window: { start: Ms; end: Ms }): number
}

/** Archived, or a non-ok condition that is still in force at `now`. */
export function isOutOfService(item: Item, now: Ms): boolean {
  if (item.archived) return true
  if (item.condition === 'ok') return false
  return item.conditionUntil === undefined || now < item.conditionUntil
}

/** Gig demands active at `now` (half-open intervals). */
export function activeGigDemands(demands: readonly Demand[], now: Ms): Demand[] {
  return demands.filter((d) => d.src !== CONDITION_SRC && d.start <= now && now < d.end)
}

/** The next gig demand that starts after `now`, if any. */
export function nextGigDemand(demands: readonly Demand[], now: Ms): Demand | undefined {
  let best: Demand | undefined
  for (const d of demands) {
    if (d.src === CONDITION_SRC || d.start <= now) continue
    if (!best || d.start < best.start) best = d
  }
  return best
}

export function situationOf(item: Item, source: DemandSource, now: Ms): Situation {
  const active = activeGigDemands(source.demandsFor(item.id), now)
  const gigIds = [...new Set(active.map((d) => d.src))]
  const dues = active.flatMap((d) => (d.dueAt === undefined ? [] : [d.dueAt]))
  const quantity =
    item.quantity > 1 && !item.archived
      ? {
          free: Math.max(0, source.minFree(item.id, { start: now, end: now + 1 })),
          total: item.quantity,
        }
      : {}
  const base = { gigIds, ...quantity }
  if (isOutOfService(item, now)) return { kind: 'pois-kaytosta', ...base }
  if (dues.length > 0) return { kind: 'palauttamatta', ...base, dueAt: Math.min(...dues) }
  if (gigIds.length > 0) return { kind: 'keikalla', ...base }
  return { kind: 'vapaa', ...base }
}
