/** Tilanne of every item at `app.now`, recomputed when data or the minute changes. */
import { useMemo } from 'react'
import type { AppData } from '../../app/appData'
import type { Gig, Location } from '../../core/types'
import { situationOf, type Situation } from './status'

export function useSituations(app: AppData): ReadonlyMap<string, Situation> {
  const { availability, now, data } = app
  return useMemo(
    () => new Map(data.items.map((i) => [i.id, situationOf(i, availability, now)])),
    [availability, now, data.items],
  )
}

/** "Clarion Hotel Helsinki › Bysa 2" */
export function placeLabel(
  locationsById: ReadonlyMap<string, Location>,
  gig: Pick<Gig, 'locationId' | 'room'>,
): string {
  const name = locationsById.get(gig.locationId)?.name ?? ''
  return gig.room ? `${name} › ${gig.room}` : name
}
