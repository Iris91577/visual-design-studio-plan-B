export interface CanvasPreset {
  id: string
  name: string
  width: number
  height: number
  ratio: string
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: 'square-post', name: 'Square Post', width: 1080, height: 1080, ratio: '1:1' },
  { id: 'portrait-post', name: 'Portrait Post', width: 1080, height: 1350, ratio: '4:5' },
  { id: 'landscape-post', name: 'Landscape Post', width: 1200, height: 675, ratio: '16:9' },
  { id: 'portrait-poster', name: 'Portrait Poster', width: 1200, height: 1600, ratio: '3:4' },
  { id: 'landscape-poster', name: 'Landscape Poster', width: 1600, height: 1200, ratio: '4:3' },
  { id: 'phone-wallpaper', name: 'Phone Wallpaper', width: 1080, height: 1920, ratio: '9:16' },
  { id: 'desktop-wallpaper', name: 'Desktop Wallpaper', width: 1920, height: 1080, ratio: '16:9' },
]

export const CUSTOM_PRESET_ID = 'custom'
export const CANVAS_MIN = 200
export const CANVAS_MAX = 4000

export function presetLabel(presetId: string, width: number, height: number): string {
  const p = CANVAS_PRESETS.find((x) => x.id === presetId)
  return `${p ? p.name : 'Custom Size'} · ${width} × ${height}`
}
