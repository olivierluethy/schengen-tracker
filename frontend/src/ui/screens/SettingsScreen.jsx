import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getMeta, setMeta } from '../../db/meta.js'
import { login, register, logout, syncNow } from '../../sync/client.js'
import { apiFetch } from '../../sync/api.js'

export default function SettingsScreen() {
  const stored = useLiveQuery(async () => ({
    apiUrl: await getMeta('apiUrl', ''),
    user: await getMeta('user', null),
  }), [], undefined)

  const [apiUrl, setApiUrl] = useState('')
  const [probe, setProbe] = useState(null)
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => { if (stored) setApiUrl(stored.apiUrl || '') }, [stored?.apiUrl])

  if (stored === undefined) return <div className="h-40 rounded-xl2 bg-ink-900 animate-pulse" />

  async function saveUrl() {
    await setMeta('apiUrl', apiUrl.trim())
    setProbe('checking')
    const res = await apiFetch('/api/health', { apiUrl: apiUrl.trim() })
    setProbe(res.ok ? 'reachable' : 'unreachable')
  }

  async function submit() {
    setBusy(true)
    setMessage(null)
    const fn = mode === 'login' ? login : register
    const res = await fn({ email, password })
    setBusy(false)
    if (!res.ok) {
      setMessage(
        res.error === 'no-api-url' ? 'Set your server address first.'
          : res.error === 'unreachable' || res.error === 'timeout'
            ? 'Cannot reach that server. Your data is safe on this device.'
            : res.error,
      )
      return
    }
    setPassword('')
    setMessage('Signed in. Your existing stays have been added to this account.')
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2 xl:gap-6 xl:items-start xl:max-w-5xl">
      <section className="card p-5">
        <h2 className="stamp stamp-rule">Account</h2>
        <p className="mt-3 text-xs text-fog-500 leading-relaxed">
          Optional. Everything already works on this device without one — an account
          only adds sync between devices and sharing with a partner.
        </p>

        {stored.user ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm">
              Signed in as <span className="text-accent">{stored.user.email}</span>
            </p>
            <div className="flex gap-2">
              <button onClick={() => syncNow()} className="btn-quiet btn-lg flex-1">Sync now</button>
              <button onClick={() => logout()} className="btn-quiet btn-lg flex-1">Sign out</button>
            </div>
            <p className="text-xs text-fog-700">
              Signing out keeps every stay on this device.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex gap-1 p-1 bg-ink-850 border border-ink-700 rounded-xl">
              {['login', 'register'].map((m) => (
                <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m}
                  className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                    mode === m ? 'bg-ink-700 text-fog-100' : 'text-fog-500 hover:text-fog-300'}`}>
                  {m === 'login' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
            <input value={email} onChange={(e) => setEmail(e.target.value)}
              type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
              aria-label="Email" className="field" />
            <input value={password} onChange={(e) => setPassword(e.target.value)}
              type="password" autoComplete="current-password" placeholder="Password (min 8 characters)"
              aria-label="Password" className="field" />
            <button onClick={submit} disabled={busy} className="btn-primary btn-lg w-full">
              {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </div>
        )}
        {message && <p className="mt-3 text-xs text-fog-300">{message}</p>}
      </section>

      <section className="card p-5">
        <h2 className="stamp stamp-rule">Server address</h2>
        <p className="mt-3 text-xs text-fog-500 leading-relaxed">
          Only needed for sync and partner sharing. Leave it empty to stay fully local.
        </p>
        <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)}
          placeholder="http://127.0.0.1:8080" inputMode="url" autoCapitalize="off"
          aria-label="Server address" className="field mt-3" />
        <button onClick={saveUrl} className="btn-quiet btn-lg w-full mt-2">Save and test</button>
        {probe && (
          <p className={`mt-2 text-xs ${probe === 'reachable' ? 'text-ok' : probe === 'checking' ? 'text-fog-500' : 'text-warn'}`}>
            {probe === 'reachable' ? 'Server reachable.'
              : probe === 'checking' ? 'Checking…'
                : 'Not reachable right now — the app keeps working offline.'}
          </p>
        )}
      </section>
    </div>
  )
}
