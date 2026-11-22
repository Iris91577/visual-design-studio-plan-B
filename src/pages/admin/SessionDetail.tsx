import type React from 'react'
import { Fragment, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CircleAlert, CircleCheck, Download, FileDown } from 'lucide-react'
import { Badge, Button, Card } from '../../components/ui'
import { DesignPreview } from '../../editor/ShapeSvg'
import { METHOD_LABELS } from '../../lib/aiModels'
import { computeComplexity } from '../../lib/complexity'
import { presetLabel } from '../../lib/canvasPresets'
import { durationSec } from '../../lib/exportCsv'
import { downloadBlob } from '../../lib/render'
import { SHAPE_MAP } from '../../lib/shapes'
import type { ActionLogEntry, ParticipantSession } from '../../lib/types'
import { loadSession } from '../../services/sessions'
import { PageHeader } from './AdminLayout'
import { fmtDur, fmtTime, sessionTone } from './Sessions'

export function SessionDetail() {
  const { id = '' } = useParams()
  const [s, setSession] = useState<ParticipantSession | null | undefined>(undefined)
  const [tab, setTab] = useState<'log' | 'ai' | 'json'>('log')
  useEffect(() => {
    let active = true
    loadSession(id).then((result) => {
      if (!active) return
      setSession(result?.session ?? null)
      if (result?.session.condition === 'ai') setTab('ai')
    }).catch(() => { if (active) setSession(null) })
    return () => { active = false }
  }, [id])
  if (s === undefined) return <div className="p-8 text-sm text-slate-500">Loading participant submission…</div>
  const exp = s?.experiment
  if (!s || !exp) return <div className="p-8">Session not found. <Link className="text-brand-600" to="/admin/sessions">Back</Link></div>

  const { width: W, height: H } = exp.canvas
  const complexity=computeComplexity(s.elements,W,H)
  const downloadPng = async () => {
    if (!s.imageUrl) return
    const response = await fetch(s.imageUrl, { credentials: 'same-origin' })
    if (!response.ok) throw new Error('Could not download the submitted design.')
    downloadBlob(await response.blob(), `${s.participantId}_${s.condition}.png`)
  }
  const downloadJson = () =>
    downloadBlob(new Blob([JSON.stringify({ canvas: { width: W, height: H, background: s.background }, elements: s.elements }, null, 2)], { type: 'application/json' }), `${s.participantId}_${s.condition}.json`)

  const meta: [string, React.ReactNode][] = [
    ['Participant ID', <span className="font-mono">{s.participantId}</span>],
    ['Condition', s.condition === 'human' ? 'Human Design' : 'AI Design'],
    ['Experiment', `${exp.name} · v${s.experimentVersion}`],
    ['Canvas', presetLabel(exp.canvas.presetId, W, H)],
    ['Start time', fmtTime(s.startedAt)],
    ['Submission time', fmtTime(s.submittedAt)],
    ['Total duration', fmtDur(durationSec(s))],
    ['Completion code', s.completionCode ? <span className="font-mono">{s.completionCode}</span> : '—'],
    ['Elements', s.elements.length],
    ['Shape types', complexity.distinctShapeTypes],
    ['Colours', complexity.distinctColors],
  ]

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-3"><Link to="/admin/sessions" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft className="size-5" /></Link><span className="font-mono text-xl">{s.participantId}</span></span>}
        subtitle={<Badge tone={sessionTone[s.status]}>{s.status.replace('_', ' ')}</Badge>}
        actions={s.imageUrl && (
          <>
            <Button onClick={downloadJson}><FileDown className="size-4" /> Design JSON</Button>
            <Button variant="primary" onClick={downloadPng}><Download className="size-4" /> PNG {W}×{H}</Button>
          </>
        )}
      />
      <div className="grid gap-6 p-8 xl:grid-cols-[440px_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card className="p-4">
            <div className="flex h-[400px] items-center justify-center rounded-lg bg-workspace p-4">
              {s.imageUrl ? <img src={s.imageUrl} alt="Submitted design" className="h-full max-w-full object-contain shadow-md" /> : s.elements.length ? <DesignPreview width={W} height={H} background={s.background} elements={s.elements} className="h-full max-w-full shadow-md" />
                : <span className="text-sm text-slate-400">No final design</span>}
            </div>
          </Card>
          <Card className="p-5">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-[13px]">
              {meta.map(([k, v]) => (<Fragment key={k}><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium text-slate-800">{v}</dd></Fragment>))}
            </dl>
          </Card>
        </div>

        <Card className="min-w-0">
          <div className="flex gap-1 border-b border-slate-200 px-4 pt-3">
            {([['log', `Action log (${s.actionLog.length})`], ['ai', `AI generations (${s.aiGenerations.length})`], ['json', 'Design parameters']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 pb-2.5 text-[13px] font-semibold ${tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{label}</button>
            ))}
          </div>
          <div className="p-4">
            {tab === 'log' && <ActionLog entries={s.actionLog} condition={s.condition} />}
            {tab === 'ai' && (
              s.aiGenerations.length === 0 ? <Empty text={s.condition === 'human' ? 'Human Design sessions cannot use AI generation.' : 'No generations yet.'} /> :
              <div className="flex flex-col gap-4">
                {s.aiGenerations.map((g) => (
                  <div key={g.id} className="rounded-xl ring-1 ring-slate-200">
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
                      {g.success ? <Badge tone="green"><CircleCheck className="size-3" /> Success</Badge> : <Badge tone="red"><CircleAlert className="size-3" /> Failed</Badge>}
                      <Badge tone="violet">{METHOD_LABELS[g.method]}</Badge>
                      <span className="font-mono text-[12px] text-slate-500">{g.model} · {g.modelVersion}</span>
                      <span className="ml-auto text-[12px] text-slate-400">{g.retries} retr{g.retries === 1 ? 'y' : 'ies'}</span>
                    </div>
                    <div className="grid gap-4 p-4">
                      <div>
                        <div className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-slate-400">Prompt (as typed)</div>
                        <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[14px] leading-relaxed ring-1 ring-slate-200">{g.prompt}</p>
                      </div>
                      <dl className="grid grid-cols-2 gap-3 text-[12.5px] md:grid-cols-4">
                        <div><dt className="text-slate-400">Requested</dt><dd className="font-mono">{g.requestedAt.slice(11, 23)}</dd></div>
                        <div><dt className="text-slate-400">Responded</dt><dd className="font-mono">{g.respondedAt?.slice(11, 23) ?? '—'}</dd></div>
                        <div><dt className="text-slate-400">Latency</dt><dd className="font-mono">{g.respondedAt ? `${((new Date(g.respondedAt).getTime() - new Date(g.requestedAt).getTime()) / 1000).toFixed(1)}s` : '—'}</dd></div>
                        <div><dt className="text-slate-400">Parameters</dt><dd className="font-mono">{JSON.stringify(g.parameters)}</dd></div>
                      </dl>
                      {g.failureReason && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800">{g.failureReason}</p>}
                      {g.validation.issues.length > 0 && (
                        <ul className="rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">{g.validation.issues.map((i) => <li key={i}>• {i}</li>)}</ul>
                      )}
                      {g.rawOutput && (
                        <details>
                          <summary className="cursor-pointer text-[12.5px] font-semibold text-slate-600">Raw model output (unmodified)</summary>
                          <pre className="scrollbar-thin mt-2 max-h-80 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-[11.5px] leading-relaxed text-slate-200">{g.rawOutput}</pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tab === 'json' && (
              <pre className="scrollbar-thin max-h-[560px] overflow-auto rounded-lg bg-slate-900 p-4 font-mono text-[11.5px] leading-relaxed text-slate-200">
                {JSON.stringify({ canvas: { width: W, height: H, background: s.background }, elements: s.elements }, null, 2)}
              </pre>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}

const ACTION_TONE: Record<ActionLogEntry['action'], 'blue' | 'green' | 'red' | 'amber' | 'slate' | 'violet'> = {
  add: 'green', duplicate: 'green', delete: 'red', move: 'blue', resize: 'blue', rotate: 'blue', color: 'violet',
  undo: 'amber', redo: 'amber', bring_forward: 'slate', send_backward: 'slate', background: 'violet', submit: 'green',
}

function ActionLog({ entries, condition }: { entries: ActionLogEntry[]; condition: string }) {
  if (!entries.length) return <Empty text={condition === 'ai' ? 'AI Design sessions have no manual editing actions.' : 'No actions recorded yet.'} />
  return (
    <div className="scrollbar-thin max-h-[640px] overflow-auto">
      <table className="w-full text-left text-[12.5px]">
        <thead className="sticky top-0 bg-white text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">
          <tr><th className="py-2 pr-3">Time</th><th className="py-2 pr-3">+Elapsed</th><th className="py-2 pr-3">Action</th><th className="py-2 pr-3">Element</th><th className="py-2 pr-3">Details</th><th className="py-2 text-right">Count</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map((e, i) => (
            <tr key={i}>
              <td className="py-2 pr-3 font-mono text-slate-500">{e.at.slice(11, 19)}</td>
              <td className="py-2 pr-3 font-mono text-slate-400">{fmtDur(Math.round(e.elapsedMs / 1000))}</td>
              <td className="py-2 pr-3"><Badge tone={ACTION_TONE[e.action]}>{e.action.replace('_', ' ')}</Badge></td>
              <td className="py-2 pr-3 text-slate-600">{e.shape ? SHAPE_MAP[e.shape].name : '—'} {e.elementId && <span className="font-mono text-[11px] text-slate-400">{e.elementId}</span>}</td>
              <td className="max-w-[320px] truncate py-2 pr-3 font-mono text-[11.5px] text-slate-500" title={e.params ? JSON.stringify(e.params) : ''}>{e.params ? JSON.stringify(e.params) : ''}</td>
              <td className="py-2 text-right font-mono text-slate-500">{e.elementCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="py-16 text-center text-sm text-slate-400">{text}</div>
}
