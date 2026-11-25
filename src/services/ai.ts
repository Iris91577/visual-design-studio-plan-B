import type { AiGenerationRecord, DesignElement, ExperimentConfig } from '../lib/types'

export interface GenerationJob {
  id: string
  prompt: string
}

interface DesignResult {
  background: string
  elements: DesignElement[]
  model: string
  requestedAt: string
  respondedAt: string
  rawOutput: string
  retries: number
  validation: AiGenerationRecord['validation']
}

type JobResponse =
  | { status: 'pending' }
  | { status: 'done'; result: DesignResult; successful: number }
  | { status: 'failed'; error: string }

export class GenerationError extends Error {
  readonly terminal: boolean

  constructor(message: string, terminal: boolean) {
    super(message)
    this.terminal = terminal
  }
}

const endpoint = '/.netlify/functions/generate'
const POLL_LIMIT_MS = 9 * 60_000

async function readJob(response: Response): Promise<JobResponse> {
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const terminal = data?.recoverable !== true && [400, 401, 403, 404, 409, 429].includes(response.status)
    throw new GenerationError(data?.error || 'Could not check generation. Resume to try connecting again.', terminal)
  }
  if (data?.status === 'failed') throw new GenerationError(data.error, true)
  if (data?.status === 'pending' || data?.status === 'done') return data
  throw new GenerationError('The generation service returned an unexpected response.', false)
}

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export async function generateDesign(
  job: GenerationJob,
  config: ExperimentConfig,
  code: string,
  participantId: string,
  signal: AbortSignal,
) {
  const identity = { code, participantId, jobId: job.id }
  let state = await readJob(await fetch(endpoint, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...identity,
      prompt: job.prompt,
      previewConfig: code.startsWith('preview-') ? config : undefined,
    }),
    signal,
  }))
  const deadline = Date.now() + POLL_LIMIT_MS
  const statusUrl = `${endpoint}?${new URLSearchParams(identity)}`
  let failedChecks = 0
  while (state.status === 'pending' && Date.now() < deadline) {
    await delay(failedChecks ? 6000 : 3000, signal)
    try {
      state = await readJob(await fetch(statusUrl, { credentials: 'same-origin', signal }))
      failedChecks = 0
    } catch (error) {
      if (signal.aborted || (error instanceof GenerationError && error.terminal) || ++failedChecks >= 3) throw error
    }
  }
  if (state.status !== 'done') throw new GenerationError('Could not check the final result. Resume to reconnect.', false)
  const { result, successful } = state
  if (!result?.elements?.length || !result.background) throw new GenerationError('The AI did not return a complete design.', true)
  const record: AiGenerationRecord = {
    id: job.id,
    prompt: job.prompt,
    method: 'structured',
    model: result.model,
    modelVersion: result.model,
    parameters: { responseFormat: 'json_schema', sampling: 'provider_default' },
    requestedAt: result.requestedAt,
    respondedAt: result.respondedAt,
    success: true,
    failureReason: null,
    retries: result.retries,
    rawOutput: result.rawOutput,
    validation: result.validation,
  }
  return { elements: result.elements, background: result.background, successful, record }
}
