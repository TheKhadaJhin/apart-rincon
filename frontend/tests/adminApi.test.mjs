import test from 'node:test'
import assert from 'node:assert/strict'
import { createAdminApi } from '../src/adminApi.mjs'

const credentials = { username: 'synthetic-admin', password: 'synthetic-test-password' }
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' }
})
const sessionResponse = (token = 'synthetic-token', expires_in = 3600) =>
  json({ access_token: token, token_type: 'bearer', expires_in })

function harness(responses = []) {
  const calls = []
  const states = []
  let time = 1000
  const api = createAdminApi('https://example.invalid/', {
    now: () => time,
    onSessionChange: (value) => states.push(value),
    fetchImpl: async (url, options) => {
      calls.push({ url, ...options, headers: new Headers(options.headers) })
      assert.ok(responses.length, 'Unexpected network request')
      const next = responses.shift()
      return typeof next === 'function' ? next() : next
    }
  })
  return { api, calls, states, responses, advance: (ms) => { time += ms } }
}

function deferred() {
  let resolve
  const promise = new Promise((complete) => { resolve = complete })
  return { promise, resolve }
}

test('login sends credentials to the API and exposes an expiring memory session', async () => {
  const h = harness([sessionResponse()])
  const session = await h.api.login(credentials)
  assert.equal(h.calls[0].url, 'https://example.invalid/api/auth/login')
  assert.equal(h.calls[0].method, 'POST')
  assert.equal(h.calls[0].credentials, 'omit')
  assert.deepEqual(JSON.parse(h.calls[0].body), credentials)
  assert.equal(session.expiresAt, 3601000)
  assert.equal(h.states.at(-1).token, 'synthetic-token')
})

for (const [status, detail] of [
  [401, 'Credenciales inválidas'],
  [429, 'Demasiados intentos. Volvé a intentar más tarde.'],
  [503, 'El acceso administrativo todavía no fue configurado']
]) {
  test(`login preserves the actionable API error for HTTP ${status}`, async () => {
    const h = harness([json({ detail }, status)])
    await assert.rejects(h.api.login(credentials), { message: detail })
    assert.equal(h.states.at(-1), null)
  })
}

for (const ttl of [undefined, 0, -1, '3600', 86401]) {
  test(`invalid session lifetime ${String(ttl)} is rejected`, async () => {
    const h = harness([json({ access_token: 'synthetic-token', expires_in: ttl })])
    await assert.rejects(h.api.login(credentials), /sesión inválida/)
    assert.equal(h.states.at(-1), null)
  })
}

test('JSON mutations carry the bearer header and JSON content type', async () => {
  const h = harness([sessionResponse(), json({ id: 'synthetic-booking' })])
  await h.api.login(credentials)
  const result = await h.api.request('/api/admin/bookings', {
    method: 'POST', body: JSON.stringify({ property_id: 'depto-1' })
  })
  assert.equal(result.id, 'synthetic-booking')
  assert.equal(h.calls[1].headers.get('Authorization'), 'Bearer synthetic-token')
  assert.equal(h.calls[1].headers.get('Content-Type'), 'application/json')
  assert.equal(h.calls[1].credentials, 'omit')
})

test('multipart uploads keep the browser-generated boundary and carry authentication', async () => {
  const h = harness([sessionResponse(), json({ id: 'synthetic-image' })])
  await h.api.login(credentials)
  const body = new FormData()
  body.append('file', new Blob(['synthetic content']), 'test.png')
  await h.api.request('/api/admin/gallery/images', { method: 'POST', body })
  assert.equal(h.calls[1].body, body)
  assert.equal(h.calls[1].headers.get('Content-Type'), null)
  assert.equal(h.calls[1].headers.get('Authorization'), 'Bearer synthetic-token')
})

test('expired sessions cannot send a new request', async () => {
  const h = harness([sessionResponse()])
  await h.api.login(credentials)
  h.advance(3600000)
  await assert.rejects(h.api.request('/api/admin/bookings'), /sesión venció/)
  assert.equal(h.calls.length, 1)
  assert.equal(h.states.at(-1), null)
})

test('a 401 during image upload clears the session and private UI state', async () => {
  const h = harness([sessionResponse(), json({ detail: 'expired' }, 401)])
  await h.api.login(credentials)
  await assert.rejects(h.api.request('/api/admin/gallery/images', {
    method: 'POST', body: new FormData()
  }), /sesión venció/)
  assert.equal(h.states.at(-1), null)
})

test('validation errors identify the rejected field without ending the session', async () => {
  const h = harness([sessionResponse(), json({
    detail: [{ loc: ['body', 'start_date'], msg: 'Use YYYY-MM-DD' }]
  }, 422)])
  await h.api.login(credentials)
  await assert.rejects(h.api.request('/api/admin/bookings', {
    method: 'POST', body: '{}'
  }), { message: 'start_date: Use YYYY-MM-DD' })
  assert.equal(h.states.at(-1).token, 'synthetic-token')
})

test('logout clears locally and asks the server to revoke the current bearer token', async () => {
  const h = harness([sessionResponse(), json({ status: 'ok' })])
  await h.api.login(credentials)
  await h.api.logout()
  assert.equal(h.calls[1].url, 'https://example.invalid/api/auth/logout')
  assert.equal(h.calls[1].method, 'POST')
  assert.equal(h.calls[1].headers.get('Authorization'), 'Bearer synthetic-token')
  assert.equal(h.states.at(-1), null)
  await assert.rejects(h.api.request('/api/admin/bookings'), /sesión venció/)
  assert.equal(h.calls.length, 2)
})

test('an offline logout clears locally and explains that revocation was not confirmed', async () => {
  const h = harness([sessionResponse(), () => { throw new Error('offline') }])
  await h.api.login(credentials)
  await assert.rejects(h.api.logout(), /no se pudo confirmar el cierre en el servidor/)
  assert.equal(h.states.at(-1), null)
})

test('logout also succeeds when the server session already expired', async () => {
  const h = harness([sessionResponse(), json({ detail: 'expired' }, 401)])
  await h.api.login(credentials)
  await h.api.logout()
  assert.equal(h.states.at(-1), null)
})

test('a late private response cannot restore data after logout', async () => {
  const pending = deferred()
  const h = harness([sessionResponse(), pending.promise, json({ status: 'ok' })])
  await h.api.login(credentials)
  const request = h.api.request('/api/admin/bookings')
  const rejected = assert.rejects(request, /sesión venció/)
  await h.api.logout()
  pending.resolve(json([{ guest_name: 'synthetic old response' }]))
  await rejected
  assert.equal(h.states.at(-1), null)
})

test('a late 401 from an earlier session cannot clear a newer login', async () => {
  const pending = deferred()
  const h = harness([sessionResponse('old-token'), pending.promise, sessionResponse('new-token')])
  await h.api.login(credentials)
  const request = h.api.request('/api/admin/bookings')
  const rejected = assert.rejects(request, /sesión venció/)
  await h.api.login(credentials)
  pending.resolve(json({ detail: 'expired' }, 401))
  await rejected
  assert.equal(h.states.at(-1).token, 'new-token')
})

test('a pending login cannot re-open a session that was cleared', async () => {
  const pending = deferred()
  const h = harness([pending.promise])
  const login = h.api.login(credentials)
  const rejected = assert.rejects(login, /sesión venció/)
  h.api.clearSession()
  pending.resolve(sessionResponse())
  await rejected
  assert.equal(h.states.at(-1), null)
})

test('expiry while reading the response body discards the returned data', async () => {
  const body = deferred()
  const h = harness([sessionResponse(), { ok: true, status: 200, json: () => body.promise }])
  await h.api.login(credentials)
  const request = h.api.request('/api/admin/bookings')
  const rejected = assert.rejects(request, /sesión venció/)
  h.advance(3600000)
  body.resolve([])
  await rejected
  assert.equal(h.states.at(-1), null)
})

test('a newly created client does not restore any previous login', async () => {
  const first = harness([sessionResponse()])
  await first.api.login(credentials)
  const reloaded = harness()
  await assert.rejects(reloaded.api.request('/api/admin/bookings'), /sesión venció/)
  assert.equal(reloaded.calls.length, 0)
})
