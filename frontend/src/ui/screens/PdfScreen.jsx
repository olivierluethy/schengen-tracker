import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BlobProvider, PDFDownloadLink } from '@react-pdf/renderer'
import ReportDocument from '../../pdf/ReportDocument.jsx'
import { svgToPngDataUrl } from '../../pdf/chartToPng.js'
import { formatDisplay, todayISO } from '../../engine/dates.js'
import { buildPresence, usageOn, remainingOn, statusOf } from '../../engine/schengen.js'

/**
 * Preview first, download second — never a forced download to see the report.
 * The preview is an iframe over a locally generated blob URL, so it needs no
 * network. iOS Safari renders only the first page inside an iframe; the
 * "Open" link is the escape hatch there.
 */
export default function PdfScreen({ stays, chartSvg, onClose }) {
  const [chartPng, setChartPng] = useState(null)
  const [error, setError] = useState(null)

  const today = todayISO()
  const used = usageOn(buildPresence(stays), today)
  const doc = (
    <ReportDocument
      stays={stays}
      chartPng={chartPng}
      used={used}
      remaining={remainingOn(used)}
      status={statusOf(used)}
      referenceDate={today}
      generatedOn={formatDisplay(today)}
    />
  )

  useEffect(() => {
    let cancelled = false
    svgToPngDataUrl(chartSvg)
      .then((png) => { if (!cancelled) setChartPng(png) })
      .catch(() => { if (!cancelled) setError('The chart could not be added — the rest of the report is fine.') })
    return () => { cancelled = true }
  }, [chartSvg])

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-ink-950 flex flex-col"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.22 }}
    >
      <header className="safe-t px-4 sm:px-6 h-14 flex items-center justify-between
                         border-b border-ink-800">
        <button onClick={onClose} className="btn-ghost !px-2 !py-1 text-sm">Close</button>
        <span className="heading text-base">PDF report</span>
        <span className="w-16" />
      </header>

      {error && <p className="px-4 py-2 text-xs text-warn">{error}</p>}

      <div className="flex-1 min-h-0 p-3 sm:p-6 mx-auto w-full max-w-4xl">
        <BlobProvider document={doc}>
          {({ url, loading, error: blobError }) => {
            if (loading) return <div className="h-full rounded-xl2 bg-ink-900 animate-pulse" />
            if (blobError || !url) {
              return (
                <div className="card p-6 text-center text-sm text-over">
                  The report could not be generated. Close and try again.
                </div>
              )
            }
            return (
              <iframe
                title="PDF preview"
                src={url}
                className="w-full h-full rounded-xl2 bg-ink-900 border border-ink-700"
              />
            )
          }}
        </BlobProvider>
      </div>

      <div className="p-4 safe-b border-t border-ink-800 flex gap-2 mx-auto w-full max-w-4xl">
        <BlobProvider document={doc}>
          {({ url }) =>
            url ? (
              <a href={url} target="_blank" rel="noreferrer" className="btn-quiet btn-lg flex-1">
                Open
              </a>
            ) : <span className="flex-1" />
          }
        </BlobProvider>
        <PDFDownloadLink
          document={doc}
          fileName={`schengen-${today}.pdf`}
          className="btn-primary btn-lg flex-1"
        >
          {({ loading }) => (loading ? 'Preparing…' : 'Download')}
        </PDFDownloadLink>
      </div>
    </motion.div>
  )
}
