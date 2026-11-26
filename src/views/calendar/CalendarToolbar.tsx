/**
 * Our own toolbar for FullCalendar (Mantine buttons, Finnish texts, touch-sized),
 * driven through FullCalendar's controller. On phones the view switch takes its own
 * full-width row.
 */
import { ActionIcon, Button, Group, SegmentedControl, Stack, Text } from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { t } from './texts'
import { MODES, type CalendarMode } from './viewState'

export interface CalendarToolbarProps {
  title: string
  mode: CalendarMode
  wide: boolean
  onModeChange: (mode: CalendarMode) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

const MODE_LABEL: Record<CalendarMode, string> = {
  kuukausi: t.views.month,
  viikko: t.views.week,
  lista: t.views.list,
}

export function CalendarToolbar(p: CalendarToolbarProps) {
  const nav = (
    <Group gap="xs" wrap="nowrap" miw={0}>
      <Group gap={4} wrap="nowrap" style={{ flex: 'none' }}>
        <ActionIcon variant="default" size={44} aria-label={t.prev} onClick={p.onPrev}>
          <IconChevronLeft size={20} />
        </ActionIcon>
        <Button variant="default" h={44} onClick={p.onToday}>
          {t.today}
        </Button>
        <ActionIcon variant="default" size={44} aria-label={t.next} onClick={p.onNext}>
          <IconChevronRight size={20} />
        </ActionIcon>
      </Group>
      <Text fw={600} aria-live="polite">
        {p.title}
      </Text>
    </Group>
  )
  const switcher = (
    <SegmentedControl
      aria-label={t.viewLabel}
      value={p.mode}
      onChange={(v) => {
        const m = MODES.find((x) => x === v)
        if (m) p.onModeChange(m)
      }}
      data={MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
      fullWidth={!p.wide}
      size="md"
    />
  )
  return p.wide ? (
    <Group justify="space-between" gap="xs">
      {nav}
      {switcher}
    </Group>
  ) : (
    <Stack gap="xs">
      {nav}
      {switcher}
    </Stack>
  )
}
