# Phase 1 Risk -- Detailed Solution Analysis Report

**Feature**: web (Classic Menswear V3)
**Base Document**: `docs/03-analysis/phase1-risk-report.md`
**Analyzed by**: CTO Lead (Opus 4.6)
**Date**: 2026-03-04

---

## RISK-01: Session Token Has No TTL

### 1. Current Code Analysis

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/auth.ts`

`createSessionToken()` (lines 57-72) creates an HMAC-SHA256 signed token containing `{ adminId, iat, jti }`. The `iat` (issued-at) is set to `Date.now()` at line 62. `verifySessionToken()` (lines 74-105) validates the HMAC signature at lines 86-95 and parses the payload at lines 97-99, but at line 101 it returns `{ valid: true, adminId: payload.adminId }` without any age check. The `iat` field that was stored in the token is completely ignored during verification.

The `SessionPayload` interface (lines 46-50) defines `adminId`, `iat`, and `jti` but has no `exp` (expiration) field.

### 2. Root Cause

The implementation focused on cryptographic correctness (HMAC signature, timing-safe comparison) as a response to V2's plaintext password vulnerability. Token expiration was deferred as a "Phase 3 middleware concern" per the plan document (plan5.md section 6). However, the verification function was designed as a standalone authentication primitive -- it should have been self-contained with TTL enforcement, not dependent on an external middleware layer that does not yet exist.

### 3. Solution Options

**Option A: Add TTL check inside `verifySessionToken()` (Recommended)**

| Aspect | Assessment |
|--------|------------|
| Pros | Self-contained security. Works regardless of middleware. Single responsibility for token validation |
| Cons | auth.ts grows by ~10 lines. Requires a constant or env var for TTL duration |
| Complexity | Low (5-10 lines) |
| Security | Eliminates the risk entirely at the lowest level |

**Option B: Defer to Phase 3 middleware only**

| Aspect | Assessment |
|--------|------------|
| Pros | No changes to Phase 1 code. Follows original plan |
| Cons | Leaves a security gap until Phase 3 is built. If middleware is bypassed or misconfigured, tokens are eternal. Defense-in-depth violation |
| Complexity | None now, medium later |
| Security | Risk window exists between Phase 1 completion and Phase 3 deployment |

**Option C: Add `exp` field to payload + check in verifySessionToken()**

| Aspect | Assessment |
|--------|------------|
| Pros | Standard JWT-like pattern. `exp` is explicit in the token itself. No need for server-side constant during verification |
| Cons | Slightly more complex. Existing tokens (if any) lack `exp` and would be rejected |
| Complexity | Low-Medium (15 lines total between create and verify) |
| Security | Strongest: expiration is encoded in the token, not dependent on server config |

### 4. Recommended Solution: Option A + partial Option C

Add `SESSION_TTL_MS` constant and TTL check inside `verifySessionToken()`. Also add `exp` to `SessionPayload` for defense-in-depth but use `iat + TTL` as primary check for backward compatibility.

**Changes to `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/auth.ts`**:

```typescript
// Add constant at line 23 (after HMAC_ALGORITHM)
const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// Modify SessionPayload interface (line 46-50) to add exp
interface SessionPayload {
  adminId: string
  iat: number
  exp: number  // NEW: expiration timestamp
  jti: string
}

// Modify createSessionToken (line 60-64) to include exp
const payload: SessionPayload = {
  adminId,
  iat: Date.now(),
  exp: Date.now() + SESSION_TTL_MS,  // NEW
  jti: randomBytes(16).toString('hex'),
}

// Modify verifySessionToken (after line 99, before line 101) to check TTL
const payload = JSON.parse(
  Buffer.from(payloadHex, 'hex').toString('utf8')
) as SessionPayload

// NEW: TTL check
const now = Date.now()
if (payload.exp && now > payload.exp) return invalid
if (!payload.exp && payload.iat && now - payload.iat > SESSION_TTL_MS) return invalid

return { valid: true, adminId: payload.adminId }
```

**Changed files**: `apps/web/lib/auth.ts` (net +6 lines, total ~111 lines -- under 150 limit)

**New tests needed in `__tests__/unit/`**:
- `auth.test.ts`: create token, verify immediately (valid), advance clock past 24h (invalid)
- Test backward compatibility: token without `exp` field still checked via `iat + TTL`

### 5. Side Effect Analysis

- **Downstream impact**: None. `verifySessionToken()` return type is unchanged. Callers (Phase 3 middleware) will receive the same `SessionVerifyResult`.
- **Backward compatibility**: The dual check (`exp` primary, `iat + TTL` fallback) ensures any tokens created before this fix that lack `exp` will still be checked via `iat`.
- **Test scope**: 1 new test file (`auth.test.ts`). Existing 63 tests unaffected.

### 6. Priority: Phase 1 fix (before Phase 2)

Implementation order: standalone -- no dependencies on other risks.

---

## RISK-02: PUBLIC_ENV Empty String Fallback

### 1. Current Code Analysis

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/env.ts` (lines 49-53)

`PUBLIC_ENV` is a module-level constant evaluated at import time. It reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with `?? ''` fallback. This empty string is then consumed by:
- `createAdminClient()` in `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/supabase/admin.ts` line 17: `PUBLIC_ENV.SUPABASE_URL` passed to `createClient()`
- `createAnonClient()` in `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/supabase/client.ts` line 17: same pattern

**Verified behavior**: The Supabase JS SDK (v2.98.0) in `node_modules/@supabase/supabase-js/dist/index.mjs` line 150 checks `if (!trimmedUrl) throw new Error("supabaseUrl is required.")` and line 200 checks `if (!supabaseKey) throw new Error("supabaseKey is required.")`. So an empty string WILL throw at client creation time, not silently.

**Revised assessment**: The original risk report stated the SDK would create silently. This is incorrect. The SDK throws `"supabaseUrl is required."` on empty string. The actual risk is: the error message from Supabase SDK is generic -- it says "supabaseUrl is required" without mentioning which environment variable to set. A developer seeing this error must trace through 3 files to find the root cause.

### 2. Root Cause

The `?? ''` fallback was intentionally designed for Next.js build safety: `NEXT_PUBLIC_*` variables are inlined at build time, and missing variables produce `undefined`. The empty-string fallback prevents TypeScript `string | undefined` type issues throughout the codebase. The root cause is a conflict between build-time safety (need a string value) and runtime correctness (need a meaningful error).

### 3. Solution Options

**Option A: Add guard inside both client factories (Recommended)**

| Aspect | Assessment |
|--------|------------|
| Pros | Error message names the exact missing variable. No change to PUBLIC_ENV type. Zero risk of build breakage |
| Cons | Guard is in 2 files instead of 1. Small code duplication |
| Complexity | Trivial (2 lines per file) |
| Performance | No impact (checked once per factory call) |

**Option B: Create `requirePublicEnv()` function in env.ts**

| Aspect | Assessment |
|--------|------------|
| Pros | DRY -- single validation function. Consistent with `requireEnv()` pattern |
| Cons | Cannot be used at module top-level (same Next.js build problem). Would require restructuring PUBLIC_ENV to use lazy evaluation |
| Complexity | Low but architectural change |
| Performance | No impact |

**Option C: Remove `?? ''` and use `string | undefined` type**

| Aspect | Assessment |
|--------|------------|
| Pros | TypeScript catches missing values at compile time |
| Cons | Every consumer of PUBLIC_ENV must handle undefined. Breaks the current `as const` satisfies pattern. Many call sites need `!` assertions or guards |
| Complexity | Medium -- many files affected |
| Performance | No impact |

### 4. Recommended Solution: Option A

**Changes to `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/supabase/admin.ts`** (add guard before createClient):

```typescript
export function createAdminClient() {
  if (!PUBLIC_ENV.SUPABASE_URL) {
    throw new Error('[supabase] NEXT_PUBLIC_SUPABASE_URL is not set')
  }
  return createClient(
    PUBLIC_ENV.SUPABASE_URL,
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  )
}
```

**Changes to `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/supabase/client.ts`** (add guard before createClient):

```typescript
export function createAnonClient() {
  if (!PUBLIC_ENV.SUPABASE_URL) {
    throw new Error('[supabase] NEXT_PUBLIC_SUPABASE_URL is not set')
  }
  if (!PUBLIC_ENV.SUPABASE_ANON_KEY) {
    throw new Error('[supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')
  }
  return createClient(
    PUBLIC_ENV.SUPABASE_URL,
    PUBLIC_ENV.SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
}
```

**Changed files**: `admin.ts` (+3 lines -> 25 lines), `client.ts` (+6 lines -> 28 lines)

### 5. Side Effect Analysis

- **Downstream impact**: None. Both functions still return `SupabaseClient`. The error is thrown before `createClient()` would throw its own generic error.
- **Backward compatibility**: Fully compatible. If env vars are set (production), the guards are never triggered.
- **Test scope**: No unit tests needed -- these are runtime configuration guards. Integration tests in Phase 5 will exercise them.

### 6. Priority: Phase 1 fix (before Phase 2)

Implementation order: after RISK-03 (.env.example) so that the documentation and code guards are aligned.

---

## RISK-03: .env.example Missing 15 Variables

### 1. Current Code Analysis

**File**: `/Users/jeongmyeongcheol/tf-v3/.env.example` (23 lines, 12 variables)

Cross-referencing three sources:
- `SERVER_ENV_KEYS` in `env.ts` (lines 26-43): 16 server-only keys
- `PUBLIC_ENV` in `env.ts` (lines 49-53): 3 public keys (NEXT_PUBLIC_*)
- `.env.local`: 27 total variables (verified via masked listing)

The `.env.example` has these issues:
1. Lines 2-3: `SUPABASE_URL` and `SUPABASE_ANON_KEY` lack `NEXT_PUBLIC_` prefix. The code reads `process.env.NEXT_PUBLIC_SUPABASE_URL`, not `process.env.SUPABASE_URL`. The example file will lead developers to set the wrong variable names.
2. 14 variables from `SERVER_ENV_KEYS` are missing entirely.
3. `.env.local` has 4 additional variables not in `SERVER_ENV_KEYS`: `CJ_API_KEY`, `CJ_API_SECRET`, `CJ_CUSTOMER_CODE`, `ALERT_EMAIL`, `SMTP_USER`, `SMTP_PASS`.

### 2. Root Cause

`.env.example` was created for Phase 0 (DB migration) scope only. It was not updated when Phase 1 added `env.ts` with its complete key catalog. The naming mismatch (`SUPABASE_URL` vs `NEXT_PUBLIC_SUPABASE_URL`) predates Phase 1 -- it was written when the Supabase CLI config used the non-prefixed names.

### 3. Solution Options

**Option A: Complete rewrite of .env.example (Recommended)**

| Aspect | Assessment |
|--------|------------|
| Pros | Single source of documentation. Grouped by phase. Correct prefixes |
| Cons | One-time effort |
| Complexity | Trivial (text editing) |
| Security | Placeholder values only -- no secrets |

**Option B: Generate .env.example from SERVER_ENV_KEYS programmatically**

| Aspect | Assessment |
|--------|------------|
| Pros | Always in sync with code |
| Cons | Requires a script. Over-engineered for this project size. Comments/grouping harder to maintain |
| Complexity | Medium |
| Security | No impact |

### 4. Recommended Solution: Option A

**Complete replacement of `/Users/jeongmyeongcheol/tf-v3/.env.example`**:

```env
# ===========================================================================
# tf-v3 Environment Variables
# Copy to .env.local and fill in values
# ===========================================================================

# --- Supabase (Required: Phase 0+) ---
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DB_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# --- Supabase CLI (Required: Phase 0 migration only) ---
SUPABASE_ACCESS_TOKEN=your-supabase-access-token
SUPABASE_PROJECT_ID=your-project-id

# --- Authentication (Required: Phase 1+) ---
ADMIN_ID=admin
ADMIN_PASSWORD=your-hashed-password
SESSION_SECRET=your-random-secret-min-32-chars

# --- Rate Limiting (Required: Phase 3+) ---
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token

# --- Warehouse Info (Required: Phase 4+ SMS) ---
WAREHOUSE_NAME=your-warehouse-name
WAREHOUSE_PHONE=010-0000-0000
WAREHOUSE_ZIPCODE=00000
WAREHOUSE_ADDRESS=your-warehouse-address

# --- External APIs (Required: Phase 5+) ---
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret

# --- AI Services (Required: Phase 5+ photo classification) ---
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
PHOTOROOM_API_KEY=your-photoroom-key

# --- Shipping (Optional: CJ Logistics) ---
CJ_API_KEY=your-cj-api-key
CJ_API_SECRET=your-cj-api-secret
CJ_CUSTOMER_CODE=your-cj-customer-code

# --- Monitoring (Optional: Phase 8) ---
SENTRY_DSN=https://your-sentry-dsn
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn

# --- Health/CORS (Phase 3/5) ---
HEALTHCHECK_TOKEN=your-healthcheck-token
ALLOWED_ORIGIN=https://your-domain.com

# --- Photo Storage (Phase 7) ---
NEXT_PUBLIC_PHOTO_BASE_URL=
NEXT_PUBLIC_PHOTO_STORAGE_MODE=legacy

# --- Alerts (Optional) ---
ALERT_EMAIL=your-alert-email
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
```

**Changed files**: `.env.example` (rewritten, ~50 lines)

### 5. Side Effect Analysis

- **Downstream impact**: None. `.env.example` is documentation only.
- **Backward compatibility**: Developers with existing `.env.local` are unaffected.
- **Test scope**: None.

### 6. Priority: Phase 1 fix (immediate, first in sequence)

Implementation order: first -- this is prerequisite documentation for all other fixes.

---

## RISK-04: Rate Limiter Redis Failure Re-initialization

### 1. Current Code Analysis

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/ratelimit.ts`

`getRateLimiter()` (lines 27-39) uses a lazy singleton. If `requireEnv()` at lines 31-32 throws (env vars missing), the exception propagates to `checkRateLimit()` at line 49, which catches it at line 56 and returns `{ success: true, remaining: -1 }` (graceful fallback). But `rateLimiter` remains `null` because the assignment at line 29 was never reached. Next call re-enters `getRateLimiter()`, re-throws, re-catches -- every single request.

If the Redis SDK's `new Redis()` constructor succeeds but `limiter.limit()` at line 50 fails (Redis server down), the singleton IS set, so re-initialization does not happen. The problem is specifically env-var-missing or constructor-level failure.

### 2. Root Cause

The lazy singleton pattern does not distinguish between "not yet initialized" and "initialization failed permanently." Both states are represented by `rateLimiter === null`. The `checkRateLimit()` catch block treats all errors identically without caching the failure.

### 3. Solution Options

**Option A: Cache failure state with cooldown (Recommended)**

| Aspect | Assessment |
|--------|------------|
| Pros | Prevents log spam. Still retries periodically in case env vars are added at runtime |
| Cons | Adds state management complexity. Cooldown period is arbitrary |
| Complexity | Low (8 lines) |
| Performance | Eliminates per-request `requireEnv()` calls during failure state |

**Option B: Try-catch inside getRateLimiter(), return null on failure**

| Aspect | Assessment |
|--------|------------|
| Pros | Simple. Moves error handling to the singleton level |
| Cons | Retries on every call (same spam issue unless combined with cooldown) |
| Complexity | Low (5 lines) |
| Performance | Minimal improvement alone |

**Option C: Validate env vars at build/startup, fail-fast**

| Aspect | Assessment |
|--------|------------|
| Pros | Catches misconfiguration immediately. No runtime surprise |
| Cons | Violates the "module top-level call forbidden" constraint (Next.js build). Rate limiting is optional -- fail-fast is overly strict |
| Complexity | Low but breaks architecture rule |
| Performance | No runtime impact |

### 4. Recommended Solution: Option A

**Changes to `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/ratelimit.ts`**:

```typescript
let rateLimiter: Ratelimit | null = null
let initFailedAt: number = 0                    // NEW
const INIT_RETRY_INTERVAL_MS = 60_000           // NEW: retry after 60s

function getRateLimiter(): Ratelimit | null {    // CHANGED: return type allows null
  if (rateLimiter) return rateLimiter

  // NEW: skip re-init if recently failed
  if (initFailedAt && Date.now() - initFailedAt < INIT_RETRY_INTERVAL_MS) {
    return null
  }

  try {                                          // NEW: try-catch around init
    rateLimiter = new Ratelimit({
      redis: new Redis({
        url: requireEnv('UPSTASH_REDIS_REST_URL'),
        token: requireEnv('UPSTASH_REDIS_REST_TOKEN'),
      }),
      limiter: Ratelimit.slidingWindow(60, '60 s'),
      prefix: 'tf-v3-ratelimit',
    })
    initFailedAt = 0                             // NEW: reset on success
    return rateLimiter
  } catch (error: unknown) {                     // NEW
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[ratelimit] Initialization failed:', msg)
    initFailedAt = Date.now()                    // NEW: record failure time
    return null
  }
}

export async function checkRateLimit(
  identifier: string
): Promise<RateLimitResult> {
  try {
    const limiter = getRateLimiter()
    if (!limiter) {                              // NEW: handle null
      return { success: true, remaining: -1 }
    }
    const response = await limiter.limit(identifier)
    return {
      success: response.success,
      remaining: response.remaining,
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown Redis error'
    console.error('[ratelimit] Redis failure -- graceful fallback:', message)
    return { success: true, remaining: -1 }
  }
}
```

**Changed files**: `apps/web/lib/ratelimit.ts` (net +12 lines, total ~76 lines -- under 80 function limit)

### 5. Side Effect Analysis

- **Downstream impact**: None. `checkRateLimit()` return type is unchanged. Callers receive the same `RateLimitResult`.
- **Backward compatibility**: Fully compatible. Behavior is identical when Redis is working.
- **Test scope**: 1 test case: mock `requireEnv` to throw, call `checkRateLimit` twice, verify `console.error` fires once (not twice within 60s).

### 6. Priority: Phase 3 (can defer)

Implementation order: independent -- no dependencies. Can be done alongside Phase 3 middleware work.

---

## RISK-05: toStartOfDay/toEndOfDay UTC Boundary Mismatch

### 1. Current Code Analysis

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/date.ts` (lines 67-85)

`toStartOfDay('2026-03-04')` at line 74 returns `new Date('2026-03-04T00:00:00.000Z')` which is UTC midnight = KST 09:00. For a Korean user who selects "2026-03-04" as a settlement period start, they mean KST 00:00 = UTC 2026-03-03T15:00:00.000Z. The function returns a time that is 9 hours later than the user's intent.

The file already has KST-aware display functions (`toKSTDate`, `toKSTDateTime`) using `Intl.DateTimeFormat` with `timeZone: 'Asia/Seoul'`. But the inverse operation (user-input KST date string -> UTC timestamp for DB queries) is missing.

The existing tests in `utils.test.ts` do not test `toStartOfDay` or `toEndOfDay` at all -- these functions have zero test coverage.

### 2. Root Cause

The plan document (plan5.md section 4) specifies "저장은 UTC, 표시는 KST 변환" (store in UTC, display in KST). The display direction (UTC -> KST) was correctly implemented. But the query direction (KST input -> UTC query boundary) was implemented as UTC -> UTC, ignoring the timezone offset. This is because the function name `toStartOfDay` is ambiguous -- it does not specify which timezone's "start of day."

### 3. Solution Options

**Option A: Add separate KST-aware functions, keep existing UTC functions (Recommended)**

| Aspect | Assessment |
|--------|------------|
| Pros | No breaking change. Caller explicitly chooses UTC or KST semantics. Clear naming |
| Cons | Two sets of functions to maintain. Caller must know which to use |
| Complexity | Low (10 lines for 2 new functions) |
| Performance | No impact (Date constructor with timezone offset) |

**Option B: Change existing functions to KST-based**

| Aspect | Assessment |
|--------|------------|
| Pros | Single set of functions. Forces KST semantics project-wide |
| Cons | Breaking change if any caller expects UTC. Misleading function names. UTC functions still needed for non-KST contexts |
| Complexity | Low (2-line change) |
| Performance | No impact |

**Option C: Add timezone parameter to existing functions**

| Aspect | Assessment |
|--------|------------|
| Pros | Flexible. Single API covers both cases |
| Cons | API complexity. Every call site must pass timezone. Default value decision is ambiguous |
| Complexity | Medium |
| Performance | No impact |

### 4. Recommended Solution: Option A

**Changes to `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/date.ts`** (append after line 85):

```typescript
/**
 * "YYYY-MM-DD" -> KST 해당 날짜 00:00:00 (UTC로 변환)
 * 정산 기간 쿼리에서 사용. 사용자가 입력한 날짜는 KST 기준.
 * 예: '2026-03-04' -> 2026-03-03T15:00:00.000Z (KST 03-04 00:00)
 */
export function toKSTStartOfDay(dateStr: string): Date {
  if (!isValidDateString(dateStr)) {
    throw new Error(`유효하지 않은 날짜 형식: ${dateStr}`)
  }
  return new Date(`${dateStr}T00:00:00+09:00`)
}

/**
 * "YYYY-MM-DD" -> KST 해당 날짜 23:59:59.999 (UTC로 변환)
 * 정산 기간 쿼리에서 사용.
 * 예: '2026-03-04' -> 2026-03-04T14:59:59.999Z (KST 03-04 23:59:59.999)
 */
export function toKSTEndOfDay(dateStr: string): Date {
  if (!isValidDateString(dateStr)) {
    throw new Error(`유효하지 않은 날짜 형식: ${dateStr}`)
  }
  return new Date(`${dateStr}T23:59:59.999+09:00`)
}
```

**Changed files**: `apps/web/lib/utils/date.ts` (net +18 lines, total ~103 lines -- under 200 for utility)

**New tests in `__tests__/unit/utils.test.ts`**:
```typescript
describe('date KST range', () => {
  it('toKSTStartOfDay returns UTC 15:00 previous day', () => {
    const d = toKSTStartOfDay('2026-03-04')
    expect(d.toISOString()).toBe('2026-03-03T15:00:00.000Z')
  })
  it('toKSTEndOfDay returns UTC 14:59:59.999 same day', () => {
    const d = toKSTEndOfDay('2026-03-04')
    expect(d.toISOString()).toBe('2026-03-04T14:59:59.999Z')
  })
})
```

### 5. Side Effect Analysis

- **Downstream impact**: None. Existing functions are untouched. New functions are additive.
- **Phase 4 dependency**: Settlement service (Phase 4) MUST use `toKSTStartOfDay`/`toKSTEndOfDay` for period queries, not `toStartOfDay`/`toEndOfDay`. This is a critical Phase 4 requirement.
- **Test scope**: 2 new tests for the new functions. Add 2 tests for existing `toStartOfDay`/`toEndOfDay` to document their UTC behavior explicitly.

### 6. Priority: Phase 1 fix (before Phase 2)

Implementation order: after RISK-02 -- these are independent but both should be in the same commit.

---

## RISK-06: ID Generation Collision No Retry

### 1. Current Code Analysis

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/id.ts`

`generateOrderNumber()` (lines 12-17) calls `crypto.randomInt(100000, 999999)` which produces integers in range [100000, 999999) -- that is 899,999 possible values. Combined with the date prefix (`ORD-20260304-`), uniqueness resets daily.

Birthday paradox calculation: for n items from a space of 899,999, collision probability P = 1 - e^(-n^2 / (2 * 899999)). At n=100 (daily volume): P = 0.55%. At n=1000: P = 42.7%.

The function is a pure utility -- it generates a string and has no awareness of the database. The plan document (plan5.md section 5.2, principle 5) specifies that repositories must handle uniqueness: `.eq('status', expected)` pattern. But no explicit retry-on-unique-violation pattern is documented for ID generation.

### 2. Root Cause

Separation of concerns: the utility generates candidate IDs, the repository layer is responsible for persisting them with UNIQUE constraint enforcement. The gap is that no retry mechanism is documented or planned for when the UNIQUE constraint rejects a duplicate.

### 3. Solution Options

**Option A: Add retry logic in Phase 2 repository layer (Recommended)**

| Aspect | Assessment |
|--------|------------|
| Pros | Correct layer for DB interaction. id.ts stays pure. Repository has DB context for retry |
| Cons | Retry logic in every repo that inserts with generated IDs (orders, products). Small duplication |
| Complexity | Low (wrap insert in try-catch with max 3 retries) |
| Performance | No impact in normal case. 1-2 extra DB calls on collision (extremely rare) |

**Option B: Switch to UUID v7 in id.ts**

| Aspect | Assessment |
|--------|------------|
| Pros | Practically zero collision. Time-ordered. Standard |
| Cons | Changes order number format from human-readable `ORD-20260304-123456` to UUID. Breaks the business requirement for readable order numbers |
| Complexity | Low (1-line change) |
| Performance | No impact |

**Option C: Increase random space (8 digits instead of 6)**

| Aspect | Assessment |
|--------|------------|
| Pros | Reduces collision probability by 100x. Minimal format change |
| Cons | Does not eliminate risk. Still no retry. Order numbers become longer |
| Complexity | Trivial (1-line change) |
| Performance | No impact |

### 4. Recommended Solution: Option A (deferred to Phase 2)

No changes to `id.ts` now. Phase 2 repository implementation pattern:

```typescript
// Pattern for orders.repo.ts (Phase 2)
async function createOrder(data: OrderInput): Promise<Order> {
  const MAX_RETRIES = 3
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const orderNumber = generateOrderNumber()
    const { data: order, error } = await supabase
      .from('orders')
      .insert({ ...data, order_number: orderNumber })
      .select('id,order_number,customer_name,...')
      .single()

    if (!error) return mapToOrder(order)
    if (error.code === '23505') continue  // unique_violation -> retry
    throw new Error(`주문 생성 실패: ${error.message}`)
  }
  throw new Error('주문번호 생성 실패: 최대 재시도 횟수 초과')
}
```

**Changed files**: None in Phase 1. Pattern documented for Phase 2.

### 5. Side Effect Analysis

- **Downstream impact**: None now. Phase 2 repos will implement retry.
- **Test scope**: Phase 2 integration tests.

### 6. Priority: Phase 2 (repository implementation)

Implementation order: embedded in Phase 2 repository creation. No Phase 1 changes needed.

---

## RISK-07: Excel Parser Type Safety Gap

### 1. Current Code Analysis

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/excel.ts` (lines 36-40)

`sheetToJson<T>()` is a thin wrapper around `XLSX.utils.sheet_to_json<T>()`. The generic `T` is only a compile-time assertion. At runtime, `sheet_to_json` returns `any[]` internally and the type parameter has no effect on the output. The XLSX library does not perform runtime type checking.

The existing `validateHeaders()` function (lines 45-62) checks that required column names exist but does not validate data types or values in cells.

### 2. Root Cause

The plan document's co-location strategy (plan5.md section 4.2) states: "Phase 5에서 정의하는 것 -- 각 라우트 디렉토리 schema.ts." The intent is that runtime validation happens at the route level using Zod. The excel utility is intentionally a "parse-only" layer. The risk is that the separation between parsing and validation creates a gap if a Phase 5 developer forgets to add Zod validation after `sheetToJson()`.

### 3. Solution Options

**Option A: Add JSDoc warning + validated variant (Recommended)**

| Aspect | Assessment |
|--------|------------|
| Pros | Documents the contract. Provides a safe path. Does not break existing API |
| Cons | Optional -- developers can still use the unvalidated version |
| Complexity | Low (15 lines for new function) |
| Performance | Zod validation adds ~1ms per 100 rows (negligible) |

**Option B: Force Zod schema parameter in sheetToJson**

| Aspect | Assessment |
|--------|------------|
| Pros | Cannot forget validation. Compile-time enforcement |
| Cons | Breaking change. Requires Zod dependency in excel.ts (currently not imported). Every caller must provide a schema even for exploration/debugging |
| Complexity | Low (signature change) |
| Performance | Same as Option A |

**Option C: Add runtime type assertion in sheetToJson**

| Aspect | Assessment |
|--------|------------|
| Pros | Catches type mismatches at parse time |
| Cons | Cannot assert against a generic type at runtime in TypeScript. Requires passing a schema/validator -- becomes Option B |
| Complexity | Not feasible without schema parameter |

### 4. Recommended Solution: Option A

**Changes to `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/excel.ts`** (add after line 40):

```typescript
import { z, type ZodSchema } from 'zod'  // add to imports at line 7

/**
 * 워크시트를 JSON 배열로 변환 후 Zod 스키마로 검증.
 * 각 행을 개별 검증하여 유효한 행만 반환 + 에러 목록 제공.
 */
export function sheetToJsonValidated<T>(
  sheet: XLSX.WorkSheet,
  schema: ZodSchema<T>,
): { valid: T[]; errors: Array<{ row: number; issues: string }> } {
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const valid: T[] = []
  const errors: Array<{ row: number; issues: string }> = []

  for (let i = 0; i < raw.length; i++) {
    const result = schema.safeParse(raw[i])
    if (result.success) {
      valid.push(result.data)
    } else {
      errors.push({ row: i + 2, issues: result.error.message })
    }
  }

  return { valid, errors }
}
```

Also update JSDoc on existing `sheetToJson`:
```typescript
/**
 * 워크시트를 JSON 배열로 변환.
 * WARNING: 런타임 타입 검증을 수행하지 않음. 호출자가 Zod 스키마로 검증 필수.
 * 타입 안전이 필요하면 sheetToJsonValidated() 사용.
 */
```

**Changed files**: `apps/web/lib/utils/excel.ts` (net +20 lines, total ~83 lines -- under 100)

### 5. Side Effect Analysis

- **Downstream impact**: None. Existing `sheetToJson` API is unchanged. New function is additive.
- **Zod dependency**: Already in `package.json` (`zod: ^4.3.6`). No new dependency.
- **Test scope**: 1 test for `sheetToJsonValidated` with a mock worksheet and a Zod schema (pass/fail rows).

### 6. Priority: Phase 1 fix (before Phase 2)

Implementation order: after RISK-05 -- independent but enhances the excel utility used in Phase 5 upload routes.

---

## RISK-08: Brand Alias Map Missing Variants

### 1. Current Code Analysis

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/brand.ts` (lines 8-61)

The `BRAND_ALIAS_MAP` has 60 entries covering 20 brands. Each brand has Korean + English + common abbreviation entries. `normalizeBrand()` (lines 67-70) lowercases input and looks up in the map. Unknown brands fall through to `toUpperCase()`.

Verified: "MONCLER" at line 47-48 is the correct spelling (Moncler S.p.A., Italian luxury brand). This is NOT a typo.

Missing common variants that users may type:
- `'monclair'` (common English misspelling)
- `'몽끌레르'` (alternative Korean spelling)
- `'이브생로랑'` (formal Korean name for Saint Laurent)
- `'크리스챤 디올'` (alternative Korean for Christian Dior)

### 2. Root Cause

The alias map was built from the most common Korean and English names. Edge-case misspellings were not included because the primary use case is admin data entry (small team, trained users), not public-facing search.

### 3. Solution Options

**Option A: Add common misspellings now (Recommended for Phase 6)**

| Aspect | Assessment |
|--------|------------|
| Pros | Catches more user input variations. Low effort |
| Cons | Map grows indefinitely. Never truly complete |
| Complexity | Trivial (add lines to the map) |

**Option B: Fuzzy matching (Levenshtein distance)**

| Aspect | Assessment |
|--------|------------|
| Pros | Handles arbitrary typos without explicit mapping |
| Cons | Performance cost. False positives (similar brand names). Needs threshold tuning |
| Complexity | Medium (requires library or custom implementation) |

**Option C: No change**

| Aspect | Assessment |
|--------|------------|
| Pros | Simple. Unknown brands still uppercase correctly |
| Cons | Minor UX gap for admin users |

### 4. Recommended Solution: Option A, deferred to Phase 6

No Phase 1 changes. When Phase 6 (frontend) is built, add 5-10 more aliases based on actual usage data from the admin UI search logs.

**Changed files**: None now.

### 5. Side Effect Analysis

- Adding aliases is purely additive. No breaking changes possible.
- **Test scope**: One test per new alias (trivial).

### 6. Priority: Phase 6 (lowest priority)

Implementation order: deferred until frontend search implementation.

---

## RISK-09: sanitizePath ENOENT on Non-Existent Files

### 1. Current Code Analysis

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/path.ts` (lines 14-23)

`sanitizePath()` calls `fs.realpathSync(fullPath)` at line 18. `realpathSync` resolves symlinks and returns the canonical path, but it requires the path to exist. If the file does not exist, it throws `ENOENT`.

Call flow: `path.basename(userInput)` at line 15 strips directory components (safe). `path.join(basePath, fileName)` at line 16 constructs the target path. `fs.realpathSync(basePath)` at line 17 validates the base directory exists (correct). `fs.realpathSync(fullPath)` at line 18 validates the target file exists (only correct for read operations, not for pre-upload validation).

### 2. Root Cause

The function was designed for the "validate existing file path" use case (plan5.md section 4.3, SEC-03 symlink defense). Upload paths (validate destination before writing) were not in scope.

### 3. Solution Options

**Option A: Add `sanitizeUploadPath()` for write scenarios (Recommended)**

| Aspect | Assessment |
|--------|------------|
| Pros | Separate function for separate use case. No breaking change |
| Cons | Two functions to maintain. Naming must be clear |
| Complexity | Low (10 lines) |
| Security | `path.resolve()` without `realpathSync` still prevents `../` traversal because `path.basename()` already strips directory components |

**Option B: Add `{ mustExist: boolean }` option to sanitizePath**

| Aspect | Assessment |
|--------|------------|
| Pros | Single function. Flexible |
| Cons | API complexity. Boolean parameter is a code smell (two behaviors in one function) |
| Complexity | Low |

**Option C: No change (document limitation)**

| Aspect | Assessment |
|--------|------------|
| Pros | Zero effort |
| Cons | Phase 5 upload routes will need their own path validation |

### 4. Recommended Solution: Option A

**Changes to `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/path.ts`** (append after line 23):

```typescript
/**
 * 업로드 대상 경로를 안전하게 검증한다.
 * 파일이 아직 존재하지 않아도 동작 (basePath만 존재 확인).
 * basePath 밖으로의 경로 탈출을 차단한다.
 */
export function sanitizeUploadPath(basePath: string, userInput: string): string {
  const fileName = path.basename(userInput)
  if (!fileName || fileName === '.' || fileName === '..') {
    throw new Error(`유효하지 않은 파일명: ${userInput}`)
  }
  const realBase = fs.realpathSync(basePath)
  const fullPath = path.resolve(realBase, fileName)
  if (!fullPath.startsWith(realBase)) {
    throw new Error(`경로 탈출 시도 차단: ${userInput}`)
  }
  return fullPath
}
```

**Changed files**: `apps/web/lib/utils/path.ts` (net +14 lines, total ~37 lines)

### 5. Side Effect Analysis

- **Downstream impact**: None. Existing `sanitizePath` unchanged.
- **Test scope**: 2 tests: valid upload path returns resolved path, `../` input is blocked.

### 6. Priority: Phase 5 (upload route implementation)

Implementation order: can be done now or deferred. Recommend adding now since it is small.

---

## RISK-10: SMS Template Unreplaced Placeholder

### 1. Current Code Analysis

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/sms-templates.ts` (lines 32-41)

`buildSmsMessage()` iterates over `params` entries and replaces `{{key}}` patterns in the template string. The iteration is over `params` (caller-provided), not over the template's placeholders. If the template has `{{warehousePhone}}` but `params` does not include `warehousePhone`, that placeholder remains unreplaced.

Template analysis:
- `CONSIGNMENT_RECEIVED`: requires `sellerName`, `warehousePhone`
- `CONSIGNMENT_APPROVED`: requires `sellerName`
- `CONSIGNMENT_REJECTED`: requires `sellerName`, `warehousePhone`
- `SETTLEMENT_CONFIRMED`: requires `sellerName`, `period`, `amount`
- `ORDER_SHIPPED`: requires `customerName`, `trackingNumber`

### 2. Root Cause

The `params` parameter is `Record<string, string>` -- no compile-time enforcement of which keys are required for each template. The function treats all templates uniformly without per-template parameter validation.

### 3. Solution Options

**Option A: Post-replacement regex check (Recommended)**

| Aspect | Assessment |
|--------|------------|
| Pros | Catches all missed placeholders. Simple. No type system change |
| Cons | Runtime error only (not compile-time). Error message does not specify which placeholder |
| Complexity | Trivial (2 lines) |

**Option B: Type-safe params per template (overloads or mapped types)**

| Aspect | Assessment |
|--------|------------|
| Pros | Compile-time enforcement. Documents required params per template |
| Cons | Complex type system. Every template change requires type update. Overloads make the function verbose |
| Complexity | Medium (15-20 lines of type definitions) |

**Option C: No change (rely on Phase 4 service layer validation)**

| Aspect | Assessment |
|--------|------------|
| Pros | Zero effort. Notification service can validate before calling |
| Cons | Defense-in-depth violation. Easy to miss |

### 4. Recommended Solution: Option A

**Changes to `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/sms-templates.ts`** (modify lines 36-41):

```typescript
export function buildSmsMessage(
  template: SmsTemplate,
  params: Record<string, string>,
): string {
  let message = TEMPLATES[template]
  for (const [key, value] of Object.entries(params)) {
    message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  // NEW: unreplaced placeholder check
  const unreplaced = message.match(/\{\{.+?\}\}/g)
  if (unreplaced) {
    throw new Error(`SMS 템플릿 미치환 변수: ${unreplaced.join(', ')}`)
  }
  return message
}
```

**Changed files**: `apps/web/lib/utils/sms-templates.ts` (net +4 lines, total ~46 lines)

**New test in `__tests__/unit/utils.test.ts`**:
```typescript
it('throws on missing template variables', () => {
  expect(() => buildSmsMessage('CONSIGNMENT_RECEIVED', { sellerName: 'test' }))
    .toThrow('SMS 템플릿 미치환 변수')
})
```

### 5. Side Effect Analysis

- **Downstream impact**: Callers that previously produced unreplaced-placeholder messages will now get an exception. This is the desired behavior -- better to fail loudly than send broken SMS.
- **Backward compatibility**: Breaking change for any caller that omits required params. This is intentional.
- **Test scope**: 1 new test. Existing test in `utils.test.ts` (lines 128-148) already passes all required params and will continue to pass.

### 6. Priority: Phase 1 fix (before Phase 2)

Implementation order: after RISK-05 -- independent.

---

## RISK-11: Supabase Client Factory Per-Call Creation

### 1. Current Code Analysis

**Files**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/supabase/admin.ts` (line 15-21), `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/supabase/client.ts` (line 15-21)

Both `createAdminClient()` and `createAnonClient()` call `createClient()` from `@supabase/supabase-js` on every invocation. This creates a new `SupabaseClient` instance each time, which includes:
- New `GoTrueClient` (auth state management)
- New `PostgrestClient` (query builder)
- New fetch wrapper with auth headers

The plan document (plan5.md section 5.1) specifies `lib/db/client.ts` as part of Phase 2, which is meant to be the request-scoped client provider.

In a Next.js API route handler, a single request might create an order (calling `orders.repo` -> `createAdminClient()`), then update products (calling `products.repo` -> `createAdminClient()`), then send notification (calling `notifications.repo` -> `createAdminClient()`) -- that's 3 client instances for one request.

### 2. Root Cause

The Phase 1 client factories were designed as "minimal viable" wrappers -- the plan explicitly says "팩토리 함수로 호출 시점에 환경변수 검증 -- module-level 싱글톤 금지." The module-level singleton prohibition is correct (Next.js build safety). The per-request singleton was deferred to Phase 2's `db/client.ts`.

### 3. Solution Options

**Option A: Implement `db/client.ts` with globalThis caching in Phase 2 (Recommended)**

| Aspect | Assessment |
|--------|------------|
| Pros | Standard Next.js pattern. One client per Node.js process in production, re-created on HMR in dev. Clean separation |
| Cons | globalThis pollution (mitigated by namespace) |
| Complexity | Low (15 lines) |
| Performance | Eliminates redundant client creation. ~1-2ms saved per request |

**Option B: Lazy singleton in admin.ts/client.ts now**

| Aspect | Assessment |
|--------|------------|
| Pros | Immediate fix. No new file |
| Cons | Conflicts with Phase 2 plan. `db/client.ts` is the designated location |
| Complexity | Low |

**Option C: No change (defer entirely to Phase 2)**

| Aspect | Assessment |
|--------|------------|
| Pros | Follow the plan exactly. No premature optimization |
| Cons | Phase 2 repos will initially create multiple clients per request |

### 4. Recommended Solution: Option A, implemented in Phase 2

Phase 2 `db/client.ts` pattern:

```typescript
/**
 * Request-scoped Supabase client provider
 * WHY: admin.ts/client.ts factories create new instances per call -> waste
 * HOW: globalThis caching (standard Next.js pattern for dev/prod safety)
 * WHERE: all repositories import getAdminClient() from here
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { createAnonClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

const globalForSupabase = globalThis as unknown as {
  adminClient?: SupabaseClient
  anonClient?: SupabaseClient
}

export function getAdminClient(): SupabaseClient {
  if (!globalForSupabase.adminClient) {
    globalForSupabase.adminClient = createAdminClient()
  }
  return globalForSupabase.adminClient
}

export function getAnonClient(): SupabaseClient {
  if (!globalForSupabase.anonClient) {
    globalForSupabase.anonClient = createAnonClient()
  }
  return globalForSupabase.anonClient
}
```

**Changed files**: None in Phase 1. `apps/web/lib/db/client.ts` created in Phase 2.

### 5. Side Effect Analysis

- **Downstream impact**: Phase 2 repositories will import from `@/lib/db/client` instead of directly from `@/lib/supabase/admin`. The factory files remain as low-level primitives.
- **Test scope**: Phase 2 integration tests.

### 6. Priority: Phase 2 (embedded in data layer creation)

Implementation order: first file created in Phase 2 -- all repositories depend on it.

---

## Implementation Priority and Dependency Order

### Phase 1 Immediate Fixes (before Phase 2 starts)

```
Step 1: RISK-03 (.env.example)         -- no dependencies, documentation
Step 2: RISK-02 (PUBLIC_ENV guards)    -- depends on correct env var names from Step 1
Step 3: RISK-01 (Session TTL)          -- independent, CRITICAL severity
Step 4: RISK-05 (KST date functions)   -- independent, utility addition
Step 5: RISK-10 (SMS placeholder)      -- independent, utility hardening
Step 6: RISK-07 (Excel validated fn)   -- independent, utility addition
Step 7: RISK-09 (Upload path fn)       -- independent, utility addition
```

Estimated total effort: ~2 hours. Net new code: ~80 lines across 7 files.

### Phase 2 Embedded Fixes

```
Step 8: RISK-11 (db/client.ts)         -- first Phase 2 file
Step 9: RISK-06 (ID retry in repos)    -- built into repo implementation
```

### Phase 3 Deferred Fix

```
Step 10: RISK-04 (Rate limiter cooldown) -- alongside middleware creation
```

### Phase 6 Deferred Fix

```
Step 11: RISK-08 (Brand alias expansion) -- alongside frontend search
```

---

## Summary Table

| Priority | Risk ID | Fix Location | Lines Changed | Files Changed | Dependencies |
|----------|---------|-------------|---------------|---------------|-------------|
| 1 | RISK-03 | .env.example | ~50 (rewrite) | 1 | None |
| 2 | RISK-02 | supabase/admin.ts, client.ts | +9 | 2 | RISK-03 |
| 3 | RISK-01 | auth.ts | +6 | 1 | None |
| 4 | RISK-05 | utils/date.ts | +18 | 1 | None |
| 5 | RISK-10 | utils/sms-templates.ts | +4 | 1 | None |
| 6 | RISK-07 | utils/excel.ts | +20 | 1 | None |
| 7 | RISK-09 | utils/path.ts | +14 | 1 | None |
| 8 | RISK-11 | db/client.ts (NEW) | ~25 | 1 | Phase 2 start |
| 9 | RISK-06 | repos (Phase 2) | ~10/repo | 2-3 | Phase 2 repos |
| 10 | RISK-04 | ratelimit.ts | +12 | 1 | Phase 3 |
| 11 | RISK-08 | utils/brand.ts | +5-10 | 1 | Phase 6 |
