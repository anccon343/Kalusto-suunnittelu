/** The equipment list: a table on wide screens, cards on phones. */
import { Anchor, Card, Group, Stack, Table, Text } from '@mantine/core'
import { Link } from 'react-router'
import type { Item, Stored } from '../../core/types'
import { ArchivedBadge, ConditionBadge, SituationBadge } from './Badges'
import type { Situation } from './status'
import { t } from './texts'

export interface Row {
  item: Stored<Item>
  situation: Situation
}

/** "1", "40 kpl" or "vapaana 28/40". */
function quantityText({ item, situation }: Row): string {
  if (item.quantity === 1) return '1'
  return situation.free !== undefined && situation.total !== undefined
    ? t.freeOf(situation.free, situation.total)
    : t.item.pieces(item.quantity)
}

export function EquipmentTable({
  rows,
  onOpen,
}: {
  rows: readonly Row[]
  onOpen: (itemId: string) => void
}) {
  return (
    <Table highlightOnHover verticalSpacing="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{t.columns.tag}</Table.Th>
          <Table.Th>{t.columns.name}</Table.Th>
          <Table.Th>{t.columns.category}</Table.Th>
          <Table.Th>{t.columns.quantity}</Table.Th>
          <Table.Th>{t.columns.condition}</Table.Th>
          <Table.Th>{t.columns.situation}</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((row) => (
          <Table.Tr
            key={row.item.id}
            onClick={() => onOpen(row.item.id)}
            style={{ cursor: 'pointer' }}
          >
            <Table.Td>
              {/* The link is the keyboard and screen-reader path; the row click is a shortcut. */}
              <Anchor
                component={Link}
                to={`/kalusto/${row.item.id}`}
                fw={600}
                onClick={(e) => e.stopPropagation()}
              >
                {row.item.tag}
              </Anchor>
            </Table.Td>
            <Table.Td>
              <Group gap="xs" wrap="nowrap">
                <span>{row.item.name}</span>
                {row.item.archived && <ArchivedBadge />}
              </Group>
            </Table.Td>
            <Table.Td>{row.item.category}</Table.Td>
            <Table.Td>{quantityText(row)}</Table.Td>
            <Table.Td>
              <ConditionBadge condition={row.item.condition} />
            </Table.Td>
            <Table.Td>
              <SituationBadge situation={row.situation} />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}

export function EquipmentCards({ rows }: { rows: readonly Row[] }) {
  return (
    <Stack gap="xs" component="ul" p={0} m={0} style={{ listStyle: 'none' }}>
      {rows.map((row) => (
        <li key={row.item.id}>
          <Card component={Link} to={`/kalusto/${row.item.id}`} padding="sm" mih={48}>
            <Group justify="space-between" wrap="nowrap" align="flex-start" gap="xs">
              <Stack gap={2} style={{ minWidth: 0 }}>
                <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
                  {row.item.tag}{' '}
                  <Text span fw={400}>
                    {row.item.name}
                  </Text>
                </Text>
                <Text size="sm" c="dimmed">
                  {[row.item.category, quantityText(row)].filter(Boolean).join(' · ')}
                </Text>
              </Stack>
              <Stack gap={4} align="flex-end" style={{ flexShrink: 0 }}>
                <SituationBadge situation={row.situation} />
                {row.item.condition !== 'ok' && <ConditionBadge condition={row.item.condition} />}
                {row.item.archived && <ArchivedBadge />}
              </Stack>
            </Group>
          </Card>
        </li>
      ))}
    </Stack>
  )
}
