import type { Condition, ExperimentConfig } from '../lib/types'

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

export async function loadExperiment(id: string, view: 'published' | 'editor' = 'published') {
  const response = await fetch(`/api/experiments?id=${encodeURIComponent(id)}&view=${view}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (response.status === 404) return null
  return readJson<EditorExperiment>(response)
}

export async function loadPublishedExperiments() {
  const response = await fetch('/api/experiments?list=1', {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  return readJson<{ experiments: ExperimentConfig[] }>(response)
}

export async function resolvePublishedLink(code: string) {
  const response = await fetch(`/api/experiments?code=${encodeURIComponent(code)}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (response.status === 404) return null
  return readJson<{ experiment: ExperimentConfig; condition: Condition }>(response)
}

export async function saveExperiment(experiment: ExperimentConfig, action: 'draft' | 'publish') {
  const response = await fetch('/api/experiments', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ experiment, action }),
  })
  return readJson<{ experiment: ExperimentConfig; source: 'draft' | 'published' }>(response)
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
