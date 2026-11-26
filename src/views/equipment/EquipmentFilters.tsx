import { CloseButton, NativeSelect, SimpleGrid, Switch, TextInput } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import type { ListFilters } from './search'
import { SITUATION_KINDS } from './status'
import { t } from './texts'

export function EquipmentFilters({
  filters,
  categories,
  onChange,
}: {
  filters: ListFilters
  categories: readonly string[]
  onChange: (next: Partial<ListFilters>) => void
}) {
  // Keep a category chosen earlier selectable even if no item uses it any more.
  const categoryOptions =
    filters.category && !categories.includes(filters.category)
      ? [...categories, filters.category]
      : categories
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm" verticalSpacing="xs">
      <TextInput
        inputMode="search"
        enterKeyHint="search"
        label={t.filters.search}
        placeholder={t.filters.searchPlaceholder}
        leftSection={<IconSearch size={16} aria-hidden />}
        value={filters.query}
        onChange={(e) => onChange({ query: e.currentTarget.value })}
        rightSection={
          filters.query ? (
            <CloseButton
              aria-label={t.filters.clearSearch}
              onClick={() => onChange({ query: '' })}
            />
          ) : null
        }
      />
      <NativeSelect
        label={t.filters.category}
        data={[{ value: '', label: t.filters.allCategories }, ...categoryOptions]}
        value={filters.category}
        onChange={(e) => onChange({ category: e.currentTarget.value })}
      />
      <NativeSelect
        label={t.filters.situation}
        data={[
          { value: '', label: t.filters.allSituations },
          ...SITUATION_KINDS.map((k) => ({ value: k, label: t.situation[k] })),
        ]}
        value={filters.situation ?? ''}
        onChange={(e) =>
          onChange({ situation: SITUATION_KINDS.find((k) => k === e.currentTarget.value) })
        }
      />
      <Switch
        label={t.filters.showArchived}
        checked={filters.showArchived}
        onChange={(e) => onChange({ showArchived: e.currentTarget.checked })}
        style={{ alignSelf: 'end', minHeight: 44, display: 'flex', alignItems: 'center' }}
      />
    </SimpleGrid>
  )
}
