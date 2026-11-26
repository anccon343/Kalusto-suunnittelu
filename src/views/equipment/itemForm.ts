/**
 * Pure logic of the item form (plan 4.1): initial values for create, edit and
 * "Monista", validation, and conversion back to the domain `Item`.
 */
import { cleanTag, isTagTaken, nextTag } from '../../core/tags'
import type { Ms } from '../../core/time'
import type { Item, ItemCondition } from '../../core/types'
import { t } from './texts'

export interface ItemFormValues {
  tag: string
  name: string
  category: string
  manufacturer: string
  model: string
  /** NumberInput yields a number, or a string while empty or being typed. */
  quantity: number | string
  serialNo: string
  condition: ItemCondition
  conditionUntil: Ms | undefined
  homeLocationId: string | null
  responsible: string | null
  notes: string
}

/** Limits from the item schema (src/data/schemas.ts). */
export const LIMITS = {
  tag: 20,
  name: 120,
  category: 60,
  manufacturer: 80,
  model: 80,
  serialNo: 80,
  notes: 2000,
  quantity: 100_000,
} as const

/** Fields the form owns; the others (archived, locationOverride) are kept as they are. */
const FORM_OPTIONAL_KEYS = [
  'manufacturer',
  'model',
  'serialNo',
  'conditionUntil',
  'responsible',
  'notes',
] as const satisfies readonly (keyof Item)[]

export function emptyValues(homeLocationId: string | undefined): ItemFormValues {
  return {
    tag: '',
    name: '',
    category: '',
    manufacturer: '',
    model: '',
    quantity: 1,
    serialNo: '',
    condition: 'ok',
    conditionUntil: undefined,
    homeLocationId: homeLocationId ?? null,
    responsible: null,
    notes: '',
  }
}

export function valuesFromItem(item: Item): ItemFormValues {
  return {
    tag: item.tag,
    name: item.name,
    category: item.category,
    manufacturer: item.manufacturer ?? '',
    model: item.model ?? '',
    quantity: item.quantity,
    serialNo: item.serialNo ?? '',
    condition: item.condition,
    conditionUntil: item.conditionUntil,
    homeLocationId: item.homeLocationId,
    responsible: item.responsible ?? null,
    notes: item.notes ?? '',
  }
}

/**
 * "Monista": the same item with the next free tag and no serial number. The copy is
 * a new physical unit, so its condition starts as OK.
 */
export function duplicateValues(item: Item, allTags: Iterable<string>): ItemFormValues {
  return {
    ...valuesFromItem(item),
    tag: nextTag(item.tag, allTags),
    serialNo: '',
    condition: 'ok',
    conditionUntil: undefined,
  }
}

export type ItemFormErrors = Partial<Record<keyof ItemFormValues, string>>

/** @param otherTags tags of every other item, archived ones included. */
export function validateValues(v: ItemFormValues, otherTags: Iterable<string>): ItemFormErrors {
  const e: ItemFormErrors = {}
  const e2 = t.form.errors
  const tag = cleanTag(v.tag)
  if (!tag) e.tag = e2.tagRequired
  else if (tag.length > LIMITS.tag) e.tag = e2.tooLong(LIMITS.tag)
  else if (isTagTaken(tag, otherTags)) e.tag = e2.tagTaken
  const name = v.name.trim()
  if (!name) e.name = e2.nameRequired
  else if (name.length > LIMITS.name) e.name = e2.tooLong(LIMITS.name)
  for (const k of ['category', 'manufacturer', 'model', 'serialNo', 'notes'] as const) {
    if (v[k].trim().length > LIMITS[k]) e[k] = e2.tooLong(LIMITS[k])
  }
  const q = typeof v.quantity === 'number' ? v.quantity : Number.NaN
  if (!Number.isInteger(q) || q < 1) e.quantity = e2.quantity
  else if (q > LIMITS.quantity) e.quantity = e2.quantityMax(LIMITS.quantity)
  if (!v.homeLocationId) e.homeLocationId = e2.homeLocation
  return e
}

/** The form's fields as item properties; empty optional fields are left out. */
function formFields(v: ItemFormValues): Omit<Item, 'id' | 'archived' | 'locationOverride'> {
  const manufacturer = v.manufacturer.trim()
  const model = v.model.trim()
  const serialNo = v.serialNo.trim()
  const notes = v.notes.trim()
  return {
    tag: cleanTag(v.tag),
    name: v.name.trim(),
    category: v.category.trim(),
    quantity: Number(v.quantity),
    condition: v.condition,
    homeLocationId: v.homeLocationId ?? '',
    ...(manufacturer ? { manufacturer } : {}),
    ...(model ? { model } : {}),
    ...(serialNo ? { serialNo } : {}),
    ...(v.condition !== 'ok' && v.conditionUntil !== undefined
      ? { conditionUntil: v.conditionUntil }
      : {}),
    ...(v.responsible ? { responsible: v.responsible } : {}),
    ...(notes ? { notes } : {}),
  }
}

/** A new item from validated values. */
export function toNewItem(v: ItemFormValues): Omit<Item, 'id'> {
  return { ...formFields(v), archived: false }
}

/** `baseline` with the form's fields applied (fields emptied in the form are removed). */
export function toEditedItem<T extends Item>(baseline: T, v: ItemFormValues): T {
  const rest: T = { ...baseline }
  for (const k of FORM_OPTIONAL_KEYS) delete rest[k]
  return { ...rest, ...formFields(v) }
}
