# Phase 3 구현 계획서 v2

**작성일**: 2026-03-11
**최종 수정**: 2026-03-11
**기반**: phase3-4-plan.md + 아키텍처 프리뷰 + 딥시뮬레이션 5회 + 딥리서치 3회 + 10개 분석 에이전트 검증 (20회)
**상태**: 사용자 승인 대기

---

## 0. 확정된 설계 결정

| 항목 | 결정 | 근거 |
|------|------|------|
| 세션 방식 | **Map 유지** + bcrypt 추가 | 단일 관리자, 즉시 revocation 가능 |
| Rate Limiting | **전체 proxy** (Upstash Redis) | plan 문서 L246, V2 proxy.ts 의도 복원 |
| 파일 컨벤션 | **proxy.ts** (NOT middleware.ts) | Next.js 16 표준, middleware.ts deprecated |
| errFrom() | **Record 룩업 + 고정 메시지** | INTERNAL 에러 시 원본 서버로그만, 클라이언트엔 고정 메시지 |
| requireAdmin | **null 반환 = 성공** 패턴 | plan 문서 3.1.3 명시 |
| 쿠키 속성 | **sameSite: 'strict'** | 단일 관리자, cross-site 불필요 → CSRF 방어 강화 |
| Rate Limit 한도 | **200/min (전체) + 5/min (로그인)** | 관리자 멀티탭 사용 고려 + 브루트포스 방어 |
| IP 추출 | **x-real-ip 우선** | x-forwarded-for 스푸핑 방지 (Vercel/Cloudflare 기준) |
| ErrorCode | **9개** | Phase 4-5 서비스 요구사항 반영 |

---

## 1. 구현 순서 (의존성 기반)

```
Step 1: lib/env.ts (+2줄)                      ← 의존성 없음
Step 2: lib/auth.ts (+20줄)                     ← env.ts 사용
Step 3: lib/api/errors.ts (NEW ~35줄)           ← 의존성 없음
Step 4: lib/api/response.ts (NEW ~65줄)         ← errors.ts 의존
Step 5: lib/api/middleware.ts (NEW ~45줄)        ← auth.ts + response.ts 의존
Step 6: proxy.ts (NEW ~65줄)                    ← auth.ts 의존
Step 7: app/api/admin/auth/login/route.ts (NEW)  ← auth.ts + response.ts 의존
Step 8: app/api/admin/auth/logout/route.ts (NEW) ← auth.ts + response.ts 의존
Step 9: eslint.config.mjs (+5줄)                ← 의존성 없음
Step 10: 검증 게이트                              ← 전체 완료 후
```

병렬 가능:
- Step 1 + Step 3 + Step 9: 동시 진행 가능
- Step 7 + Step 8: Step 4 완료 후 동시 진행 가능

---

## 2. 파일별 상세 스펙

### Step 1: `lib/env.ts` (+2줄)

```
현재: 22줄, 4개 변수 export
추가:
  - SESSION_SECRET = getEnvVar('SESSION_SECRET')
  - ALLOWED_ORIGIN = getEnvVar('ALLOWED_ORIGIN')

주의:
  - UPSTASH 변수는 env.ts에 넣지 않음 (proxy.ts에서 process.env 직접 접근, lazy singleton)
  - getEnvVar()는 빈 문자열도 거부하도록 .trim() 추가 필요
  - .env.example에 SESSION_SECRET(L19), ALLOWED_ORIGIN(L51) 이미 존재 확인됨

수정: getEnvVar() 함수 강화
  function getEnvVar(key: string): string {
    const value = process.env[key]?.trim()
    if (!value) throw new Error(`환경변수 ${key}가 설정되지 않았습니다`)
    return value
  }

결과: ~25줄
```

### Step 2: `lib/auth.ts` (+20줄)

```
현재: 42줄, Map 세션 + verifyPassword(단일 인자)
수정:
  1. BCRYPT_COST = 12 상수 추가
  2. hashPassword(password: string): Promise<string> 추가
  3. verifyPassword 입력 검증 추가:
     - 빈 문자열 → return false
     - 1000자 초과 → return false (bcrypt 72바이트 제한 + DoS 방지)
     - null bytes 포함 → return false
  4. createSession() 시 sessions.clear() 선행 (단일 관리자, 동시 세션 불필요)
  5. 만료 세션 GC interval 추가:
     setInterval(() => {
       const now = Date.now()
       for (const [token, session] of sessions) {
         if (now - session.createdAt > SESSION_TTL) sessions.delete(token)
       }
     }, 5 * 60 * 1000).unref()
  6. verifySessionToken 빈 토큰 조기 거부: if (!token) return false
  7. SESSION_COOKIE_CONFIG 상수 export:
     { httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/', maxAge: 86400 }
  8. HMR 대응: globalThis 패턴 적용
     const sessions = (globalThis as Record<string, unknown>).__sessions ??= new Map()

결과: ~62줄
```

### Step 3: `lib/api/errors.ts` (NEW ~35줄)

```
파일 헤더 주석 (5줄)
import 없음

ErrorCode 타입 (9개):
  type ErrorCode =
    | 'VALIDATION' | 'AUTH' | 'FORBIDDEN'
    | 'NOT_FOUND' | 'CONFLICT' | 'UNPROCESSABLE'
    | 'RATE_LIMIT' | 'SERVICE_UNAVAILABLE' | 'INTERNAL'

HTTP_STATUS Record:
  const HTTP_STATUS: Record<ErrorCode, number> = {
    VALIDATION: 400, AUTH: 401, FORBIDDEN: 403,
    NOT_FOUND: 404, CONFLICT: 409, UNPROCESSABLE: 422,
    RATE_LIMIT: 429, SERVICE_UNAVAILABLE: 503, INTERNAL: 500,
  }

AppError 클래스:
  class AppError extends Error {
    constructor(public code: ErrorCode, message: string) {
      super(message)
      this.name = 'AppError'
      Object.setPrototypeOf(this, AppError.prototype) // 방어적
    }
    get httpStatus(): number { return HTTP_STATUS[this.code] }
  }

export: ErrorCode, HTTP_STATUS, AppError
```

### Step 4: `lib/api/response.ts` (NEW ~65줄)

```
파일 헤더 주석 (5줄)
import: NextResponse from 'next/server', AppError/ErrorCode/HTTP_STATUS from './errors'

ok<T>(data: T, meta?: { partial?: boolean; revalidate?: number }):
  → NextResponse.json({ success: true, data, ...meta })
  → revalidate 있으면 Cache-Control 헤더

err(message: string, code: ErrorCode = 'INTERNAL'):
  → NextResponse.json(
      { success: false, error: { code, message } },
      { status: HTTP_STATUS[code] }
    )

validationErr(message: string):
  → err(message, 'VALIDATION')

errFrom(e: unknown):
  → e instanceof AppError
    ? err(e.message, e.code)                              // AppError: 개발자가 의도한 메시지
  → e instanceof Error
    ? (console.error('[api] 내부 오류:', e.message),
       err('서버 내부 오류가 발생했습니다', 'INTERNAL'))    // 일반 Error: 고정 메시지 (정보 노출 방지)
  → (console.error('[api] 알 수 없는 오류:', e),
     err('서버 내부 오류가 발생했습니다', 'INTERNAL'))

rateLimitErr():
  → err('요청이 너무 많습니다. 잠시 후 다시 시도해주세요', 'RATE_LIMIT')
  → response.headers.set('Retry-After', '60')

export: ok, err, validationErr, errFrom, rateLimitErr
```

### Step 5: `lib/api/middleware.ts` (NEW ~45줄)

```
파일 헤더 주석 (5줄)
import: NextRequest/NextResponse from 'next/server'
import: verifySessionToken from '../auth'
import: err from './response'

requireAdmin(req: NextRequest): NextResponse | null
  → const token = req.cookies.get('admin_session')?.value
  → if (!token) return err('인증 필요', 'AUTH')
  → if (!verifySessionToken(token)) return err('세션 만료', 'AUTH')
  → return null (성공)

withAdmin overload (동적 라우트 지원):
  // 정적 라우트용
  export function withAdmin(
    handler: (req: NextRequest) => Promise<NextResponse>
  ): (req: NextRequest) => Promise<NextResponse>

  // 동적 라우트용 ([id] 등)
  export function withAdmin<P extends Record<string, string>>(
    handler: (req: NextRequest, ctx: { params: Promise<P> }) => Promise<NextResponse>
  ): (req: NextRequest, ctx: { params: Promise<P> }) => Promise<NextResponse>

  // 구현
  export function withAdmin(handler: Function) {
    return async (req: NextRequest, ctx?: unknown) => {
      const authError = requireAdmin(req)
      if (authError) return authError
      return handler(req, ctx)
    }
  }

  주의: Next.js 16 App Router에서 params는 Promise<P> → await 필요
        구현 시 실제 타입 tsc 검증 필수

export: requireAdmin, withAdmin
```

### Step 6: `proxy.ts` (NEW ~65줄)

```
파일 헤더 주석 (5줄)
import: NextRequest/NextResponse from 'next/server'
import: verifySessionToken from './lib/auth'
import: Ratelimit from '@upstash/ratelimit'
import: Redis from '@upstash/redis'

AUTH_WHITELIST (세션 검증 예외):
  const AUTH_WHITELIST = new Set([
    '/api/admin/auth/login',
    '/api/admin/auth/logout',
  ])

Rate limiter (lazy singleton, fail-open):
  let _ratelimit: Ratelimit | null = null
  let _ratelimitInitFailed = false
  function getRatelimit(): Ratelimit | null {
    if (_ratelimitInitFailed) return null
    if (_ratelimit) return _ratelimit
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) { _ratelimitInitFailed = true; return null }
    _ratelimit = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(200, '1 m'),
      timeout: 3000,
    })
    return _ratelimit
  }

로그인 전용 Rate limiter:
  let _loginRatelimit: Ratelimit | null = null
  function getLoginRatelimit(): Ratelimit | null {
    // 동일 lazy singleton 패턴, slidingWindow(5, '1 m')
  }

IP 추출 (스푸핑 방지):
  function extractIp(request: NextRequest): string {
    // x-real-ip 우선 (Vercel/Cloudflare가 설정, 클라이언트 위조 불가)
    const realIp = request.headers.get('x-real-ip')
    if (realIp) return realIp.trim()
    // fallback: x-forwarded-for 첫 번째 값
    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim()
      if (first) return first
    }
    return '127.0.0.1'
  }

ALLOWED_ORIGIN:
  const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || ''
  주의: 빈 값이면 CORS 헤더 미설정 (의도적 차단)
        '*' 금지 (credentials: true와 호환 안 됨)

export function proxy(request: NextRequest):
  const { pathname } = request.nextUrl
  const ip = extractIp(request)

  ① 로그인 전용 Rate Limiting:
    → pathname === '/api/admin/auth/login' && request.method === 'POST'
    → getLoginRatelimit()?.limit(ip) → 초과 시 429 + Retry-After

  ② 전체 Rate Limiting:
    → getRatelimit()?.limit(ip) → 초과 시 429 + Retry-After
    → fail-open: try-catch, 실패 시 console.warn + 요청 통과

  ③ /api/admin/* 세션 검증 (AUTH_WHITELIST 제외):
    → if (pathname.startsWith('/api/admin') && !AUTH_WHITELIST.has(pathname))
    → request.cookies.get('admin_session')?.value
    → !token || !verifySessionToken(token) → 401

  ④ CORS:
    → OPTIONS preflight: 204 + Allow-Methods/Headers + Max-Age: 7200
    → response = NextResponse.next()
    → ALLOWED_ORIGIN이 있으면 Access-Control-Allow-Origin 설정
    → Access-Control-Allow-Credentials: true

  return response

export const config = { matcher: ['/api/:path*'] }
```

### Step 7: `app/api/admin/auth/login/route.ts` (NEW ~35줄)

```
파일 헤더 주석 (5줄)
import: NextRequest from 'next/server'
import: verifyPassword, createSession, SESSION_COOKIE_CONFIG from '@/lib/auth'
import: ok, err, validationErr from '@/lib/api/response'

export async function POST(req: NextRequest):
  try {
    const { password } = await req.json()

    // 입력 검증
    if (!password || typeof password !== 'string')
      return validationErr('비밀번호를 입력해주세요')

    // 비밀번호 확인
    const valid = await verifyPassword(password)
    if (!valid) return err('비밀번호가 올바르지 않습니다', 'AUTH')

    // 세션 생성 + 쿠키 설정
    const token = createSession()
    const response = ok({ message: '로그인 성공' })
    response.cookies.set('admin_session', token, SESSION_COOKIE_CONFIG)
    return response
  } catch (e) {
    return errFrom(e)
  }

주의: withAdmin으로 감싸지 않음 (AUTH_WHITELIST에 포함)
```

### Step 8: `app/api/admin/auth/logout/route.ts` (NEW ~25줄)

```
파일 헤더 주석 (5줄)
import: NextRequest from 'next/server'
import: deleteSession, SESSION_COOKIE_CONFIG from '@/lib/auth'
import: ok, errFrom from '@/lib/api/response'

export async function POST(req: NextRequest):
  try {
    const token = req.cookies.get('admin_session')?.value
    if (token) deleteSession(token)

    const response = ok({ message: '로그아웃 완료' })
    response.cookies.set('admin_session', '', { ...SESSION_COOKIE_CONFIG, maxAge: 0 })
    return response
  } catch (e) {
    return errFrom(e)
  }

주의: withAdmin으로 감싸지 않음 (AUTH_WHITELIST에 포함)
      세션 없어도 200 반환 (멱등성)
```

### Step 9: `eslint.config.mjs` (+5줄)

```
추가 rule (flat config, patterns + group 문법):
  {
    files: ['app/api/admin/**/*.ts'],
    rules: {
      'no-restricted-imports': ['warn', {
        patterns: [{
          group: ['**/db/repositories/*', '@/lib/db/repositories/*'],
          message: 'API route에서 repo 직접 import 금지. service 경유 필수 (Phase 4+)'
        }]
      }]
    }
  }
```

---

## 3. 검증 게이트

### 게이트 1: TypeScript 컴파일

```bash
cd apps/web && npx tsc --strict --noEmit
# 기대: 0 errors
```

### 게이트 2: Next.js 빌드

```bash
cd apps/web && npx next build
# 기대: 성공 + proxy.ts 인식 확인
```

### 게이트 3: ESLint

```bash
cd apps/web && npx eslint --max-warnings 0
# 기대: 0 errors, 0 warnings
```

### 게이트 4: 기존 테스트

```bash
cd apps/web && npx vitest run
# 기대: 기존 테스트 전부 통과 (Phase 3은 기존 코드 동작 변경 없음)
```

### 게이트 5: 수동 검증

```
- proxy.ts AUTH_WHITELIST 동작: login/logout에 세션 없이 접근 가능 확인
- withAdmin overload: 동적 라우트 [id] params 접근 확인
- Rate Limit: 200/min 초과 시 429 반환 확인
- CORS: ALLOWED_ORIGIN 외 도메인 차단 확인
```

---

## 4. 리스크 + 대응

| ID | 리스크 | 심각도 | 대응 |
|----|--------|--------|------|
| R3-1 | proxy.ts AUTH_WHITELIST 누락 시 로그인 불가 | **CRITICAL** | 화이트리스트 Set + 수동 테스트 |
| R3-2 | X-Forwarded-For 스푸핑으로 Rate Limit 우회 | **CRITICAL** | x-real-ip 우선 사용 + 배포 환경 검증 |
| R3-3 | Rate Limit fail-open 시 브루트포스 무방비 | **HIGH** | 로그인 전용 5/min + bcrypt cost=12 지연 |
| R3-4 | withAdmin overload params Promise 호환 | **HIGH** | tsc 검증 + 동적 라우트 테스트 |
| R3-5 | 세션 탈취 시 기존 세션 무효화 불가 | **HIGH** | createSession()에서 sessions.clear() |
| R3-6 | Upstash RTT 30-80ms TTFB 추가 | **MEDIUM** | ap-northeast-1 리전, fail-open 시 0ms |
| R3-7 | 만료 세션 Map 메모리 누적 | **MEDIUM** | 5분 주기 GC interval + unref() |
| R3-8 | HMR 시 세션/interval 소실 | **MEDIUM** | globalThis 패턴 적용 |
| R3-9 | ALLOWED_ORIGIN 미설정 시 서버 시작 실패 | **LOW** | getEnvVar() throw → 조기 감지 |
| R3-10 | PM2 restart 시 전체 세션 소실 | **LOW** | 단일 관리자 → 재로그인 수용. 문서화 |

---

## 5. Phase 0-2 충돌 체크 (에이전트 #9 검증 완료)

| Phase | 충돌 여부 | 설명 |
|-------|----------|------|
| Phase 0 (DB) | **없음** | DB 스키마/RPC 변경 없음 |
| Phase 1 (타입/유틸) | **없음** | auth.ts 함수 추가만. 기존 26개 타입 파일 무변경 |
| Phase 2 (repo) | **없음** | 26개 repo 파일 무변경. verifyPassword 호출 코드 0건 |

검증 방법: `verifyPassword` import 검색 → 0건, `env.ts` 기존 export 변경 없음

---

## 6. Phase 4-5 호환성 (에이전트 #10 검증 완료)

| 항목 | Phase 3 제공 | Phase 4-5 요구 | 상태 |
|------|-------------|---------------|------|
| ErrorCode | 9개 | FORBIDDEN, UNPROCESSABLE, SERVICE_UNAVAILABLE | **충족** |
| withAdmin | overload 패턴 | 동적 라우트 [id] params | **충족 (tsc 검증 필요)** |
| ok() | data + meta | 페이지네이션, partial, revalidate | **충족** |
| errFrom() | AppError + 고정 메시지 | PostgrestError, ZodError | **Phase 4에서 확장** |
| auth route | login/logout 2개 | Phase 4 auth.service에서 활용 | **충족** |
| ESLint | repo import 경고 | Phase 4 service 도입 시 적용 | **충족** |

Phase 4에서 추가 필요:
- errFrom()에 PostgrestError/ZodError 매핑 추가
- auth.service.ts 생성 (login/logout route에서 비즈니스 로직 분리)

---

## 7. 검증 이력

### 7.1 딥시뮬레이션 5회 (코드 시뮬레이션)

발견: C1+C2 (env.ts UPSTASH crash), H1 (withAdmin context), H2 (errFrom 정보 노출), H3 (request.ip 미존재)

### 7.2 딥리서치 3회 (수정안 정합성 검증)

발견: H3 INVALID 확인 (Next.js 16 소스 검증), C1+C2 Option C 채택 (proxy.ts direct process.env)

### 7.3 10개 분석 에이전트 (analysis-techniques.md 기준)

| # | 기법 | 관점 | 핵심 발견 |
|---|------|------|----------|
| 1 | 레드팀 | 외부 공격 | X-Forwarded-For 스푸핑 CRITICAL, CSRF 방어 부재 |
| 2 | 레드팀 | 내부 오용 | 세션 다중 발급, 경로 정규화 우회 |
| 3 | 엣지케이스 | 입력 극단 | 빈 비밀번호, null bytes, 환경변수 공백 |
| 4 | 엣지케이스 | 시스템 극단 | PM2 cluster 비호환, HMR 세션 소실, GC 부재 |
| 5 | 벤치마크 | 평시 부하 | Upstash RTT 30-80ms가 유일 이슈, 기능적 문제 없음 |
| 6 | 벤치마크 | 피크 부하 | 100/min 부족 → 200/min 상향, bcrypt 이벤트 루프 블로킹 |
| 7 | 유저워크스루 | 정상 플로우 | login 화이트리스트 누락 CRITICAL, 이중 검증 의도 명시 필요 |
| 8 | 유저워크스루 | 에러 플로우 | login/logout route 계획 누락, errFrom 스펙 모순 해소 |
| 9 | 디펜던시 | Phase 0-2 하위 | 영향도 LOW, 충돌 없음 확인 |
| 10 | 디펜던시 | Phase 4-5 상위 | ErrorCode 3개 추가, withAdmin Promise<P> 호환 필요 |

총 검증 횟수: 딥시뮬레이션 5 + 딥리서치 3 + 아키텍트 리뷰 1 + 분석 에이전트 10 = **19회**
기법 커버리지: 8/8 (등급 3 기준 100%)

---

## 8. 변경 요약

| 구분 | 파일 수 | 예상 줄 수 |
|------|---------|-----------|
| 신규 | 6개 | ~265줄 |
| 수정 | 3개 | ~25줄 |
| **총합** | **9개** | **~290줄** |

### 파일 목록

| Step | 파일 | 구분 | 예상 줄 |
|------|------|------|--------|
| 1 | lib/env.ts | 수정 | +5줄 |
| 2 | lib/auth.ts | 수정 | +20줄 |
| 3 | lib/api/errors.ts | **신규** | ~35줄 |
| 4 | lib/api/response.ts | **신규** | ~65줄 |
| 5 | lib/api/middleware.ts | **신규** | ~45줄 |
| 6 | proxy.ts | **신규** | ~65줄 |
| 7 | app/api/admin/auth/login/route.ts | **신규** | ~35줄 |
| 8 | app/api/admin/auth/logout/route.ts | **신규** | ~25줄 |
| 9 | eslint.config.mjs | 수정 | +5줄 |

---

## 9. 구현 방법론: 점진 빌드

한번에 9개 파일을 구현하지 않고, 의존성 순서대로 단계별 tsc 검증:

```
Batch 1: Step 1 + 3 (env.ts + errors.ts)    → tsc ✓
Batch 2: Step 2 (auth.ts)                    → tsc ✓
Batch 3: Step 4 (response.ts)                → tsc ✓
Batch 4: Step 5 (middleware.ts)              → tsc ✓
Batch 5: Step 6 (proxy.ts)                   → tsc ✓ → next build ✓
Batch 6: Step 7 + 8 (login + logout route)   → tsc ✓
Batch 7: Step 9 (eslint)                     → eslint ✓
Final: vitest run                            → 전체 테스트 ✓
```
