# Phase 1 Critical/High Issue Fix Plan

**Feature**: web (Classic Menswear V3)
**Source**: code-analyzer Check results (PDCA Check phase)
**Analyzed by**: CTO Lead (Opus 4.6)
**Date**: 2026-03-04
**Scope**: 4 issues (Critical 1, High 3), 3 files

---

## Executive Summary

| ID | Severity | File | Issue | Lines Changed |
|----|----------|------|-------|---------------|
| RISK-CR-01 | CRITICAL | sms-templates.ts:38 | ReDoS via regex metachar injection | 1 |
| RISK-CR-02 | HIGH | date.ts:61-65 | Invalid date rollover (2026-02-30 -> 03-02) | 7 |
| RISK-CR-03 | HIGH | date.ts:30-48 | toKSTDate/toKSTDateTime returns "undefined-undefined-undefined" | 6 |
| RISK-CR-04 | HIGH | path.ts:19,34 | Path traversal via directory prefix collision | 2 |

**Execution order**: CR-01 -> CR-04 -> CR-02 -> CR-03

**Rationale**: CR-01 is the only CRITICAL. CR-04 is a security bug. CR-02 must be fixed before CR-03 because CR-03's fix depends on a working `isValidDateString` (which CR-02 fixes). Dependencies: CR-02 -> CR-03 (sequential). CR-01 and CR-04 are independent.

---

## RISK-CR-01: sms-templates.ts ReDoS Vulnerability

### 1. Current Code Analysis

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/sms-templates.ts`
**Lines**: 36-39

```typescript
// line 36-39
let message = TEMPLATES[template]
for (const [key, value] of Object.entries(params)) {
  message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
}
```

**Root Cause**: `key` comes from `Object.entries(params)` where `params` is `Record<string, string>`. The `key` is interpolated directly into a `RegExp` constructor without escaping regex metacharacters. Two distinct attack vectors:

1. **Regex injection**: If `key = ".*"`, the resulting regex becomes `/\{\{.*\}\}/g` which matches from the first `{{` to the last `}}`, replacing ALL placeholders with one value. Verified output:

   ```
   Input:  "{{sellerName}}님, 문의: {{warehousePhone}}"
   Key:    ".*"
   Regex:  /\{\{.*\}\}/g
   Result: matches "{{sellerName}}님, 문의: {{warehousePhone}}" as ONE match
   ```

2. **RegExp constructor throw**: If `key = "a].*[b"`, `new RegExp(...)` throws `SyntaxError: Invalid regular expression: Unterminated character class`. This crashes the SMS send operation at runtime.

**Reproduction scenario**: A developer passes a params object with a key containing regex metacharacters. While the current TEMPLATES only use simple keys (sellerName, warehousePhone, etc.), the function signature accepts `Record<string, string>` -- any key is allowed at the type level. If a future template introduces a key like `price($)` or if params are built dynamically from user data, the bug activates.

**Severity justification**: CRITICAL because (a) it can crash the SMS notification service with an unhandled SyntaxError, and (b) regex injection silently corrupts message content, sending garbled SMS to customers.

### 2. Fix

**Strategy**: Replace `new RegExp(...)` with `String.prototype.replaceAll()` which performs literal string matching -- no regex, no injection possible.

**Before** (line 38):
```typescript
  message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
```

**After** (line 38):
```typescript
  message = message.replaceAll(`{{${key}}}`, value)
```

**Changes**: 1 line modified. No new lines. No function signature change.

**Runtime compatibility**: `replaceAll` is ES2021. Node >= 15, all modern browsers. Our Next.js 16 target transpiles to `esnext` for server, and polyfills for client. The project tsconfig has `"lib": ["dom", "dom.iterable", "esnext"]` which includes the type definition. Verified: `typeof "".replaceAll === "function"` in the project's Node v25.6.1 runtime.

**Verification**:
```
replaceAll("{{.*}}", "SAFE") on "{{.*}} and {{test}}"
Result: "SAFE and {{test}}"    -- only the literal match is replaced

Old regex: new RegExp("\\{\\{.*\\}\\}", "g") on "{{.*}} and {{test}}"
Result: "DANGER"               -- replaces everything between first {{ and last }}
```

### 3. Side Effect Analysis

- **Callers**: `buildSmsMessage` is called from:
  - `apps/web/__tests__/unit/utils.test.ts` (lines 130, 140) -- 2 test cases
  - No production callers yet (Phase 4 notification service not built)
- **Backward compatibility**: 100% compatible. `replaceAll` with literal strings produces identical output to the RegExp approach for all non-metacharacter keys. All existing template keys (sellerName, warehousePhone, customerName, trackingNumber, period, amount) are simple alphanumeric strings.
- **Existing test impact**: Both existing tests pass -- they use simple keys and test for output content, not regex behavior.

### 4. Test Strategy

**Existing tests to verify (regression)**:
- `sms-templates > replaces template variables` (CONSIGNMENT_RECEIVED)
- `sms-templates > builds settlement message` (SETTLEMENT_CONFIRMED)

**New test cases to add**:
```typescript
it('does not interpret regex metacharacters in keys', () => {
  // Direct call with a key that would break regex
  let msg = '{{test.*value}} hello'
  msg = msg.replaceAll('{{test.*value}}', 'safe')
  expect(msg).toBe('safe hello')
})

it('throws on missing placeholder params', () => {
  expect(() => buildSmsMessage('CONSIGNMENT_RECEIVED', {
    sellerName: '홍길동',
    // warehousePhone intentionally omitted
  })).toThrow('SMS 템플릿 미치환 변수')
})
```

### 5. Verification Method

1. `tsc --noEmit` -- 0 errors
2. `vitest run` -- all 63+ tests pass
3. Manual: read the modified line and confirm no `new RegExp` usage remains in the function

---

## RISK-CR-04: path.ts Path Traversal via Directory Prefix Collision

### 1. Current Code Analysis

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/path.ts`
**Lines**: 19 (sanitizePath), 34 (sanitizeUploadPath)

```typescript
// sanitizePath, line 19
if (!realPath.startsWith(realBase)) {

// sanitizeUploadPath, line 34
if (!fullPath.startsWith(realBase)) {
```

**Root Cause**: `startsWith(realBase)` checks if the resolved path begins with the base directory string, but does not enforce a path separator boundary. If `realBase = "/uploads/data"`, then the string `"/uploads/data-evil/malicious.txt"` also passes because `"/uploads/data-evil/..."` starts with `"/uploads/data"`.

**Reproduction scenario (verified)**:
```
realBase = "/uploads/data"
realPath = "/uploads/data-evil/malicious.txt"   (via symlink resolution)

"/uploads/data-evil/malicious.txt".startsWith("/uploads/data")  =>  true  // BUG
"/uploads/data-evil/malicious.txt".startsWith("/uploads/data/") =>  false // FIXED
```

**Practical exploitability**: In `sanitizePath`, the exploit requires a symlink inside `basePath` that points to a sibling directory with a matching prefix (e.g., `/uploads/data/link` -> `/uploads/data-evil/`). After `realpathSync` resolves the symlink, `realPath` becomes `/uploads/data-evil/file` which passes the broken `startsWith` check. In `sanitizeUploadPath`, the `basename()` call strips directory components first, making the prefix collision theoretically harder to trigger via filename alone. However, if `basePath` resolves via symlink to a path that is a prefix of another directory, the same bug applies.

**Severity justification**: HIGH because this is a security function whose entire purpose is preventing path traversal, and the check has a known bypass pattern.

### 2. Fix

**Strategy**: Append `path.sep` (= `"/"` on POSIX) to `realBase` before the `startsWith` check. Also handle the edge case where `fullPath === realBase` (file IS the base directory itself).

**Before** (line 19):
```typescript
  if (!realPath.startsWith(realBase)) {
```

**After** (line 19):
```typescript
  if (realPath !== realBase && !realPath.startsWith(realBase + path.sep)) {
```

**Before** (line 34):
```typescript
  if (!fullPath.startsWith(realBase)) {
```

**After** (line 34):
```typescript
  if (!fullPath.startsWith(realBase + path.sep)) {
```

Note: In `sanitizeUploadPath`, the `fullPath === realBase` edge case is not possible because `path.resolve(realBase, safeName)` always appends a filename, so `fullPath` is always longer than `realBase`. In `sanitizePath`, the edge case IS possible if `userInput = "."` and `basename(".")` returns `"."`, then `path.join(basePath, ".")` could resolve to `basePath` itself.

**Changes**: 2 lines modified. No new lines. No function signature change.

### 3. Side Effect Analysis

- **Callers**: No production callers yet. Both functions are exported but only used by the Phase 5+ file upload routes (not yet implemented).
- **Backward compatibility**: The fix is strictly more restrictive. Any path that was correctly allowed before will still be allowed (because valid paths always have the base as a prefix followed by `/`). The only paths now rejected are those that exploit the prefix collision -- which should never have been allowed.
- **Existing test impact**: No existing tests for path.ts functions. Zero test breakage.
- **Edge case**: If `realBase` has a trailing slash already (e.g., `"/uploads/data/"`), then `realBase + path.sep` becomes `"/uploads/data//"`. `startsWith("/uploads/data//")` would fail for `"/uploads/data/file.txt"`. However, `fs.realpathSync` never returns a trailing slash (except for root `/`), so this case does not arise in practice. Verified: `fs.realpathSync("/tmp/")` returns `"/private/tmp"` (no trailing slash).

### 4. Test Strategy

**New test cases to add**:
```typescript
describe('path utils', () => {
  it('sanitizeUploadPath rejects directory prefix collision', () => {
    // Simulating: realBase = "/uploads/data", fullPath = "/uploads/data-evil/file"
    // This test uses real filesystem paths
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'))
    const safePath = sanitizeUploadPath(base, 'test.txt')
    expect(safePath).toBe(path.join(base, 'test.txt'))
  })

  it('sanitizeUploadPath strips directory traversal from filename', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'))
    const safePath = sanitizeUploadPath(base, '../../../etc/passwd')
    expect(path.basename(safePath)).toBe('passwd')
    expect(safePath.startsWith(base)).toBe(true)
  })
})
```

### 5. Verification Method

1. `tsc --noEmit` -- 0 errors
2. `vitest run` -- all tests pass
3. Manual review: confirm both `startsWith` calls include `+ path.sep`

---

## RISK-CR-02: date.ts Invalid Date Rollover in isValidDateString

### 1. Current Code Analysis

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/date.ts`
**Lines**: 61-65

```typescript
// lines 61-65
export function isValidDateString(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false
  const date = new Date(value)
  return !isNaN(date.getTime())
}
```

**Root Cause**: JavaScript's `Date` constructor performs "date rollover" for out-of-range day/month values. `new Date("2026-02-30")` does not return `Invalid Date` -- instead it rolls over to `2026-03-02`. The `isNaN` check passes because the date IS valid (it's just not the date the user intended). The regex only validates the format `YYYY-MM-DD`, not the semantic correctness.

**Verified rollover behavior**:
```
"2026-02-30" -> regex: true, Date valid: true, Actual: 2026-03-02  (rolled +2 days)
"2026-02-29" -> regex: true, Date valid: true, Actual: 2026-03-01  (not a leap year)
"2026-04-31" -> regex: true, Date valid: true, Actual: 2026-05-01  (April has 30 days)
"2026-06-31" -> regex: true, Date valid: true, Actual: 2026-07-01  (June has 30 days)
"2026-13-01" -> regex: true, Date valid: false (NaN -- month 13)
"2026-00-01" -> regex: true, Date valid: false (NaN -- month 0)
```

Month 13 and month 0 ARE caught (return NaN), but invalid days within valid months silently roll over.

**Impact**: `isValidDateString` is used as a guard in 4 other functions: `toStartOfDay`, `toEndOfDay`, `toKSTStartOfDay`, `toKSTEndOfDay`. If it incorrectly returns `true` for "2026-02-30", those functions will create a Date object representing March 2nd -- leading to incorrect settlement periods, off-by-days in order date filtering, and DAT-02 class bugs.

### 2. Fix

**Strategy**: After creating the Date object, extract year/month/day components and compare them back to the original input string (round-trip validation). If the Date rolled over, the extracted components will differ from the input.

**Before** (lines 61-65):
```typescript
export function isValidDateString(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false
  const date = new Date(value)
  return !isNaN(date.getTime())
}
```

**After** (lines 61-72):
```typescript
export function isValidDateString(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  if (isNaN(date.getTime())) return false

  // Round-trip check: Date rollover를 감지한다
  // "2026-02-30" -> Date는 03-02로 rollover하므로 getUTCMonth() !== 1
  const [y, m, d] = value.split('-').map(Number)
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() + 1 === m &&
    date.getUTCDate() === d
  )
}
```

**Key decisions**:
- `new Date(value + 'T00:00:00Z')`: Appending `T00:00:00Z` forces UTC parsing. Without it, `new Date("2026-03-04")` is parsed as local time in some environments, causing timezone-dependent behavior. With `T00:00:00Z`, `getUTCFullYear/Month/Date` are guaranteed to match the input date.
- `getUTCMonth() + 1`: JavaScript months are 0-indexed.

**Changes**: Net +7 lines (1 line modified to 8 lines). Function grows from 5 to 12 lines. No signature change -- still `(value: string) => boolean`.

### 3. Side Effect Analysis

- **Callers**: `isValidDateString` is used internally by 4 functions in the same file:
  - `toStartOfDay(dateStr)` (line 71)
  - `toEndOfDay(dateStr)` (line 81)
  - `toKSTStartOfDay(dateStr)` (line 93)
  - `toKSTEndOfDay(dateStr)` (line 104)

  After the fix, these functions will now correctly throw `"유효하지 않은 날짜 형식: 2026-02-30"` instead of silently creating March 2nd.

- **External callers**: `isValidDateString` is exported but has no external callers in the codebase (searched via grep).

- **Backward compatibility**: This is a **behavioral narrowing** -- inputs that previously returned `true` will now return `false`. Specifically:
  - "2026-02-30", "2026-02-29" (non-leap), "2026-04-31", "2026-06-31" etc.
  - All genuinely valid dates continue to return `true`.
  - This is the desired behavior -- the previous permissiveness was the bug.

- **Existing test impact**: The `validation.test.ts` file tests `DateSchema` (Zod schema), not `isValidDateString`. The `utils.test.ts` file has no date tests. Zero breakage expected.

### 4. Test Strategy

**New test cases to add**:
```typescript
describe('date utils', () => {
  it('isValidDateString rejects rolled-over dates', () => {
    expect(isValidDateString('2026-02-30')).toBe(false)
    expect(isValidDateString('2026-02-29')).toBe(false) // not leap year
    expect(isValidDateString('2026-04-31')).toBe(false) // April has 30 days
    expect(isValidDateString('2026-06-31')).toBe(false)
  })

  it('isValidDateString accepts valid dates', () => {
    expect(isValidDateString('2026-03-04')).toBe(true)
    expect(isValidDateString('2024-02-29')).toBe(true)  // 2024 IS leap year
    expect(isValidDateString('2026-01-31')).toBe(true)
    expect(isValidDateString('2026-12-31')).toBe(true)
  })

  it('isValidDateString rejects bad format', () => {
    expect(isValidDateString('03-04-2026')).toBe(false)
    expect(isValidDateString('not-a-date')).toBe(false)
    expect(isValidDateString('')).toBe(false)
  })

  it('toStartOfDay throws on invalid rollover date', () => {
    expect(() => toStartOfDay('2026-02-30')).toThrow('유효하지 않은 날짜')
  })
})
```

### 5. Verification Method

1. `tsc --noEmit` -- 0 errors
2. `vitest run` -- all existing + new tests pass
3. Manual: execute `isValidDateString('2026-02-30')` and confirm `false`

---

## RISK-CR-03: toKSTDate/toKSTDateTime No Input Validation

### 1. Current Code Analysis

**File**: `/Users/jeongmyeongcheol/tf-v3/apps/web/lib/utils/date.ts`
**Lines**: 30-36 (toKSTDate), 41-49 (toKSTDateTime)

```typescript
// toKSTDate, lines 30-36
export function toKSTDate(utcIso: string): string {
  const parts = KST_DATE_FORMATTER.formatToParts(new Date(utcIso))
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  return `${y}-${m}-${d}`
}

// toKSTDateTime, lines 41-49
export function toKSTDateTime(utcIso: string): string {
  const parts = KST_DATETIME_FORMATTER.formatToParts(new Date(utcIso))
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  const h = parts.find((p) => p.type === 'hour')?.value
  const min = parts.find((p) => p.type === 'minute')?.value
  return `${y}-${m}-${d} ${h}:${min}`
}
```

**Root Cause**: Neither function validates the input `utcIso` string. When `new Date(utcIso)` receives an invalid string (e.g., "invalid", "", "abc"), it creates an `Invalid Date` object. `Intl.DateTimeFormat.formatToParts(Invalid Date)` throws a `RangeError: Invalid time value` in Node.js.

**Verified behavior**:
```
Input: "invalid"    -> Error: Invalid time value
Input: ""           -> Error: Invalid time value
Input: "not-a-date" -> Error: Invalid time value
Input: "abc123"     -> Error: Invalid time value
```

The error is a bare `RangeError` with no context about which function or input caused it, making debugging difficult.

**Impact**: These functions are display-only (UTC ISO -> KST formatted string) and will be called with database values (timestamptz columns). In normal operation, Supabase returns valid ISO strings. However, if a column is NULL and the caller passes `null`/`undefined` coerced to string, or if data is corrupted, the bare RangeError propagates up with no actionable context.

### 2. Fix

**Strategy**: Add an `Invalid Date` guard at the start of each function. If `new Date(input)` produces NaN, throw a descriptive error.

**toKSTDate -- Before** (lines 30-36):
```typescript
export function toKSTDate(utcIso: string): string {
  const parts = KST_DATE_FORMATTER.formatToParts(new Date(utcIso))
```

**toKSTDate -- After** (lines 30-39):
```typescript
export function toKSTDate(utcIso: string): string {
  const date = new Date(utcIso)
  if (isNaN(date.getTime())) {
    throw new Error(`유효하지 않은 UTC ISO 문자열: ${utcIso}`)
  }
  const parts = KST_DATE_FORMATTER.formatToParts(date)
```

**toKSTDateTime -- Before** (lines 41-49):
```typescript
export function toKSTDateTime(utcIso: string): string {
  const parts = KST_DATETIME_FORMATTER.formatToParts(new Date(utcIso))
```

**toKSTDateTime -- After** (lines 44-55):
```typescript
export function toKSTDateTime(utcIso: string): string {
  const date = new Date(utcIso)
  if (isNaN(date.getTime())) {
    throw new Error(`유효하지 않은 UTC ISO 문자열: ${utcIso}`)
  }
  const parts = KST_DATETIME_FORMATTER.formatToParts(date)
```

**Changes**: Net +6 lines (3 lines added to each function). No function signature change.

**Post-fix file size**: date.ts will be approximately 115 lines (currently 108 + 6 new + 1 from CR-02 change). Under the 150-line utility limit.

### 3. Side Effect Analysis

- **Callers**: No production callers yet. Will be used in Phase 5+ UI components and API responses for date display.
- **Backward compatibility**: The fix converts an unhandled `RangeError` into a descriptive `Error`. The behavior change is: before, invalid input threw a cryptic `RangeError`; after, it throws a clear `Error` with the input value. Callers that catch `Error` (the base class) will handle both. No functional regression for valid inputs.
- **Existing test impact**: No existing tests for `toKSTDate` or `toKSTDateTime`. Zero breakage.
- **Performance**: The additional `isNaN` check is negligible (one float comparison). The `new Date()` construction is not duplicated -- the result is stored in a variable and reused for `formatToParts`.

### 4. Test Strategy

**New test cases to add**:
```typescript
describe('date display utils', () => {
  it('toKSTDate converts UTC ISO to KST date string', () => {
    // 2026-03-04T15:00:00Z = 2026-03-05 00:00 KST
    expect(toKSTDate('2026-03-04T15:00:00Z')).toBe('2026-03-05')
  })

  it('toKSTDate throws on invalid input', () => {
    expect(() => toKSTDate('invalid')).toThrow('유효하지 않은 UTC ISO 문자열')
    expect(() => toKSTDate('')).toThrow('유효하지 않은 UTC ISO 문자열')
  })

  it('toKSTDateTime converts UTC ISO to KST datetime string', () => {
    expect(toKSTDateTime('2026-03-04T15:30:00Z')).toBe('2026-03-05 00:30')
  })

  it('toKSTDateTime throws on invalid input', () => {
    expect(() => toKSTDateTime('not-a-date')).toThrow('유효하지 않은 UTC ISO 문자열')
  })
})
```

### 5. Verification Method

1. `tsc --noEmit` -- 0 errors
2. `vitest run` -- all existing + new tests pass
3. Manual: call `toKSTDate("invalid")` and confirm descriptive error message

---

## Implementation Order and Dependencies

```
                     +-----------+
                     | CR-01     |  (independent, CRITICAL)
                     | sms-templ |
                     +-----------+
                           |
                           v
+-----------+        +-----------+
| CR-04     |        | CR-02     |  (date validation fix)
| path.ts   |        | date.ts   |
+-----------+        +-----------+
      |                    |
      v                    v
  (done)             +-----------+
                     | CR-03     |  (depends on CR-02)
                     | date.ts   |
                     +-----------+
                           |
                           v
                     [Verification]
```

### Execution Sequence

| Order | ID | File | Reason |
|-------|-----|------|--------|
| 1 | CR-01 | sms-templates.ts | CRITICAL severity, independent, 1-line fix |
| 2 | CR-04 | path.ts | Security bug, independent, 2-line fix |
| 3 | CR-02 | date.ts | Must be fixed before CR-03 (isValidDateString used as guard) |
| 4 | CR-03 | date.ts | Depends on CR-02 being correct (same file, sequential edits) |

### Total Change Scope

| Metric | Value |
|--------|-------|
| Files modified | 3 |
| Lines added | ~16 |
| Lines modified | ~3 |
| Function signatures changed | 0 |
| New exports | 0 |
| Existing tests affected | 0 |
| New tests needed | ~30 lines (8 test cases) |

### Verification Checklist

After all 4 fixes:
- [ ] `tsc --noEmit` -- 0 errors
- [ ] `vitest run` -- 63/63 existing tests pass (no regression)
- [ ] New test cases pass
- [ ] Manual spot-check each fix:
  - [ ] CR-01: `buildSmsMessage` uses `replaceAll`, no `new RegExp` in function
  - [ ] CR-02: `isValidDateString('2026-02-30')` returns `false`
  - [ ] CR-03: `toKSTDate('invalid')` throws descriptive error
  - [ ] CR-04: Both `startsWith` calls include `+ path.sep`
- [ ] `git diff` review: only the 3 expected files changed
- [ ] File size check: all files under 150-line limit
