const EXPIRED_MESSAGE = 'La sesión venció o no es válida. Volvé a ingresar.'

async function responseError(response) {
  const error = await response.json().catch(() => null)
  if (typeof error?.detail === 'string') return error.detail
  if (Array.isArray(error?.detail)) {
    return error.detail.map((item) => {
      const field = item.loc?.at(-1)
      return field ? `${field}: ${item.msg}` : item.msg
    }).join('; ')
  }
  return 'No se pudo completar la solicitud.'
}

export function createAdminApi(baseUrl, {
  fetchImpl = (...args) => fetch(...args),
  now = Date.now,
  onSessionChange = () => {}
} = {}) {
  const apiUrl = baseUrl.replace(/\/+$/, '')
  // The token exists only in memory and is discarded on reload.
  let session = null
  let generation = 0

  function clearSession() {
    generation += 1
    session = null
    onSessionChange(null)
  }

  async function login(credentials) {
    clearSession()
    const startedGeneration = generation
    const response = await fetchImpl(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    })
    if (generation !== startedGeneration) throw new Error(EXPIRED_MESSAGE)
    if (!response.ok) throw new Error(await responseError(response))
    const data = await response.json()
    if (generation !== startedGeneration) throw new Error(EXPIRED_MESSAGE)
    if (
      typeof data.access_token !== 'string' || !data.access_token ||
      !Number.isFinite(data.expires_in) || data.expires_in <= 0 || data.expires_in > 86400
    ) throw new Error('La API devolvió una sesión inválida.')
    session = { token: data.access_token, expiresAt: now() + data.expires_in * 1000 }
    onSessionChange({ ...session })
    return { ...session }
  }

  async function request(path, options = {}) {
    if (!session || session.expiresAt <= now()) {
      clearSession()
      throw new Error(EXPIRED_MESSAGE)
    }
    const current = session
    const headers = new Headers(options.headers)
    if (typeof options.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    headers.set('Authorization', `Bearer ${current.token}`)
    const response = await fetchImpl(`${apiUrl}${path}`, {
      ...options, credentials: 'omit', headers
    })
    // A response from an earlier login must not restore data or clear a newer session.
    if (session !== current) throw new Error(EXPIRED_MESSAGE)
    if (response.status === 401) {
      clearSession()
      throw new Error(EXPIRED_MESSAGE)
    }
    if (!response.ok) throw new Error(await responseError(response))
    const data = response.status === 204 ? null : await response.json()
    if (session !== current || current.expiresAt <= now()) {
      if (session === current) clearSession()
      throw new Error(EXPIRED_MESSAGE)
    }
    return data
  }

  async function logout() {
    const current = session
    clearSession()
    if (!current) return
    try {
      const response = await fetchImpl(`${apiUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'omit',
        headers: { Authorization: `Bearer ${current.token}` }
      })
      if (!response.ok && response.status !== 401) throw new Error('Logout failed')
    } catch {
      throw new Error('Saliste del panel, pero no se pudo confirmar el cierre en el servidor. La sesión vencerá automáticamente.')
    }
  }

  return { login, request, logout, clearSession }
}
