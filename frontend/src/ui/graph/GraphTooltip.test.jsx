import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GraphTooltip } from './ChartCanvas.jsx'

/**
 * The default chart plots one curve, but the tooltip still has to answer
 * "which trips is that made of" — the per-trip breakdown moved into the
 * hover, so it is the only place that answer exists on the tracker.
 */
const stays = [
  { id: 'a', name: 'Barcelona' },
  { id: 'b', name: 'Lisbon' },
  { id: 'c', name: 'Vienna' },
]
const colors = { a: '#6C8FEC', b: '#71A63F', c: '#D86A95' }
const point = {
  date: '2026-07-21', total: 41, remaining: 49,
  s_a: 19, s_b: 22, s_c: 0,
}

describe('GraphTooltip', () => {
  it('shows the date, the total and the days left', () => {
    render(<GraphTooltip active payload={[{ payload: point }]} stays={stays} colors={colors} />)
    expect(screen.getByText('41')).toBeInTheDocument()
    expect(screen.getByText(/of 90 days used/)).toBeInTheDocument()
    expect(screen.getByText('49')).toBeInTheDocument()
  })

  it('breaks the total down by trip, largest first, skipping trips at zero', () => {
    render(<GraphTooltip active payload={[{ payload: point }]} stays={stays} colors={colors} />)
    expect(screen.getByText('Lisbon')).toBeInTheDocument()
    expect(screen.getByText('Barcelona')).toBeInTheDocument()
    expect(screen.queryByText('Vienna')).not.toBeInTheDocument()

    const names = screen.getAllByText(/Barcelona|Lisbon/).map((n) => n.textContent)
    expect(names).toEqual(['Lisbon', 'Barcelona'])
  })

  it('renders nothing when the pointer is not on the plot', () => {
    const { container } = render(
      <GraphTooltip active={false} payload={[{ payload: point }]} stays={stays} colors={colors} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
