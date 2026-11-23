/** Canonical server-side allow-list matching the shared 30-item UI library. */
export const DESIGN_SHAPE_TYPES = Object.freeze([
  'circle', 'ellipse', 'square', 'rectangle', 'roundedRectangle',
  'triangle', 'rightTriangle', 'diamond', 'trapezoid', 'parallelogram', 'semicircle', 'quarterCircle',
  'pentagon', 'hexagon', 'octagon',
  'star', 'fourPointStar', 'sixPointStar', 'sparkle', 'heart', 'crescent', 'sun',
  'line', 'curve', 'waveLine', 'arrow', 'arrowLeft', 'arrowUp', 'arrowDown',
  'cross',
])

/** Canonical fixed palette. Participants and models cannot add other colours. */
export const DESIGN_PALETTE = Object.freeze([
  { name: 'Red', hex: '#EF4444', group: 'warm' },
  { name: 'Coral', hex: '#F97360', group: 'warm' },
  { name: 'Orange', hex: '#F97316', group: 'warm' },
  { name: 'Amber', hex: '#F59E0B', group: 'warm' },
  { name: 'Gold', hex: '#EAB308', group: 'warm' },
  { name: 'Yellow', hex: '#FACC15', group: 'warm' },
  { name: 'Lime', hex: '#84CC16', group: 'cool' },
  { name: 'Green', hex: '#22C55E', group: 'cool' },
  { name: 'Emerald', hex: '#10B981', group: 'cool' },
  { name: 'Teal', hex: '#14B8A6', group: 'cool' },
  { name: 'Cyan', hex: '#06B6D4', group: 'cool' },
  { name: 'Sky', hex: '#0EA5E9', group: 'cool' },
  { name: 'Blue', hex: '#3B82F6', group: 'cool' },
  { name: 'Indigo', hex: '#6366F1', group: 'cool' },
  { name: 'Purple', hex: '#A855F7', group: 'cool' },
  { name: 'Pink', hex: '#EC4899', group: 'cool' },
  { name: 'Blush', hex: '#FBCFE8', group: 'pastel' },
  { name: 'Peach', hex: '#FED7AA', group: 'pastel' },
  { name: 'Butter', hex: '#FEF08A', group: 'pastel' },
  { name: 'Mint', hex: '#BBF7D0', group: 'pastel' },
  { name: 'Powder Blue', hex: '#BAE6FD', group: 'pastel' },
  { name: 'Lavender', hex: '#DDD6FE', group: 'pastel' },
  { name: 'Burgundy', hex: '#7F1D1D', group: 'deep' },
  { name: 'Forest', hex: '#166534', group: 'deep' },
  { name: 'Navy', hex: '#1E3A8A', group: 'deep' },
  { name: 'Plum', hex: '#581C87', group: 'deep' },
  { name: 'Black', hex: '#111827', group: 'neutral' },
  { name: 'Gray', hex: '#9CA3AF', group: 'neutral' },
  { name: 'White', hex: '#FFFFFF', group: 'neutral' },
  { name: 'Brown', hex: '#92400E', group: 'neutral' },
])

const DESIGN_SHAPE_SET = new Set(DESIGN_SHAPE_TYPES)

export function supportedShapes(values) {
  if (!Array.isArray(values)) return []
  return [...new Set(values.filter((value) => DESIGN_SHAPE_SET.has(value)))]
}

export function fixedPalette() {
  return DESIGN_PALETTE.map((colour) => ({ ...colour }))
}

const DESIGN_COLOUR_SET = new Set(DESIGN_PALETTE.map((colour) => colour.hex))
export function supportedColour(value) {
  return typeof value === 'string' && DESIGN_COLOUR_SET.has(value.toUpperCase())
}

