/** Kohteet: the list of locations, quick-start presets and the edit modal. */
import { Badge, Button, Card, Group, Stack, Switch, Text, Title } from '@mantine/core'
import { IconBuilding, IconPencil, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { useAppData } from '../../app/appData'
import type { Location, Stored } from '../../core/types'
import { createLocation } from '../../data/writes'
import { fi } from '../../fi'
import { notifyError, notifySaved } from '../../ui/errors'
import { CLARION_PRESET, hasLocationNamed, OWN_STUDIO_PRESET, sortLocations } from './locationForm'
import { LocationModal } from './LocationModal'
import { t } from './texts'

const tl = t.locations

type Editing = { kind: 'create' } | { kind: 'edit'; location: Stored<Location> } | null

export function LocationsTab() {
  const app = useAppData()
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<Editing>(null)
  const all = app.data.locations
  const visible = sortLocations(all.filter((l) => showArchived || !l.archived))
  const archivedCount = all.filter((l) => l.archived).length

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <Title order={3}>{tl.heading}</Title>
        <Button
          leftSection={<IconPlus size={18} aria-hidden />}
          size="md"
          onClick={() => setEditing({ kind: 'create' })}
        >
          {tl.add}
        </Button>
      </Group>

      <StarterCard />

      {archivedCount > 0 && (
        <Switch
          label={`${tl.showArchived} (${archivedCount})`}
          size="md"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.currentTarget.checked)}
        />
      )}

      {visible.length === 0 ? (
        <Text c="dimmed">{archivedCount > 0 ? tl.emptyArchived : tl.empty}</Text>
      ) : (
        <Stack gap="sm" component="ul" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {visible.map((l) => (
            <li key={l.id}>
              <LocationCard location={l} onEdit={() => setEditing({ kind: 'edit', location: l })} />
            </li>
          ))}
        </Stack>
      )}

      {editing && (
        <LocationModal
          {...(editing.kind === 'edit' ? { location: editing.location } : {})}
          onClose={() => setEditing(null)}
        />
      )}
    </Stack>
  )
}

function LocationCard({ location: l, onEdit }: { location: Location; onEdit: () => void }) {
  return (
    <Card withBorder padding="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Group gap="xs" wrap="wrap">
            <Text fw={600} component="h4" m={0} style={{ overflowWrap: 'anywhere' }}>
              {l.name}
            </Text>
            {l.isOwnStudio && <Badge variant="light">{tl.ownStudio}</Badge>}
            {l.archived && (
              <Badge variant="outline" color="gray">
                {tl.archived}
              </Badge>
            )}
          </Group>
          {l.address && (
            <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
              {l.address}
            </Text>
          )}
          <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
            {l.rooms.length === 0
              ? tl.noRooms
              : `${tl.rooms(l.rooms.length)}: ${l.rooms.join(', ')}`}
          </Text>
        </Stack>
        <Button
          variant="default"
          size="md"
          leftSection={<IconPencil size={18} aria-hidden />}
          aria-label={tl.edit(l.name)}
          onClick={onEdit}
          style={{ flexShrink: 0 }}
        >
          {fi.edit}
        </Button>
      </Group>
    </Card>
  )
}

/** One-click starter locations (plan 2.4): own studio and Clarion Hotel Helsinki. */
function StarterCard() {
  const app = useAppData()
  const [busy, setBusy] = useState<'studio' | 'clarion' | null>(null)
  const needsStudio = app.ownStudio === undefined
  const needsClarion = !hasLocationNamed(app.data.locations, CLARION_PRESET.name)
  if (!needsStudio && !needsClarion) return null

  const add = async (which: 'studio' | 'clarion') => {
    setBusy(which)
    try {
      if (which === 'studio') {
        await createLocation(app.db, OWN_STUDIO_PRESET, app.author)
        notifySaved(tl.starter.studioCreated)
      } else {
        await createLocation(app.db, CLARION_PRESET, app.author)
        notifySaved(tl.starter.clarionCreated)
      }
    } catch (e) {
      notifyError(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card
      withBorder
      padding="lg"
      {...(needsStudio ? { bg: 'var(--mantine-color-teal-light)' } : {})}
    >
      <Stack gap="sm">
        <Group gap="xs" wrap="nowrap">
          <IconBuilding size={22} aria-hidden />
          <Title order={4}>{needsStudio ? tl.starter.title : tl.starter.titleClarion}</Title>
        </Group>
        <Text size="sm">{needsStudio ? tl.starter.body : tl.starter.bodyClarion}</Text>
        <Group gap="sm" wrap="wrap">
          {needsStudio && (
            <Button
              size="md"
              loading={busy === 'studio'}
              disabled={busy !== null}
              onClick={() => void add('studio')}
            >
              {tl.starter.createStudio}
            </Button>
          )}
          {needsClarion && (
            <Button
              size="md"
              variant={needsStudio ? 'default' : 'light'}
              loading={busy === 'clarion'}
              disabled={busy !== null}
              onClick={() => void add('clarion')}
            >
              {tl.starter.addClarion}
            </Button>
          )}
        </Group>
      </Stack>
    </Card>
  )
}
