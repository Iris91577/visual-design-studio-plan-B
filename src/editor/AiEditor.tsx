import type React from 'react'
import { useEffect, useEffectEvent, useState } from 'react'
import { CircleAlert, LayoutGrid, LoaderCircle, Sparkles } from 'lucide-react'
import { Button, useToast } from '../components/ui'
import { computeComplexity } from '../lib/complexity'
import { designToPng } from '../lib/render'
import type { ExperimentConfig } from '../lib/types'
import { generateDesign, GenerationError, type GenerationJob } from '../services/ai'
import { loadDraft, saveDraft, submitDesign, type Draft, type Submission } from '../services/session'
import { DesignCanvas } from './DesignCanvas'
import { EditorShell, RailItem } from './EditorShell'
import { ElementsPanel } from './ElementsPanel'
import { SubmitDialog } from './SubmitFlow'

export function AiEditor({ config, linkCode, participantId, onSubmitted, headerBadge }: {
  config: ExperimentConfig
  linkCode: string
  participantId: string
  onSubmitted: (submission: Submission) => void
  headerBadge?: React.ReactNode
}) {
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>(() => loadDraft(linkCode, participantId) ?? {
    elements: [],
    background: config.canvas.background,
    log: [],
    startedAt: new Date().toISOString(),
  })
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const { elements, background, pendingGeneration } = draft
  const prompt = draft.prompt ?? ''
  const used = draft.generationsUsed ?? 0
  const preview = linkCode.startsWith('preview-')
  const left = Math.max(0, config.aiGenerationLimit - used)
  const generating = Boolean(pendingGeneration && !error)
  const metrics = computeComplexity(elements, config.canvas.width, config.canvas.height)

  function persist(next: Draft) {
    saveDraft(linkCode, participantId, next)
    setDraft(next)
  }

  const onResult = useEffectEvent((job: GenerationJob, result: Awaited<ReturnType<typeof generateDesign>>) => {
    if (draft.pendingGeneration?.id !== job.id) return
    const records = (draft.aiGenerations ?? []).filter((record) => record.id !== job.id)
    persist({
      ...draft,
      elements: result.elements,
      background: result.background,
      generationsUsed: preview ? used + 1 : result.successful,
      aiGenerations: [...records, result.record],
      pendingGeneration: undefined,
    })
    setError(null)
  })

  const onGenerationError = useEffectEvent((job: GenerationJob, failure: unknown) => {
    if (draft.pendingGeneration?.id !== job.id) return
    if (failure instanceof GenerationError && failure.terminal) {
      persist({ ...draft, pendingGeneration: undefined })
    }
    setError(failure instanceof GenerationError ? failure.message : 'Could not reach the design service. Resume to reconnect.')
  })

  useEffect(() => {
    if (!pendingGeneration) return
    const controller = new AbortController()
    generateDesign(pendingGeneration, config, linkCode, participantId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) onResult(pendingGeneration, result)
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) onGenerationError(pendingGeneration, failure)
      })
    return () => controller.abort()
  }, [pendingGeneration, attempt, config, linkCode, participantId])

  function generate() {
    if (generating) return
    if (pendingGeneration) {
      setError(null)
      setAttempt((value) => value + 1)
      return
    }
    if (!prompt.trim() || (!preview && left === 0)) return
    setError(null)
    persist({ ...draft, pendingGeneration: { id: crypto.randomUUID(), prompt: prompt.trim() } })
  }

  async function doSubmit() {
    setBusy(true)
    try {
      const png = await designToPng(config.canvas.width, config.canvas.height, background, elements)
      onSubmitted(await submitDesign(linkCode, participantId, png, {
        config, startedAt: draft.startedAt, elements, background, actionLog: [],
        prompt: draft.aiGenerations?.at(-1)?.prompt ?? prompt,
        generationsUsed: used, aiGenerations: draft.aiGenerations,
      }))
    } catch (failure) {
      toast(failure instanceof Error ? `Could not submit: ${failure.message}` : 'Could not submit.', 'error')
      setBusy(false)
    }
  }

  const banner = elements.length ? 'GPT designed this composition with the shared element library.' : 'Describe your design, then click Generate.'
  return (
    <>
      <EditorShell
        onSubmit={() => setSubmitOpen(true)}
        submitDisabled={!elements.length || Boolean(pendingGeneration)}
        headerLeft={headerBadge}
        headerRight={<span className="text-[12.5px] font-semibold text-slate-400">{preview ? 'Researcher preview' : `${left} generation${left === 1 ? '' : 's'} left`}</span>}
        rail={<RailItem icon={<LayoutGrid className="size-5" />} label="Elements" active />}
        panel={<ElementsPanel config={config} readOnly />}
        toolbar={<span className="flex items-center gap-2 px-2 text-[13px] text-slate-400"><Sparkles className="size-4 text-brand-500" />{banner}</span>}
        canvas={<DesignCanvas width={config.canvas.width} height={config.canvas.height} background={background} elements={elements}
          overlay={generating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-[1px]" role="status">
              <LoaderCircle className="size-8 animate-spin text-brand-600" />
              <span className="text-sm font-semibold">Generating your design…</span>
            </div>
          ) : undefined}
        />}
        rightPanel={
          <div className="flex flex-col gap-5 p-5">
            <div>
              <label htmlFor="vds-prompt" className="text-[15px] font-bold">Describe Your Design</label>
              <p className="mt-1 text-[12.5px] text-slate-500">English or Chinese both work.</p>
              <textarea id="vds-prompt" value={prompt} onChange={(event) => persist({ ...draft, prompt: event.target.value })}
                disabled={Boolean(pendingGeneration) || (!preview && left === 0)} rows={9} maxLength={4000}
                placeholder="Enter your design instructions here..."
                className="mt-3 w-full resize-none rounded-xl bg-slate-50 p-3.5 text-sm ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
              />
              <div className="mt-1 text-right font-mono text-[11px] text-slate-400">{prompt.length} / 4000</div>
              <Button variant="primary" size="lg" className="mt-2 w-full" onClick={generate}
                disabled={generating || (!pendingGeneration && (!prompt.trim() || (!preview && left === 0)))}>
                {generating ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {generating ? 'Generating…' : pendingGeneration ? 'Resume generation' : 'Generate'}
              </Button>
            </div>
            {error && (
              <div role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                <CircleAlert className="size-4 shrink-0" />
                <div><b>{pendingGeneration ? 'Connection interrupted' : 'Generation failed'}</b><div>{error}</div></div>
              </div>
            )}
            {elements.length > 0 && (
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-200">
                <div className="mb-2 font-bold uppercase tracking-wide text-slate-400">Recorded design measures</div>
                <div className="grid grid-cols-2 gap-2">
                  <span>Elements <b>{metrics.elementCount}</b></span>
                  <span>Shape types <b>{metrics.distinctShapeTypes}</b></span>
                  <span>Colours <b>{metrics.distinctColors}</b></span>
                </div>
                <p className="mt-2 text-slate-400">Generated by {draft.aiGenerations?.at(-1)?.model ?? config.ai.model}</p>
              </div>
            )}
          </div>
        }
      />
      <SubmitDialog open={submitOpen} onClose={() => setSubmitOpen(false)} onConfirm={doSubmit} busy={busy} elementCount={elements.length} />
    </>
  )
}
