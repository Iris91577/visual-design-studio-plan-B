import type { PaletteColor } from './types'

const colors = (group: PaletteColor['group'], values: [string,string][]): PaletteColor[] => values.map(([name,hex])=>({name,hex,group}))
/** A broad 48-colour starter palette. It is a menu, never a checklist. */
export const DEFAULT_PALETTE: PaletteColor[] = [
  ...colors('warm', [['Crimson','#DC2626'],['Red','#EF4444'],['Coral','#F97360'],['Vermilion','#EA580C'],['Orange','#F97316'],['Amber','#F59E0B'],['Gold','#EAB308'],['Yellow','#FACC15']]),
  ...colors('cool', [['Lime','#84CC16'],['Green','#22C55E'],['Emerald','#10B981'],['Teal','#14B8A6'],['Cyan','#06B6D4'],['Sky','#0EA5E9'],['Blue','#3B82F6'],['Indigo','#6366F1'],['Violet','#8B5CF6'],['Purple','#A855F7'],['Fuchsia','#D946EF'],['Pink','#EC4899']]),
  ...colors('pastel', [['Blush','#FBCFE8'],['Peach','#FED7AA'],['Butter','#FEF08A'],['Mint','#BBF7D0'],['Seafoam','#99F6E4'],['Powder Blue','#BAE6FD'],['Lavender','#DDD6FE'],['Lilac','#F5D0FE']]),
  ...colors('deep', [['Burgundy','#7F1D1D'],['Rust','#9A3412'],['Olive','#4D7C0F'],['Forest','#166534'],['Deep Teal','#115E59'],['Navy','#1E3A8A'],['Midnight','#172554'],['Plum','#581C87']]),
  ...colors('neutral', [['Black','#111827'],['Charcoal','#374151'],['Slate','#64748B'],['Gray','#9CA3AF'],['Silver','#D1D5DB'],['Cloud','#E5E7EB'],['Ivory','#FFFBEB'],['White','#FFFFFF'],['Chocolate','#713F12'],['Brown','#92400E'],['Tan','#D6B98C'],['Beige','#E7D7C1']]),
]
export const HEX_PATTERN=/^#[0-9A-F]{6}$/i
export function normaliseHex(value:string){const v=value.trim().toUpperCase();if(/^#[0-9A-F]{3}$/.test(v))return '#'+[...v.slice(1)].map(x=>x+x).join('');return HEX_PATTERN.test(v)?v:null}
export function isLight(hex:string){const h=hex.replace('#',''),r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);return(r*299+g*587+b*114)/1000>200}
