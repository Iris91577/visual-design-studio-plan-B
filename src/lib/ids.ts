export function uid(prefix = 'el'): string {
  const rand = crypto.getRandomValues(new Uint32Array(2))
  return `${prefix}_${rand[0].toString(36)}${rand[1].toString(36).slice(0, 4)}`
}

export function completionCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length])
  return `VDS-${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
}
