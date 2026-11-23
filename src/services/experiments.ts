import type { Condition, ExperimentConfig } from '../lib/types'
import { DEFAULT_PALETTE } from '../lib/palette'
import { ALL_SHAPE_TYPES } from '../lib/shapes'

type EditorExperiment = {
  experiment: ExperimentConfig
  published: ExperimentConfig | null
  source: 'draft' | 'published'
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'The experiment service could not be reached.')
  return payload as T
}

const supportedShapes = new Set(ALL_SHAPE_TYPES)
function normalizeExperiment(experiment: ExperimentConfig): ExperimentConfig {
  const allowedShapes = [...new Set((experiment.allowedShapes ?? []).filter((type) => supportedShapes.has(type)))]
  return {
    ...experiment,
    allowedShapes: allowedShapes.length ? allowedShapes : ALL_SHAPE_TYPES,
    palette: DEFAULT_PALETTE,
    allowCustomColors: false,
  }
}

export async function loadExperiment(id: string, view: 'published' | 'editor' = 'published') {
  const response = await fetch(`/api/experiments?id=${encodeURIComponent(id)}&view=${view}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (response.status === 404) return null
  const payload = await readJson<EditorExperiment>(response)
  return {
    ...payload,
    experiment: normalizeExperiment(payload.experiment),
    published: payload.published ? normalizeExperiment(payload.published) : null,
  }
}

export async function loadPublishedExperiments() {
  const response = await fetch('/api/experiments?list=1', {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const payload = await readJson<{ experiments: ExperimentConfig[] }>(response)
  return { experiments: payload.experiments.map(normalizeExperiment) }
}

export async function resolvePublishedLink(code: string) {
  const response = await fetch(`/api/experiments?code=${encodeURIComponent(code)}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (response.status === 404) return null
  const payload = await readJson<{ experiment: ExperimentConfig; condition: Condition }>(response)
  return { ...payload, experiment: normalizeExperiment(payload.experiment) }
}

export async function saveExperiment(experiment: ExperimentConfig, action: 'draft' | 'publish') {
  const normalized = normalizeExperiment(experiment)
  const response = await fetch('/api/experiments', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ experiment: normalized, action }),
  })
  const payload = await readJson<{ experiment: ExperimentConfig; source: 'draft' | 'published' }>(response)
  return { ...payload, experiment: normalizeExperiment(payload.experiment) }
}

export async function researcherLogin(email: string, password: string) {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return readJson<{ authenticated: true }>(response)
}

export async function researcherLogout() {
  await fetch('/api/admin/login', { method: 'DELETE', credentials: 'same-origin' }).catch(() => undefined)
}
