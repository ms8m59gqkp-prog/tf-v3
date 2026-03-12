/**
 * Next.js 16 proxy (middleware.ts 대체)
 * WHY: 전체 /api/* Rate Limiting + /api/admin/* 세션 검증 + CORS + Public Rate Limit
 * HOW: Upstash Redis slidingWindow + 인메모리 fallback + ALLOWED_ORIGIN
 * WHERE: Next.js가 자동 인식 (apps/web/proxy.ts)
 */
import { type NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from './lib/auth'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const AUTH_WHITELIST = new Set([
  '/api/admin/auth/login',
  '/api/admin/auth/logout',
])

// --- P0-1: 인메모리 Rate Limit fallback (Redis 장애 시 fail-closed) ---

const FALLBACK_WINDOW_MS = 60_000
const FALLBACK_LIMITS = { global: 200, login: 5, public: 30 } as const

const _fallbackCounters = new Map<string, { count: number; resetAt: number }>()

function fallbackLimit(key: string, max: number): boolean {
  const now = Date.now()
  const entry = _fallbackCounters.get(key)
  if (!entry || now >= entry.resetAt) {
    _fallbackCounters.set(key, { count: 1, resetAt: now + FALLBACK_WINDOW_MS })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}

// 5분마다 만료된 엔트리 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of _fallbackCounters) {
    if (now >= entry.resetAt) _fallbackCounters.delete(key)
  }
}, 300_000).unref?.()

// --- Rate Limiter (lazy singleton) ---

let _ratelimit: Ratelimit | null = null
let _loginRatelimit: Ratelimit | null = null
let _initFailed = false

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function getRatelimit(): Ratelimit | null {
  if (_initFailed) return null
  if (_ratelimit) return _ratelimit
  const redis = getRedis()
  if (!redis) { _initFailed = true; return null }
  _ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(200, '1 m'),
    timeout: 3000,
  })
  return _ratelimit
}

function getLoginRatelimit(): Ratelimit | null {
  if (_initFailed) return null
  if (_loginRatelimit) return _loginRatelimit
  const redis = getRedis()
  if (!redis) { _initFailed = true; return null }
  _loginRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    timeout: 3000,
  })
  return _loginRatelimit
}

// --- IP 추출 (x-real-ip 우선, 스푸핑 방지) ---

function extractIp(request: NextRequest): string {
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return '127.0.0.1'
}

// --- Rate Limit 응답 헬퍼 ---

function rateLimitResp(msg = '요청이 너무 많습니다'): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'RATE_LIMIT', message: msg } },
    { status: 429 },
  )
}

// --- CORS ---

function setCorsHeaders(response: NextResponse): void {
  const origin = process.env.ALLOWED_ORIGIN
  if (!origin) return
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Credentials', 'true')
}

function handlePreflight(): NextResponse {
  const response = new NextResponse(null, { status: 204 })
  const origin = process.env.ALLOWED_ORIGIN
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.set('Access-Control-Max-Age', '7200')
  }
  return response
}

// --- Proxy ---

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const ip = extractIp(request)

  // OPTIONS preflight
  if (request.method === 'OPTIONS') return handlePreflight()

  // 로그인 전용 Rate Limiting (5/min)
  const loginMsg = '로그인 시도가 너무 많습니다'
  if (pathname === '/api/admin/auth/login' && request.method === 'POST') {
    try {
      const rl = getLoginRatelimit()
      if (rl) {
        const r = await rl.limit(ip)
        if (!r.success) { const resp = rateLimitResp(loginMsg); resp.headers.set('Retry-After', '60'); return resp }
      } else if (!fallbackLimit(`login:${ip}`, FALLBACK_LIMITS.login)) {
        return rateLimitResp(loginMsg)
      }
    } catch {
      if (!fallbackLimit(`login:${ip}`, FALLBACK_LIMITS.login)) return rateLimitResp(loginMsg)
      console.warn('[proxy] 로그인 Rate Limiter Redis 오류, 인메모리 fallback 사용')
    }
  }

  // P0-2: Public 라우트 전용 Rate Limiting (30/min per IP)
  const isPublicApi = pathname.startsWith('/api/consignment/') || pathname.startsWith('/api/orders/')
  if (isPublicApi && !fallbackLimit(`public:${ip}`, FALLBACK_LIMITS.public)) {
    return rateLimitResp()
  }

  // 전체 Rate Limiting (200/min)
  try {
    const rl = getRatelimit()
    if (rl) {
      const r = await rl.limit(ip)
      if (!r.success) { const resp = rateLimitResp(); resp.headers.set('Retry-After', '60'); return resp }
    } else if (!fallbackLimit(`global:${ip}`, FALLBACK_LIMITS.global)) {
      return rateLimitResp()
    }
  } catch {
    if (!fallbackLimit(`global:${ip}`, FALLBACK_LIMITS.global)) return rateLimitResp()
    console.warn('[proxy] Rate Limiter Redis 오류, 인메모리 fallback 사용')
  }

  // /api/admin/* 세션 검증 (화이트리스트 제외)
  if (pathname.startsWith('/api/admin') && !AUTH_WHITELIST.has(pathname)) {
    const token = request.cookies.get('admin_session')?.value
    if (!token || !verifySessionToken(token)) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH', message: '인증 필요' } },
        { status: 401 },
      )
    }
  }

  // 통과 + CORS 헤더
  const response = NextResponse.next()
  setCorsHeaders(response)
  return response
}

export const config = {
  matcher: ['/api/:path*'],
}
