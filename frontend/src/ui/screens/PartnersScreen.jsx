import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { getMeta } from '../../db/meta.js'
import { listStays } from '../../db/stays.js'
import {
  fetchPartners, invitePartner, respondToInvite,
  revokePartnership, setSharingLevel, fetchPartnerTracking,
} from '../../sync/partners.js'
import PartnerDetail from './PartnerDetail.jsx'

export default function PartnersScreen() {
  const session = useLiveQuery(() => getMeta('user', null), [], undefined)
  const myStays = useLiveQuery(() => listStays(), [], null)
  const [partners, setPartners] = useState([])
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState(null)
  const [open, setOpen] = useState(null)

  const reload = async () => {
    const r = await fetchPartners()
    setPartners(r.partners || [])
    if (!r.ok && r.error !== 'unauthenticated') {
      setMessage('Showing the last list saved on this device.')
    }
  }

  useEffect(() => { if (session) reload() }, [Boolean(session)])

  if (session === undefined || myStays === null) {
    return <div className="h-40 rounded-xl2 bg-ink-900 animate-pulse" />
  }

  if (!session) {
    return (
      <div className="card p-6 text-center">
        <h2 className="text-lg font-semibold tracking-tight">Plan trips together</h2>
        <p className="mt-2 text-sm text-fog-500 leading-relaxed">
          Invite a partner and the app finds the stretches where you both still have
          Schengen days available — no messaging back and forth.
        </p>
        <p className="mt-3 text-xs text-fog-700">
          This is the one feature that needs an account. Everything else works offline
          without one. Add your account under Settings.
        </p>
      </div>
    )
  }

  if (open) {
    return (
      <PartnerDetail
        partnership={open.partnership}
        tracking={open.tracking}
        stale={open.stale}
        fetchedAt={open.fetchedAt}
        myStays={myStays}
        onBack={() => setOpen(null)}
      />
    )
  }

  const openPartner = async (p) => {
    const r = await fetchPartnerTracking(p.id)
    if (!r.ok) { setMessage('That partner’s data is not available offline yet.'); return }
    setOpen({ partnership: p, tracking: r.tracking, stale: r.stale, fetchedAt: r.fetchedAt })
  }

  const send = async () => {
    const res = await invitePartner(email.trim())
    setMessage(res.ok ? `Invite sent to ${email.trim()}.` : res.error)
    if (res.ok) { setEmail(''); reload() }
  }

  const outgoing = partners.filter((p) => p.direction === 'outgoing')
  const incoming = partners.filter((p) => p.direction === 'incoming')

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-sm font-semibold tracking-tight">Invite a partner</h2>
        <input value={email} onChange={(e) => setEmail(e.target.value)}
          type="email" inputMode="email" placeholder="partner@example.com"
          className="mt-3 w-full bg-ink-850 border border-ink-700 rounded-xl2 px-4 py-3 outline-none focus:border-accent" />
        <button onClick={send}
          className="mt-2 w-full px-4 py-3 rounded-xl2 bg-accent text-ink-950 font-semibold">
          Send invite
        </button>
        <p className="mt-2 text-xs text-fog-700 leading-relaxed">
          They see only your rolling graph and how many days you have left — not where
          you went — unless you switch that partnership to full details.
        </p>
        {message && <p className="mt-2 text-xs text-fog-300">{message}</p>}
      </section>

      {incoming.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-widest text-fog-700 mb-2 px-1">
            Shared with you
          </h3>
          <div className="space-y-2">
            {incoming.map((p) => (
              <motion.div key={p.id} layout className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm truncate">Invite from a partner</span>
                  <span className="text-xs text-fog-700">{p.status}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  {p.status === 'pending' && (
                    <>
                      <button onClick={async () => { await respondToInvite(p.id, true); reload() }}
                        className="flex-1 px-3 py-2 rounded-lg bg-accent text-ink-950 text-sm font-semibold">
                        Accept
                      </button>
                      <button onClick={async () => { await respondToInvite(p.id, false); reload() }}
                        className="flex-1 px-3 py-2 rounded-lg bg-ink-800 text-fog-300 text-sm">
                        Decline
                      </button>
                    </>
                  )}
                  {p.status === 'accepted' && (
                    <button onClick={() => openPartner(p)}
                      className="flex-1 px-3 py-2 rounded-lg bg-ink-800 text-fog-200 text-sm">
                      Open their tracking
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {outgoing.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-widest text-fog-700 mb-2 px-1">
            You are sharing with
          </h3>
          <div className="space-y-2">
            {outgoing.map((p) => (
              <motion.div key={p.id} layout className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm truncate">{p.toEmail}</span>
                  <span className="text-xs text-fog-700">{p.status}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <select
                    value={p.sharingLevel}
                    onChange={async (e) => { await setSharingLevel(p.id, e.target.value); reload() }}
                    className="flex-1 bg-ink-850 border border-ink-700 rounded-lg px-2 py-2 text-xs text-fog-300"
                  >
                    <option value="graph_only">Graph only (recommended)</option>
                    <option value="full">Full trip details</option>
                  </select>
                  <button onClick={async () => { await revokePartnership(p.id); reload() }}
                    className="px-3 py-2 rounded-lg bg-over/15 text-over text-xs">
                    Stop sharing
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
