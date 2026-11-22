import { useCallback, useEffect, useRef, useState } from 'react'
import { defaultSize, SHAPE_MAP } from '../lib/shapes'
import { uid } from '../lib/ids'
import type { ActionLogEntry, DesignElement, ExperimentConfig, ShapeType } from '../lib/types'
import { normaliseHex } from '../lib/palette'

interface Snapshot {
  elements: DesignElement[]
  background: string
}

export interface EditorApi {
  elements: DesignElement[]
  background: string
  selectedId: string | null
  selected: DesignElement | null
  canUndo: boolean
  canRedo: boolean
  atLimit: boolean
  log: ActionLogEntry[]
  select: (id: string | null) => void
  add: (type: ShapeType) => boolean
  remove: () => void
  duplicate: () => boolean
  setColor: (hex: string) => void
  setBackground: (hex: string) => void
  bringForward: () => void
  sendBackward: () => void
  undo: () => void
  redo: () => void
  nudge: (dx: number, dy: number) => void
  /** Gesture lifecycle for drag / resize / rotate: live updates are not added to history until committed. */
  beginGesture: () => void
  updateLive: (id: string, patch: Partial<DesignElement>) => void
  endGesture: (action: 'move' | 'resize' | 'rotate') => void
  logSubmit: () => void
}

const round = (n: number) => Math.round(n * 10) / 10

export function useEditor(
  config: ExperimentConfig,
  opts: { initial?: Snapshot; onLimit?: () => void; onChange?: (s: Snapshot, log: ActionLogEntry[]) => void } = {},
): EditorApi {
  const { width: W, height: H } = config.canvas
  const [state, setState] = useState<Snapshot>(
    () => opts.initial ?? { elements: [], background: config.canvas.background },
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [past, setPast] = useState<Snapshot[]>([])
  const [future, setFuture] = useState<Snapshot[]>([])
  const [log, setLog] = useState<ActionLogEntry[]>([])
  const startedAt = useRef(Date.now())
  const gestureStart = useRef<Snapshot | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const onChange = opts.onChange
  useEffect(() => {
    onChange?.(state, log)
  }, [state, log, onChange])

  const record = useCallback((entry: Omit<ActionLogEntry, 'at' | 'elapsedMs'>) => {
    setLog((l) => [...l, { ...entry, at: new Date().toISOString(), elapsedMs: Date.now() - startedAt.current }])
  }, [])

  const commit = useCallback((next: Snapshot, prev: Snapshot = stateRef.current) => {
    setPast((p) => [...p.slice(-199), prev])
    setFuture([])
    setState(next)
  }, [])

  const selected = state.elements.find((e) => e.id === selectedId) ?? null
  // Rendering safety only; this is not an experimental or participant-facing limit.
  const atLimit = state.elements.length >= 500

  const add = useCallback((type: ShapeType) => {
    const s = stateRef.current
    if (!config.allowedShapes.includes(type)) return false
    if (s.elements.length >= 500) { opts.onLimit?.(); return false }
    const size = defaultSize(type, W, H)
    const used = new Set(s.elements.map((e) => e.fill))
    const fill = config.palette.find((c) => !used.has(c.hex) && c.hex !== s.background)?.hex ?? config.palette[0].hex
    // Offset repeated adds so copies don't stack perfectly on top of each other
    const offset = (s.elements.filter((e) => e.type === type).length % 6) * Math.round(Math.min(W, H) * 0.02)
    const el: DesignElement = { id: uid(), type, x: W / 2 + offset, y: H / 2 + offset, rotation: 0, fill, ...size }
    commit({ ...s, elements: [...s.elements, el] })
    setSelectedId(el.id)
    record({ action: 'add', elementId: el.id, shape: type, params: { x: el.x, y: el.y, width: el.width, height: el.height, fill }, elementCount: s.elements.length + 1 })
    return true
  }, [W, H, config, commit, record, opts])

  const remove = useCallback(() => {
    const s = stateRef.current
    const el = s.elements.find((e) => e.id === selectedId)
    if (!el) return
    commit({ ...s, elements: s.elements.filter((e) => e.id !== el.id) })
    setSelectedId(null)
    record({ action: 'delete', elementId: el.id, shape: el.type, elementCount: s.elements.length - 1 })
  }, [selectedId, commit, record])

  const duplicate = useCallback(() => {
    const s = stateRef.current
    const el = s.elements.find((e) => e.id === selectedId)
    if (!el) return false
    if (s.elements.length >= 500) { opts.onLimit?.(); return false }
    const d = Math.round(Math.min(W, H) * 0.03)
    const copy: DesignElement = { ...el, id: uid(), x: Math.min(W, el.x + d), y: Math.min(H, el.y + d) }
    const idx = s.elements.indexOf(el)
    const elements = [...s.elements.slice(0, idx + 1), copy, ...s.elements.slice(idx + 1)]
    commit({ ...s, elements })
    setSelectedId(copy.id)
    record({ action: 'duplicate', elementId: copy.id, shape: el.type, params: { sourceId: el.id }, elementCount: elements.length })
    return true
  }, [selectedId, W, H, commit, record, opts])

  const setColor = useCallback((hex: string) => {
    const s = stateRef.current
    const el = s.elements.find((e) => e.id === selectedId)
    const next=normaliseHex(hex)
    if (!el || !next || el.fill === next || (!config.allowCustomColors && !config.palette.some((c) => c.hex.toUpperCase() === next))) return
    commit({ ...s, elements: s.elements.map((e) => (e.id === el.id ? { ...e, fill: next } : e)) })
    record({ action: 'color', elementId: el.id, shape: el.type, params: { from: el.fill, to: next }, elementCount: s.elements.length })
  }, [selectedId, config.allowCustomColors, config.palette, commit, record])

  const setBackground = useCallback((hex: string) => {
    const s = stateRef.current
    if (!config.allowBackgroundChange || s.background === hex) return
    commit({ ...s, background: hex })
    record({ action: 'background', params: { from: s.background, to: hex }, elementCount: s.elements.length })
  }, [config.allowBackgroundChange, commit, record])

  const reorder = useCallback((dir: 1 | -1) => {
    const s = stateRef.current
    const idx = s.elements.findIndex((e) => e.id === selectedId)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= s.elements.length) return
    const elements = [...s.elements]
    ;[elements[idx], elements[target]] = [elements[target], elements[idx]]
    commit({ ...s, elements })
    record({ action: dir === 1 ? 'bring_forward' : 'send_backward', elementId: selectedId!, shape: elements[target].type, params: { fromLayer: idx, toLayer: target }, elementCount: elements.length })
  }, [selectedId, commit, record])

  const undo = useCallback(() => {
    if (!past.length) return
    const prev = past[past.length - 1]
    setPast((p) => p.slice(0, -1))
    setFuture((f) => [stateRef.current, ...f])
    setState(prev)
    if (selectedId && !prev.elements.some((e) => e.id === selectedId)) setSelectedId(null)
    record({ action: 'undo', elementCount: prev.elements.length })
  }, [past, selectedId, record])

  const redo = useCallback(() => {
    if (!future.length) return
    const next = future[0]
    setFuture((f) => f.slice(1))
    setPast((p) => [...p, stateRef.current])
    setState(next)
    if (selectedId && !next.elements.some((e) => e.id === selectedId)) setSelectedId(null)
    record({ action: 'redo', elementCount: next.elements.length })
  }, [future, selectedId, record])

  const beginGesture = useCallback(() => {
    gestureStart.current = stateRef.current
  }, [])

  const updateLive = useCallback((id: string, patch: Partial<DesignElement>) => {
    setState((s) => ({ ...s, elements: s.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
  }, [])

  const endGesture = useCallback((action: 'move' | 'resize' | 'rotate') => {
    const start = gestureStart.current
    gestureStart.current = null
    const now = stateRef.current
    if (!start || start === now) return
    const before = start.elements.find((e) => e.id === selectedId)
    const after = now.elements.find((e) => e.id === selectedId)
    if (!before || !after) return
    const changed = before.x !== after.x || before.y !== after.y || before.width !== after.width || before.height !== after.height || before.rotation !== after.rotation
    if (!changed) return
    setPast((p) => [...p.slice(-199), start])
    setFuture([])
    const params =
      action === 'move'
        ? { from: { x: round(before.x), y: round(before.y) }, to: { x: round(after.x), y: round(after.y) } }
        : action === 'resize'
          ? { from: { width: round(before.width), height: round(before.height) }, to: { width: round(after.width), height: round(after.height) } }
          : { from: round(before.rotation), to: round(after.rotation) }
    record({ action, elementId: after.id, shape: after.type, params, elementCount: now.elements.length })
  }, [selectedId, record])

  const nudge = useCallback((dx: number, dy: number) => {
    const s = stateRef.current
    const el = s.elements.find((e) => e.id === selectedId)
    if (!el) return
    const x = Math.max(0, Math.min(W, el.x + dx)), y = Math.max(0, Math.min(H, el.y + dy))
    commit({ ...s, elements: s.elements.map((e) => (e.id === el.id ? { ...e, x, y } : e)) })
    record({ action: 'move', elementId: el.id, shape: el.type, params: { from: { x: el.x, y: el.y }, to: { x, y }, via: 'keyboard' }, elementCount: s.elements.length })
  }, [selectedId, W, H, commit, record])

  const logSubmit = useCallback(() => {
    record({ action: 'submit', elementCount: stateRef.current.elements.length })
  }, [record])

  return {
    elements: state.elements,
    background: state.background,
    selectedId,
    selected,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    atLimit,
    log,
    select: setSelectedId,
    add, remove, duplicate, setColor, setBackground,
    bringForward: () => reorder(1),
    sendBackward: () => reorder(-1),
    undo, redo, nudge, beginGesture, updateLive, endGesture, logSubmit,
  }
}

export { SHAPE_MAP }
