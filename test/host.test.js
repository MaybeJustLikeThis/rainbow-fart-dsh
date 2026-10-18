import test from 'node:test'
import assert from 'node:assert/strict'
import { apply, handle } from '../index.js'

test('Jev request stays on Host and returns a bounded typed answer', async () => {
  let sent
  const request = new Request('http://localhost/api/rainbow-fart.judge', {
    method: 'POST', body: JSON.stringify({ kind: 'complete', text: 'Fixed the parser bug and relevant tests pass.' }),
  })
  const result = await handle(request, { model: 'jev-1.13.0', timeoutMs: 1000 }, {
    env: { TYPESAFE_API_KEY: 'test-key' },
    fetch: async (_url, init) => {
      sent = init
      return Response.json({ answers: { praise: { type: 'choice', choice: 'breakthrough', probabilities: { breakthrough: 0.91 } } } })
    },
  })
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), { choice: 'breakthrough', probability: 0.91 })
  assert.match(sent.headers.authorization, /test-key/)
  assert.equal(JSON.parse(sent.body).state.summary, 'Fixed the parser bug and relevant tests pass.')
})

test('no key and oversized input fail without contacting Jev', async () => {
  const request = () => new Request('http://localhost/api/rainbow-fart.judge', { method: 'POST', body: '{}' })
  assert.equal((await handle(request(), { model: 'jev-1.13.0', timeoutMs: 1000 }, { env: {}, fetch: () => { throw Error('called') } })).status, 409)
  const tooLong = new Request('http://localhost/api/rainbow-fart.judge', { method: 'POST', body: JSON.stringify({ kind: 'complete', text: 'x'.repeat(501) }) })
  assert.equal((await handle(tooLong, { model: 'jev-1.13.0', timeoutMs: 1000 }, { env: { TYPESAFE_API_KEY: 'x' }, fetch: () => { throw Error('called') } })).status, 400)
})

test('Jev API key can be saved and removed through the authenticated Host route without being echoed', async () => {
  let saved
  const credentials = {
    describe: async () => ({ configured: Boolean(saved), writable: true }),
    resolve: async () => saved ? { value: saved, source: 'stored' } : undefined,
    set: async (_ref, value) => { saved = value },
    unset: async () => { saved = undefined },
  }
  const config = { model: 'jev-1.13.0', timeoutMs: 1000 }
  const deps = { credentials, env: {}, fetch: async (_url, init) => {
    assert.equal(init.headers.authorization, 'Bearer private-test-key')
    return Response.json({ answers: { praise: { type: 'choice', choice: 'steady', probabilities: { steady: 0.8 } } } })
  } }
  const url = 'http://localhost/api/rainbow-fart.judge'
  const get = () => handle(new Request(url), config, deps)
  assert.deepEqual(await (await get()).json(), { jevAvailable: false, writable: true })
  const stored = await handle(new Request(url, { method: 'PUT', body: JSON.stringify({ apiKey: 'private-test-key' }) }), config, deps)
  assert.deepEqual(await stored.json(), { jevAvailable: true, writable: true })
  assert.doesNotMatch(JSON.stringify(await (await get()).json()), /private-test-key/u)
  const judged = await handle(new Request(url, { method: 'POST', body: JSON.stringify({ kind: 'complete', text: 'Made progress.' }) }), config, deps)
  assert.equal(judged.status, 200)
  assert.deepEqual(await (await handle(new Request(url, { method: 'DELETE' }), config, deps)).json(), { jevAvailable: false, writable: true })
  assert.equal((await handle(new Request(url, { method: 'POST', body: JSON.stringify({ kind: 'complete', text: 'Made progress.' }) }), config, deps)).status, 409)
})

test('Jev API key entry rejects invalid values and a read-only credential source', async () => {
  let writes = 0
  const credentials = {
    describe: async () => ({ configured: true, writable: false }),
    resolve: async () => ({ value: 'from-host-env', source: 'environment' }),
    set: async () => { writes++ },
    unset: async () => { writes++ },
  }
  const config = { model: 'jev-1.13.0', timeoutMs: 1000 }
  const deps = { credentials, env: {}, fetch: () => { throw Error('called') } }
  const url = 'http://localhost/api/rainbow-fart.judge'
  assert.deepEqual(await (await handle(new Request(url), config, deps)).json(), { jevAvailable: true, writable: false })
  for (const apiKey of ['', 'has space', 'x'.repeat(2049)]) {
    const response = await handle(new Request(url, { method: 'PUT', body: JSON.stringify({ apiKey }) }), config, deps)
    assert.equal(response.status, 400)
  }
  assert.equal((await handle(new Request(url, { method: 'PUT', body: JSON.stringify({ apiKey: 'new-key' }) }), config, deps)).status, 409)
  assert.equal((await handle(new Request(url, { method: 'DELETE' }), config, deps)).status, 409)
  assert.equal(writes, 0)
})

test('the bundled whale-girl image is served as PNG by the Host route', async () => {
  const routes = []
  apply({
    effect: callback => callback(),
    connection: { fetch: { register: route => { routes.push(route); return () => {} } } },
  })
  const mascot = routes.find(route => route.path === '/api/rainbow-fart.mascot')
  assert.ok(mascot)
  assert.equal(mascot.requestBody, 'buffered')
  const first = await mascot.fetch(new Request('http://localhost/api/rainbow-fart.mascot'))
  const second = await mascot.fetch(new Request('http://localhost/api/rainbow-fart.mascot?asset=sailor-20260924'))
  for (const response of [first, second]) {
    assert.equal(response.headers.get('content-type'), 'image/png')
    assert.equal(response.headers.get('cache-control'), 'public, max-age=86400')
    const bytes = new Uint8Array(await response.arrayBuffer())
    assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
    assert.ok(bytes.length > 1000)
  }
})

test('a non-finite Jev probability or a failed upstream call does not return a choice', async () => {
  const config = { model: 'jev-1.13.0', timeoutMs: 1000 }
  const post = upstream => handle(new Request('http://localhost/api/rainbow-fart.judge', {
    method: 'POST', body: JSON.stringify({ kind: 'complete', text: 'Shipped the fix.' }),
  }), config, { env: { TYPESAFE_API_KEY: 'k' }, fetch: async () => upstream })
  const invalid = await post(Response.json({ answers: { praise: { type: 'choice', choice: 'steady', probabilities: { steady: Number.NaN } } } }))
  assert.equal(invalid.status, 502)
  let cancelled = false
  const failed = await post({
    ok: false,
    body: { cancel: async () => { cancelled = true } },
    json: async () => { throw new Error('error body should not be parsed') },
  })
  assert.equal(failed.status, 502)
  assert.equal(cancelled, true)
  assert.equal(await failed.json().then(body => body.error), 'Jev request failed')
})
