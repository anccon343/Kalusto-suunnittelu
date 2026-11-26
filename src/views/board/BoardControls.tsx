/** Period navigation (previous, Tänään, next) and the category and search filters. */
import {
  ActionIcon,
  Box,
  Button,
  Group,
  NativeSelect,
  SimpleGrid,
  Text,
  TextInput,
} from '@mantine/core'
import { IconChevronLeft, IconChevronRight, IconSearch } from '@tabler/icons-react'
import { formatShortDate, formatDate } from '../../core/time'
import type { BoardDay } from './layout'
import { t } from './texts'

export function PeriodNav({
  days,
  weeks,
  onShift,
  onToday,
}: {
  days: readonly BoardDay[]
  weeks: { from: number; to: number }
  onShift: (direction: 1 | -1) => void
  onToday: () => void
}) {
  const first = days[0]
  const last = days.at(-1)
  return (
    <Group gap="xs" wrap="nowrap">
      <ActionIcon
        variant="default"
        size="xl"
        flex="none"
        aria-label={t.previous(days.length)}
        onClick={() => onShift(-1)}
      >
        <IconChevronLeft size={20} />
      </ActionIcon>
      <Button variant="default" size="md" flex="none" onClick={onToday}>
        {t.today}
      </Button>
      <ActionIcon
        variant="default"
        size="xl"
        flex="none"
        aria-label={t.next(days.length)}
        onClick={() => onShift(1)}
      >
        <IconChevronRight size={20} />
      </ActionIcon>
      <Box miw={0} aria-live="polite">
        <Text fw={600} size="sm">
          {t.weekRange(weeks.from, weeks.to)}
        </Text>
        {first && last && (
          <Text size="xs" c="dimmed">
            {`${formatShortDate(first.start)}–${formatDate(last.start)}`}
          </Text>
        )}
      </Box>
    </Group>
  )
}

export function BoardFilters({
  categories,
  category,
  onCategory,
  query,
  onQuery,
}: {
  categories: readonly string[]
  category: string
  onCategory: (value: string) => void
  query: string
  onQuery: (value: string) => void
}) {
  return (
    <SimpleGrid cols={2} spacing="sm">
      <NativeSelect
        label={t.category}
        size="md"
        value={category}
        onChange={(e) => onCategory(e.currentTarget.value)}
        data={[{ value: '', label: t.allCategories }, ...categories]}
        miw={0}
      />
      <TextInput
        label={t.search}
        size="md"
        type="search"
        placeholder={t.searchPlaceholder}
        leftSection={<IconSearch size={16} />}
        value={query}
        onChange={(e) => onQuery(e.currentTarget.value)}
        miw={0}
      />
    </SimpleGrid>
  )
}
