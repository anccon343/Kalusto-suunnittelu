/** Käyttäjät: the allowlist of Google accounts. */
import { Badge, Button, Card, Group, Modal, Stack, Text, Title } from '@mantine/core'
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useAppData } from '../../app/appData'
import type { AllowedUser, Stored } from '../../core/types'
import { removeAllowedUser } from '../../data/writes'
import { fi } from '../../fi'
import { notifyError, notifySaved } from '../../ui/errors'
import { t } from './texts'
import { UserModal } from './UserModal'
import { sortUsers } from './users'

const tu = t.users

type Editing = { kind: 'create' } | { kind: 'edit'; user: Stored<AllowedUser> } | null

export function UsersTab() {
  const app = useAppData()
  const [editing, setEditing] = useState<Editing>(null)
  const [removing, setRemoving] = useState<Stored<AllowedUser> | null>(null)
  const users = sortUsers(app.data.users, app.author)

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <Title order={3}>{tu.heading}</Title>
        <Button
          size="md"
          leftSection={<IconPlus size={18} aria-hidden />}
          onClick={() => setEditing({ kind: 'create' })}
        >
          {tu.add}
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        {tu.intro}
      </Text>

      <Stack gap="sm" component="ul" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {users.map((u) => (
          <li key={u.email}>
            <UserCard
              user={u}
              isMe={u.email === app.author}
              onEdit={() => setEditing({ kind: 'edit', user: u })}
              onRemove={() => setRemoving(u)}
            />
          </li>
        ))}
      </Stack>

      {editing && (
        <UserModal
          {...(editing.kind === 'edit' ? { user: editing.user } : {})}
          onClose={() => setEditing(null)}
        />
      )}
      {removing && <RemoveUserModal user={removing} onClose={() => setRemoving(null)} />}
    </Stack>
  )
}

function UserCard({
  user: u,
  isMe,
  onEdit,
  onRemove,
}: {
  user: AllowedUser
  isMe: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <Card withBorder padding="md">
      <Group justify="space-between" align="center" gap="sm">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: '1 1 12rem' }}>
          <Badge size="xl" variant="light" radius="sm" style={{ flexShrink: 0 }}>
            {u.initials}
          </Badge>
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Group gap="xs" wrap="wrap">
              <Text fw={600} component="h4" m={0}>
                {u.name}
              </Text>
              {isMe && (
                <Badge variant="outline" size="sm">
                  {tu.you}
                </Badge>
              )}
            </Group>
            <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
              {u.email}
            </Text>
          </Stack>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Button
            variant="default"
            size="md"
            leftSection={<IconPencil size={18} aria-hidden />}
            aria-label={tu.edit(u.name)}
            onClick={onEdit}
          >
            {fi.edit}
          </Button>
          {!isMe && (
            <Button
              variant="light"
              color="red"
              size="md"
              leftSection={<IconTrash size={18} aria-hidden />}
              aria-label={tu.remove(u.name)}
              onClick={onRemove}
            >
              {fi.delete}
            </Button>
          )}
        </Group>
      </Group>
    </Card>
  )
}

function RemoveUserModal({ user, onClose }: { user: AllowedUser; onClose: () => void }) {
  const app = useAppData()
  const [busy, setBusy] = useState(false)
  const remove = async () => {
    setBusy(true)
    try {
      await removeAllowedUser(app.db, user.email, app.author)
      notifySaved(tu.removed)
      onClose()
    } catch (e) {
      notifyError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal opened onClose={onClose} title={tu.removeTitle}>
      <Stack>
        <Text>{tu.removeBody(user.name, user.email)}</Text>
        <Group justify="flex-end">
          <Button variant="default" size="md" onClick={onClose} disabled={busy} data-autofocus>
            {fi.cancel}
          </Button>
          <Button color="red" size="md" loading={busy} onClick={() => void remove()}>
            {tu.removeConfirm}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
