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

test('the bundled whale-girl image is served as PNG by the Host route', async () => {
  const routes = []
  apply({
    effect: callback => callback(),
    connection: { fetch: { register: route => { routes.push(route); return () => {} } } },
  })
  const mascot = routes.find(route => route.path === '/api/rainbow-fart.mascot')
  assert.ok(mascot)
  assert.equal(mascot.requestBody, 'buffered')
  const response = await mascot.fetch(new Request('http://localhost/api/rainbow-fart.mascot'))
  assert.equal(response.headers.get('content-type'), 'image/png')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const bytes = new Uint8Array(await response.arrayBuffer())
  assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
})
