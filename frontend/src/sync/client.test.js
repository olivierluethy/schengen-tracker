import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { db } from '../db/db.js'
import { createStay, listStays, allStaysRaw } from '../db/stays.js'
import { getMeta, setMeta } from '../db/meta.js'
import { syncNow, claimLocalStays } from './client.js'

beforeEach(async () => {
  await db.stays.clear()
  await db.meta.clear()
  await setMeta('apiUrl', 'http://127.0.0.1:8080')
})

afterEach(() => { vi.unstubAllGlobals() })

const mockFetch = (payload, ok = true, status = 200) =>
  vi.fn().mockResolvedValue({
    ok, status, text: async () => JSON.stringify(payload),
  })

describe('syncNow', () => {
  it('does nothing without an account', async () => {
    const r = await syncNow()
    expect(r.status).toBe('unauthenticated')
  })

  it('reports offline instead of throwing when the server is unreachable', async () => {
    await setMeta('token', 'x'.repeat(64))
    await setMeta('userId', 'u1')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const r = await syncNow()
    expect(r.status).toBe('offline')
  })

  it('pushes local changes and applies pulled ones', async () => {
    await setMeta('token', 'x'.repeat(64))
    await setMeta('userId', 'u1')
    await createStay({ name: 'Local', startDate: '2026-07-01', endDate: '2026-07-05' })

    const remote = {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'FromServer', country: null,
      startDate: '2026-08-01', endDate: '2026-08-04',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
      deleted: false, ownerId: 'u1',
    }
    const fetchMock = mockFetch({ serverSeq: 7, changes: [remote], applied: 1, skipped: 0 })
    vi.stubGlobal('fetch', fetchMock)

    const r = await syncNow()
    expect(r.status).toBe('synced')
    expect(r.pushed).toBe(1)

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.changes).toHaveLength(1)
    expect(sent.changes[0].name).toBe('Local')

    expect((await listStays()).map((s) => s.name).sort()).toEqual(['FromServer', 'Local'])
    expect(await getMeta('lastSeq', 0)).toBe(7)
  })

  it('sends only records changed since the last push', async () => {
    await setMeta('token', 'x'.repeat(64))
    await setMeta('userId', 'u1')
    await createStay({ name: 'Old', startDate: '2026-07-01', endDate: '2026-07-05' })
    await setMeta('lastPushedAt', new Date(Date.now() + 60000).toISOString())

    const fetchMock = mockFetch({ serverSeq: 1, changes: [], applied: 0, skipped: 0 })
    vi.stubGlobal('fetch', fetchMock)
    await syncNow()

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).changes).toHaveLength(0)
  })
})

describe('claimLocalStays', () => {
  it('assigns ownerId to anonymous stays and forces a full push', async () => {
    await createStay({ name: 'Anon', startDate: '2026-07-01', endDate: '2026-07-05' })
    await setMeta('lastSeq', 42)
    await setMeta('lastPushedAt', '2030-01-01T00:00:00.000Z')

    const claimed = await claimLocalStays('user-9')
    expect(claimed).toBe(1)

    const rows = await allStaysRaw()
    expect(rows[0].ownerId).toBe('user-9')
    // Cursors reset so nothing entered offline can be missed on the first sync.
    expect(await getMeta('lastSeq', 0)).toBe(0)
    expect(await getMeta('lastPushedAt', null)).toBe(null)
  })
})
