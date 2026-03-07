/**
 * IP 기반 레이트 리미터
 * WHY: 브루트포스 공격 방지
 * HOW: 인메모리 Map으로 IP별 요청 수 추적, 윈도우 기반 제한
 * WHERE: 로그인 API, 공개 API에서 import
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

const DEFAULT_WINDOW_MS = 60 * 1000 // 1분
const DEFAULT_MAX_REQUESTS = 10

export function checkRateLimit(
  ip: string,
  maxRequests = DEFAULT_MAX_REQUESTS,
  windowMs = DEFAULT_WINDOW_MS
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = store.get(ip)

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs
    store.set(ip, { count: 1, resetAt })
    return { allowed: true, remaining: maxRequests - 1, resetAt }
  }

  entry.count++
  const allowed = entry.count <= maxRequests
  return {
    allowed,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  }
}

// 주기적 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(ip)
    }
  }
}, 60 * 1000)
