import type React from 'react'
import { useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FlaskConical, LogOut, Users } from 'lucide-react'
import { Button, Logo } from '../../components/ui'
import { researcherLogin, researcherLogout } from '../../services/experiments'

/** The server validates the configured researcher password and issues an
 * HttpOnly session cookie; this browser value only controls the local shell. */
const KEY = 'vds:researcher:v2'
export const getResearcher = () => localStorage.getItem(KEY)

export function RequireResearcher({ children }: { children: ReactNode }) {
  const loc = useLocation()
  if (!getResearcher()) return <Navigate to="/admin/login" state={{ from: loc.pathname }} replace />
  return <>{children}</>
}

export function AdminLayout() {
  const nav = useNavigate()
  const email = getResearcher()
  const item = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-semibold transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`
  return (
    <div className="flex min-h-screen bg-slate-50/70">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4">
        <Link to="/" className="px-2 py-1"><Logo /></Link>
        <div className="mt-1 px-2 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Research console</div>
        <nav className="mt-6 flex flex-col gap-1">
          <NavLink to="/admin" end className={item}><FlaskConical className="size-4" /> Experiments</NavLink>
          <NavLink to="/admin/sessions" className={item}><Users className="size-4" /> Participants</NavLink>
        </nav>
        <div className="mt-auto rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <div className="truncate text-[13px] font-semibold text-slate-700">{email}</div>
          <div className="text-[11.5px] text-slate-400">Researcher</div>
          <button
            onClick={async () => { await researcherLogout(); localStorage.removeItem(KEY); nav('/admin/login') }}
            className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500 hover:text-slate-800"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1"><Outlet /></main>
    </div>
  )
}

export function AdminLogin() {
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
      setError('Enter a valid email and a password of at least 6 characters.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await researcherLogin(email, password)
      localStorage.setItem(KEY, email)
      nav((loc.state as { from?: string } | null)?.from ?? '/admin', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Researcher sign-in failed.')
      setBusy(false)
    }
  }
  return (
    <div className="dot-grid flex min-h-screen items-center justify-center bg-workspace p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
        <Logo />
        <h1 className="mt-6 text-xl font-bold">Researcher sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Manage experiments, links and collected data.</p>
        <label className="mt-6 block text-[13px] font-semibold text-slate-700">Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username"
            className="mt-1.5 h-10 w-full rounded-lg bg-white px-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </label>
        <label className="mt-4 block text-[13px] font-semibold text-slate-700">Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
            className="mt-1.5 h-10 w-full rounded-lg bg-white px-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </label>
        {error && <p className="mt-3 text-[13px] font-medium text-red-600">{error}</p>}
        <Button variant="primary" size="lg" className="mt-6 w-full" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-800">
          Use the researcher password configured for this Netlify project.
        </p>
      </form>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 bg-white px-8 py-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
