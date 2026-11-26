/**
 * Date and time input in Helsinki time, using the browser's native pickers (best on
 * phones). The value is an instant (UTC ms); conversion and daylight-saving rules
 * come from `src/core/time.ts`.
 */
import { Group, Input, TextInput } from '@mantine/core'
import { useId, useState } from 'react'
import type { Ms } from '../core/time'
import { combine, splitInstant } from './dateTime'

export interface DateTimeFieldProps {
  label: string
  value: Ms | undefined
  onChange: (value: Ms | undefined) => void
  required?: boolean
  error?: string | undefined
  description?: string
}

export function DateTimeField({
  label,
  value,
  onChange,
  required,
  error,
  description,
}: DateTimeFieldProps) {
  const [parts, setParts] = useState(() => splitInstant(value))
  const [ownError, setOwnError] = useState<string | undefined>()
  const [seenValue, setSeenValue] = useState(value)
  const id = useId()

  // Follow external changes (e.g. the form being reset) while the user types: adjust
  // state during render when the prop changes (React's recommended pattern).
  if (value !== seenValue) {
    setSeenValue(value)
    const typed = combine(parts.date, parts.time)
    if (!(typed.kind === 'ok' && typed.ms === value)) {
      setParts(splitInstant(value))
      setOwnError(undefined)
    }
  }

  function update(next: { date: string; time: string }) {
    setParts(next)
    const r = combine(next.date, next.time)
    if (r.kind === 'empty') {
      setOwnError(undefined)
      setSeenValue(undefined)
      onChange(undefined)
    } else if (r.kind === 'ok') {
      setOwnError(undefined)
      setSeenValue(r.ms)
      onChange(r.ms)
    } else {
      setOwnError(r.message)
    }
  }

  return (
    <Input.Wrapper
      label={label}
      required={required ?? false}
      error={error ?? ownError}
      description={description}
      id={id}
    >
      <Group gap="xs" wrap="nowrap" mt={4}>
        <TextInput
          id={id}
          type="date"
          aria-label={`${label}, päivä`}
          value={parts.date}
          onChange={(e) => update({ ...parts, date: e.currentTarget.value })}
          style={{ flex: 3 }}
        />
        <TextInput
          type="time"
          aria-label={`${label}, kellonaika`}
          value={parts.time}
          onChange={(e) => update({ ...parts, time: e.currentTarget.value })}
          style={{ flex: 2 }}
        />
      </Group>
    </Input.Wrapper>
  )
}
