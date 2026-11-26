import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderView } from '../test/render'
import { Shell } from './Shell'

describe('Shell', () => {
  it('shows the app name, navigation and the new gig button', async () => {
    renderView(<Shell />)
    expect(await screen.findByRole('heading', { name: 'Roudari' })).toBeInTheDocument()
    expect(screen.getAllByText('Kalusto').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Uusi keikka/ })).toBeInTheDocument()
  })
})
