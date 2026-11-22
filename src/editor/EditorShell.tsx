import type { ReactNode } from 'react'
import { Send } from 'lucide-react'
import { Button, Logo } from '../components/ui'

/**
 * Shared frame for both conditions. Human and AI editors deliberately use the
 * same header, rail, panel width and workspace so the interface itself does
 * not differ between conditions beyond the tools.
 */
export function EditorShell({
  headerLeft, headerRight, submitDisabled, onSubmit, rail, panel, toolbar, canvas, rightPanel,
}: {
  headerLeft?: ReactNode
  headerRight?: ReactNode
  submitDisabled?: boolean
  onSubmit: () => void
  rail: ReactNode
  panel: ReactNode
  toolbar: ReactNode
  canvas: ReactNode
  rightPanel?: ReactNode
}) {
  return (
    <div className="flex h-screen min-h-[560px] flex-col bg-white">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <Logo />
        <div className="mx-2 h-6 w-px bg-slate-200" />
        <div className="flex min-w-0 flex-1 items-center gap-1">{headerLeft}</div>
        <div className="flex items-center gap-3">
          {headerRight}
          <Button variant="primary" onClick={onSubmit} disabled={submitDisabled}>
            <Send className="size-4" /> Submit Design
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-[72px] shrink-0 flex-col items-center gap-1 border-r border-slate-200 bg-white pt-3">{rail}</nav>
        <aside className="scrollbar-thin w-[280px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">{panel}</aside>
        <main className="flex min-w-0 flex-1 flex-col bg-workspace">
          <div className="flex h-12 shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-3">{toolbar}</div>
          <div className="dot-grid min-h-0 flex-1">{canvas}</div>
        </main>
        {rightPanel && (
          <aside className="scrollbar-thin w-[340px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white">{rightPanel}</aside>
        )}
      </div>
    </div>
  )
}

export function RailItem({ icon, label, active }: { icon: ReactNode; label: string; active?: boolean }) {
  return (
    <div className={`flex w-[60px] flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold ${active ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`}>
      {icon}
      {label}
    </div>
  )
}
