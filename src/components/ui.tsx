import { createContext, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Check, CircleAlert, X } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'secondary', size = 'md', className = '', ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'
  const sizes = { sm: 'h-8 px-3 text-[13px]', md: 'h-9 px-3.5 text-sm', lg: 'h-11 px-5 text-[15px]' }
  const variants: Record<Variant, string> = {
    primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700',
    secondary: 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    danger: 'bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50',
  }
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
}

export function IconButton({ label, active, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      title={label}
      aria-label={label}
      className={`inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-35 ${active ? 'bg-brand-50 text-brand-700' : ''} ${className}`}
      {...props}
    />
  )
}

export function Badge({ tone = 'slate', children }: { tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'violet'; children: ReactNode }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-brand-50 text-brand-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    violet: 'bg-violet-50 text-violet-700',
  }
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${tones[tone]}`}>{children}</span>
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>{children}</div>
}

export function Modal({ open, onClose, children, width = 'max-w-md' }: { open: boolean; onClose: () => void; children: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className={`animate-toast w-full ${width} rounded-2xl bg-white p-6 shadow-2xl`} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

interface Toast { id: number; message: string; tone: 'info' | 'error' | 'success' }
const ToastCtx = createContext<(message: string, tone?: Toast['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="animate-toast pointer-events-auto flex items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-xl">
            {t.tone === 'error' ? <CircleAlert className="size-4 text-red-300" /> : t.tone === 'success' ? <Check className="size-4 text-emerald-300" /> : null}
            {t.message}
            <button className="ml-1 text-slate-400 hover:text-white" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} aria-label="Dismiss"><X className="size-3.5" /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#2563EB" />
        <circle cx="12" cy="13" r="5" fill="#fff" />
        <path d="M15 25 L22 12 L28 25 Z" fill="#93C5FD" />
      </svg>
      {!compact && <span className="text-[15px] font-extrabold tracking-tight text-ink">Visual Design Studio</span>}
    </span>
  )
}
