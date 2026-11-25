import type React from 'react'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Eye, RotateCcw } from 'lucide-react'
import { Logo } from '../components/ui'
import { AiEditor } from '../editor/AiEditor'
import { HumanEditor } from '../editor/HumanEditor'
import { CompletionScreen } from '../editor/SubmitFlow'
import type { Condition, ExperimentConfig } from '../lib/types'
import { getSubmission, resolveParticipantId, type Submission } from '../services/session'
import { loadExperiment, resolvePublishedLink } from '../services/experiments'

function ParticipantView({ config, condition, code, pid, badge, extra }: {
  config: ExperimentConfig; condition: Condition; code: string; pid: string; badge?: React.ReactNode; extra?: React.ReactNode
}) {
  const [submission, setSubmission] = useState<Submission | null>(() => getSubmission(code, pid))
  if (submission) return <>{<CompletionScreen submission={submission} returnUrl={config.returnUrl} participantId={pid} />}{extra}</>
  const Editor = condition === 'human' ? HumanEditor : AiEditor
  return <Editor config={config} linkCode={code} participantId={pid} onSubmitted={setSubmission} headerBadge={badge} />
}

/** Participant entry: /s/:code?pid=<survey response id>. The link code fixes experiment and condition. */
export function ParticipantEntry() {
  const { code = '' } = useParams()
  const [params] = useSearchParams()
  const [resolved, setResolved] = useState<Awaited<ReturnType<typeof resolvePublishedLink>> | undefined>(undefined)
  useEffect(() => {
    let active = true
    resolvePublishedLink(code)
      .then((remote) => { if (active) setResolved(remote) })
      .catch(() => { if (active) setResolved(null) })
    return () => { active = false }
  }, [code])
  if (resolved === undefined) return <Loading />
  if (!resolved) return <Notice title="This link isn’t valid" body="Please return to the survey and open the design link again." />
  if (resolved.experiment.status !== 'published')
    return <Notice title="This study isn’t open yet" body="Please return to the survey and contact the research team." />
  const pid = resolveParticipantId(code, params.get('pid'))
  return <ParticipantView key={JSON.stringify([code, pid])} config={resolved.experiment} condition={resolved.condition} code={code} pid={pid} />
}

/** Researcher preview of an experiment: /demo/:condition?exp=exp-01 */
export function ResearcherPreview() {
  const { condition = 'human' } = useParams()
  const [params] = useSearchParams()
  const experimentId = params.get('exp') ?? 'exp-01'
  const [config, setConfig] = useState<ExperimentConfig | null | undefined>(undefined)
  useEffect(() => {
    let active = true
    // Do not render the bundled fallback while the saved draft is loading.
    // Showing it first causes the old experiment settings to flash on screen.
    setConfig(undefined)
    loadExperiment(experimentId, 'editor')
      .then((remote) => { if (active) setConfig(remote?.experiment ?? null) })
      .catch(() => { if (active) setConfig(null) })
    return () => { active = false }
  }, [experimentId])
  if (config === undefined) return <Loading />
  if (config === null) return <Notice title="Preview not found" body="Save this experiment in the researcher console, then open its preview again." />
  const mode: Condition = condition === 'ai' ? 'ai' : 'human'
  const code = `preview-${config.id}-${config.version}-${config.updatedAt}-${mode}`
  const reset = () => {
    Object.keys(localStorage).filter((k) => k.includes(code)).forEach((k) => localStorage.removeItem(k))
    window.location.reload()
  }
  const badge = (
    <span className="ml-2 inline-flex items-center gap-2 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[12px] font-semibold text-violet-700">
      <Eye className="size-3.5" /> Preview · {mode === 'human' ? 'Human Design' : 'AI Design'} · {config.name}
      <button onClick={reset} title="Start over" className="ml-1 rounded p-0.5 hover:bg-violet-100"><RotateCcw className="size-3.5" /></button>
    </span>
  )
  const extra = (
    <button onClick={reset} className="fixed left-4 top-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[13px] font-semibold text-slate-600 shadow ring-1 ring-slate-200 hover:bg-slate-50">
      <RotateCcw className="size-3.5" /> Start preview over
    </button>
  )
  return <ParticipantView key={code} config={config} condition={mode} code={code} pid="researcher-preview" badge={badge} extra={extra} />
}

function Loading() {
  return <div className="dot-grid flex min-h-screen items-center justify-center bg-workspace text-sm font-semibold text-slate-500">Loading experiment…</div>
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="dot-grid flex min-h-screen items-center justify-center bg-workspace p-6">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-xl ring-1 ring-slate-200">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-6 text-xl font-bold">{title}</h1>
        <p className="mt-2 text-slate-600">{body}</p>
        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-brand-600 hover:underline">Visual Design Studio</Link>
      </div>
    </div>
  )
}
