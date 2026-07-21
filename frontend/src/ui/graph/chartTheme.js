/**
 * One source of truth for every value the chart draws with.
 *
 * These are literals rather than CSS variables on purpose: the chart SVG is
 * serialised and rasterised for the PDF report, and external CSS does not
 * apply inside a serialised SVG. Every colour must arrive as an attribute.
 */
export const CHART = {
  surface: '#0F1216',
  grid: '#1A1F29',
  axis: '#232A36',
  tick: '#5B6474',
  tickStrong: '#8B94A5',
  limit: '#FF6B6B',
  /* The rolling total is the only thing the accent is spent on, so the eye
     goes to the curve before it goes to any rule or label around it. */
  curve: '#7C9CFF',
  guide: '#2E3644',
  today: '#5B6474',
  cluster: '#3B4557',
  onColor: '#0A0C10',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
}

/**
 * Gradient id for a band colour — declared and referenced inside the same SVG,
 * which is what lets the PDF exporter serialise the chart and keep its fills.
 * Keyed by colour so the cycled palette shares definitions.
 */
export const fillId = (color) => `sg-fill-${String(color || '').replace(/[^a-zA-Z0-9]/g, '')}`

/**
 * A Y scale that always shows the whole allowance, in steps you can count.
 *
 * Recharts' automatic ticks follow the data, so the axis re-steps every time a
 * trip is added. Pinning the top to a round number at or above 100 keeps the
 * 90-day rule sitting in the same place on the plot from one visit to the next.
 */
export function usageScale(maxValue) {
  const top = Math.max(100, Math.ceil((maxValue || 0) / 25) * 25)
  const step = top <= 100 ? 25 : top <= 250 ? 50 : 100
  const ticks = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  return { domain: [0, top], ticks }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MS_PER_DAY = 86400000

/**
 * Ticks on calendar boundaries rather than wherever the data happens to fall.
 *
 * Recharts' automatic ticks land on data points, which on a multi-year history
 * produces a row like "11 Mar · 25 Feb · 08 Feb" — three dates that are not
 * evenly spaced and never say which year they belong to. These step whole
 * months instead, and carry the year as soon as the span needs it.
 *
 * @param {[number, number]} domain epoch-day bounds
 * @param {number} target roughly how many labels should fit
 */
export function timeTicks(domain, target = 6) {
  const [from, to] = domain
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null
  const spanDays = to - from

  // Short spans read better as plain dates than as month boundaries.
  if (spanDays <= 80) return null

  // Count the real boundaries per candidate rather than estimating from the
  // span: the estimate rounds the wrong way at exactly the sizes that matter.
  const boundaries = (step) => {
    const d = new Date(from * MS_PER_DAY)
    let year = d.getUTCFullYear()
    let month = Math.ceil(d.getUTCMonth() / step) * step
    year += Math.floor(month / 12)
    month %= 12
    const out = []
    while (out.length < 60) {
      const t = Math.floor(Date.UTC(year, month, 1, 12) / MS_PER_DAY)
      if (t > to) break
      if (t >= from) out.push(t)
      month += step
      year += Math.floor(month / 12)
      month %= 12
    }
    return out
  }

  let step = 60
  let ticks = []
  for (const candidate of [1, 2, 3, 6, 12, 24, 60]) {
    const got = boundaries(candidate)
    if (got.length <= target) { step = candidate; ticks = got; break }
  }
  if (!ticks.length) ticks = boundaries(step)

  const showYear = step >= 3 || spanDays > 300
  const format = (t) => {
    const dd = new Date(t * MS_PER_DAY)
    const y = dd.getUTCFullYear()
    const m = MONTHS[dd.getUTCMonth()]
    if (step >= 12) return String(y)
    return showYear ? `${m} ’${String(y).slice(2)}` : m
  }

  return ticks.length >= 2 ? { ticks, format } : null
}
