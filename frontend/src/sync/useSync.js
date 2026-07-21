import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getMeta } from '../db/meta.js'
import { db } from '../db/db.js'
import { pendingCount, syncNow } from './client.js'
import { useOnline } from './useOnline.js'

/**
 * Background sync. Nothing here ever blocks rendering: the UI reads IndexedDB,
 * and this only pushes bytes around in the background.
 */
export function useSync() {
  const online = useOnline()
  const [state, setState] = useState('local')
  const [count, setCount] = useState(0)
  const running = useRef(false)

  const session = useLiveQuery(async () => ({
    token: await getMeta('token', null),
    user: await getMeta('user', null),
  }), [], undefined)

  const signedIn = Boolean(session?.token)

  const sync = useCallback(async () => {
    if (running.current) return
    running.current = true
    setState('syncing')
    const result = await syncNow()
    running.current = false
    setState(
      result.status === 'synced' ? 'synced'
        : result.status === 'unauthenticated' ? 'local'
          : 'pending',
    )
    setCount(await pendingCount())
  }, [])

  // Flush the queue the moment connectivity returns — the hotel-wifi moment.
  useEffect(() => {
    if (!signedIn) { setState(online ? 'local' : 'offline'); return }
    if (!online) { setState('offline'); return }
    sync()
  }, [online, signedIn, sync])

  // Any local write while signed in becomes pending until the next flush.
  const stayCount = useLiveQuery(() => db.stays.count(), [], 0)
  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    pendingCount().then((n) => {
      if (cancelled) return
      setCount(n)
      if (n > 0 && online) sync()
      else if (n > 0) setState('pending')
    })
    return () => { cancelled = true }
  }, [stayCount, signedIn, online, sync])

  return { state, count, sync, signedIn, user: session?.user ?? null }
}
