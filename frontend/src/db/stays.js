import { db } from './db.js'
import { isValidISO } from '../engine/dates.js'

const now = () => new Date().toISOString()

/**
 * Validation lives here, not in the form, so that no write path — form, sync
 * claim, or import — can create an invalid record.
 * @returns {Record<string,string>} field -> message; empty when valid
 */
export function validateStay({ name, startDate, endDate }) {
  const errors = {}
  if (!name || !String(name).trim()) errors.name = 'Give this stay a name'
  if (!isValidISO(startDate)) errors.startDate = 'Pick a start date'
  if (!isValidISO(endDate)) errors.endDate = 'Pick an end date'
  if (!errors.startDate && !errors.endDate && endDate < startDate) {
    errors.endDate = 'End date must be on or after the start date'
  }
  return errors
}

function assertValid(fields) {
  const errors = validateStay(fields)
  const keys = Object.keys(errors)
  if (keys.length) {
    const err = new Error(errors[keys[0]])
    err.fieldErrors = errors
    throw err
  }
}

export async function createStay({ name, country = null, startDate, endDate }) {
  assertValid({ name, startDate, endDate })
  const ts = now()
  const stay = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    country: country ? String(country).trim() : null,
    startDate,
    endDate,
    createdAt: ts,
    updatedAt: ts,
    deleted: false,
    ownerId: await currentOwnerId(),
  }
  await db.stays.put(stay)
  return stay
}

export async function updateStay(id, patch) {
  const existing = await db.stays.get(id)
  if (!existing) throw new Error('That stay no longer exists')
  const merged = { ...existing, ...patch }
  assertValid(merged)
  const next = {
    ...merged,
    name: String(merged.name).trim(),
    country: merged.country ? String(merged.country).trim() : null,
    createdAt: existing.createdAt,
    updatedAt: now(),
  }
  await db.stays.put(next)
  return next
}

export async function softDeleteStay(id) {
  const existing = await db.stays.get(id)
  if (!existing) return
  await db.stays.put({ ...existing, deleted: true, updatedAt: now() })
}

export async function restoreStay(id) {
  const existing = await db.stays.get(id)
  if (!existing) return
  await db.stays.put({ ...existing, deleted: false, updatedAt: now() })
}

export async function listStays() {
  const rows = await db.stays.filter((s) => !s.deleted).toArray()
  return rows.sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
}

export async function allStaysRaw() {
  return db.stays.toArray()
}

/** Last-write-wins merge of one server record. */
export async function upsertFromServer(remote) {
  const local = await db.stays.get(remote.id)
  if (local && local.updatedAt >= remote.updatedAt) return 'skipped'
  await db.stays.put(remote)
  return 'applied'
}

async function currentOwnerId() {
  const row = await db.meta.get('userId')
  return row === undefined ? null : row.value
}
