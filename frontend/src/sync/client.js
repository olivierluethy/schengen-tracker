import { db } from '../db/db.js'
import { getMeta, setMeta, clearMeta } from '../db/meta.js'
import { allStaysRaw, upsertFromServer } from '../db/stays.js'
import { apiFetch } from './api.js'

/**
 * Delta sync client.
 *
 * PUSH set: every stay with `updatedAt > lastPushedAt` — the stays table is its
 * own outbox. PULL cursor: the server's `seq`, immune to client clock skew.
 * Conflicts resolve last-write-wins inside `upsertFromServer`.
 */
export async function syncNow() {
  const token = await getMeta('token', null)
  const userId = await getMeta('userId', null)
  if (!token || !userId) return { status: 'unauthenticated', pushed: 0, pulled: 0 }

  const lastSeq = await getMeta('lastSeq', 0)
  const lastPushedAt = await getMeta('lastPushedAt', null)

  const all = await allStaysRaw()
  const changes = all.filter((s) => !lastPushedAt || s.updatedAt > lastPushedAt)
  const startedAt = new Date().toISOString()

  const res = await apiFetch('/api/sync', {
    method: 'POST',
    token,
    body: { lastSeq, changes },
  })

  if (!res.ok) {
    if (res.status === 401) return { status: 'unauthenticated', pushed: 0, pulled: 0 }
    return { status: 'offline', pushed: 0, pulled: 0, error: res.error }
  }

  let pulled = 0
  for (const remote of res.data?.changes || []) {
    if ((await upsertFromServer(remote)) === 'applied') pulled++
  }

  await setMeta('lastSeq', res.data?.serverSeq ?? lastSeq)
  await setMeta('lastPushedAt', startedAt)

  return { status: 'synced', pushed: changes.length, pulled }
}

/** How many local records are waiting to go up. Drives the "N pending" pill. */
export async function pendingCount() {
  const lastPushedAt = await getMeta('lastPushedAt', null)
  if (!lastPushedAt) return (await allStaysRaw()).length
  return (await allStaysRaw()).filter((s) => s.updatedAt > lastPushedAt).length
}

/**
 * Claim everything entered anonymously.
 *
 * Cursors reset so the first sync after signing in pushes the entire local
 * history — nothing entered on a plane can be missed.
 */
export async function claimLocalStays(userId) {
  const rows = await allStaysRaw()
  const orphans = rows.filter((s) => s.ownerId !== userId)
  await db.stays.bulkPut(orphans.map((s) => ({ ...s, ownerId: userId })))
  await setMeta('lastSeq', 0)
  await clearMeta('lastPushedAt')
  return orphans.length
}

export async function register({ email, password, displayName }) {
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: { email, password, displayName },
  })
  if (!res.ok) return res
  await adoptSession(res.data)
  return res
}

export async function login({ email, password }) {
  const res = await apiFetch('/api/auth/login', { method: 'POST', body: { email, password } })
  if (!res.ok) return res
  await adoptSession(res.data)
  return res
}

async function adoptSession({ token, user }) {
  await setMeta('token', token)
  await setMeta('userId', user.id)
  await setMeta('user', user)
  await claimLocalStays(user.id)
  await syncNow()
}

/** Local data deliberately SURVIVES logout — the user keeps seeing their stays. */
export async function logout() {
  const token = await getMeta('token', null)
  if (token) await apiFetch('/api/auth/logout', { method: 'POST', token })
  await clearMeta('token', 'userId', 'user', 'lastSeq', 'lastPushedAt')
}
