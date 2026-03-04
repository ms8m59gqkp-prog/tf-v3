/**
 * 인증 및 세션 관리
 * WHY: V2 평문 비밀번호 비교 취약, timing attack 가능 — bcrypt + HMAC 필수
 * HOW: bcrypt cost=12 해싱 + crypto HMAC-SHA256 세션 토큰
 * WHERE: login 라우트, 미들웨어에서 사용
 *
 * [Rev.5-O1] RLS 토큰 전달 방식:
 *   orders 테이블 Public hold 기능에서 x-hold-token 헤더를 사용.
 *   Supabase PostgREST는 current_setting('request.headers')로 헤더 접근.
 *   Phase 3 미들웨어에서 이 헤더를 검증/전달하는 단일 패턴 확정 예정.
 */

import { hash, compare } from 'bcryptjs'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { requireEnv } from '@/lib/env'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BCRYPT_COST = 12
const TOKEN_SEPARATOR = '.'
const HMAC_ALGORITHM = 'sha256'

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_COST)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return compare(password, hashedPassword)
}

// ---------------------------------------------------------------------------
// Session token (HMAC-SHA256)
// Format: <payload_hex>.<signature_hex>
// payload = JSON { adminId, iat, jti }
// ---------------------------------------------------------------------------

interface SessionPayload {
  adminId: string
  iat: number
  jti: string
}

interface SessionVerifyResult {
  valid: boolean
  adminId: string | null
}

export function createSessionToken(adminId: string): string {
  const secret = requireEnv('SESSION_SECRET')

  const payload: SessionPayload = {
    adminId,
    iat: Date.now(),
    jti: randomBytes(16).toString('hex'),
  }

  const payloadHex = Buffer.from(JSON.stringify(payload)).toString('hex')
  const signature = createHmac(HMAC_ALGORITHM, secret)
    .update(payloadHex)
    .digest('hex')

  return `${payloadHex}${TOKEN_SEPARATOR}${signature}`
}

export function verifySessionToken(token: string): SessionVerifyResult {
  const invalid: SessionVerifyResult = { valid: false, adminId: null }

  try {
    const secret = requireEnv('SESSION_SECRET')
    const separatorIndex = token.lastIndexOf(TOKEN_SEPARATOR)

    if (separatorIndex === -1) return invalid

    const payloadHex = token.slice(0, separatorIndex)
    const providedSig = token.slice(separatorIndex + 1)

    const expectedSig = createHmac(HMAC_ALGORITHM, secret)
      .update(payloadHex)
      .digest('hex')

    // timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(providedSig, 'hex')
    const expectedBuffer = Buffer.from(expectedSig, 'hex')

    if (sigBuffer.length !== expectedBuffer.length) return invalid
    if (!timingSafeEqual(sigBuffer, expectedBuffer)) return invalid

    const payload = JSON.parse(
      Buffer.from(payloadHex, 'hex').toString('utf8')
    ) as SessionPayload

    return { valid: true, adminId: payload.adminId }
  } catch {
    return invalid
  }
}
