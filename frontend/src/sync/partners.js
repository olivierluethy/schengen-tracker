import { db } from '../db/db.js'
import { getMeta } from '../db/meta.js'
import { apiFetch } from './api.js'

const withToken = async (path, opts = {}) => {
  const token = await getMeta('token', null)
  if (!token) return { ok: false, status: 401, data: null, error: 'unauthenticated' }
  return apiFetch(path, { ...opts, token })
}

/** Refresh the partner list, falling back to the local cache when offline. */
export async function fetchPartners() {
  const res = await withToken('/api/partners')
  if (!res.ok) {
    return { ok: false, error: res.error, partners: await db.partners.toArray() }
  }
  const rows = [...(res.data.outgoing || []), ...(res.data.incoming || [])]
  await db.partners.clear()
  await db.partners.bulkPut(rows)
  return { ok: true, partners: rows }
}

export const invitePartner = (email, sharingLevel = 'graph_only') =>
  withToken('/api/partners/invite', { method: 'POST', body: { email, sharingLevel } })

export const respondToInvite = (id, accept) =>
  withToken('/api/partners/respond', { method: 'POST', body: { id, accept } })

export const revokePartnership = (id) =>
  withToken('/api/partners/revoke', { method: 'POST', body: { id } })

export const setSharingLevel = (id, sharingLevel) =>
  withToken('/api/partners/sharing', { method: 'POST', body: { id, sharingLevel } })

/**
 * A partner's tracking data, cached so joint planning still works on a plane.
 * The cached copy carries `fetchedAt` and the UI must show how old it is —
 * stale numbers presented as current would be worse than no numbers.
 */
export async function fetchPartnerTracking(partnerId) {
  const res = await withToken(`/api/partners/${partnerId}/tracking`)
  if (!res.ok) {
    const cached = await db.partnerCurves.get(partnerId)
    return cached
      ? { ok: true, stale: true, tracking: cached.tracking, fetchedAt: cached.fetchedAt }
      : { ok: false, error: res.error }
  }
  const fetchedAt = new Date().toISOString()
  await db.partnerCurves.put({ partnerId, tracking: res.data.tracking, fetchedAt })
  return { ok: true, stale: false, tracking: res.data.tracking, fetchedAt }
}
