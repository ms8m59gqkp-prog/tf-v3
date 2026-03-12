/**
 * API 인증 미들웨어 (route handler용 HOF)
 * WHY: defense-in-depth (proxy.ts 1차 + withAdmin 2차 세션 검증)
 * HOW: requireAdmin → null이면 성공, NextResponse면 인증 실패
 * WHERE: 모든 /api/admin/* route handler에서 withAdmin()으로 감싸기
 */
import type { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '../auth'
import { err } from './response'

export function requireAdmin(req: NextRequest): NextResponse | null {
  const token = req.cookies.get('admin_session')?.value
  if (!token) return err('인증 필요', 'AUTH')
  if (!verifySessionToken(token)) return err('세션 만료', 'AUTH')
  return null
}

// 정적 라우트용
export function withAdmin(
  handler: (req: NextRequest) => Promise<NextResponse>,
): (req: NextRequest) => Promise<NextResponse>

// 동적 라우트용 ([id] 등 — Next.js 16 App Router params는 Promise)
export function withAdmin<P extends Record<string, string>>(
  handler: (
    req: NextRequest,
    ctx: { params: Promise<P> },
  ) => Promise<NextResponse>,
): (
  req: NextRequest,
  ctx: { params: Promise<P> },
) => Promise<NextResponse>

// 구현 — eslint-disable-next-line: overload 패턴에 필요한 any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAdmin(handler: (...args: any[]) => Promise<NextResponse>) {
  return async (req: NextRequest, ctx?: unknown): Promise<NextResponse> => {
    const authError = requireAdmin(req)
    if (authError) return authError
    return ctx !== undefined ? handler(req, ctx) : handler(req)
  }
}
