/** Conflict badges of one line and the rule-9 "blocked" alert. */
import { Alert, Badge, Group, List, Stack, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import type { Blocking, ConflictView } from './draft'
import { t } from './texts'

const COLOR = { red: 'red', yellow: 'orange' } as const

export function LineConflicts({ conflicts }: { conflicts: readonly ConflictView[] }) {
  if (conflicts.length === 0) return null
  return (
    <Stack gap={4}>
      {conflicts.map((c, i) => (
        <Group key={i} gap="xs" align="flex-start" wrap="nowrap">
          <Badge color={COLOR[c.severity]} style={{ flexShrink: 0 }}>
            {c.label}
          </Badge>
          <Text size="sm" c={COLOR[c.severity]} style={{ minWidth: 0 }}>
            {c.who}
            {c.span && (
              <Text span size="sm" c="dimmed" style={{ display: 'block' }}>
                {c.span}
              </Text>
            )}
          </Text>
        </Group>
      ))}
    </Stack>
  )
}

export function BlockedAlert({
  blockers,
  title = t.blocked.title,
}: {
  blockers: readonly Blocking[]
  title?: string
}) {
  if (blockers.length === 0) return null
  return (
    <Alert
      color="red"
      title={title}
      icon={<IconAlertTriangle size={18} aria-hidden />}
      role="alert"
    >
      <Stack gap="xs">
        <Text size="sm">{t.blocked.intro}</Text>
        <List size="sm" spacing={2}>
          {blockers.map((b) => (
            <List.Item key={b.key}>{b.text}</List.Item>
          ))}
        </List>
        <Text size="sm">{t.blocked.outro}</Text>
      </Stack>
    </Alert>
  )
}
