/** Add a user to the allowlist or edit a user's name and initials. */
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import { useAppData } from '../../app/appData'
import type { AllowedUser, Stored } from '../../core/types'
import { isPlausibleEmail, normalizeEmail } from '../../data/email'
import { addAllowedUser, saveAllowedUser } from '../../data/writes'
import { fi } from '../../fi'
import { notifyError, notifySaved } from '../../ui/errors'
import { t } from './texts'
import { INITIALS_MAX, suggestInitials, USER_NAME_MAX } from './users'

const tu = t.users

interface Values {
  email: string
  name: string
  initials: string
}

export function UserModal({
  user,
  onClose,
}: {
  /** The user to edit, as when opened; undefined adds a new user. */
  user?: Stored<AllowedUser> | undefined
  onClose: () => void
}) {
  const app = useAppData()
  const [baseline] = useState(user)
  const [busy, setBusy] = useState(false)
  // Initials follow the name until the user edits them by hand.
  const [initialsTouched, setInitialsTouched] = useState(baseline !== undefined)
  const form = useForm<Values>({
    initialValues: {
      email: baseline?.email ?? '',
      name: baseline?.name ?? '',
      initials: baseline?.initials ?? '',
    },
    validate: {
      email: (v) => {
        if (baseline) return null
        if (!isPlausibleEmail(v)) return tu.emailInvalid
        return app.usersByEmail.has(normalizeEmail(v)) ? tu.emailExists : null
      },
      name: (v) =>
        v.trim() === '' ? tu.nameRequired : v.trim().length > USER_NAME_MAX ? tu.nameTooLong : null,
      initials: (v) =>
        v.trim() === ''
          ? tu.initialsRequired
          : v.trim().length > INITIALS_MAX
            ? tu.initialsTooLong
            : null,
    },
  })

  const submit = async (v: Values) => {
    setBusy(true)
    try {
      if (baseline) {
        const edited = {
          ...baseline,
          name: v.name.trim(),
          initials: v.initials.trim().toUpperCase(),
        }
        await saveAllowedUser(app.db, baseline, edited, app.author)
        notifySaved()
      } else {
        await addAllowedUser(
          app.db,
          { email: v.email, name: v.name.trim(), initials: v.initials.trim() },
          app.author,
        )
        notifySaved(tu.added)
      }
      onClose()
    } catch (e) {
      notifyError(e)
    } finally {
      setBusy(false)
    }
  }

  const nameProps = form.getInputProps('name')
  const initialsProps = form.getInputProps('initials')

  return (
    <Modal opened onClose={onClose} title={baseline ? tu.editTitle : tu.createTitle}>
      <form onSubmit={form.onSubmit((v) => void submit(v))} noValidate>
        <Stack>
          {baseline ? (
            <Stack gap={2}>
              <Text size="sm" fw={500}>
                {tu.email}
              </Text>
              <Text style={{ overflowWrap: 'anywhere' }}>{baseline.email}</Text>
            </Stack>
          ) : (
            <TextInput
              label={tu.email}
              description={tu.emailHint}
              type="email"
              autoComplete="off"
              inputMode="email"
              required
              data-autofocus
              {...form.getInputProps('email')}
            />
          )}
          <TextInput
            label={tu.name}
            required
            maxLength={USER_NAME_MAX}
            {...nameProps}
            onChange={(e) => {
              const name = e.currentTarget.value
              form.setFieldValue('name', name)
              if (!initialsTouched) form.setFieldValue('initials', suggestInitials(name))
            }}
          />
          <TextInput
            label={tu.initials}
            description={tu.initialsHint}
            required
            maxLength={INITIALS_MAX}
            {...initialsProps}
            onChange={(e) => {
              setInitialsTouched(true)
              form.setFieldValue('initials', e.currentTarget.value.toUpperCase())
            }}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" size="md" onClick={onClose} disabled={busy}>
              {fi.cancel}
            </Button>
            <Button type="submit" size="md" loading={busy}>
              {baseline ? fi.save : tu.add}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
