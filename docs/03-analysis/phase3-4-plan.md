# Phase 3+4 종합 리서치 보고서

**작성일**: 2026-03-04
**기반**: V2 코드 독립 2회 리서치 + docs 교차 검증
**상태**: 승인 대기 (구현 미착수)

---

## 0. 리서치 방법론

V2 프로젝트(`classic-menswear-v2`)에 대해 **동일 범위의 독립 리서치를 2회** 수행.
각 회차별 4개 탐색 에이전트(인증/미들웨어, 서비스/비즈니스로직, API 패턴, 정산 시스템)를 병렬 투입.
총 8개 에이전트 결과를 교차 비교하여 **모든 핵심 항목 100% 일치**를 확인한 뒤,
`docs/Control Layer` 및 `docs/Strategic/plan5.md` 규칙과 정합성 검증 완료.

---

## 1. V2 현황 요약 (1차/2차 교차 검증 결과)

### 1.1 인증/미들웨어

| 항목 | V2 현황 | 신뢰도 |
|------|---------|--------|
| 비밀번호 검증 | **평문 비교** (`id !== ADMIN_ID \|\| password !== ADMIN_PASSWORD`) | 100% |
| 세션 메커니즘 | HMAC-SHA256 서명 쿠키 (`base64(payload).hmac_hex`) | 100% |
| 쿠키 | `admin_session`, httpOnly, sameSite=strict, 7일 | 100% |
| middleware.ts | **미존재**. `proxy.ts` 데드코드로 존재 (함수명 `proxy`, 미연결) | 100% |
| admin API 인증 검증 | **0건** — 어떤 admin route도 `verifySession` 호출 안 함 | 100% |
| rate limiter | login만 활성 (5/min). adminApi(100/min), publicApi(10/min)는 proxy.ts(데드코드)에서만 참조 | 100% |
| bcrypt | **미사용** | 100% |
| SESSION_SECRET 요구사항 | 최소 32자, 없으면 모듈 로드 시 throw | 100% |
| CORS | **미설정** (same-origin 전제) | 100% |

### 1.2 서비스 레이어

| 항목 | V2 현황 | 신뢰도 |
|------|---------|--------|
| 서비스 디렉토리 | `app/api/admin/photos/match/services/` **유일** (6파일) | 100% |
| 비즈니스 로직 위치 | Fat Route 패턴 — route.ts에 직접 작성 | 100% |
| Zod 사용 | **없음** — 수동 타입 가드 또는 타입 단언만 사용 | 100% |
| 상태 머신 | consignment만 명시적 (7상태 + ALLOWED_TRANSITIONS). orders/products는 검증 없음 | 100% |
| 주문번호 생성 | `YYYYMMDD-XXXXXX` 인라인 생성, **2곳 중복** (orders + consignments/[id]) | 100% |
| 배치 처리 | 전부 순차 `for` 루프, `Promise.all()` 없음 | 100% |

### 1.3 Commission 계산

| 항목 | V2 현황 | 신뢰도 |
|------|---------|--------|
| 공식 | `Math.round(totalSales * commissionRate)` | 100% |
| rate 소스 | `sellers.commission_rate` DB 컬럼 (tier에서 런타임 계산 아님) | 100% |
| 기본값 | seller 미발견 시 `0.25` (25%) | 100% |
| 상수 | `{ general: 0.25, employee: 0.20, vip: 0.20 }` (참조용) | 100% |
| 이벤트 할인 | 정의됨 (10%, 상한 10만원) but **비활성** (identity function) | 100% |
| **중복 계산 문제** | `settlement-calculator.ts` + `queue-settlements/route.ts` 인라인 — 동일 공식 2곳 | 100% |

### 1.4 정산 시스템

| 항목 | V2 현황 | 신뢰도 |
|------|---------|--------|
| 2중 플로우 | Old(sold_items→settlements) + New(sales_records+naver_settlements→settlement_queue) | 100% |
| settlement 상태 | `pending → confirmed → paid` (read-validate-write 패턴) | 100% |
| sold_items 상태 | `pending → settled` | 100% |
| queue 상태 | `pending → confirmed` (paid 정의됨 but 미사용) | 100% |
| match 상태 | `unmatched → auto_matched / manual_matched ↔ unmatched` | 100% |
| 3차 방어 | (1) 앱레벨 Set dedup (2) DB UNIQUE 제약 (3) paid/confirmed 가드 | 100% |
| 자동매칭 | 3단계: 16자리 주문번호 → 구매자+금액 → Jaccard 유사도 (0.85 auto, 0.70 review) | 100% |
| 정산 기간 | 수요일 기준 14일 전부터 7일 윈도우, 공휴일 push-forward | 100% |

### 1.5 API 패턴

| 항목 | V2 현황 | 신뢰도 |
|------|---------|--------|
| 응답 형식 | **통일 없음** — 4가지+ 스타일 혼재 | 100% |
| 에러 형식 | `{ error: string }` 단일 필드 (에러 코드 없음) | 100% |
| HTTP 코드 | 200, 201, 400, 403, 404, 500, 503 (401/409/422 미사용) | 100% |
| Supabase 클라이언트 | `createAdminClient()` 요청별 생성 (Service Role Key, RLS bypass) | 100% |
| 페이지네이션 | 2가지 패턴 혼재: `page/per_page` vs `page/pageSize` | 100% |
| 파일 업로드 | busboy(streaming, photos) vs formData(buffered, settlement excels) | 100% |
| 셀러 CRUD | **전용 라우트 없음** — consignments POST 부수효과로만 생성 | 100% |

### 1.6 V2 상태 전이 전체 맵

```
## Consignment (유일한 명시적 상태 머신)
pending → inspecting → approved → received → completed (terminal)
                 ↕           ↕          ↕
             on_hold     on_hold     on_hold
             rejected (terminal) — 모든 비종료 상태에서 가능

  부수효과:
  - approved: RPC generate_product_number, approved_at
  - received: notifyStatusChange (fire-and-forget)
  - completed: st_products INSERT + orders INSERT + order_items INSERT
               + triggerPriceEstimate (fire-and-forget)
  - on_hold: crypto.randomUUID() → adjustment_token, adjustment_price
  - rejected: memo, reject_reason, inspection_image

## Order (무검증)
APPLIED → (any string, route에서 검증 없음)

## Product Photo Status (무검증)
pending → shooting → editing → completed

## Product Smartstore Status (무검증)
draft → ready → uploaded → selling

## Settlement (read-validate-write)
pending → confirmed → paid

## Sold Item Settlement (old flow)
pending → settled

## Queue (new flow)
pending → confirmed (→ paid 정의됨 but 미구현)

## Match Status
unmatched → auto_matched | manual_matched ↔ unmatched
```

---

## 2. docs 규칙 대비 필수 요구사항

### 2.1 Phase 3 MUST (docs 출처별)

| 출처 | 요구사항 |
|------|----------|
| phase-checklists.md L143-148 | `bcrypt cost=12`, `requireAdmin` 적용 |
| plan5.md §6.1 | `lib/auth.ts`에 `hashPassword()` + `BCRYPT_COST = 12` |
| plan5.md §6.2 | `middleware.ts`에 CORS: `/api/consignment`, `/api/orders` 경로 |
| plan5.md §8.2 | `requireAdmin(req)` → 실패 시 401 반환 → Phase 5 핸들러에서 사용 |
| plan5.md §8.2.1 | `AppError(code, message, httpStatus)` 에러 표준화 |
| plan5.md §7.3 | `lib/api/response.ts`: `ok()`, `err()`, `validationErr()` 표준 응답 |
| phase1-risk-report RISK-01 | Session TTL 검증 필수 (verifySessionToken에서 강제) |
| architecture-spec Article 2 | L0(인증) → L1 방향만 허용 |

### 2.2 Phase 4 MUST (docs 출처별)

| 출처 | 요구사항 |
|------|----------|
| phase-checklists.md L151-155 | 서비스는 HTTP 객체를 모른다, partial 처리 로직 존재 |
| architecture-spec Article 4.1 | NextRequest import 금지, HTTP 응답 생성 금지, DB 직접 호출 금지(repo 경유), 상태전이는 서비스에서만 |
| architecture-spec Article 4.2 | NextRequest import / fetch 직접 호출 / response 생성 / route.ts 내 비즈니스 로직 = FAIL |
| architecture-spec Article 6 | Batch 오케스트레이션은 L1(Service)에만 존재. 멱등성 보장 필수. checkpoint 기록 필수 |
| architecture-spec Article 10 | 서비스: 150줄, 함수: 80줄 |
| plan5.md §7.1 | 서비스 9개 생성 |
| plan5.md §7.2 | `BatchResult` 패턴 — `classifyBatch()` with failedIds, partial, 429 처리 |
| plan5.md §7.3 | SWR 캐싱 전략 — `ok(data, { revalidate: 30 })` |
| agent-ops-guide §5 | route.ts 얇게, 서비스 오케스트레이션, 상태전이/정산은 서비스, DB는 repo 경유 |
| phase1-risk-report RISK-05 | KST 경계 사용 필수 (settlement period 계산) |

### 2.3 공통 게이트 (phase-checklists.md §0)

| 항목 | 명령어 |
|------|--------|
| tsc --noEmit 0 에러 | `cd apps/web && npx tsc --strict --noEmit` |
| next build 성공 | `cd apps/web && npx next build` |
| ESLint 0 warning | `cd apps/web && npx eslint --max-warnings 0` |
| vitest 실패 0 | `cd apps/web && npx vitest run` |

---

## 3. Phase 3 상세 계획: 미들웨어 + 인증

### 3.1 생성 파일 (4개)

#### 3.1.1 `apps/web/lib/api/errors.ts` (~30줄)

```
목적: 에러 코드 표준화
WHY: V2는 에러 코드 없음 → 프론트 분기 불가
HOW: AppError 클래스 + 코드 enum
WHERE: lib/api/response.ts에서 import, 전 서비스/라우트에서 throw

내용:
- AppError extends Error { code, httpStatus }
- ErrorCode enum: VALIDATION | AUTH | CONFLICT | NOT_FOUND | RATE_LIMIT | INTERNAL
- 코드별 기본 HTTP status 매핑
```

#### 3.1.2 `apps/web/lib/api/response.ts` (~50줄)

```
목적: 표준 응답 헬퍼
WHY: V2는 라우트별 4가지+ 응답 형식 혼재
HOW: ok()/err()/validationErr()/errFrom() 함수
WHERE: 모든 Phase 5 route.ts에서 import

내용:
- ok<T>(data: T, cacheHint?: { revalidate: number }) → { success: true, data }
- err(message: string, code?: ErrorCode) → { success: false, error: { code, message } }
- validationErr(message: string) → err(message, 'VALIDATION') with 400
- errFrom(e: unknown) → AppError면 해당 코드/상태, 아니면 INTERNAL 500
```

#### 3.1.3 `apps/web/lib/api/middleware.ts` (~45줄)

```
목적: Admin 라우트 인증 함수
WHY: V2 admin API는 인증 검증 0건 (최대 보안 취약점)
HOW: 쿠키 추출 → verifySessionToken() → 실패 시 401
WHERE: Phase 5 admin route.ts에서 첫 줄 호출

내용:
- requireAdmin(req: NextRequest): Promise<NextResponse | null>
  - req.cookies.get('admin_session')
  - verifySessionToken(token) 호출 (Phase 1 lib/auth.ts)
  - 실패 시 NextResponse.json({ success: false, error: { code: 'AUTH', message } }, { status: 401 })
  - 성공 시 null 반환 (호출부에서 null 체크)
```

#### 3.1.4 `apps/web/middleware.ts` (~30줄)

```
목적: Next.js 자동 인식 미들웨어
WHY: V2에 middleware.ts 미존재. proxy.ts 데드코드만 있음
HOW: 경로별 분기 — admin 세션 체크, public CORS, health 패스
WHERE: Next.js가 자동 인식 (프로젝트 루트)

내용:
- config.matcher: ['/api/admin/:path*', '/api/consignment/:path*', '/api/orders/:path*', '/admin/:path*']
- /api/admin/* → 세션 쿠키 검증 (verifySessionToken), 실패 시 401
- /api/consignment/*, /api/orders/* → CORS 헤더 (ALLOWED_ORIGIN)
- /api/health, /api/ready → 패스
```

### 3.2 수정 파일 (1개)

#### `apps/web/lib/auth.ts`

```
추가:
- BCRYPT_COST = 12
- hashPassword(password: string): Promise<string> → bcrypt.hash(password, BCRYPT_COST)
- verifyPassword(password: string, hash: string): Promise<boolean> → bcrypt.compare(password, hash)
```

### 3.3 V2→V3 전환 결정 사항

| V2 현황 | V3 변경 | 근거 |
|---------|---------|------|
| 평문 비밀번호 비교 | **bcrypt cost=12** | plan5 §6.1 명시, OWASP 요구 |
| middleware.ts 미존재 | **middleware.ts 생성** | V2 최대 보안 취약점 해소 |
| admin API 인증 0건 | **requireAdmin()** 전 admin 라우트 보호 | phase-checklists Phase 3 MUST |
| CORS 미설정 | **public 경로에 CORS 헤더** | plan5 §6.2 명시 |
| rate limiter 미사용 | **middleware에서 rate limiter 연결** | V2 proxy.ts 의도 복원 |
| 세션 TTL 미검증 | **verifySessionToken에서 TTL 강제** | phase1-risk-report RISK-01 |

### 3.4 리스크

| ID | 리스크 | 심각도 | 대응 |
|----|--------|--------|------|
| R3-1 | bcrypt 도입 시 V2 평문 비번과 호환 불가 | MEDIUM | V3는 신규 시스템. V2 데이터 마이그레이션 시 re-hash 필요 — Phase 0 영역 |
| R3-2 | middleware.ts 경로 매칭 오류 시 인증 우회 | HIGH | `config.matcher` 정밀 정의 + 테스트 3개 (admin 차단/public 허용/health 허용) |
| R3-3 | CORS ALLOWED_ORIGIN 환경변수 누락 시 오류 | LOW | `requireEnv('ALLOWED_ORIGIN')` + fallback 없음 (보안 우선) |
| R3-4 | Phase 1 auth.ts verifySessionToken과 middleware 연동 | LOW | Phase 1에서 이미 구현된 함수를 middleware에서 호출만 하면 됨 |

---

## 4. Phase 4 상세 계획: 서비스 레이어

### 4.1 생성 파일 (9개 서비스)

#### 4.1.1 `settlement.service.ts` (~120줄)

```
목적: 정산 생성/확정/지급 오케스트레이션
WHY: V2 generate/route.ts에 비즈니스 로직 직접 존재
HOW: lib/settlement 유틸 + Phase 2 repo/tx 조합
WHERE: Phase 5 settlement 라우트에서 호출

함수:
- generateSettlement(period, holidays?) → SettlementResult[]
  V2 소스: settlement/generate/route.ts 전체
  의존: sellers.repo.listByPage, settlement.repo.listPendingSoldItems,
        classifyProduct, matchSellerByName, calculateSettlement, settlement.tx

- confirmSettlement(id) → Settlement
  V2 소스: settlement/confirm/[id]/route.ts
  의존: settlement.repo.getSettlementById, settlement.repo.updateSettlementStatus

- paySettlement(id) → Settlement
  V2 소스: settlement/pay/[id]/route.ts
  의존: 동일 패턴

- registerQueue(matchIds?, batchIds?) → { inserted, paidSkipped }
  V2 소스: queue-settlements/route.ts POST
  의존: settlement.repo, sellers.repo, settlement-calculator (단일 소스!)
  주의: 3차 방어 로직 내장 필수
```

#### 4.1.2 `matching.service.ts` (~100줄)

```
목적: sales_records ↔ naver_settlements 자동/수동 매칭
WHY: V2 auto-match/route.ts에 DB+알고리즘 혼재
HOW: lib/settlement/product-matcher.ts(순수 함수) + repo 조합

함수:
- autoMatch(salesBatchIds?, naverBatchId?) → MatchSummary
  V2 소스: auto-match/route.ts + lib/settlement/product-matcher.ts
  의존: sales-records.repo, naver-settlements.repo, autoMatch(순수), settlement_matches INSERT

- manualMatch(salesRecordId, naverSettlementId, reason?) → Match
  V2 소스: manual-match/route.ts PATCH

- unmatch(matchId) → void
  V2 소스: manual-match/route.ts DELETE
```

#### 4.1.3 `order.service.ts` (~90줄)

```
목적: 주문 생성/상태관리/번호생성
WHY: V2 orders/route.ts에 주문번호 생성 인라인, 상태 무검증

함수:
- createOrder(input) → Order
  V2 소스: admin/orders/route.ts POST
  의존: order.tx.createOrderWithItems (Phase 2)

- updateStatus(orderId, expectedStatus, newStatus) → Order
  V2 소스: admin/orders/route.ts PATCH (무검증 → V3에서 검증 추가)
  의존: orders.repo.updateStatus (낙관적 잠금)

- generateOrderNumber() → string
  V2 소스: admin/orders/route.ts L95-97 (인라인, 2곳 중복)
  형식: YYYYMMDD-XXXXXX (6자리 랜덤 숫자)

- generateProductNumber() → string
  V2 소스: admin/orders/route.ts L99-103
  형식: YYYYMMDD-AAAAAA (6자리 랜덤 영문)
```

#### 4.1.4 `consignment.service.ts` (~140줄)

```
목적: 위탁 상태 전이 + completeConsignment 부수효과
WHY: V2에서 유일하게 명시적 상태머신이 있지만 route.ts에 내장 (358줄)

함수:
- transitionStatus(id, newStatus, payload?) → ConsignmentRequest
  V2 소스: admin/consignments/[id]/route.ts PATCH
  내장: ALLOWED_TRANSITIONS 상수, 상태별 분기

- completeConsignment(id, input) → { product, order }
  V2 소스: consignments/[id]/route.ts completed 핸들러 (L197-353)
  의존: consignment.tx.completeConsignment (Phase 2), orders.repo, products.repo

- holdWithToken(id, adjustmentPrice?, inspectionImage?) → { token }
  V2 소스: on_hold 핸들러 — crypto.randomUUID() → adjustment_token

상수:
- ALLOWED_TRANSITIONS: Record<ConsignmentStatus, ConsignmentStatus[]>
  pending → [inspecting, approved, on_hold, rejected]
  inspecting → [approved, on_hold, rejected]
  on_hold → [inspecting, approved, rejected]
  approved → [received, on_hold, rejected]
  received → [completed, on_hold, rejected]
  completed → []
  rejected → []
```

#### 4.1.5 `notification.service.ts` (~60줄)

```
목적: SMS 알림 발송/재전송
WHY: V2 bulk-send/route.ts에 순차 발송 로직 인라인

함수:
- sendBulk(targets, template, triggerEvent) → { sent, failed, skipped, errors }
  V2 소스: admin/notifications/bulk-send/route.ts

- resend(logId) → { sent }
  V2 소스: admin/notifications/resend/route.ts

- notifyStatusChange(consignmentId, status) → void
  V2 소스: lib/notification/index.ts (이미 추출됨)
```

#### 4.1.6 `photo.service.ts` (~110줄)

```
목적: 사진 분류/매칭 배치 오케스트레이션
WHY: V2 photos/match/services 유일한 서비스 디렉토리, BatchResult 패턴 필수

함수:
- classifyBatch(productIds) → BatchResult
  plan5 §7.2 구현 — failedIds, partial, 429 처리 필수
  V2 소스: photos/classify/route.ts + lib/photo-classify/

- matchPhotos(groups, useVisual?) → { matches, visualCallCount }
  V2 소스: photos/match/services/matchingProcessor.ts (이미 추출됨)
  의존: scoreCalculator, claudeMatching, productCandidates
```

#### 4.1.7 `sale-detector.service.ts` (~70줄)

```
목적: 매출장부 업로드 + 위탁 감지 + SMS 알림
WHY: V2 upload-sales-ledger/route.ts에 파싱+감지+알림 혼재

함수:
- uploadSalesLedger(file, batchId) → { inserted, skipped, dupSkipped }
  V2 소스: upload-sales-ledger/route.ts POST

- detectConsignmentSales(records) → ConsignmentDetection[]
  V2 소스: upload-sales-ledger/route.ts 내 인라인 감지 로직
```

#### 4.1.8 `product.service.ts` (~80줄)

```
목적: 상품 목록 + 요약 집계 + 업데이트
WHY: V2 products/route.ts GET에 N+1 쿼리 패턴

함수:
- listWithSummary(filter, page) → { products, summary, total }
  V2 소스: admin/products/route.ts GET (N+1 쿼리 → 단일 쿼리 최적화)

- updateProduct(id, fields) → StProduct
  V2 소스: admin/products/route.ts PATCH
```

#### 4.1.9 `seller.service.ts` (~50줄)

```
목적: 셀러 조회/생성/수수료 관리
WHY: V2에 셀러 전용 CRUD 없음 — consignments POST 부수효과로만 생성

함수:
- findOrCreateSeller(phone, name, source?) → Seller
  V2 소스: admin/consignments/route.ts POST (셀러 upsert 로직)
  주의: seller_code 순차 생성 동시성 문제 → DB UNIQUE + retry

- updateCommissionRate(sellerId, rate) → Seller
  의존: sellers.repo.updateCommissionRate (Phase 2)
```

### 4.2 V2 비즈니스 로직 추출 맵

```
V2 Fat Route                                → V3 Service
───────────────────────────────────────────────────────────
orders/route.ts POST                        → order.service.createOrder()
  ├ orderNumber 생성 (인라인)                → order.service.generateOrderNumber()
  ├ productNumber 생성 (인라인)              → order.service.generateProductNumber()
  └ order_items INSERT + 수동 롤백           → order.tx.createOrderWithItems() (Phase 2)

consignments/[id]/route.ts PATCH            → consignment.service.transitionStatus()
  ├ ALLOWED_TRANSITIONS                     → consignment.service (상수)
  ├ approved → RPC generate_product_number  → consignment.tx (Phase 2)
  ├ completed → st_products/orders 생성     → consignment.service.completeConsignment()
  └ on_hold → adjustment_token 생성         → consignment.service.holdWithToken()

settlement/generate/route.ts               → settlement.service.generateSettlement()
  ├ classifyProduct()                       → 이미 lib/settlement에 존재
  ├ matchSellerByName()                     → 이미 lib/settlement에 존재
  ├ calculateSettlement()                   → 이미 lib/settlement에 존재
  └ INSERT settlements + items              → settlement.tx (Phase 2)

settlement/queue-settlements/route.ts       → settlement.service.registerQueue()
  ├ 3차 방어 로직                           → settlement.service (내장)
  └ commission 계산 (인라인 중복!)          → settlement-calculator.ts (단일 소스 강제)

settlement/auto-match/route.ts              → matching.service.autoMatch()
  └ lib/settlement/product-matcher.ts       → 이미 lib/settlement에 존재 (순수 함수)

photos/match/route.ts                       → photo.service.matchPhotos()
  └ matchAllGroups()                        → 이미 photos/match/services에 존재

admin/products/route.ts GET                 → product.service.listWithSummary()
  └ 요약 집계 (N+1 쿼리)                   → 단일 쿼리로 최적화

admin/consignments/route.ts POST            → seller.service.findOrCreateSeller()
  └ 셀러 upsert + NF코드 생성              → 셀러 서비스로 분리

admin/notifications/bulk-send/route.ts      → notification.service.sendBulk()
  └ 순차 발송 루프                          → 동일 패턴 유지 (Solapi rate limit 고려)
```

### 4.3 핵심 설계 원칙 (docs 기반)

1. **서비스는 HTTP를 모른다**: `NextRequest`, `NextResponse` import 절대 금지 (architecture-spec Article 4)
2. **DB 접근은 repo 경유**: Phase 2 repo 함수만 호출. `supabase.from()` 직접 호출 금지 (architecture-spec Article 5)
3. **상태 전이는 서비스에서만**: `ALLOWED_TRANSITIONS`를 서비스에 정의 (agent-ops-guide §5)
4. **commission 단일 소스**: `lib/settlement/settlement-calculator.ts`만 사용, 인라인 계산 금지 (phase-checklists Phase 1)
5. **BatchResult 패턴**: `photo.service.classifyBatch`에 `failedIds`/`partial` 처리 필수 (plan5 §7.2)
6. **150줄 이내**: 모든 서비스 파일 (architecture-spec Article 10)
7. **80줄 이내**: 모든 함수 (architecture-spec Article 10)
8. **WHY/HOW/WHERE 헤더 필수**: 모든 파일 (CLAUDE.md 코딩 규칙)

### 4.4 리스크

| ID | 리스크 | 심각도 | 대응 |
|----|--------|--------|------|
| R4-1 | **OrderStatus V2/V3 CHECK 불일치** — V2(`APPLIED` 등) ≠ V3(`RECEIVED` 등) | HIGH | Phase 2 전략 유지: repo에서 V2 값 직접 전달, 서비스에서 V2 상태값 사용. DB CHECK ALTER는 별도 마이그레이션 |
| R4-2 | **Consignment 상태머신 복잡도** — 7상태 × 부수효과 (st_products/orders 생성) | HIGH | `transitionStatus()`에 switch-case, 부수효과는 개별 private 함수로 분리. completeConsignment은 별도 함수(~50줄) |
| R4-3 | **Commission 중복 계산 제거** — V2의 queue-settlements 인라인 공식 | MEDIUM | V3에서는 반드시 `calculateSettlement()` 단일 소스 호출. 인라인 공식 금지 |
| R4-4 | **SoldItem V2/V3 구조 불일치** — V2는 Naver 기반, V3는 주문 기반 | HIGH | Phase 2 mapRow 유지. 서비스에서 commission/payout 계산 보강 |
| R4-5 | **photo.service 외부 API 의존** — Claude Vision, HEIC 변환 | MEDIUM | 429 처리 필수 (BatchResult partial), 타임아웃 15초, MAX_VISUAL_CALLS=10 캡 유지 |
| R4-6 | **KST 경계 문제** — settlement period UTC vs KST | MEDIUM | phase1-risk-report RISK-05 대응: `toKSTStartOfDay`/`toKSTEndOfDay` 사용 필수 |
| R4-7 | **셀러 생성 동시성** — NF001 코드 순차 생성 | LOW | DB UNIQUE + retry 패턴 |

---

## 5. 실행 계획

### 5.1 순서

```
Phase 3 (먼저, 순차 — 4개 파일 + 1개 수정)
  3-1. lib/api/errors.ts — AppError 클래스
  3-2. lib/api/response.ts — ok(), err(), validationErr()
  3-3. lib/api/middleware.ts — requireAdmin()
  3-4. middleware.ts — Next.js 경로 분기 + CORS
  3-5. lib/auth.ts 수정 — hashPassword(bcrypt cost=12)
  3-6. 테스트 + 게이트 검증

Phase 4 (이후, 3-Stream 병렬 가능)
  Stream A: order.service + consignment.service + product.service
  Stream B: settlement.service + matching.service + sale-detector.service
  Stream C: notification.service + photo.service + seller.service
  → 단위 테스트 → 게이트 검증 → 커밋
```

### 5.2 팀 구성 (Phase 3+4 합산)

```
Phase 3 (1팀, 순차):
  CTO Lead → 4개 파일 순차 생성 + auth.ts 수정

Phase 4 (3팀, 병렬):
  Stream A (Core):    order.service → consignment.service → product.service
  Stream B (Finance): settlement.service → matching.service → sale-detector.service
  Stream C (Support): notification.service → photo.service → seller.service
```

### 5.3 Phase 2 산출물 재사용

| Phase 2 파일 | Phase 4 사용처 |
|-------------|---------------|
| `sellers.repo.ts` | seller.service, settlement.service |
| `orders.repo.ts` | order.service, consignment.service |
| `products.repo.ts` | product.service, photo.service |
| `settlement.repo.ts` | settlement.service, matching.service |
| `sales-records.repo.ts` | sale-detector.service, matching.service |
| `naver-settlements.repo.ts` | matching.service |
| `consignments.repo.ts` | consignment.service |
| `notifications.repo.ts` | notification.service |
| `batch.repo.ts` | photo.service |
| `settlement.tx.ts` | settlement.service |
| `order.tx.ts` | order.service |
| `consignment.tx.ts` | consignment.service |

---

## 6. 검증 게이트

### 6.1 Phase 3 게이트

| # | 항목 | 명령어 | 기대 |
|---|------|--------|------|
| G3-1 | tsc strict | `npx tsc --strict --noEmit` | 0 errors |
| G3-2 | bcrypt cost=12 | `grep "BCRYPT_COST.*12" lib/auth.ts` | 1+ match |
| G3-3 | requireAdmin 존재 | `grep "requireAdmin" lib/api/middleware.ts` | 1+ match |
| G3-4 | AppError 존재 | `grep "AppError" lib/api/errors.ts` | 1+ match |
| G3-5 | ok/err 존재 | `grep "export function ok\|export function err" lib/api/response.ts` | 2+ match |
| G3-6 | CORS 설정 | `grep "Access-Control" middleware.ts` | 1+ match |
| G3-7 | vitest | `npx vitest run` | 0 failures |

### 6.2 Phase 4 게이트

| # | 항목 | 명령어 | 기대 |
|---|------|--------|------|
| G4-1 | tsc strict | `npx tsc --strict --noEmit` | 0 errors |
| G4-2 | eslint | `npx eslint --max-warnings 0` | 0 warnings |
| G4-3 | vitest | `npx vitest run` | 0 failures |
| G4-4 | NextRequest 금지 | `grep -r "NextRequest\|NextResponse" lib/services/` | 0 matches |
| G4-5 | DB 직접 접근 금지 | `grep -r "supabase\.\|\.from(" lib/services/` | 0 matches |
| G4-6 | 서비스 150줄 | `wc -l lib/services/*.ts` | 전부 ≤150 |
| G4-7 | partial 처리 | `grep "partial\|failedIds" lib/services/photo.service.ts` | 존재 |
| G4-8 | ALLOWED_TRANSITIONS | `grep "ALLOWED_TRANSITIONS" lib/services/consignment.service.ts` | 존재 |
| G4-9 | commission 단일 소스 | `grep -r "Math.round.*commission\|commissionRate" lib/services/` + 확인: settlement-calculator.ts 호출만 | 인라인 계산 0건 |
| G4-10 | WHY/HOW/WHERE 헤더 | 전 9개 서비스 파일 확인 | 전부 존재 |

---

## 7. 의사결정 기록

| 결정 | 선택 | 근거 |
|------|------|------|
| V2 평문 비번 → V3 | bcrypt cost=12 | plan5 §6.1 명시. OWASP 요구 |
| V2 무인증 admin API → V3 | requireAdmin + middleware.ts | V2 최대 취약점. phase-checklists Phase 3 MUST |
| V2 4가지 응답 형식 → V3 | `ok()/err()` 표준화 | plan5 §7.3 + §8.2.1 명시 |
| V2 무검증 주문상태 → V3 | 서비스에서 상태 전이 검증 추가 | architecture-spec Article 4.1: 상태전이는 서비스에서만 |
| V2 commission 인라인 중복 → V3 | settlement-calculator.ts 단일 소스 강제 | phase-checklists Phase 1 MUST: COMMISSION_RATES 단일 소스 |
| V2 N+1 product 쿼리 → V3 | 단일 쿼리 최적화 | 구조 개선 |
| V2 셀러 부수효과 생성 → V3 | seller.service.findOrCreateSeller() 분리 | agent-ops-guide §5: 서비스 오케스트레이션 |
| V2 photos/match/services → V3 | photo.service.ts로 통합 재구성 | BatchResult 패턴 필수 (plan5 §7.2) |
| OrderStatus V2/V3 불일치 | Phase 2 전략 유지 (V2 값 직접 전달) | DB CHECK ALTER는 별도 마이그레이션 |
| 정산 2중 플로우 | 둘 다 지원 | V2 운영 중 데이터 호환 필수 |

---

## 부록 A: V2 파일 참조 목록

### 인증

- `classic-menswear-v2/lib/auth.ts` — HMAC-SHA256 signSession/verifySession
- `classic-menswear-v2/lib/ratelimit.ts` — Upstash Redis 3개 limiter
- `classic-menswear-v2/lib/env.ts` — ADMIN_ID, ADMIN_PASSWORD, SESSION_SECRET
- `classic-menswear-v2/app/api/admin/auth/login/route.ts` — 평문 비교 + 쿠키 설정
- `classic-menswear-v2/app/api/admin/auth/logout/route.ts` — 쿠키 삭제
- `classic-menswear-v2/proxy.ts` — 데드코드 (middleware 의도, 미연결)

### 서비스/비즈니스 로직

- `classic-menswear-v2/app/api/admin/photos/match/services/` — 유일한 서비스 (6파일)
- `classic-menswear-v2/lib/settlement/settlement-calculator.ts` — commission 계산 정규 소스
- `classic-menswear-v2/lib/settlement/product-matcher.ts` — 3단계 자동매칭
- `classic-menswear-v2/lib/settlement/product-classifier.ts` — 위탁 분류
- `classic-menswear-v2/lib/settlement/seller-matcher.ts` — 셀러 이름 매칭
- `classic-menswear-v2/lib/settlement/helpers.ts` — 정산 기간 계산

### Fat Routes (비즈니스 로직 추출 대상)

- `classic-menswear-v2/app/api/admin/orders/route.ts` — 220줄, 주문번호 생성 인라인
- `classic-menswear-v2/app/api/admin/consignments/route.ts` — 358줄, Excel 업로드
- `classic-menswear-v2/app/api/admin/consignments/[id]/route.ts` — 상태머신 + 부수효과
- `classic-menswear-v2/app/api/admin/products/route.ts` — 126줄, N+1 쿼리
- `classic-menswear-v2/app/api/settlement/generate/route.ts` — 163줄, 정산 생성
- `classic-menswear-v2/app/api/settlement/queue-settlements/route.ts` — 큐 등록 + 3차 방어
- `classic-menswear-v2/app/api/settlement/auto-match/route.ts` — 자동매칭

### 정산 라우트 (18개 파일, ~25 엔드포인트)

- `settlement/generate/route.ts` — OLD: 정산 생성
- `settlement/confirm/[id]/route.ts` — OLD: pending→confirmed
- `settlement/pay/[id]/route.ts` — OLD: confirmed→paid
- `settlement/list/route.ts` — 목록 조회
- `settlement/detail/[id]/route.ts` — 상세 조회
- `settlement/sellers/route.ts` — 셀러 목록
- `settlement/upload-sales/route.ts` — OLD: 판매내역 업로드
- `settlement/upload-confirm/route.ts` — OLD: 구매확정 업로드
- `settlement/upload-sales-ledger/route.ts` — NEW: 매출장부 업로드
- `settlement/upload-naver-settle/route.ts` — NEW: 네이버 정산 업로드
- `settlement/auto-match/route.ts` — NEW: 자동매칭
- `settlement/manual-match/route.ts` — NEW: 수동매칭
- `settlement/queue-settlements/route.ts` — NEW: 큐 등록
- `settlement/generate-payout/route.ts` — NEW: 지급서 생성
- `settlement/review-report/route.ts` — NEW: 검증 리포트
- `settlement/export/settlement-list/[id]/route.ts` — 엑셀 내보내기
- `settlement/export/sales-ledger/route.ts` — 엑셀 내보내기
- `settlement/export/mismatch-report/route.ts` — 불일치 리포트
