export type ShapeType =
  | 'circle' | 'ellipse' | 'square' | 'rectangle' | 'roundedRectangle' | 'capsule'
  | 'triangle' | 'rightTriangle' | 'diamond' | 'trapezoid' | 'parallelogram'
  | 'pentagon' | 'hexagon' | 'heptagon' | 'octagon' | 'nonagon' | 'decagon' | 'dodecagon'
  | 'star' | 'fourPointStar' | 'sixPointStar' | 'sparkle' | 'heart' | 'crescent' | 'sun' | 'burst'
  | 'blobOne' | 'blobTwo' | 'teardrop' | 'leaf' | 'cloud' | 'petal' | 'pebble' | 'waveBlock'
  | 'flowerFive' | 'flowerSix' | 'clover' | 'snowflake' | 'tree' | 'mountain'
  | 'semicircle' | 'quarterCircle' | 'sector' | 'ring' | 'arch' | 'chevron' | 'shield' | 'ribbon'
  | 'line' | 'dashedLine' | 'curve' | 'arc' | 'waveLine' | 'zigzagLine' | 'arrow' | 'arrowLeft' | 'arrowUp' | 'arrowDown' | 'doubleArrow'
  | 'cross' | 'plus' | 'lightning' | 'check' | 'xMark' | 'speechBubble' | 'locationPin' | 'musicNote'
  | 'rectangleFrame' | 'circleFrame' | 'roundedFrame'

export type ShapeCategory =
  | 'basic' | 'polygons' | 'decorative' | 'organic' | 'nature'
  | 'abstract' | 'lines' | 'symbols' | 'frames'

/** A single editable element on the canvas. Coordinates are in canvas pixels. */
export interface DesignElement {
  id: string
  type: ShapeType
  /** Center x */
  x: number
  /** Center y */
  y: number
  width: number
  height: number
  /** Degrees, clockwise */
  rotation: number
  /** HEX colour from the experiment palette (stroke colour for lines) */
  fill: string
}

export interface PaletteColor {
  name: string
  hex: string
  group?: 'warm' | 'cool' | 'pastel' | 'deep' | 'neutral'
}

export type Condition = 'human' | 'ai'

export type GenerationMethod = 'structured' | 'image'

export interface CanvasSpec {
  presetId: string
  width: number
  height: number
  background: string
}

export interface ExperimentConfig {
  id: string
  name: string
  version: number
  status: 'draft' | 'published' | 'archived'
  canvas: CanvasSpec
  allowBackgroundChange: boolean
  allowCustomColors: boolean
  allowedShapes: ShapeType[]
  palette: PaletteColor[]
  aiGenerationLimit: number
  ai: {
    method: GenerationMethod
    model: string
    temperature: number
    technicalRetries: number
  }
  returnUrl: string
  /** Opaque link codes — one per condition, so participants cannot switch mode by editing the URL */
  links: Record<Condition, string>
  createdAt: string
  updatedAt: string
}

export interface ActionLogEntry {
  at: string
  /** Milliseconds since the session started */
  elapsedMs: number
  action:
    | 'add' | 'delete' | 'move' | 'resize' | 'rotate' | 'color' | 'duplicate'
    | 'undo' | 'redo' | 'bring_forward' | 'send_backward' | 'background' | 'submit'
  elementId?: string
  shape?: ShapeType
  params?: Record<string, unknown>
  /** Element count after the action */
  elementCount: number
}

export interface AiGenerationRecord {
  id: string
  prompt: string
  method: GenerationMethod
  model: string
  modelVersion: string
  parameters: Record<string, unknown>
  requestedAt: string
  respondedAt: string | null
  success: boolean
  failureReason: string | null
  retries: number
  rawOutput: string
  validation: { passed: boolean; issues: string[] }
}

export interface ParticipantSession {
  id: string
  participantId: string
  experimentId: string
  experimentVersion: number
  condition: Condition
  startedAt: string
  submittedAt: string | null
  status: 'in_progress' | 'submitted' | 'abandoned'
  completionCode: string | null
  elements: DesignElement[]
  background: string
  actionLog: ActionLogEntry[]
  aiGenerations: AiGenerationRecord[]
  /** Immutable experiment snapshot captured when the participant submitted. */
  experiment?: ExperimentConfig
  /** Authenticated researcher-only URL for the submitted bitmap. */
  imageUrl?: string
}

export interface ComplexityMetrics {
  elementCount: number
  distinctShapeTypes: number
  distinctColors: number
}
