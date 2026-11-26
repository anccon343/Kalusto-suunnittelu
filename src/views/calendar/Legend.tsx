/** Explains the event styles in words, so colour is never the only signal. */
import { Group, Text } from '@mantine/core'
import classes from './calendar.module.css'
import { ConflictMarker } from './EventContent'
import { t } from './texts'

const STATUSES = ['alustava', 'vahvistettu', 'valmis'] as const

export function Legend({ showCancelled }: { showCancelled: boolean }) {
  const statuses = showCancelled ? [...STATUSES, 'peruttu' as const] : STATUSES
  return (
    <Group
      gap="xs"
      style={{ columnGap: 'var(--mantine-spacing-md)' }}
      wrap="wrap"
      role="group"
      aria-label={t.legend.label}
    >
      <Text size="sm" c="dimmed" aria-hidden="true">
        {t.legend.label}:
      </Text>
      {statuses.map((s) => (
        <Group key={s} gap={6} wrap="nowrap">
          <span className={classes.swatch} data-status={s} aria-hidden="true" />
          <Text size="sm">{t.legend[s]}</Text>
        </Group>
      ))}
      <Group gap={6} wrap="nowrap">
        <ConflictMarker level="red" long={false} />
        <Text size="sm">{t.legend.red}</Text>
      </Group>
      <Group gap={6} wrap="nowrap">
        <ConflictMarker level="yellow" long={false} />
        <Text size="sm">{t.legend.yellow}</Text>
      </Group>
    </Group>
  )
}
