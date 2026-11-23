import { lineWeight, SHAPE_MAP, shapePrimitives } from '../lib/shapes'
import { elementTransform } from '../lib/render'
import type { DesignElement, ShapeType } from '../lib/types'

export function ShapeGroup({ el, weight }: { el: DesignElement; weight: number }) {
  const rotation = el.rotation + (SHAPE_MAP[el.type]?.defaultRotation ?? 0)
  return (
    <g transform={elementTransform({ ...el, rotation })}>
      {shapePrimitives(el, weight).map((p, i) =>
        p.stroke ? (
          <path key={i} d={p.d} fill="none" stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.dash} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path key={i} d={p.d} fill={p.fill} />
        ),
      )}
    </g>
  )
}

/** Small thumbnail used in the Elements panel. */
export function ShapeThumb({ type, color = '#3F4A5A', size = 44 }: { type: ShapeType; color?: string; size?: number }) {
  const box = { w: 64, h: 64 }
  const dims: Record<string, [number, number]> = {
    ellipse: [60, 38], rectangle: [60, 38], semicircle: [60, 30], diamond: [44, 58],
    line: [58, 12], curve: [58, 30], waveLine: [58, 30], arrow: [58, 22], arrowLeft: [58, 22], arrowUp: [58, 22], arrowDown: [58, 22], triangle: [56, 50],
  }
  const [w, h] = dims[type] ?? [52, 52]
  const el: DesignElement = { id: 't', type, x: box.w / 2, y: box.h / 2, width: w, height: h, rotation: type === 'line' ? -30 : 0, fill: color }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden>
      <ShapeGroup el={el} weight={5} />
    </svg>
  )
}

/** Static, non-interactive render of a full design (admin previews, AI result). */
export function DesignPreview({
  width, height, background, elements, className,
}: { width: number; height: number; background: string; elements: DesignElement[]; className?: string }) {
  const weight = lineWeight(width, height)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="xMidYMid meet">
      <rect width={width} height={height} fill={background} />
      {elements.map((el) => <ShapeGroup key={el.id} el={el} weight={weight} />)}
    </svg>
  )
}
