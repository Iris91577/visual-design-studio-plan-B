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
  selectedIds: string[]
  selected: DesignElement | null
  canUndo: boolean
  canRedo: boolean
  atLimit: boolean
  log: ActionLogEntry[]
  select: (id: string | null, toggle?: boolean) => void
  selectMany: (ids: string[], extend?: boolean) => void
  add: (type: ShapeType) => boolean
  remove: () => void
  duplicate: () => boolean
  copySelection: () => boolean
  pasteSelection: () => boolean
  setColor: (hex: string) => void
  setBackground: (hex: string) => void
  bringForward: () => void
  sendBackward: () => void
  undo: () => void
  redo: () => void
  nudge: (dx: number, dy: number) => void
  /** Gesture lifecycle for drag / resize / rotate: live updates are not added to history until committed. */
  beginGesture: () => void
  updateLive: (patches: ReadonlyMap<string, Partial<DesignElement>>) => void
  endGesture: (action: 'move' | 'resize' | 'rotate') => void
  logSubmit: () => void
}

const round = (n: number) => Math.round(n * 10) / 10

export function translatedPositions(elements: DesignElement[], dx: number, dy: number, width: number, height: number) {
  const clampOffset = (positions: number[], offset: number, limit: number) => {
    const min = Math.min(...positions)
    const max = Math.max(...positions)
    return Math.max(-Math.max(0, min), Math.min(Math.max(0, limit - max), offset))
  }
  const x = clampOffset(elements.map((el) => el.x), dx, width)
  const y = clampOffset(elements.map((el) => el.y), dy, height)
  return new Map(elements.map((el) => [el.id, { x: el.x + x, y: el.y + y }]))
}

export function useEditor(
  config: ExperimentConfig,
  opts: { initial?: Snapshot; onLimit?: () => void; onChange?: (s: Snapshot, log: ActionLogEntry[]) => void } = {},
): EditorApi {
  const { width: W, height: H } = config.canvas
  const [state, setState] = useState<Snapshot>(
    () => opts.initial ?? { elements: [], background: config.canvas.background },
  )
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [past, setPast] = useState<Snapshot[]>([])
  const [future, setFuture] = useState<Snapshot[]>([])
  const [log, setLog] = useState<ActionLogEntry[]>([])
  const startedAt = useRef(Date.now())
  const gestureStart = useRef<Snapshot | null>(null)
  const clipboard = useRef<{ elements: DesignElement[]; pastes: number } | null>(null)
  const stateRef = useRef(state)

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
    stateRef.current = next
    setState(next)
  }, [])

  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null
  const selected = state.elements.find((e) => e.id === selectedId) ?? null
  const select = useCallback((id: string | null, toggle = false) => {
    setSelectedIds((ids) => {
      if (!id) return []
      if (!toggle) return [id]
      return ids.includes(id) ? ids.filter((selected) => selected !== id) : [...ids, id]
    })
  }, [])
  const selectMany = useCallback((ids: string[], extend = false) => {
    setSelectedIds((previous) => extend ? [...new Set([...previous, ...ids])] : ids)
  }, [])
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
    select(el.id)
    record({ action: 'add', elementId: el.id, shape: type, params: { x: el.x, y: el.y, width: el.width, height: el.height, fill }, elementCount: s.elements.length + 1 })
    return true
  }, [W, H, config, commit, record, opts, select])

  const remove = useCallback(() => {
    const s = stateRef.current
    const ids = new Set(selectedIds)
    const removed = s.elements.filter((el) => ids.has(el.id))
    if (!removed.length) return
    commit({ ...s, elements: s.elements.filter((el) => !ids.has(el.id)) })
    select(null)
    removed.forEach((el, index) => record({
      action: 'delete', elementId: el.id, shape: el.type, elementCount: s.elements.length - index - 1,
    }))
  }, [selectedIds, commit, record, select])

  const insertCopies = useCallback((source: DesignElement[], via: 'duplicate' | 'clipboard', pastes = 1) => {
    const s = stateRef.current
    if (!source.length) return false
    if (s.elements.length + source.length > 500) { opts.onLimit?.(); return false }
    const step = Math.max(1, Math.round(Math.min(W, H) * 0.03)) * pastes
    const dx = source.some((el) => el.x + step > W) ? -step : step
    const dy = source.some((el) => el.y + step > H) ? -step : step
    const positions = translatedPositions(source, dx, dy, W, H)
    const copies = source.map((el) => ({ ...el, ...positions.get(el.id), id: uid() }))
    const lastSource = source[source.length - 1]
    const after = via === 'duplicate' ? s.elements.indexOf(lastSource) + 1 : s.elements.length
    const elements = [...s.elements.slice(0, after), ...copies, ...s.elements.slice(after)]
    commit({ ...s, elements })
    selectMany(copies.map((el) => el.id))
    copies.forEach((el, index) => record({
      action: 'duplicate', elementId: el.id, shape: el.type,
      params: via === 'clipboard' ? { sourceId: source[index].id, via } : { sourceId: source[index].id },
      elementCount: s.elements.length + index + 1,
    }))
    return true
  }, [W, H, commit, record, opts, selectMany])

  const duplicate = useCallback(() => {
    const ids = new Set(selectedIds)
    return insertCopies(stateRef.current.elements.filter((el) => ids.has(el.id)), 'duplicate')
  }, [selectedIds, insertCopies])

  const copySelection = useCallback(() => {
    const ids = new Set(selectedIds)
    const elements = stateRef.current.elements.filter((el) => ids.has(el.id))
    if (!elements.length) return false
    clipboard.current = { elements, pastes: 0 }
    return true
  }, [selectedIds])

  const pasteSelection = useCallback(() => {
    const copied = clipboard.current
    if (!copied) return false
    if (insertCopies(copied.elements, 'clipboard', copied.pastes + 1)) copied.pastes++
    return true
  }, [insertCopies])

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
    const current = stateRef.current
    stateRef.current = prev
    setFuture((f) => [current, ...f])
    setState(prev)
    setSelectedIds((ids) => ids.filter((id) => prev.elements.some((el) => el.id === id)))
    record({ action: 'undo', elementCount: prev.elements.length })
  }, [past, record])

  const redo = useCallback(() => {
    if (!future.length) return
    const next = future[0]
    setFuture((f) => f.slice(1))
    const current = stateRef.current
    setPast((p) => [...p, current])
    stateRef.current = next
    setState(next)
    setSelectedIds((ids) => ids.filter((id) => next.elements.some((el) => el.id === id)))
    record({ action: 'redo', elementCount: next.elements.length })
  }, [future, record])

  const beginGesture = useCallback(() => {
    gestureStart.current = stateRef.current
  }, [])

  const updateLive = useCallback((patches: ReadonlyMap<string, Partial<DesignElement>>) => {
    const current = stateRef.current
    const next = {
      ...current,
      elements: current.elements.map((el) => patches.has(el.id) ? { ...el, ...patches.get(el.id) } : el),
    }
    stateRef.current = next
    setState(next)
  }, [])

  const endGesture = useCallback((action: 'move' | 'resize' | 'rotate') => {
    const start = gestureStart.current
    gestureStart.current = null
    const now = stateRef.current
    if (!start || start === now) return
    const beforeById = new Map(start.elements.map((el) => [el.id, el]))
    const changes = now.elements.flatMap((after) => {
      const before = beforeById.get(after.id)
      if (!before || before === after) return []
      const changed = before.x !== after.x || before.y !== after.y || before.width !== after.width || before.height !== after.height || before.rotation !== after.rotation
      return changed ? [{ before, after }] : []
    })
    if (!changes.length) return
    setPast((p) => [...p.slice(-199), start])
    setFuture([])
    for (const { before, after } of changes) {
      const params =
        action === 'move'
          ? { from: { x: round(before.x), y: round(before.y) }, to: { x: round(after.x), y: round(after.y) } }
          : action === 'resize'
            ? { from: { width: round(before.width), height: round(before.height) }, to: { width: round(after.width), height: round(after.height) } }
            : { from: round(before.rotation), to: round(after.rotation) }
      record({ action, elementId: after.id, shape: after.type, params, elementCount: now.elements.length })
    }
  }, [record])

  const nudge = useCallback((dx: number, dy: number) => {
    const s = stateRef.current
    const ids = new Set(selectedIds)
    const group = s.elements.filter((el) => ids.has(el.id))
    if (!group.length) return
    const positions = translatedPositions(group, dx, dy, W, H)
    if (group.every((el) => positions.get(el.id)?.x === el.x && positions.get(el.id)?.y === el.y)) return
    commit({ ...s, elements: s.elements.map((el) => positions.has(el.id) ? { ...el, ...positions.get(el.id) } : el) })
    group.forEach((el) => record({
      action: 'move', elementId: el.id, shape: el.type,
      params: { from: { x: el.x, y: el.y }, to: positions.get(el.id), via: 'keyboard' },
      elementCount: s.elements.length,
    }))
  }, [selectedIds, W, H, commit, record])

  const logSubmit = useCallback(() => {
    record({ action: 'submit', elementCount: stateRef.current.elements.length })
  }, [record])

  return {
    elements: state.elements,
    background: state.background,
    selectedIds,
    selected,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    atLimit,
    log,
    select, selectMany,
    add, remove, duplicate, copySelection, pasteSelection, setColor, setBackground,
    bringForward: () => reorder(1),
    sendBackward: () => reorder(-1),
    undo, redo, nudge, beginGesture, updateLive, endGesture, logSubmit,
  }
}

export { SHAPE_MAP }
