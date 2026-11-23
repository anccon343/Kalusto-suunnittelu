/**
 * Form-level validation of gigs and lines (plan: rule 12 and section 4.2).
 * Returns problem codes; the UI maps them to Finnish messages in `src/fi.ts`.
 */
import type { Gig, Item, Line } from './types'

export type GigProblem =
  | 'times-out-of-order' // equipStart ≤ eventStart < eventEnd ≤ equipEnd
  | 'duplicate-item'

export type LineProblem =
  | 'qty-not-positive-integer'
  | 'qty-exceeds-item'
  | 'unit-qty-not-one'
  | 'own-time-out-of-range' // equipStart ≤ start < end ≤ equipEnd
  | 'own-end-before-start'
  | 'item-missing'
  | 'item-archived'

export function validateGigTimes(
  g: Pick<Gig, 'equipStart' | 'eventStart' | 'eventEnd' | 'equipEnd'>,
) {
  const ok = g.equipStart <= g.eventStart && g.eventStart < g.eventEnd && g.eventEnd <= g.equipEnd
  return ok ? [] : (['times-out-of-order'] as GigProblem[])
}

export function validateGig(g: Gig): GigProblem[] {
  const problems: GigProblem[] = [...validateGigTimes(g)]
  const seen = new Set<string>()
  for (const l of g.lines) {
    if (seen.has(l.itemId)) {
      problems.push('duplicate-item')
      break
    }
    seen.add(l.itemId)
  }
  return problems
}

export function validateLine(g: Gig, l: Line, item: Item | undefined): LineProblem[] {
  const problems: LineProblem[] = []
  if (!item) return ['item-missing']
  if (item.archived) problems.push('item-archived')
  if (!Number.isInteger(l.qty) || l.qty < 1) problems.push('qty-not-positive-integer')
  else if (item.quantity === 1 && l.qty !== 1) problems.push('unit-qty-not-one')
  else if (l.qty > item.quantity) problems.push('qty-exceeds-item')

  // On a receiving line, `start` means "needed from" and the booking starts at the
  // handover, which may be before this gig's departure (plan 2.3, exception).
  const start = l.from ? undefined : l.start
  const end = l.end
  if (start !== undefined && !(g.equipStart <= start && start < g.equipEnd)) {
    problems.push('own-time-out-of-range')
  }
  if (end !== undefined && !(g.equipStart < end && end <= g.equipEnd)) {
    problems.push('own-time-out-of-range')
  }
  if (start !== undefined && end !== undefined && !(start < end))
    problems.push('own-end-before-start')
  return [...new Set(problems)]
}
