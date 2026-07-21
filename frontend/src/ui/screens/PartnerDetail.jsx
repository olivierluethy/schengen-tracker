import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { formatDisplay, todayISO } from '../../engine/dates.js'
import { buildPresence, usageOn, remainingOn, LIMIT_DAYS } from '../../engine/schengen.js'
import { feasibility, jointWindows } from '../../engine/joint.js'
import DateRangeSheet from '../date/DateRangeSheet.jsx'

/**
 * One partner: their headroom, our joint windows, and a proposed-trip check.
 * Everything here runs on the CURVE, so it behaves identically whether the
 * partner shared graph_only or full.
 */
export default function PartnerDetail({ partnership, tracking, stale, fetchedAt, myStays, onBack }) {
  const [minLength, setMinLength] = useState(7)
  const [proposal, setProposal] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const today = todayISO()

  const myCurve = useMemo(() => {
    const presence = buildPresence(myStays)
    return (tracking?.curve || []).map((p) => {
      const used = usageOn(presence, p.date)
      return { date: p.date, used, remaining: remainingOn(used) }
    })
  }, [myStays, tracking])

  const windows = useMemo(
    () => (tracking ? jointWindows({ curveA: myCurve, curveB: tracking.curve, minLength }) : []),
    [myCurve, tracking, minLength],
  )

  const theirToday = tracking?.curve.find((p) => p.date === today)

  const check = useMemo(() => {
    if (!proposal || !tracking) return null
    const mine = feasibility(myStays, proposal)
    // The partner is checked against their curve — we may not have their stays.
    const theirs = partnerFeasibility(tracking.curve, proposal)
    return { mine, theirs }
  }, [proposal, tracking, myStays])

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="btn-ghost !px-2 !py-1 text-sm">← All partners</button>

      <section className="card p-5">
        <h2 className="heading text-lg">{partnership.fromEmail || partnership.toEmail}</h2>
        <p className="mt-1.5 text-xs text-fog-700 leading-relaxed">
          Sharing level: {partnership.sharingLevel === 'full' ? 'Full trip details' : 'Graph only'}
          {partnership.sharingLevel === 'graph_only' &&
            ' — you can see their allowance, not where they went.'}
        </p>
        {stale && (
          <p className="mt-2.5 text-xs text-warn">
            Offline — showing figures cached on {formatDisplay((fetchedAt || '').slice(0, 10))}.
          </p>
        )}
        {theirToday && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="well px-3.5 py-3">
              <span className="stamp block">Their days left</span>
              <span className="mt-1.5 block num text-2xl font-semibold leading-none">
                {theirToday.remaining}
              </span>
            </div>
            <div className="well px-3.5 py-3">
              <span className="stamp block">Your days left</span>
              <span className="mt-1.5 block num text-2xl font-semibold leading-none">
                {remainingOn(usageOn(buildPresence(myStays), today))}
              </span>
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <section className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="stamp stamp-rule">Where you both have space</h3>
            <select
              value={minLength}
              onChange={(e) => setMinLength(Number(e.target.value))}
              aria-label="Minimum trip length"
              className="select shrink-0"
            >
              {[3, 5, 7, 10, 14, 21, 30].map((n) => (
                <option key={n} value={n}>≥ {n} days</option>
              ))}
            </select>
          </div>

          {windows.length === 0 ? (
            <p className="mt-3.5 text-sm text-fog-500 leading-relaxed">
              No stretch in the next 12 months where you both have {minLength} days free.
              Try a shorter trip.
            </p>
          ) : (
            <ul className="mt-3.5 space-y-2">
              {windows.slice(0, 8).map((w) => (
                <motion.li
                  key={w.from}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center justify-between gap-3 bg-ok/10 border border-ok/25
                             rounded-xl px-3.5 py-2.5"
                >
                  <span className="num text-sm">
                    {formatDisplay(w.from)}
                    <span className="text-fog-700 px-1.5">→</span>
                    {formatDisplay(w.to)}
                  </span>
                  <span className="num text-xs text-ok shrink-0">{w.length} days</span>
                </motion.li>
              ))}
            </ul>
          )}
          <p className="mt-3.5 text-[11px] text-fog-700 leading-relaxed">
            Calculated from both allowances. Deliberately cautious: if either of you is
            already travelling on one of these days, you have more room, not less.
          </p>
        </section>

        <section className="card p-5">
          <h3 className="stamp stamp-rule">Check a specific trip</h3>
          <button onClick={() => setSheetOpen(true)} className="field mt-3.5 text-left num
                     hover:border-ink-600">
            {proposal
              ? `${formatDisplay(proposal.startDate)} → ${formatDisplay(proposal.endDate)}`
              : 'Pick the dates you are considering'}
          </button>

          {check && (
            <div className="mt-3 space-y-2">
              <Verdict who="You" result={check.mine} />
              <Verdict who="They" result={check.theirs} />
            </div>
          )}
        </section>
      </div>

      {sheetOpen && (
        <DateRangeSheet
          open={sheetOpen}
          value={proposal}
          onCancel={() => setSheetOpen(false)}
          onConfirm={(v) => { setProposal(v); setSheetOpen(false) }}
        />
      )}
    </div>
  )
}

function Verdict({ who, result }) {
  const ok = result.ok
  return (
    <div className={`rounded-xl px-3.5 py-3 border ${
      ok ? 'bg-ok/10 border-ok/25' : 'bg-over/10 border-over/25'}`}>
      <span className={`text-sm font-medium ${ok ? 'text-ok' : 'text-over'}`}>
        {who} {ok ? 'can make this trip' : 'would go over the limit'}
      </span>
      <span className="block text-xs text-fog-500 num mt-1">
        Peak {result.peakUsed} of {LIMIT_DAYS} days
        {result.breachDate ? ` · over from ${formatDisplay(result.breachDate)}` : ''}
      </span>
    </div>
  )
}

/** Feasibility from a curve alone — all we have for a graph_only partner. */
function partnerFeasibility(curve, { startDate, endDate }) {
  const byDate = new Map(curve.map((p) => [p.date, p.used]))
  let peakUsed = 0
  let breachDate = null
  let k = 0
  for (let d = startDate; d <= endDate; d = nextDay(d)) {
    k++
    const used = (byDate.get(d) ?? 0) + k
    if (used > peakUsed) peakUsed = used
    if (used > LIMIT_DAYS && breachDate === null) breachDate = d
  }
  return { ok: breachDate === null, breachDate, peakUsed }
}

function nextDay(iso) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
