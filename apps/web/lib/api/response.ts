/**
 * API 표준 응답 헬퍼
 * WHY: 모든 API route에서 일관된 응답 형식 보장
 * HOW: ok/err/errFrom으로 { success, data } 또는 { success, error } 반환
 * WHERE: 모든 route handler의 return 값
 */
import { NextResponse } from 'next/server'
import { AppError, HTTP_STATUS, type ErrorCode } from './errors'

interface SuccessMeta {
  partial?: boolean
  revalidate?: number
}

export function ok<T>(data: T, meta?: SuccessMeta): NextResponse {
  const body: Record<string, unknown> = { success: true, data }
  if (meta?.partial) body.partial = true

  const response = NextResponse.json(body)
  if (meta?.revalidate !== undefined) {
    response.headers.set(
      'Cache-Control',
      `s-maxage=${meta.revalidate}, stale-while-revalidate`,
    )
  }
  return response
}

export function err(
  message: string,
  code: ErrorCode = 'INTERNAL',
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status: HTTP_STATUS[code] },
  )
}

export function validationErr(message: string): NextResponse {
  return err(message, 'VALIDATION')
}

export function rateLimitErr(): NextResponse {
  const response = err(
    '요청이 너무 많습니다. 잠시 후 다시 시도해주세요',
    'RATE_LIMIT',
  )
  response.headers.set('Retry-After', '60')
  return response
}

export function errFrom(e: unknown): NextResponse {
  if (e instanceof AppError) {
    return err(e.message, e.code)
  }
  if (e instanceof Error) {
    console.error('[api] 내부 오류:', e.message)
    return err('서버 내부 오류가 발생했습니다', 'INTERNAL')
  }
  console.error('[api] 알 수 없는 오류:', e)
  return err('서버 내부 오류가 발생했습니다', 'INTERNAL')
}
