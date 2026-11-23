/**
 * Domain model shared by the whole app.
 *
 * These are the in-memory shapes the pure logic in `src/core` works with. The
 * data layer (`src/data`) converts Firestore documents to and from these types
 * and validates them at the boundary. All times are UTC milliseconds.
 */
import type { Ms } from './time'

export type ItemCondition = 'ok' | 'huollossa' | 'rikki'

/** One bookable thing: a single device (quantity 1) or a quantity item such as cables. */
export interface Item {
  id: string
  /** Short unique tag, e.g. "KAM-03". */
  tag: string
  name: string
  category: string
  manufacturer?: string
  model?: string
  /** 1 for individual devices; > 1 for quantity items (e.g. 40 cables). */
  quantity: number
  serialNo?: string
  condition: ItemCondition
  /** When a non-ok condition is expected to end. Undefined = until further notice. */
  conditionUntil?: Ms
  homeLocationId: string
  responsible?: string
  notes?: string
  /** "Siirretty tänne": manual location note that overrides the computed location. */
  locationOverride?: { text: string; at: Ms; by: string }
  archived: boolean
}

export interface Location {
  id: string
  name: string
  /** The company's own studio: no departure/return marks and no late-return blocking. */
  isOwnStudio: boolean
  rooms: string[]
  address?: string
  loadingNotes?: string
  contact?: string
  archived: boolean
}

export interface Package {
  id: string
  name: string
  lines: { itemId: string; qty: number }[]
}

export type GigStatus = 'alustava' | 'vahvistettu' | 'valmis' | 'peruttu'

/** A direct transfer: this line receives equipment from another gig's line. */
export interface LineFrom {
  gigId: string
  lineId: string
  /** The instant the booking moves from the source line to this line. */
  handoverAt: Ms
  travelMin?: number
}

/** A booking of one item on a gig. */
export interface Line {
  /** Unique within the gig. */
  id: string
  itemId: string
  qty: number
  note?: string
  /**
   * Own start: equipment leaves later than the gig's equipment period starts.
   * On a receiving (`from`) line this means "needed from" and only affects slack.
   */
  start?: Ms
  /** Own end: equipment comes back earlier than the gig's equipment period ends. */
  end?: Ms
  from?: LineFrom
}

/** Departure/return facts. */
export interface Marks {
  departedAt?: Ms
  departedBy?: string
  returnedAt?: Ms
  returnedBy?: string
}

export interface Gig extends Marks {
  id: string
  name: string
  client?: string
  locationId: string
  room?: string
  responsible: string
  crew: string[]
  notes?: string
  status: GigStatus
  confirmedAt?: Ms
  confirmedBy?: string
  /** Equipment leaves ("kalusto lähtee"). */
  equipStart: Ms
  eventStart: Ms
  eventEnd: Ms
  /** Equipment is back ("kalusto takaisin"). */
  equipEnd: Ms
  lines: Line[]
  /** Per-line departure/return marks for lines with their own start or end. */
  lineMarks?: Record<string, Marks>
}

/** A document as stored: the domain value plus who changed it last and when. */
export type Stored<T> = T & { readonly updatedAt: Ms; readonly updatedBy: string }

export interface AllowedUser {
  /** Google account email in lower case; also the document id. */
  email: string
  name: string
  initials: string
}

export interface AppSettings {
  lastBackupAt?: Ms
}
