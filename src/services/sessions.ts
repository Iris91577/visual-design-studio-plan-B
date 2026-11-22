import type { ParticipantSession } from '../lib/types'

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'The participant data service could not be reached.')
  return payload as T
}

export async function loadSessions() {
  const response = await fetch('/api/sessions?list=1', { credentials: 'same-origin', cache: 'no-store' })
  return readJson<{ sessions: ParticipantSession[] }>(response)
}

export async function loadSession(id: string) {
  const response = await fetch(`/api/sessions?id=${encodeURIComponent(id)}`, { credentials: 'same-origin', cache: 'no-store' })
  if (response.status === 404) return null
  return readJson<{ session: ParticipantSession }>(response)
}
