# Phase 4 서비스 레이어 계획 (phase3-4-plan.md Phase 4 대체)

**작성일**: 2026-03-12 (Rev.4: 등급 3 검증 3차 48회 결과 FAIL-1~4 해결책 확정)
**근거**: V2 전수조사 + plan5 §7 + V3 Phase 0~3 현황 + 사전분석 16회 + 5개 문서 종합 검증 + analysis-techniques 등급 3 검증 16회
**상위 문서**: plan5.md §7, architecture-spec.md §4/§6/§10
**변경 레벨**: L3 (정산 계산 규칙 변경 포함 → db-rpc-settlement-deep-checklist 자동 적용)

---

## 0. 핵심 결정 사항 (V2 × plan5 × V3 교차 비교)

### 결정 D-1: 위탁 상태 전이 — V2 워크플로우 채택

**V3 현재 (Phase 1 구현):**
```
pending → received → inspecting → approved → completed
```

**V2 실제 운영:**
```
pending → inspecting → approved → received → completed
         (검수먼저)   (번호채번)   (수령확인)   (상품등록)
```

**채택: V2 워크플로우** — 이유:
1. V2 운영 검증 완료 (실 사용자 워크플로우)
2. 검수(inspecting)를 수령(received) 전에 진행 = 물건 확인 후 승인하는 비즈니스 실무
3. approved에서 product_number 채번 → completed에서 상품등록 (2단계 분리)

**V3 수정 대상**: `consignment.ts` ALLOWED_TRANSITIONS 값 + 2개 테스트 파일
- consignments-query.repo.ts는 ALLOWED_TRANSITIONS를 참조하므로 자동 적용

**새 ALLOWED_TRANSITIONS:**
```typescript
export const ALLOWED_TRANSITIONS: Record<ConsignmentStatus, readonly ConsignmentStatus[]> = {
  pending:    ['inspecting', 'approved', 'on_hold', 'rejected'],
  inspecting: ['approved', 'on_hold', 'rejected'],
  on_hold:    ['inspecting', 'approved', 'rejected'],
  approved:   ['received', 'on_hold', 'rejected'],
  received:   ['completed', 'on_hold', 'rejected'],
  completed:  [],
  rejected:   [],
} as const
```

### 결정 D-2: 정산 상태 — V3 유지

| V2 | V3 (Phase 0 DDL) | 결정 |
|----|-------------------|------|
| pending | draft | **V3 유지** (DDL 이미 확정) |
| confirmed | confirmed | 동일 |
| paid | paid | 동일 |
| — | failed | **V3 추가** (배치 실패 대응) |

### 결정 D-3: 서비스 수 — 8개 + 2 calculator

plan5 §7은 7개 서비스를 명시하나, V2의 매칭 워크플로우(593줄)가 독립 서비스로 분리 필요.

**정당화 (architecture-spec §11조):**
- V2 auto-match(190줄) + manual-match(113줄) + queue-settlements(290줄) = 총 593줄
- settlement.service나 sales.service에 통합 시 150줄 제한(§10조) 위반 필연
- match_status는 독립 상태 머신 (unmatched/auto_matched/manual_matched)

### 결정 D-4: 서비스 반환 패턴 — throw AppError

```typescript
// ✅ 채택: 성공 시 값 직접 반환, 실패 시 throw AppError
async function confirm(id: string): Promise<Settlement> {
  const result = await settlementStatusRepo.confirm(id)
  if (result.error) throw new AppError('NOT_FOUND', result.error)
  return result.data
}
```

**이유**: repo의 DbResult 에러를 서비스에서 AppError로 변환 → route.ts에서 errFrom(e) 한 줄로 처리

### 결정 D-5: 서비스 간 호출 — 금지 (route.ts 오케스트레이션)

```typescript
// ✅ route.ts에서 여러 서비스 순차 호출
const settlement = await settlementService.generate(params)
await notificationService.notifySettlementCreated(settlement)

// ❌ 금지: 서비스 내부에서 다른 서비스 호출
// settlementService 내부에서 notificationService.notify() 호출 금지
```

### 결정 D-6: photo.service fetch → L0 gateway 경유

architecture-spec §4.2 준수. `lib/gateway/claude-vision.ts` (L0) 신설.

### 결정 D-7: completeConsignment tx 분리

V2 워크플로우에 맞춰 2단계 분리:
- **approved 전이**: `generate_product_number` RPC만 호출 → consignment에 product_number 저장
- **completed 전이**: `complete_consignment` RPC 호출 (기존 product_number 사용) → st_products + orders 생성

현재 consignment.tx.ts의 completeConsignment 함수는 두 단계를 합치고 있으므로, Phase 4에서 분리.

**구체적 수정 계획:**
- `consignment.tx.ts`의 기존 `completeConsignment()` → `approveConsignment()`로 리네임 (generate_product_number만 호출)
- 새 `completeConsignment()` 함수 추가 (기존 product_number를 받아 complete_consignment RPC 호출)
- consignment.service.ts의 `approveConsignment()`에서 tx.approveConsignment() 호출
- consignment.service.ts의 `completeConsignment()`에서 tx.completeConsignment() 호출

### 결정 D-8: 반올림 규칙 — Math.round (V2 재현)

**V2 실제 코드:** `commissionAmount = round(totalSales × commissionRate)`
**DB 컬럼:** `settlements.commission_amount` = INTEGER (원 단위 정수)

**채택: Math.round** — 이유:
1. V2가 `round()` 사용 → 동일 동작 재현
2. DB가 INTEGER → 소수점 불가능 → 별도 절사 불필요
3. KRW 통화 특성 (최소 단위 = 1원)

**deep-checklist §5.2 준수 의무:**
- settlement.calc.ts에 `Math.round` 명시 + "V2 round() 재현" 주석
- vitest에서 DB 저장 전/후 동일성 증거 (TypeScript 계산값 = RPC 파라미터)

### 결정 D-9: SMS gateway — lib/aligo/sms.ts (L0)

**architecture-spec 제4조:** 서비스 MUST NOT fetch 직접 호출
**패턴 재사용:** `lib/supabase/` = Supabase 클라이언트(L0) → `lib/aligo/` = Aligo 클라이언트(L0)

**채택: lib/aligo/sms.ts (L0 Infrastructure)** — 이유:
1. 제4조 준수 (서비스가 fetch 안 함)
2. `lib/supabase/`와 동일한 외부 서비스 클라이언트 패턴
3. SMS 공급자 교체 시 1파일만 수정 (유지보수성)
4. `lib/utils/`에 넣으면 순수 함수와 HTTP 호출 코드 혼재 (성격 오염)

**architecture-spec 제11조 정당화 (필수):**
- **기존 구조 불가 이유**: 제4조가 서비스 내 fetch를 명시적 금지. utils(L1)에 넣으면 순수 유틸 성격 오염
- **대안 비교**: (A) lib/aligo/ L0 신설 — 채택. (B) notification.service 내부 fetch — 제4조 FAIL. (C) lib/utils/sms-client.ts — 순수 함수 컬렉션에 HTTP client 혼재
- **영향 범위**: 신규 파일 1개, 기존 코드 변경 0, architecture-spec §3.1에 aligo 추가 필요

**선행 조건**: architecture-spec §3.1 L0 목록에 `aligo` 추가

### 결정 D-11: notification 실패 격리 — soft-fail 패턴

**문제**: SMS 발송 실패 시 비즈니스 트랜잭션(상태 전이)까지 롤백되면 안 됨.

**채택: soft-fail 패턴** — notification 실패는 로깅만, 호출자에 에러 전파 안 함:
```typescript
// notification.service.ts
export async function notifyStatusChange(id: string, event: TriggerEvent): Promise<NotifyResult> {
  try {
    const smsResult = await sendSMS(...)
    await logNotification(id, event, 'success')
    return { sent: true }
  } catch (err) {
    console.error('[notification] SMS 발송 실패:', err)
    await logNotification(id, event, 'failed', err)
    return { sent: false, error: err instanceof Error ? err.message : '알 수 없는 오류' }
  }
}

interface NotifyResult {
  sent: boolean
  error?: string
}
```

**route.ts 호출 패턴 (D-5 준수)**:
```typescript
// route.ts — notification 실패가 상태 전이를 롤백하지 않음
const consignment = await consignmentService.updateStatus(id, 'received')
const notify = await notificationService.notifyStatusChange(id, 'received')
// notify.sent === false여도 consignment 상태는 이미 변경됨
```

### 결정 D-10: classifyProduct 위치 — lib/utils/ (L1)

**150줄 제한 분석:**
- settlement.service.ts 5개 export 함수 (generate, confirm, pay, list, getById) = ~115줄
- classifyProduct(~20줄) + matchSellerByName(~25줄) 내부 배치 시 = ~160줄 → **제10조 위반**

**채택: lib/utils/product-classifier.ts + lib/utils/seller-matcher.ts** — 이유:
1. 150줄 제한 → 분리 **필수** (선택 아님)
2. `lib/utils/`는 architecture-spec §3.2에 L1으로 이미 명시 → 제11조 비해당
3. 순수 문자열 파싱 함수 = utils 성격에 부합 (date.ts, excel.ts와 동급)
4. V2도 독립 모듈로 분리 (`lib/settlement/product-classifier.ts`)
5. 단위 테스트 용이 (순수 함수)

---

## 1. 선행 작업 (Phase 4 첫 번째 단계)

Phase 4 서비스 구현 전에 반드시 완료해야 할 작업들.

### 1.1 ALLOWED_TRANSITIONS + ORDER_TRANSITIONS 수정

**변경 파일:**
| 파일 | 변경 내용 |
|------|---------|
| `lib/types/domain/consignment.ts` | ALLOWED_TRANSITIONS 값 변경 (결정 D-1) |
| `lib/types/domain/order.ts` | ORDER_TRANSITIONS 상수 신규 추가 (§3.2) |
| `__tests__/unit/types.test.ts` | 전이 규칙 테스트 업데이트 (위탁 + 주문 모두) |
| `__tests__/integration/repos-read.test.ts` | 상태 필터 테스트 동기화 |

**영향 없음 (자동 적용):**
- consignments-query.repo.ts (ALLOWED_TRANSITIONS 참조)
- consignments.repo.ts, consignments-bulk.repo.ts (타입만 사용)

### 1.2 누락 Repository 2개 생성

**B-2: settlement-matches.repo.ts** (DB 테이블 존재, repo 미존재)
```typescript
// lib/db/repositories/settlement-matches.repo.ts
export async function create(input): Promise<DbResult<SettlementMatch>>
export async function findByMatchIds(ids): Promise<DbResult<SettlementMatch[]>>
export async function deleteByIds(ids): Promise<DbResult<number>>
export async function listWithJoin(filters): Promise<DbListResult<SettlementMatchDetail>>
```

**B-3: settlement-queue.repo.ts** (DB 테이블 존재, repo 미존재)
```typescript
// lib/db/repositories/settlement-queue.repo.ts
export async function create(items): Promise<DbResult<SettlementQueueItem[]>>
export async function listByStatus(status): Promise<DbListResult<SettlementQueueItem>>
export async function listBySeller(sellerId): Promise<DbResult<SettlementQueueItem[]>>
export async function deleteByStatus(status): Promise<DbResult<number>>
export async function getSellerSummary(): Promise<DbResult<SellerSettlementSummary[]>>
```

### 1.3 L0 Gateway 신설

**B-4: lib/gateway/claude-vision.ts**
```typescript
// lib/gateway/claude-vision.ts
// WHY: architecture-spec §4.2 — 서비스에서 fetch 직접 호출 금지
// HOW: Claude Vision API 래핑, 재시도 + 타임아웃 포함
export async function classifyImages(images: ImageInput[]): Promise<ClassifyResult>
export async function compareImages(a: ImageInput, b: ImageInput): Promise<CompareResult>
export async function extractColor(image: ImageInput): Promise<string>
```

**B-5: lib/aligo/sms.ts** (결정 D-9)
```typescript
// lib/aligo/sms.ts
// WHY: architecture-spec §4.2 — 서비스에서 fetch 직접 호출 금지
// HOW: Aligo SMS API 래핑, lib/supabase/ 와 동일 L0 패턴
// WHERE: notification.service.ts에서 import
export async function sendSMS(params: { phone: string; message: string }): Promise<AligoResult>
export async function checkBalance(): Promise<number>
```

**안전장치 (F-4):**
- **타임아웃**: fetch AbortController 5초 (Aligo 응답 지연 방어)
- **일일 상한**: `DAILY_SMS_LIMIT = 500` — 환경변수 오버라이드 가능, 초과 시 throw + 관리자 로그
- **Throttle**: 연속 발송 간격 최소 100ms (Aligo rate limit 방어)
- 상한/throttle 상태는 인메모리 카운터 (서버 재시작 시 리셋 — 단일 인스턴스 전제)

### 1.4 도메인 타입 보강

settlement.ts에 누락된 타입 추가:
```typescript
// SettlementMatch, SettlementQueueItem 타입 추가
export interface SettlementMatch { ... }
export interface SettlementQueueItem { ... }
export interface SellerSettlementSummary { ... }
```

정산 상태 전이 상수 추가 (현재 미정의 — Blocker):
```typescript
// lib/types/domain/settlement.ts에 추가
export const SETTLEMENT_TRANSITIONS: Record<SettlementStatus, readonly SettlementStatus[]> = {
  draft:     ['confirmed', 'failed'],
  confirmed: ['paid', 'failed'],
  paid:      [],
  failed:    ['draft'],       // 재시도 허용
} as const
```

**강제 위치 (W-6 — 이중 방어):**
1. **서비스 검증 (1차)**: settlement.service.ts의 confirm/pay에서 `SETTLEMENT_TRANSITIONS[current].includes(next)` 체크 → 위반 시 throw AppError
2. **Repo 이중 방어 (2차)**: settlement-status.repo.ts의 confirm()/pay()에서 `.eq('status', expectedCurrent)` 조건 유지 — optimistic lock
3. 두 레이어 모두 SETTLEMENT_TRANSITIONS 상수를 import하여 하드코딩 0건 보장

### 1.5 유틸리티 신설 (결정 D-10)

**B-6: lib/utils/product-classifier.ts**
```typescript
// lib/utils/product-classifier.ts
// WHY: "위탁." prefix 기반 상품코드 파싱 (V2 product-classifier.ts 재현)
// HOW: 순수 문자열 파싱, DB/HTTP 미사용
export function classifyProduct(sellerProductCode: string): ClassifiedProduct
export function isConsignmentCode(sellerProductCode: string): boolean
export function filterConsignmentCodes(codes: string[]): ClassifiedProduct[]
```

**B-7: lib/utils/seller-matcher.ts**
```typescript
// lib/utils/seller-matcher.ts
// WHY: 셀러명 기반 매칭 (V2 seller-matcher.ts 재현)
// HOW: 순수 문자열 비교, DB/HTTP 미사용
export function matchSellerByName(rawName: string, sellers: Seller[]): Seller | null
export function parseSellerName(raw: string): ParsedSellerName
```

### 1.6 AppError L1 분리 (FAIL-4 확정)

현재 AppError는 `lib/api/errors.ts` (L3 영역)에 위치.
서비스(L1)에서 `throw new AppError()`를 사용하려면 L1→L3 import → **architecture-spec 제2조 위반**.

**확정 방안:**
- `lib/errors.ts` (~15줄) 신설: ErrorCode type + AppError class만 (httpStatus getter 제거, HTTP_STATUS 미포함)
- `lib/api/errors.ts` 수정: `export { AppError, type ErrorCode } from '../errors'` re-export + HTTP_STATUS 유지
- `lib/api/response.ts`: 기존 import 경로 `from './errors'` 변경 불요 (re-export 호환)
- errFrom()은 e.code만 참조 → httpStatus getter 미사용 확인 완료

**§11조 정당화:**
- 기존 구조 불가 이유: L1→L3 import = §2.2 위반. AppError를 L3에 둔 채 서비스에서 사용 불가
- 대안 비교: (A) lib/errors.ts L1 신설 + re-export — 채택. (B) 서비스에서 AppError 미사용 — 기각 (errFrom instanceof 체크 의존). (C) lib/api/errors.ts 통째 이동 — 기각 (HTTP_STATUS가 L1에 침투)
- 영향 범위: 신규 1파일, 수정 1파일(re-export 3줄), 기존 import 영향 0파일

### 1.7 env.ts 필수/선택 분리 (FAIL-2 확정)

현재 `getEnvVar()`는 미설정 시 즉시 throw → 선택적 환경변수 추가 시 전체 서버 기동 실패.

**확정 방안:**
- `getOptionalEnvVar(key): string | undefined` 함수 신설
- 필수 4개 (Supabase + Auth) = 기존 `getEnvVar()` 유지 (미설정 시 즉시 throw)
- 선택 4개 (ALIGO×3 + ANTHROPIC) = `getOptionalEnvVar()` (미설정 허용)
- L0 gateway(lib/aligo/sms.ts)에서 사용 시점에 undefined 체크 → throw

**분류:**
- aligo/sms.ts는 **L0 Gateway**로 분류 (파일 상단 주석에 명시)
- SMS 발송 실패는 **soft-fail** 정책: 로깅만, 정산 트랜잭션에 영향 없음

### 1.8 sellers-batch.repo.ts 신설 (FAIL-3 확정)

sellers.repo.ts가 121줄로 §10.1 120줄 제한 초과. findByPhones() 추가 불가.

**확정 방안:**
- `sellers-batch.repo.ts` 신설 (~20줄): findByPhones(phones: string[]) → DbResult<Seller[]>
- sellers.repo.ts 변경 0줄 (COLUMNS/mapRow 이미 export)
- createAdminClient() 함수 진입 시 1회만 생성
- 빈 배열/null/중복 가드 + chunk(100) 순차 IN 쿼리
- findByPhones **상한 1,000건**, 엑셀 업로드 **상한 5,000행** (초과 시 에러)
- 서비스에서 Map 관리: findByPhones() 결과 → Map → 신규만 findOrCreate()

**§11조 간이 정당화 (cross-repo import):**
- sellers-batch.repo.ts → sellers.repo.ts의 COLUMNS/mapRow import
- 불가 이유: COLUMNS/mapRow를 복제하면 DRY 위반 + NUMERIC 타입 변경 시 불일치
- 대안: (A) cross-repo import — 채택. (B) 공유 mapper 파일 분리 — 과도한 추상화
- architecture-exceptions.md에 예외 1건 등록

### 1.9 settlement fail() RPC 신설 (FAIL-1 확정)

settlement 상태를 failed로 변경 시 3개 테이블 원자 처리 필요.

**확정 방안 — RPC 단독 경로:**
- `fail_settlement` RPC 신설 (PostgreSQL plpgsql):
  ```sql
  -- 1. settlements.status → 'failed' (WHERE status IN ('draft','confirmed'))
  -- 2. sold_items.settlement_status → 'pending' (WHERE settlement_id = $1 AND settlement_status = 'settled')
  -- 3. settlement_items DELETE (WHERE settlement_id = $1)
  -- ROW_COUNT = 0 시 RAISE EXCEPTION (미존재 UUID / paid 상태 차단)
  ```
- `settlement-status.repo.ts`에 `fail()` 함수 = RPC 래퍼 (confirm/pay 패턴 동일)
- `updateStatus()`에 `expectedCurrent` 파라미터 추가 (§5.1 준수)
- **paid → failed 차단**: status IN ('draft','confirmed')에 paid 미포함
- **failed → draft 차단**: SETTLEMENT_TRANSITIONS에 failed→draft 경로 없음 (failed→['draft'] 삭제)
- tokyo-ddl/04_functions.sql 동기화 필수

**에러 규칙:**
- AppError 생성 시 DB 원문 에러는 console.error에만 기록
- 클라이언트에는 사용자 친화 메시지만 반환 (`'실패 처리 불가: 현재 상태가 paid입니다'`)

---

## 2. 파일 목록 (13개 신규)

### 2.1 서비스 8개 (`lib/services/`)

| # | 파일 | 줄수 목표 | V2 대응 | 핵심 책임 |
|---|------|---------|---------|----------|
| 1 | consignment.service.ts | ≤150 | consignments/route.ts (855줄) | 위탁 CRUD + 상태전이 + 셀러 findOrCreate |
| 2 | order.service.ts | ≤120 | orders/route.ts (220줄) | 주문 CRUD + 상태전이 |
| 3 | settlement.service.ts | ≤150 | settlement/generate+confirm+pay (324줄) | 정산 생성/확정/지급 |
| 4 | matching.service.ts | ≤150 | auto-match+manual-match+queue (593줄) | 3단계 자동매칭 + 수기매칭 + 큐 |
| 5 | sales.service.ts | ≤120 | upload-sales-ledger+sale-detector (310줄) | 매출장 업로드 + 판매감지 |
| 6 | product.service.ts | ≤100 | products/route.ts (126줄) | 상품 CRUD + 요약 |
| 7 | photo.service.ts | ≤120 | photos/classify+match (243줄) | 사진 분류 + 매칭 (gateway 경유) |
| 8 | notification.service.ts | ≤80 | notification/index.ts (130줄) | 알림 발송 + 로깅 |

### 2.2 Calculator 2개 (`lib/calculators/`)

| # | 파일 | 줄수 목표 | V2 대응 | 핵심 책임 |
|---|------|---------|---------|----------|
| 9 | settlement.calc.ts | ≤80 | settlement-calculator.ts (124줄) | 수수료 계산 (rate × sales) |
| 10 | price-estimator.calc.ts | ≤80 | triggerPriceEstimate (비동기) | 네이버 검색 기반 정가 추정 |

### 2.3 L0 Gateway/Client (`lib/gateway/`, `lib/aligo/`)

| # | 파일 | 줄수 목표 | 핵심 책임 |
|---|------|---------|----------|
| 11 | lib/gateway/claude-vision.ts | ≤80 | Claude Vision API 래핑 |
| 12 | lib/aligo/sms.ts | ≤60 | Aligo SMS API 래핑 (결정 D-9) |

### 2.4 유틸리티 2개 (`lib/utils/`) — 결정 D-10

| # | 파일 | 줄수 목표 | 핵심 책임 |
|---|------|---------|----------|
| 13 | product-classifier.ts | ≤40 | 상품코드 파싱 + 위탁 분류 |
| 14 | seller-matcher.ts | ≤40 | 셀러명 매칭 |

### 2.5 누락 Repository 2개 (`lib/db/repositories/`)

| # | 파일 | 줄수 목표 | 핵심 책임 |
|---|------|---------|----------|
| 15 | settlement-matches.repo.ts | ≤80 | 매칭 결과 CRUD |
| 16 | settlement-queue.repo.ts | ≤80 | 정산 큐 CRUD + 셀러별 집계 |

### 2.6 선행 인프라 (Rev.4 추가)

| # | 파일 | 줄수 목표 | 핵심 책임 |
|---|------|---------|----------|
| 17 | lib/errors.ts | ≤15 | ErrorCode + AppError (L1) |
| 18 | lib/db/repositories/sellers-batch.repo.ts | ≤25 | 셀러 배치 조회 (findByPhones) |

**총 신규 파일: 18개** (서비스 8 + calculator 2 + gateway 1 + aligo 1 + utils 2 + repo 3 + errors 1)
**기존 수정 파일: 4개** (lib/api/errors.ts, env.ts, settlement-status.repo.ts, architecture-exceptions.md)

---

## 3. 서비스 상세 설계

### 3.1 consignment.service.ts

**V2 워크플로우 계승:**
```
네이버폼 엑셀 → POST bulkCreate
  → seller findOrCreate (전화번호 기반)
  → 중복 체크 (seller_id + product_name)
  → consignment_requests 삽입

PATCH updateStatus:
  pending → inspecting    (검수 시작)
  inspecting → approved   (승인 + product_number 채번)
  approved → received     (수령 확인 + SMS 알림)
  received → completed    (st_products + orders 생성 + SMS)
  * → on_hold            (보류 + memo/adjustment)
  * → rejected           (반려)
```

**export 함수:**
```typescript
// consignment.service.ts
export async function list(filters, pageOptions): Promise<{ items: ConsignmentWithRelations[]; total: number }>
export async function getById(id: string): Promise<ConsignmentWithRelations>
export async function bulkCreate(rows: RawConsignmentRow[]): Promise<BulkResult<ConsignmentRequest>>
export async function updateStatus(id: string, newStatus: ConsignmentStatus, extra?: StatusExtra): Promise<ConsignmentRequest>
export async function approveConsignment(id: string): Promise<ConsignmentRequest>  // product_number 채번
export async function completeConsignment(id: string, params: CompleteParams): Promise<{ productId: string; orderId?: string }>
export async function batchDelete(ids: string[]): Promise<number>
```

**상태별 부수효과 (V2 로직 계승):**
| 전이 | 부수효과 | V2 대응 |
|------|---------|---------|
| →inspecting | 없음 | 동일 |
| →approved | generate_product_number RPC → product_number 저장 | V2 동일 |
| →received | received_at 기록, SMS(receivedMessage) | V2 동일 |
| →completed | completeConsignment tx (st_products + orders 생성), SMS(completedMessage) | V2 동일 |
| →on_hold | memo, inspection_image, adjustment_price/token 저장 | V2 동일 |
| →rejected | memo, inspection_image 저장 | V2 동일 |

**셀러 findOrCreate 로직 (V2 계승):**
```typescript
// consignment.service.ts 내부
async function findOrCreateSeller(name: string, phone: string): Promise<Seller> {
  // 1. 전화번호로 기존 셀러 조회 (normalizePhone)
  // 2. 없으면 신규 생성 (generate_seller_code RPC: NF001, NF002...)
  // 3. 기본 commission_rate: 0.2 (20%)
  const result = await sellersRepo.findOrCreate(name, normalizePhone(phone))
  if (result.error) throw new AppError('INTERNAL', result.error)
  return result.data
}
```

**bulkCreate 셀러 조회 최적화 (W-8):**
```typescript
// bulkCreate 시 N+1 방지: 배치 시작 전 전체 셀러를 Map으로 캐시
async function bulkCreate(rows: RawConsignmentRow[]): Promise<BulkResult<ConsignmentRequest>> {
  const phones = [...new Set(rows.map(r => normalizePhone(r.phone)))]
  const sellersResult = await sellersRepo.findByPhones(phones)
  const sellerMap = new Map(sellersResult.data?.map(s => [s.phone, s]) ?? [])
  // 이후 각 row에서 sellerMap.get(phone) ?? findOrCreateSeller()
  // 신규 셀러만 개별 생성 (기존 셀러는 Map hit)
}
```

**제품명 파싱 (V2 계승):**
```typescript
// V2의 parseProductName 로직을 서비스에서 호출
// "라르디니 라나울 브라운 스포츠코트 48"
// → { brand: "라르디니", model: "라나울 브라운 스포츠코트", category: "jacket", size: "48" }
// brand.ts(59개 별칭) + category.ts(10개) 유틸 활용
```

### 3.2 order.service.ts

**V2 워크플로우 계승:**
```
POST create (직원 접수):
  → order_number 채번 (YYYYMMDD-NNNNNN)
  → product_number 채번 (YYYYMMDD-AAAAAA)
  → orders + order_items 생성 (tx)

PATCH updateStatus:
  10개 상태 전이 (ALLOWED_TRANSITIONS 미정의 → Phase 4에서 정의)

PATCH updateItem:
  inspection_status, final_price, holdAdjustedPrice 등
```

**ORDER ALLOWED_TRANSITIONS 신규 정의 (V2 워크플로우 기반):**
```typescript
// lib/types/domain/order.ts에 추가
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  APPLIED:         ['SHIPPING', 'CANCELLED'],
  SHIPPING:        ['COLLECTED', 'CANCELLED'],
  COLLECTED:       ['INSPECTED', 'CANCELLED'],
  INSPECTED:       ['PRICE_ADJUSTING', 'IMAGE_PREPARING', 'CANCELLED'],
  PRICE_ADJUSTING: ['RE_INSPECTED', 'CANCELLED'],
  RE_INSPECTED:    ['IMAGE_PREPARING', 'CANCELLED'],
  IMAGE_PREPARING: ['IMAGE_COMPLETE', 'CANCELLED'],
  IMAGE_COMPLETE:  ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:       [],
  CANCELLED:       [],
} as const
```

**export 함수:**
```typescript
export async function list(filters, pageOptions): Promise<{ items: OrderWithItems[]; total: number }>
export async function getById(id: string): Promise<OrderWithItems>
export async function create(input: CreateOrderInput): Promise<{ orderId: string }>
export async function updateStatus(id: string, status: OrderStatus): Promise<Order>
export async function updateItem(itemId: string, fields: Partial<OrderItem>): Promise<OrderItem>
```

### 3.3 settlement.service.ts

**V2 워크플로우 계승:**
```
generate:
  1. getSettlementPeriod() → 정산 기간 (수요일 기준 7일) [위치: lib/utils/date.ts — 기존 날짜 유틸에 추가]
  2. active sellers 조회
  3. sold_items 조회 (settlement_status='pending' & 기간 내)
  4. classifyProduct() → 위탁 상품 필터 (lib/utils/product-classifier.ts — 결정 D-10)
  5. matchSellerByName() → 셀러 매칭 (lib/utils/seller-matcher.ts — 결정 D-10)
  6. settlement.calc.ts → 수수료 계산 (Math.round — 결정 D-8)
  7. createSettlement tx → settlements + settlement_items
  8. sold_items.settlement_status = 'settled'

confirm: draft → confirmed (SETTLEMENT_TRANSITIONS 기반)
pay: confirmed → paid (SETTLEMENT_TRANSITIONS 기반)
```

**export 함수:**
```typescript
export async function generate(params: GenerateParams): Promise<GenerateResult>
export async function confirm(id: string): Promise<Settlement>
export async function pay(id: string, paidBy: string, transferRef?: string): Promise<Settlement>
export async function list(filters, pageOptions): Promise<{ items: SettlementWithSeller[]; total: number }>
export async function getById(id: string): Promise<SettlementWithDetails>
```

**GenerateResult (V2 계승):**
```typescript
interface GenerateResult {
  period: { start: string; end: string }
  createdCount: number
  settlements: Settlement[]
}
```

### 3.4 matching.service.ts (신규 — plan5 §7 확장)

**V2 3단계 자동매칭 계승:**
```
Step 1: 상품주문번호 완전일치 (16자리+) → score 1.0
Step 2: 구매자명 + 금액 완전일치 → score 0.9
  Step 2-B: 동명이인 → 상품명 유사도 추가 → score 0.85+
Step 3: 상품명 자카드 유사도
  ≥ 0.85 → auto_matched
  0.70~0.85 → needs_review
  < 0.70 → unmatched
```

**export 함수:**
```typescript
export async function autoMatch(): Promise<AutoMatchResult>
export async function manualMatch(salesRecordId: string, naverSettlementId: string, reason?: string): Promise<SettlementMatch>
export async function cancelMatch(matchId: string): Promise<void>
export async function queueSettlements(): Promise<QueueResult>
export async function getQueueSummary(filters?): Promise<SellerSettlementSummary[]>
export async function clearQueue(): Promise<void>
```

**autoMatch 청크 처리 (F-5):**
- 대량 레코드 방어: `MATCH_CHUNK_SIZE = 500` 단위로 분할 처리
- Step 1(상품주문번호 완전일치)에서 대량 소거 → Step 2/3에 전달되는 레코드 수 최소화
- 청크 간 결과를 BulkResult 패턴으로 합산: `{ matched, needsReview, unmatched }` 누적

**동일 score 타이브레이킹 (F-2):**
- 동점(같은 유사도 score) 시 `created_at ASC → id ASC` 순서로 우선 매칭
- 결정적(deterministic) 결과 보장 — 동일 입력 = 동일 출력

**3차 방어 패턴 계승 (V2):**
```typescript
// queueSettlements 내부
// 이미 confirmed/paid인 match_id 또는 naver_settlement_id → 스킵
// settlement_queue 삽입 시 중복 체크
```

**AutoMatchResult:**
```typescript
interface AutoMatchResult {
  matched: number       // 자동 매칭 성공
  needsReview: number   // 수기 확인 필요
  unmatched: number     // 매칭 실패
  details: MatchDetail[]
}
```

### 3.5 sales.service.ts

**V2 워크플로우 계승:**
```
uploadSalesLedger:
  1. 엑셀 파싱 (시트별)
  2. 중복 키 체크: sale_date|naver_order_no|buyer_name|product_name
  3. sales_records 삽입 (session 기반)
  4. 위탁 판매 감지 → SMS 발송

uploadNaverSettle:
  1. 엑셀 파싱
  2. naver_settlements 삽입
  3. 세션 기반 교체 (R4-01)
```

**export 함수:**
```typescript
export async function uploadSalesLedger(file: Buffer, sessionId?: string): Promise<UploadResult>
export async function uploadNaverSettle(file: Buffer, sessionId?: string): Promise<UploadResult>
export async function detectConsignmentSales(batchId: string): Promise<DetectResult>
```

**DetectResult (V2 계승):**
```typescript
interface DetectResult {
  matched: number
  notified: number
  details: { productNumber: string; productName: string; sellerName: string; saleDate: string; saleAmount: number }[]
  unmatched: string[]
}
```

### 3.6 product.service.ts

**export 함수:**
```typescript
export async function list(filters, pageOptions): Promise<{ items: StProductWithSeller[]; total: number }>
export async function getById(id: string): Promise<StProductWithSeller>
export async function update(id: string, fields: Partial<StProduct>): Promise<StProduct>
export async function create(input: CreateProductInput): Promise<StProduct>
export async function getSummary(): Promise<ProductSummary>
```

**V2 상태 필터 계승:**
- photo_pending: photo_status ∈ [pending, shooting]
- photo_done: photo_status=completed & smartstore_status=draft
- selling: is_active=true & sold_at IS NULL & smartstore_status ∈ [uploaded, selling]
- sold: sold_at IS NOT NULL
- inactive: is_active=false

### 3.7 photo.service.ts

**V2 워크플로우 계승:**
```
classify:
  1. 이미지 로드
  2. 배치 분할 (BATCH_THRESHOLD)
  3. Claude Vision 분류 (gateway 경유)
  4. 후처리 (그룹 병합)
  5. 검증 + 재시도

match:
  1. 메타데이터 스코어링 (브랜드35 + 카테고리30 + 색상20 + 사이즈15)
  2. 40~85점 → Vision 비교 (gateway 경유)
  3. ≥70점 → 자동 선택
```

**export 함수:**
```typescript
export async function classify(images: ImageInput[], options?: ClassifyOptions): Promise<ClassifyResult>
export async function match(photoGroups: PhotoGroup[], products: StProduct[]): Promise<MatchResult[]>
```

**주의: SSE 스트리밍은 서비스가 아닌 route.ts에서 처리**
- 서비스는 NextRequest/Response 금지 (§4조)
- classify()는 동기 반환, route.ts에서 SSE 래핑

### 3.8 notification.service.ts

**V2 워크플로우 계승:**
```
자동 발송 이벤트: received, completed, sold, paid
수동 발송: custom, promotion 등
```

**export 함수 (D-11 soft-fail 패턴 적용):**
```typescript
export async function notifyStatusChange(consignmentId: string, event: TriggerEvent): Promise<NotifyResult>
export async function sendCustom(params: CustomNotifyParams): Promise<NotifyResult>
export async function list(filters, pageOptions): Promise<{ items: NotificationLogWithRelations[]; total: number }>
```
- `NotifyResult = { sent: boolean; error?: string }` — 실패 시 throw 안 함 (D-11)

**SMS 발송 (결정 D-9):**
- `lib/aligo/sms.ts`의 `sendSMS()` 경유 (L0 gateway)
- notification.service는 fetch 직접 호출 금지 (architecture-spec §4.2)

**SMS 템플릿 (V3 sms-templates.ts 활용):**
- consignmentReceivedTemplate
- consignmentApprovedTemplate
- consignmentCompletedTemplate
- consignmentRejectedTemplate
- settlementPaidTemplate

---

## 4. Calculator 상세 설계

### 4.1 settlement.calc.ts

**V2 계산 로직 계승 (결정 D-8 반영):**
```typescript
// lib/calculators/settlement.calc.ts
export function calculateSettlement(params: CalcParams): CalcResult

// 수수료 계산 — V2 round() 재현 (결정 D-8)
// KRW 원 단위 반올림. DB INTEGER 컬럼과 동일성 보장.
// deep-checklist §5.2: 반올림/절사 규칙 명시 의무 충족
export function calcCommission(totalSales: number, rate: number): number {
  if (totalSales < 0) throw new AppError('VALIDATION', '총 매출액이 음수입니다')
  if (rate < 0 || rate > 1) throw new AppError('VALIDATION', '수수료율이 범위를 벗어났습니다 (0~1)')
  return Math.round(totalSales * rate)
}

interface CalcParams {
  seller: Pick<Seller, 'id' | 'commissionRate' | 'tier'>
  soldItems: SoldItem[]
  periodStart: string
  periodEnd: string
}

interface CalcResult {
  sellerId: string
  periodStart: string
  periodEnd: string
  totalSales: number           // Σ(sale_price) — INTEGER 합산
  commissionRate: number       // seller.commissionRate ?? COMMISSION_RATES[tier]
  commissionAmount: number     // Math.round(totalSales × commissionRate) — 결정 D-8
  settlementAmount: number     // totalSales - commissionAmount
  soldItemIds: string[]
}
```

**수수료율 결정 (V2 계승):**
```typescript
// 1순위: seller.customCommissionRate (개별 설정)
// 2순위: COMMISSION_RATES[seller.tier] (등급별)
//   general: 25%, employee: 20%, vip: 20%
```

**deep-checklist §5.2 검증 의무:**
- vitest: `calcCommission(100000, 0.25)` === `25000` (정확)
- vitest: `calcCommission(99999, 0.25)` === `25000` (Math.round(24999.75) = 25000)
- vitest: 계산 결과 → RPC 파라미터 → DB 저장 후 조회 = 동일값 증거

### 4.2 price-estimator.calc.ts

```typescript
// lib/calculators/price-estimator.calc.ts
export async function estimateRetailPrice(params: EstimateParams): Promise<EstimateResult>

interface EstimateParams {
  brand: string
  model: string
  category: string
  condition: string
}

interface EstimateResult {
  estimatedPrice: number
  source: RetailPriceSource    // 'naver_estimate' | 'manual' | 'desired_price'
  confidence: number           // 0~1
}
```

---

## 5. 매칭 알고리즘 상세 (V2 완전 계승)

### 5.1 자카드 유사도 (product-matcher)

```typescript
// V2 tokenize → 교집합/합집합 비교
// HTML entity 디코딩 포함: &#39; → ', &amp; → & 등
// 브랜드 정규화: "드레익스" = "drakes" = "drake's" (59개 별칭)
```

**현재 V3에 이미 존재하는 유틸:**
- `lib/utils/brand.ts`: 59개 BRAND_ALIASES, normalizeBrand, isKnownBrand
- `lib/utils/category.ts`: 10개 CATEGORIES, normalizeCategory

**Phase 4에서 추가 필요:**
- 자카드 유사도 함수 → matching.service.ts 내부 private 함수
- HTML entity 디코딩 → matching.service.ts 내부 private 함수
- 색상 정규화 → V3 category.ts에 추가 또는 별도 유틸

**성능 한계 (F-5):**
- 자카드 유사도 O(n²) — sales_records × naver_settlements 교차 비교
- MATCH_CHUNK_SIZE=500 단위 분할로 메모리 폭발 방지
- Step 1 완전일치에서 대량 소거 후 Step 2/3에 넘기는 전략으로 실질적 O(n²) 범위 축소

### 5.2 매칭 점수 임계값 (V2 계승)

```typescript
const THRESHOLD_AUTO = 0.85      // 자동 매칭
const THRESHOLD_REVIEW = 0.70    // 수기 확인
const AMOUNT_TOLERANCE = 0.00    // 금액 완전일치
```

### 5.3 사진 매칭 스코어링 (V2 계승)

```typescript
// photo.service.ts 내부
const SCORE_WEIGHTS = {
  brandExact: 35,     brandSimilar: 25,
  category: 30,       categoryMismatch: -Infinity, // 제외
  color: 20,          colorMismatch: -15,
  size: 15,
}
// ≥70점: 자동, 40~85점: Vision 비교, <40점: 제외
// Vision 결과: MATCH +25, MISMATCH -20, UNCERTAIN 0
```

---

## 6. V2→V3 비즈니스 규칙 매핑

### 6.1 완전 계승 (변경 없음)

| V2 규칙 | V3 위치 |
|---------|---------|
| 정산 기간: 수요일 기준 7일 | settlement.service.ts |
| 수수료: general 25%, employee/vip 20% | lib/types/domain/seller.ts (COMMISSION_RATES) |
| 셀러 코드: NF001, NF002... | sellers.repo.ts (generate_seller_code RPC) |
| 주문번호: YYYYMMDD-NNNNNN | order.tx.ts (generate_order_number RPC) |
| 상품번호: 13자리 | consignment.tx.ts (generate_product_number RPC) |
| 3차 방어 (이중 지급 방지) | matching.service.ts (queueSettlements) |
| 중복 키: sale_date\|naver_order_no\|buyer_name\|product_name | sales.service.ts |
| normalizePhone (앞자리 0 보정) | lib/utils/phone.ts |
| normalizeCondition (숫자→한글) | consignment.service.ts |

### 6.2 V3 개선 (V2 취약점 보완)

| V2 취약점 | V3 개선 | 서비스 |
|----------|---------|--------|
| route.ts에 비즈니스 로직 직접 작성 (855줄) | 서비스 분리 (≤150줄) | 전체 |
| 상태 전이 하드코딩 | ALLOWED_TRANSITIONS 상수 기반 | consignment, order |
| 동시 업로드 시 DELETE 충돌 (DAT-09) | session 기반 삭제 (R4-01) | sales.service.ts |
| photo fetch 직접 호출 | L0 gateway 경유 | photo.service.ts |
| 에러 처리 불일치 (각 route마다 다른 패턴) | AppError + errFrom() 표준화 | 전체 |
| N+1 쿼리 (상품 요약) | getSummary 집계 함수 | product.service.ts |

### 6.3 V3에서 제외 (미사용 V2 기능)

| V2 기능 | 제외 이유 |
|---------|----------|
| EVENT_DISCOUNT (10%, 최대 10만원) | V2에서도 미활성화 (sold_items에 할인 플래그 없음) |
| triggerPriceEstimate 비동기 큐 | Phase 4에서는 동기 호출, 필요 시 Phase 5에서 큐 도입 |

---

## 7. Phase 0~3 충돌 분석

### 7.1 충돌 없음 확인

| Phase | 구현물 | Phase 4 관계 | 충돌 |
|-------|--------|-------------|------|
| Phase 0 | DDL 10개 + RPC 9개 | 서비스가 repo/tx 경유 호출 | 없음 |
| Phase 1 | 도메인 타입 7개 + 유틸 11개 | 서비스가 타입/유틸 import | 없음 |
| Phase 2 | Repository 21개 + tx 3개 | 서비스가 직접 호출 | 없음 |
| Phase 3 | API 레이어 (middleware, response, errors) | route.ts에서 사용 | 없음 |

### 7.2 유일한 수정 사항

- `consignment.ts` ALLOWED_TRANSITIONS 값 변경 (결정 D-1)
  - Phase 1 산출물 수정이지만, Phase 4 서비스 로직의 전제 조건
  - consignments-query.repo.ts가 참조하므로 자동 적용
  - DB CHECK 제약 조건과도 무관 (consignment_status는 text 타입)

---

## 8. 검증 게이트

### 8.1 Phase 4 완료 조건 (15개)

```
□ G-01: tsc --strict --noEmit → 에러 0건
□ G-02: ESLint → no-restricted-imports 위반 0건 (서비스에서 NextRequest 미사용)
□ G-03: 서비스 파일 ≤150줄, 함수 ≤80줄, calculator ≤80줄, gateway ≤80줄
         (phase-checklists Phase 4 + architecture-spec §10조)
□ G-04: grep -r "NextRequest\|NextResponse" lib/services/ → 0건
□ G-05: grep -r "getClient\|createAdminClient" lib/services/ → 0건 (DB 직접 접근 금지)
□ G-06: grep -r "from.*\.service" lib/services/ → 0건 (서비스 간 호출 금지)
□ G-07: grep -r "fetch(" lib/services/ → 0건 (gateway 경유 필수)
□ G-08: ALLOWED_TRANSITIONS + SETTLEMENT_TRANSITIONS 변경 후 기존 테스트 전체 PASS
□ G-09: 서비스별 단위 테스트 최소 3개 (정상/에러/엣지)
□ G-10: settlement.calc.ts 단위 테스트: 수수료 계산 정확성 (deep-checklist §5.2)
□ G-11: product-classifier.ts 단위 테스트 (빈문자열, prefix 없음, 정상)
□ G-12: seller-matcher.ts 단위 테스트 (매칭 성공, 실패, 동명이인)
□ G-13: AppError가 L1 위치에 존재 확인 (architecture-spec §2조)
□ G-14: lib/aligo/sms.ts 존재 + architecture-spec §3.1 업데이트 완료
□ G-15: settlement-status.repo.ts updateStatus()에 expectedCurrent 조건 존재 (W-5)
□ G-16: lib/errors.ts 존재 + ErrorCode/AppError만 포함 + HTTP_STATUS 미포함 (FAIL-4)
□ G-17: env.ts에 getOptionalEnvVar() 존재 + ALIGO/ANTHROPIC이 optional (FAIL-2)
□ G-18: sellers-batch.repo.ts 존재 + findByPhones() 상한 1,000건 (FAIL-3)
□ G-19: fail_settlement RPC 존재 + ROW_COUNT=0 에러 + tokyo-ddl 동기화 (FAIL-1)
□ G-20: architecture-exceptions.md에 sellers-batch cross-repo 예외 등록 (FAIL-3)
```

### 8.1.1 Batch Checkpoint 전략 (W-4)

배치 처리 중 실패 시 재시도 전략:
```
- BulkResult.failed에 failedIds 포함 → 실패 항목만 재시도 가능
- consignment.bulkCreate: succeeded 항목은 커밋 유지, failed만 응답에 포함
- matching.autoMatch: 청크 단위로 BulkResult 합산, 실패 청크 ID 기록
- settlement.generate: 셀러별 독립 처리, 실패 셀러만 BulkResult.failed에 포함
```

### 8.1.2 settlement-status.repo.ts §5.2 위반 수정 (W-5)

현재 `updateStatus(id, status)` 함수는 expected-status 조건 없이 `.update({ status }).eq('id', id)`만 사용.
confirm()/pay()는 하드코딩 `.eq('status', 'draft')`로 optimistic lock 적용 중.

**수정 계획:**
- `updateStatus()` 함수에 `expectedCurrent` 파라미터 추가: `.eq('status', expectedCurrent)`
- SETTLEMENT_TRANSITIONS 기반 검증을 서비스(1차) + repo(2차) 이중 방어
- 검증 게이트 G-15로 추가: `grep -r "\.update.*status.*\.eq.*id" lib/db/repositories/settlement-status` → expectedCurrent 조건 필수

### 8.2 아키텍처 준수 체크

```
□ A-01: L0(infra) ← L1(service) ← L3(route) 의존 방향 준수
□ A-02: 서비스 반환: 값 직접 반환 / throw AppError (DbResult 미노출)
□ A-03: 상태 전이: ALLOWED_TRANSITIONS + SETTLEMENT_TRANSITIONS 상수 기반 (하드코딩 0건)
□ A-04: 배치 처리: BulkResult 패턴 + partial 실패 허용
```

### 8.3 process-checklist 준수 체크

```
□ P-01: 변경 레벨 L3 지정 완료 (본 문서 상단)
□ P-02: deep-checklist §5.2 반올림 규칙 명시 (결정 D-8)
□ P-03: deep-checklist §5.1 COMMISSION_RATES 단일 소스 (settlement.calc.ts)
□ P-04: 구조 변경 정당화 완료 — lib/aligo/ (결정 D-9, architecture-spec §11조)
□ P-05: Simplify 보고 — lib/aligo/ 신설이 최소 구조임을 확인 (대안 3개 비교 완료)
```

---

## 9. 구현 순서 (의존성 기반)

```
Step 0: 선행 필수 (다른 작업 전 완료)
  ├─ lib/errors.ts 신설 + lib/api/errors.ts re-export (§1.6, FAIL-4)
  ├─ env.ts getOptionalEnvVar 추가 (§1.7, FAIL-2)
  ├─ sellers-batch.repo.ts 신설 (§1.8, FAIL-3)
  ├─ fail_settlement RPC + settlement-status.repo.ts 수정 (§1.9, FAIL-1)
  ├─ architecture-spec §3.1 L0 목록에 aligo + gateway 추가 (문서 수정)
  └─ architecture-exceptions.md에 sellers-batch cross-repo 예외 등록

Step 1: 선행 작업 (§1.1~1.5)
  ├─ ALLOWED_TRANSITIONS + SETTLEMENT_TRANSITIONS 수정
  ├─ 누락 repo 2개 생성
  ├─ 도메인 타입 보강
  ├─ gateway 생성 (claude-vision + aligo-sms)
  └─ utils 생성 (product-classifier + seller-matcher)

Step 2: 독립 서비스 (병렬 가능)
  ├─ notification.service.ts (lib/aligo/sms.ts 의존)
  ├─ product.service.ts (의존 없음)
  └─ settlement.calc.ts + price-estimator.calc.ts (의존 없음)

Step 3: 핵심 서비스 (순차)
  ├─ consignment.service.ts (seller findOrCreate 포함)
  ├─ order.service.ts
  └─ settlement.service.ts (settlement.calc 의존)

Step 4: 복합 서비스 (Step 3 완료 후)
  ├─ sales.service.ts
  ├─ matching.service.ts (settlement-matches/queue repo 의존)
  └─ photo.service.ts (gateway 의존)

Step 5: 검증
  └─ 게이트 15개 + 아키텍처 체크 4개
```

---

## 10. 에이전트 팀 배치

| 역할 | 에이전트 | 담당 | 병렬 |
|------|---------|------|------|
| CTO Lead | cto-lead | 전략 총괄 + 의존성 순서 관리 | — |
| 선행-1 | 빌더 | Step 1: ALLOWED_TRANSITIONS + repo 2개 + 타입 보강 | ✅ |
| 선행-2 | 빌더 | Step 1: gateway + calculator 2개 | ✅ |
| 서비스-1 | 빌더 | Step 2~3: consignment + order + notification | ✅ |
| 서비스-2 | 빌더 | Step 2~3: settlement + product | ✅ |
| 서비스-3 | 빌더 | Step 4: sales + matching + photo | 순차 |
| 테스터 | 테스터 | 서비스별 단위 테스트 작성 | 순차 |
| 리뷰어 | 리뷰어 | 게이트 10개 + 아키텍처 체크 4개 | 순차 |

**총 에이전트**: 8명 (CTO 1 + 빌더 4 + 테스터 1 + 리뷰어 1 + 여유 1)

---

## 부록 A: V2 워크플로우 전체 데이터 흐름 (계승 대상)

```
네이버폼 제출 → 엑셀 다운로드
    ↓
POST consignment.bulkCreate (엑셀 업로드)
    ↓ seller findOrCreate + consignment_requests 저장
    ↓
PATCH consignment.updateStatus → inspecting → approved (번호채번)
    ↓ → received (수령확인 + SMS)
    ↓ → completed (상품등록 + 주문생성 + SMS)
    ↓
POST sales.uploadSalesLedger (매출장 업로드)
    ↓ sales_records 저장
    ↓ detectConsignmentSales → st_products.sold_at 업데이트 + SMS
    ↓
POST sales.uploadNaverSettle (네이버 정산 업로드)
    ↓ naver_settlements 저장 (session 기반)
    ↓
POST matching.autoMatch (3단계 자동매칭)
    ↓ settlement_matches 생성
    ↓
PATCH matching.manualMatch (수기 매칭)
    ↓
POST matching.queueSettlements (큐 등록 + 3차 방어)
    ↓ settlement_queue 생성
    ↓
POST settlement.generate (정산 생성)
    ↓ settlements + settlement_items 생성
    ↓ sold_items.settlement_status = 'settled'
    ↓
PATCH settlement.confirm (draft → confirmed)
    ↓
PATCH settlement.pay (confirmed → paid + SMS)
```

---

## 부록 B: plan5 §7 대비 변경 사항

| plan5 §7 명세 | 본 계획 | 변경 이유 |
|-------------|---------|----------|
| 7개 서비스 | **8개** (+matching) | V2 매칭 593줄, 150줄 제한 위반 방지 |
| 9개 신규 파일 | **16개** (+aligo, +utils 2, +repo 2, +matching, +product) | V2 전수조사 기반 누락 보완 |
| BatchResult 패턴 | **유지** | sales.service, consignment.service에서 사용 |
| SWR 캐싱 | **Phase 5로 이관** | 서비스 레이어 책임 아님 (L2 concern) |
| lib/settlement/ 유틸 | **lib/utils/ 배치** | product-classifier, seller-matcher → utils 성격 (결정 D-10) |
| gateway 미정의 | **lib/gateway/ + lib/aligo/** | architecture-spec §4.2 준수 (결정 D-9) |

---

---

## 부록 C: 5개 문서 준수 매트릭스

| 문서 | 핵심 요구사항 | 본 계획 준수 |
|------|-------------|-------------|
| **phase-checklists** | 파일 150줄, 함수 80줄, TRANSITIONS 사용 | G-03, G-08, A-03 |
| **architecture-spec** | L0/L1 경계, §4.2 fetch 금지, §10 줄수, §11 정당화 | D-9 정당화, D-10, G-03~07, A-01 |
| **deep-checklist** | §5.2 반올림 명시, §5.1 단일소스, §5.3 DB-우선 | D-8, G-10, P-02~03 |
| **process-checklist** | 변경 레벨 L3, Simplify 보고, 구조 게이트 | P-01~05 |
| **analysis-techniques** | 등급 3 최소 16회 | 사전분석 16회 완료 |

---

*이 플랜은 V2 전수조사(4,500줄) + plan5 §7 + V3 Phase 0~3 현황(53개 파일) + 사전분석 16회 + 5개 문서 종합 검증을 교차 비교하여 작성되었습니다.*
*Rev.2 반영: 설계 논의 3건(D-8, D-9, D-10) + SETTLEMENT_TRANSITIONS 추가 + AppError 위치 수정 + 검증 게이트 14개로 확장.*
*Rev.3 반영: analysis-techniques 등급 3 검증 16회 결과 13건 — D-11(soft-fail), F-2(타이브레이킹), F-3(음수방어), F-4(SMS 안전장치), F-5(청크처리), W-1~W-8(구체화/보완).*
*검증 게이트 15개 + 아키텍처 체크 4개 + process-checklist 5개.*
*ALLOWED_TRANSITIONS 1곳 수정 + AppError 이동 + settlement-status.repo 수정 외 Phase 0~3 충돌 0건.*
*V2 워크플로우 완전 계승 + architecture-spec 13조 준수.*
*Rev.4 반영: 등급 3 검증 3차(48회) 결과 — FAIL-1(RPC 단독 확정), FAIL-2(getOptionalEnvVar), FAIL-3(sellers-batch.repo), FAIL-4(lib/errors.ts L1). 검증 게이트 20개 + 아키텍처 체크 4개 + process-checklist 5개.*
*구현 시작 전 사용자 승인 필수.*
