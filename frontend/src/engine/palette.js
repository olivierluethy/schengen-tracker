/**
 * Per-stay colours for the graph bands, ribbon segments and list rows.
 *
 * Indexed by creation order (which never changes) so adding a new trip cannot
 * recolour existing ones. Hues are chosen for legibility on the near-black
 * surface and to stay distinguishable from the status colours (ok/warn/over).
 */
export const TRIP_COLORS = [
  '#6EA8FE', // blue
  '#5EE9B5', // mint
  '#F0A868', // amber
  '#C9A0FF', // violet
  '#F79FC4', // pink
  '#7ED8E8', // cyan
  '#B8D96B', // lime
  '#FF9B85', // coral
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
