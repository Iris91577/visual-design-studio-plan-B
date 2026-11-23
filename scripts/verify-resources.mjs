import { readFile } from 'node:fs/promises'
import { DESIGN_PALETTE, DESIGN_SHAPE_TYPES } from '../netlify/lib/design-resources.mjs'

const source = await readFile(new URL('../src/lib/shapes.ts', import.meta.url), 'utf8')
const block = source.match(/export const SHAPES:[\s\S]*?= \[([\s\S]*?)\r?\n\]/)?.[1] ?? ''
const uiTypes = [...block.matchAll(/\bs\('([^']+)'/g)].map((match) => match[1])
const paletteSource = await readFile(new URL('../src/lib/palette.ts', import.meta.url), 'utf8')
const uiColours = [...paletteSource.matchAll(/\['[^']+','(#[0-9A-F]{6})'\]/g)].map((match) => match[1])

if (uiTypes.length !== 30 || new Set(uiTypes).size !== 30) {
  throw new Error(`The UI library must contain exactly 30 unique elements; found ${uiTypes.length}.`)
}
if (JSON.stringify(uiTypes) !== JSON.stringify(DESIGN_SHAPE_TYPES)) {
  throw new Error('The UI and server element allow-lists do not match.')
}
if (uiColours.length !== 30 || new Set(uiColours).size !== 30) {
  throw new Error(`The UI palette must contain exactly 30 unique colours; found ${uiColours.length}.`)
}
if (JSON.stringify(uiColours) !== JSON.stringify(DESIGN_PALETTE.map((colour) => colour.hex))) {
  throw new Error('The UI and server colour allow-lists do not match.')
}

console.log('Verified: UI, Human, AI and server use the same 30 elements and 30 colours.')

