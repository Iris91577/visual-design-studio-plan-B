import { Lock, Search } from 'lucide-react'
import { useState } from 'react'
import { CATEGORY_LABELS, SHAPES } from '../lib/shapes'
import { isLight } from '../lib/palette'
import type { ExperimentConfig, ShapeCategory, ShapeType } from '../lib/types'
import { ShapeThumb } from './ShapeSvg'

export function ElementsPanel({
  config, onAdd, readOnly = false, disabled = false,
}: { config: ExperimentConfig; onAdd?: (t: ShapeType) => void; readOnly?: boolean; disabled?: boolean }) {
  const [query,setQuery]=useState('')
  const cats: ShapeCategory[] = ['basic','polygons','decorative','organic','nature','abstract','lines','symbols','frames']
  return (
    <div className="p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-bold">{readOnly ? 'Available Elements' : 'Elements'}</h2>
        {readOnly && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400"><Lock className="size-3" /> Used by AI</span>
        )}
      </div>
      <p className="mt-1 text-[12.5px] leading-snug text-slate-500">
        {readOnly
          ? 'The AI composes your design using only these shapes and colours.'
          : 'Click a shape to add it to the centre of the canvas.'}
      </p>
      <label className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 ring-1 ring-slate-200"><Search className="size-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search elements" className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"/></label>
      {cats.map((cat) => {
        const shapes = SHAPES.filter((s) => s.category === cat && config.allowedShapes.includes(s.type) && s.name.toLowerCase().includes(query.toLowerCase()))
        if (!shapes.length) return null
        return (
          <section key={cat} className="mt-5">
            <h3 className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-slate-400">{CATEGORY_LABELS[cat]}</h3>
            <div className="grid grid-cols-3 gap-2">
              {shapes.map((s) =>
                readOnly ? (
                  <div key={s.type} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl bg-slate-50 ring-1 ring-slate-100">
                    <ShapeThumb type={s.type} color="#64748B" size={34} />
                    <span className="text-[10.5px] font-medium text-slate-500">{s.name}</span>
                  </div>
                ) : (
                  <button
                    key={s.type}
                    onClick={() => onAdd?.(s.type)}
                    disabled={disabled}
                    title={`Add ${s.name}`}
                    className="group flex aspect-square flex-col items-center justify-center gap-1 rounded-xl bg-slate-50 ring-1 ring-slate-100 transition hover:bg-white hover:shadow-md hover:ring-brand-200 active:scale-[0.97] disabled:opacity-40"
                  >
                    <span className="transition group-hover:scale-105"><ShapeThumb type={s.type} size={38} /></span>
                    <span className="text-[10.5px] font-medium text-slate-500 group-hover:text-slate-800">{s.name}</span>
                  </button>
                ),
              )}
            </div>
          </section>
        )
      })}
      {readOnly && (
        <section className="mt-6">
          <h3 className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-slate-400">Colours</h3>
          <PaletteGrid config={config} />
        </section>
      )}
    </div>
  )
}

export function PaletteGrid({ config, selected, onPick }: { config: ExperimentConfig; selected?: string; onPick?: (hex: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {config.palette.map((c) => {
        const Tag = onPick ? 'button' : 'div'
        return (
          <Tag
            key={c.hex}
            title={`${c.name} ${c.hex}`}
            onClick={onPick ? () => onPick(c.hex) : undefined}
            className={`relative aspect-square rounded-full transition ${onPick ? 'hover:scale-110' : ''} ${isLight(c.hex) ? 'ring-1 ring-inset ring-slate-300' : ''} ${selected === c.hex ? 'outline-2 outline-offset-2 outline-brand-600' : ''}`}
            style={{ background: c.hex }}
          />
        )
      })}
    </div>
  )
}
