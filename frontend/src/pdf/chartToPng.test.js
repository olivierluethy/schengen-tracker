import { describe, it, expect } from 'vitest'
import { svgToPngDataUrl } from './chartToPng.js'

describe('svgToPngDataUrl', () => {
  it('rejects clearly when there is no chart', async () => {
    await expect(svgToPngDataUrl(null)).rejects.toThrow(/no chart/i)
  })
})
