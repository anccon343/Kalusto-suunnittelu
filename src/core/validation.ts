/**
 * Form-level validation of gigs and lines (plan: rule 12 and section 4.2).
 * Returns problem codes; the UI maps them to Finnish messages in `src/fi.ts`.
 *
 * Validation concerns what the user is entering now. State that changed
 * elsewhere (an item archived or its quantity lowered after it was booked) is not
 * a form error: rule 6 turns it into a red conflict and rule 9 blocks only new
 * red combinations.
 */
import type { Gig, Item, Line } from './types'

export type GigProblem =
  | 'times-out-of-order' // equipStart ≤ eventStart < eventEnd ≤ equipEnd
  | 'duplicate-device'

export type LineProblem =
  | 'item-missing'
  | 'item-archived'
  | 'qty-not-positive-integer'
  | 'unit-qty-not-one'
  | 'qty-exceeds-item'
  | 'own-time-out-of-range' // equipStart ≤ start < end ≤ equipEnd
  | 'own-end-before-start'
  | 'travel-not-non-negative-integer'
  | 'handover-invalid'

export function validateGigTimes(
  g: Pick<Gig, 'equipStart' | 'eventStart' | 'eventEnd' | 'equipEnd'>,
): GigProblem[] {
  const ok = g.equipStart <= g.eventStart && g.eventStart < g.eventEnd && g.eventEnd <= g.equipEnd
  return ok ? [] : ['times-out-of-order']
}

/**
 * Validates a whole gig. A device (quantity 1) may appear only once per gig;
 * a quantity item may have several lines (own times, partial direct transfers),
 * whose capacity the availability engine checks per time slice.
 */
export function validateGig(g: Gig, itemById: (id: string) => Item | undefined): GigProblem[] {
  const problems: GigProblem[] = [...validateGigTimes(g)]
  const seen = new Set<string>()
  for (const l of g.lines) {
    if (itemById(l.itemId)?.quantity !== 1) continue
    if (seen.has(l.itemId)) {
      problems.push('duplicate-device')
      break
    }
    seen.add(l.itemId)
  }
  return problems
}

/**
 * Validates one line in the gig form.
 * @param stored the saved version of this line, or undefined for a new line.
 */
export function validateLine(
  g: Gig,
  l: Line,
  item: Item | undefined,
  stored?: Line,
): LineProblem[] {
  if (!item) return ['item-missing']
  const problems: LineProblem[] = []
  const itemChosenNow = stored === undefined || stored.itemId !== l.itemId

  if (item.archived && itemChosenNow) problems.push('item-archived')
  if (!Number.isInteger(l.qty) || l.qty < 1) {
    problems.push('qty-not-positive-integer')
  } else if (item.quantity === 1 && l.qty !== 1) {
    problems.push('unit-qty-not-one')
  } else if (l.qty > item.quantity && (itemChosenNow || l.qty > stored.qty)) {
    problems.push('qty-exceeds-item')
  }

  // Rule 12 applies to the line's own times on every line. On a receiving line
  // `start` means "needed from"; it sets the slack and becomes the booking start if
  // the transfer is "ei täsmää". Only the handover may precede the departure, and
  // the handover is checked by the engine's chainCheck (rule 4), not here.
  const { start, end } = l
  if (start !== undefined && !(g.equipStart <= start && start < g.equipEnd)) {
    problems.push('own-time-out-of-range')
  }
  if (end !== undefined && !(g.equipStart < end && end <= g.equipEnd)) {
    problems.push('own-time-out-of-range')
  }
  if (start !== undefined && end !== undefined && !(start < end)) {
    problems.push('own-end-before-start')
  }

  if (l.from) {
    if (!Number.isFinite(l.from.handoverAt)) problems.push('handover-invalid')
    const travel = l.from.travelMin
    if (travel !== undefined && !(Number.isInteger(travel) && travel >= 0)) {
      problems.push('travel-not-non-negative-integer')
    }
  }
  return [...new Set(problems)]
}
