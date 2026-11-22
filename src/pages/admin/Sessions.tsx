import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileDown, Hand, Sparkles } from 'lucide-react'
import { Badge, Button, Card } from '../../components/ui'
import { DesignPreview } from '../../editor/ShapeSvg'
import { presetLabel } from '../../lib/canvasPresets'
import { durationSec, sessionsToCsv } from '../../lib/exportCsv'
import { downloadBlob } from '../../lib/render'
import type { ParticipantSession } from '../../lib/types'
import { loadSessions } from '../../services/sessions'
import { PageHeader } from './AdminLayout'

export const sessionTone = { submitted: 'green', in_progress: 'blue', abandoned: 'slate' } as const
export const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—')
export const fmtDur = (s: number | null) => (s === null ? '—' : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`)

export function SessionsPage() {
  const [exp, setExp] = useState('all')
  const [cond, setCond] = useState<'all' | 'human' | 'ai'>('all')
  const [sessions, setSessions] = useState<ParticipantSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    loadSessions()
      .then(({ sessions: remote }) => { if (active) setSessions(remote) })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Could not load participants.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const experimentOptions = useMemo(() => {
    const map = new Map(sessions.flatMap((s) => s.experiment ? [[s.experiment.id, s.experiment.name] as const] : []))
    return [...map.entries()]
  }, [sessions])
  const rows = useMemo(
    () => sessions.filter((s) => (exp === 'all' || s.experimentId === exp) && (cond === 'all' || s.condition === cond)),
    [sessions, exp, cond],
  )
  const exportCsv = () =>
    downloadBlob(new Blob([sessionsToCsv(rows, rows.flatMap((s) => s.experiment ? [s.experiment] : []))], { type: 'text/csv;charset=utf-8' }), `vds-sessions-${new Date().toISOString().slice(0, 10)}.csv`)

  return (
    <>
      <PageHeader
        title="Participants"
        subtitle="Every session, its condition, timing and final design."
        actions={
          <>
            <Button onClick={exportCsv}><FileDown className="size-4" /> Export Data (CSV)</Button>
          </>
        }
      />
      <div className="p-8">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select value={exp} onChange={(e) => setExp(e.target.value)} className="h-9 rounded-lg bg-white px-3 text-[13px] font-semibold ring-1 ring-slate-200">
            <option value="all">All experiments</option>
            {experimentOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <div className="flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
            {(['all', 'human', 'ai'] as const).map((c) => (
              <button key={c} onClick={() => setCond(c)} className={`rounded-md px-3 py-1.5 text-[13px] font-semibold ${cond === c ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {c === 'all' ? 'All' : c === 'human' ? 'Human' : 'AI'}
              </button>
            ))}
          </div>
          <span className="ml-auto text-[12.5px] text-slate-400">{loading ? 'Loading submissions…' : `${rows.length} real submission${rows.length === 1 ? '' : 's'}`}</span>
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">{error}</div>}
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-[13px]">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11.5px] font-bold uppercase tracking-[0.06em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Design</th><th className="px-4 py-3">Participant ID</th><th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3">Canvas</th><th className="px-4 py-3">Start</th><th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Duration</th><th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => <Row key={s.id} s={s} />)}
              {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-16 text-center text-sm text-slate-400">No participant submissions yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  )
}

function Row({ s }: { s: ParticipantSession }) {
  const exp = s.experiment
  return (
    <tr className="group hover:bg-slate-50/70">
      <td className="px-4 py-2.5">
        <Link to={`/admin/sessions/${s.id}`} className="flex h-14 w-14 items-center justify-center rounded-md bg-workspace ring-1 ring-slate-200">
          {s.imageUrl ? <img src={s.imageUrl} alt="Submitted design" className="h-full max-w-full object-contain" /> : exp && s.elements.length ? (
            <DesignPreview width={exp.canvas.width} height={exp.canvas.height} background={s.background} elements={s.elements} className="h-full max-w-full" />
          ) : <span className="text-[10px] text-slate-400">empty</span>}
        </Link>
      </td>
      <td className="px-4 py-2.5"><Link to={`/admin/sessions/${s.id}`} className="font-mono text-[12.5px] font-medium text-slate-800 hover:text-brand-700">{s.participantId}</Link></td>
      <td className="px-4 py-2.5">
        {s.condition === 'human' ? <Badge tone="blue"><Hand className="size-3" /> Human</Badge> : <Badge tone="violet"><Sparkles className="size-3" /> AI</Badge>}
      </td>
      <td className="px-4 py-2.5 text-slate-600">
        <div>{exp?.name.split('·')[0].trim() ?? s.experimentId} <span className="font-mono text-[11px] text-slate-400">v{s.experimentVersion}</span></div>
        <div className="text-[11.5px] text-slate-400">{exp ? presetLabel(exp.canvas.presetId, exp.canvas.width, exp.canvas.height) : '—'}</div>
      </td>
      <td className="px-4 py-2.5 text-slate-600">{fmtTime(s.startedAt)}</td>
      <td className="px-4 py-2.5 text-slate-600">{fmtTime(s.submittedAt)}</td>
      <td className="px-4 py-2.5 font-mono text-[12.5px] text-slate-600">{fmtDur(durationSec(s))}</td>
      <td className="px-4 py-2.5"><Badge tone={sessionTone[s.status]}>{s.status.replace('_', ' ')}</Badge></td>
    </tr>
  )
}
