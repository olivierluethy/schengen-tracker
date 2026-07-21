/**
 * Per-stay colours for the graph bands, ribbon segments and list rows.
 *
 * Indexed by creation order (which never changes) so adding a new trip cannot
 * recolour existing ones. Hues are stepped evenly around OKLCH at L 0.665 /
 * C 0.145 and ordered so that neighbouring slots are far apart in hue. The set
 * is checked against the chart surface (#0F1216) for the lightness band, the
 * chroma floor, colour-vision-deficient separation of adjacent slots, and
 * contrast — every trip also carries a written label on the ribbon, in the
 * list and in the tooltip, so colour is never the only way to tell trips apart.
 */
export const TRIP_COLORS = [
  '#6C8FEC', // periwinkle
  '#71A63F', // leaf
  '#D86A95', // rose
  '#00A4C9', // cyan
  '#B78D05', // ochre
  '#B177D3', // orchid
  '#02AC92', // teal
  '#DC7246', // ember
]

export function colorForStay(stay, allStays) {
  const ordered = (allStays || [])
    .filter((s) => s && !s.deleted)
    .slice()
    .sort((a, b) =>
      a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1,
    )
  const idx = ordered.findIndex((s) => s.id === stay.id)
  return TRIP_COLORS[(idx < 0 ? 0 : idx) % TRIP_COLORS.length]
}

/** Precompute a lookup so lists and charts do not re-sort per row. */
export function colorMap(allStays) {
  const map = {}
  for (const s of allStays || []) map[s.id] = colorForStay(s, allStays)
  return map
}
