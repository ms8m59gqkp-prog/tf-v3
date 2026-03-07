# Phase 1 재구현 최종 레퍼런스

**작성일**: 2026-03-06
**근거**: 4라운드 26에이전트 딥리서치 결과 (수렴 확정, 24건 이슈)
**목적**: Phase 1 삭제 후 재구현 시 V2 DB와 100% 정합하는 코드 생성

---

## I. V2 DB 스키마 (Phase 1 대상 12테이블)

### 1.1 sellers (24컬럼)

```
id              uuid          NOT NULL  PK
seller_code     text          NOT NULL  UNIQUE
name            text          NOT NULL
phone           text          NOT NULL  UNIQUE
email           text          NULL
id_card_number  text          NULL
id_card_verified boolean      NULL
id_card_file_url text         NULL
bank_name       text          NULL
bank_account    text          NULL
bank_holder     text          NULL
bank_verified   boolean       NULL
commission_rate numeric       NULL      -- 개별 수수료율 (우선순위 1)
contract_start  date          NULL
contract_end    date          NULL
channel_type    text          NULL      -- CHECK: half_size, full_size, both
status          text          NULL      -- CHECK: pending, active, inactive, suspended, expired
created_at      timestamptz   NULL
updated_at      timestamptz   NULL
seller_tier     text          NULL      -- CHECK: general, employee, vip
tagging_code    text          NULL
nickname        text          NULL
marketing_consent boolean     NULL
marketing_consent_at timestamptz NULL
```

### 1.2 consignment_requests (28컬럼)

```
id                    uuid        NOT NULL  PK
seller_id             uuid        NOT NULL  FK→sellers
product_name          text        NOT NULL
desired_price         integer     NOT NULL
product_condition     text        NOT NULL
status                text        NULL      -- CHECK: pending, inspecting, on_hold, approved, rejected, received, completed
approved_at           timestamptz NULL
product_id            uuid        NULL      -- completed시 채워짐
source                text        NULL      -- CHECK: naver_form, employee, manual, direct
memo                  text        NULL
created_at            timestamptz NULL
updated_at            timestamptz NULL
image_url             text        NULL
applied_at            timestamptz NULL
employee_purchase_date text       NULL
privacy_consent       text        NULL
product_number        text        NULL      -- completed시 채워짐
received_at           timestamptz NULL
inspected_at          timestamptz NULL
measurements          jsonb       NULL
item_type             text        NULL
inspection_image      text        NULL
adjustment_token      text        NULL
adjustment_price      integer     NULL
seller_response       text        NULL      -- CHECK: accepted, counter, cancelled (NULL 허용)
seller_counter_price  integer     NULL
origin                text        NULL
composition           text        NULL
```

### 1.3 orders (19컬럼)

```
id                    uuid          NOT NULL  PK
order_number          text          NOT NULL  UNIQUE
customer_name         text          NOT NULL
phone                 text          NOT NULL
address               text          NULL
postal_code           text          NULL
visit_date            date          NULL
arrival_date          date          NULL
box_qty               integer       NULL
total_estimated       integer       NULL
commission            integer       NULL
final_payout          integer       NULL
status                text          NULL      -- CHECK: APPLIED,SHIPPING,COLLECTED,INSPECTED,PRICE_ADJUSTING,RE_INSPECTED,IMAGE_PREPARING,IMAGE_COMPLETE,CONFIRMED,CANCELLED
created_at            timestamptz   NULL
updated_at            timestamptz   NULL
seller_type           text          NOT NULL  -- CHECK: general, employee, vip
purchase_source       text          NULL
custom_commission_rate numeric(5,4) NULL
hold_token            text          NULL
```

### 1.4 order_items (23컬럼)

```
id                  uuid        NOT NULL  PK
order_id            uuid        NOT NULL  FK→orders
product_number      text        NOT NULL
brand               text        NOT NULL
model               text        NOT NULL
category            text        NULL
condition           text        NULL
estimated_price     integer     NULL
final_price         integer     NULL
status              text        NULL
image_url           text        NULL
created_at          timestamptz NULL
customer_price      integer     NULL
size                text        NULL
inspection_status   text        NOT NULL  -- CHECK: pending, completed, hold
item_type           text        NULL
measurements        jsonb       NULL
hold_adjusted_price integer     NULL
hold_reason         text        NULL
hold_photo_url      text        NULL
hold_date           timestamptz NULL
customer_agreed     boolean     NOT NULL
customer_agreed_at  timestamptz NULL
```

### 1.5 st_products (36컬럼)

```
id                      uuid          NOT NULL  PK
product_number          text          NULL      UNIQUE
legacy_code             text          NULL
product_name            text          NOT NULL
seller_id               uuid          NULL      FK→sellers
sale_price              integer       NOT NULL
product_type            text          NULL      -- CHECK: consignment, inventory
is_active               boolean       NULL
smart_store_registered  boolean       NULL
consignment_date        date          NULL
created_at              timestamptz   NULL
updated_at              timestamptz   NULL
brand                   text          NULL
size                    text          NULL
origin                  text          NULL
material                text          NULL
measurements            jsonb         NULL
naver_product_id        text          NULL
seller_payment          integer       NULL
product_condition       text          NULL
unsellable_reason       text          NULL
sold_at                 date          NULL
sold_amount             integer       NULL
sales_record_id         uuid          NULL
buyer_name              text          NULL
reference_image         text          NULL
photos                  jsonb         NULL      -- jsonb 배열
photo_status            text          NULL      -- CHECK: pending, shooting, editing, completed
smartstore_status       text          NULL      -- CHECK: draft, ready, uploaded, selling
smartstore_data         jsonb         NULL
composition             text          NULL
category                text          NULL
retail_price            integer       NULL
retail_price_source     text          NULL      -- CHECK: naver_estimate, manual, desired_price
retail_price_confidence numeric(3,2)  NULL
color                   text          NULL
```

### 1.6 settlements (16컬럼)

```
id                      uuid        NOT NULL  PK
seller_id               uuid        NOT NULL  FK→sellers
settlement_period_start date        NOT NULL
settlement_period_end   date        NOT NULL
total_sales             integer     NOT NULL
commission_rate         numeric     NOT NULL
commission_amount       integer     NOT NULL
return_deduction        integer     NOT NULL
settlement_amount       integer     NOT NULL
item_count              integer     NOT NULL
status                  text        NULL      -- CHECK: draft, confirmed, paid, failed
paid_at                 timestamptz NULL
paid_by                 text        NULL
transfer_reference      text        NULL
created_at              timestamptz NULL
confirmed_at            timestamptz NULL
```

### 1.7 settlement_items (3컬럼 — 순수 join 테이블)

```
id              uuid  NOT NULL  PK
settlement_id   uuid  NOT NULL  FK→settlements
sold_item_id    uuid  NOT NULL  FK→sold_items
```

### 1.8 sold_items (20컬럼)

```
id                    uuid        NOT NULL  PK
seller_id             uuid        NOT NULL  FK→sellers
channel               text        NULL      -- CHECK: smart_store, self_mall
order_id              text        NOT NULL  -- text, NOT uuid
product_name          text        NOT NULL
product_number        text        NULL
quantity              integer     NOT NULL
sale_price            integer     NOT NULL
shipping_fee          integer     NULL
sold_at               date        NOT NULL
purchase_confirmed    boolean     NULL
purchase_confirmed_at date        NULL
settlement_status     text        NULL      -- CHECK: pending, calculated, settled, returned
settlement_id         uuid        NULL      FK→settlements
return_processed      boolean     NULL
source_file           text        NULL
created_at            timestamptz NULL
product_order_id      text        NULL
naver_product_id      text        NULL
product_code          text        NULL
```

### 1.9 sales_records (19컬럼)

```
id                  uuid          NOT NULL  PK
sale_date           date          NOT NULL
buyer_name          text          NULL
naver_order_no      text          NULL
brand               text          NULL
product_name        text          NULL
product_code        text          NULL
product_number      text          NULL
original_price      integer       NULL
discount_rate       numeric(5,4)  NULL
sale_amount         integer       NULL
quantity            integer       NULL
final_amount        integer       NULL
is_consignment      boolean       NULL
consignment_seller  text          NULL
match_status        text          NULL      -- CHECK: unmatched, auto_matched, manual_matched
upload_batch        text          NULL
created_at          timestamptz   NULL
upload_session_id   uuid          NULL
```

### 1.10 naver_settlements (13컬럼)

```
id                  uuid        NOT NULL  PK
order_no            text        NULL
product_order_no    text        NULL
category            text        NULL
product_name        text        NULL
buyer_name          text        NULL
settle_base_date    date        NULL
settle_scheduled_date date      NULL
settle_amount       integer     NULL
settle_status       text        NULL
match_status        text        NULL      -- CHECK: unmatched, auto_matched, manual_matched
upload_batch        text        NULL
created_at          timestamptz NULL
```

### 1.11 notification_logs (10컬럼)

```
id                uuid        NOT NULL  PK
consignment_id    uuid        NULL      FK→consignment_requests
seller_id         uuid        NULL      FK→sellers
phone             text        NOT NULL
message           text        NOT NULL
trigger_event     text        NOT NULL
channel           text        NOT NULL
status            text        NOT NULL  -- CHECK: pending, sent, failed
api_response      jsonb       NULL
created_at        timestamptz NOT NULL
```

### 1.12 _batch_progress (9컬럼)

```
id          uuid        NOT NULL  PK
batch_id    text        NOT NULL
total       integer     NOT NULL
completed   integer     NOT NULL
failed      integer     NOT NULL
failed_ids  jsonb       NULL
status      text        NOT NULL  -- CHECK: running, completed, partial, failed
created_at  timestamptz NULL
updated_at  timestamptz NULL
```

---

## II. V2 CHECK 제약 29개 — 상수 정의 가이드

### Phase 1에서 반드시 정의해야 할 상수

| # | 상수명 | V2 테이블.컬럼 | 값 |
|---|--------|-------------|---|
| 1 | CONSIGNMENT_STATUSES | consignment_requests.status | pending, received, inspecting, approved, on_hold, rejected, completed |
| 2 | CONSIGNMENT_SOURCES | consignment_requests.source | naver_form, employee, manual, direct |
| 3 | SELLER_RESPONSES | consignment_requests.seller_response | accepted, counter, cancelled |
| 4 | ORDER_STATUSES | orders.status | APPLIED, SHIPPING, COLLECTED, INSPECTED, PRICE_ADJUSTING, RE_INSPECTED, IMAGE_PREPARING, IMAGE_COMPLETE, CONFIRMED, CANCELLED |
| 5 | SELLER_TYPES / SellerTier | orders.seller_type + sellers.seller_tier | general, employee, vip |
| 6 | INSPECTION_STATUSES | order_items.inspection_status | pending, completed, hold |
| 7 | SELLER_STATUSES | sellers.status | pending, active, inactive, suspended, expired |
| 8 | CHANNEL_TYPES | sellers.channel_type | half_size, full_size, both |
| 9 | SETTLEMENT_STATUSES | settlements.status | draft, confirmed, paid, failed |
| 10 | SOLD_ITEM_STATUSES | sold_items.settlement_status | pending, calculated, settled, returned |
| 11 | SALES_CHANNELS | sold_items.channel + sales_ledger.channel | smart_store, self_mall |
| 12 | MATCH_STATUSES | sales_records.match_status + naver_settlements.match_status | unmatched, auto_matched, manual_matched |
| 13 | BATCH_STATUSES | _batch_progress.status | running, completed, partial, failed |
| 14 | SMS_STATUSES | notification_logs.status | pending, sent, failed |
| 15 | PRODUCT_TYPES | st_products.product_type | consignment, inventory |
| 16 | PHOTO_STATUSES | st_products.photo_status | pending, shooting, editing, completed |
| 17 | SMARTSTORE_STATUSES | st_products.smartstore_status | draft, ready, uploaded, selling |
| 18 | RETAIL_PRICE_SOURCES | st_products.retail_price_source | naver_estimate, manual, desired_price |

### Phase 3/4에서 추가할 상수 (현재 미사용 도메인)

| # | 상수명 | V2 테이블.컬럼 | 값 |
|---|--------|-------------|---|
| 19 | EXCEL_UPLOAD_STATUSES | excel_uploads.status | processing, completed, failed |
| 20 | EXCEL_UPLOAD_TYPES | excel_uploads.upload_type | smart_store_sales, smart_store_confirm, naver_form, legacy_products |
| 21 | MISMATCH_TYPES | mismatches.mismatch_type | seller_mismatch, product_not_found, seller_not_found |
| 22 | MATCH_TYPES | settlement_matches.match_type | auto, manual |
| 23 | QUEUE_STATUSES | settlement_queue.queue_status | pending, confirmed, paid |
| 24 | SALE_TYPES | sales_ledger.sale_type | normal, return |
| 25 | SALES_PRODUCT_TYPES | sales_ledger.product_type | consignment, inventory |
| 26 | RETURN_TRIGGER_TYPES | return_shipments.trigger_type | rejected, hold_cancelled |
| 27 | RETURN_STATUSES | return_shipments.status | pending, requested, manual, in_transit, delivered, failed |

---

## III. V2 RPC 함수 시그니처 (Phase 2 트랜잭션 래퍼 기준)

### 3.1 complete_consignment (14 파라미터 — Tokyo 013 기준)

```sql
(p_consignment_id uuid,            -- 필수
 p_product_number text,             -- 필수
 p_product_name text DEFAULT NULL,  -- 선택 (Tokyo 013 추가)
 p_sale_price integer DEFAULT 0,    -- 선택 (Tokyo 013 추가)
 p_seller_id uuid DEFAULT NULL,     -- 선택 (Tokyo 013 추가)
 p_brand text DEFAULT NULL,         -- 선택
 p_category text DEFAULT NULL,      -- 선택
 p_condition text DEFAULT NULL,     -- 선택
 p_size text DEFAULT NULL,          -- 선택
 p_color text DEFAULT NULL,         -- 선택
 p_measurements jsonb DEFAULT NULL, -- 선택
 p_order_number text DEFAULT NULL,  -- 선택 (있으면 주문도 생성)
 p_customer_name text DEFAULT NULL, -- 선택
 p_customer_phone text DEFAULT NULL -- 선택
) RETURNS uuid
```

**참고**: V2는 11파라미터였으나 Tokyo DB에 013이 적용되어 14파라미터가 현실. Phase 1은 Tokyo DB 기준.

### 3.2 create_order_with_items (5 파라미터)

```sql
(p_order_number text,      -- 필수
 p_customer_name text,      -- 필수
 p_customer_phone text,     -- 필수
 p_status text,             -- 필수
 p_items jsonb              -- 필수 (배열)
) RETURNS uuid
```

### 3.3 create_settlement_with_items (8 파라미터)

```sql
(p_seller_id uuid,           -- 필수
 p_period_start date,         -- 필수
 p_period_end date,           -- 필수
 p_total_sales numeric,       -- 필수
 p_commission_rate numeric,   -- 필수
 p_commission_amount numeric, -- 필수
 p_settlement_amount numeric, -- 필수
 p_sold_item_ids uuid[]       -- 필수
) RETURNS uuid
```

### 3.4 generate_product_number (V3 019로 교체됨)

```sql
(p_seller_id uuid) RETURNS text
-- 형식: 13자리 숫자 = YYMMDD(검수일) + 랜덤2자리 + 셀러코드5자리
-- 예: 2602157392528
-- 중복 체크: st_products.product_number (최대 100회)
-- 동시성: pg_advisory_xact_lock
-- V2 원본: YYMMDD-AAAAAA (6자리 날짜 + 6자리 알파벳) — 교체됨
```

### 3.4b generate_seller_code (V3 018 신규)

```sql
(p_name text, p_phone text, p_address text DEFAULT '') RETURNS text
-- 형식: 5자리 숫자 = hash(이름+전화+주소) 기반 랜덤 고유값
-- 예: 92528
-- 결정적: 같은 입력 → 같은 코드
-- 충돌 시 재해싱 (최대 1000회)
```

### 3.5 generate_order_number

```sql
() RETURNS text
-- 형식: YYYYMMDD-XXXXXX (8자리 날짜 + 6자리 숫자)
-- 예: 20260304-000042
-- 난수 범위: 0-999999 (LPAD로 6자리)
-- 중복 체크: orders.order_number (무한 루프)
```

### 3.6 get_commission_rate

```sql
(p_seller_id uuid) RETURNS numeric
-- 우선순위 1: sellers.commission_rate > 0 → 개별값 반환
-- 우선순위 2: sellers.seller_tier 기반
--   general  → 0.25
--   employee → 0.20
--   vip      → 0.20
--   기타     → 0.25
```

---

## IV. 확정된 24건 이슈 + 수정 지침

### CRITICAL (1건)

| # | 이슈 | 수정 |
|---|------|------|
| C-1 | SettlementItem 10필드 → V2는 3컬럼 | 3필드(id, settlementId, soldItemId)로 축소. 상세 조회용 SettlementItemDetail은 sold_items JOIN으로 별도 정의 |

### HIGH (15건)

| # | 이슈 | 수정 |
|---|------|------|
| H-1 | consignments: brand 팬텀 | COLUMNS/타입에서 제거 |
| H-2 | consignments: category 팬텀 | COLUMNS/타입에서 제거 |
| H-3 | products: model 팬텀 | 제거 (V2는 product_name) |
| H-4 | products: description 팬텀 | 제거 |
| H-5 | products: subCategory 팬텀 | 제거 |
| H-6 | products: originalPrice 매핑 오류 | → retailPrice (V2: retail_price) |
| H-7 | products: estimatedPrice 매핑 오류 | → salePrice (V2: sale_price) |
| H-8 | products: imageUrls 매핑 오류 | → photos (V2: photos jsonb) |
| H-9 | SoldItem: brand hardcoded '' | 타입에서 제거 또는 JOIN으로 실제값 |
| H-10 | SoldItem: model hardcoded '' | 타입에서 제거 |
| H-11 | SoldItem: commission hardcoded 0 | 타입에서 제거 (V2에 없음) |
| H-12 | SoldItem: payout hardcoded 0 | 타입에서 제거 (V2에 없음) |
| H-13 | ~~completeConsignment 3파라미터 초과~~ | ~~제거~~ → Tokyo 013 기준 14파라미터 유지 (이미 코드 일치) |
| H-14 | generateProductNumber YYYYMMDD | → YYMMDD (V2: to_char(now(),'YYMMDD')) |
| H-15 | generateOrderNumber 100000-999999 | → 0-999999 + LPAD 6자리 (V2: RANDOM()*1000000) |

### MEDIUM (6건)

| # | 이슈 | 수정 |
|---|------|------|
| M-1~6 | CHECK 상수 미정의 (sellers.status 등) | 상수 18종 전체 정의 (II장 참조) |

### LOW (2건)

| # | 이슈 | 수정 시점 |
|---|------|---------|
| L-1 | bankHolder 선택 필드 | Phase 3/4 |
| L-2 | productNumber 선택 필드 | Phase 3/4 |

---

## V. 타입 인터페이스 설계 지침

### 원칙
1. V2 DB 컬럼과 1:1 대응하는 필드만 정의
2. V2에 없는 필드 절대 추가 금지
3. JOIN 결과용 확장 타입은 별도 `~Detail` 인터페이스로 분리
4. optional 필드는 V2 nullable 컬럼과 일치

### 예시: SettlementItem (수정 전 → 후)

```typescript
// 수정 전 (10필드 — V2에 7개 없음)
interface SettlementItem {
  id: string; settlementId: string; soldItemId: string;
  productNumber: string; brand: string; model: string;
  soldPrice: number; commission: number; payout: number; createdAt: string;
}

// 수정 후 (3필드 — V2 정확히 일치)
interface SettlementItem {
  id: string;
  settlementId: string;
  soldItemId: string;
}

// JOIN 결과용 (필요 시)
interface SettlementItemDetail extends SettlementItem {
  productName: string;    // sold_items.product_name
  productNumber?: string; // sold_items.product_number
  salePrice: number;      // sold_items.sale_price
  soldAt: string;         // sold_items.sold_at
}
```

---

## VI. 수수료 계산 로직

```typescript
// V2 get_commission_rate() 정확 재현
export const COMMISSION_RATES = {
  general: 0.25,
  employee: 0.20,
  vip: 0.20,
} as const satisfies Record<SellerTier, number>

export function getCommissionRate(seller: { commissionRate?: number | null; sellerTier: SellerTier }): number {
  // 우선순위 1: 개별 수수료율
  if (seller.commissionRate != null && seller.commissionRate > 0) {
    return seller.commissionRate
  }
  // 우선순위 2: 티어 기본값
  return COMMISSION_RATES[seller.sellerTier] ?? 0.25
}
```

---

## VII. 번호 생성 로직

```typescript
// V2 generate_product_number() 정확 재현
export function generateProductNumber(date?: Date): string {
  const d = date ?? new Date()
  const yy = String(d.getFullYear()).slice(2)     // 26
  const mm = String(d.getMonth() + 1).padStart(2, '0') // 03
  const dd = String(d.getDate()).padStart(2, '0')       // 04
  const prefix = `${yy}${mm}${dd}`               // YYMMDD
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const suffix = Array.from({ length: 6 }, () =>
    chars[crypto.randomInt(0, 26)]
  ).join('')
  return `${prefix}-${suffix}`                    // 260304-TKBMXF
}

// V2 generate_order_number() 정확 재현
export function generateOrderNumber(date?: Date): string {
  const d = date ?? new Date()
  const prefix = d.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
  const num = crypto.randomInt(0, 1000000)        // 0-999999
  const suffix = String(num).padStart(6, '0')     // 6자리 LPAD
  return `${prefix}-${suffix}`                    // 20260304-000042
}
```

---

## VIII. 파일 참조

| 카테고리 | 경로 |
|---------|------|
| 본 레퍼런스 | docs/03-analysis/phase1-reimpl-reference.md |
| 1차 딥리서치 | docs/03-analysis/phase1-v2-deep-research-report.md |
| V2 전체 딥리서치 | docs/03-analysis/v2-full-deep-research-report.md |
| 신뢰도 보고서 (4라운드) | docs/03-analysis/v2-deep-research-reliability-report.md |
| V2 DB 백업 | supabase/backup/v2_{columns,constraints,indexes,functions,triggers,rls}.txt |
| V2 실데이터 | supabase/backup/{sellers,consignment_requests,orders,order_items,st_products}.json |
| V3 마스터 플랜 | docs/Strategic/plan5.md |
