/**
 * Equipment lines of the gig form: add by tag or name with an availability hint, edit
 * quantity, note and own time, see live conflicts and swap a conflicting device
 * (plan 3.2, 4.2–4.3).
 */
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core'
import { IconArrowsExchange, IconTrash } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { useAppData } from '../../app/appData'
import type { Availability } from '../../core/availability'
import { formatDateTime } from '../../core/time'
import type { Gig, Item, Line } from '../../core/types'
import { DateTimeField } from '../../ui/DateTimeField'
import { LineConflicts } from './Conflicts'
import { freeHint, lineConflictViews, lineWindow, swapCandidates } from './draft'
import { LINE_NOTE_MAX, newLineDraft, newLineId, type LineDraft } from './gigForm'
import { itemLabel, itemOptions } from './options'
import { t } from './texts'

const tl = t.lines

export interface LinesEditorProps {
  lines: readonly LineDraft[]
  onChange: (lines: LineDraft[]) => void
  /** The gig as the form describes it, when complete and in valid order. */
  gig: Gig | undefined
  model: Availability | undefined
  errors: Readonly<Record<string, readonly string[]>>
}

export function LinesEditor({ lines, onChange, gig, model, errors }: LinesEditorProps) {
  const app = useAppData()
  const [swapping, setSwapping] = useState<string | null>(null)

  const update = (id: string, patch: Partial<LineDraft>) =>
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const remove = (id: string) => onChange(lines.filter((l) => l.id !== id))
  const add = (item: Item) => onChange([...lines, newLineDraft(newLineId(lines), item)])

  const swapLine = gig?.lines.find((l) => l.id === swapping)

  return (
    <Stack gap="sm">
      <AddItem lines={lines} gig={gig} model={model} onAdd={add} />
      {!model && (
        <Text size="sm" c="dimmed">
          {tl.needTimes}
        </Text>
      )}
      {lines.length === 0 ? (
        <Text size="sm" c="dimmed">
          {tl.empty}
        </Text>
      ) : (
        <Stack gap="xs" component="ul" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {lines.map((d) => {
            const item = app.itemsById.get(d.itemId)
            const line = gig?.lines.find((l) => l.id === d.id)
            return (
              <li key={d.id}>
                <LineCard
                  draft={d}
                  item={item}
                  gig={gig}
                  line={line}
                  model={model}
                  errors={errors[d.id] ?? []}
                  onChange={(patch) => update(d.id, patch)}
                  onRemove={() => remove(d.id)}
                  onSwap={() => setSwapping(d.id)}
                />
              </li>
            )
          })}
        </Stack>
      )}
      {swapLine && gig && model && (
        <SwapModal
          gig={gig}
          line={swapLine}
          model={model}
          onClose={() => setSwapping(null)}
          onPick={(item) => {
            update(swapLine.id, { itemId: item.id, qty: 1 })
            setSwapping(null)
          }}
        />
      )}
    </Stack>
  )
}

function AddItem({
  lines,
  gig,
  model,
  onAdd,
}: {
  lines: readonly LineDraft[]
  gig: Gig | undefined
  model: Availability | undefined
  onAdd: (item: Item) => void
}) {
  const app = useAppData()
  const [search, setSearch] = useState('')
  const data = useMemo(
    () => itemOptions(app.data.items, new Set(lines.map((l) => l.itemId))),
    [app.data.items, lines],
  )

  return (
    <Select
      label={tl.add}
      placeholder={tl.addPlaceholder}
      data={data}
      value={null}
      searchable
      searchValue={search}
      onSearchChange={setSearch}
      nothingFoundMessage={tl.nothingFound}
      maxDropdownHeight={320}
      size="md"
      onChange={(id) => {
        const item = id ? app.itemsById.get(id) : undefined
        if (item) onAdd(item)
        setSearch('')
      }}
      renderOption={({ option }) => {
        const item = app.itemsById.get(option.value)
        const hint =
          option.disabled === true
            ? tl.alreadyOnGig
            : item && gig && model
              ? freeHint(model, item, lineWindow(gig, {}), gig.id).text
              : ''
        return (
          <Group justify="space-between" wrap="nowrap" w="100%" gap="sm">
            <Text size="sm">{option.label}</Text>
            {hint && (
              <Text size="xs" c={hint === tl.busy ? 'red' : 'dimmed'} style={{ flexShrink: 0 }}>
                {hint}
              </Text>
            )}
          </Group>
        )
      }}
    />
  )
}

interface LineCardProps {
  draft: LineDraft
  item: Item | undefined
  gig: Gig | undefined
  line: Line | undefined
  model: Availability | undefined
  errors: readonly string[]
  onChange: (patch: Partial<LineDraft>) => void
  onRemove: () => void
  onSwap: () => void
}

function LineCard({
  draft: d,
  item,
  gig,
  line,
  model,
  errors,
  onChange,
  onRemove,
  onSwap,
}: LineCardProps) {
  const app = useAppData()
  const label = item ? itemLabel(item) : tl.unknownItem
  const conflicts = gig && line && model ? lineConflictViews(model, gig, line) : []
  const hint =
    item && gig && line && model && item.quantity > 1 && conflicts.length === 0
      ? `${tl.ok} · ${tl.freeMin(freeHint(model, item, lineWindow(gig, line), gig.id).free, item.quantity)}`
      : ''
  const canSwap = item?.quantity === 1 && conflicts.length > 0 && !d.from
  const fromGig = d.from ? (app.gigsById.get(d.from.gigId)?.name ?? d.from.gigId) : undefined

  return (
    <Paper p="sm">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Text fw={600} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            {label}
          </Text>
          <ActionIcon
            variant="subtle"
            color="gray"
            size={44}
            aria-label={tl.remove(label)}
            onClick={onRemove}
          >
            <IconTrash size={20} aria-hidden />
          </ActionIcon>
        </Group>

        {d.from && fromGig !== undefined && (
          <Text size="sm">
            {tl.fromGig(fromGig)}, {tl.handover(formatDateTime(d.from.handoverAt))}
            {d.from.travelMin !== undefined && `, ${tl.travel(d.from.travelMin)}`}
          </Text>
        )}

        <Group gap="sm" align="flex-start" wrap="wrap">
          {item && item.quantity > 1 ? (
            <NumberInput
              label={tl.qty}
              value={d.qty}
              min={1}
              max={item.quantity}
              allowDecimal={false}
              allowNegative={false}
              suffix={` / ${item.quantity}`}
              size="md"
              w={140}
              onChange={(v) => onChange({ qty: typeof v === 'number' ? v : '' })}
            />
          ) : null}
          <TextInput
            label={tl.note}
            value={d.note}
            maxLength={LINE_NOTE_MAX}
            size="md"
            style={{ flex: '1 1 12rem' }}
            onChange={(e) => onChange({ note: e.currentTarget.value })}
          />
        </Group>

        <Switch
          label={tl.ownTime}
          description={tl.ownTimeHint}
          checked={d.ownTime}
          size="md"
          onChange={(e) => onChange({ ownTime: e.currentTarget.checked })}
        />
        {d.ownTime && (
          <Group gap="sm" grow wrap="wrap" align="flex-start">
            <DateTimeField
              label={tl.ownStart}
              value={d.start}
              onChange={(v) => onChange({ start: v })}
            />
            <DateTimeField label={tl.ownEnd} value={d.end} onChange={(v) => onChange({ end: v })} />
          </Group>
        )}

        {errors.map((e) => (
          <Text key={e} size="sm" c="red" role="alert">
            {e}
          </Text>
        ))}
        {hint && (
          <Text size="sm" c="dimmed">
            {hint}
          </Text>
        )}
        <LineConflicts conflicts={conflicts} />
        {canSwap && (
          <Group>
            <Button
              variant="default"
              size="md"
              leftSection={<IconArrowsExchange size={18} aria-hidden />}
              onClick={onSwap}
            >
              {tl.swap}
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  )
}

function SwapModal({
  gig,
  line,
  model,
  onClose,
  onPick,
}: {
  gig: Gig
  line: Line
  model: Availability
  onClose: () => void
  onPick: (item: Item) => void
}) {
  const app = useAppData()
  const current = app.itemsById.get(line.itemId)
  const candidates = swapCandidates(model, app.data.items, gig, line)
  return (
    <Modal opened onClose={onClose} title={tl.swapTitle(current ? itemLabel(current) : '')}>
      <Stack gap="xs">
        {candidates.length === 0 ? (
          <Text size="sm">{tl.swapNone}</Text>
        ) : (
          <>
            <Text size="sm">{tl.swapIntro}</Text>
            {candidates.map((it) => (
              <Button
                key={it.id}
                variant="default"
                size="md"
                justify="space-between"
                aria-label={tl.swapTo(itemLabel(it))}
                rightSection={
                  <Text size="xs" c="dimmed">
                    {tl.free}
                  </Text>
                }
                onClick={() => onPick(it)}
              >
                {itemLabel(it)}
              </Button>
            ))}
          </>
        )}
      </Stack>
    </Modal>
  )
}
