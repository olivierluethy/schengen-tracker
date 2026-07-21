import { useEffect, useRef, useState } from 'react'

/**
 * Minimal windowing: render only the rows inside the scroll port.
 *
 * Heights are declared per item rather than measured, which is exact here
 * because every row in this list is one of a few known sizes. That keeps a
 * hundred stays scrolling at the same cost as five, with no layout thrash and
 * no dependency.
 */
export default function VirtualList({
  items, getHeight, renderItem, overscan = 6, className = '', focusKey = null,
}) {
  const ref = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(600)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const measure = () => setViewport(el.clientHeight || 600)
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])

  // Running offsets: one pass per render, cheap next to rendering the rows.
  const offsets = []
  let total = 0
  for (const item of items) {
    offsets.push(total)
    total += getHeight(item)
  }

  // Selecting a trip on the chart has to bring its row into view, or the link
  // between the two only works in one direction.
  const offsetForFocus = focusKey == null ? null : offsets[items.findIndex((i) => i.key === focusKey)]
  useEffect(() => {
    const el = ref.current
    if (!el || offsetForFocus == null) return
    const pad = 12
    if (offsetForFocus < el.scrollTop + pad || offsetForFocus > el.scrollTop + el.clientHeight - 80) {
      el.scrollTo({ top: Math.max(0, offsetForFocus - pad), behavior: 'smooth' })
    }
  }, [offsetForFocus])

  const top = scrollTop - overscan * 60
  const bottom = scrollTop + viewport + overscan * 60
  const visible = []
  for (let i = 0; i < items.length; i++) {
    const y = offsets[i]
    if (y + getHeight(items[i]) < top) continue
    if (y > bottom) break
    visible.push({ item: items[i], y, height: getHeight(items[i]) })
  }

  return (
    <div
      ref={ref}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className={`overflow-y-auto overscroll-contain ${className}`}
    >
      <div style={{ height: total, position: 'relative' }}>
        {visible.map(({ item, y, height }) => (
          <div key={item.key} style={{ position: 'absolute', top: y, left: 0, right: 0, height }}>
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  )
}
