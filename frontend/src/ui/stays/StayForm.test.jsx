import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StayForm from './StayForm.jsx'
import { db } from '../../db/db.js'
import { createStay, listStays } from '../../db/stays.js'

beforeEach(async () => {
  await db.stays.clear()
})

describe('StayForm in edit mode', () => {
  it('pre-fills the name and BOTH dates from the existing stay', async () => {
    const stay = await createStay({
      name: 'Barcelona', country: 'Spain',
      startDate: '2026-07-23', endDate: '2026-07-30',
    })

    render(<StayForm open stay={stay} onClose={() => {}} />)

    expect(screen.getByLabelText(/name/i)).toHaveValue('Barcelona')
    // The bug being killed: dates must be shown, formatted, never empty.
    expect(screen.getByTestId('start-date-value')).toHaveTextContent('23 Jul 2026')
    expect(screen.getByTestId('end-date-value')).toHaveTextContent('30 Jul 2026')
    expect(screen.getByTestId('start-date-value')).not.toHaveTextContent('—')
  })

  it('shows the inclusive duration', async () => {
    const stay = await createStay({
      name: 'Barcelona', startDate: '2026-07-23', endDate: '2026-07-30',
    })
    render(<StayForm open stay={stay} onClose={() => {}} />)
    expect(screen.getByTestId('duration')).toHaveTextContent('8 days')
  })

  it('saves an edited name without touching the dates', async () => {
    const stay = await createStay({
      name: 'Barcelona', startDate: '2026-07-23', endDate: '2026-07-30',
    })
    const onClose = vi.fn()
    render(<StayForm open stay={stay} onClose={onClose} />)

    const name = screen.getByLabelText(/name/i)
    await userEvent.clear(name)
    await userEvent.type(name, 'Girona')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    const rows = await listStays()
    expect(rows[0].name).toBe('Girona')
    expect(rows[0].startDate).toBe('2026-07-23')
    expect(rows[0].endDate).toBe('2026-07-30')
    expect(onClose).toHaveBeenCalled()
  })
})

describe('StayForm in create mode', () => {
  it('shows an inline error when the name is blank', async () => {
    render(<StayForm open stay={null} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/give this stay a name/i)).toBeInTheDocument()
    expect(await listStays()).toHaveLength(0)
  })
})
