/**
 * API 속도 제한 (Upstash Redis)
 * WHY: V2 rate limiting 미구현으로 서비스 남용 가능 — sliding window 제한 필수
 * HOW: Upstash Ratelimit SDK + Redis 장애 시 graceful fallback (요청 허용)
 * WHERE: Phase 3 middleware.ts에서 사용
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { requireEnv } from '@/lib/env'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RateLimitResult {
  success: boolean
  remaining: number
}

// ---------------------------------------------------------------------------
// Lazy singleton — 첫 호출 시에만 초기화 (빌드 타임 안전)
// ---------------------------------------------------------------------------

let rateLimiter: Ratelimit | null = null

function getRateLimiter(): Ratelimit {
  if (!rateLimiter) {
    rateLimiter = new Ratelimit({
      redis: new Redis({
        url: requireEnv('UPSTASH_REDIS_REST_URL'),
        token: requireEnv('UPSTASH_REDIS_REST_TOKEN'),
      }),
      limiter: Ratelimit.slidingWindow(60, '60 s'),
      prefix: 'tf-v3-ratelimit',
    })
  }
  return rateLimiter
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function checkRateLimit(
  identifier: string
): Promise<RateLimitResult> {
  try {
    const limiter = getRateLimiter()
    const response = await limiter.limit(identifier)

    return {
      success: response.success,
      remaining: response.remaining,
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown Redis error'
    console.error('[ratelimit] Redis 장애 — graceful fallback (허용):', message)

    // Redis 장애 시 요청을 차단하지 않는다
    return { success: true, remaining: -1 }
  }
}
