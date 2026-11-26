/**
 * Keikka overview (/keikat/:gigId): basics, the four times, conflicts and lines, with
 * Muokkaa, Vahvista, Peru keikka and Poista (plan 3.2, 4.3). Lähti and Palautettu
 * and direct transfers are phase 1b; existing marks are shown read-only.
 */
import { Alert, Anchor, Badge, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { IconChevronLeft } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { userName, useAppData } from '../../app/appData'
import { formatDate, formatTime, formatWeek, type Ms } from '../../core/time'
import type { Gig, GigStatus, Stored } from '../../core/types'
import { BlockedAlert } from './Conflicts'
import { confirmBlockers, conflictCounts, type Blocking } from './draft'
import { GigActions } from './GigActions'
import { GigLines } from './GigLines'
import { GigNotFound } from './GigNotFound'
import { t } from './texts'

const STATUS_COLOR: Record<GigStatus, string> = {
  alustava: 'gray',
  vahvistettu: 'slate',
  valmis: 'teal',
  peruttu: 'dark',
}

export default function GigPage() {
  const { gigId } = useParams()
  const app = useAppData()
  const gig = gigId === undefined ? undefined : app.gigsById.get(gigId)
  if (!gig) return <GigNotFound />
  return <GigOverview key={gig.id} gig={gig} />
}

function GigOverview({ gig }: { gig: Stored<Gig> }) {
  const app = useAppData()
  const [blockers, setBlockers] = useState<Blocking[]>([])
  const location = app.locationsById.get(gig.locationId)
  const counts = useMemo(() => conflictCounts(app.availability, gig), [app.availability, gig])
  const confirmBlocked = useMemo(
    () => gig.status === 'alustava' && confirmBlockers(app, gig).length > 0,
    [app, gig],
  )
  const crew = gig.crew.map((e) => userName(app, e)).join(', ')

  return (
    <Stack gap="md">
      <Anchor component={Link} to="/kalenteri" size="sm">
        <Group gap={4} component="span">
          <IconChevronLeft size={16} aria-hidden />
          {t.backToCalendar}
        </Group>
      </Anchor>

      <Group justify="space-between" align="flex-start" gap="sm">
        <Stack gap={4} style={{ minWidth: 0, flex: '1 1 16rem' }}>
          <Group gap="xs" align="center">
            <Title order={2} style={{ overflowWrap: 'anywhere' }}>
              {gig.name}
            </Title>
            <Badge color={STATUS_COLOR[gig.status]} size="lg">
              {t.status[gig.status]}
            </Badge>
          </Group>
          {gig.client && <Text c="dimmed">{gig.client}</Text>}
        </Stack>
        <GigActions gig={gig} onBlocked={setBlockers} />
      </Group>

      <BlockedAlert blockers={blockers} title={t.blocked.confirmTitle} />
      <ConflictSummary red={counts.red} yellow={counts.yellow} confirmBlocked={confirmBlocked} />

      <Paper p="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="sm">
          <Fact label={t.fields.location}>
            {[location?.name ?? gig.locationId, gig.room].filter(Boolean).join(' › ')}
          </Fact>
          <Fact label={t.page.responsible}>{userName(app, gig.responsible)}</Fact>
          <Fact label={t.page.crew}>{crew || t.page.noCrew}</Fact>
          <Fact label={formatWeek(gig.eventStart)}>
            {gig.confirmedAt !== undefined &&
              t.page.confirmedBy(
                `${formatDate(gig.confirmedAt)} ${formatTime(gig.confirmedAt)}`,
                userName(app, gig.confirmedBy),
              )}
          </Fact>
        </SimpleGrid>
      </Paper>

      <Paper p="md">
        <Stack gap="xs">
          <TimeRow label={t.fields.equipStart} at={gig.equipStart} />
          <EventRow start={gig.eventStart} end={gig.eventEnd} />
          <TimeRow label={t.fields.equipEnd} at={gig.equipEnd} />
          {gig.departedAt !== undefined && (
            <TimeRow
              label={t.page.departed}
              at={gig.departedAt}
              who={userName(app, gig.departedBy)}
            />
          )}
          {gig.returnedAt !== undefined && (
            <TimeRow
              label={t.page.returned}
              at={gig.returnedAt}
              who={userName(app, gig.returnedBy)}
            />
          )}
        </Stack>
      </Paper>

      {gig.notes && (
        <Paper p="md">
          <Title order={3} size="h4" mb="xs">
            {t.page.notes}
          </Title>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{gig.notes}</Text>
        </Paper>
      )}

      <Stack gap="xs">
        <Title order={3} size="h4">
          {t.page.equipment}
        </Title>
        <GigLines gig={gig} />
      </Stack>
    </Stack>
  )
}

function ConflictSummary({
  red,
  yellow,
  confirmBlocked,
}: {
  red: number
  yellow: number
  confirmBlocked: boolean
}) {
  if (red === 0 && yellow === 0) return null
  return (
    <Alert
      color={red > 0 ? 'red' : 'orange'}
      title={red > 0 ? t.conflicts.red : t.conflicts.yellow}
    >
      {t.conflicts.summary(red, yellow)}
      {confirmBlocked && `. ${t.conflicts.confirmBlocked}`}
    </Alert>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null
  return (
    <div>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text>{children}</Text>
    </div>
  )
}

function TimeRow({ label, at, who }: { label: string; at: Ms; who?: string }) {
  return (
    <Group gap="sm" wrap="wrap" align="baseline">
      <Text size="sm" c="dimmed" w={150}>
        {label}
      </Text>
      <Text style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatDate(at)} {formatTime(at)}
        {who ? `, ${who}` : ''}
      </Text>
    </Group>
  )
}

function EventRow({ start, end }: { start: Ms; end: Ms }) {
  const sameDay = formatDate(start) === formatDate(end)
  return (
    <Group gap="sm" wrap="wrap" align="baseline">
      <Text size="sm" c="dimmed" w={150}>
        {t.fields.event}
      </Text>
      <Text style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatDate(start)} {formatTime(start)}
        {sameDay
          ? `–${formatTime(end).replace('klo ', '')}`
          : ` – ${formatDate(end)} ${formatTime(end)}`}
      </Text>
    </Group>
  )
}
