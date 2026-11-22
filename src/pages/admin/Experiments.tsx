import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Clock, Hand, Plus, Sparkles } from 'lucide-react'
import { Badge, Button, Card } from '../../components/ui'
import { DesignPreview } from '../../editor/ShapeSvg'
import { presetLabel } from '../../lib/canvasPresets'
import { METHOD_LABELS } from '../../lib/aiModels'
import { PageHeader } from './AdminLayout'
import { loadPublishedExperiments } from '../../services/experiments'
import { loadSessions } from '../../services/sessions'
import type { ExperimentConfig } from '../../lib/types'
import type { ParticipantSession } from '../../lib/types'

export const statusTone = { published: 'green', draft: 'amber', archived: 'slate' } as const

export function ExperimentsPage() {
  const nav = useNavigate()
  const [items, setItems] = useState<ExperimentConfig[]>([])
  const [sessions,setSessions]=useState<ParticipantSession[]>([])
  useEffect(() => {
    let active = true
    Promise.all([loadPublishedExperiments(),loadSessions()]).then(([{experiments:remote},{sessions:realSessions}])=>{if(active){setItems(remote);setSessions(realSessions)}}).catch(()=>{if(active){setItems([]);setSessions([])}})
    return () => { active = false }
  }, [])
  return (
    <>
      <PageHeader
        title="Experiments"
        subtitle="Each experiment fixes the canvas, design library and AI settings for its participants."
        actions={<Button variant="primary" onClick={() => nav('/admin/experiments/new')}><Plus className="size-4" /> New experiment</Button>}
      />
      <div className="grid gap-5 p-8 md:grid-cols-2 xl:grid-cols-3">
        {items.map((exp) => {
          const ss = sessions.filter(s=>s.experimentId===exp.id)
          const submitted = ss.filter((s) => s.status === 'submitted')
          const latest = submitted[0]
          return (
            <Link key={exp.id} to={`/admin/experiments/${exp.id}`} className="group">
              <Card className="overflow-hidden transition group-hover:shadow-lg group-hover:ring-brand-200">
                <div className="flex h-44 items-center justify-center bg-workspace p-4">
                  <DesignPreview
                    width={exp.canvas.width} height={exp.canvas.height} background={exp.canvas.background}
                    elements={latest?.elements ?? []}
                    className="h-full max-w-full rounded shadow-md"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone[exp.status]}>{exp.status}</Badge>
                    <span className="font-mono text-[11.5px] text-slate-400">v{exp.version}</span>
                  </div>
                  <h2 className="mt-2 text-[16px] font-bold group-hover:text-brand-700">{exp.name}</h2>
                  <p className="mt-0.5 text-[13px] text-slate-500">{presetLabel(exp.canvas.presetId, exp.canvas.width, exp.canvas.height)}</p>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-slate-500">
                    <span className="inline-flex items-center gap-1"><Hand className="size-3.5" /> {ss.filter((s) => s.condition === 'human').length} human</span>
                    <span className="inline-flex items-center gap-1"><Sparkles className="size-3.5" /> {ss.filter((s) => s.condition === 'ai').length} AI</span>
                    <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> Time recorded · no limit</span>
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-3 text-[12px] text-slate-400">
                    {submitted.length} submitted · {METHOD_LABELS[exp.ai.method]} · {exp.ai.model}
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </>
  )
}
