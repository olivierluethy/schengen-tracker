import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db.js'
import {
  createStay, updateStay, softDeleteStay, restoreStay,
  listStays, allStaysRaw, upsertFromServer,
} from './stays.js'
import { getMeta, setMeta } from './meta.js'

beforeEach(async () => {
  await db.stays.clear()
  await db.meta.clear()
})

describe('createStay', () => {
  it('assigns a UUID and timestamps', async () => {
    const s = await createStay({ name: 'Barcelona', startDate: '2026-07-23', endDate: '2026-07-30' })
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(s.createdAt).toBe(s.updatedAt)
    expect(s.deleted).toBe(false)
    expect(s.ownerId).toBe(null)
  })

  it('persists and reads back with both dates intact', async () => {
    await createStay({ name: 'Barcelona', startDate: '2026-07-23', endDate: '2026-07-30' })
    const [row] = await listStays()
    // The edit-modal bug lives here: dates must survive the round-trip.
    expect(row.startDate).toBe('2026-07-23')
    expect(row.endDate).toBe('2026-07-30')
    expect(row.name).toBe('Barcelona')
  })

  it('rejects an end date before the start date', async () => {
    await expect(
      createStay({ name: 'Bad', startDate: '2026-07-30', endDate: '2026-07-23' }),
    ).rejects.toThrow(/end date/i)
  })

  it('rejects an empty name', async () => {
    await expect(
      createStay({ name: '  ', startDate: '2026-07-23', endDate: '2026-07-30' }),
    ).rejects.toThrow(/name/i)
  })
})

describe('updateStay', () => {
  it('bumps updatedAt and keeps createdAt', async () => {
    const s = await createStay({ name: 'Paris', startDate: '2026-05-01', endDate: '2026-05-05' })
    const u = await updateStay(s.id, { name: 'Lyon', endDate: '2026-05-08' })
    expect(u.name).toBe('Lyon')
    expect(u.endDate).toBe('2026-05-08')
    expect(u.startDate).toBe('2026-05-01')
    expect(u.createdAt).toBe(s.createdAt)
    expect(u.updatedAt >= s.updatedAt).toBe(true)
  })

  it('validates the resulting date range, not just the patch', async () => {
    const s = await createStay({ name: 'Paris', startDate: '2026-05-01', endDate: '2026-05-05' })
    await expect(updateStay(s.id, { endDate: '2026-04-30' })).rejects.toThrow(/end date/i)
  })
})

describe('soft delete', () => {
  it('tombstones rather than removing the row', async () => {
    const s = await createStay({ name: 'Rome', startDate: '2026-06-01', endDate: '2026-06-04' })
    await softDeleteStay(s.id)
    expect(await listStays()).toHaveLength(0)
    const raw = await allStaysRaw()
    expect(raw).toHaveLength(1)
    expect(raw[0].deleted).toBe(true)
  })

  it('can be undone', async () => {
    const s = await createStay({ name: 'Rome', startDate: '2026-06-01', endDate: '2026-06-04' })
    await softDeleteStay(s.id)
    await restoreStay(s.id)
    expect(await listStays()).toHaveLength(1)
  })
})

describe('listStays', () => {
  it('sorts by start date ascending', async () => {
    await createStay({ name: 'B', startDate: '2026-08-01', endDate: '2026-08-02' })
    await createStay({ name: 'A', startDate: '2026-07-01', endDate: '2026-07-02' })
    expect((await listStays()).map((s) => s.name)).toEqual(['A', 'B'])
  })
})

describe('upsertFromServer (last-write-wins)', () => {
  const server = (over = {}) => ({
    id: 'fixed-id', name: 'Server', country: null,
    startDate: '2026-07-01', endDate: '2026-07-05',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-02T00:00:00.000Z',
    deleted: false, ownerId: 'user-1', ...over,
  })

  it('inserts a record it has never seen', async () => {
    expect(await upsertFromServer(server())).toBe('applied')
    expect((await listStays())[0].name).toBe('Server')
  })

  it('applies a newer server record over a stale local one', async () => {
    await db.stays.put(server({ name: 'Local', updatedAt: '2026-06-01T00:00:00.000Z' }))
    expect(await upsertFromServer(server({ name: 'Server' }))).toBe('applied')
    expect((await listStays())[0].name).toBe('Server')
  })

  it('keeps a newer local record over a stale server one', async () => {
    await db.stays.put(server({ name: 'Local', updatedAt: '2026-06-09T00:00:00.000Z' }))
    expect(await upsertFromServer(server({ name: 'Server' }))).toBe('skipped')
    expect((await listStays())[0].name).toBe('Local')
  })

  it('propagates a server tombstone', async () => {
    await db.stays.put(server({ name: 'Local' }))
    await upsertFromServer(server({ deleted: true, updatedAt: '2026-06-03T00:00:00.000Z' }))
    expect(await listStays()).toHaveLength(0)
    expect(await allStaysRaw()).toHaveLength(1)
  })
})

describe('meta', () => {
  it('stores and retrieves values with a fallback', async () => {
    expect(await getMeta('apiUrl', null)).toBe(null)
    await setMeta('apiUrl', 'http://127.0.0.1:8080')
    expect(await getMeta('apiUrl', null)).toBe('http://127.0.0.1:8080')
  })
})
