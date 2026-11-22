import { lineWeight, shapePrimitives } from './shapes'
import type { DesignElement } from './types'

const esc = (s: string) => s.replace(/[^#0-9A-Fa-f]/g, '')

export function elementTransform(el: DesignElement): string {
  return `translate(${el.x} ${el.y}) rotate(${el.rotation})`
}

/**
 * Serialises a design to a standalone SVG string at the canvas' native size.
 * Only primitives produced by the shape library are emitted, so the output
 * can never contain text, images, scripts or gradients.
 */
export function designToSvg(width: number, height: number, background: string, elements: DesignElement[]): string {
  const weight = lineWeight(width, height)
  const body = elements
    .map((el) => {
      const prims = shapePrimitives(el, weight)
        .map((p) =>
          p.stroke
            ? `<path d="${p.d}" fill="none" stroke="${esc(p.stroke)}" stroke-width="${p.strokeWidth}"${p.dash ? ` stroke-dasharray="${p.dash}"` : ''} stroke-linecap="round" stroke-linejoin="round"/>`
            : `<path d="${p.d}" fill="${esc(p.fill ?? '#000000')}"/>`,
        )
        .join('')
      return `<g transform="${elementTransform(el)}">${prims}</g>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${esc(background)}"/>${body}</svg>`
}

/** Renders the design to a PNG blob at the canvas' original pixel size. */
export async function designToPng(width: number, height: number, background: string, elements: DesignElement[]): Promise<Blob> {
  const svg = designToSvg(width, height, background, elements)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Could not render the design'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not supported in this browser')
    ctx.drawImage(img, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
