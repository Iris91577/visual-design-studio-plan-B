import { CircleCheck, Copy, ExternalLink, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button, Logo, Modal } from '../components/ui'
import type { Submission } from '../services/session'

export function SubmitDialog({
  open, onClose, onConfirm, busy, elementCount, warning,
}: { open: boolean; onClose: () => void; onConfirm: () => void; busy: boolean; elementCount: number; warning?: string }) {
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose}>
      <h2 className="text-lg font-bold">Submit your design?</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Your design ({elementCount} element{elementCount === 1 ? '' : 's'}) will be saved as your final work. You won’t be able to edit it after submitting.
      </p>
      {warning && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-800">{warning}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onClose} disabled={busy}>Keep editing</Button>
        <Button variant="primary" onClick={onConfirm} disabled={busy}>
          {busy ? <><LoaderCircle className="size-4 animate-spin" /> Saving…</> : 'Submit Design'}
        </Button>
      </div>
    </Modal>
  )
}

export function CompletionScreen({ submission, returnUrl, participantId }: { submission: Submission; returnUrl: string; participantId: string }) {
  const [copied, setCopied] = useState(false)
  const target = returnUrl
    ? returnUrl.replace('{code}', encodeURIComponent(submission.code)).replace('{pid}', encodeURIComponent(participantId))
    : ''
  const copy = async () => {
    await navigator.clipboard.writeText(submission.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div className="dot-grid flex min-h-screen flex-col items-center justify-center bg-workspace p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-xl ring-1 ring-slate-200">
        <div className="flex justify-center"><Logo /></div>
        <div className="mx-auto mt-7 flex size-14 items-center justify-center rounded-full bg-emerald-50">
          <CircleCheck className="size-8 text-emerald-600" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Design submitted</h1>
        <p className="mt-2 text-[15px] text-slate-600">Thank you — your design has been saved.</p>
        {submission.pngDataUrl && (
          <img src={submission.pngDataUrl} alt="Your submitted design" className="mx-auto mt-6 max-h-56 rounded-lg shadow-md ring-1 ring-slate-200" />
        )}
        <div className="mt-6 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-slate-400">Your completion code</div>
          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="font-mono text-2xl font-medium tracking-wider">{submission.code}</span>
            <button onClick={copy} className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-700" aria-label="Copy code">
              {copied ? <CircleCheck className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            </button>
          </div>
        </div>
        {target ? (
          <Button variant="primary" size="lg" className="mt-6 w-full" onClick={() => (window.location.href = target)}>
            Return to the survey <ExternalLink className="size-4" />
          </Button>
        ) : (
          <p className="mt-6 text-[14px] leading-relaxed text-slate-600">
            Please copy the code above, return to the survey tab, and enter it there to continue.
          </p>
        )}
      </div>
    </div>
  )
}
