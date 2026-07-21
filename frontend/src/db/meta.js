import { db } from './db.js'

export async function getMeta(key, fallback = null) {
  const row = await db.meta.get(key)
  return row === undefined ? fallback : row.value
}

export async function setMeta(key, value) {
  await db.meta.put({ key, value })
  return value
}

export async function clearMeta(...keys) {
  await db.meta.bulkDelete(keys)
}
