/**
 * 관리자 인증 유틸리티
 * WHY: V3 관리자 패널 접근 제어
 * HOW: bcrypt(cost=12) 비밀번호 검증 + 세션 토큰 생성/검증
 * WHERE: 로그인 API, 미들웨어에서 import
 */
import { compare } from 'bcryptjs'
import { ADMIN_PASSWORD_HASH } from './env'
import crypto from 'crypto'

export async function verifyPassword(password: string): Promise<boolean> {
  return compare(password, ADMIN_PASSWORD_HASH)
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// 인메모리 세션 스토어 (단일 관리자 전용)
const sessions = new Map<string, { createdAt: number }>()
const SESSION_TTL = 24 * 60 * 60 * 1000 // 24시간

export function createSession(): string {
  const token = generateSessionToken()
  sessions.set(token, { createdAt: Date.now() })
  return token
}

export function verifySessionToken(token: string): boolean {
  const session = sessions.get(token)
  if (!session) return false
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(token)
    return false
  }
  return true
}

export function deleteSession(token: string): void {
  sessions.delete(token)
}
