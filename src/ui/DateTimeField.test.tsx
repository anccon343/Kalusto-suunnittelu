import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { localToInstantOrThrow } from '../core/time'
import { DateTimeField } from './DateTimeField'

const renderField = (
  value: number | undefined,
  onChange = vi.fn<(value: number | undefined) => void>(),
) => {
  render(
    <MantineProvider>
      <DateTimeField label="Kalusto lähtee" value={value} onChange={onChange} />
    </MantineProvider>,
  )
  return onChange
}

describe('DateTimeField', () => {
  it('shows a Helsinki time and reports the instant on change', () => {
    const t = localToInstantOrThrow({ year: 2026, month: 12, day: 1, hour: 9, minute: 0 })
    const onChange = renderField(t)
    const time = screen.getByLabelText('Kalusto lähtee, kellonaika')
    expect(time).toHaveValue('09:00')
    fireEvent.change(time, { target: { value: '10:30' } })
    expect(onChange).toHaveBeenLastCalledWith(
      localToInstantOrThrow({ year: 2026, month: 12, day: 1, hour: 10, minute: 30 }),
    )
  })

  it('explains a time skipped by the change to summer time', () => {
    const onChange = renderField(undefined)
    fireEvent.change(screen.getByLabelText('Kalusto lähtee, päivä'), {
      target: { value: '2027-03-28' },
    })
    fireEvent.change(screen.getByLabelText('Kalusto lähtee, kellonaika'), {
      target: { value: '03:30' },
    })
    expect(screen.getByText(/kesäaikaan/)).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
