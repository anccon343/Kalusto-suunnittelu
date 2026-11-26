/**
 * Laitekortti (plan section 3): facts, Kunto and Tilanne, where it is now and next,
 * the gigs that use it, "Siirretty tänne", and Muokkaa / Monista / Arkistoi.
 */
import { Alert, Anchor, Button, Group, Modal, Stack, Text, Title } from '@mantine/core'
import { IconChevronLeft } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAppData } from '../../app/appData'
import { CONDITION_SRC } from '../../core/availability'
import type { Item, Stored } from '../../core/types'
import { saveItem } from '../../data/writes'
import { notifyError, notifySaved } from '../../ui/errors'
import { ArchivedBadge, ConditionBadge, SituationBadge } from './Badges'
import { duplicateValues } from './itemForm'
import { ItemFormModal, type FormRequest } from './ItemFormModal'
import { GigHistory, ItemConflicts, ItemFacts, NowAndNext } from './ItemSections'
import { LocationOverride } from './LocationOverride'
import { situationOf } from './status'
import { fi } from '../../fi'
import { t } from './texts'

function BackLink() {
  return (
    <Anchor component={Link} to="/kalusto" size="sm">
      <Group gap={2} wrap="nowrap">
        <IconChevronLeft size={16} aria-hidden />
        {t.item.back}
      </Group>
    </Anchor>
  )
}

export default function ItemPage() {
  const app = useAppData()
  const { itemId = '' } = useParams()
  const item = app.itemsById.get(itemId)
  if (!item) {
    return (
      <Stack gap="sm">
        <Title order={2}>{t.item.notFoundTitle}</Title>
        <Text>{t.item.notFoundText}</Text>
        <Anchor component={Link} to="/kalusto">
          {t.item.notFoundLink}
        </Anchor>
      </Stack>
    )
  }
  // Keyed by id so state (open dialogs) does not leak from one item to another.
  return <ItemCard key={item.id} item={item} />
}

function ItemCard({ item }: { item: Stored<Item> }) {
  const app = useAppData()
  const navigate = useNavigate()
  const [request, setRequest] = useState<FormRequest | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [busy, setBusy] = useState(false)
  const situation = situationOf(item, app.availability, app.now)

  const upcomingGigs = new Set(
    app.availability
      .demandsFor(item.id)
      .filter((d) => d.src !== CONDITION_SRC && d.end > app.now)
      .map((d) => d.src),
  ).size

  async function setArchived(archived: boolean) {
    setBusy(true)
    try {
      await saveItem(app.db, item, { ...item, archived }, app.author)
      notifySaved(archived ? t.item.archivedDone : t.item.restored)
      setConfirmArchive(false)
    } catch (e) {
      notifyError(e)
    } finally {
      setBusy(false)
    }
  }

  const duplicate = () =>
    setRequest({
      kind: 'create',
      title: t.form.duplicateTitle(item.tag),
      values: duplicateValues(
        item,
        app.data.items.map((i) => i.tag),
      ),
    })

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <BackLink />
        <Title order={2} style={{ overflowWrap: 'anywhere' }}>
          {item.tag} {item.name}
        </Title>
        <Group gap="xs">
          <ConditionBadge condition={item.condition} />
          <SituationBadge situation={situation} />
          {item.archived && <ArchivedBadge />}
          {situation.free !== undefined && situation.total !== undefined && (
            <Text size="sm">{t.freeOf(situation.free, situation.total)}</Text>
          )}
        </Group>
      </Stack>

      <Group gap="xs">
        <Button mih={44} onClick={() => setRequest({ kind: 'edit', baseline: item })}>
          {t.item.edit}
        </Button>
        <Button mih={44} variant="default" onClick={duplicate}>
          {t.item.duplicate}
        </Button>
        {item.archived ? (
          <Button mih={44} variant="default" loading={busy} onClick={() => void setArchived(false)}>
            {t.item.restore}
          </Button>
        ) : (
          <Button mih={44} variant="default" onClick={() => setConfirmArchive(true)}>
            {t.item.archive}
          </Button>
        )}
      </Group>

      {item.archived && <Alert color="gray">{t.item.archivedNote}</Alert>}

      <NowAndNext app={app} item={item} />
      <LocationOverride item={item} />
      <ItemConflicts app={app} item={item} />
      <ItemFacts app={app} item={item} />
      <GigHistory app={app} item={item} />

      <ItemFormModal
        request={request}
        onClose={() => setRequest(null)}
        onCreated={(id) => void navigate(`/kalusto/${id}`)}
      />

      <Modal
        opened={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title={t.item.archiveTitle}
        closeButtonProps={{ 'aria-label': fi.close }}
      >
        <Stack gap="sm">
          <Text>{t.item.archiveText(`${item.tag} ${item.name}`)}</Text>
          {upcomingGigs > 0 && <Text fw={600}>{t.item.archiveUpcoming(upcomingGigs)}</Text>}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" mih={44} onClick={() => setConfirmArchive(false)}>
              {t.form.cancel}
            </Button>
            <Button color="red" mih={44} loading={busy} onClick={() => void setArchived(true)}>
              {t.item.archiveConfirm}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
