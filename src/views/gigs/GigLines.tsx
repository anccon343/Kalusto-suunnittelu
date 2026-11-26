/** Read-only equipment lines of a gig: a table on wide screens, cards on phones. */
import { Paper, Stack, Table, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { userName, useAppData, type AppData } from '../../app/appData'
import { formatDateTime } from '../../core/time'
import type { Gig, Line } from '../../core/types'
import { LineConflicts } from './Conflicts'
import { lineConflictViews, type ConflictView } from './draft'
import { t } from './texts'

const tl = t.lines

interface Row {
  line: Line
  tag: string
  name: string
  details: string[]
  conflicts: ConflictView[]
}

function lineDetails(app: AppData, gig: Gig, l: Line): string[] {
  const out: string[] = []
  if (l.from) {
    const src = app.gigsById.get(l.from.gigId)?.name ?? l.from.gigId
    const travel = l.from.travelMin !== undefined ? `, ${tl.travel(l.from.travelMin)}` : ''
    out.push(`${tl.fromGig(src)}, ${tl.handover(formatDateTime(l.from.handoverAt))}${travel}`)
  }
  if (l.start !== undefined) out.push(tl.ownFrom(formatDateTime(l.start)))
  if (l.end !== undefined) out.push(tl.ownUntil(formatDateTime(l.end)))
  const m = gig.lineMarks?.[l.id]
  if (m?.departedAt !== undefined) {
    out.push(tl.departed(formatDateTime(m.departedAt), userName(app, m.departedBy)))
  }
  if (m?.returnedAt !== undefined) {
    out.push(tl.returned(formatDateTime(m.returnedAt), userName(app, m.returnedBy)))
  }
  if (l.note) out.push(l.note)
  return out
}

export function GigLines({ gig }: { gig: Gig }) {
  const app = useAppData()
  const wide = useMediaQuery('(min-width: 48em)', true)
  if (gig.lines.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t.page.noLines}
      </Text>
    )
  }
  const rows: Row[] = gig.lines.map((line) => {
    const item = app.itemsById.get(line.itemId)
    return {
      line,
      tag: item?.tag ?? tl.unknownItem,
      name: item && item.name !== item.tag ? item.name : '',
      details: lineDetails(app, gig, line),
      conflicts: lineConflictViews(app.availability, gig, line),
    }
  })

  if (!wide) {
    return (
      <Stack gap="xs" component="ul" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {rows.map((r) => (
          <li key={r.line.id}>
            <Paper p="sm">
              <Stack gap={4}>
                <Text fw={600}>
                  {r.tag} {r.name}
                  <Text span c="dimmed" fw={400}>
                    {' '}
                    × {r.line.qty}
                  </Text>
                </Text>
                {r.details.map((d) => (
                  <Text key={d} size="sm">
                    {d}
                  </Text>
                ))}
                <Status row={r} />
              </Stack>
            </Paper>
          </li>
        ))}
      </Stack>
    )
  }

  return (
    <Table.ScrollContainer minWidth={560}>
      <Table withTableBorder verticalSpacing="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{tl.columns.tag}</Table.Th>
            <Table.Th>{tl.columns.name}</Table.Th>
            <Table.Th ta="right">{tl.columns.qty}</Table.Th>
            <Table.Th>{tl.columns.time}</Table.Th>
            <Table.Th>{tl.columns.status}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.line.id}>
              <Table.Td fw={600}>{r.tag}</Table.Td>
              <Table.Td>{r.name}</Table.Td>
              <Table.Td ta="right">{r.line.qty}</Table.Td>
              <Table.Td>
                {r.details.map((d) => (
                  <Text key={d} size="sm">
                    {d}
                  </Text>
                ))}
              </Table.Td>
              <Table.Td>
                <Status row={r} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

function Status({ row }: { row: Row }) {
  if (row.conflicts.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {tl.ok}
      </Text>
    )
  }
  return <LineConflicts conflicts={row.conflicts} />
}
