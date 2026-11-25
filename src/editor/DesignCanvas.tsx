import type React from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { lineWeight, SHAPE_MAP } from '../lib/shapes'
import type { DesignElement } from '../lib/types'
import { ShapeGroup } from './ShapeSvg'
import { translatedPositions } from './useEditor'

interface Props {
  width: number
  height: number
  background: string
  elements: DesignElement[]
  selectedIds?: string[]
  interactive?: boolean
  onSelect?: (id: string | null, toggle?: boolean) => void
  onSelectMany?: (ids: string[], extend?: boolean) => void
  onGestureStart?: () => void
  onGestureUpdate?: (patches: ReadonlyMap<string, Partial<DesignElement>>) => void
  onGestureEnd?: (kind: 'move' | 'resize' | 'rotate') => void
  /** Rendered over the canvas, e.g. a loading state */
  overlay?: React.ReactNode
}

type Gesture = { pointerId: number } & (
  | { kind: 'move'; id: string; start: Pt; group: DesignElement[]; moved: boolean }
  | { kind: 'resize'; el: DesignElement; sx: number; sy: number; fixed: Pt }
  | { kind: 'rotate'; el: DesignElement }
  | { kind: 'marquee'; start: Pt; extend: boolean }
)

interface Pt { x: number; y: number }
interface Box { x: number; y: number; width: number; height: number }

function selectionBox(start: Pt, end: Pt, width: number, height: number): Box {
  const x = Math.min(width, Math.max(0, end.x))
  const y = Math.min(height, Math.max(0, end.y))
  return { x: Math.min(start.x, x), y: Math.min(start.y, y), width: Math.abs(x - start.x), height: Math.abs(y - start.y) }
}

const rad = (d: number) => (d * Math.PI) / 180
const rot = (p: Pt, deg: number): Pt => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg))
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

function intersectsSelection(el: DesignElement, box: Box): boolean {
  const c = Math.abs(Math.cos(rad(el.rotation)))
  const s = Math.abs(Math.sin(rad(el.rotation)))
  const halfWidth = (el.width * c + el.height * s) / 2
  const halfHeight = (el.width * s + el.height * c) / 2
  return el.x + halfWidth >= box.x && el.x - halfWidth <= box.x + box.width
    && el.y + halfHeight >= box.y && el.y - halfHeight <= box.y + box.height
}

const HANDLES: { sx: number; sy: number; cursor: string }[] = [
  { sx: -1, sy: -1, cursor: 'nwse-resize' }, { sx: 0, sy: -1, cursor: 'ns-resize' }, { sx: 1, sy: -1, cursor: 'nesw-resize' },
  { sx: 1, sy: 0, cursor: 'ew-resize' }, { sx: 1, sy: 1, cursor: 'nwse-resize' }, { sx: 0, sy: 1, cursor: 'ns-resize' },
  { sx: -1, sy: 1, cursor: 'nesw-resize' }, { sx: -1, sy: 0, cursor: 'ew-resize' },
]

export function DesignCanvas({
  width: W, height: H, background, elements, selectedIds = [], interactive = false,
  onSelect, onSelectMany, onGestureStart, onGestureUpdate, onGestureEnd, overlay,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [scale, setScale] = useState(0.4)
  const gesture = useRef<Gesture | null>(null)
  const [activeKind, setActiveKind] = useState<Gesture['kind'] | null>(null)
  const [marquee, setMarquee] = useState<Box | null>(null)

  // Fit the canvas to the available workspace while keeping its aspect ratio.
  useLayoutEffect(() => {
    const node = wrapRef.current
    if (!node) return
    const fit = () => {
      const pad = 48
      const s = Math.min((node.clientWidth - pad) / W, (node.clientHeight - pad) / H)
      setScale(Math.max(0.05, s))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(node)
    return () => ro.disconnect()
  }, [W, H])

  const toCanvas = (e: PointerEvent | React.PointerEvent): Pt => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
  }

  useEffect(() => {
    if (!interactive) return
    const onMove = (e: PointerEvent) => {
      const g = gesture.current
      if (!g || g.pointerId !== e.pointerId) return
      const p = toCanvas(e)
      if (g.kind === 'marquee') {
        setMarquee(Math.hypot(p.x - g.start.x, p.y - g.start.y) >= 3 / scale ? selectionBox(g.start, p, W, H) : null)
      } else if (g.kind === 'move') {
        const dx = p.x - g.start.x, dy = p.y - g.start.y
        if (!g.moved && Math.hypot(dx, dy) < 2 / scale) return
        g.moved = true
        onGestureUpdate?.(translatedPositions(g.group, dx, dy, W, H))
      } else if (g.kind === 'resize') {
        const def = SHAPE_MAP[g.el.type]
        const min = Math.max(8, Math.min(W, H) * 0.015)
        const local = rot({ x: p.x - g.fixed.x, y: p.y - g.fixed.y }, -g.el.rotation)
        let w = g.sx === 0 ? g.el.width : Math.max(min, local.x * g.sx)
        let h = g.sy === 0 ? g.el.height : Math.max(min, local.y * g.sy)
        if (def.lockAspect || (e.shiftKey && g.sx !== 0 && g.sy !== 0)) {
          if (g.sx === 0) w = h * (g.el.width / g.el.height)
          else if (g.sy === 0) h = w * (g.el.height / g.el.width)
          else {
            const ratio = g.el.width / g.el.height
            const s = Math.max(w / g.el.width, h / g.el.height)
            w = g.el.width * s
            h = w / ratio
          }
        }
        if (def.isLine) h = g.el.height
        // Centre sits halfway between the fixed anchor and the dragged handle, in the element's frame.
        const off = rot({ x: (g.sx * w) / 2, y: (g.sy * h) / 2 }, g.el.rotation)
        onGestureUpdate?.(new Map([[g.el.id, {
          width: Math.round(w), height: Math.round(h),
          x: g.fixed.x + off.x,
          y: g.fixed.y + off.y,
        }]]))
      } else {
        let a = (Math.atan2(p.y - g.el.y, p.x - g.el.x) * 180) / Math.PI + 90
        a = e.shiftKey ? Math.round(a / 15) * 15 : Math.round(a)
        a = ((a % 360) + 360) % 360
        if (a > 180) a -= 360
        onGestureUpdate?.(new Map([[g.el.id, { rotation: a }]]))
      }
    }
    const onUp = (e: PointerEvent) => {
      const g = gesture.current
      if (!g || g.pointerId !== e.pointerId) return
      gesture.current = null
      setActiveKind(null)
      if (g.kind === 'marquee') {
        setMarquee(null)
        if (e.type === 'pointercancel') return
        const p = toCanvas(e)
        if (Math.hypot(p.x - g.start.x, p.y - g.start.y) < 3 / scale) {
          if (!g.extend) onSelect?.(null)
          return
        }
        const box = selectionBox(g.start, p, W, H)
        onSelectMany?.(elements.filter((el) => intersectsSelection(el, box)).map((el) => el.id), g.extend)
        return
      }
      onGestureEnd?.(g.kind)
      if (g.kind === 'move' && !g.moved && e.type === 'pointerup') onSelect?.(g.id)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  })

  const startMove = (e: React.PointerEvent, el: DesignElement) => {
    if (!interactive || e.button !== 0 || gesture.current) return
    e.stopPropagation()
    e.preventDefault()
    svgRef.current?.focus({ preventScroll: true })
    if (e.shiftKey) {
      onSelect?.(el.id, true)
      return
    }
    const isSelected = selectedIds.includes(el.id)
    if (!isSelected) onSelect?.(el.id)
    onGestureStart?.()
    const group = isSelected ? elements.filter((item) => selectedIds.includes(item.id)) : [el]
    gesture.current = { kind: 'move', pointerId: e.pointerId, id: el.id, start: toCanvas(e), group, moved: false }
    setActiveKind('move')
  }

  const startMarquee = (e: React.PointerEvent) => {
    if (!interactive || e.button !== 0 || gesture.current) return
    e.preventDefault()
    svgRef.current?.focus({ preventScroll: true })
    gesture.current = { kind: 'marquee', pointerId: e.pointerId, start: toCanvas(e), extend: e.shiftKey }
    setActiveKind('marquee')
  }

  const startResize = (e: React.PointerEvent, el: DesignElement, sx: number, sy: number) => {
    if (e.button !== 0 || gesture.current) return
    e.stopPropagation()
    e.preventDefault()
    onGestureStart?.()
    // The anchor is the opposite handle (or opposite edge midpoint), expressed in canvas space.
    const fixedLocal = { x: -sx * el.width / 2, y: -sy * el.height / 2 }
    const fr = rot(fixedLocal, el.rotation)
    gesture.current = { kind: 'resize', pointerId: e.pointerId, el, sx, sy, fixed: { x: el.x + fr.x, y: el.y + fr.y } }
    setActiveKind('resize')
  }

  const startRotate = (e: React.PointerEvent, el: DesignElement) => {
    if (e.button !== 0 || gesture.current) return
    e.stopPropagation()
    e.preventDefault()
    onGestureStart?.()
    gesture.current = { kind: 'rotate', pointerId: e.pointerId, el }
    setActiveKind('rotate')
  }

  const weight = lineWeight(W, H)
  const px = 1 / scale // one screen pixel in canvas units
  const selected = interactive ? elements.filter((el) => selectedIds.includes(el.id)) : []
  const sel = selected.length === 1 ? selected[0] : undefined
  const selDef = sel ? SHAPE_MAP[sel.type] : null

  return (
    <div ref={wrapRef} className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="relative shadow-[0_1px_3px_rgba(15,23,42,0.08),0_12px_32px_-8px_rgba(15,23,42,0.18)]" style={{ width: W * scale, height: H * scale }}>
        <svg
          ref={svgRef}
          width={W * scale}
          height={H * scale}
          viewBox={`0 0 ${W} ${H}`}
          tabIndex={interactive ? -1 : undefined}
          className="block touch-none select-none outline-none"
          onPointerDown={startMarquee}
        >
          <defs>
            <clipPath id="vds-canvas-clip"><rect width={W} height={H} /></clipPath>
          </defs>
          <rect width={W} height={H} fill={background} />
          <g clipPath="url(#vds-canvas-clip)">
            {elements.map((el) => (
              <g
                key={el.id}
                onPointerDown={(e) => startMove(e, el)}
                style={{ cursor: interactive ? (activeKind === 'move' ? 'grabbing' : 'move') : 'default' }}
              >
                <ShapeGroup el={el} weight={weight} />
                {/* Generous invisible hit area so thin lines stay easy to grab */}
                {interactive && SHAPE_MAP[el.type].category === 'lines' && (
                  <rect
                    transform={`translate(${el.x} ${el.y}) rotate(${el.rotation})`}
                    x={-el.width / 2} y={-Math.max(el.height, 18 * px) / 2}
                    width={el.width} height={Math.max(el.height, 18 * px)}
                    fill="transparent"
                  />
                )}
              </g>
            ))}
          </g>

          {selected.length > 1 && selected.map((el) => (
            <rect key={el.id} transform={`translate(${el.x} ${el.y}) rotate(${el.rotation})`}
              x={-el.width / 2} y={-el.height / 2} width={el.width} height={el.height}
              fill="none" stroke="#2563EB" strokeWidth={1.5 * px} pointerEvents="none"
            />
          ))}
          {marquee && (
            <rect {...marquee} fill="#2563EB" fillOpacity={0.12} stroke="#2563EB"
              strokeWidth={px} strokeDasharray={`${4 * px} ${3 * px}`} pointerEvents="none"
            />
          )}
          {sel && selDef && (
            <g transform={`translate(${sel.x} ${sel.y}) rotate(${sel.rotation})`}>
              <rect
                x={-sel.width / 2} y={-sel.height / 2} width={sel.width} height={sel.height}
                fill="none" stroke="#2563EB" strokeWidth={1.5 * px} pointerEvents="none"
              />
              {activeKind !== 'move' && (
                <>
                  <line x1={0} y1={-sel.height / 2} x2={0} y2={-sel.height / 2 - 26 * px} stroke="#2563EB" strokeWidth={1.5 * px} />
                  <g transform={`translate(0 ${-sel.height / 2 - 30 * px})`} onPointerDown={(e) => startRotate(e, sel)} style={{ cursor: 'grab' }}>
                    <circle r={9 * px} fill="#fff" stroke="#2563EB" strokeWidth={1.5 * px} />
                    <path
                      d={`M${-4 * px},${-1 * px} A${4 * px},${4 * px} 0 1,1 ${-1 * px},${4 * px}`}
                      fill="none" stroke="#2563EB" strokeWidth={1.6 * px} strokeLinecap="round"
                    />
                  </g>
                  {HANDLES.filter((h) => !(selDef.isLine && h.sy !== 0) && !(selDef.lockAspect && (h.sx === 0 || h.sy === 0))).map((h) => {
                    const corner = h.sx !== 0 && h.sy !== 0
                    const hw = (corner ? 10 : h.sx === 0 ? 18 : 7) * px
                    const hh = (corner ? 10 : h.sy === 0 ? 18 : 7) * px
                    return (
                      <rect
                        key={`${h.sx}${h.sy}`}
                        x={(h.sx * sel.width) / 2 - hw / 2}
                        y={(h.sy * sel.height) / 2 - hh / 2}
                        width={hw} height={hh} rx={corner ? hw / 2 : 3 * px}
                        fill="#fff" stroke="#2563EB" strokeWidth={1.5 * px}
                        style={{ cursor: h.cursor }}
                        onPointerDown={(e) => startResize(e, sel, h.sx, h.sy)}
                      />
                    )
                  })}
                </>
              )}
            </g>
          )}
        </svg>
        {overlay}
      </div>
      <div className="pointer-events-none absolute bottom-3 right-4 rounded-md bg-white/80 px-2 py-1 font-mono text-[11px] text-slate-500 ring-1 ring-slate-200 backdrop-blur">
        {W} × {H}px · {Math.round(scale * 100)}%
      </div>
    </div>
  )
}
