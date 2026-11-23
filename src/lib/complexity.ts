import type { ComplexityMetrics, DesignElement } from './types'
import { shapeFamily } from './shapes'

/** Deterministic, condition-blind metrics calculated from the shared element data. */
export function computeComplexity(elements: DesignElement[], _width?: number, _height?: number): ComplexityMetrics {
  const elementCount=elements.length
  const distinctShapeTypes=new Set(elements.map(e=>shapeFamily(e.type))).size
  const distinctColors=new Set(elements.map(e=>e.fill.toUpperCase())).size
  return{elementCount,distinctShapeTypes,distinctColors}
}
