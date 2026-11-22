import type { ExperimentConfig, ParticipantSession } from './types'
import { computeComplexity } from './complexity'

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  // Quote everything and neutralise spreadsheet formula injection
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

export function durationSec(s: ParticipantSession): number | null {
  return s.submittedAt ? Math.round((new Date(s.submittedAt).getTime() - new Date(s.startedAt).getTime()) / 1000) : null
}

export function sessionsToCsv(sessions: ParticipantSession[], experiments: ExperimentConfig[]): string {
  const head = [
    'session_id', 'participant_id', 'experiment_id', 'experiment_name', 'experiment_version', 'condition',
    'canvas_width', 'canvas_height', 'canvas_background', 'started_at', 'submitted_at', 'duration_sec', 'status',
    'completion_code', 'element_count', 'distinct_shape_types', 'distinct_colors', 'action_count', 'ai_prompt', 'ai_method', 'ai_model', 'ai_success', 'ai_retries', 'design_json',
  ]
  const rows = sessions.map((s) => {
    const exp = experiments.find((e) => e.id === s.experimentId)
    const gen = s.aiGenerations[s.aiGenerations.length - 1]
    const m=computeComplexity(s.elements,exp?.canvas.width||1,exp?.canvas.height||1)
    return [
      s.id, s.participantId, s.experimentId, exp?.name, s.experimentVersion, s.condition,
      exp?.canvas.width, exp?.canvas.height, s.background, s.startedAt, s.submittedAt, durationSec(s), s.status,
      s.completionCode, m.elementCount,m.distinctShapeTypes,m.distinctColors, s.actionLog.length, gen?.prompt, gen?.method, gen?.model, gen ? gen.success : '', gen?.retries,
      JSON.stringify(s.elements.map(({ type, x, y, width, height, rotation, fill }) => ({ type, x, y, width, height, rotation, fill }))),
    ].map(cell).join(',')
  })
  // BOM so Excel opens Chinese prompts correctly
  return '﻿' + [head.join(','), ...rows].join('\r\n')
}
