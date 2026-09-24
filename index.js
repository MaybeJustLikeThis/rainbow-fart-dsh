/** Rainbow Fart-DSH Host companion. The API key never reaches the browser. */
import { readFileSync } from 'node:fs'
export const name = 'rainbow-fart-dsh'
export const inject = ['connection']

const PATH = '/api/rainbow-fart.judge'
const MASCOT_PATH = '/api/rainbow-fart.mascot'
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
const ALLOWED = new Set(['none', 'steady', 'breakthrough'])

export function apply(ctx, rawConfig = {}) {
  if (rawConfig === null || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    throw new TypeError('rainbow-fart-dsh: config must be a mapping')
  }
  const model = rawConfig.model ?? 'jev-1.13.0'
  const timeoutMs = rawConfig.timeoutMs ?? 2500
  const apiKeyFile = rawConfig.apiKeyFile ?? process.env.TYPESAFE_API_KEY_FILE
  if (typeof model !== 'string' || !model.trim()) throw new TypeError('rainbow-fart-dsh: model must be a non-empty string')
  if (apiKeyFile !== undefined && (typeof apiKeyFile !== 'string' || !apiKeyFile.trim())) {
    throw new TypeError('rainbow-fart-dsh: apiKeyFile must be a non-empty path')
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 10_000) {
    throw new TypeError('rainbow-fart-dsh: timeoutMs must be an integer from 250 to 10000')
  }
  ctx.effect(() => ctx.connection.fetch.register({
    path: PATH,
    methods: ['GET', 'POST'],
    requestBody: 'buffered',
    fetch: request => handle(request, { model, timeoutMs, apiKeyFile }),
  }), 'rainbow-fart-dsh: authenticated Jev route')
  ctx.effect(() => ctx.connection.fetch.register({
    path: MASCOT_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: () => new Response(readFileSync(new URL('./assets/whale-girl.png', import.meta.url)), {
      headers: { 'content-type': 'image/png', 'cache-control': 'no-store' },
    }),
  }), 'rainbow-fart-dsh: mascot image')
}

function resolveKey(config, env) {
  if (typeof env.TYPESAFE_API_KEY === 'string' && env.TYPESAFE_API_KEY.trim()) return env.TYPESAFE_API_KEY.trim()
  if (!config.apiKeyFile) return undefined
  try {
    const first = readFileSync(config.apiKeyFile, 'utf8').split(/\r?\n/u)
      .map(line => line.trim()).find(line => line && !line.startsWith('#'))
    const token = first?.replace(/^TYPESAFE_API_KEY\s*[:=]\s*/u, '').replace(/^['"]|['"]$/gu, '').trim()
    return token || undefined
  } catch { return undefined }
}

export async function handle(request, config, deps = { fetch, env: process.env }) {
  const key = resolveKey(config, deps.env)
  if (request.method === 'GET') return Response.json({ jevAvailable: Boolean(key) }, { headers: { 'cache-control': 'no-store' } })
  if (request.method !== 'POST') return new Response('method not allowed', { status: 405 })
  if (!key) return Response.json({ error: 'Jev key unavailable' }, { status: 409 })
  if (Number(request.headers.get('content-length') ?? '0') > 4096) return new Response('payload too large', { status: 413 })
  let input
  try {
    const body = await request.text()
    if (body.length > 4096) return new Response('payload too large', { status: 413 })
    input = JSON.parse(body)
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }
  if (!input || input.kind !== 'complete' || typeof input.text !== 'string' || input.text.length > 500) {
    return new Response('invalid candidate', { status: 400 })
  }
  const question = {
    type: 'choice',
    instructions: 'Choose the appropriate level of brief, honest encouragement for this AI coding turn. Judge only the provided summary; do not assume tests passed or code shipped.',
    criteria: {
      none: 'No concrete progress is evident, or the summary mainly reports a failure or uncertainty.',
      steady: 'A concrete coding step or useful investigation was completed, with no exceptional milestone.',
      breakthrough: 'The summary explicitly describes a meaningful milestone such as resolving a bug, passing relevant checks, or completing a requested feature.',
    },
  }
  try {
    const upstream = await deps.fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: config.model, state: { summary: input.text }, questions: { praise: question } }),
      signal: AbortSignal.timeout(config.timeoutMs),
    })
    if (!upstream.ok) return Response.json({ error: 'Jev request failed' }, { status: 502 })
    const output = await upstream.json()
    const answer = output?.answers?.praise
    const choice = answer?.choice
    const probability = answer?.probabilities?.[choice]
    if (answer?.type !== 'choice' || !ALLOWED.has(choice) || typeof probability !== 'number' || probability < 0 || probability > 1) {
      return Response.json({ error: 'Invalid Jev answer' }, { status: 502 })
    }
    return Response.json({ choice, probability }, { headers: { 'cache-control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Jev temporarily unavailable' }, { status: 502 })
  }
}
