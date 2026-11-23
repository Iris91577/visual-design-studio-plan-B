import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardList, Download, FlaskConical, Hand, Layers, Link as LinkIcon, Lock, ShieldCheck, Sparkles } from 'lucide-react'
import { Badge, Logo } from '../components/ui'
import { DesignPreview, ShapeThumb } from '../editor/ShapeSvg'
import { DEFAULT_PALETTE } from '../lib/palette'
import { SHAPES } from '../lib/shapes'
import type { DesignElement } from '../lib/types'

const promo=(id:string,type:DesignElement['type'],x:number,y:number,width:number,height:number,fill:string,rotation=0):DesignElement=>({id,type,x,y,width,height,fill,rotation})
const PROMO_DESIGNS=[
  [promo('h1','circle',540,480,500,500,'#3B82F6'),promo('h2','triangle',420,620,420,360,'#10B981'),promo('h3','star',760,260,180,180,'#FACC15',12)],
  [promo('a1','roundedRectangle',540,540,650,650,'#1E3A8A'),promo('a2','heart',540,540,360,330,'#EC4899'),promo('a3','sparkle',780,260,150,150,'#F59E0B')],
]

export function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="flex items-center gap-1 text-sm font-semibold">
            <a href="#how" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">How it works</a>
            <a href="#data" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">Data</a>
            <Link to="/admin" className="ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-white shadow-sm hover:bg-brand-700">
              Researcher login <ArrowRight className="size-4" />
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="dot-grid absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <Badge tone="blue"><FlaskConical className="size-3.5" /> Experimental design platform</Badge>
            <h1 className="mt-5 text-[44px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[54px]">
              One canvas.<br />Two ways to design.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-slate-600">
              Visual Design Studio gives participants a familiar online design editor and records everything they do.
              Human Design participants build with shapes and colours. AI Design participants describe what they want,
              and a model composes it from exactly the same library.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/admin" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-[15px] font-semibold text-white shadow-sm hover:bg-brand-700">
                <Hand className="size-4" /> Open researcher console
              </Link>
            </div>
            <p className="mt-4 text-[13px] text-slate-500">Participants never see this page. They open a study link and land straight in the editor.</p>
          </div>

          <div className="relative">
            <div className="rounded-2xl bg-white p-2 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.35)] ring-1 ring-slate-200">
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <span className="size-2.5 rounded-full bg-slate-200" /><span className="size-2.5 rounded-full bg-slate-200" /><span className="size-2.5 rounded-full bg-slate-200" />
                <span className="ml-3 text-[11px] font-semibold text-slate-400">Square Post · 1080 × 1080</span>
              </div>
              <div className="grid grid-cols-2 gap-2 bg-workspace p-3">
                {[{ elements: PROMO_DESIGNS[0], label: 'Human Design', icon: <Hand className="size-3.5" /> }, { elements: PROMO_DESIGNS[1], label: 'AI Design', icon: <Sparkles className="size-3.5" /> }].map(({ elements, label, icon }) => (
                  <figure key={label} className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                    <DesignPreview width={1080} height={1080} background="#FFFFFF" elements={elements} className="block aspect-square w-full" />
                    <figcaption className="flex items-center gap-1.5 border-t border-slate-100 px-2.5 py-2 text-[12px] font-semibold text-slate-600">{icon} {label}</figcaption>
                  </figure>
                ))}
              </div>
              <div className="flex items-center gap-3 px-3 py-3">
                <div className="flex -space-x-1">
                  {DEFAULT_PALETTE.slice(0, 9).map((c) => <span key={c.hex} className="size-5 rounded-full ring-2 ring-white" style={{ background: c.hex }} />)}
                </div>
                <span className="text-[12px] font-medium text-slate-500">Same 30 elements · same colour tools · same export size</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50/60 py-14">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-[13px] font-bold uppercase tracking-[0.12em] text-slate-400">A controlled design library</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {SHAPES.map((s) => (
              <div key={s.type} title={s.name} className="flex size-16 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200">
                <ShapeThumb type={s.type} color={DEFAULT_PALETTE[SHAPES.indexOf(s) % 9].hex} size={38} />
              </div>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-[15px] text-slate-600">
            No text, uploads, templates, stickers or gradients. Every element is a real, editable vector shape,
            and AI output is checked against the same rules before anyone sees it.
          </p>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-extrabold tracking-tight">How a study runs</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { icon: <Layers className="size-5" />, t: 'Configure', d: 'Pick a canvas preset or custom size, background, allowed elements and colours, brief and AI model.' },
            { icon: <LinkIcon className="size-5" />, t: 'Link from your survey', d: 'Copy the Human and AI links into Qualtrics or Credamo after randomisation. Each link locks its condition server-side.' },
            { icon: <ClipboardList className="size-5" />, t: 'Collect', d: 'Participants submit, get a completion code and return to the survey. You review designs, logs and prompts.' },
          ].map((s, i) => (
            <div key={s.t} className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{s.icon}</span>
                <span className="font-mono text-sm text-slate-300">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-bold">{s.t}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="data" className="bg-ink py-20 text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Built for analysis</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-slate-300">
              Every session is tied to an anonymous participant ID from your survey, so designs, editing behaviour and AI records line up with questionnaire responses.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
              <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2"><Download className="size-4" /> CSV export</span>
              <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2"><Download className="size-4" /> Individual PNG download</span>
              <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2"><Lock className="size-4" /> Versioned configs</span>
              <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2"><ShieldCheck className="size-4" /> Server-side keys</span>
            </div>
          </div>
          <ul className="grid gap-3 text-[14.5px] sm:grid-cols-2">
            {[
              ['Human action log', 'Add, move, resize, rotate, colour, duplicate, layer, undo/redo, with timings and before/after values'],
              ['AI generation record', 'Exact prompt, model and version, parameters, timings, raw output, validation result and retries'],
              ['Final artwork', 'PNG at the canvas’ native resolution plus the full structured design'],
              ['Session timing', 'Start, submission and total duration per participant'],
            ].map(([t, d]) => (
              <li key={t} className="rounded-xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <div className="font-bold">{t}</div>
                <div className="mt-1 text-slate-400">{d}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-[13px] text-slate-400">
        <Logo />
        <span>For academic research use</span>
      </footer>
    </div>
  )
}
