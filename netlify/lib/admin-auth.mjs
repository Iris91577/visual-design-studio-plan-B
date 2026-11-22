const COOKIE = 'vds_admin'
const encoder = new TextEncoder()

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function signature(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  return bytesToHex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

function getCookie(request) {
  const cookies = request.headers.get('cookie') ?? ''
  const found = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))
  return found ? decodeURIComponent(found.slice(COOKIE.length + 1)) : ''
}

export async function createAdminCookie(secret) {
  const expires = Date.now() + 8 * 60 * 60 * 1000
  const payload = String(expires)
  const token = `${payload}.${await signature(payload, secret)}`
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Lax`
}

export function clearAdminCookie() {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
}

export async function isAdmin(request) {
  const secret = process.env.VDS_ADMIN_PASSWORD
  if (!secret) return false
  const [expires, supplied] = getCookie(request).split('.')
  if (!expires || !supplied || Number(expires) < Date.now()) return false
  const expected = await signature(expires, secret)
  if (expected.length !== supplied.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i += 1) mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i)
  return mismatch === 0
}
