import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Copy, Eye, Hand, Lock, Sparkles } from 'lucide-react'
import { Badge, Button, Card, useToast } from '../../components/ui'
import { DesignPreview, ShapeThumb } from '../../editor/ShapeSvg'
import { AI_MODELS, METHOD_LABELS } from '../../lib/aiModels'
import { CANVAS_MAX, CANVAS_MIN, CANVAS_PRESETS, CUSTOM_PRESET_ID } from '../../lib/canvasPresets'
import { uid } from '../../lib/ids'
import { DEFAULT_PALETTE, isLight } from '../../lib/palette'
import { ALL_SHAPE_TYPES, CATEGORY_LABELS, SHAPE_CATEGORIES, SHAPES } from '../../lib/shapes'
import type { Condition, ExperimentConfig, ShapeCategory } from '../../lib/types'
import { loadExperiment, saveExperiment } from '../../services/experiments'
import { loadSessions } from '../../services/sessions'
import { PageHeader } from './AdminLayout'
import { statusTone } from './Experiments'

function blankExperiment(): ExperimentConfig {
  const now = new Date().toISOString()
  return {
    id: uid('exp'), name: 'Untitled experiment', version: 1, status: 'draft',
    canvas: { presetId: 'square-post', width: 1080, height: 1080, background: '#FFFFFF' },
    allowBackgroundChange: true, allowCustomColors: false, allowedShapes: ALL_SHAPE_TYPES, palette: DEFAULT_PALETTE,
    aiGenerationLimit: 1,
    ai: { method: 'structured', model: 'gpt-6.1-sol', temperature: 1, technicalRetries: 1 },
    returnUrl: '', links: { human: uid('h').slice(2, 8), ai: uid('a').slice(2, 8) }, createdAt: now, updatedAt: now,
  }
}

export function ExperimentEditor() {
  const { id = 'new' } = useParams()
  const toast = useToast()
  const nav = useNavigate()
  const [original, setOriginal] = useState<ExperimentConfig | null>(()=>id==='new'?blankExperiment():null)
  const [cfg, setCfg] = useState<ExperimentConfig | null>(()=>original?structuredClone(original):null)
  const [sessionsCount,setSessionsCount]=useState(0)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (id === 'new') return
    let active = true
    loadExperiment(id, 'editor').then((remote) => {
      if (!active || !remote) return
      setOriginal(remote.published ?? remote.experiment)
      setCfg(structuredClone(remote.experiment))
    }).catch((err) => {
      if (active) toast(err instanceof Error ? err.message : 'Could not load the saved experiment.', 'error')
    })
    loadSessions().then(({sessions})=>{if(active)setSessionsCount(sessions.filter(s=>s.experimentId===id).length)}).catch(()=>undefined)
    return () => { active = false }
  }, [id, toast])
  if (!cfg || !original) return <div className="p-8">Experiment not found. <Link className="text-brand-600" to="/admin">Back</Link></div>

  const set = (patch: Partial<ExperimentConfig>) => setCfg({ ...cfg, ...patch })
  const setCanvas = (patch: Partial<ExperimentConfig['canvas']>) => set({ canvas: { ...cfg.canvas, ...patch } })

  // Changes to the design rules of a published experiment produce a new version.
  const rulesChanged =
    JSON.stringify([original.canvas.width, original.canvas.height, original.canvas.background, original.allowedShapes, original.palette, original.allowCustomColors]) !==
    JSON.stringify([cfg.canvas.width, cfg.canvas.height, cfg.canvas.background, cfg.allowedShapes, cfg.palette, cfg.allowCustomColors])
  const willVersion = original.status === 'published' && rulesChanged

  const sizeError = cfg.canvas.width < CANVAS_MIN || cfg.canvas.width > CANVAS_MAX || cfg.canvas.height < CANVAS_MIN || cfg.canvas.height > CANVAS_MAX
  const invalid = sizeError || cfg.allowedShapes.length === 0

  const save = async (publish: boolean) => {
    if (invalid) { toast('Fix the highlighted settings before saving.', 'error'); return }
    setSaving(true)
    try {
      const candidate: ExperimentConfig = publish
        ? { ...cfg, version: willVersion ? original.version + 1 : original.version, status: 'published' }
        : cfg
      const result = await saveExperiment(candidate, publish ? 'publish' : 'draft')
      setCfg(structuredClone(result.experiment))
      if (publish) setOriginal(structuredClone(result.experiment))
      toast(publish ? `Published ${result.experiment.name} as v${result.experiment.version}.` : 'Draft saved. Researcher previews now use this draft.', 'success')
      if (id === 'new') nav('/admin')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save the experiment.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Link to="/admin" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft className="size-5" /></Link>
            {id === 'new' ? 'New experiment' : cfg.name}
          </span>
        }
        subtitle={
          <span className="flex items-center gap-2">
            <Badge tone={statusTone[original.status]}>{original.status}</Badge>
            <span className="font-mono text-[12px]">v{original.version}</span>
            {sessionsCount > 0 && <span>· {sessionsCount} participant sessions</span>}
          </span>
        }
        actions={
          <>
            <Button disabled={saving} onClick={() => save(false)}>{saving ? 'Saving…' : 'Save draft'}</Button>
            <Button disabled={saving} variant="primary" onClick={() => save(true)}>{willVersion ? `Publish v${original.version + 1}` : original.status === 'published' ? 'Save' : 'Publish'}</Button>
          </>
        }
      />

      {willVersion && (
        <div className="mx-8 mt-6 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-[13.5px] text-amber-900 ring-1 ring-amber-200">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <div>
            <b>v{original.version} is locked.</b> You changed the canvas, library, palette or element limit. Publishing creates <b>v{original.version + 1}</b>;
            the {sessionsCount} existing sessions stay on v{original.version}, and the links switch to the new version for new participants.
          </div>
        </div>
      )}

      <div className="grid gap-6 p-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Experiment">
            <Field label="Name">
              <input value={cfg.name} onChange={(e) => set({ name: e.target.value })} className={input} />
            </Field>
          </Section>

          <Section title="Canvas" hint="Participants can’t change the canvas size. Designs are exported at exactly this resolution.">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {[...CANVAS_PRESETS, { id: CUSTOM_PRESET_ID, name: 'Custom Size', width: cfg.canvas.width, height: cfg.canvas.height, ratio: 'Custom' }].map((p) => {
                const active = cfg.canvas.presetId === p.id
                const r = p.width / p.height
                return (
                  <button
                    key={p.id}
                    onClick={() => setCanvas(p.id === CUSTOM_PRESET_ID ? { presetId: p.id } : { presetId: p.id, width: p.width, height: p.height })}
                    className={`flex flex-col items-center rounded-xl p-3 text-center ring-1 transition ${active ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-slate-200 hover:ring-slate-300'}`}
                  >
                    <div className="flex h-12 items-center justify-center">
                      <div className={`rounded-[3px] border-2 ${active ? 'border-brand-600 bg-white' : 'border-slate-300 bg-slate-50'} ${p.id === CUSTOM_PRESET_ID ? 'border-dashed' : ''}`}
                        style={{ width: r >= 1 ? 44 : 44 * r, height: r >= 1 ? 44 / r : 44 }} />
                    </div>
                    <div className="mt-2 text-[12.5px] font-bold text-slate-800">{p.name}</div>
                    <div className="font-mono text-[11px] text-slate-400">{p.id === CUSTOM_PRESET_ID ? 'Any size' : `${p.width}×${p.height} · ${p.ratio}`}</div>
                  </button>
                )
              })}
            </div>
            {cfg.canvas.presetId === CUSTOM_PRESET_ID && (
              <div className="mt-4 flex items-end gap-3">
                <Field label="Width (px)"><input type="number" min={CANVAS_MIN} max={CANVAS_MAX} value={cfg.canvas.width} onChange={(e) => setCanvas({ width: Number(e.target.value) })} className={`${input} w-32`} /></Field>
                <span className="pb-2.5 text-slate-400">×</span>
                <Field label="Height (px)"><input type="number" min={CANVAS_MIN} max={CANVAS_MAX} value={cfg.canvas.height} onChange={(e) => setCanvas({ height: Number(e.target.value) })} className={`${input} w-32`} /></Field>
                {sizeError && <span className="pb-2.5 text-[12.5px] font-medium text-red-600">Between {CANVAS_MIN} and {CANVAS_MAX} px</span>}
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
              <div>
                <div className="mb-1.5 text-[13px] font-semibold text-slate-700">Background colour</div>
                <div className="flex flex-wrap gap-1.5">
                  {cfg.palette.map((c) => (
                    <button key={c.hex + c.name} title={c.name} onClick={() => setCanvas({ background: c.hex })}
                      className={`size-7 rounded-full transition hover:scale-110 ${isLight(c.hex) ? 'ring-1 ring-inset ring-slate-300' : ''} ${cfg.canvas.background === c.hex ? 'outline-2 outline-offset-2 outline-brand-600' : ''}`}
                      style={{ background: c.hex }} />
                  ))}
                </div>
              </div>
              <Toggle checked={cfg.allowBackgroundChange} onChange={(v) => set({ allowBackgroundChange: v })} label="Human participants may change the background" />
            </div>
          </Section>

          <Section
            title="Design elements"
            hint={`${cfg.allowedShapes.length} of ${SHAPES.length} shapes enabled. Applies to both conditions.`}
            action={
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => set({ allowedShapes: ALL_SHAPE_TYPES })}>All</Button>
                <Button size="sm" variant="ghost" onClick={() => set({ allowedShapes: [] })}>None</Button>
              </div>
            }
          >
            {(SHAPE_CATEGORIES as ShapeCategory[]).map((cat) => (
              <div key={cat} className="mb-4 last:mb-0">
                <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-slate-400">{CATEGORY_LABELS[cat]}</div>
                <div className="flex flex-wrap gap-2">
                  {SHAPES.filter((s) => s.category === cat).map((s) => {
                    const on = cfg.allowedShapes.includes(s.type)
                    return (
                      <button key={s.type}
                        onClick={() => set({ allowedShapes: on ? cfg.allowedShapes.filter((t) => t !== s.type) : ALL_SHAPE_TYPES.filter((t) => t === s.type || cfg.allowedShapes.includes(t)) })}
                        className={`relative flex w-[84px] flex-col items-center gap-1 rounded-xl py-2.5 ring-1 transition ${on ? 'bg-white ring-2 ring-brand-500' : 'bg-slate-50 opacity-55 ring-slate-200 hover:opacity-80'}`}>
                        {on && <Check className="absolute right-1.5 top-1.5 size-3.5 text-brand-600" />}
                        <ShapeThumb type={s.type} size={32} color={on ? '#334155' : '#94A3B8'} />
                        <span className="text-[11px] font-semibold text-slate-600">{s.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {cfg.allowedShapes.length === 0 && <p className="text-[12.5px] font-medium text-red-600">Enable at least one shape.</p>}
          </Section>

          <Section
            title="Colour palette"
            hint="Fixed 30-colour palette shared by Human and AI. Custom HEX values and colour pickers are disabled."
          >
            <div className="flex flex-wrap gap-3">
              {cfg.palette.map((c) => (
                <div key={c.hex} className="flex w-[145px] items-center gap-2 rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200" title={`${c.name} ${c.hex}`}>
                  <span className={`size-8 shrink-0 rounded-md ${isLight(c.hex) ? 'ring-1 ring-inset ring-slate-300' : ''}`} style={{ background: c.hex }} />
                  <div className="min-w-0"><div className="truncate text-[12.5px] font-semibold text-slate-700">{c.name}</div><div className="font-mono text-[10.5px] text-slate-400">{c.hex}</div></div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Participation rules" hint="Design time and element count are observed, not restricted.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-100"><strong>No element limit.</strong><br/>Participants may add and remove elements freely; the final count is recorded.</div>
              <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-100"><strong>No design time limit.</strong><br/>Elapsed time is recorded without a countdown or forced submission.</div>
              <Field label="AI generations per participant" hint="Failed technical attempts don’t count">
                <input type="number" min={1} max={10} value={cfg.aiGenerationLimit} onChange={(e) => set({ aiGenerationLimit: Math.max(1, Number(e.target.value)) })} className={input} />
              </Field>
            </div>
          </Section>

          <Section title="AI model" hint="Structured generation: GPT decides the design; the site draws it with the same resources as the Human condition.">
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Model">
                <select value={cfg.ai.model} onChange={(e) => set({ ai: { ...cfg.ai, model: e.target.value } })} className={input}>
                  {AI_MODELS.filter((m) => m.method === 'structured').map((m) => <option key={m.id} value={m.id}>{m.provider} · {m.label}</option>)}
                </select>
              </Field>
              <Field label={`Temperature · ${cfg.ai.temperature.toFixed(1)}`}>
                <input type="range" min={0} max={1} step={0.1} value={cfg.ai.temperature} onChange={(e) => set({ ai: { ...cfg.ai, temperature: Number(e.target.value) } })} className="mt-3 w-full accent-brand-600" />
              </Field>
              <Field label="Technical retries" hint="Only on errors or invalid output">
                <input type="number" min={0} max={5} value={cfg.ai.technicalRetries} onChange={(e) => set({ ai: { ...cfg.ai, technicalRetries: Number(e.target.value) } })} className={input} />
              </Field>
            </div>
          </Section>

          <Section title="Survey connection" hint="Randomise in Qualtrics or Credamo, then send each group to its link. Append the survey’s response ID as pid.">
            <Field label="Return URL after submission" hint="Optional. {code} is replaced with the completion code and {pid} with the participant ID.">
              <input value={cfg.returnUrl} placeholder="https://yourschool.qualtrics.com/jfe/form/SV_xxx?code={code}" onChange={(e) => set({ returnUrl: e.target.value })} className={input} />
            </Field>
            <div className="mt-4 grid gap-3">
              {(['human', 'ai'] as Condition[]).map((c) => <LinkRow key={c} condition={c} code={cfg.links[c]} />)}
            </div>
          </Section>
        </div>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <Card className="p-5">
            <div className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-slate-400">Participant canvas</div>
            <div className="mt-3 flex h-64 items-center justify-center rounded-lg bg-workspace p-4">
              <DesignPreview width={cfg.canvas.width || 1} height={cfg.canvas.height || 1} background={cfg.canvas.background} elements={[]} className="h-full max-w-full shadow-md" />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-y-2 text-[13px]">
              <dt className="text-slate-500">Size</dt><dd className="text-right font-mono">{cfg.canvas.width} × {cfg.canvas.height}</dd>
              <dt className="text-slate-500">Shapes</dt><dd className="text-right">{cfg.allowedShapes.length}</dd>
              <dt className="text-slate-500">Colours</dt><dd className="text-right">{cfg.palette.length}</dd>
              <dt className="text-slate-500">Limits</dt><dd className="text-right">None</dd>
              <dt className="text-slate-500">AI</dt><dd className="truncate text-right">{cfg.ai.model}</dd>
            </dl>
            {id !== 'new' && (
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Link to={`/demo/human?exp=${cfg.id}&draft=1`} target="_blank" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white text-[13px] font-semibold ring-1 ring-slate-200 hover:bg-slate-50"><Eye className="size-4" /> Human</Link>
                <Link to={`/demo/ai?exp=${cfg.id}&draft=1`} target="_blank" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white text-[13px] font-semibold ring-1 ring-slate-200 hover:bg-slate-50"><Eye className="size-4" /> AI</Link>
              </div>
            )}
            {id !== 'new' && <p className="mt-2 text-center text-[11.5px] text-slate-400">Previews use the latest saved draft</p>}
          </Card>
        </div>
      </div>
    </>
  )
}

const input = 'h-10 w-full rounded-lg bg-white px-3 text-[14px] ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500'

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-bold">{title}</h2>
          {hint && <p className="mt-0.5 text-[13px] text-slate-500">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-slate-400">{hint}</span>}
    </label>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 text-[13px] font-medium text-slate-700">
      <span className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  )
}

function LinkRow({ condition, code }: { condition: Condition; code: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/s/${code}?pid=\${e://Field/ResponseID}`
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${condition === 'human' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>
        {condition === 'human' ? <Hand className="size-4" /> : <Sparkles className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-bold text-slate-700">{condition === 'human' ? 'Human Design link' : 'AI Design link'}</div>
        <div className="truncate font-mono text-[12px] text-slate-500">{url}</div>
      </div>
      <Button size="sm" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
        {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />} {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}
