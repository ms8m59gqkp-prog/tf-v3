# Phase 1 Risk and Response Report

**Feature**: web (Classic Menswear V3)
**Phase**: Phase 1 -- Infrastructure + Domain Types + Utilities
**Commit**: `dcb60a7` (2026-03-04)
**Analyzed by**: CTO Lead (Opus 4.6)
**Date**: 2026-03-04

---

## 1. Implemented File Inventory (25 files from commit dcb60a7)

### 1.1 Infrastructure (L0) -- 5 files

| # | File | Lines | Purpose |
|---|------|-------|---------|
| 1 | `lib/env.ts` | 53 | requireEnv() + SERVER_ENV_KEYS + PUBLIC_ENV |
| 2 | `lib/auth.ts` | 105 | bcrypt password hashing + HMAC-SHA256 session tokens |
| 3 | `lib/ratelimit.ts` | 64 | Upstash Redis sliding window rate limiter |
| 4 | `lib/supabase/admin.ts` | 21 | service_role client factory (RLS bypass) |
| 5 | `lib/supabase/client.ts` | 21 | anon client factory (RLS enforced) |

### 1.2 Domain Types (L1/types) -- 8 files

| # | File | Lines | Purpose |
|---|------|-------|---------|
| 6 | `lib/types/index.ts` | 14 | Barrel re-export |
| 7 | `lib/types/domain/seller.ts` | 27 | SellerTier + COMMISSION_RATES (single source) |
| 8 | `lib/types/domain/consignment.ts` | 41 | 7-value status + transition map |
| 9 | `lib/types/domain/order.ts` | 73 | 8-value status + transition map + Condition |
| 10 | `lib/types/domain/settlement.ts` | 87 | Settlement + SoldItem + SettlementQueue + SalesRecord |
| 11 | `lib/types/domain/product.ts` | 36 | StProduct + MEASUREMENT_FIELDS |
| 12 | `lib/types/domain/notification.ts` | 25 | SmsStatus + SmsResult + NotificationLog |
| 13 | `lib/types/domain/photo.ts` | 49 | BatchProgress + ClassifiedFile + ClassifiedGroup |

### 1.3 Utilities (L1/utils) -- 12 files

| # | File | Lines | Purpose |
|---|------|-------|---------|
| 14 | `lib/utils/validation.ts` | 20 | 5 shared Zod schemas |
| 15 | `lib/utils/phone.ts` | 41 | Korean phone normalization/formatting |
| 16 | `lib/utils/brand.ts` | 70 | Brand alias map + normalization |
| 17 | `lib/utils/category.ts` | 34 | Keyword-based category inference |
| 18 | `lib/utils/currency.ts` | 30 | KRW formatting/parsing |
| 19 | `lib/utils/date.ts` | 85 | UTC storage + KST display conversion |
| 20 | `lib/utils/id.ts` | 27 | Order/product number generation (crypto.randomInt) |
| 21 | `lib/utils/sms-templates.ts` | 41 | SMS template builder |
| 22 | `lib/utils/excel.ts` | 62 | Safe Excel parsing + header validation |
| 23 | `lib/utils/chunk.ts` | 18 | Array chunking for Supabase .in() limits |
| 24 | `lib/utils/path.ts` | 23 | Path traversal + symlink prevention |
| 25 | `lib/utils/photo-url.ts` | 20 | Photo URL helper (Phase 7 switch-ready) |

### 1.4 Test Coverage -- 3 test files, 63 tests

| File | Tests | Status |
|------|-------|--------|
| `__tests__/unit/types.test.ts` | 16 | ALL PASS |
| `__tests__/unit/utils.test.ts` | 26 | ALL PASS |
| `__tests__/unit/validation.test.ts` | 21 | ALL PASS |

### 1.5 Build Verification

| Check | Result |
|-------|--------|
| `tsc --noEmit` | 0 errors |
| `vitest run` | 63/63 pass |
| `any` type usage | 0 occurrences |
| `NextRequest` import in L1 | 0 occurrences |

---

## 2. Risk Identification and Analysis

### RISK-01: Session Token Has No TTL (CRITICAL)

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/auth.ts` (lines 57-72)

**Finding**: `createSessionToken()` embeds `iat` (issued-at) in the payload but `verifySessionToken()` never checks token age. Once issued, a session token is valid forever.

**Evidence**:
```typescript
// createSessionToken (line 60-62)
const payload: SessionPayload = {
  adminId,
  iat: Date.now(),  // iat is recorded
  jti: randomBytes(16).toString('hex'),
}

// verifySessionToken (line 97-101)
const payload = JSON.parse(
  Buffer.from(payloadHex, 'hex').toString('utf8')
) as SessionPayload
return { valid: true, adminId: payload.adminId }
// ^^^ No TTL check. iat is ignored.
```

**Impact**: Stolen session tokens remain valid indefinitely. Admin session hijacking has no natural expiration boundary.

**Severity**: CRITICAL -- authentication bypass risk

**Response**:
- Phase 3 (Middleware) must implement TTL check: reject tokens where `Date.now() - payload.iat > SESSION_TTL_MS`
- Add `SESSION_TTL_MS` constant (recommended: 24 hours = 86400000ms)
- Add `exp` field to `SessionPayload` interface as defense-in-depth
- Unit test: create token, advance time past TTL, verify returns `{ valid: false }`

---

### RISK-02: PUBLIC_ENV Fallback to Empty String (HIGH)

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/env.ts` (lines 49-53)

**Finding**: `PUBLIC_ENV` uses `?? ''` fallback for all values. If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing, both Supabase clients will be created with empty strings, causing silent failures rather than clear errors.

**Evidence**:
```typescript
export const PUBLIC_ENV = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',       // empty = silent fail
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', // empty = silent fail
  SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',           // acceptable: optional
} as const
```

**Impact**: `createAnonClient()` and `createAdminClient()` will create clients with `url: ''` and `key: ''`. The Supabase SDK will not throw at creation time -- it will throw cryptic errors on first query. This makes debugging extremely difficult in staging/production deployments.

**Severity**: HIGH -- silent misconfiguration

**Response**:
- Add runtime validation in both client factories. `createAdminClient()` already calls `requireEnv()` for the key but uses `PUBLIC_ENV.SUPABASE_URL` which can be empty
- Option A: Add a `requirePublicEnv()` function that throws if value is empty
- Option B: Add guard in both `createAdminClient` and `createAnonClient`: `if (!PUBLIC_ENV.SUPABASE_URL) throw new Error('[supabase] NEXT_PUBLIC_SUPABASE_URL is not set')`
- SENTRY_DSN can remain optional (empty string is acceptable for disabled monitoring)

---

### RISK-03: .env.example Missing 15 Environment Variables (HIGH)

**File**: `/Users/jeongmyeongcheol/tf-v3/.env.example`

**Finding**: `.env.example` has 12 variables. `SERVER_ENV_KEYS` in `env.ts` defines 16 keys. `.env.local` has 27 variables. The gap means new developers or CI pipelines will miss critical configuration.

**Missing from .env.example but required in code**:

| Variable | Where Required | Status |
|----------|----------------|--------|
| `ADMIN_ID` | auth.ts (login) | MISSING from .env.example |
| `ADMIN_PASSWORD` | auth.ts (login) | MISSING from .env.example |
| `SESSION_SECRET` | auth.ts (HMAC signing) | MISSING from .env.example |
| `UPSTASH_REDIS_REST_URL` | ratelimit.ts | MISSING from .env.example |
| `UPSTASH_REDIS_REST_TOKEN` | ratelimit.ts | MISSING from .env.example |
| `WAREHOUSE_NAME` | sms-templates params | MISSING from .env.example |
| `WAREHOUSE_PHONE` | sms-templates params | MISSING from .env.example |
| `WAREHOUSE_ZIPCODE` | shipping (Phase 5) | MISSING from .env.example |
| `WAREHOUSE_ADDRESS` | shipping (Phase 5) | MISSING from .env.example |
| `NAVER_CLIENT_ID` | naver integration | MISSING from .env.example |
| `NAVER_CLIENT_SECRET` | naver integration | MISSING from .env.example |
| `ANTHROPIC_API_KEY` | AI classification | MISSING from .env.example |
| `OPENAI_API_KEY` | AI classification | MISSING from .env.example |
| `PHOTOROOM_API_KEY` | photo processing | MISSING from .env.example |
| `NEXT_PUBLIC_SUPABASE_URL` | supabase client | Listed as `SUPABASE_URL` (wrong prefix) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | supabase client | Listed as `SUPABASE_ANON_KEY` (wrong prefix) |

**Impact**: CI pipeline failures. New developer onboarding friction. Potential runtime crashes from missing `requireEnv()` calls.

**Severity**: HIGH -- operational/onboarding risk

**Response**:
- Update `.env.example` to include all 27 variables with placeholder values
- Use correct `NEXT_PUBLIC_` prefix for client-side variables
- Group by phase/feature for clarity
- Add comments indicating which are optional vs required

---

### RISK-04: Rate Limiter Singleton Not Thread-Safe for Hot Reload (MEDIUM)

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/ratelimit.ts` (lines 25-39)

**Finding**: The lazy singleton pattern uses a module-level `let rateLimiter`. In Next.js dev mode, module-level state can be lost on hot reload, causing the rate limiter to be re-created. More importantly, multiple serverless function instances in production will each have their own `rateLimiter` variable, but since Upstash Redis is the actual state store, this is architecturally fine.

However, the real risk is: if `requireEnv()` fails (Redis credentials missing), the singleton is never set, and **every subsequent request** will re-attempt initialization, flooding logs with identical errors.

**Evidence**:
```typescript
let rateLimiter: Ratelimit | null = null

function getRateLimiter(): Ratelimit {
  if (!rateLimiter) {
    rateLimiter = new Ratelimit({  // Re-attempts on every call if first attempt throws
      redis: new Redis({
        url: requireEnv('UPSTASH_REDIS_REST_URL'),   // throws if missing
        token: requireEnv('UPSTASH_REDIS_REST_TOKEN'), // throws if missing
      }),
      ...
    })
  }
  return rateLimiter
}
```

**Impact**: If Redis credentials are misconfigured, every API request triggers `requireEnv()` failure + `console.error` log. In graceful fallback mode this means every request passes through (rate limiting disabled) with error log noise.

**Severity**: MEDIUM -- operational noise, no security bypass (graceful fallback is correct behavior)

**Response**:
- Consider caching the failure state: if initialization fails once, skip re-attempts for a cooldown period (e.g., 60 seconds)
- Or: initialize once at startup (Phase 3 middleware init) and let it fail-fast
- The graceful fallback (allow requests on Redis failure) is correct and should be preserved

---

### RISK-05: Date Utility toStartOfDay/toEndOfDay KST Boundary Mismatch (MEDIUM)

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/date.ts` (lines 70-85)

**Finding**: `toStartOfDay('2026-03-04')` returns `2026-03-04T00:00:00.000Z` (UTC midnight). But for Korean users, "March 4th" means KST 00:00 = UTC 15:00 on March 3rd. The functions return UTC midnight, not KST midnight.

This is the exact V2 bug documented as `DAT-02` in the plan. The comment says "저장은 UTC, 표시는 KST 변환" but the range functions do not perform KST-to-UTC conversion for queries.

**Evidence**:
```typescript
// date.ts comment: "WHY: V2 KST/UTC 혼용 → 정산 기간 하루 오차 (DAT-02)"

export function toStartOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)  // UTC midnight, NOT KST midnight
}

export function toEndOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999Z`)  // UTC end-of-day, NOT KST end-of-day
}
```

When used in settlement period queries like "show sales from 2026-03-01 to 2026-03-31":
- User means KST 03-01 00:00 to KST 03-31 23:59:59
- Code produces UTC 03-01 00:00 to UTC 03-31 23:59:59
- Mismatch: 9 hours of data at boundaries will be included/excluded incorrectly

**Impact**: Settlement calculations at month boundaries could include/exclude ~9 hours of data. This is the same class of bug as DAT-02.

**Severity**: MEDIUM -- financial accuracy risk at boundaries

**Response**:
- Add KST-aware range functions: `toKSTStartOfDay(dateStr)` returning `new Date(dateStr + 'T00:00:00+09:00')` which is UTC 15:00 previous day
- Or: document clearly that toStartOfDay/toEndOfDay are UTC-based and that Phase 4 services must apply the 9-hour offset
- The settlement service (Phase 4) must use KST-aware boundaries, not raw UTC midnight
- Add test cases that verify boundary behavior across KST/UTC transition

---

### RISK-06: ID Generation Collision Probability (MEDIUM)

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/id.ts`

**Finding**: `generateOrderNumber()` uses `crypto.randomInt(100000, 999999)` for the 6-digit suffix. This is 899,999 possible values per date. At scale, the birthday paradox gives ~50% collision probability at ~1,177 IDs per day.

For a menswear consignment business, daily order volume is likely < 100, so collision risk is very low. However, there is no uniqueness check or retry mechanism.

**Evidence**:
```typescript
export function generateOrderNumber(date?: Date): string {
  const suffix = String(randomInt(100000, 999999))  // ~900K values/day
  return `ORD-${prefix}-${suffix}`
  // No DB uniqueness check. No retry on collision.
}
```

**Impact**: Extremely unlikely in practice (< 0.5% at 100 orders/day), but a collision would cause DB insert failure (UNIQUE constraint in Phase 0 will catch it, but no retry logic).

**Severity**: MEDIUM -- low probability, but no graceful recovery

**Response**:
- Phase 2 repository layer should implement retry-on-unique-violation: generate new number and retry (max 3 attempts)
- Alternative: switch to UUID v7 (time-ordered) for true uniqueness without retry
- Current approach is acceptable for business volume but needs retry at repository layer

---

### RISK-07: Excel Parser Type Safety Gap (MEDIUM)

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/excel.ts` (lines 36-40)

**Finding**: `sheetToJson<T>()` uses a generic type parameter but performs no runtime validation. The caller specifies `T` but the actual data from the Excel file is untyped. This creates a false sense of type safety.

**Evidence**:
```typescript
export function sheetToJson<T extends Record<string, unknown>>(
  sheet: XLSX.WorkSheet,
): T[] {
  return XLSX.utils.sheet_to_json<T>(sheet, { defval: '' })
  // T is a compile-time assertion only. Runtime data is unvalidated.
}
```

**Impact**: If an Excel file has unexpected columns or data types, the code will silently produce objects that don't match `T`. Downstream code (settlement calculations, naver settlement parsing) will operate on potentially incorrect data.

**Severity**: MEDIUM -- data integrity risk in upload flows

**Response**:
- Phase 5 upload routes must pair `sheetToJson()` with Zod validation (per co-location strategy)
- Add documentation comment in excel.ts: "Runtime validation MUST be performed by the caller using Zod schema"
- Consider adding a `sheetToJsonValidated<T>(sheet, schema: ZodSchema<T>)` variant that combines parsing and validation

---

### RISK-08: Brand Alias Map Typo -- "MONCLER" vs "MONCLER" (LOW)

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/brand.ts` (lines 47-48)

**Finding**: The alias map maps both Korean and English to `'MONCLER'`. The correct spelling is `MONCLER` (without an 'E'). This matches the actual brand name (Moncler S.p.A.), so this is NOT a bug -- but it is a common source of confusion since many people misspell it as "Monclair" or "Montcler".

However, there is a genuine missing alias: the map does not include `'montcler'`, `'몽끌레르'`, or other common misspellings.

**Severity**: LOW -- cosmetic, does not affect functionality

**Response**:
- Consider adding common misspellings to the alias map
- This is a Phase 6 enhancement (can be added when frontend search is implemented)

---

### RISK-09: path.ts realpathSync Throws on Non-Existent Files (LOW)

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/path.ts` (lines 14-23)

**Finding**: `fs.realpathSync(fullPath)` will throw `ENOENT` if the file does not yet exist. For upload scenarios, the file may not exist at validation time (pre-upload path check).

**Evidence**:
```typescript
export function sanitizePath(basePath: string, userInput: string): string {
  const fileName = path.basename(userInput)
  const fullPath = path.join(basePath, fileName)
  const realBase = fs.realpathSync(basePath)
  const realPath = fs.realpathSync(fullPath)  // ENOENT if file doesn't exist yet
  ...
}
```

**Impact**: Cannot use `sanitizePath()` to validate a destination path before file creation. Only works for existing files.

**Severity**: LOW -- limited use case, can be worked around

**Response**:
- For upload scenarios, validate only the base path with `realpathSync()` and construct the full path using `path.resolve()`
- Add a `sanitizeUploadPath()` variant that only validates the base directory exists and the filename doesn't contain traversal sequences
- Current function is correct for its documented use case (reading existing files)

---

### RISK-10: SMS Template Unreplaced Placeholder Silent Pass (LOW)

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/sms-templates.ts` (lines 32-41)

**Finding**: `buildSmsMessage()` does not verify that all `{{placeholders}}` were replaced. If a caller omits a required parameter, the SMS will be sent with literal `{{warehousePhone}}` in the text.

**Evidence**:
```typescript
export function buildSmsMessage(
  template: SmsTemplate,
  params: Record<string, string>,
): string {
  let message = TEMPLATES[template]
  for (const [key, value] of Object.entries(params)) {
    message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return message  // No check for remaining {{ }} patterns
}
```

**Impact**: Customers could receive SMS messages with raw template variables. Unprofessional but not a security risk.

**Severity**: LOW -- cosmetic/UX

**Response**:
- Add a post-replacement check: `if (/\{\{.+?\}\}/.test(message)) throw new Error('Unreplaced template variables')`
- Or: add a type-safe approach where each template declares its required params

---

### RISK-11: Supabase Client Factory Creates New Instance Per Call (LOW)

**Files**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/supabase/admin.ts`, `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/supabase/client.ts`

**Finding**: Both `createAdminClient()` and `createAnonClient()` create a new Supabase client on every call. The plan states "module-level singleton forbidden" for build safety, but Phase 2 repositories will call these factories potentially many times per request.

**Impact**: Each API request could create 3-5 Supabase client instances (one per repository call). Supabase JS SDK is lightweight (no connection pooling), but it does create new fetch instances and auth state each time. Performance overhead is minimal but unnecessary.

**Severity**: LOW -- performance, not correctness

**Response**:
- Phase 2 should implement a request-scoped singleton pattern: create one client per request and pass it to all repositories
- The `db/client.ts` file (planned for Phase 2) should be this singleton factory
- Pattern: `getAdminClient()` creates once per request lifecycle, reuses within that request

---

## 3. Risk Summary Matrix

| ID | Risk | Severity | Phase to Address | Effort |
|----|------|----------|-----------------|--------|
| RISK-01 | Session token no TTL | CRITICAL | Phase 3 (Middleware) | Small |
| RISK-02 | PUBLIC_ENV empty string fallback | HIGH | Phase 2 (before client use) | Small |
| RISK-03 | .env.example missing 15 vars | HIGH | Immediate (before Phase 2) | Small |
| RISK-04 | Rate limiter re-init on failure | MEDIUM | Phase 3 (Middleware) | Small |
| RISK-05 | Date range KST boundary mismatch | MEDIUM | Phase 4 (Service) | Medium |
| RISK-06 | ID collision no retry | MEDIUM | Phase 2 (Repository) | Small |
| RISK-07 | Excel parser no runtime validation | MEDIUM | Phase 5 (Upload routes) | Small |
| RISK-08 | Brand alias missing variants | LOW | Phase 6 (Frontend) | Trivial |
| RISK-09 | sanitizePath ENOENT on new files | LOW | Phase 5 (Upload routes) | Small |
| RISK-10 | SMS unreplaced placeholder | LOW | Phase 4 (Service) | Trivial |
| RISK-11 | Client factory per-call creation | LOW | Phase 2 (db/client.ts) | Small |

---

## 4. Phase 2 Entry Checklist

### 4.1 MUST PASS Before Phase 2 (Blocking)

| # | Check | Current Status | Action Required |
|---|-------|---------------|-----------------|
| G1 | `tsc --noEmit` = 0 errors | PASS (verified) | None |
| G2 | `vitest run` = 63/63 pass | PASS (verified) | None |
| G3 | ConsignmentStatus 7-value confirmed | PASS (types.test.ts) | None |
| G4 | OrderStatus 8-value confirmed | PASS (types.test.ts) | None |
| G5 | COMMISSION_RATES single source | PASS (seller.ts only) | None |
| G6 | `any` type = 0 occurrences | PASS (tsc strict) | None |
| G7 | NextRequest import in L1 = 0 | PASS | None |
| G8 | Zod schemas in validation.ts = exactly 5 | PASS | None |
| G9 | .env.example updated with all required vars | FAIL | Update before Phase 2 |
| G10 | PUBLIC_ENV empty string guard | FAIL | Add guard in client factories |

### 4.2 SHOULD Address Before Phase 2 (Recommended)

| # | Item | Risk ID | Priority |
|---|------|---------|----------|
| S1 | Document session TTL requirement for Phase 3 | RISK-01 | High |
| S2 | Plan db/client.ts request-scoped singleton | RISK-11 | Medium |
| S3 | Plan KST-aware date range functions | RISK-05 | Medium |
| S4 | Plan ID generation retry in repository layer | RISK-06 | Medium |

### 4.3 Phase 2 Scope Reminder (from plan5.md)

Phase 2 must create:
- `lib/db/client.ts` -- Supabase client singleton per request
- 9 repositories: `sellers.repo.ts`, `orders.repo.ts`, `consignments.repo.ts`, `settlement.repo.ts`, `products.repo.ts`, `notifications.repo.ts`, `sales-records.repo.ts`, `naver-settlements.repo.ts`, `batch.repo.ts`
- 3 transactions: `settlement.tx.ts`, `order.tx.ts`, `consignment.tx.ts`
- Each repository max 120 lines, mapping embedded (no separate mapper files)

### 4.4 Architecture Gate Reminders

- Repositories import from `@/lib/types` and `@/lib/supabase` only (L1 -> L0)
- Repositories must NOT import from `next/server`, `@/app/`, or any L2/L3 module
- Transactions wrap multiple repository calls in Supabase RPC or multi-step operations
- All DB column name mapping (snake_case -> camelCase) happens inside repositories

---

## 5. Conclusion

Phase 1 is **well-implemented** with solid foundations. The 25 files follow the 3+1 layer architecture correctly, all 63 unit tests pass, and TypeScript compilation is clean.

The most urgent items before proceeding to Phase 2 are:
1. **RISK-03**: Update `.env.example` (immediate, 10 minutes)
2. **RISK-02**: Add PUBLIC_ENV empty-string guards (immediate, 5 minutes)
3. **RISK-01**: Document session TTL as Phase 3 mandatory requirement

The remaining risks (RISK-04 through RISK-11) are appropriately deferred to their respective phases as documented in the response column.

**Recommendation**: Address G9 and G10 from the checklist, then proceed to Phase 2.
