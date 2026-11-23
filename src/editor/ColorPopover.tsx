import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { isLight } from '../lib/palette'
import type { ExperimentConfig } from '../lib/types'
import { PaletteGrid } from './ElementsPanel'

export function ColorPopover({ config, value, label, onPick }: { config: ExperimentConfig; value: string; label: string; onPick: (hex: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  const name = config.palette.find((c) => c.hex === value)?.name ?? value
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 items-center gap-2 rounded-lg px-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-100 ${open ? 'bg-slate-100' : ''}`}
      >
        <span className={`size-5 rounded-md ${isLight(value) ? 'ring-1 ring-inset ring-slate-300' : ''}`} style={{ background: value }} />
        {label}
        <ChevronDown className="size-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="animate-toast absolute left-0 top-11 z-30 w-[248px] rounded-xl bg-white p-3 shadow-xl ring-1 ring-slate-200">
          <div className="mb-2 flex items-center justify-between text-[12px]">
            <span className="font-bold text-slate-700">{label}</span>
            <span className="font-medium text-slate-400">{name}</span>
          </div>
          <PaletteGrid config={config} selected={value} onPick={(hex) => { onPick(hex); setOpen(false) }} />
        </div>
      )}
    </div>
  )
}
