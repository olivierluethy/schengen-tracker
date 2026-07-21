import Dexie from 'dexie'

/**
 * Local IndexedDB is the client SOURCE OF TRUTH. The server is a replica.
 *
 * There is deliberately no separate "pending changes" table: the set of stays
 * with `updatedAt > lastPushedAt` IS the outbox. One fewer structure to fall
 * out of sync.
 */
export const db = new Dexie('schengen-tracker')

db.version(1).stores({
  stays: 'id, startDate, updatedAt, deleted',
  meta: 'key',
  partners: 'id, status',
  partnerCurves: 'partnerId',
})
