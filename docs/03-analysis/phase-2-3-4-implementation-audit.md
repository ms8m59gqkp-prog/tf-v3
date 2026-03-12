# Phase 2/3/4 구현 전수조사 보고서

**작성일**: 2026-03-12
**목적**: Phase 2(Repository), Phase 3(Middleware/Auth), Phase 4(Service) 구현 내용의 상세 문서화
**용도**: 이후 해당 Phase 삭제/재작성 여부 판단 기준 자료

---

## 1. 전체 요약

| Phase | 역할 | 파일 수 | 총 라인 | 상태 |
|-------|------|---------|---------|------|
| Phase 1 (타입) | 도메인 타입 + 상수 | 7 | 488 | ✅ 완료 |
| Phase 2 (데이터) | Repository + Transaction | 27 | 2,260 | ⚠️ 설계 15→27 팽창 |
| Phase 3 (미들웨어) | Auth + Error + API | 6 | 289 | ⚠️ proxy.ts 미구현 |
| Phase 4 (서비스) | Service + Calc + Gateway + Util | 14 | 1,351 | ⚠️ Plan5 괴리 |
| **합계** | | **54** | **4,388** | |

---

## 2. Phase 1 — 도메인 타입 (참조용)

### 2.1 파일 목록

| 파일 | 라인 | export 개수 |
|------|------|-------------|
| `lib/types/domain/seller.ts` | 57 | Seller(27필드), SellerTier(5값), SellerStatus(3값), SELLER_TIERS, SELLER_STATUSES |
| `lib/types/domain/consignment.ts` | 57 | ConsignmentRequest(24필드), ConsignmentStatus(7값), ALLOWED_TRANSITIONS, ConsignmentSource(6값) |
| `lib/types/domain/order.ts` | 86 | Order(18필드), OrderItem(18+필드), OrderStatus(10값), ORDER_TRANSITIONS, SalesChannel(4값) |
| `lib/types/domain/product.ts` | 57 | StProduct(37필드), ProductCondition(5값), ListingStatus(5값), ProductCategory(13값) |
| `lib/types/domain/settlement.ts` | 165 | Settlement(18필드), SoldItem(20필드), SalesRecord(19필드), NaverSettlement(13필드), SettlementMatch, SellerSettlementSummary, SETTLEMENT_TRANSITIONS |
| `lib/types/domain/notification.ts` | 37 | Notification(10필드), NotificationType(7값), NotificationChannel(3값) |
| `lib/types/domain/photo.ts` | 29 | PhotoSession(7필드), PhotoResult(5필드) |

**총계**: 7파일, 488줄, 18 export interfaces, 15 union types, 27 constant sets, ~280+ 필드

---

## 3. Phase 2 — Repository + Transaction 레이어

### 3.1 공통 인프라

| 파일 | 라인 | 역할 |
|------|------|------|
| `lib/db/types.ts` | 46 | DbResult<T>, PageOptions, BulkResult<T> 타입 정의 |

**DbResult 패턴**: 모든 repo 함수가 반환하는 표준 타입
```typescript
type DbResult<T> = { data: T; error: null } | { data: null; error: string }
```

### 3.2 Repository 파일 상세 (24개)

#### 셀러 도메인 (3개, 201줄)

| 파일 | 라인 | 함수 | 비고 |
|------|------|------|------|
| `sellers.repo.ts` | 120 | findById, findOrCreate, listActive, update | RPC: generate_seller_code |
| `sellers-query.repo.ts` | 46 | list(filters, page) | PostgREST 필터링+페이지네이션 |
| `sellers-batch.repo.ts` | 35 | findByPhones(phones[]) | 배치 조회 |

#### 위탁 도메인 (3개, 278줄)

| 파일 | 라인 | 함수 | 비고 |
|------|------|------|------|
| `consignments.repo.ts` | 111 | findById, create, generateProductNumber | COLUMNS 28컬럼 명시, mapRow+mapJoinRow, RPC: generate_product_number |
| `consignments-query.repo.ts` | 72 | list(filters, page), updateStatus, batchDelete | JOIN_COLUMNS 재사용 |
| `consignments-bulk.repo.ts` | 95 | bulkCreate(mapped[]) | BulkResult 반환, 행별 에러 추적 |

#### 주문 도메인 (2개, 163줄)

| 파일 | 라인 | 함수 | 비고 |
|------|------|------|------|
| `orders.repo.ts` | 119 | findById, list(filters, page), COLUMNS/mapRow export | ORDER_ITEM_COLUMNS 포함 |
| `orders-mutation.repo.ts` | 44 | create, updateStatus | optimistic lock |

#### 상품 도메인 (2개, 210줄)

| 파일 | 라인 | 함수 | 비고 |
|------|------|------|------|
| `products.repo.ts` | 113 | findById, create, update, COLUMNS/mapRow export | PRODUCT_COLUMNS 37필드, Number() 변환 |
| `products-query.repo.ts` | 97 | list(filters, page), search(query) | ilike 검색 |

#### 매출/정산 도메인 (8개, 689줄)

| 파일 | 라인 | 함수 | 비고 |
|------|------|------|------|
| `sales-records.repo.ts` | 111 | findById, create, bulkCreate | COLUMNS 명시 |
| `sales-records-query.repo.ts` | 47 | listUnmatched, updateMatchStatus | 매칭용 |
| `naver-settlements.repo.ts` | 82 | findById, create, bulkCreate | COLUMNS 명시 |
| `naver-settlements-query.repo.ts` | 43 | listUnmatched, updateMatchStatus | 매칭용 |
| `settlement.repo.ts` | 126 | findById, list(filters, page), COLUMNS/mapRow export | **⚠️ 120줄 초과 (126줄)** |
| `settlement-status.repo.ts` | 109 | confirm, pay, updateStatus, createWithItems, fail | RPC: create_settlement_with_items, fail_settlement |
| `settlement-matches.repo.ts` | 78 | create, findByMatchIds, deleteByIds | 매칭 CRUD |
| `settlement-queue.repo.ts` | 141 | listByStatus, getSellerSummary, create, deleteByStatus | **⚠️ 120줄 초과 (141줄)** |

#### 판매기록 도메인 (1개, 112줄)

| 파일 | 라인 | 함수 | 비고 |
|------|------|------|------|
| `sold-items.repo.ts` | 112 | findById, listPending, create, bulkCreate | COLUMNS 명시 |

#### 알림 도메인 (2개, 140줄)

| 파일 | 라인 | 함수 | 비고 |
|------|------|------|------|
| `notifications.repo.ts` | 74 | findById, create, markAsRead | COLUMNS 명시 |
| `notifications-query.repo.ts` | 66 | list(filters, page), countUnread | 필터+페이지네이션 |

#### 배치 업로드 도메인 (3개, 165줄)

| 파일 | 라인 | 함수 | 비고 |
|------|------|------|------|
| `batch.repo.ts` | 71 | findById, create, updateStatus | 배치 작업 |
| `batch-uploads.repo.ts` | 41 | create, findByBatchId | 업로드 파일 기록 |
| `batch-progress.repo.ts` | 83 | upsert, findByBatchId, updateProgress | 진행률 추적 |

### 3.3 Transaction 파일 (3개, 178줄)

| 파일 | 라인 | 함수 | 비고 |
|------|------|------|------|
| `consignment.tx.ts` | 68 | approveWithProduct(id) | 위탁승인+상품생성 원자적 |
| `order.tx.ts` | 63 | createWithItems(order, items[]) | 주문+항목 원자적 생성 |
| `settlement.tx.ts` | 47 | createWithItems(settlement, soldItemIds[]) | 정산+항목 원자적 생성 |

### 3.4 Phase 2 공통 패턴

1. **COLUMNS 명시 선언** — 모든 repo가 `const COLUMNS = \`id, col1, col2, ...\`` 형태로 SELECT 컬럼 명시 (SELECT * 금지)
2. **mapRow 함수** — snake_case → camelCase 변환, `Number()` 래핑 (NUMERIC 필드), `?? null` 널 안전성
3. **DbResult<T> 반환** — 성공: `{ data: T, error: null }`, 실패: `{ data: null, error: string }`
4. **createAdminClient()** — 모든 repo에서 서비스 롤 클라이언트 사용
5. **분할 패턴** — 도메인별 base.repo + query.repo + mutation.repo 분리 (120줄 제한 준수)

### 3.5 Phase 2 위반/이슈

| 이슈 | 파일 | 내용 |
|------|------|------|
| 줄수 초과 | `settlement.repo.ts` | 126줄 (제한 120) |
| 줄수 초과 | `settlement-queue.repo.ts` | 141줄 (제한 120) |
| 설계 팽창 | 전체 | 원래 설계 15개 → 실제 27개 (24 repo + 3 tx) |
| RPC 직접 호출 | 4개 파일 | `generate_seller_code`, `generate_product_number`, `create_settlement_with_items`, `fail_settlement` |

---

## 4. Phase 3 — Middleware + Auth 레이어

### 4.1 파일 상세 (6개, 289줄)

| 파일 | 라인 | 역할 | 주요 export |
|------|------|------|-------------|
| `lib/errors.ts` | 20 | 에러 코드 + AppError 클래스 | ErrorCode(9값), AppError |
| `lib/api/errors.ts` | 23 | HTTP 상태 매핑 | HTTP_STATUS 맵, re-export AppError |
| `lib/api/response.ts` | 62 | 표준 응답 빌더 | success(), error(), paginated(), fromDbResult(), withAuth() |
| `lib/api/middleware.ts` | 42 | 미들웨어 체인 | withMiddleware(handler, ...middlewares) |
| `lib/auth.ts` | 78 | 인증 (세션 기반) | login(), logout(), getSession(), requireAuth() |
| `lib/ratelimit.ts` | 49 | 요청 제한 | rateLimit(key, limit, windowMs) |
| `lib/env.ts` | 35 | 환경변수 검증 | getEnv(key), requireEnv(key) |

### 4.2 인증 구현 상세

```
인증 흐름:
1. POST /api/auth/login → bcrypt(cost=12) 비밀번호 검증 → 세션 ID 생성 → in-memory Map 저장
2. 요청마다 Authorization: Bearer {sessionId} → getSession() → 24시간 TTL 검증
3. POST /api/auth/logout → 세션 삭제
```

- **세션 저장소**: `Map<string, { userId, role, expiresAt }>` (서버 메모리)
- **TTL**: 24시간
- **비밀번호**: bcrypt cost=12

### 4.3 에러 코드 → HTTP 매핑

| ErrorCode | HTTP Status | 용도 |
|-----------|-------------|------|
| VALIDATION | 400 | 입력값 검증 실패 |
| UNAUTHORIZED | 401 | 미인증 |
| FORBIDDEN | 403 | 권한 없음 |
| NOT_FOUND | 404 | 리소스 없음 |
| CONFLICT | 409 | 상태 충돌 |
| RATE_LIMITED | 429 | 요청 제한 |
| INTERNAL | 500 | 서버 내부 오류 |
| EXTERNAL | 502 | 외부 서비스 오류 |
| TIMEOUT | 504 | 타임아웃 |

### 4.4 API 응답 패턴

```typescript
// 성공
success(data) → { success: true, data }
// 에러
error(code, message) → { success: false, error: { code, message } }
// 페이지네이션
paginated(items, total, page, pageSize) → { success: true, data: items, pagination: { page, pageSize, total, totalPages } }
// DbResult → Response 변환
fromDbResult(result) → success | error 자동 변환
// 인증 래퍼
withAuth(handler) → 인증 검증 후 handler 실행
```

### 4.5 API 라우트 (2개)

| 경로 | 라인 | 메서드 | 역할 |
|------|------|--------|------|
| `app/api/auth/login/route.ts` | 35 | POST | 로그인 (bcrypt 검증 → 세션 생성) |
| `app/api/auth/logout/route.ts` | 22 | POST | 로그아웃 (세션 삭제) |

### 4.6 Phase 3 미구현 항목

| 항목 | 상태 | Plan5 사양 |
|------|------|-----------|
| `lib/api/proxy.ts` | ❌ 미구현 | 외부 API 프록시 래퍼 |
| `middleware.ts` (root) | ❌ 미구현 | Next.js 루트 미들웨어 (인증 체크) |
| Supabase Auth 연동 | ❌ 미구현 | Plan5는 Supabase Auth 기반 설계 |

### 4.7 Phase 3 아키텍처 이슈

- **in-memory 세션**: 서버 재시작 시 모든 세션 소멸, 수평 확장 불가
- **Plan5와 괴리**: Plan5는 Supabase Auth 기반이지만 현재는 bcrypt + in-memory Map

---

## 5. Phase 4 — Service + Calculator + Gateway + Utility 레이어

### 5.1 서비스 파일 (8개, 930줄)

| 파일 | 라인 | 역할 | 주요 함수 |
|------|------|------|-----------|
| `consignment.service.ts` | 143 | 위탁 접수/검수/승인 | list, getById, bulkCreate, updateStatus, approveConsignment, batchDelete |
| `settlement.service.ts` | 143 | 정산 생성/확정/지급 | generate, confirm, pay, list, getById |
| `matching.service.ts` | 150 | 매출-정산 매칭 | autoMatch(3단계), manualMatch, cancelMatch, queueSettlements, getQueueSummary, clearQueue |
| `photo.service.ts` | 144 | 상품 사진 촬영 | createSession, processImage(Claude Vision), getResult |
| `sales.service.ts` | 114 | 매출 관리 | importRecords(Excel파싱), list, getById, importNaverSettlements |
| `product.service.ts` | 84 | 상품 관리 | create, update, list, getById, classify(AI분류) |
| `notification.service.ts` | 79 | SMS 알림 | send(Aligo SMS), list, countUnread, markAsRead |
| `order.service.ts` | 73 | 주문 관리 | create, updateStatus, list, getById |

### 5.2 Calculator (2개, 131줄)

| 파일 | 라인 | 역할 |
|------|------|------|
| `settlement.calc.ts` | 71 | 정산 계산 (수수료, 반품차감, 순정산액) |
| `price-estimator.calc.ts` | 60 | 가격 추정 (시세 기반 예상 판매가) |

### 5.3 Gateway (2개, 212줄)

| 파일 | 라인 | 역할 |
|------|------|------|
| `lib/gateway/claude-vision.ts` | 120 | Claude Vision API 호출 (상품 사진 분석) |
| `lib/aligo/sms.ts` | 92 | Aligo SMS API 호출 (알림 발송) |

### 5.4 Utility (2개, 78줄)

| 파일 | 라인 | 역할 |
|------|------|------|
| `lib/utils/product-classifier.ts` | 39 | 상품명 → 카테고리 분류 (키워드 기반) |
| `lib/utils/seller-matcher.ts` | 39 | 셀러명 퍼지 매칭 (유사도 비교) |

### 5.5 서비스별 상세 비즈니스 로직

#### settlement.service.ts — 정산 워크플로우

```
generate(periodStart, periodEnd):
  1. 활성 셀러 전체 조회
  2. 동일 기간 기존 정산 존재 확인 (P0-1 중복방지)
  3. 셀러별 루프:
     - 미정산 판매기록(soldItems) 조회
     - calculateSettlement() 호출 (수수료 계산)
     - createWithItems() RPC 호출 (원자적 생성)
  4. 실패 셀러는 failedSellers 배열에 기록 (P0-3)

confirm(id): draft → confirmed (SETTLEMENT_TRANSITIONS 검증)
pay(id, paidBy, transferRef): confirmed → paid
```

#### matching.service.ts — 3단계 자동 매칭

```
autoMatch():
  1. 미매칭 매출장 + 미매칭 네이버정산 조회
  2. 청크 500건씩 matchPair() 실행:
     Step 1: 상품주문번호 완전일치 (16자리+) → score 1.0
     Step 2: 구매자명+금액 완전일치 → score 0.9
     Step 3: 상품명 자카드 유사도 ≥ 0.70 → score = 유사도
  3. persistMatch() — 보상 트랜잭션 (3단계 롤백):
     ① 매칭 저장 → ② 매출장 상태 갱신 → ③ 네이버 상태 갱신
     실패 시 역순 롤백
  4. score ≥ 0.85 → auto_matched, 0.70~0.85 → manual_matched(리뷰 필요)
```

#### consignment.service.ts — 위탁 워크플로우

```
bulkCreate(rows[]):
  1. 전화번호 정규화 + 배치 셀러 조회
  2. 미등록 셀러 → findOrCreate 자동 생성
  3. consignmentsBulkRepo.bulkCreate() 행별 에러 추적

updateStatus(id, newStatus, extra):
  - 'approved' 직접 전환 차단 (P0-5) → approveConsignment() 사용 필수
  - camelCase → snake_case 키 변환 (EXTRA_KEY_MAP)

approveConsignment(id):
  1. 현재 상태 확인 (inspecting/pending만 허용)
  2. RPC generate_product_number() 채번
  3. updateStatus('approved', { product_number, approved_at })
```

#### photo.service.ts — AI 사진 처리

```
processImage(sessionId, imageUrl):
  1. Claude Vision API 호출 (상품 분석)
  2. 응답 파싱: 카테고리, 브랜드, 상태, 측정값
  3. 결과 저장 + 세션 상태 갱신
```

#### notification.service.ts — SMS 발송 (soft-fail 패턴)

```
send(to, template, params):
  1. 템플릿 렌더링
  2. Aligo SMS API 호출
  3. 실패 시 throw 대신 { sent: false, error } 반환 (D-11 패턴)
  4. 알림 기록 DB 저장
```

### 5.6 Phase 4 의존성 맵

```
[L1 Service Layer]
  consignment.service → consignments.repo, consignments-query.repo, consignments-bulk.repo, sellers.repo, sellers-batch.repo
  settlement.service  → settlement.repo, settlement-status.repo, sold-items.repo, sellers.repo, settlement.calc
  matching.service    → sales-records-query.repo, naver-settlements-query.repo, settlement-matches.repo, settlement-queue.repo
  sales.service       → sales-records.repo, naver-settlements.repo
  product.service     → products.repo, products-query.repo, product-classifier
  order.service       → orders.repo, orders-mutation.repo
  notification.service → notifications.repo, aligo/sms
  photo.service       → gateway/claude-vision

[L0 Calculator]
  settlement.calc     → (순수 함수, 외부 의존 없음)
  price-estimator.calc → (순수 함수, 외부 의존 없음)

[L0 Gateway]
  claude-vision       → fetch (Claude API)
  aligo/sms           → fetch (Aligo API)
```

### 5.7 Phase 4 위반/이슈

| 이슈 | 파일 | 내용 |
|------|------|------|
| Plan5 API 괴리 | 전체 | Plan5 63개 API route 중 2개만 구현 (login, logout) |
| Plan5 UI 괴리 | 전체 | Plan5 17개 페이지 중 0개 구현 |
| 세션 업로드 미구현 | photo.service | Plan5 세션 기반 업로드 패턴 미적용 |
| 줄수 경계 | matching.service | 정확히 150줄 (service 제한 150) |

---

## 6. RPC 호출 전체 목록

| RPC 함수명 | 호출 위치 | 역할 |
|------------|-----------|------|
| `generate_seller_code` | sellers.repo | 셀러 코드 자동 채번 |
| `generate_product_number` | consignments.repo | 상품 번호 자동 채번 |
| `create_settlement_with_items` | settlement-status.repo | 정산+항목 원자적 생성 |
| `fail_settlement` | settlement-status.repo | 정산 실패 처리 |

---

## 7. 아키텍처 레이어 준수 현황

### 7.1 레이어 구조

```
L3 (Entry)    → app/api/auth/login/route.ts, app/api/auth/logout/route.ts (2개)
L2 (UI)       → (없음)
L1 (Business) → lib/services/*.ts (8개), lib/calculators/*.ts (2개)
L0 (Infra)    → lib/db/repositories/*.ts (24개), lib/db/transactions/*.ts (3개)
                 lib/gateway/claude-vision.ts, lib/aligo/sms.ts
                 lib/api/*.ts, lib/auth.ts, lib/ratelimit.ts, lib/env.ts
```

### 7.2 의존 방향 검증

| 규칙 | 상태 | 근거 |
|------|------|------|
| L3→L1 허용 | ✅ | route.ts는 아직 2개뿐, 서비스 호출 없음 (auth 직접) |
| L1→L0 허용 | ✅ | 모든 service가 repo만 호출 |
| L0→L1 금지 | ✅ | repo에서 service import 없음 |
| L1에서 NextRequest/Response 금지 | ✅ | service에 HTTP 관련 코드 없음 |
| L1에서 DB 직접 호출 금지 | ✅ | service가 createAdminClient() 직접 호출하지 않음 |

### 7.3 줄수 제한 위반

| 규칙 | 위반 파일 | 현재/제한 |
|------|-----------|-----------|
| repo 120줄 | settlement.repo.ts | 126/120 |
| repo 120줄 | settlement-queue.repo.ts | 141/120 |
| service 150줄 | matching.service.ts | 150/150 (경계) |

---

## 8. Plan5 정합성 분석

### 8.1 Plan5 대비 구현 현황

| Plan5 사양 | 계획 | 구현 | 괴리율 |
|------------|------|------|--------|
| API Route (Tier 1) | 23개 | 2개 | 91% 미구현 |
| API Route (Tier 2) | 25개 | 0개 | 100% 미구현 |
| API Route (Tier 3) | 15개 | 0개 | 100% 미구현 |
| 페이지 | 17개 | 0개 | 100% 미구현 |
| Repository 파일 | ~15개 (설계) | 24개 | 60% 초과 |
| Service 파일 | 8개 | 8개 | ✅ 일치 |

### 8.2 Plan5에서 명시된 핵심 기능 vs 현재 상태

| 기능 | Plan5 명세 | 구현 여부 |
|------|-----------|-----------|
| 세션 기반 업로드 | ✅ 상세 명세 | ❌ 미구현 |
| 위탁 대량등록 | ✅ 상세 명세 | ✅ bulkCreate 구현 |
| 3단계 자동매칭 | ✅ 상세 명세 | ✅ autoMatch 구현 |
| 정산 일괄생성 | ✅ 상세 명세 | ✅ generate 구현 |
| 정산 상태전이 | ✅ 상세 명세 | ✅ confirm/pay 구현 |
| V2 워크플로우 | ✅ 전제 조건 | ⚠️ 부분적 (UI 없이 서비스만) |
| Supabase Auth | ✅ 전제 조건 | ❌ bcrypt+in-memory 대체 |
| Excel 파싱 | ✅ 상세 명세 | ✅ sales.service 구현 |
| Claude Vision | ✅ 상세 명세 | ✅ gateway 구현 |
| Aligo SMS | ✅ 상세 명세 | ✅ gateway 구현 |

---

## 9. Phase 2 역사적 경위

### 9.1 타임라인

```
commit c65b0b7 — Phase 2 완료 (13개 파일 최초 구현)
commit df90e59 — Phase 1 재구현 시 Phase 2 전체 삭제
commit 이후    — Phase 3/4 작업 중 필요한 repo를 개별 재생성
현재           — 24개 repo + 3개 tx = 27개 파일로 팽창
```

### 9.2 삭제-재생성 추적 불가 문제

- 원래 13개 파일 중 어떤 것이 유지되고 어떤 것이 새로 작성됐는지 git diff로 추적 불가
- Phase 3/4에서 "필요할 때 만들기" 방식으로 repo가 누적됨
- 설계 문서 대비 파일 수가 거의 2배 (15→27)

---

## 10. 삭제 판단 기준 제안

### 10.1 보존 가치가 높은 코드

| 구분 | 이유 |
|------|------|
| 도메인 타입 (Phase 1) | V2 DB 스키마와 1:1 매핑, 다른 모든 코드의 기반 |
| mapRow 패턴 | snake_case→camelCase 변환이 정확하며 재사용 가치 높음 |
| 비즈니스 로직 (정산계산, 3단계매칭) | V2 워크플로우 핵심 로직이 캡슐화됨 |
| Gateway (Claude Vision, Aligo SMS) | 외부 API 통합은 재작성 비용 높음 |
| Calculator (순수 함수) | 테스트 가능하고 의존 없음 |

### 10.2 재작성이 필요할 수 있는 코드

| 구분 | 이유 |
|------|------|
| in-memory 인증 | 프로덕션 부적합, Supabase Auth로 교체 필요 |
| settlement-queue.repo (141줄) | 120줄 초과, 분할 필요 |
| settlement.repo (126줄) | 120줄 초과, 분할 필요 |
| repo 파일 구조 | 설계 대비 2배 팽창, 네이밍 일관성 부족 |

### 10.3 삭제 시 영향 범위

- Phase 2 삭제 시: 서비스(Phase 4) 전체가 컴파일 불가
- Phase 3 삭제 시: API 라우트 전체 영향, 에러 처리 체계 붕괴
- Phase 4 삭제 시: L3(API route) 레이어에서 호출할 서비스 없음

---

*이 문서는 Phase 삭제/재작성 결정을 위한 근거 자료입니다.*
*모든 줄수는 2026-03-12 시점 기준입니다.*
