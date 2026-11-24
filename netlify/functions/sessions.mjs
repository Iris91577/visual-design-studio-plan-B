import { getStore } from '@netlify/blobs'
import { isAdmin } from '../lib/admin-auth.mjs'
import { fixedPalette, supportedColour, supportedShapes } from '../lib/design-resources.mjs'

const REGION = 'ap-southeast-1'
const sessions = () => getStore('vds-sessions', { region: REGION })
const experiments = () => getStore('vds-experiments', { region: REGION })
const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
})
const getJSON = (store, key) => store.get(key, { type: 'json', consistency: 'strong' })

function safeId(value, max = 100) {
  return typeof value === 'string' && value.length > 0 && value.length <= max && /^[\w.-]+$/.test(value)
}

async function stableSessionId(code, pid) {
  const bytes = new TextEncoder().encode(`${code}\0${pid}`)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return `ses_${[...new Uint8Array(hash)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

function completionCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const part = (start) => [...bytes.slice(start, start + 4)].map((b) => alphabet[b % alphabet.length]).join('')
  return `VDS-${part(0)}-${part(4)}`
}

async function resolveLink(code) {
  const bucket = experiments()
  const mapping = await getJSON(bucket, `link:${code}`)
  if (!mapping?.id || !['human', 'ai'].includes(mapping.condition)) return null
  const experiment = await getJSON(bucket, `published:${mapping.id}`)
  return experiment ? { experiment, condition: mapping.condition } : null
}

function publicSession(record) {
  const { pngKey: _pngKey, ...safe } = record
  return { ...safe, imageUrl: `/api/sessions?id=${encodeURIComponent(record.id)}&image=1` }
}

export default async (request) => {
  const url = new URL(request.url)
  const bucket = sessions()

  if (request.method === 'GET') {
    if (!(await isAdmin(request))) return json({ error: 'Researcher sign-in required.' }, 401)
    const id = url.searchParams.get('id') ?? ''
    if (url.searchParams.get('image') === '1') {
      if (!safeId(id, 80)) return json({ error: 'Invalid session id.' }, 400)
      const record = await getJSON(bucket, `session:${id}`)
      if (!record?.pngKey) return json({ error: 'Design not found.' }, 404)
      const image = await bucket.get(record.pngKey, { type: 'blob', consistency: 'strong' })
      if (!image) return json({ error: 'Design not found.' }, 404)
      return new Response(image, {
        headers: {
          'content-type': record.imageType || 'image/png',
          'content-disposition': `inline; filename="${record.participantId}_${record.condition}.png"`,
          'cache-control': 'private, max-age=60',
          'x-content-type-options': 'nosniff',
        },
      })
    }
    if (url.searchParams.get('list') === '1') {
      const { blobs } = await bucket.list({ prefix: 'session:' })
      const records = (await Promise.all(blobs.map((blob) => getJSON(bucket, blob.key)))).filter(Boolean)
      records.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))
      return json({ sessions: records.map(publicSession) })
    }
    if (!safeId(id, 80)) return json({ error: 'Invalid session id.' }, 400)
    const record = await getJSON(bucket, `session:${id}`)
    return record ? json({ session: publicSession(record) }) : json({ error: 'Session not found.' }, 404)
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  let form
  try { form = await request.formData() } catch { return json({ error: 'Invalid submission.' }, 400) }
  const code = form.get('code')
  const pid = form.get('pid')
  const file = form.get('design')
  if (!safeId(code) || !safeId(pid, 80) || !(file instanceof Blob)) return json({ error: 'Invalid submission.' }, 400)
  if (file.size === 0 || file.size > 8 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return json({ error: 'The submitted image is invalid or larger than 8 MB.' }, 413)
  }
  let metadata = {}
  try { metadata = JSON.parse(String(form.get('metadata') || '{}')) } catch { return json({ error: 'Invalid submission metadata.' }, 400) }
  // Published server state is the only authority for study links and rules.
  const resolved = await resolveLink(code)
  if (!resolved) return json({ error: 'This study link is no longer valid.' }, 404)
  const experiment = {
    ...resolved.experiment,
    allowedShapes: supportedShapes(resolved.experiment.allowedShapes),
    palette: fixedPalette(),
    allowCustomColors: false,
  }
  const id = await stableSessionId(code, pid)
  const existing = await getJSON(bucket, `session:${id}`)
  if (existing?.status === 'submitted') return json({ code: existing.completionCode, submittedAt: existing.submittedAt, id })

  const now = new Date().toISOString()
  const started = new Date(metadata.startedAt)
  const startedAt = Number.isFinite(started.getTime()) && started.getTime() <= Date.now() ? started.toISOString() : now
  const allowedShapes = new Set(experiment.allowedShapes)
  const submittedElements = Array.isArray(metadata.elements) ? metadata.elements.slice(0, 500) : []
  if (submittedElements.some((element) => !allowedShapes.has(element?.type) || !supportedColour(element?.fill))) {
    return json({ error: 'The submitted design contains an unsupported element or colour.' }, 400)
  }
  const elements = submittedElements.map((element) => ({ ...element, fill: element.fill.toUpperCase() }))
  const background = typeof metadata.background === 'string' ? metadata.background.toUpperCase() : String(experiment.canvas.background).toUpperCase()
  const allowedBackgrounds = experiment.allowBackgroundChange
    ? new Set(experiment.palette.map((colour) => colour.hex.toUpperCase()))
    : new Set([String(experiment.canvas.background).toUpperCase()])
  if (!allowedBackgrounds.has(background)) return json({ error: 'The submitted design contains an unsupported background colour.' }, 400)
  const actionLog = Array.isArray(metadata.actionLog) ? metadata.actionLog.slice(-3000) : []
  const imageKey = `image:${id}`
  const submittedGenerations = Array.isArray(metadata.aiGenerations) ? metadata.aiGenerations.slice(-10) : []
  const aiGenerations = resolved.condition === 'ai' && submittedGenerations.length ? submittedGenerations : resolved.condition === 'ai' && typeof metadata.prompt === 'string' ? [{
    id: `gen_${id.slice(4)}`,
    prompt: metadata.prompt.slice(0, 4000),
    method: experiment.ai.method,
    model: experiment.ai.model,
    modelVersion: experiment.ai.model,
    parameters: { responseFormat: 'json_schema', sampling: 'provider_default' },
    requestedAt: startedAt,
    respondedAt: now,
    success: true,
    failureReason: null,
    retries: 0,
    rawOutput: '',
    validation: { passed: true, issues: [] },
  }] : []
  const record = {
    id,
    participantId: pid,
    experimentId: experiment.id,
    experimentVersion: experiment.version,
    condition: resolved.condition,
    startedAt,
    submittedAt: now,
    status: 'submitted',
    completionCode: completionCode(),
    elements,
    background,
    actionLog,
    aiGenerations,
    experiment,
    pngKey: imageKey,
    imageType: file.type,
  }
  await bucket.set(imageKey, file, { metadata: { participantId: pid, condition: resolved.condition } })
  await bucket.setJSON(`session:${id}`, record)
  return json({ code: record.completionCode, submittedAt: now, id }, 201)
}
