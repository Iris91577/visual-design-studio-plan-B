import { getStore } from '@netlify/blobs'
import { isAdmin } from '../lib/admin-auth.mjs'

const STORE = 'vds-experiments'
const REGION = 'ap-southeast-1'
const store = () => getStore(STORE, { region: REGION })
const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
})
const getJSON = (bucket, key) => bucket.get(key, { type: 'json', consistency: 'strong' })

function validExperiment(value) {
  return Boolean(
    value && typeof value === 'object' && /^[\w-]{1,80}$/.test(value.id) &&
    typeof value.name === 'string' && value.name.trim() &&
    Number.isFinite(value.version) && value.version >= 1 &&
    value.canvas && Number.isFinite(value.canvas.width) && Number.isFinite(value.canvas.height) &&
    /^#[0-9A-Fa-f]{6}$/.test(value.canvas.background) &&
    Array.isArray(value.allowedShapes) && value.allowedShapes.length > 0 &&
    Array.isArray(value.palette) && value.palette.length > 0 &&
    value.links && typeof value.links.human === 'string' && typeof value.links.ai === 'string'
  )
}

async function readByCode(bucket, code) {
  if (!/^[\w-]{1,100}$/.test(code)) return null
  const mapping = await getJSON(bucket, `link:${code}`)
  if (!mapping?.id || !mapping?.condition) return null
  const experiment = await getJSON(bucket, `published:${mapping.id}`)
  return experiment ? { experiment, condition: mapping.condition } : null
}

export default async (request) => {
  const url = new URL(request.url)
  const bucket = store()

  if (request.method === 'GET') {
    if (url.searchParams.get('list') === '1') {
      if (!(await isAdmin(request))) return json({ error: 'Researcher sign-in required.' }, 401)
      const [{ blobs: publishedBlobs }, { blobs: draftBlobs }] = await Promise.all([bucket.list({ prefix: 'published:' }),bucket.list({prefix:'draft:'})])
      const [published,drafts]=await Promise.all([Promise.all(publishedBlobs.map(blob=>getJSON(bucket,blob.key))),Promise.all(draftBlobs.map(blob=>getJSON(bucket,blob.key)))])
      const merged=new Map(published.filter(Boolean).map(exp=>[exp.id,exp]))
      drafts.filter(Boolean).forEach(exp=>merged.set(exp.id,exp))
      const experiments=[...merged.values()].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))
      return json({ experiments })
    }
    const code = url.searchParams.get('code')
    if (code) {
      const resolved = await readByCode(bucket, code)
      return resolved ? json(resolved) : json({ error: 'Experiment link not found.' }, 404)
    }

    const id = url.searchParams.get('id') ?? ''
    if (!/^[\w-]{1,80}$/.test(id)) return json({ error: 'Invalid experiment id.' }, 400)
    const view = url.searchParams.get('view') ?? 'published'
    const published = await getJSON(bucket, `published:${id}`)
    if (view === 'published') return published ? json({ experiment: published }) : json({ error: 'Not found.' }, 404)
    if (!(await isAdmin(request))) return json({ error: 'Researcher sign-in required.' }, 401)
    const draft = await getJSON(bucket, `draft:${id}`)
    return draft || published
      ? json({ experiment: draft ?? published, published, source: draft ? 'draft' : 'published' })
      : json({ error: 'Not found.' }, 404)
  }

  if (request.method !== 'PUT') return json({ error: 'Method not allowed.' }, 405)
  if (!(await isAdmin(request))) return json({ error: 'Researcher sign-in required.' }, 401)
  const body = await request.json().catch(() => ({}))
  const action = body.action
  const experiment = body.experiment
  if (!['draft', 'publish'].includes(action) || !validExperiment(experiment)) {
    return json({ error: 'Invalid experiment configuration.' }, 400)
  }

  const now = new Date().toISOString()
  if (action === 'draft') {
    const draft = { ...experiment, updatedAt: now }
    await bucket.setJSON(`draft:${draft.id}`, draft)
    return json({ experiment: draft, source: 'draft' })
  }

  const published = { ...experiment, status: 'published', updatedAt: now }
  await Promise.all([
    bucket.setJSON(`published:${published.id}`, published),
    bucket.setJSON(`version:${published.id}:${published.version}`, published),
    bucket.setJSON(`link:${published.links.human}`, { id: published.id, condition: 'human' }),
    bucket.setJSON(`link:${published.links.ai}`, { id: published.id, condition: 'ai' }),
    bucket.delete(`draft:${published.id}`),
  ])
  return json({ experiment: published, source: 'published' })
}
