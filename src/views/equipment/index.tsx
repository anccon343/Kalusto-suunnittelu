/**
 * Kalusto (plan section 3): searchable equipment list with Kunto and Tilanne, and the
 * add form. Filters live in the URL so returning from an item page keeps them.
 */
import { Alert, Anchor, Button, Group, Stack, Text, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconPlus } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAppData } from '../../app/appData'
import { EquipmentCards, EquipmentTable, type Row } from './EquipmentList'
import { EquipmentFilters } from './EquipmentFilters'
import { emptyValues } from './itemForm'
import { ItemFormModal, type FormRequest } from './ItemFormModal'
import { categoriesOf, filterItems, type ListFilters } from './search'
import { SITUATION_KINDS } from './status'
import { t } from './texts'
import { useSituations } from './useSituations'

const PARAM = { query: 'q', category: 'kategoria', situation: 'tilanne', archived: 'arkistoidut' }

function readFilters(p: URLSearchParams): ListFilters {
  const s = p.get(PARAM.situation)
  return {
    query: p.get(PARAM.query) ?? '',
    category: p.get(PARAM.category) ?? '',
    situation: SITUATION_KINDS.find((k) => k === s),
    showArchived: p.get(PARAM.archived) === '1',
  }
}

function writeFilters(f: ListFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.query) p.set(PARAM.query, f.query)
  if (f.category) p.set(PARAM.category, f.category)
  if (f.situation) p.set(PARAM.situation, f.situation)
  if (f.showArchived) p.set(PARAM.archived, '1')
  return p
}

export default function EquipmentView() {
  const app = useAppData()
  const navigate = useNavigate()
  const wide = useMediaQuery('(min-width: 48em)', true)
  const [params, setParams] = useSearchParams()
  const filters = readFilters(params)
  const [request, setRequest] = useState<FormRequest | null>(null)
  const situations = useSituations(app)
  const categories = useMemo(() => categoriesOf(app.data.items), [app.data.items])

  const rows: Row[] = filterItems(
    app.data.items,
    filters,
    (i) => situations.get(i.id)?.kind ?? 'vapaa',
  ).flatMap((item) => {
    const situation = situations.get(item.id)
    return situation ? [{ item, situation }] : []
  })
  const total = app.data.items.filter((i) => filters.showArchived || !i.archived).length

  const setFilters = (next: Partial<ListFilters>) =>
    setParams(writeFilters({ ...filters, ...next }), { replace: true })
  const open = (itemId: string) => void navigate(`/kalusto/${itemId}`)

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Title order={2}>{t.title}</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          disabled={!app.ownStudio}
          mih={44}
          onClick={() =>
            setRequest({
              kind: 'create',
              title: t.form.createTitle,
              values: emptyValues(app.ownStudio?.id),
            })
          }
        >
          {t.add}
        </Button>
      </Group>

      {!app.ownStudio && (
        <Alert color="orange" title={t.noOwnStudio}>
          <Anchor component={Link} to="/asetukset">
            {t.noOwnStudioLink}
          </Anchor>
        </Alert>
      )}

      <EquipmentFilters filters={filters} categories={categories} onChange={setFilters} />

      {app.data.items.length === 0 ? (
        <Text>{t.emptyAll}</Text>
      ) : rows.length === 0 ? (
        <Text>{t.emptyFiltered}</Text>
      ) : (
        <>
          <Text size="sm" c="dimmed" aria-live="polite">
            {t.count(rows.length, total)}
          </Text>
          {wide ? <EquipmentTable rows={rows} onOpen={open} /> : <EquipmentCards rows={rows} />}
        </>
      )}

      <ItemFormModal request={request} onClose={() => setRequest(null)} />
    </Stack>
  )
}
