import type { PaletteColor } from './types'

const colors = (group: PaletteColor['group'], values: [string,string][]): PaletteColor[] => values.map(([name,hex])=>({name,hex,group}))
/** Fixed 30-colour study palette shared by the Human and AI conditions. */
export const DEFAULT_PALETTE: PaletteColor[] = [
  ...colors('warm', [['Red','#EF4444'],['Coral','#F97360'],['Orange','#F97316'],['Amber','#F59E0B'],['Gold','#EAB308'],['Yellow','#FACC15']]),
  ...colors('cool', [['Lime','#84CC16'],['Green','#22C55E'],['Emerald','#10B981'],['Teal','#14B8A6'],['Cyan','#06B6D4'],['Sky','#0EA5E9'],['Blue','#3B82F6'],['Indigo','#6366F1'],['Purple','#A855F7'],['Pink','#EC4899']]),
  ...colors('pastel', [['Blush','#FBCFE8'],['Peach','#FED7AA'],['Butter','#FEF08A'],['Mint','#BBF7D0'],['Powder Blue','#BAE6FD'],['Lavender','#DDD6FE']]),
  ...colors('deep', [['Burgundy','#7F1D1D'],['Forest','#166534'],['Navy','#1E3A8A'],['Plum','#581C87']]),
  ...colors('neutral', [['Black','#111827'],['Gray','#9CA3AF'],['White','#FFFFFF'],['Brown','#92400E']]),
]
export const HEX_PATTERN=/^#[0-9A-F]{6}$/i
export function normaliseHex(value:string){const v=value.trim().toUpperCase();if(/^#[0-9A-F]{3}$/.test(v))return '#'+[...v.slice(1)].map(x=>x+x).join('');return HEX_PATTERN.test(v)?v:null}
export function isLight(hex:string){const h=hex.replace('#',''),r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);return(r*299+g*587+b*114)/1000>200}
