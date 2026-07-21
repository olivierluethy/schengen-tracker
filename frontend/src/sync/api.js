import { getMeta } from '../db/meta.js'

/**
 * The single network boundary.
 *
 * It NEVER throws and never rejects: an unreachable backend is a normal state
 * for this app, indistinguishable from being offline. Callers branch on
 * `ok`/`error`, so no UI path can be blocked by a failed request.
 */
export async function apiFetch(path, { method = 'GET', body, token, apiUrl, timeoutMs = 8000 } = {}) {
  const base = apiUrl ?? (await getMeta('apiUrl', null))
  if (!base) return { ok: false, status: 0, data: null, error: 'no-api-url' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let data = null
    try { data = text ? JSON.parse(text) : null } catch { data = null }
    return {
      ok: res.ok,
      status: res.status,
      data,
      error: res.ok ? null : (data?.error || `HTTP ${res.status}`),
    }
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e.name === 'AbortError' ? 'timeout' : 'unreachable' }
  } finally {
    clearTimeout(timer)
  }
}
