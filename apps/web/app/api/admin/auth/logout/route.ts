/**
 * 관리자 로그아웃 API
 * WHY: 세션 삭제 + 쿠키 제거
 * HOW: deleteSession → Set-Cookie maxAge=0
 * WHERE: POST /api/admin/auth/logout (AUTH_WHITELIST — withAdmin 미적용)
 */
import type { NextRequest } from 'next/server'
import { deleteSession, SESSION_COOKIE_CONFIG } from '@/lib/auth'
import { ok, errFrom } from '@/lib/api/response'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('admin_session')?.value
    if (token) deleteSession(token)

    const response = ok({ message: '로그아웃 완료' })
    response.cookies.set('admin_session', '', { ...SESSION_COOKIE_CONFIG, maxAge: 0 })
    return response
  } catch (e) {
    return errFrom(e)
  }
}
