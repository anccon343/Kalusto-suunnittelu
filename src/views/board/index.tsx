/**
 * Kalustotaulu (plan section 3, wireframe 3.3): items × Helsinki days. One week on
 * phones, two on wider screens; weeks start on Monday. Read-only: bars link to gigs.
 */
import { Anchor, Group, Stack, Text, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAppData } from '../../app/appData'
import { dateOf } from '../../core/time'
import { BoardFilters, PeriodNav } from './BoardControls'
import { BoardGrid } from './BoardGrid'
import { Legend } from './Legend'
import { periodDays, periodStart, periodWeeks, periodWindow, shiftPeriod } from './period'
import { categories, rowCache, visibleItems } from './rows'
import { t } from './texts'

const START_PARAM = 'alku'
const CATEGORY_PARAM = 'kategoria'

export default function BoardView() {
  const app = useAppData()
  const wide = useMediaQuery('(min-width: 48em)', true)
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const count = periodDays(wide)
  // Keyed by the ISO date so the window (and the row cache) survives re-renders.
  const startIso = periodStart(params.get(START_PARAM), app.now)
  const days = useMemo(() => periodWindow(startIso, count), [startIso, count])
  const today = dateOf(app.now)

  const category = params.get(CATEGORY_PARAM) ?? ''
  const allCategories = useMemo(() => categories(app.data.items), [app.data.items])
  const items = useMemo(
    () => visibleItems(app.data.items, { category, query: deferredQuery }),
    [app.data.items, category, deferredQuery],
  )

  // Row layouts are cached per item for this data snapshot and window.
  const { availability, gigsById } = app
  const rowOf = useMemo(
    () => rowCache(days, availability, (id) => gigsById.get(id)?.name ?? t.unknownGig),
    [days, availability, gigsById],
  )

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === null || value === '') next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )

  const hasItems = app.data.items.some((it) => !it.archived)

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" gap="sm">
        <Title order={2}>{t.title}</Title>
        <PeriodNav
          days={days}
          weeks={periodWeeks(days)}
          onShift={(dir) => setParam(START_PARAM, shiftPeriod(startIso, count, dir))}
          onToday={() => setParam(START_PARAM, null)}
        />
      </Group>
      {hasItems ? (
        <>
          <BoardFilters
            categories={allCategories}
            category={category}
            onCategory={(v) => setParam(CATEGORY_PARAM, v)}
            query={query}
            onQuery={setQuery}
          />
          {items.length === 0 ? (
            <Text>{t.noMatches}</Text>
          ) : (
            <BoardGrid days={days} today={today} items={items} rowOf={rowOf} />
          )}
          <Legend />
        </>
      ) : (
        <Text>
          {t.noItems}{' '}
          <Anchor component={Link} to="/kalusto">
            {t.addItems}
          </Anchor>
        </Text>
      )}
    </Stack>
  )
}
