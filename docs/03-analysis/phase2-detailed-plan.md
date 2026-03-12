# Phase 2 상세 계획서

**작성일**: 2026-03-08 | **개정일**: 2026-03-09 (5회 시뮬레이션 기반 37건 수정)
**상태**: REIMPLEMENTATION PENDING — commit df90e59에서 Phase 2 전체 삭제됨. 본 문서는 재구현 설계 스펙으로 사용.
**기반**: V2 딥리서치 (5개 에이전트, V2 route.ts 16파일 + lib 12파일 전수 분석) + V3 Phase 1 레퍼런스 + Tokyo DB 스키마
**범위**: 리포지토리 레이어 + 트랜잭션 래퍼 + 벌크 처리 인프라
**검증**: 5회 딥 시뮬레이션 PASS (sellers.repo, settlement.tx, bulkCreate, order.tx, 통합 7단계)

---

## I. 설계 원칙

### V2 계승 (워크플로우/사용자 편의성)

| # | V2 워크플로우 | 계승 내용 |
|---|-------------|----------|
| W1 | 셀러 자동생성 | 위탁 접수 시 이름+전화번호 매칭 → 없으면 신규 생성 |
| W2 | 메모리 캐시 | 배치 처리 시 sellerByPhone Map으로 DB 쿼리 최소화 |
| W3 | 위탁 상태 전이 | ALLOWED_TRANSITIONS 기반 역방향 차단 |
| W4 | 2단계 상품 조회 | 페이지 결과 + 전체 상태별 집계 (summary) |
| W5 | 정산 계산 공식 | Math.round(totalSales * rate), rate 우선순위: 개별 > 티어 |
| W6 | 3단계 자동매칭 | 주문번호 → 구매자+금액 → Jaccard 유사도 |
| W7 | 복합 검색 | notifications: 전화+메시지+셀러명 OR 검색 |
| W8 | 배치 부분실패 | 성공 행 즉시 저장, 실패 행만 구조화 반환 → 인라인 수정 후 재전송 |

### V3 개선 (완성도/효율/보안/유지보수)

| # | V2 문제 | V3 해결 |
|---|---------|---------|
| I1 | route.ts에 쿼리 중복 (16파일) | 리포지토리 패턴: 도메인별 단일 파일 |
| I2 | 원자성 없음 (수동 delete 롤백) | DB RPC 트랜잭션 (create_order_with_items 등) |
| I3 | commission 계산 2곳 중복 | getCommissionRate() 단일 소스 (Phase 1) |
| I4 | 동시성 제어 없음 | FOR UPDATE + count 검증 (RPC 내장) |
| I5 | any 타입 DB 결과 | Phase 1 인터페이스 매핑 (mapRow) |
| I6 | 입력 검증 없음 | Zod 스키마 바운더리 검증 |
| I7 | 에러 문자열 배열 | 구조화된 에러 응답 (행번호 + 필드 + 원인 + 원본값) |
| I8 | 셀러 매칭 phone만 | 이름+전화번호 조합 매칭 (주소는 해싱 입력용) |

---

## II. 파일 구조 (15파일)

```
apps/web/lib/db/
├── client.ts                    # DB 클라이언트 래퍼
├── types.ts                     # 공용 타입 (DbResult, BulkResult, FailedRow)
├── repositories/
│   ├── sellers.repo.ts          # 셀러 핵심 CRUD + findOrCreate (≤120줄)
│   ├── sellers-query.repo.ts    # 셀러 조회 전용: listByPage, findByNameAndPhone (≤60줄)
│   ├── consignments.repo.ts     # 위탁 CRUD + 상태 전이
│   ├── orders.repo.ts           # 주문 CRUD
│   ├── products.repo.ts         # 상품 CRUD + 상태 필터 + 집계
│   ├── settlement.repo.ts       # 정산 CRUD
│   ├── sold-items.repo.ts       # 판매기록 CRUD + FOR UPDATE
│   ├── sales-records.repo.ts    # 매출장 벌크 INSERT
│   ├── naver-settlements.repo.ts # 구매확정 벌크 INSERT
│   ├── notifications.repo.ts    # 알림 CRUD + 복합 검색
│   └── batch.repo.ts            # _batch_progress + excel_uploads
└── transactions/
    ├── consignment.tx.ts        # complete_consignment RPC 래퍼
    ├── order.tx.ts              # create_order_with_items RPC 래퍼
    └── settlement.tx.ts         # create_settlement_with_items RPC 래퍼
```

> **[AV1] Architecture Spec §5.2**: 모든 repo의 SELECT에서 `*` 사용 금지. 명시적 COLUMNS 상수 선언 필수.
> **[Sim1] sellers.repo 분할**: mapRow(35줄) + 8메서드 = ~212줄 → 120줄 제한 초과 → sellers.repo.ts(핵심 CRUD) + sellers-query.repo.ts(조회) 분할.

---

## III. 공용 인프라

### client.ts — DB 클라이언트 래퍼

```typescript
/**
 * Supabase 쿼리 래퍼
 * WHY: 에러 핸들링 + 타입 매핑 일원화
 * HOW: createAdminClient() + DbResult<T> 래핑
 */

// 모든 리포지토리가 이 클라이언트를 사용
export function getClient() { return createAdminClient() }

// snake_case → camelCase 변환 유틸
export function toCamelCase(row: Record<string, unknown>): Record<string, unknown>
```

### types.ts — 공용 타입

```typescript
/**
 * 리포지토리 공용 타입
 * WHY: 일관된 반환 타입 + 벌크 처리 실패 구조화
 */

// 단일 결과
export type DbResult<T> = { data: T; error: null } | { data: null; error: string }

// 목록 결과 (페이지네이션)
export type DbListResult<T> = {
  data: T[]
  total: number
  error: null
} | { data: []; total: 0; error: string }

// 벌크 INSERT 결과 (배치 부분실패 지원)
export type BulkResult<T> = {
  succeeded: T[]
  failed: FailedRow[]
  total: number
}

// 실패 행 구조 (프론트에서 인라인 수정용)
export interface FailedRow {
  rowIndex: number          // 원본 엑셀 행 번호
  data: Record<string, unknown>  // 원본 데이터
  errors: FieldError[]      // 필드별 에러 목록
}

export interface FieldError {
  field: string             // 에러 필드명
  type: 'missing' | 'format' | 'duplicate' | 'fk_not_found' | 'constraint'
  message: string           // 사용자 표시용 메시지
  expected?: string         // 기대 형식 (예: "01012345678")
}

// 페이지네이션 옵션
export interface PageOptions {
  page: number
  pageSize: number
  sortBy?: string
  ascending?: boolean
}
```

---

## IV. 리포지토리 상세 설계

### 1. sellers.repo.ts + sellers-query.repo.ts

**V2 계승**: 전화번호 캐시, 자동생성, 이름 동기화
**V3 개선**: 이름+전화번호 조합 매칭, generate_seller_code RPC, 주소 저장
**분할 근거**: mapRow(35줄) + 8메서드 = ~212줄 → 120줄 제한 초과 (Architecture Spec §10.1)

```
COLUMNS = 'id, seller_code, name, phone, email, seller_tier, status,
  commission_rate, channel_type, bank_name, bank_account, bank_holder,
  bank_verified, address, created_at, updated_at,
  id_card_number, id_card_verified, id_card_file_url,
  contract_start, contract_end, tagging_code, nickname,
  marketing_consent, marketing_consent_at'
  // DDL 25컬럼 전체 — SELECT * 금지 (AV1)

sellers.repo.ts (≤120줄):
├── findById(id) → DbResult<Seller>
├── findByPhone(phone) → DbResult<Seller | null>
├── listActive() → DbResult<Seller[]>
├── create(input: CreateSellerInput) → DbResult<Seller>
│   └── generate_seller_code RPC 호출: supabase.rpc('generate_seller_code' as never, {...} as never)
├── update(id, fields) → DbResult<Seller>
└── findOrCreate(name, phone, address?) → DbResult<Seller>  # 자동생성 핵심
    ├── 1순위: findByPhone(phone) → 있으면 이름 다를 시 UPDATE name
    ├── 2순위: phone 없고 name만 있으면 → 동명이인 가능성으로 신규 생성
    ├── 신규: create({ name, phone, address, status: 'active' })
    └── [C2] Race Condition 대응: UNIQUE(phone) 23505 error 객체 검사 → findByPhone fallback

sellers-query.repo.ts (≤60줄):
├── findByNameAndPhone(name, phone) → DbResult<Seller | null>  # V3 신규
└── listByPage(options: PageOptions) → DbListResult<Seller>
```

> **[C2] findOrCreate Race Condition**: sellers UNIQUE(phone) 제약 존재 (02_constraints.sql L159-160).
> 동시 INSERT 시 23505 unique_violation → **error 객체 검사** → findByPhone fallback 패턴 적용.
> **주의**: supabase-js `.insert()`는 UNIQUE 위반 시 throw하지 않고 `{ data: null, error }` 객체를 반환한다.
> 따라서 try/catch가 아닌 error 객체 검사 패턴을 사용해야 한다.
> ```typescript
> // ❌ WRONG — supabase-js는 23505를 throw하지 않음:
> // try { INSERT } catch (e) { if (e.code === '23505') ... }
>
> // ✅ CORRECT — error 객체 검사 패턴:
> const { data, error } = await supabase.from('sellers').insert(input).select(COLUMNS).single()
> if (error) {
>   if (error.code === '23505' || error.message?.includes('unique')) {
>     return findByPhone(phone) // retry-after-conflict
>   }
>   return { data: null, error: error.message }
> }
> return { data: mapRow(data), error: null }
> ```

**셀러 매칭 로직 (findOrCreate)**:

| 입력 | phone 일치 셀러 존재? | 처리 |
|------|---------------------|------|
| name+phone | 있음, 이름 동일 | 기존 셀러 반환 |
| name+phone | 있음, 이름 다름 | 이름 UPDATE → 기존 셀러 반환 |
| name+phone | 없음 | 신규 생성 (seller_code RPC) |
| name만 (phone 없음) | — | 신규 생성 |
| phone만 (name 없음) | 있음 | 기존 셀러 반환 |
| phone만 (name 없음) | 없음 | 신규 생성 (name='미상') |

### 2. consignments.repo.ts

**V2 계승**: JOIN sellers+st_products, 상태 전이 검증, 배치 삭제, 중복 체크 (seller_id+product_name)
**V3 개선**: ALLOWED_TRANSITIONS 검증, 구조화된 벌크 결과

```
COLUMNS = 'id, seller_id, product_name, desired_price, product_condition,
  status, approved_at, product_id, source, memo, created_at, updated_at,
  image_url, applied_at, employee_purchase_date, privacy_consent,
  product_number, received_at, inspected_at, measurements, item_type,
  inspection_image, adjustment_token, adjustment_price, seller_response,
  seller_counter_price, origin, composition'
  // DDL 28컬럼 전체 — SELECT * 금지 (AV1)

JOIN_COLUMNS = COLUMNS + ', sellers(name, phone, seller_code, seller_tier),
  st_products(product_number)'

메서드:
├── findById(id) → DbResult<ConsignmentWithRelations>
├── list(filters, pageOptions) → DbListResult<ConsignmentWithRelations>
│   ├── filters: { status?, sellerId?, search? }
│   ├── 정렬: created_at DESC
│   └── JOIN: sellers, st_products (PostgREST FK 자동 JOIN)
├── create(input) → DbResult<ConsignmentRequest>
├── bulkCreate(rows[]) → BulkResult<ConsignmentRequest>  # 엑셀 대량 업로드
│   ├── 행 단위 검증 (Zod) → 실패 즉시 FailedRow로
│   ├── 중복 체크 (seller_id+product_name) → type: 'duplicate'
│   │   └── 1회 IN 쿼리 + 배치 내 seen Set (Sim3 검증)
│   ├── 성공 행만 INSERT
│   ├── DB 에러 23505 → FailedRow {type:'constraint'} (Sim3 검증)
│   └── 실패 행은 FailedRow[] 반환 (프론트 인라인 수정용)
├── updateStatus(id, newStatus, extraFields?) → DbResult<ConsignmentRequest>
│   └── ALLOWED_TRANSITIONS 검증 → 위반 시 에러
├── batchDelete(ids[]) → DbResult<number>
└── checkDuplicates(pairs: {sellerId, productName}[]) → Set<string>
    └── UNIQUE 제약: uq_consignment_seller_product (02_constraints.sql L130)
```

> **[AV2] 배치 오케스트레이션**: bulkCreate 내 검증+매칭+중복체크는 L1 Service 영역이나,
> Phase 2 스코프에서는 repo에 배치하고 Phase 3 Service 분리 시 리팩토링 예정.

**벌크 처리 플로우** (V2 계승 + V3 개선):

```
엑셀 rows[]
  ↓
[1] 행 단위 검증 (phone 형식, price 양수, 필수값)
  ↓ 실패 → FailedRow { rowIndex, data, errors: [{field, type:'missing'}] }
[2] 셀러 매칭/생성 (findOrCreate)
  ↓ 실패 → FailedRow { ..., errors: [{field:'phone', type:'fk_not_found'}] }
[3] 중복 체크 (seller_id+product_name)
  ↓ 중복 → FailedRow { ..., errors: [{field:'product_name', type:'duplicate'}] }
[4] INSERT (성공 행만)
  ↓ DB 에러 → FailedRow { ..., errors: [{type:'constraint', message: db.message}] }
[5] 반환: BulkResult { succeeded[], failed[], total }
```

### 3. orders.repo.ts

**V2 계승**: orders + order_items JOIN 조회, 상태/검수 업데이트
**V3 개선**: create_order_with_items RPC로 원자적 생성 (수동 롤백 제거)

```
ORDER_COLUMNS = 'id, order_number, customer_name, phone, address, postal_code,
  visit_date, arrival_date, box_qty, total_estimated, commission, final_payout,
  status, created_at, updated_at, seller_type, purchase_source,
  custom_commission_rate, hold_token'
  // DDL 19컬럼 전체 — SELECT * 금지 (AV1)

ORDER_ITEM_COLUMNS = 'id, order_id, product_number, brand, model, category,
  condition, estimated_price, final_price, status, image_url, created_at,
  customer_price, size, inspection_status, item_type, measurements,
  hold_adjusted_price, hold_reason, hold_photo_url, hold_date,
  customer_agreed, customer_agreed_at'
  // DDL 23컬럼 전체

메서드:
├── findById(id) → DbResult<OrderWithItems>
│   └── SELECT ORDER_COLUMNS, order_items(ORDER_ITEM_COLUMNS)
├── list(filters?, pageOptions?) → DbListResult<OrderWithItems>
│   └── 정렬: created_at DESC
├── updateStatus(id, status) → DbResult<Order>
│   └── ORDER_STATUSES CHECK (10값): APPLIED~CANCELLED
├── updateItem(itemId, fields) → DbResult<OrderItem>
│   └── V2 패턴: inspection_status, final_price, measurements,
│       hold_adjusted_price, hold_reason, customer_agreed 등
└── getItemsByOrderId(orderId) → DbResult<OrderItem[]>
```

**주문 생성은 order.tx.ts에서 처리** (RPC)

> **[NUMERIC] custom_commission_rate**: NUMERIC(5,4) → Supabase가 string으로 반환 가능 → `Number()` 변환 필수.

### 4. products.repo.ts

**V2 계승**: 5개 상태 필터 조합, 2단계 조회 (목록+집계), ILIKE 검색
**V3 개선**: 타입 안전 필터, 집계 쿼리 분리

```
COLUMNS = 'id, product_number, legacy_code, product_name, seller_id, sale_price,
  product_type, is_active, smart_store_registered, consignment_date,
  created_at, updated_at, brand, size, origin, material, measurements,
  naver_product_id, seller_payment, product_condition, unsellable_reason,
  sold_at, sold_amount, sales_record_id, buyer_name, reference_image,
  photos, photo_status, smartstore_status, smartstore_data, composition,
  category, retail_price, retail_price_source, retail_price_confidence, color'
  // DDL 36컬럼 전체 — SELECT * 금지 (AV1)

메서드:
├── findById(id) → DbResult<StProductWithSeller>
│   └── JOIN: sellers(name, phone, seller_tier)
├── list(filters, pageOptions) → DbListResult<StProductWithSeller>
│   ├── filters: { status?, sellerId?, search? }
│   ├── status 필터 (V2 계승):
│   │   ├── 'photo_pending' → photo_status IN ('pending','shooting')
│   │   ├── 'photo_done' → photo_status='completed' AND smartstore_status='draft'
│   │   ├── 'selling' → is_active=true AND sold_at IS NULL AND smartstore_status IN ('uploaded','selling')
│   │   ├── 'sold' → sold_at IS NOT NULL
│   │   └── 'inactive' → is_active=false
│   └── search: product_name OR product_number ILIKE
├── getSummary() → DbResult<ProductSummary>
│   └── V2 계승: 상태별 카운트 집계 (별도 쿼리)
├── update(id, fields) → DbResult<StProduct>
│   └── sale_price, is_active, photo_status, smartstore_status, photos 등
└── create(input) → DbResult<StProduct>
    └── 검수 완료 시 st_products 생성 (complete_consignment RPC에서도 처리)
```

### 5. settlement.repo.ts

**V2 계승**: JOIN sellers, 상태/기간/셀러 필터, read-validate-write 패턴
**V3 개선**: RPC 트랜잭션, confirmed_at 타임스탬프

```
SETTLEMENT_COLUMNS = 'id, seller_id, settlement_period_start, settlement_period_end,
  total_sales, commission_rate, commission_amount, return_deduction,
  settlement_amount, item_count, status, paid_at, paid_by,
  transfer_reference, created_at, confirmed_at'
  // DDL 16컬럼 전체 — SELECT * 금지 (AV1)

메서드:
├── findById(id) → DbResult<SettlementWithDetails>
│   └── JOIN: sellers + settlement_items → sold_items (V2 중첩 JOIN 계승)
├── list(filters, pageOptions) → DbListResult<SettlementWithSeller>
│   ├── filters: { status?, periodFrom?, periodTo?, sellerId? }
│   ├── JOIN: sellers(id, name, nickname, phone, bank_account, commission_rate, seller_tier, status)
│   └── 정렬: created_at DESC
├── confirm(id) → DbResult<Settlement>
│   └── read-validate-write: status='draft' 검증 → 'confirmed' + confirmed_at
├── pay(id, paidBy, transferReference?) → DbResult<Settlement>
│   └── status='confirmed' 검증 → 'paid' + paid_at + paid_by
└── updateStatus(id, status) → DbResult<Settlement>
```

**정산 생성은 settlement.tx.ts에서 처리** (RPC)

### 6. sold-items.repo.ts

**V2 계승**: purchase_confirmed + settlement_status + 기간 필터, upsert
**V3 개선**: FOR UPDATE 행 잠금 (RPC 내장)

```
COLUMNS = 'id, seller_id, channel, order_id, product_name, product_number,
  quantity, sale_price, shipping_fee, sold_at, purchase_confirmed,
  purchase_confirmed_at, settlement_status, settlement_id, return_processed,
  source_file, created_at, product_order_id, naver_product_id, product_code'
  // DDL 20컬럼 전체 — SELECT * 금지 (AV1)

메서드:
├── listPending(sellerId, periodStart, periodEnd) → DbResult<SoldItem[]>
│   └── settlement_status='pending' AND purchase_confirmed=true AND 기간 범위
├── upsertFromExcel(rows[]) → BulkResult<SoldItem>
│   └── onConflict: 'product_order_id', ignoreDuplicates: true
├── updateStatus(ids[], status) → DbResult<number>
│   └── settlement_status 갱신
└── findBySellerId(sellerId) → DbResult<SoldItem[]>
```

### 7. sales-records.repo.ts

**V2 계승**: 배치 INSERT, upload_batch 추적, match_status 필터
**V3 개선**: 구조화된 벌크 결과, upload_session_id 격리

```
COLUMNS = 'id, sale_date, buyer_name, naver_order_no, brand, product_name,
  product_code, product_number, original_price, discount_rate, sale_amount,
  quantity, final_amount, is_consignment, consignment_seller, match_status,
  upload_batch, created_at, upload_session_id'
  // DDL 19컬럼 전체 — SELECT * 금지 (AV1)
  // [NUMERIC] discount_rate: NUMERIC(5,4) → Number() 변환 필수

메서드:
├── bulkInsert(rows[], batchId, sessionId) → BulkResult<SalesRecord>
│   ├── 중복 체크 (sale_date+naver_order_no+buyer_name+product_name)
│   ├── 배치 INSERT 시도 → 23505 시 개별 INSERT fallback (V2 계승)
│   ├── 실패 행 구조화 반환
│   └── [D3] rowIndex 주의: spread로 생성된 객체는 indexOf -1 → Phase 3 Service에서 원본 Excel 행 인덱스 매핑 필요
├── listUnmatched(batchIds?) → DbResult<SalesRecord[]>
│   └── match_status='unmatched', upload_batch 필터
├── updateMatchStatus(ids[], status) → DbResult<number>
├── deleteBatch(batchId) → DbResult<number>
└── listByBatch(batchId) → DbResult<SalesRecord[]>
```

### 8. naver-settlements.repo.ts

**V2 계승**: 이전 배치 unmatched 자동 정리, product_order_no 중복 체크
**V3 개선**: 구조화된 벌크 결과

```
COLUMNS = 'id, order_no, product_order_no, category, product_name,
  buyer_name, settle_base_date, settle_scheduled_date, settle_amount,
  settle_status, match_status, upload_batch, created_at'
  // DDL 13컬럼 전체 — SELECT * 금지 (AV1)

메서드:
├── bulkInsert(rows[], batchId) → BulkResult<NaverSettlement>
│   ├── product_order_no 기존 건 체크
│   └── 신규만 INSERT, 중복은 FailedRow(type:'duplicate')
├── listUnmatched(batchId?) → DbResult<NaverSettlement[]>
├── updateMatchStatus(ids[], status) → DbResult<number>
├── deleteBatch(batchId) → DbResult<number>
└── cleanUnmatched() → DbResult<number>
    └── V2 계승: 이전 배치 unmatched 건 자동 삭제
```

### 9. notifications.repo.ts

**V2 계승**: 복합 OR 검색 (전화+메시지+셀러명), JOIN sellers+consignments
**V3 개선**: 타입 안전 필터

> **[D6] 시뮬레이션 미검증**: notifications.repo + batch.repo는 Sim 10에서 rate limit로 검증 미완료.
> 구현 시 DDL 컬럼 1:1 매핑 + mapRow 필드 교차 검증을 수동으로 수행할 것.

> **[AV3] `.or()` 금지**: Architecture Spec §5.2에 따라 `.or()` 대신 복합 검색은 조건별 분기 + 서브쿼리로 처리.

```
COLUMNS = 'id, consignment_id, seller_id, phone, message, trigger_event,
  channel, status, api_response, created_at'
  // DDL 10컬럼 전체 — SELECT * 금지 (AV1)

메서드:
├── create(input) → DbResult<NotificationLog>
├── list(filters, pageOptions) → DbListResult<NotificationLogWithRelations>
│   ├── filters: { status?, triggerEvent?, dateFrom?, dateTo?, search? }
│   ├── search 복합 검색 (V2 계승):
│   │   ├── 숫자 3자리+ → phone LIKE
│   │   ├── 텍스트 → message ILIKE
│   │   └── 셀러명 서브쿼리 → seller_id IN
│   ├── JOIN: sellers(name, phone, seller_code), consignment_requests(product_number, product_name)
│   └── 정렬: created_at DESC
└── findByConsignmentId(consignmentId) → DbResult<NotificationLog[]>
```

### 10. batch.repo.ts

**V2에 없었던 V3 신규**: _batch_progress + excel_uploads 테이블 활용

```
BATCH_COLUMNS = 'id, batch_id, total, completed, failed, failed_ids,
  status, created_at, updated_at'
  // _batch_progress DDL 9컬럼 전체

UPLOAD_COLUMNS = 'id, upload_type, file_name, file_url, uploaded_by,
  row_count, success_count, error_count, error_details,
  consignment_count, inventory_count, return_count, mismatch_count,
  status, created_at'
  // excel_uploads DDL 15컬럼 전체

메서드:
├── createProgress(batchId, total) → DbResult<BatchProgress>
│   └── status: 'running'
├── incrementCompleted(batchId) → DbResult<void>
├── incrementFailed(batchId, failedId) → DbResult<void>
│   └── failed_ids JSONB에 append
├── completeProgress(batchId) → DbResult<BatchProgress>
│   └── failed=0 → 'completed', failed<total → 'partial', else → 'failed'
├── getProgress(batchId) → DbResult<BatchProgress>
│   └── 프론트 폴링용
├── createUploadRecord(input) → DbResult<ExcelUpload>
│   └── upload_type, file_name, row_count 등
└── updateUploadResult(id, result) → DbResult<ExcelUpload>
    └── success_count, error_count, error_details(JSONB)
```

---

## V. 트랜잭션 래퍼 상세

### 1. consignment.tx.ts

**V2**: 위탁 승인 → st_products 생성 → orders 생성이 3개 순차 호출 (원자성 없음)
**V3**: complete_consignment RPC 1회 호출로 전부 처리

```
함수:
└── completeConsignment(params) → DbResult<{ productId, orderId? }>
    ├── RPC: complete_consignment(
    │     p_consignment_id, p_product_number, p_product_name,
    │     p_sale_price, p_seller_id, p_brand, p_category,
    │     p_condition, p_size, p_color, p_measurements,
    │     p_order_number?, p_customer_name?, p_customer_phone?
    │   )
    ├── 내부 처리 (원자적):
    │   1. consignment status='approved' 검증
    │   2. st_products INSERT
    │   3. orders + order_items INSERT (선택)
    │   4. consignment status → 'completed'
    └── 실패 시 전체 롤백 (DB 트랜잭션)
```

### 2. order.tx.ts

**V2**: orders INSERT → order_items INSERT → 실패 시 orders DELETE (수동 롤백)
**V3**: create_order_with_items RPC 1회 호출

```
함수:
└── createOrderWithItems(params) → DbResult<{ orderId: string }>
    ├── Step 1: RPC generate_order_number() → orderNumber (주문번호 사전 생성)
    ├── Step 2: RPC create_order_with_items(
    │     p_order_number, p_customer_name, p_customer_phone,
    │     p_status, p_items: jsonb   ← [H3] jsonb (NOT jsonb[]), supabase-js 자동 직렬화
    │   )
    ├── p_items 각 항목 (DDL 04_functions.sql L53-67 기준):
    │   { product_number, brand, model, category?, condition?,
    │     size?, measurements?, inspection_status?, customer_agreed? }
    │   ← [H6] estimated_price 제외 (RPC INSERT에 미포함, DDL DEFAULT 0)
    │   ← [H6] category, measurements, inspection_status, customer_agreed 추가
    ├── RPC 에러 처리:
    │   ├── P0001 (raise_exception): 아이템 누락, 빈 배열 등 → error.message 파싱
    │   └── 23505 (unique_violation): order_number 중복 → 재생성 또는 에러
    └── 원자적: orders + order_items 동시 생성 또는 전체 롤백
```

### 3. settlement.tx.ts

**V2**: settlements INSERT → settlement_items INSERT → sold_items UPDATE (3단계 순차, 원자성 없음)
**V3**: create_settlement_with_items RPC 1회 호출

```
함수:
└── createSettlement(params) → DbResult<{ settlementId: string }>
    ├── RPC: create_settlement_with_items(
    │     p_seller_id, p_period_start, p_period_end,
    │     p_total_sales, p_commission_rate, p_commission_amount,
    │     p_settlement_amount, p_sold_item_ids: uuid[]
    │   )
    ├── 내부 처리 (원자적):
    │   1. sold_items FOR UPDATE 행 잠금
    │      └── [C3] ORDER BY id 권장 (future-proofing, Sim2: B-tree 인덱스로 현재도 안전)
    │   2. 전원 'pending' 상태 검증 (count 일치)
    │      └── v_locked_count != v_expected_count → RAISE EXCEPTION
    │   3. settlements INSERT (status='draft', item_count=배열 길이)
    │   4. settlement_items INSERT (unnest 배열)
    │   5. sold_items settlement_status → 'settled'
    ├── RPC 에러 처리:
    │   └── P0001 (raise_exception): '잠금 실패: 예상 N건 중 M건만 pending'
    └── 실패 시 전체 롤백 + 행 잠금 해제
```

---

## VI. 벌크 처리 인프라 (V3 신규)

### 배치 부분실패 플로우

```
[프론트] 엑셀 업로드
    ↓
[API] repo.bulkCreate(rows)
    ↓
[리포지토리] 행 단위 처리:
    ├── 검증 통과 → INSERT 시도 → 성공 → succeeded[]
    ├── 검증 실패 → FailedRow { rowIndex, data, errors } → failed[]
    └── DB 에러 → FailedRow { ..., type:'constraint' } → failed[]
    ↓
[API] BulkResult { succeeded, failed, total } 반환
    ↓
[프론트] 결과 표시:
    ├── 3-Zone 카드: 성공(초록) / 실패(빨강) 카운터
    ├── 실패 행 테이블 (편집 가능)
    │   ├── 행번호 | 원본 데이터 | 에러 배지
    │   └── 에러 셀 하이라이트
    └── "재전송" 버튼 → failed 행만 수정 후 bulkCreate() 재호출
```

### FailedRow 예시

```json
{
  "rowIndex": 3,
  "data": { "name": "김철수", "phone": "", "product_name": "루이비통 가방", "price": 500000 },
  "errors": [
    { "field": "phone", "type": "missing", "message": "전화번호 필수", "expected": "01012345678" }
  ]
}
```

```json
{
  "rowIndex": 7,
  "data": { "name": "박영희", "phone": "01012345678", "product_name": "샤넬 백", "price": 300000 },
  "errors": [
    { "field": "product_name", "type": "duplicate", "message": "이미 등록된 위탁 (셀러+상품명 중복)" }
  ]
}
```

---

## VII. mapRow 패턴 (snake_case → camelCase)

각 리포지토리는 `mapRow()` 함수로 DB 결과를 Phase 1 인터페이스로 변환:

```typescript
// sellers.repo.ts 예시
function mapRow(row: Record<string, unknown>): Seller {
  return {
    id: row.id as string,
    sellerCode: row.seller_code as string,
    name: row.name as string,
    phone: row.phone as string,
    // ... 25 필드
  }
}
```

**규칙**:
- DB snake_case → TS camelCase 1:1 매핑
- nullable 필드: `(row.field as Type) ?? null`
- JSONB 필드: 그대로 전달 (measurements, photos, failed_ids 등)
- **[NUMERIC→Number 변환 필수]**: Supabase는 NUMERIC 타입을 string으로 반환할 수 있음
  | 테이블 | 컬럼 | 타입 | mapRow 처리 |
  |--------|------|------|------------|
  | sellers | commission_rate | NUMERIC | `Number(row.commission_rate)` |
  | orders | custom_commission_rate | NUMERIC(5,4) | `Number(row.custom_commission_rate)` |
  | sales_records | discount_rate | NUMERIC(5,4) | `Number(row.discount_rate)` |
  | st_products | retail_price_confidence | NUMERIC(3,2) | `Number(row.retail_price_confidence)` |

---

## VIII. MUST 검증 게이트

| # | 게이트 | 기준 | 검증 방법 |
|---|--------|------|----------|
| M1 | tsc --noEmit | 에러 0건 | CI |
| M2 | vitest run | 전체 PASS | CI |
| M3 | any 사용 0건 | grep 'any' 0건 (테스트 제외) | grep |
| M4 | 모든 repo 메서드 → Phase 1 타입 반환 | DbResult<Seller> 등 | 코드 리뷰 |
| M5 | 트랜잭션 → RPC 호출만 | 앱 레벨 순차 INSERT+롤백 0건 | grep |
| M6 | commission 계산 → getCommissionRate() 호출만 | 인라인 계산 0건 | grep |
| M7 | 벌크 메서드 → BulkResult 반환 | FailedRow 구조 | 타입 체크 |
| M8 | Tokyo DB 통합 테스트 | 실데이터 CRUD | db-live.test.ts |

---

## IX. 테스트 계획

### 단위 테스트 (mock Supabase)

| 파일 | 테스트 내용 | 예상 건수 |
|------|-----------|---------|
| sellers.test.ts | findOrCreate 매칭 로직 6시나리오, mapRow | ~12 |
| consignments.test.ts | bulkCreate 성공/실패/중복, 상태 전이 검증 | ~10 |
| orders.test.ts | mapRow, 필터 | ~6 |
| products.test.ts | 5개 상태 필터 조합, summary | ~8 |
| settlement.test.ts | confirm/pay 상태 검증, mapRow | ~6 |
| bulk.test.ts | BulkResult 구조, FailedRow 생성 | ~8 |
| batch.test.ts | progress 상태 전이 | ~6 |

### 통합 테스트 (Tokyo DB)

| 테스트 | 검증 내용 |
|--------|---------|
| sellers findOrCreate | 신규 생성 → 재호출 시 기존 반환 |
| consignments CRUD | 생성 → 조회 → 상태 전이 → 삭제 |
| create_order_with_items RPC | 원자적 생성 확인 |
| create_settlement_with_items RPC | 원자적 생성 + sold_items 상태 갱신 |
| complete_consignment RPC | 위탁 → 상품 → 주문 원자적 처리 |

---

## X. 작업 순서

| Step | 파일 | 의존성 | 예상 줄 |
|------|------|--------|--------|
| 1 | client.ts + types.ts | 없음 | ~80 |
| 2 | sellers.repo.ts + sellers-query.repo.ts | Step 1 | ~120+60 |
| 3 | consignments.repo.ts | Step 2 (findOrCreate) | ~110 |
| 4 | consignment.tx.ts | Step 3 | ~40 |
| 5 | orders.repo.ts | Step 1 | ~80 |
| 6 | order.tx.ts | Step 5 | ~45 |
| 7 | products.repo.ts | Step 1 | ~100 |
| 8 | settlement.repo.ts + sold-items.repo.ts | Step 1 | ~120 |
| 9 | settlement.tx.ts | Step 8 | ~45 |
| 10 | sales-records.repo.ts + naver-settlements.repo.ts | Step 1 | ~100 |
| 11 | notifications.repo.ts | Step 1 | ~70 |
| 12 | batch.repo.ts | Step 1 | ~60 |
| 13 | 단위 테스트 | Step 1~12 | ~200 |
| 14 | 통합 테스트 | Step 1~12 | ~100 |

**합계**: ~15파일, ~1,130줄 (테스트 포함)

---

## XI. V2↔V3 대응표

| V2 (route.ts 직접 호출) | V3 (리포지토리) | 개선점 |
|------------------------|----------------|--------|
| `supabase.from('sellers').select('*').eq('status','active')` | `sellersRepo.listActive()` | 쿼리 1곳 관리 |
| `supabase.from('orders').insert({...})` + `supabase.from('order_items').insert({...})` + 실패 시 delete | `orderTx.createOrderWithItems(params)` | 원자적, 롤백 불필요 |
| `for (const item of sold_items) { ... supabase.from('settlements').insert() }` | `settlementTx.createSettlement(params)` | FOR UPDATE + count 검증 |
| `alert("신규 5건, 중복 3건")` | `BulkResult { succeeded, failed: FailedRow[] }` | 인라인 수정 가능 |
| `sellerByPhone[phoneDigits]` (앱 메모리) | `sellersRepo.findOrCreate(name, phone, address?)` | 이름+전화 조합 매칭 |
| `errors.push("행 3: 실패")` | `FailedRow { rowIndex:3, errors: [{field, type, message}] }` | 구조화된 에러 |

---

## XII. RPC 호출 규약

### supabase-js Generated Types 미생성 시 패턴

supabase-js에서 Generated Types 없이 `.rpc()` 호출 시 `never` 타입 반환. 제네릭 래퍼 대신 인라인 `as never` 패턴 적용 (RPC 3개뿐, Simplify 원칙).

```typescript
// [C1] RPC never 타입 패턴 — 모든 RPC 호출에 일관 적용
const { data, error } = await client.rpc(
  'create_order_with_items' as never,
  {
    p_order_number: orderNumber,
    p_customer_name: name,
    p_customer_phone: phone,
    p_status: status,
    p_items: items,  // JS array → supabase-js 자동 jsonb 직렬화 (JSON.stringify 금지)
  } as never
)
// data 타입: unknown → 명시적 캐스팅
const orderId = data as string  // RPC RETURNS uuid → string
```

### RPC 에러 코드 처리

```typescript
// [H5] P0001 (RAISE EXCEPTION) 처리
if (error) {
  if (error.code === 'P0001') {
    // RPC 내부 비즈니스 예외 — error.message에 한글 메시지
    return { data: null, error: error.message }
  }
  if (error.code === '23505') {
    // UNIQUE 제약 위반 — retry-after-conflict 또는 에러 반환
    return { data: null, error: '중복 데이터' }
  }
  return { data: null, error: error.message }
}
```

### RPC 호출 위치 맵

| RPC 함수 | 호출 위치 | 반환 타입 |
|----------|---------|----------|
| `generate_seller_code(name, phone, address)` | sellers.repo.ts create() | text (5자리 숫자) |
| `generate_product_number(seller_id)` | consignment.tx.ts completeConsignment() | text (13자리 숫자) |
| `generate_order_number()` | order.tx.ts createOrderWithItems() | text (YYYYMMDD-NNNNNN) |
| `create_order_with_items(...)` | order.tx.ts | uuid |
| `create_settlement_with_items(...)` | settlement.tx.ts | uuid |
| `complete_consignment(...)` | consignment.tx.ts | uuid |
| `get_commission_rate(seller_id)` | 사용 안 함 (TS getCommissionRate() 사용) | numeric |
| `find_brand(search_term)` | Phase 3 Service 예정 | TABLE |

---

## XIII. JOIN 타입 정의

PostgREST FK 기반 자동 JOIN으로 생성되는 확장 타입. Phase 1 인터페이스를 조합하여 정의.

```typescript
// [J1] 위탁 + 셀러 + 상품
interface ConsignmentWithRelations extends ConsignmentRequest {
  sellers: Pick<Seller, 'name' | 'phone' | 'sellerCode' | 'sellerTier'> | null
  st_products: Pick<StProduct, 'productNumber'> | null
}

// [J2] 주문 + 아이템
interface OrderWithItems extends Order {
  order_items: OrderItem[]
}

// [J3] 상품 + 셀러
interface StProductWithSeller extends StProduct {
  sellers: Pick<Seller, 'name' | 'phone' | 'sellerTier'> | null
}

// [J4] 정산 + 셀러 (목록용)
interface SettlementWithSeller extends Settlement {
  sellers: Pick<Seller, 'id' | 'name' | 'nickname' | 'phone' | 'bankAccount' |
    'commissionRate' | 'sellerTier' | 'status'> | null
}

// [J5] 정산 + 셀러 + 아이템 상세 (상세 조회용)
interface SettlementWithDetails extends SettlementWithSeller {
  settlement_items: Array<{
    id: string
    soldItemId: string
    sold_items: SoldItem
  }>
}

// [J6] 알림 + 셀러 + 위탁
interface NotificationLogWithRelations extends NotificationLog {
  sellers: Pick<Seller, 'name' | 'phone' | 'sellerCode'> | null
  consignment_requests: Pick<ConsignmentRequest, 'productNumber' | 'productName'> | null
}
```

> **PostgREST FK 확인**: 모든 JOIN은 02_constraints.sql의 FK 정의 기반.
> FK 없는 테이블 간 JOIN은 PostgREST에서 불가 → 서브쿼리 또는 앱 레벨 조합.

---

## XIV. 아키텍처 준수 사항

### Architecture Spec 위반 방지 체크리스트

| # | 규칙 | 스펙 조항 | Phase 2 준수 방법 |
|---|------|---------|-----------------|
| AV1 | SELECT * 금지 | §5.2 | 모든 repo에 명시적 COLUMNS 상수 선언 (10개 repo 전체) |
| AV2 | 배치 오케스트레이션 L1 Service | §6.1 | Phase 2: repo에 임시 배치, Phase 3: Service 분리 |
| AV3 | `.or()` 금지 | §5.2 | notifications 복합 검색: 조건별 분기 + 서브쿼리 |
| AV4 | repo 120줄 제한 | §10.1 | sellers.repo 분할 (sellers.repo + sellers-query.repo) |
| AV5 | any 사용 금지 | §3.1 | Record<string, unknown> + Phase 1 타입 캐스팅 |

### Partial Unique Index 주의사항

sales_records, naver_settlements에 partial index (`WHERE ... IS NOT NULL`) 존재.
Supabase `.upsert()`는 UNIQUE CONSTRAINT만 인식 — partial index 미인식.
→ Phase 2는 session 기반 delete+INSERT 패턴 사용 (`.upsert()` 미사용).

### 데이터 무결성 규칙

| 규칙 | 적용 대상 | 처리 방식 |
|------|---------|----------|
| UNIQUE(phone) | sellers | findOrCreate 23505 catch → SELECT fallback |
| UNIQUE(seller_id, product_name) | consignment_requests | 앱 레벨 중복 체크 + DB 제약 이중 방어 |
| UNIQUE(product_number) | st_products, order_items | RPC generate_product_number() 내부 충돌 재시도 |
| UNIQUE(order_number) | orders | RPC generate_order_number() 내부 충돌 재시도 |
| UNIQUE(product_order_id) | sold_items | upsertFromExcel onConflict: ignoreDuplicates |

---

## XV. 시뮬레이션 검증 결과 (2026-03-09)

5회 딥 & 하드 시뮬레이션 수행. 전체 PASS.

| # | 시뮬레이션 | 검증 범위 | 판정 |
|---|-----------|---------|------|
| Sim1 | sellers.repo | 25필드 mapRow, findOrCreate race condition, RPC 호출 | PASS |
| Sim2 | settlement.tx | FOR UPDATE deadlock(B-tree 안전), 16필드, RPC 8 params | PASS |
| Sim3 | consignments.bulkCreate | 5행 시나리오, FailedRow, 중복 체크, 28필드 mapRow | PASS |
| Sim4 | order.tx | p_items jsonb, 23필드 mapRow, generate_order_number | PASS |
| Sim5 | 전체 통합 7단계 | 위탁→검수→상품→주문→판매→정산→지급 + 실패 3건 | PASS |

### 시뮬레이션에서 발견 → 수정된 항목

| # | 발견 | 수정 내용 |
|---|------|---------|
| 1 | sellers.repo 212줄 초과 | sellers.repo + sellers-query.repo 분할 |
| 2 | sellers COLUMNS 16/25 불완전 | 25컬럼 전체 명시 |
| 3 | consignments COLUMNS `*` 사용 | 28컬럼 명시 |
| 4 | orders COLUMNS 미선언 | 19+23컬럼 명시 |
| 5 | products COLUMNS 미선언 | 36컬럼 명시 |
| 6 | settlement COLUMNS 미선언 | 16컬럼 명시 |
| 7 | sold-items COLUMNS 미선언 | 20컬럼 명시 |
| 8 | sales-records COLUMNS 미선언 | 19컬럼 명시 |
| 9 | naver-settlements COLUMNS 미선언 | 13컬럼 명시 |
| 10 | notifications COLUMNS 미선언 | 10컬럼 명시 |
| 11 | batch COLUMNS 미선언 | 9+15컬럼 명시 |
| 12 | p_items: jsonb[] (오류) | jsonb (단일 JSON) 수정 |
| 13 | order item fields 불일치 | DDL 기준 10필드로 수정, estimated_price 제외 |
| 14 | generate_order_number 위치 미명시 | order.tx.ts 내 RPC 직전 호출 명시 |
| 15 | RPC never 패턴 미문서화 | XII절 RPC 호출 규약 신설 |
| 16 | P0001/23505 에러 처리 미문서화 | XII절 에러 코드 처리 추가 |
| 17 | NUMERIC→Number 변환 미문서화 | VII절 4개 필드 변환 규칙 추가 |
| 18 | JOIN 타입 미정의 (6종) | XIII절 JOIN 타입 정의 신설 |
| 19 | findOrCreate race condition 미문서화 | IV-1절 23505 **error 객체 검사** 패턴으로 수정 (D1 fix) |
| 20 | FOR UPDATE ORDER BY id 미언급 | V-3절 권장사항 추가 |
| 21 | .or() 금지 미반영 | IX-9절 AV3 주석 추가 |
| 22 | 배치 오케스트레이션 위치 충돌 | IV-2절 AV2 주석 추가 |
| 23 | Partial unique index 미문서화 | XIV절 주의사항 추가 |
| 24 | 파일 수 14→15 | sellers-query.repo.ts 추가 |
| 25 | D1: supabase-js 23505 패턴 오류 | try/catch → error 객체 검사 패턴 수정 (IV-1절) |
| 26 | D3: sales-records rowIndex 매핑 | spread 객체 indexOf -1 주의사항 추가 (IV-7절) |
| 27 | D6: notifications/batch 미검증 | 구현 시 수동 DDL 교차검증 필요 주의사항 추가 (IV-9절) |
