/**
 * Add, edit and "Monista" form (plan 4.1). Edits are saved against the version the
 * form was opened with, so a field changed elsewhere meanwhile is reported instead
 * of overwritten; the form then stays open.
 */
import {
  Autocomplete,
  Button,
  Group,
  Modal,
  NativeSelect,
  NumberInput,
  SimpleGrid,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useMediaQuery } from '@mantine/hooks'
import { useMemo, useState } from 'react'
import { useAppData } from '../../app/appData'
import type { Item, ItemCondition, Stored } from '../../core/types'
import { createItem, saveItem } from '../../data/writes'
import { DateTimeField } from '../../ui/DateTimeField'
import { notifyError, notifySaved } from '../../ui/errors'
import {
  LIMITS,
  toEditedItem,
  toNewItem,
  validateValues,
  valuesFromItem,
  type ItemFormValues,
} from './itemForm'
import { categoriesOf } from './search'
import { fi } from '../../fi'
import { t } from './texts'

/** What the form is opened for; `null` keeps it closed. */
export type FormRequest =
  | { kind: 'create'; values: ItemFormValues; title: string }
  | { kind: 'edit'; baseline: Stored<Item> }

const CONDITIONS: readonly ItemCondition[] = ['ok', 'huollossa', 'rikki']

export function ItemFormModal({
  request,
  onClose,
  onCreated,
}: {
  request: FormRequest | null
  onClose: () => void
  onCreated?: (id: string) => void
}) {
  const wide = useMediaQuery('(min-width: 48em)', true)
  const title =
    request === null
      ? ''
      : request.kind === 'edit'
        ? t.form.editTitle(request.baseline.tag)
        : request.title
  return (
    <Modal
      opened={request !== null}
      onClose={onClose}
      title={title}
      size="lg"
      fullScreen={!wide}
      closeButtonProps={{ 'aria-label': fi.close }}
    >
      {request && (
        <ItemForm request={request} onClose={onClose} {...(onCreated ? { onCreated } : {})} />
      )}
    </Modal>
  )
}

function ItemForm({
  request,
  onClose,
  onCreated,
}: {
  request: FormRequest
  onClose: () => void
  onCreated?: (id: string) => void
}) {
  const app = useAppData()
  const [busy, setBusy] = useState(false)
  const ownId = request.kind === 'edit' ? request.baseline.id : undefined

  const otherTags = useMemo(
    () => app.data.items.filter((i) => i.id !== ownId).map((i) => i.tag),
    [app.data.items, ownId],
  )
  const categories = useMemo(() => categoriesOf(app.data.items), [app.data.items])

  const form = useForm<ItemFormValues>({
    mode: 'controlled',
    initialValues: request.kind === 'edit' ? valuesFromItem(request.baseline) : request.values,
    validate: (values) => validateValues(values, otherTags),
  })
  const v = form.values

  const currentHome = v.homeLocationId
  const locationOptions = [
    ...(currentHome ? [] : [{ value: '', label: t.form.choose, disabled: true }]),
    ...app.data.locations
      .filter((l) => !l.archived || l.id === currentHome)
      .map((l) => ({ value: l.id, label: l.name })),
  ]
  const userOptions = [
    { value: '', label: t.form.responsiblePlaceholder },
    ...app.data.users.map((u) => ({ value: u.email, label: u.name })),
    ...(v.responsible && !app.usersByEmail.has(v.responsible)
      ? [{ value: v.responsible, label: v.responsible }]
      : []),
  ]

  async function submit(values: ItemFormValues) {
    setBusy(true)
    try {
      if (request.kind === 'edit') {
        const edited = toEditedItem(request.baseline, values)
        await saveItem(app.db, request.baseline, edited, app.author)
        notifySaved()
      } else {
        const item = toNewItem(values)
        const id = await createItem(app.db, item, app.author)
        notifySaved(t.form.created(item.tag))
        onCreated?.(id)
      }
      onClose()
    } catch (e) {
      notifyError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={form.onSubmit((values) => void submit(values))} noValidate>
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label={t.form.tag}
            description={t.form.tagDescription}
            required
            maxLength={LIMITS.tag}
            autoCapitalize="characters"
            autoComplete="off"
            data-autofocus
            {...form.getInputProps('tag')}
          />
          <TextInput
            label={t.form.name}
            required
            maxLength={LIMITS.name}
            {...form.getInputProps('name')}
          />
        </SimpleGrid>
        <Autocomplete
          label={t.form.category}
          description={t.form.categoryDescription}
          data={categories}
          maxLength={LIMITS.category}
          {...form.getInputProps('category')}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label={t.form.manufacturer}
            maxLength={LIMITS.manufacturer}
            {...form.getInputProps('manufacturer')}
          />
          <TextInput
            label={t.form.model}
            maxLength={LIMITS.model}
            {...form.getInputProps('model')}
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <NumberInput
            label={t.form.quantity}
            description={t.form.quantityDescription}
            required
            min={1}
            max={LIMITS.quantity}
            allowDecimal={false}
            allowNegative={false}
            inputMode="numeric"
            {...form.getInputProps('quantity')}
          />
          <TextInput
            label={t.form.serialNo}
            maxLength={LIMITS.serialNo}
            {...form.getInputProps('serialNo')}
          />
        </SimpleGrid>
        <NativeSelect
          label={t.form.condition}
          data={CONDITIONS.map((c) => ({ value: c, label: t.condition[c] }))}
          value={v.condition}
          onChange={(e) => form.setFieldValue('condition', e.currentTarget.value as ItemCondition)}
        />
        {v.condition !== 'ok' && (
          <DateTimeField
            label={t.form.conditionUntil}
            description={t.form.conditionUntilDescription}
            value={v.conditionUntil}
            onChange={(ms) => form.setFieldValue('conditionUntil', ms)}
          />
        )}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <NativeSelect
            label={t.form.homeLocation}
            required
            data={locationOptions}
            value={v.homeLocationId ?? ''}
            error={form.errors.homeLocationId}
            onChange={(e) => form.setFieldValue('homeLocationId', e.currentTarget.value || null)}
          />
          <NativeSelect
            label={t.form.responsible}
            data={userOptions}
            value={v.responsible ?? ''}
            onChange={(e) => form.setFieldValue('responsible', e.currentTarget.value || null)}
          />
        </SimpleGrid>
        <Textarea
          label={t.form.notes}
          autosize
          minRows={2}
          maxRows={8}
          maxLength={LIMITS.notes}
          {...form.getInputProps('notes')}
        />
        <Group justify="flex-end" gap="sm" mt="xs">
          <Button variant="default" onClick={onClose} disabled={busy} mih={44}>
            {t.form.cancel}
          </Button>
          <Button type="submit" loading={busy} mih={44}>
            {t.form.save}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
