/**
 * 관리자 로그인 API
 * WHY: bcrypt 비밀번호 검증 → 세션 생성 → 쿠키 설정
 * HOW: verifyPassword → createSession → Set-Cookie
 * WHERE: POST /api/admin/auth/login (AUTH_WHITELIST — withAdmin 미적용)
 */
import type { NextRequest } from 'next/server'
import { verifyPassword, createSession, SESSION_COOKIE_CONFIG } from '@/lib/auth'
import { ok, err, validationErr, errFrom } from '@/lib/api/response'

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>
    try {
      body = await req.json() as Record<string, unknown>
    } catch {
      return validationErr('유효한 JSON 형식이 아닙니다')
    }
    const password = body.password

    if (!password || typeof password !== 'string') {
      return validationErr('비밀번호를 입력해주세요')
    }

    const valid = await verifyPassword(password)
    if (!valid) return err('비밀번호가 올바르지 않습니다', 'AUTH')

    const token = createSession()
    const response = ok({ message: '로그인 성공' })
    response.cookies.set('admin_session', token, SESSION_COOKIE_CONFIG)
    return response
  } catch (e) {
    return errFrom(e)
  }
}
