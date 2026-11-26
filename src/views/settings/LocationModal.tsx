/** Create or edit a location (plan 2.3, 2.4). */
import { Button, Group, Modal, Stack, Switch, TagsInput, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useMediaQuery } from '@mantine/hooks'
import { useState } from 'react'
import { useAppData } from '../../app/appData'
import type { Location, Stored } from '../../core/types'
import { createLocation, saveLocation } from '../../data/writes'
import { fi } from '../../fi'
import { notifyError, notifySaved } from '../../ui/errors'
import {
  EMPTY_LOCATION_FORM,
  formToLocationInput,
  LOCATION_LIMITS,
  locationToForm,
  validateLocationForm,
  type LocationFormValues,
} from './locationForm'
import { t } from './texts'

const tf = t.locations.form

export function LocationModal({
  location,
  onClose,
}: {
  /** The location to edit, as it was when the form was opened; undefined creates one. */
  location?: Stored<Location> | undefined
  onClose: () => void
}) {
  const app = useAppData()
  const phone = useMediaQuery('(max-width: 47.99em)') === true
  const [busy, setBusy] = useState(false)
  // The baseline stays as opened, so a concurrent change is detected on save.
  const [baseline] = useState(location)
  const form = useForm<LocationFormValues>({
    initialValues: baseline ? locationToForm(baseline) : EMPTY_LOCATION_FORM,
    validate: (v) => validateLocationForm(v, tf),
  })

  const submit = async (values: LocationFormValues) => {
    const input = formToLocationInput(values)
    setBusy(true)
    try {
      if (baseline) {
        await saveLocation(app.db, baseline, { id: baseline.id, ...input }, app.author)
        notifySaved()
      } else {
        await createLocation(app.db, input, app.author)
        notifySaved(t.locations.created)
      }
      onClose()
    } catch (e) {
      notifyError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title={baseline ? tf.editTitle : tf.createTitle}
      size="lg"
      fullScreen={phone}
    >
      <form onSubmit={form.onSubmit((v) => void submit(v))} noValidate>
        <Stack>
          <TextInput
            label={tf.name}
            required
            maxLength={LOCATION_LIMITS.name}
            data-autofocus
            {...form.getInputProps('name')}
          />
          <Switch
            label={tf.isOwnStudio}
            description={tf.isOwnStudioHint}
            size="md"
            {...form.getInputProps('isOwnStudio', { type: 'checkbox' })}
          />
          <TagsInput
            label={tf.rooms}
            description={tf.roomsHint}
            placeholder={tf.roomsPlaceholder}
            clearable
            maxTags={LOCATION_LIMITS.rooms}
            {...form.getInputProps('rooms')}
          />
          <TextInput
            label={tf.address}
            maxLength={LOCATION_LIMITS.address}
            {...form.getInputProps('address')}
          />
          <Textarea
            label={tf.loadingNotes}
            autosize
            minRows={2}
            maxLength={LOCATION_LIMITS.loadingNotes}
            {...form.getInputProps('loadingNotes')}
          />
          <Textarea
            label={tf.contact}
            autosize
            minRows={1}
            maxLength={LOCATION_LIMITS.contact}
            {...form.getInputProps('contact')}
          />
          {baseline && (
            <Switch
              label={tf.archived}
              description={tf.archivedHint}
              size="md"
              {...form.getInputProps('archived', { type: 'checkbox' })}
            />
          )}
          <Group justify="flex-end" mt="sm">
            <Button variant="default" size="md" onClick={onClose} disabled={busy}>
              {fi.cancel}
            </Button>
            <Button type="submit" size="md" loading={busy}>
              {fi.save}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
