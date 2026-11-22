import type React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BringToFront, Copy, LayoutGrid, Redo2, SendToBack, Trash2, Undo2 } from 'lucide-react'
import { IconButton, useToast } from '../components/ui'
import { designToPng } from '../lib/render'
import { SHAPE_MAP } from '../lib/shapes'
import type { ActionLogEntry, DesignElement, ExperimentConfig } from '../lib/types'
import { loadDraft, saveDraft, submitDesign, type Submission } from '../services/session'
import { ColorPopover } from './ColorPopover'
import { DesignCanvas } from './DesignCanvas'
import { EditorShell, RailItem } from './EditorShell'
import { ElementsPanel } from './ElementsPanel'
import { SubmitDialog } from './SubmitFlow'
import { useEditor } from './useEditor'

export function HumanEditor({
  config, linkCode, participantId, onSubmitted, headerBadge,
}: {
  config: ExperimentConfig
  linkCode: string
  participantId: string
  onSubmitted: (s: Submission) => void
  headerBadge?: React.ReactNode
}) {
  const toast = useToast()
  const draft = useMemo(() => loadDraft(linkCode, participantId), [linkCode, participantId])
  const [startedAt] = useState(() => draft?.startedAt ?? new Date().toISOString())

  const persist = useCallback(
    (s: { elements: DesignElement[]; background: string }, log: ActionLogEntry[]) =>
      saveDraft(linkCode, participantId, { elements: s.elements, background: s.background, log: [...(draft?.log ?? []), ...log], startedAt }),
    [linkCode, participantId, startedAt, draft],
  )
  const ed = useEditor(config, {
    initial: draft ? { elements: draft.elements, background: draft.background } : undefined,
    onChange: persist,
  })

  const [submitOpen, setSubmitOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (submitOpen) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? ed.redo() : ed.undo(); return }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); ed.redo(); return }
      if (!ed.selectedId) return
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); ed.duplicate(); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); ed.remove(); return }
      if (e.key === 'Escape') { ed.select(null); return }
      const step = e.shiftKey ? 20 : 4
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      if (arrows[e.key]) { e.preventDefault(); ed.nudge(...arrows[e.key]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ed, submitOpen])

  const doSubmit = async () => {
    setBusy(true)
    try {
      ed.logSubmit()
      const png = await designToPng(config.canvas.width, config.canvas.height, ed.background, ed.elements)
      const submitEntry: ActionLogEntry = {
        action: 'submit', at: new Date().toISOString(), elapsedMs: Date.now() - new Date(startedAt).getTime(), elementCount: ed.elements.length,
      }
      const sub = await submitDesign(linkCode, participantId, png, {
        config, startedAt, elements: ed.elements, background: ed.background, actionLog: [...(draft?.log ?? []), ...ed.log, submitEntry],
      })
      onSubmitted(sub)
    } catch (err) {
      toast(err instanceof Error ? `Could not submit: ${err.message}. Please try again.` : 'Could not submit. Please try again.', 'error')
      setBusy(false)
    }
  }

  const sel = ed.selected
  const layerIdx = sel ? ed.elements.indexOf(sel) : -1
  return (
    <>
      <EditorShell
        onSubmit={() => { ed.select(null); setSubmitOpen(true) }}
        headerLeft={
          <>
            <IconButton label="Undo (Ctrl+Z)" onClick={ed.undo} disabled={!ed.canUndo}><Undo2 className="size-[18px]" /></IconButton>
            <IconButton label="Redo (Ctrl+Shift+Z)" onClick={ed.redo} disabled={!ed.canRedo}><Redo2 className="size-[18px]" /></IconButton>
            {headerBadge}
          </>
        }
        headerRight={
          <span className="text-[12.5px] font-semibold text-slate-400">{ed.elements.length} elements</span>
        }
        rail={<RailItem icon={<LayoutGrid className="size-5" />} label="Elements" active />}
        panel={<ElementsPanel config={config} onAdd={ed.add} />}
        toolbar={
          sel ? (
            <>
              <ColorPopover config={config} value={sel.fill} label={SHAPE_MAP[sel.type].category === 'lines' ? 'Line Color' : 'Fill Color'} onPick={ed.setColor} />
              <div className="mx-1.5 h-6 w-px bg-slate-200" />
              <IconButton label="Bring Forward" onClick={ed.bringForward} disabled={layerIdx === ed.elements.length - 1}><BringToFront className="size-4" /> Forward</IconButton>
              <IconButton label="Send Backward" onClick={ed.sendBackward} disabled={layerIdx === 0}><SendToBack className="size-4" /> Backward</IconButton>
              <div className="mx-1.5 h-6 w-px bg-slate-200" />
              <IconButton label="Duplicate (Ctrl+D)" onClick={ed.duplicate} disabled={ed.atLimit}><Copy className="size-4" /> Duplicate</IconButton>
              <IconButton label="Delete" onClick={ed.remove} className="hover:!bg-red-50 hover:!text-red-600"><Trash2 className="size-4" /> Delete</IconButton>
              <div className="ml-auto flex items-center gap-3 pr-1 font-mono text-[11.5px] text-slate-400">
                <span className="font-sans font-semibold text-slate-600">{SHAPE_MAP[sel.type].name}</span>
                <span>{Math.round(sel.width)} × {Math.round(sel.height)}</span>
                <span>{Math.round(sel.rotation)}°</span>
                <span>Layer {layerIdx + 1}</span>
              </div>
            </>
          ) : (
            <>
              {config.allowBackgroundChange && (
                <>
                  <ColorPopover config={config} value={ed.background} label="Background" onPick={ed.setBackground} />
                  <div className="mx-1.5 h-6 w-px bg-slate-200" />
                </>
              )}
              <span className="px-2 text-[13px] text-slate-400">
                {ed.elements.length ? 'Select an element to change its colour, layer, or duplicate it.' : 'Add shapes from the Elements panel to start designing.'}
              </span>
            </>
          )
        }
        canvas={
          <DesignCanvas
            width={config.canvas.width}
            height={config.canvas.height}
            background={ed.background}
            elements={ed.elements}
            selectedId={ed.selectedId}
            interactive
            onSelect={ed.select}
            onGestureStart={ed.beginGesture}
            onGestureUpdate={ed.updateLive}
            onGestureEnd={ed.endGesture}
          />
        }
      />
      <SubmitDialog
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onConfirm={doSubmit}
        busy={busy}
        elementCount={ed.elements.length}
        warning={ed.elements.length === 0 ? 'Your canvas is empty.' : undefined}
      />
    </>
  )
}
