/** Select options for the gig form (locations, rooms, users, equipment). Pure. */
import type { AllowedUser, Item, Location } from '../../core/types'
import { t } from './texts'

export interface Option {
  value: string
  label: string
  disabled?: boolean
}

const fiCompare = (a: string, b: string) => a.localeCompare(b, 'fi', { numeric: true })

/** Non-archived locations, own studio first; the current one stays even if archived. */
export function locationOptions(locations: readonly Location[], current: string | null): Option[] {
  return locations
    .filter((l) => !l.archived || l.id === current)
    .toSorted((a, b) => Number(b.isOwnStudio) - Number(a.isOwnStudio) || fiCompare(a.name, b.name))
    .map((l) => ({
      value: l.id,
      label: l.isOwnStudio ? `${l.name}${t.edit.ownStudioSuffix}` : l.name,
    }))
}

/** The location's rooms, keeping a stored room that has since been removed from the list. */
export function roomOptions(location: Location | undefined, current: string | null): string[] {
  const rooms = [...(location?.rooms ?? [])]
  if (current && !rooms.includes(current)) rooms.push(current)
  return rooms
}

/** Users by name; emails no longer on the allowlist stay selectable as themselves. */
export function userOptions(users: readonly AllowedUser[], keep: readonly string[]): Option[] {
  const opts = users
    .map((u) => ({ value: u.email, label: u.name }))
    .toSorted((a, b) => fiCompare(a.label, b.label))
  const known = new Set(opts.map((o) => o.value))
  for (const email of keep) {
    if (email && !known.has(email)) {
      opts.push({ value: email, label: email })
      known.add(email)
    }
  }
  return opts
}

export const itemLabel = (it: Pick<Item, 'tag' | 'name'>) =>
  it.name && it.name !== it.tag ? `${it.tag} ${it.name}` : it.tag

/** Non-archived equipment by tag; devices already on the gig are disabled. */
export function itemOptions(items: readonly Item[], onGig: ReadonlySet<string>): Option[] {
  return items
    .filter((it) => !it.archived)
    .toSorted((a, b) => fiCompare(a.tag, b.tag))
    .map((it) => {
      const taken = it.quantity === 1 && onGig.has(it.id)
      return { value: it.id, label: itemLabel(it), ...(taken ? { disabled: true } : {}) }
    })
}
