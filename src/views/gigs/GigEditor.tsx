/** The gig form: basics, the four times, status and equipment lines (plan 3.2, 4.2). */
import {
  Alert,
  Button,
  Group,
  Input,
  Modal,
  MultiSelect,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useBlocker, useNavigate, useSearchParams } from 'react-router'
import { useAppData } from '../../app/appData'
import { formatDate, parseDate, startOfDay } from '../../core/time'
import type { Gig, GigStatus, Stored } from '../../core/types'
import { validateGigTimes } from '../../core/validation'
import { createGig, saveGig } from '../../data/writes'
import { DateTimeField } from '../../ui/DateTimeField'
import { notifyError, notifySaved } from '../../ui/errors'
import { BlockedAlert } from './Conflicts'
import { draftModel, saveBlockers } from './draft'
import {
  CLIENT_MAX,
  emptyForm,
  formFromGig,
  formToGig,
  hasErrors,
  NAME_MAX,
  NEW_GIG_ID,
  NOTES_MAX,
  TIME_KEYS,
  validateForm,
  type GigForm,
} from './gigForm'
import { LinesEditor } from './LinesEditor'
import { locationOptions, roomOptions, userOptions } from './options'
import { t } from './texts'

const STATUSES: GigStatus[] = ['alustava', 'vahvistettu', 'valmis', 'peruttu']

export function GigEditor({ baseline: storedBaseline }: { baseline?: Stored<Gig> }) {
  const app = useAppData()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const wide = useMediaQuery('(min-width: 48em)', true)

  // The version the form was opened with; live updates of the gig do not replace it.
  const [baseline] = useState(storedBaseline)
  const [initial] = useState<GigForm>(() =>
    baseline ? formFromGig(baseline) : emptyForm(app.author, app.ownStudio?.id ?? null),
  )
  const [form, setForm] = useState<GigForm>(initial)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const leaving = useRef(false)

  const set = <K extends keyof GigForm>(key: K, value: GigForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const gigId = baseline?.id ?? NEW_GIG_ID
  const draft = useMemo(
    () =>
      formToGig(form, {
        id: gigId,
        ...(baseline ? { base: baseline } : {}),
        now: app.now,
        author: app.author,
      }),
    [form, gigId, baseline, app.now, app.author],
  )
  const model = useMemo(
    () =>
      draft && validateGigTimes(draft).length === 0
        ? draftModel(
            {
              items: app.data.items,
              gigs: app.data.gigs,
              locations: app.data.locations,
              now: app.now,
            },
            draft,
          )
        : undefined,
    [draft, app.data.items, app.data.gigs, app.data.locations, app.now],
  )
  const errors = useMemo(
    () => validateForm(form, (id) => app.itemsById.get(id), baseline?.lines),
    [form, app.itemsById, baseline],
  )
  const blockers = useMemo(
    () => (submitted && draft && model ? saveBlockers(app.availability, model, draft) : []),
    [submitted, draft, model, app.availability],
  )

  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const location = form.locationId ? app.locationsById.get(form.locationId) : undefined
  const locations = locationOptions(app.data.locations, form.locationId)
  const rooms = roomOptions(location, form.room)
  const users = userOptions(app.data.users, [
    ...(form.responsible ? [form.responsible] : []),
    ...form.crew,
  ])
  const chosenDay = baseline ? null : parseDate(params.get('paiva') ?? '')
  const show = (msg: string | undefined) => (submitted ? msg : undefined)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (hasErrors(errors) || !draft || !model) return
    if (saveBlockers(app.availability, model, draft).length > 0) return
    setSaving(true)
    try {
      let id: string
      if (baseline) {
        await saveGig(app.db, baseline, draft, app.isOwnStudio, app.author)
        id = baseline.id
        notifySaved()
      } else {
        const { id: _draftId, ...input } = draft
        id = await createGig(app.db, input, app.isOwnStudio, app.author)
        notifySaved(t.edit.created)
      }
      leaving.current = true
      await navigate(`/keikat/${id}`)
    } catch (err) {
      notifyError(err)
    } finally {
      setSaving(false)
    }
  }

  const cancelTo = baseline ? `/keikat/${baseline.id}` : '/kalenteri'

  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate>
      <Stack gap="md">
        <div>
          <Title order={2}>{baseline ? t.edit.editTitle : t.edit.createTitle}</Title>
          {chosenDay && (
            <Text c="dimmed" size="sm">
              {t.edit.chosenDay(formatDate(startOfDay(chosenDay)))}
            </Text>
          )}
        </div>

        <BlockedAlert blockers={blockers} />
        {submitted && hasErrors(errors) && (
          <Alert color="red" role="alert">
            {t.edit.fixErrors}
          </Alert>
        )}

        <Paper p="md">
          <Stack gap="sm">
            <Title order={3} size="h4">
              {t.edit.basics}
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label={t.fields.name}
                required
                size="md"
                maxLength={NAME_MAX}
                value={form.name}
                error={show(errors.name)}
                onChange={(e) => set('name', e.currentTarget.value)}
              />
              <TextInput
                label={t.fields.client}
                size="md"
                maxLength={CLIENT_MAX}
                value={form.client}
                onChange={(e) => set('client', e.currentTarget.value)}
              />
              <Select
                label={t.fields.location}
                required
                size="md"
                placeholder={t.edit.locationPlaceholder}
                data={locations}
                value={form.locationId}
                searchable
                error={show(errors.locationId)}
                {...(locations.length === 0 ? { description: t.edit.noLocations } : {})}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    locationId: v,
                    room:
                      v && f.room && app.locationsById.get(v)?.rooms.includes(f.room)
                        ? f.room
                        : null,
                  }))
                }
              />
              <Select
                label={t.fields.room}
                size="md"
                placeholder={t.edit.roomPlaceholder}
                data={rooms}
                value={form.room}
                clearable
                disabled={rooms.length === 0}
                onChange={(v) => set('room', v)}
              />
              <Select
                label={t.fields.responsible}
                required
                size="md"
                data={users}
                value={form.responsible}
                searchable
                error={show(errors.responsible)}
                onChange={(v) => set('responsible', v)}
              />
              <MultiSelect
                label={t.fields.crew}
                size="md"
                placeholder={form.crew.length ? undefined : t.edit.crewPlaceholder}
                data={users}
                value={form.crew}
                searchable
                onChange={(v) => set('crew', v)}
              />
            </SimpleGrid>
            <Textarea
              label={t.fields.notes}
              size="md"
              autosize
              minRows={2}
              maxLength={NOTES_MAX}
              value={form.notes}
              onChange={(e) => set('notes', e.currentTarget.value)}
            />
            <Input.Wrapper label={t.fields.status}>
              <SegmentedControl
                mt={4}
                fullWidth
                size="md"
                orientation={wide ? 'horizontal' : 'vertical'}
                value={form.status}
                data={STATUSES.map((s) => ({ value: s, label: t.status[s] }))}
                onChange={(v) => set('status', v as GigStatus)}
              />
            </Input.Wrapper>
          </Stack>
        </Paper>

        <Paper p="md">
          <Stack gap="sm">
            <Title order={3} size="h4">
              {t.edit.times}
            </Title>
            <Text size="sm" c="dimmed">
              {t.edit.timesHint}
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              {TIME_KEYS.map((k) => (
                <DateTimeField
                  key={k}
                  label={t.fields[k]}
                  required
                  value={form[k]}
                  error={show(errors[k])}
                  onChange={(v) => set(k, v)}
                />
              ))}
            </SimpleGrid>
            {errors.times && (
              <Text size="sm" c="red" role="alert">
                {errors.times}
              </Text>
            )}
          </Stack>
        </Paper>

        <Paper p="md">
          <Stack gap="sm">
            <Title order={3} size="h4">
              {t.edit.equipment}
            </Title>
            {errors.gig && (
              <Text size="sm" c="red" role="alert">
                {errors.gig}
              </Text>
            )}
            <LinesEditor
              lines={form.lines}
              onChange={(lines) => set('lines', lines)}
              gig={model ? draft : undefined}
              model={model}
              errors={errors.lines}
            />
          </Stack>
        </Paper>

        <Group justify="flex-end" gap="sm">
          <Button variant="default" size="md" onClick={() => void navigate(cancelTo)}>
            {t.edit.cancel}
          </Button>
          <Button type="submit" size="md" loading={saving}>
            {t.edit.save}
          </Button>
        </Group>
      </Stack>

      <Modal
        opened={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title={t.edit.leave.title}
      >
        <Stack>
          <Text size="sm">{t.edit.leave.body}</Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" size="md" onClick={() => blocker.reset?.()}>
              {t.edit.leave.stay}
            </Button>
            <Button color="red" size="md" onClick={() => blocker.proceed?.()}>
              {t.edit.leave.leave}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </form>
  )
}
