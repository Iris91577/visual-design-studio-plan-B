import type { GenerationMethod } from './types'

export interface AiModelOption {
  id: string
  label: string
  provider: 'Anthropic' | 'Google' | 'OpenAI'
  method: GenerationMethod
}

/**
 * Models offered in the experiment editor. "structured" models return design
 * parameters rendered with the shared shape library; "image" models return a
 * bitmap directly (text-to-image). The two are always labelled separately.
 */
export const AI_MODELS: AiModelOption[] = [
  { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol (recommended)', provider: 'OpenAI', method: 'structured' },
  { id: 'gpt-6-sol', label: 'GPT-6 Sol', provider: 'OpenAI', method: 'structured' },
  { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', provider: 'OpenAI', method: 'structured' },
  { id: 'gpt-5.5', label: 'GPT-5.5', provider: 'OpenAI', method: 'structured' },
]

export const METHOD_LABELS: Record<GenerationMethod, string> = {
  structured: 'Structured shape generation',
  image: 'Direct text-to-image',
}
