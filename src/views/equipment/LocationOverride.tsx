/**
 * "Siirretty tänne" (plan 4.5): a manual note of where the item really is, shown next
 * to the computed location until someone removes it. Recording a fact is never blocked.
 */
import { Button, Group, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import { userName, useAppData } from '../../app/appData'
import { formatDateTime } from '../../core/time'
import type { Item, Stored } from '../../core/types'
import { saveItem } from '../../data/writes'
import { notifyError, notifySaved } from '../../ui/errors'
import { Section } from './ItemSections'
import { t } from './texts'

const MAX_TEXT = 200

export function LocationOverride({ item }: { item: Stored<Item> }) {
  const app = useAppData()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const override = item.locationOverride

  async function write(edited: Stored<Item>, message: string) {
    setBusy(true)
    try {
      await saveItem(app.db, item, edited, app.author)
      notifySaved(message)
      setText('')
    } catch (e) {
      notifyError(e)
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    write(
      { ...item, locationOverride: { text: text.trim(), at: Date.now(), by: app.author } },
      t.item.overrideSaved,
    )

  const remove = () => {
    const { locationOverride: _removed, ...rest } = item
    return write(rest, t.item.overrideRemoved)
  }

  return (
    <Section title={t.item.override}>
      {override ? (
        <Group justify="space-between" gap="xs" align="flex-start">
          <div>
            <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
              {override.text}
            </Text>
            <Text size="sm" c="dimmed">
              {t.item.overrideBy(formatDateTime(override.at), userName(app, override.by))}
            </Text>
          </div>
          <Button variant="default" mih={44} loading={busy} onClick={() => void remove()}>
            {t.item.overrideRemove}
          </Button>
        </Group>
      ) : (
        <Text size="sm" c="dimmed">
          {t.item.overrideHelp}
        </Text>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) void save()
        }}
      >
        <Group gap="xs" align="flex-end" wrap="wrap">
          <TextInput
            label={t.item.overrideLabel}
            placeholder={t.item.overridePlaceholder}
            value={text}
            maxLength={MAX_TEXT}
            onChange={(e) => setText(e.currentTarget.value)}
            style={{ flex: '1 1 14rem' }}
          />
          <Button type="submit" mih={44} disabled={!text.trim()} loading={busy}>
            {t.item.overrideSave}
          </Button>
        </Group>
      </form>
    </Section>
  )
}
