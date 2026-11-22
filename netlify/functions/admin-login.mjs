import { clearAdminCookie, createAdminCookie, isAdmin } from '../lib/admin-auth.mjs'

const json = (data, status = 200, headers = {}) => Response.json(data, {
  status,
  headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers },
})

export default async (request) => {
  if (request.method === 'GET') return json({ authenticated: await isAdmin(request) })
  if (request.method === 'DELETE') {
    return json({ authenticated: false }, 200, { 'set-cookie': clearAdminCookie() })
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const configured = process.env.VDS_ADMIN_PASSWORD
  if (!configured) return json({ error: 'Researcher authentication is not configured.' }, 503)
  const body = await request.json().catch(() => ({}))
  if (typeof body.password !== 'string' || body.password !== configured) {
    return json({ error: 'Incorrect researcher password.' }, 401)
  }
  return json(
    { authenticated: true },
    200,
    { 'set-cookie': await createAdminCookie(configured) },
  )
}
