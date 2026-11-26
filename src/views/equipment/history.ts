/** Gigs that use an item, for the item page (Laitekortti). */
import type { Gig } from '../../core/types'

export interface GigUse<G extends Gig = Gig> {
  gig: G
  /** Total quantity of the item on the gig's lines. */
  qty: number
}

/** Gigs whose lines use `itemId`, newest equipment start first. */
export function gigsUsingItem<G extends Gig>(gigs: readonly G[], itemId: string): GigUse<G>[] {
  const out: GigUse<G>[] = []
  for (const gig of gigs) {
    const qty = gig.lines.reduce((n, l) => (l.itemId === itemId ? n + l.qty : n), 0)
    if (qty > 0) out.push({ gig, qty })
  }
  return out.sort((a, b) => b.gig.equipStart - a.gig.equipStart || (a.gig.id < b.gig.id ? -1 : 1))
}
