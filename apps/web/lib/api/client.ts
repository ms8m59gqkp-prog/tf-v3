/**
 * 브라우저용 API 클라이언트
 * WHY: 프론트엔드에서 API 호출 시 일관된 타입 안전 래퍼
 * HOW: fetch + AbortController 타임아웃 + APIError
 * WHERE: 모든 페이지/컴포넌트에서 import
 */
import type { ErrorCode } from '../errors'

const TIMEOUT_MS = 30_000

/* ── Error ─────────────────────────────────────────── */

export class APIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: ErrorCode,
  ) {
    super(message)
    this.name = 'APIError'
    Object.setPrototypeOf(this, APIError.prototype)
  }
}

/* ── Types ─────────────────────────────────────────── */

interface APIResponse<T> {
  success: boolean
  data?: T
  error?: { code: ErrorCode; message: string }
}

type RequestBody = Record<string, unknown> | unknown[]

/* ── Core fetch ────────────────────────────────────── */

async function request<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      credentials: 'include',
    })

    const body = (await res.json()) as APIResponse<T>

    if (!res.ok || !body.success) {
      throw new APIError(
        body.error?.message ?? `요청 실패 (${res.status})`,
        res.status,
        body.error?.code,
      )
    }

    return body.data as T
  } catch (e) {
    if (e instanceof APIError) throw e
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new APIError('요청 시간 초과 (30s)', 408)
    }
    throw new APIError(
      e instanceof Error ? e.message : '알 수 없는 네트워크 오류',
      0,
    )
  } finally {
    clearTimeout(timer)
  }
}

/* ── JSON headers ──────────────────────────────────── */

const JSON_HEADERS: HeadersInit = { 'Content-Type': 'application/json' }

/* ── Public API ────────────────────────────────────── */

export const api = {
  get: <T>(url: string) =>
    request<T>(url, { method: 'GET' }),

  post: <T>(url: string, body: RequestBody) =>
    request<T>(url, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) }),

  patch: <T>(url: string, body: RequestBody) =>
    request<T>(url, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(body) }),

  delete: <T>(url: string) =>
    request<T>(url, { method: 'DELETE' }),
} as const
