import { completionCode, uid } from '../lib/ids'
import type { ActionLogEntry, AiGenerationRecord, DesignElement, ExperimentConfig } from '../lib/types'
import type { GenerationJob } from './ai'

/** Drafts remain in the participant's browser for refresh recovery. Final PNGs,
 * immutable experiment snapshots and submission metadata are stored by the
 * Netlify sessions Function in Netlify Blobs. */
const key = (code: string, pid: string, kind: string) => `vds:${kind}:${code}:${pid}`

export function resolveParticipantId(code: string, fromUrl: string | null): string {
  if (fromUrl && /^[\w\-.]{1,80}$/.test(fromUrl)) return fromUrl
  const k = `vds:anon:${code}`
  const existing = localStorage.getItem(k)
  if (existing) return existing
  const id = uid('anon')
  localStorage.setItem(k, id)
  return id
}

export interface Draft {
  elements: DesignElement[]
  background: string
  log: ActionLogEntry[]
  startedAt: string
  prompt?: string
  generationsUsed?: number
  aiGenerations?: AiGenerationRecord[]
  pendingGeneration?: GenerationJob
}

export function loadDraft(code: string, pid: string): Draft | null {
  try {
    const raw = localStorage.getItem(key(code, pid, 'draft'))
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

export function saveDraft(code: string, pid: string, draft: Draft) {
  try {
    localStorage.setItem(key(code, pid, 'draft'), JSON.stringify(draft))
  } catch {
    /* storage full or disabled — the editor keeps working in memory */
  }
}

export interface Submission { code: string; submittedAt: string; pngDataUrl: string }

export interface SubmissionMetadata {
  config: ExperimentConfig
  startedAt: string
  elements: DesignElement[]
  background: string
  actionLog: ActionLogEntry[]
  prompt?: string
  generationsUsed?: number
  aiGenerations?: AiGenerationRecord[]
}

export function getSubmission(code: string, pid: string): Submission | null {
  try {
    const raw = localStorage.getItem(key(code, pid, 'done'))
    return raw ? (JSON.parse(raw) as Submission) : null
  } catch {
    return null
  }
}

export async function submitDesign(code: string, pid: string, png: Blob, metadata: SubmissionMetadata): Promise<Submission> {
  const existing = getSubmission(code, pid)
  if (existing) return existing // idempotent: never create a second record
  const pngDataUrl = await new Promise<string>((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.readAsDataURL(png)
  })
  let sub: Submission
  if (code.startsWith('preview-')) {
    sub = { code: completionCode(), submittedAt: new Date().toISOString(), pngDataUrl }
  } else {
    const form = new FormData()
    form.set('code', code)
    form.set('pid', pid)
    form.set('metadata', JSON.stringify(metadata))
    form.set('design', png, 'design.png')
    const response = await fetch('/api/sessions', { method: 'POST', body: form, credentials: 'same-origin' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'The submission server could not be reached')
    sub = { code: payload.code, submittedAt: payload.submittedAt, pngDataUrl }
  }
  try {
    localStorage.setItem(key(code, pid, 'done'), JSON.stringify(sub))
  } catch {
    localStorage.setItem(key(code, pid, 'done'), JSON.stringify({ ...sub, pngDataUrl: '' }))
  }
  return sub
}
