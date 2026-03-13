/**
 * 관리자 인증 유틸리티
 * WHY: V3 관리자 패널 접근 제어
 * HOW: bcrypt(cost=12) 비밀번호 검증 + 인메모리 Map 세션
 * WHERE: 로그인 API, proxy.ts, middleware.ts에서 import
 */
import { compare, hash } from 'bcryptjs'
import { ADMIN_PASSWORD_HASH } from './env'
import crypto from 'crypto'

const BCRYPT_COST = 12
const SESSION_TTL = 8 * 60 * 60 * 1000 // 8시간
const GC_INTERVAL = 5 * 60 * 1000 // 5분

export const SESSION_COOKIE_CONFIG = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 28800, // 8시간 (SESSION_TTL과 동기화)
}

export async function verifyPassword(password: string): Promise<boolean> {
  if (!password || password.length === 0) return false
  if (password.length > 1000) return false
  if (password.includes('\0')) return false
  return compare(password, ADMIN_PASSWORD_HASH)
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_COST)
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// 인메모리 세션 스토어 (단일 관리자 전용, HMR 대응)
const globalKey = '__tf_v3_sessions__'
const g = globalThis as unknown as Record<string, Map<string, { createdAt: number }>>
if (!g[globalKey]) g[globalKey] = new Map()
const sessions = g[globalKey]

// 단일 관리자: 새 로그인 시 기존 세션 전부 폐기
export function createSession(): string {
  sessions.clear()
  const token = generateSessionToken()
  sessions.set(token, { createdAt: Date.now() })
  return token
}

export function verifySessionToken(token: string): boolean {
  if (!token) return false
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

// 만료 세션 GC (5분 주기, HMR 중복 방지)
const gcKey = '__tf_v3_session_gc__'
const gGc = globalThis as unknown as Record<string, ReturnType<typeof setInterval>>
if (!gGc[gcKey]) {
  gGc[gcKey] = setInterval(() => {
    const now = Date.now()
    for (const [t, s] of sessions) {
      if (now - s.createdAt > SESSION_TTL) sessions.delete(t)
    }
  }, GC_INTERVAL)
  gGc[gcKey].unref()
}
