import type React from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { lineWeight, SHAPE_MAP } from '../lib/shapes'
import type { DesignElement } from '../lib/types'
import { ShapeGroup } from './ShapeSvg'

interface Props {
  width: number
  height: number
  background: string
  elements: DesignElement[]
  selectedId?: string | null
  interactive?: boolean
  onSelect?: (id: string | null) => void
  onGestureStart?: () => void
  onGestureUpdate?: (id: string, patch: Partial<DesignElement>) => void
  onGestureEnd?: (kind: 'move' | 'resize' | 'rotate') => void
  /** Rendered over the canvas, e.g. a loading state */
  overlay?: React.ReactNode
}

type Gesture =
  | { kind: 'move'; id: string; start: Pt; el: DesignElement; moved: boolean }
  | { kind: 'resize'; id: string; el: DesignElement; sx: number; sy: number; fixed: Pt }
  | { kind: 'rotate'; id: string; el: DesignElement }

interface Pt { x: number; y: number }

const rad = (d: number) => (d * Math.PI) / 180
const rot = (p: Pt, deg: number): Pt => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg))
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

const HANDLES: { sx: number; sy: number; cursor: string }[] = [
  { sx: -1, sy: -1, cursor: 'nwse-resize' }, { sx: 0, sy: -1, cursor: 'ns-resize' }, { sx: 1, sy: -1, cursor: 'nesw-resize' },
  { sx: 1, sy: 0, cursor: 'ew-resize' }, { sx: 1, sy: 1, cursor: 'nwse-resize' }, { sx: 0, sy: 1, cursor: 'ns-resize' },
  { sx: -1, sy: 1, cursor: 'nesw-resize' }, { sx: -1, sy: 0, cursor: 'ew-resize' },
]

export function DesignCanvas({
  width: W, height: H, background, elements, selectedId, interactive = false,
  onSelect, onGestureStart, onGestureUpdate, onGestureEnd, overlay,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [scale, setScale] = useState(0.4)
  const gesture = useRef<Gesture | null>(null)
  const [activeKind, setActiveKind] = useState<Gesture['kind'] | null>(null)

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
      if (!g) return
      const p = toCanvas(e)
      if (g.kind === 'move') {
        const dx = p.x - g.start.x, dy = p.y - g.start.y
        if (!g.moved && Math.hypot(dx, dy) < 2 / scale) return
        g.moved = true
        onGestureUpdate?.(g.id, {
          x: Math.max(0, Math.min(W, g.el.x + dx)),
          y: Math.max(0, Math.min(H, g.el.y + dy)),
        })
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
        onGestureUpdate?.(g.id, {
          width: Math.round(w), height: Math.round(h),
          x: g.fixed.x + off.x,
          y: g.fixed.y + off.y,
        })
      } else {
        let a = (Math.atan2(p.y - g.el.y, p.x - g.el.x) * 180) / Math.PI + 90
        a = e.shiftKey ? Math.round(a / 15) * 15 : Math.round(a)
        a = ((a % 360) + 360) % 360
        if (a > 180) a -= 360
        onGestureUpdate?.(g.id, { rotation: a })
      }
    }
    const onUp = () => {
      const g = gesture.current
      if (!g) return
      gesture.current = null
      setActiveKind(null)
      if (g.kind !== 'move' || g.moved) onGestureEnd?.(g.kind)
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
    if (!interactive) return
    e.stopPropagation()
    e.preventDefault()
    onSelect?.(el.id)
    onGestureStart?.()
    gesture.current = { kind: 'move', id: el.id, start: toCanvas(e), el, moved: false }
    setActiveKind('move')
  }

  const startResize = (e: React.PointerEvent, el: DesignElement, sx: number, sy: number) => {
    e.stopPropagation()
    e.preventDefault()
    onGestureStart?.()
    // The anchor is the opposite handle (or opposite edge midpoint), expressed in canvas space.
    const fixedLocal = { x: -sx * el.width / 2, y: -sy * el.height / 2 }
    const fr = rot(fixedLocal, el.rotation)
    gesture.current = { kind: 'resize', id: el.id, el, sx, sy, fixed: { x: el.x + fr.x, y: el.y + fr.y } }
    setActiveKind('resize')
  }

  const startRotate = (e: React.PointerEvent, el: DesignElement) => {
    e.stopPropagation()
    e.preventDefault()
    onGestureStart?.()
    gesture.current = { kind: 'rotate', id: el.id, el }
    setActiveKind('rotate')
  }

  const weight = lineWeight(W, H)
  const px = 1 / scale // one screen pixel in canvas units
  const sel = interactive ? elements.find((e) => e.id === selectedId) : undefined
  const selDef = sel ? SHAPE_MAP[sel.type] : null

  return (
    <div ref={wrapRef} className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="relative shadow-[0_1px_3px_rgba(15,23,42,0.08),0_12px_32px_-8px_rgba(15,23,42,0.18)]" style={{ width: W * scale, height: H * scale }}>
        <svg
          ref={svgRef}
          width={W * scale}
          height={H * scale}
          viewBox={`0 0 ${W} ${H}`}
          className="block touch-none select-none"
          onPointerDown={() => interactive && onSelect?.(null)}
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
