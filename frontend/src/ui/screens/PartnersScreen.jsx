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

const STATUS_TONE = {
  pending: 'border-warn/30 bg-warn/10 text-warn',
  accepted: 'border-ok/30 bg-ok/10 text-ok',
  declined: 'border-ink-600 bg-ink-850 text-fog-500',
  revoked: 'border-ink-600 bg-ink-850 text-fog-500',
}

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
      <div className="card p-8 sm:p-10 text-center max-w-xl mx-auto">
        <h2 className="heading text-xl">Plan trips together</h2>
        <p className="mt-2.5 text-sm text-fog-500 leading-relaxed">
          Invite a partner and the app finds the stretches where you both still have
          Schengen days available — no messaging back and forth.
        </p>
        <p className="mt-3.5 text-xs text-fog-700 leading-relaxed">
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
    <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)] xl:gap-6 xl:items-start">
      <section className="card p-5 xl:sticky xl:top-8">
        <h2 className="stamp stamp-rule">Invite a partner</h2>
        <input value={email} onChange={(e) => setEmail(e.target.value)}
          type="email" inputMode="email" placeholder="partner@example.com"
          aria-label="Partner email"
          className="field mt-3.5" />
        <button onClick={send} className="btn-primary btn-lg w-full mt-2">Send invite</button>
        <p className="mt-3 text-xs text-fog-700 leading-relaxed">
          They see only your rolling graph and how many days you have left — not where
          you went — unless you switch that partnership to full details.
        </p>
        {message && <p className="mt-2.5 text-xs text-fog-300">{message}</p>}
      </section>

      <div className="space-y-5">
        {incoming.length === 0 && outgoing.length === 0 && (
          <div className="well px-5 py-8 text-center">
            <p className="text-sm text-fog-500">No partners yet.</p>
            <p className="mt-1.5 text-xs text-fog-700">
              Send an invite and it will appear here as soon as it is sent.
            </p>
          </div>
        )}

        {incoming.length > 0 && (
          <Group title="Shared with you" count={incoming.length}>
            {incoming.map((p) => (
              <PartnerCard key={p.id} status={p.status} name="Invite from a partner">
                {p.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={async () => { await respondToInvite(p.id, true); reload() }}
                      className="btn-primary flex-1">Accept</button>
                    <button onClick={async () => { await respondToInvite(p.id, false); reload() }}
                      className="btn-quiet flex-1">Decline</button>
                  </div>
                )}
                {p.status === 'accepted' && (
                  <button onClick={() => openPartner(p)} className="btn-quiet w-full">
                    Open their tracking
                  </button>
                )}
              </PartnerCard>
            ))}
          </Group>
        )}

        {outgoing.length > 0 && (
          <Group title="You are sharing with" count={outgoing.length}>
            {outgoing.map((p) => (
              <PartnerCard key={p.id} status={p.status} name={p.toEmail}>
                <label className="stamp block mb-1.5" htmlFor={`share-${p.id}`}>
                  They can see
                </label>
                <select
                  id={`share-${p.id}`}
                  value={p.sharingLevel}
                  onChange={async (e) => { await setSharingLevel(p.id, e.target.value); reload() }}
                  className="select w-full !py-2.5 !text-sm"
                >
                  <option value="graph_only">Graph only (recommended)</option>
                  <option value="full">Full trip details</option>
                </select>
                <button onClick={async () => { await revokePartnership(p.id); reload() }}
                  className="btn-danger w-full mt-2">
                  Stop sharing
                </button>
              </PartnerCard>
            ))}
          </Group>
        )}
      </div>
    </div>
  )
}

function Group({ title, count, children }) {
  return (
    <section>
      <div className="flex items-center gap-3 px-1 mb-2.5">
        <h3 className="stamp stamp-rule">{title}</h3>
        <span className="num text-[11px] text-fog-800">{count}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{children}</div>
    </section>
  )
}

function PartnerCard({ name, status, children }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="card p-4 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm text-fog-100 truncate">{name}</span>
        <span className={`pill shrink-0 ${STATUS_TONE[status] || STATUS_TONE.declined}`}>
          {status}
        </span>
      </div>
      <div className="mt-auto">{children}</div>
    </motion.div>
  )
}
