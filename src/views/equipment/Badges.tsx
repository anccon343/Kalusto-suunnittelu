/** Kunto and Tilanne badges. Colour follows docs/UI.md and is always paired with text. */
import { Badge } from '@mantine/core'
import type { ItemCondition } from '../../core/types'
import type { Situation, SituationKind } from './status'
import { t } from './texts'

const CONDITION_COLOR: Record<ItemCondition, string> = {
  ok: 'gray',
  huollossa: 'orange',
  rikki: 'red',
}

const SITUATION_COLOR: Record<SituationKind, string> = {
  vapaa: 'gray',
  keikalla: 'slate',
  palauttamatta: 'red',
  'pois-kaytosta': 'gray',
}

export function ConditionBadge({ condition }: { condition: ItemCondition }) {
  return (
    <Badge color={CONDITION_COLOR[condition]} variant={condition === 'ok' ? 'outline' : 'light'}>
      {t.condition[condition]}
    </Badge>
  )
}

export function SituationBadge({ situation }: { situation: Situation }) {
  const { kind } = situation
  return (
    <Badge color={SITUATION_COLOR[kind]} variant={kind === 'vapaa' ? 'outline' : 'light'}>
      {t.situation[kind]}
    </Badge>
  )
}

export function ArchivedBadge() {
  return (
    <Badge color="gray" variant="filled">
      {t.archived}
    </Badge>
  )
}
