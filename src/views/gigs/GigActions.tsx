/** Muokkaa, Vahvista, Peru keikka and Poista on the gig overview (plan 4.3, 4.5, rule 9). */
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { IconCheck, IconPencil, IconTrash, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAppData } from '../../app/appData'
import type { Gig, Stored } from '../../core/types'
import { deleteTentativeGig, saveGig } from '../../data/writes'
import { fi } from '../../fi'
import { notifyError, notifySaved } from '../../ui/errors'
import { confirmBlockers, type Blocking } from './draft'
import { withConfirmation } from './gigForm'
import { t } from './texts'

const tp = t.page

type Dialog = 'cancel' | 'delete' | null

export function GigActions({
  gig,
  onBlocked,
}: {
  gig: Stored<Gig>
  onBlocked: (blockers: Blocking[]) => void
}) {
  const app = useAppData()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)

  const out = gig.departedAt !== undefined && gig.returnedAt === undefined
  const canConfirm = gig.status === 'alustava'
  const canCancel = gig.status === 'alustava' || gig.status === 'vahvistettu'
  const canDelete = gig.status === 'alustava' && gig.departedAt === undefined

  async function run(action: () => Promise<unknown>, message: string): Promise<boolean> {
    setBusy(true)
    try {
      await action()
      notifySaved(message)
      return true
    } catch (e) {
      notifyError(e)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    const blockers = confirmBlockers(app, gig)
    onBlocked(blockers)
    if (blockers.length > 0) return
    const confirmed = withConfirmation(
      { ...gig, status: 'vahvistettu' },
      gig.status,
      app.now,
      app.author,
    )
    await run(() => saveGig(app.db, gig, confirmed, app.isOwnStudio, app.author), tp.confirmed)
  }

  async function cancel() {
    const ok = await run(
      () => saveGig(app.db, gig, { ...gig, status: 'peruttu' }, app.isOwnStudio, app.author),
      tp.cancelled,
    )
    if (ok) setDialog(null)
  }

  async function remove() {
    const ok = await run(() => deleteTentativeGig(app.db, gig.id), tp.deleted)
    if (ok) await navigate('/kalenteri')
  }

  return (
    <>
      <Group gap="xs" wrap="wrap" aria-label={tp.actions} role="group">
        <Button
          component={Link}
          to={`/keikat/${gig.id}/muokkaa`}
          variant="default"
          size="md"
          leftSection={<IconPencil size={18} aria-hidden />}
        >
          {tp.edit}
        </Button>
        {canConfirm && (
          <Button
            size="md"
            loading={busy}
            leftSection={<IconCheck size={18} aria-hidden />}
            onClick={() => void confirm()}
          >
            {tp.confirm}
          </Button>
        )}
        {canCancel && (
          <Button
            variant="default"
            size="md"
            leftSection={<IconX size={18} aria-hidden />}
            onClick={() => setDialog('cancel')}
          >
            {tp.cancel}
          </Button>
        )}
        {canDelete && (
          <Button
            variant="default"
            color="red"
            size="md"
            leftSection={<IconTrash size={18} aria-hidden />}
            onClick={() => setDialog('delete')}
          >
            {tp.delete}
          </Button>
        )}
      </Group>

      <Modal opened={dialog === 'cancel'} onClose={() => setDialog(null)} title={tp.cancelTitle}>
        <Stack>
          {out ? (
            <Alert color="red">{fi.errors.state['departed-not-returned']}</Alert>
          ) : (
            <Text size="sm">{tp.cancelBody}</Text>
          )}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" size="md" onClick={() => setDialog(null)}>
              {tp.keep}
            </Button>
            <Button
              color="red"
              size="md"
              loading={busy}
              disabled={out}
              onClick={() => void cancel()}
            >
              {tp.cancelConfirm}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={dialog === 'delete'} onClose={() => setDialog(null)} title={tp.deleteTitle}>
        <Stack>
          <Text size="sm">{tp.deleteBody}</Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" size="md" onClick={() => setDialog(null)}>
              {tp.keepIt}
            </Button>
            <Button color="red" size="md" loading={busy} onClick={() => void remove()}>
              {tp.deleteConfirm}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
