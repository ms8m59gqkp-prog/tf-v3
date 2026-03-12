/**
 * Claude Vision API 게이트웨이 (L0 Infrastructure)
 * WHY: architecture-spec 4.2 — 서비스에서 fetch 직접 호출 금지
 * HOW: Anthropic API 래핑, 재시도 + 타임아웃 포함
 * WHERE: photo.service.ts에서 import
 */
import { ANTHROPIC_API_KEY } from '../env'
import { AppError } from '../errors'

const TIMEOUT_MS = 30_000
const MAX_RETRIES = 2
const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'
const MODEL = 'claude-sonnet-4-20250514'

export interface ImageInput {
  base64: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
}

export interface ClassifyResult {
  brand: string
  category: string
  color: string
  condition: string
  confidence: number
}

export interface CompareResult {
  match: boolean
  confidence: number
  reason: string
}

async function callVision<T>(prompt: string, images: ImageInput[]): Promise<T> {
  if (!ANTHROPIC_API_KEY) {
    throw new AppError('SERVICE_UNAVAILABLE', 'AI 기능이 비활성화되어 있습니다 (ANTHROPIC_API_KEY 미설정)')
  }

  const content = [
    ...images.map(img => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: img.mediaType, data: img.base64 },
    })),
    { type: 'text' as const, text: prompt },
  ]

  let lastError: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          messages: [{ role: 'user', content }],
        }),
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Claude API ${res.status}: ${body.slice(0, 200)}`)
      }

      const json = await res.json() as {
        content: Array<{ type: string; text?: string }>
      }
      const text = json.content.find(c => c.type === 'text')?.text
      if (!text) throw new Error('Claude API 응답에 텍스트 없음')

      return JSON.parse(text) as T
    } catch (e) {
      clearTimeout(timer)
      lastError = e instanceof Error ? e : new Error(String(e))
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      }
    }
  }

  console.error('[claude-vision] 재시도 실패:', lastError?.message)
  throw new AppError(
    'SERVICE_UNAVAILABLE',
    `AI 분류 실패: ${lastError?.message ?? '알 수 없는 오류'}`,
  )
}

const CLASSIFY_PROMPT = [
  'Analyze this luxury item image.',
  'Return JSON: { "brand": string, "category": string,',
  '"color": string, "condition": "N"|"S"|"A"|"B", "confidence": 0-1 }',
].join(' ')

const COMPARE_PROMPT = [
  'Compare these two luxury item images.',
  'Are they the same product?',
  'Return JSON: { "match": boolean, "confidence": 0-1, "reason": string }',
].join(' ')

export async function classifyImages(
  images: ImageInput[],
): Promise<ClassifyResult> {
  return callVision<ClassifyResult>(CLASSIFY_PROMPT, images)
}

export async function compareImages(
  a: ImageInput,
  b: ImageInput,
): Promise<CompareResult> {
  return callVision<CompareResult>(COMPARE_PROMPT, [a, b])
}
