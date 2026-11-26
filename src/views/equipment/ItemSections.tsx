/** Read-only sections of the item page (Laitekortti). */
import { Anchor, Badge, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { userName, type AppData } from '../../app/appData'
import { CONDITION_SRC } from '../../core/availability'
import { formatDateTime, formatShortDate, type Ms } from '../../core/time'
import type { Item, Stored } from '../../core/types'
import { fi } from '../../fi'
import { gigsUsingItem } from './history'
import { activeGigDemands, nextGigDemand } from './status'
import { t } from './texts'
import { placeLabel } from './useSituations'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper p="md" component="section">
      <Stack gap="xs">
        <Title order={3} size="h4">
          {title}
        </Title>
        {children}
      </Stack>
    </Paper>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>{children}</Text>
    </div>
  )
}

export function ItemFacts({ app, item }: { app: AppData; item: Item }) {
  const makerModel = [item.manufacturer, item.model].filter(Boolean).join(' ')
  return (
    <Section title={t.item.facts}>
      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm" verticalSpacing="xs">
        <Fact label={t.item.category}>{item.category || fi.none}</Fact>
        <Fact label={t.item.manufacturerModel}>{makerModel || fi.none}</Fact>
        <Fact label={t.item.serialNo}>{item.serialNo ?? fi.none}</Fact>
        <Fact label={t.item.quantity}>
          {item.quantity === 1 ? t.item.unit : t.item.pieces(item.quantity)}
        </Fact>
        <Fact label={t.item.homeLocation}>
          {app.locationsById.get(item.homeLocationId)?.name ?? fi.none}
        </Fact>
        <Fact label={t.item.responsible}>{userName(app, item.responsible) || fi.none}</Fact>
        <Fact label={t.conditionLabel}>
          {t.condition[item.condition]}
          {item.condition !== 'ok' && item.conditionUntil !== undefined
            ? `, ${t.conditionUntil(formatDateTime(item.conditionUntil))}`
            : ''}
        </Fact>
      </SimpleGrid>
      {item.notes && <Fact label={t.item.notes}>{item.notes}</Fact>}
    </Section>
  )
}

function GigLink({ app, gigId }: { app: AppData; gigId: string }) {
  return (
    <Anchor component={Link} to={`/keikat/${gigId}`}>
      {app.gigsById.get(gigId)?.name ?? gigId}
    </Anchor>
  )
}

/** "Nyt" and "Seuraavaksi". */
export function NowAndNext({ app, item }: { app: AppData; item: Item }) {
  const demands = app.availability.demandsFor(item.id)
  const active = activeGigDemands(demands, app.now)
  const next = nextGigDemand(demands, app.now)
  const showQty = item.quantity > 1
  const nextGig = next ? app.gigsById.get(next.src) : undefined
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      <Section title={t.item.now}>
        {active.length === 0 ? (
          <Text>{t.item.atHome(app.locationsById.get(item.homeLocationId)?.name ?? fi.none)}</Text>
        ) : (
          active.map((d) => {
            const gig = app.gigsById.get(d.src)
            return (
              <Text key={`${d.src}/${d.lineId ?? ''}/${d.start}`}>
                {d.dueAt === undefined ? t.item.onGig : t.item.notReturned(formatDateTime(d.dueAt))}
                {': '}
                <GigLink app={app} gigId={d.src} />
                {gig ? `, ${placeLabel(app.locationsById, gig)}` : ''}
                {showQty ? ` (${t.item.qty(d.qty)})` : ''}
              </Text>
            )
          })
        )}
      </Section>
      <Section title={t.item.next}>
        {next ? (
          <Text>
            <GigLink app={app} gigId={next.src} />
            {`, ${t.item.fromAt(formatDateTime(next.start))}`}
            {nextGig ? `, ${placeLabel(app.locationsById, nextGig)}` : ''}
            {showQty ? ` (${t.item.qty(next.qty)})` : ''}
          </Text>
        ) : (
          <Text c="dimmed">{t.item.nextNone}</Text>
        )}
      </Section>
    </SimpleGrid>
  )
}

const endText = (end: Ms) => (end === Infinity ? t.item.untilFurther : formatDateTime(end))

/** Current and upcoming red/yellow segments of the item, if any. */
export function ItemConflicts({ app, item }: { app: AppData; item: Item }) {
  const segments = app.availability.segments(item.id).filter((s) => s.end > app.now)
  if (segments.length === 0) return null
  const srcName = (src: string) =>
    src === CONDITION_SRC ? t.item.conditionSrc : (app.gigsById.get(src)?.name ?? src)
  return (
    <Section title={t.item.conflicts}>
      {segments.map((s) => (
        <Group key={`${s.start}-${s.end}`} gap="xs" wrap="nowrap" align="flex-start">
          <Badge color={s.red ? 'red' : 'orange'} style={{ flexShrink: 0 }}>
            {s.red ? t.item.red : t.item.yellow}
          </Badge>
          <Text size="sm">
            {s.start <= app.now ? t.item.nowFrom : formatDateTime(s.start)} – {endText(s.end)}:{' '}
            {s.allSrcs.map(srcName).join(', ')}
          </Text>
        </Group>
      ))}
    </Section>
  )
}

function dateSpan(start: Ms, end: Ms): string {
  const a = formatShortDate(start)
  // equipEnd is exclusive; a gig ending at midnight belongs to the previous day.
  const b = formatShortDate(end - 1)
  return a === b ? a : `${a} – ${b}`
}

/** "Viimeisimmät ja tulevat keikat". */
export function GigHistory({ app, item }: { app: AppData; item: Stored<Item> }) {
  const uses = gigsUsingItem(app.data.gigs, item.id)
  return (
    <Section title={t.item.history}>
      {uses.length === 0 ? (
        <Text c="dimmed">{t.item.historyNone}</Text>
      ) : (
        <Stack gap="xs" component="ul" p={0} m={0} style={{ listStyle: 'none' }}>
          {uses.map(({ gig, qty }) => (
            <li key={gig.id}>
              <Group justify="space-between" gap="xs" wrap="nowrap" align="flex-start">
                <div style={{ minWidth: 0 }}>
                  <Anchor component={Link} to={`/keikat/${gig.id}`} fw={600}>
                    {gig.name}
                  </Anchor>
                  <Text size="sm" c="dimmed">
                    {[
                      dateSpan(gig.equipStart, gig.equipEnd),
                      placeLabel(app.locationsById, gig),
                      item.quantity > 1 ? t.item.qty(qty) : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </div>
                <Badge
                  color={gig.status === 'peruttu' ? 'gray' : 'slate'}
                  variant={gig.status === 'alustava' ? 'outline' : 'light'}
                  style={{ flexShrink: 0 }}
                >
                  {t.gigStatus[gig.status]}
                </Badge>
              </Group>
            </li>
          ))}
        </Stack>
      )}
    </Section>
  )
}
