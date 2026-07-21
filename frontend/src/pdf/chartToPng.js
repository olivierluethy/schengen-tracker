/**
 * Serialise a live SVG node to a PNG data URL, entirely offline.
 *
 * @react-pdf/renderer cannot consume a raw SVG string, and the spec forbids any
 * network round-trip, so the chart is rasterised locally: SVG → data URL →
 * <img> → <canvas> → PNG. Colours must be present as SVG attributes (they are:
 * the chart passes every fill and stroke as a prop) because external CSS does
 * not apply inside a serialised SVG.
 */
export function svgToPngDataUrl(svgEl, { scale = 2, background = '#0F1216' } = {}) {
  return new Promise((resolve, reject) => {
    if (!svgEl) return reject(new Error('No chart to export'))

    const rect = svgEl.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width || Number(svgEl.getAttribute('width')) || 600))
    const height = Math.max(1, Math.round(rect.height || Number(svgEl.getAttribute('height')) || 300))

    const clone = svgEl.cloneNode(true)
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(width))
    clone.setAttribute('height', String(height))

    const svgText = new XMLSerializer().serializeToString(clone)
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`

    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = width * scale
        canvas.height = height * scale
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = background
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error('Could not rasterise the chart'))
    img.src = url
  })
}
