import assert from 'node:assert/strict'
import { setTimeout as wait } from 'node:timers/promises'
import { test } from 'node:test'
import { createGenerationEndpoint, createGenerationWorker } from '../netlify/functions/generate.mjs'
import { generateDesign, GenerationError } from '../src/services/ai.ts'

// All worker invocations and model responses are simulated. No Netlify services are used.
process.env.OPENAI_API_KEY = 'test-key'
process.env.OPENAI_BASE_URL = 'https://model.example'

const baseUrl = 'https://study.example'
const config = {
  canvas: { width: 1600, height: 1200, background: '#FFFFFF' },
  allowBackgroundChange: true,
  allowedShapes: ['circle'],
  aiGenerationLimit: 1,
}
const design = {
  elements: [{ id: 'shape1', type: 'circle', x: 100, y: 100, width: 20, height: 20, rotation: 0, fill: '#EF4444' }],
  background: '#FFFFFF',
  model: 'test-model',
  requestedAt: new Date(0).toISOString(),
  respondedAt: new Date(40_000).toISOString(),
  rawOutput: '{}',
  retries: 0,
  validation: { passed: true, issues: [] },
}

function mockStore() {
  const entries = new Map()
  let version = 0
  return {
    async getWithMetadata(key) {
      return structuredClone(entries.get(key) ?? null)
    },
    async setJSON(key, data, { onlyIfMatch, onlyIfNew } = {}) {
      const prior = entries.get(key)
      if ((onlyIfNew && prior) || (onlyIfMatch && prior?.etag !== onlyIfMatch)) return { modified: false }
      const entry = { data: structuredClone(data), etag: String(++version) }
      entries.set(key, entry)
      return { modified: true, etag: entry.etag }
    },
  }
}

function createHarness(generate, { firstDispatchFails = false } = {}) {
  const bucket = mockStore()
  const worker = createGenerationWorker({ getUsageStore: () => bucket, generate })
  const dispatches = []
  let dispatchCount = 0
  const endpoint = createGenerationEndpoint({
    getUsageStore: () => bucket,
    resolve: async () => ({ config, preview: false }),
    authorizePreview: async () => false,
    dispatch: async (_request, _context, key, token) => {
      if (++dispatchCount === 1 && firstDispatchFails) throw new Error('Simulated dispatch failure')
      const makeWorkerRequest = () => new Request(`${baseUrl}/worker`, {
        method: 'POST', body: JSON.stringify({ key, token }),
      })
      // Deliver each dispatch twice to model retries or an overlapping resume.
      dispatches.push(worker(makeWorkerRequest()), worker(makeWorkerRequest()))
    },
  })
  return { endpoint, dispatches }
}

function jobRequest(job, extras = {}) {
  return new Request(`${baseUrl}/generate`, {
    method: 'POST',
    body: JSON.stringify({ code: 'study', participantId: 'participant', jobId: job.id, prompt: job.prompt, ...extras }),
  })
}

test('the same job survives a browser refresh during a 40-second generation', { timeout: 55_000 }, async (t) => {
  let modelCalls = 0
  const { endpoint, dispatches } = createHarness(async () => {
    modelCalls++
    await wait(40_000)
    return design
  })
  let initialStatus
  const firstPage = new AbortController()
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const result = await endpoint(new Request(new URL(url, baseUrl), init))
    if (init.method === 'POST' && initialStatus === undefined) {
      initialStatus = result.status
      firstPage.abort()
    }
    return result
  })
  const job = { id: crypto.randomUUID(), prompt: 'Design a nature-themed tablet wallpaper.' }
  const started = Date.now()
  await assert.rejects(generateDesign(job, config, 'study', 'participant', firstPage.signal), { name: 'AbortError' })
  assert.equal(initialStatus, 202)
  assert.ok(Date.now() - started < 1000)
  const competing = await endpoint(jobRequest({ ...job, id: crypto.randomUUID() }))
  assert.equal(competing.status, 409)

  const refreshedPage = new AbortController()
  const result = await generateDesign(job, config, 'study', 'participant', refreshedPage.signal)
  assert.deepEqual(result.elements, design.elements)
  assert.equal(result.background, design.background)
  assert.equal(result.record.id, job.id)
  assert.equal(result.successful, 1)
  await Promise.all(dispatches)
  assert.equal(modelCalls, 1)
  assert.equal((await endpoint(jobRequest({ ...job, id: crypto.randomUUID() }))).status, 429)
})

test('dispatch failure resumes the same job and model failure does not consume a successful generation', async (t) => {
  let calls = 0
  const { endpoint, dispatches } = createHarness(async () => {
    if (++calls === 1) throw new Error('Simulated model failure')
    return design
  }, { firstDispatchFails: true })
  t.mock.method(globalThis, 'fetch', (url, init) => endpoint(new Request(new URL(url, baseUrl), init)))
  const job = { id: crypto.randomUUID(), prompt: 'A test design' }
  const signal = new AbortController().signal
  await assert.rejects(generateDesign(job, config, 'study', 'participant', signal),
    (error) => error instanceof GenerationError && !error.terminal)
  await assert.rejects(generateDesign(job, config, 'study', 'participant', signal),
    (error) => error instanceof GenerationError && error.terminal)
  const next = { ...job, id: crypto.randomUUID() }
  const result = await generateDesign(next, config, 'study', 'participant', signal)
  await Promise.all(dispatches)
  assert.equal(result.successful, 1)
  assert.equal(calls, 2)
  assert.equal((await endpoint(jobRequest({ ...job, id: crypto.randomUUID() }, { code: 'preview-study' }))).status, 401)
})
