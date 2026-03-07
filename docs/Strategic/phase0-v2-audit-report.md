# Phase 0 V2↔V3 비교 감사 보고서

**작성일**: 2026-03-04
**목적**: V3 Phase 0 마이그레이션 11개 파일을 V2 실제 DB 스키마와 교차 비교하여 문제점 도출
**상태**: 수정 전 보고 단계

---

## 요약

| 심각도 | 건수 | 설명 |
|--------|------|------|
| **CRITICAL** | 8건 | 런타임 에러 — DB 에러로 즉시 실패 |
| **HIGH** | 5건 | 데이터 무결성 / 핵심 기능 누락 |
| **MEDIUM** | 4건 | 기능 누락 (현재 동작에는 영향 없음) |
| **LOW** | 2건 | 개선 사항 |

**핵심**: RPC 005(정산)와 RPC 007(위탁완료)이 V2 DB 스키마와 심각하게 불일치하여, 실행 시 즉시 에러 발생.

---

## SECTION 1: CRITICAL — 런타임 에러 (8건)

### C-1. RPC 005: settlements 컬럼명 불일치 — `period_start` / `period_end`

**V3 Phase 0 코드** (`000005_rpc_settlement.sql` 및 `000011_fix_rpc_settlement.sql`):
```sql
INSERT INTO settlements (
  seller_id, period_start, period_end, ...
```

**V2 실제 DB** (`classic-menswear-frontend/supabase/settlement-phase1.sql`):
```sql
CREATE TABLE settlements (
  ...
  settlement_period_start DATE NOT NULL,
  settlement_period_end DATE NOT NULL,
  ...
```

**에러**: `column "period_start" of relation "settlements" does not exist`
**증거**: V2 settlements 테이블은 `settlement_period_start` / `settlement_period_end` 컬럼명 사용

---

### C-2. RPC 005: settlements.status CHECK 위반 — `'pending'`

**V3 Phase 0 코드** (011):
```sql
INSERT INTO settlements (..., status) VALUES (..., 'pending')
```

**V2 실제 DB CHECK**:
```sql
status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'paid', 'failed'))
```

**에러**: `new row for relation "settlements" violates check constraint`
**증거**: V2에서 'pending' 상태는 존재하지 않음. 초기 상태는 'draft'

---

### C-3. RPC 007: orders.status — `'RECEIVED'` CHECK 위반

**V3 Phase 0 코드** (`000007_rpc_consignment.sql` Line 68):
```sql
INSERT INTO orders (..., status) VALUES (..., 'RECEIVED')
```

**V2 실제 DB CHECK** (`20260219_orders_system.sql`):
```sql
CHECK (status IN ('APPLIED','SHIPPING','COLLECTED','INSPECTED',
  'PRICE_ADJUSTING','RE_INSPECTED','IMAGE_PREPARING','IMAGE_COMPLETE'))
```

**에러**: `new row for relation "orders" violates check constraint`
**증거**: V2 DB에 'RECEIVED' 상태 없음. V2에서 위탁 완료 시 초기 상태는 'APPLIED'

---

### C-4. RPC 007: st_products에 `consignment_id` 컬럼 없음

**V3 Phase 0 코드** (`000007_rpc_consignment.sql` Line 50-58):
```sql
INSERT INTO st_products (
  product_number, brand, category,
  condition, size, color, measurements,
  consignment_id   -- ← V2에 존재하지 않는 컬럼
) VALUES (...)
```

**V2 실제 DB**: st_products 테이블에 `consignment_id` 컬럼이 **존재하지 않음**
- V2에서 위탁↔상품 관계는 `consignment_requests.product_id → st_products.id` (역방향 FK)

**에러**: `column "consignment_id" of relation "st_products" does not exist`

---

### C-5. RPC 007: st_products에 `condition` 컬럼 없음

**V3 Phase 0 코드** (`000007_rpc_consignment.sql` Line 55):
```sql
INSERT INTO st_products (..., condition, ...) VALUES (..., p_condition, ...)
```

**V2 실제 DB**: st_products에서 상태 관련 컬럼명은 `product_condition` (not `condition`)
- `condition` 컬럼은 order_items 테이블에만 존재

**에러**: `column "condition" of relation "st_products" does not exist`

---

### C-6. RPC 007: st_products.product_name NOT NULL 미제공

**V3 Phase 0 코드**: `INSERT INTO st_products(product_number, brand, ...)` — `product_name` 누락

**V2 실제 DB**: `product_name TEXT NOT NULL` (기본값 없음)

**에러**: `null value in column "product_name" of relation "st_products" violates not-null constraint`

---

### C-7. RPC 007: st_products.sale_price NOT NULL 미제공

**V3 Phase 0 코드**: INSERT에 `sale_price` 미포함

**V2 실제 DB**: `sale_price INTEGER NOT NULL` (기본값 없음)

**에러**: `null value in column "sale_price" of relation "st_products" violates not-null constraint`

---

### C-8. RPC 005 원본(011 수정 전): `settlement_status` → `status`

**상태**: 이미 발견 → 011에서 수정됨 (RESOLVED)
**단, 011도 C-1, C-2 버그를 가지고 있어 다시 수정 필요**

---

## SECTION 2: HIGH — 데이터 무결성 / 핵심 기능 누락 (5건)

### H-1. RPC 007: st_products.seller_id 미제공

**V2 실제 동작** (consignments/[id]/route.ts Line 241):
```typescript
seller_id: existing.seller_id,  // consignment_requests에서 가져옴
```

**V3 RPC 007**: seller_id를 INSERT에 포함하지 않음 → NULL 저장
- `seller_id` 컬럼은 NULLABLE이라 에러는 발생하지 않지만, 정산 시 `seller_id` 기반 조회 실패

**영향**: 위탁 상품이 셀러와 연결되지 않아 정산 워크플로우 파손

---

### H-2. RPC 007: V2 필수 컬럼 다수 누락

V2에서 st_products INSERT 시 필수로 제공하는 컬럼:

| V2 INSERT 컬럼 | V3 RPC 제공 여부 | 비고 |
|---------------|-----------------|------|
| product_number | O | |
| product_name | **X** | NOT NULL 위반 (C-6) |
| seller_id | **X** | NULL 저장 (H-1) |
| sale_price | **X** | NOT NULL 위반 (C-7) |
| product_type='consignment' | **X** | DEFAULT 'consignment' — 문제없음 |
| is_active=true | **X** | DEFAULT TRUE — 문제없음 |
| photo_status='pending' | **X** | DEFAULT 'pending' — 문제없음 |
| smartstore_status='draft' | **X** | DEFAULT 'draft' — 문제없음 |
| consignment_date | **X** | NULLABLE — 데이터 손실 |
| reference_image | **X** | NULLABLE — 데이터 손실 |
| brand | O | |
| category | O | |
| size | O | |
| color | O | |
| origin | **X** | NULLABLE — 데이터 손실 |
| composition | **X** | NULLABLE — 데이터 손실 |

---

### H-3. `generate_product_number` RPC 누락

**V2 정의**: `classic-menswear-frontend/supabase/settlement-phase1.sql` Lines 302-327
```sql
CREATE OR REPLACE FUNCTION generate_product_number(p_seller_id UUID) RETURNS TEXT
-- CT-{seller_code}-{3자리 시퀀스} 형식 생성
```

**V3 Phase 0**: 이 함수 미포함 → 위탁 승인 시 상품번호 생성 불가
**이미 알려진 사항**: Phase 1 계획서(phase1-v2-alignment-plan.md SECTION 2)에 포함됨

---

### H-4. `get_commission_rate` RPC 누락

**V2 정의**: `classic-menswear-frontend/supabase/settlement-phase1.sql`
```sql
CREATE OR REPLACE FUNCTION get_commission_rate(p_seller_id UUID) RETURNS DECIMAL
-- seller.commission_rate가 있으면 그것, 없으면 seller_tier 기반 기본값 반환
-- general: 0.25, employee: 0.20, vip: 0.20
```

**V3 Phase 0**: 미포함 → 정산 커미션 계산 시 함수 없음 에러
**영향**: Phase 4 서비스에서 TypeScript로 대체 가능하나, DB 레벨 보장 상실

---

### H-5. `update_updated_at()` 트리거 함수 및 트리거 누락

**V2 정의**: `classic-menswear-frontend/supabase/settlement-phase1.sql`
```sql
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- 3개 테이블에 트리거 부착
CREATE TRIGGER sellers_updated_at BEFORE UPDATE ON sellers ...
CREATE TRIGGER st_products_updated_at BEFORE UPDATE ON st_products ...
CREATE TRIGGER consignment_requests_updated_at BEFORE UPDATE ON consignment_requests ...
```

**V3 Phase 0**: 미포함 → `updated_at` 컬럼이 수동 업데이트 필요
**영향**: V3 RPC 007에서 `updated_at = now()` 명시하므로 해당 RPC는 OK. 그러나 일반 UPDATE 쿼리에서는 `updated_at` 갱신 안 됨

---

## SECTION 3: MEDIUM — 기능 누락 (4건)

### M-1. `settlement_matches` 테이블 미참조

V2에서 sales_records ↔ naver_settlements 자동매칭 결과를 저장하는 핵심 테이블.
settlement_queue가 settlement_matches를 FK로 참조.

**V3 Phase 0**: 언급 없음
**영향**: 정산 매칭 워크플로우 전체가 V3에서 미구현 상태. Phase 4에서 다룰 수 있으나, DB 테이블은 이미 V2에 존재.

---

### M-2. `settlement_audit_log` 테이블 미참조

V2 정산 감사 로그 (status_change, queue_insert, dup_blocked 추적)

**V3 Phase 0**: 언급 없음
**영향**: 컴플라이언스/감사 추적 기능 상실. Phase 4+ 에서 구현 가능.

---

### M-3. V2 dedup 유니크 인덱스 미포함

**V2** (`20260221_settlement_dedup.sql`):
```sql
CREATE UNIQUE INDEX idx_sales_records_dedup
  ON sales_records (sale_date, naver_order_no, buyer_name, product_name)
  WHERE naver_order_no IS NOT NULL;

CREATE UNIQUE INDEX idx_naver_settlements_dedup
  ON naver_settlements (product_order_no)
  WHERE product_order_no IS NOT NULL;
```

**V3 Phase 0**: 미포함
**영향**: 동일 데이터 중복 INSERT 방지 불가 → 정산 데이터 무결성 약화

---

### M-4. Migration 010 RLS 정책의 `IMAGE_COMPLETE` 하드코딩

```sql
CREATE POLICY orders_anon_update ON orders
  FOR UPDATE TO anon
  USING (... AND status = 'IMAGE_COMPLETE');
```

V2에서는 유효하지만, Phase 1 계획서에서 OrderStatus 확장(+CONFIRMED, +CANCELLED) 시 이 정책도 함께 업데이트 필요.

---

## SECTION 4: LOW — 개선 사항 (2건)

### L-1. V2 `orders` 테이블 `seller_tier` / `seller_type` 중복

V2 `20260213_add_seller_tier.sql`에서 `seller_tier VARCHAR(20)` 추가.
기존 `seller_type TEXT` 와 동일한 CHECK (`'general', 'employee', 'vip'`).
V3 Phase 0에서 정리 미진행.

### L-2. V2 레거시 테이블 정리 미계획

`sales_ledger`, `products`(프론트엔드), `product_images`, `excel_uploads`, `mismatches`, `market_prices`, `search_synonyms` 등 V2에 존재하지만 V3 Phase 0에서 미참조.
향후 Phase에서 필요 여부 결정 필요.

---

## SECTION 5: 마이그레이션별 상세 비교

### 5.1 `000001_consignment_status_check.sql` — 양호

| 항목 | V2 | V3 | 판정 |
|------|-----|-----|------|
| 상태값 7개 | pending, inspecting, on_hold, approved, rejected, received, completed | 동일 | **PASS** |
| 멱등성 | — | DO $$ 블록으로 존재여부 확인 | **PASS** |

---

### 5.2 `000002_unique_constraints.sql` — 양호

| 제약조건 | V2 존재 여부 | V3 동작 | 판정 |
|---------|------------|---------|------|
| sellers(phone) UNIQUE | O (sellers_phone_key) | 스킵 | **PASS** |
| sellers(seller_code) UNIQUE | O (sellers_seller_code_key) | 스킵 | **PASS** |
| st_products(product_number) UNIQUE | O | 스킵 | **PASS** |
| settlement_queue(match_id) UNIQUE | X | 추가 | **PASS** |
| return_shipments(consignment_id) UNIQUE | X | 추가 | **PASS** |

---

### 5.3 `000003_performance_indexes.sql` — 양호

| 인덱스 | V2 존재 여부 | V3 동작 | 판정 |
|--------|------------|---------|------|
| idx_sold_items_seller_settlement | X | 추가 (신규) | **PASS** |
| idx_orders_status | O | IF NOT EXISTS 스킵 | **PASS** |
| idx_sales_records_match_status | O | IF NOT EXISTS 스킵 | **PASS** |
| idx_settlement_queue_seller_id | O | IF NOT EXISTS 스킵 | **PASS** |
| idx_consignment_seller | 유사 존재 | IF NOT EXISTS 스킵 | **PASS** |

---

### 5.4 `000004_rls_policies.sql` — 양호 (주의사항 있음)

| 항목 | 판정 | 비고 |
|------|------|------|
| consignment_requests RLS 활성화 | **PASS** | 멱등 |
| consignment_anon_read 정책 | **PASS** | V2에 없던 신규 보안 강화 |
| adjustment_token 컬럼 | **PASS** | V2에 이미 존재 (20260221_consignment_adjustment.sql) |

**주의**: `current_setting('request.headers', true)::json->>'x-adjustment-token'` — Supabase PostgREST 환경에서만 동작. 직접 SQL 접속 시 NULL 반환.

---

### 5.5 `000005_rpc_settlement.sql` + `000011_fix_rpc_settlement.sql` — **CRITICAL FAIL**

| 항목 | V3 코드 | V2 실제 | 판정 |
|------|---------|---------|------|
| 컬럼 period_start | `period_start` | `settlement_period_start` | **CRITICAL (C-1)** |
| 컬럼 period_end | `period_end` | `settlement_period_end` | **CRITICAL (C-1)** |
| 상태 초기값 | `'pending'` | CHECK: draft/confirmed/paid/failed | **CRITICAL (C-2)** |
| sold_items 잠금 | FOR UPDATE + count 검증 | V2에서 별도 구현 없음 | **V3 개선 — GOOD** |
| settlement_items INSERT | O | V2에도 존재 | **PASS** |
| sold_items status update | `'settled'` | CHECK: pending/calculated/settled/returned | **PASS** |
| V2 누락 컬럼 return_deduction | 미포함 | DEFAULT 0 | **WARN** (데이터 불완전) |
| V2 누락 컬럼 item_count | 미포함 | DEFAULT 0 | **WARN** (데이터 불완전) |

---

### 5.6 `000006_rpc_order.sql` — 경미한 문제

| 항목 | V3 코드 | V2 실제 | 판정 |
|------|---------|---------|------|
| orders INSERT 기본 컬럼 | order_number, customer_name, phone, status | V2도 동일 | **PASS** |
| orders.address DEFAULT '' | 미제공 | NOT NULL DEFAULT '' | **PASS** (기본값 적용) |
| order_items.brand | O | NOT NULL | **PASS** |
| order_items.model | COALESCE('') | NOT NULL | **PASS** |
| order_items.condition | O | DEFAULT 'N' | **PASS** |
| p_status 파라미터 | 자유 문자열 | CHECK 8값 | **WARN** — 호출자가 V2 CHECK에 맞는 값 전달 필요 |

**종합**: 동작은 하지만, p_status에 V2 CHECK에 없는 값을 넣으면 실패. 방어 로직 없음.

---

### 5.7 `000007_rpc_consignment.sql` — **CRITICAL FAIL (5건)**

| 항목 | V3 코드 | V2 실제 | 판정 |
|------|---------|---------|------|
| st_products.consignment_id | 사용 | **존재하지 않음** | **CRITICAL (C-4)** |
| st_products.condition | 사용 | `product_condition`이 맞음 | **CRITICAL (C-5)** |
| st_products.product_name | 미제공 | NOT NULL (기본값 없음) | **CRITICAL (C-6)** |
| st_products.sale_price | 미제공 | NOT NULL (기본값 없음) | **CRITICAL (C-7)** |
| st_products.seller_id | 미제공 | NULLABLE이지만 정산에 필수 | **HIGH (H-1)** |
| orders.status = 'RECEIVED' | 사용 | V2 CHECK에 없음 | **CRITICAL (C-3)** |
| consignment 상태 검증 'approved' | O | V2에서도 'approved' 확인 | **PASS** |
| updated_at = now() | O | V2에도 존재 | **PASS** |

---

### 5.8 `000008_upload_session_id.sql` — 양호

| 항목 | V2 | V3 | 판정 |
|------|-----|-----|------|
| upload_session_id 컬럼 | 없음 | ADD COLUMN IF NOT EXISTS | **PASS** (V3 개선) |
| 부분 인덱스 | 없음 | IF NOT EXISTS | **PASS** |

---

### 5.9 `000009_batch_progress.sql` — 양호

| 항목 | V2 | V3 | 판정 |
|------|-----|-----|------|
| _batch_progress 테이블 | 없음 | CREATE IF NOT EXISTS | **PASS** (V3 신규) |
| status CHECK 4값 | — | running/completed/partial/failed | **PASS** |

---

### 5.10 `000010_public_orders_rls.sql` — 양호 (주의사항 있음)

| 항목 | V2 | V3 | 판정 |
|------|-----|-----|------|
| hold_token 컬럼 | 없음 | ADD COLUMN IF NOT EXISTS | **PASS** (V3 개선) |
| "Allow all" 정책 DROP | V2에 존재 | DROP IF EXISTS | **PASS** |
| orders_anon_read 토큰 정책 | 없음 | 생성 | **PASS** (보안 강화) |
| orders_anon_update 조건 | — | `status = 'IMAGE_COMPLETE'` | **WARN** (M-4) |

---

## SECTION 6: V2에 존재하지만 V3 Phase 0에서 누락된 항목 전체 목록

### 6.1 RPC / 함수

| 함수 | V2 위치 | 중요도 | Phase 0 포함 여부 |
|------|---------|--------|----------------|
| `generate_product_number(UUID)` | settlement-phase1.sql:302 | **HIGH** | X (H-3) |
| `get_commission_rate(UUID)` | settlement-phase1.sql | **HIGH** | X (H-4) |
| `update_updated_at()` trigger | settlement-phase1.sql | **HIGH** | X (H-5) |
| `pgp_sym_encrypt_text()` | settlement-phase1.sql | LOW | X (보안 암호화) |
| `pgp_sym_decrypt_text()` | settlement-phase1.sql | LOW | X (보안 복호화) |

### 6.2 테이블 (V3에서 미참조)

| 테이블 | V2 역할 | V3 필요 여부 |
|--------|---------|------------|
| `settlement_matches` | 매출↔정산 자동매칭 결과 | 정산 워크플로우에 필수 |
| `settlement_audit_log` | 정산 감사 추적 | 컴플라이언스 요구 시 필수 |
| `excel_uploads` | 엑셀 업로드 이력 | Phase 4 서비스에서 필요 |
| `mismatches` | 불일치 알림 | 정산 검증에 필요 |
| `market_prices` | 시세 크롤링 데이터 | 별도 기능 |
| `search_synonyms` | 검색 동의어 | 별도 기능 |
| `sales_ledger` | 레거시 매출장부 | 교체 완료 (sales_records) |
| `product_catalog` | V2에서 DROP됨 | 불필요 |
| `price_estimate_cache` | AI 정가 추정 캐시 | Phase 4+ |

### 6.3 인덱스 (V2에 있지만 V3에서 미추가)

V2에 이미 존재하는 인덱스이므로 V3가 별도로 추가할 필요 없음 (IF NOT EXISTS로 안전). 다만 V2에 없는 인덱스 중 V3도 누락한 것:

| 인덱스 | 대상 | 필요성 |
|--------|------|--------|
| `idx_sales_records_dedup` (UNIQUE) | sales_records(sale_date, naver_order_no, buyer_name, product_name) | 중복 방지 핵심 |
| `idx_naver_settlements_dedup` (UNIQUE) | naver_settlements(product_order_no) | 중복 방지 핵심 |

### 6.4 트리거

| 트리거 | 대상 테이블 | V3 미포함 |
|--------|-----------|----------|
| sellers_updated_at | sellers | X |
| st_products_updated_at | st_products | X |
| consignment_requests_updated_at | consignment_requests | X |

---

## SECTION 7: 수정안

### 7.1 즉시 수정 필요 (CRITICAL + HIGH)

#### FIX-1: RPC 005 전면 재작성 (C-1, C-2)

```sql
-- 수정: settlement_period_start/end + 'draft' 상태
CREATE OR REPLACE FUNCTION create_settlement_with_items(
  p_seller_id uuid,
  p_period_start date,
  p_period_end date,
  p_total_sales numeric,
  p_commission_rate numeric,
  p_commission_amount numeric,
  p_settlement_amount numeric,
  p_sold_item_ids uuid[]
) RETURNS uuid AS $$
DECLARE
  v_settlement_id uuid;
  v_locked_count int;
  v_expected_count int;
BEGIN
  v_expected_count := COALESCE(array_length(p_sold_item_ids, 1), 0);
  IF v_expected_count = 0 THEN
    RAISE EXCEPTION '정산 항목이 비어있습니다';
  END IF;

  SELECT COUNT(*) INTO v_locked_count
    FROM sold_items
    WHERE id = ANY(p_sold_item_ids)
      AND settlement_status = 'pending'
    FOR UPDATE;

  IF v_locked_count != v_expected_count THEN
    RAISE EXCEPTION '잠금 실패: 예상 %건 중 %건만 pending', v_expected_count, v_locked_count;
  END IF;

  INSERT INTO settlements (
    seller_id, settlement_period_start, settlement_period_end,
    total_sales, commission_rate, commission_amount, settlement_amount,
    item_count, status
  ) VALUES (
    p_seller_id, p_period_start, p_period_end,
    p_total_sales, p_commission_rate, p_commission_amount, p_settlement_amount,
    v_expected_count, 'draft'       -- ← V2 CHECK 준수
  ) RETURNING id INTO v_settlement_id;

  INSERT INTO settlement_items (settlement_id, sold_item_id)
    SELECT v_settlement_id, unnest(p_sold_item_ids);

  UPDATE sold_items
    SET settlement_status = 'settled'
    WHERE id = ANY(p_sold_item_ids);

  RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql;
```

**변경 요약**:
- `period_start` → `settlement_period_start`
- `period_end` → `settlement_period_end`
- `'pending'` → `'draft'`
- `item_count` 추가 (v_expected_count 활용)

---

#### FIX-2: RPC 007 전면 재작성 (C-3 ~ C-7, H-1, H-2)

```sql
CREATE OR REPLACE FUNCTION complete_consignment(
  p_consignment_id uuid,
  p_product_number text,
  p_product_name text DEFAULT NULL,      -- ← 추가: NOT NULL 대응
  p_sale_price integer DEFAULT 0,         -- ← 추가: NOT NULL 대응
  p_seller_id uuid DEFAULT NULL,          -- ← 추가: 셀러 연결
  p_brand text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_condition text DEFAULT NULL,          -- st_products.product_condition으로 매핑
  p_size text DEFAULT NULL,
  p_color text DEFAULT NULL,
  p_measurements jsonb DEFAULT NULL,
  p_order_number text DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_consignment record;
  v_product_id uuid;
  v_order_id uuid;
  v_actual_seller_id uuid;
  v_actual_product_name text;
BEGIN
  -- Step 1: Validate
  SELECT * INTO v_consignment
    FROM consignment_requests
    WHERE id = p_consignment_id AND status = 'approved'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '위탁 요청을 찾을 수 없거나 approved 상태가 아닙니다 (id: %)', p_consignment_id;
  END IF;

  -- seller_id: 파라미터 > consignment_requests.seller_id
  v_actual_seller_id := COALESCE(p_seller_id, v_consignment.seller_id);
  -- product_name: 파라미터 > consignment_requests.product_name
  v_actual_product_name := COALESCE(p_product_name, v_consignment.product_name);

  -- Step 2: Insert st_products (V2 컬럼명 사용)
  BEGIN
    INSERT INTO st_products (
      product_number, product_name, seller_id, sale_price,
      product_type, is_active, photo_status, smartstore_status,
      brand, category, product_condition, size, color, measurements,
      consignment_date
    ) VALUES (
      p_product_number, v_actual_product_name, v_actual_seller_id, p_sale_price,
      'consignment', true, 'pending', 'draft',
      p_brand, p_category, p_condition, p_size, p_color, p_measurements,
      CURRENT_DATE
    )
    RETURNING id INTO v_product_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION '상품번호가 이미 존재합니다: %', p_product_number;
  END;

  -- Step 3: Create order if data provided
  IF p_order_number IS NOT NULL THEN
    INSERT INTO orders (order_number, customer_name, phone, status)
    VALUES (p_order_number, p_customer_name, p_customer_phone, 'APPLIED')  -- ← V2 CHECK 준수
    RETURNING id INTO v_order_id;

    INSERT INTO order_items (order_id, product_number, brand, model, condition)
    VALUES (v_order_id, p_product_number, COALESCE(p_brand, ''), COALESCE(v_actual_product_name, ''), COALESCE(p_condition, 'N'));
  END IF;

  -- Step 4: Update consignment
  UPDATE consignment_requests
    SET status = 'completed',
        product_id = v_product_id,
        inspected_at = now(),
        updated_at = now()
    WHERE id = p_consignment_id;

  RETURN v_product_id;
END;
$$ LANGUAGE plpgsql;
```

**변경 요약**:
- `consignment_id` → 제거 (V2에 없는 컬럼)
- `condition` → `product_condition` (V2 컬럼명)
- `product_name`, `sale_price`, `seller_id` 파라미터 추가
- `'RECEIVED'` → `'APPLIED'` (V2 CHECK 준수)
- order_items에 `brand`, `model`, `condition` 추가 (V2 NOT NULL 컬럼)
- `product_id = v_product_id` 업데이트 추가 (V2 연결 관계)

---

#### FIX-3: 트리거 함수 + 트리거 추가 (H-5)

새 마이그레이션 파일 생성:
```sql
-- update_updated_at 트리거 함수 (V2 계승)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3개 테이블에 트리거 부착 (멱등성)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sellers_updated_at') THEN
    CREATE TRIGGER sellers_updated_at BEFORE UPDATE ON sellers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'st_products_updated_at') THEN
    CREATE TRIGGER st_products_updated_at BEFORE UPDATE ON st_products
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'consignment_requests_updated_at') THEN
    CREATE TRIGGER consignment_requests_updated_at BEFORE UPDATE ON consignment_requests
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
```

---

### 7.2 Phase 1과 동시 처리 가능

| 항목 | 파일 | 비고 |
|------|------|------|
| generate_product_number RPC | 신규 마이그레이션 | Phase 1 계획서 SECTION 2에 포함 |
| get_commission_rate RPC | 신규 마이그레이션 | Phase 4 서비스에서 TS로 대체 가능 |
| dedup 유니크 인덱스 | 신규 마이그레이션 | 데이터 무결성 강화 |

### 7.3 향후 Phase에서 처리

| 항목 | 시점 | 비고 |
|------|------|------|
| settlement_matches 테이블 | Phase 4 (서비스) | 매칭 서비스 구현 시 |
| settlement_audit_log 테이블 | Phase 4 (서비스) | 감사 서비스 구현 시 |
| excel_uploads 테이블 | Phase 4 (서비스) | 업로드 서비스 구현 시 |
| 레거시 테이블 정리 | Phase 9 (배포) | 마이그레이션 시 |

---

## SECTION 8: 수정 시 리스크 분석

### 8.1 FIX-1 (RPC 005 재작성) 리스크

| 리스크 | 심각도 | 확률 | 대응 |
|--------|--------|------|------|
| Phase 2 settlement.tx.ts 파라미터 불일치 | MEDIUM | 100% | tx.ts가 RPC 파라미터명을 사용하므로 RPC 시그니처 변경 없이 내부만 수정 → 영향 없음 |
| 'draft' vs 'pending' 상태 차이로 Phase 2 repo mapRow 영향 | LOW | 가능 | settlement.repo.ts의 mapRow에서 status를 그대로 전달하므로 영향 없음 |
| item_count 파라미터 미전달 | NONE | — | RPC 내부에서 v_expected_count로 자동 계산 |

**최종 판단**: **안전**. RPC 시그니처(외부 인터페이스) 변경 없이 내부 SQL만 수정.

---

### 8.2 FIX-2 (RPC 007 재작성) 리스크

| 리스크 | 심각도 | 확률 | 대응 |
|--------|--------|------|------|
| 시그니처 변경 (파라미터 3개 추가) | **HIGH** | 100% | Phase 2 consignment.tx.ts 수정 필요 |
| V2 호출 코드와 호환성 | MEDIUM | 가능 | 추가 파라미터 모두 DEFAULT 값 → 기존 호출은 동작하지만 데이터 불완전 |
| st_products.product_condition vs condition 혼동 | LOW | 낮음 | DB 컬럼명은 product_condition으로 확정, TS 타입은 별도 |

**최종 판단**: **주의 필요**. Phase 2 `consignment.tx.ts`의 `CompleteConsignmentInput` 인터페이스 수정 필요.

**영향받는 Phase 2 파일**:
- `apps/web/lib/db/transactions/consignment.tx.ts` — 파라미터 3개 추가 (product_name, sale_price, seller_id)

---

### 8.3 FIX-3 (트리거 추가) 리스크

| 리스크 | 심각도 | 확률 | 대응 |
|--------|--------|------|------|
| 기존 updated_at 수동 설정과 충돌 | NONE | 0% | 트리거가 먼저 실행되어 NOW()로 덮어쓰므로 동일 결과 |
| V3 RPC 007의 `updated_at = now()` 중복 | NONE | 0% | 트리거와 명시적 설정 모두 같은 값 → 무해 |

**최종 판단**: **완전 안전**. 사이드 이펙트 없음.

---

### 8.4 전체 리스크 매트릭스

| 수정안 | 수정 위험도 | 미수정 위험도 | 권장 |
|--------|-----------|-------------|------|
| FIX-1 (RPC 005) | **LOW** | **CRITICAL** (런타임 에러) | 즉시 수정 |
| FIX-2 (RPC 007) | **MEDIUM** (Phase 2 수정 동반) | **CRITICAL** (런타임 에러 5건) | 즉시 수정 |
| FIX-3 (트리거) | **NONE** | **HIGH** (updated_at 갱신 안 됨) | 즉시 수정 |
| generate_product_number | **LOW** | **HIGH** (위탁 승인 불가) | Phase 1과 동시 |
| get_commission_rate | **LOW** | **MEDIUM** (TS 대체 가능) | Phase 4 전까지 선택 |

---

## SECTION 9: 실행 순서

### 즉시 수정 (Phase 0 패치)

```
Step 1: 마이그레이션 파일 생성
  A. 20260304000012_fix_rpc_settlement_v2.sql    — FIX-1 (RPC 005 재작성)
  B. 20260304000013_fix_rpc_consignment_v2.sql   — FIX-2 (RPC 007 재작성)
  C. 20260304000014_updated_at_triggers.sql      — FIX-3 (트리거 추가)

Step 2: Phase 2 영향 파일 수정
  A. consignment.tx.ts — CompleteConsignmentInput에 productName, salePrice, sellerId 추가

Step 3: 테스트
  A. vitest run — 기존 92 테스트 전부 PASS 확인
  B. tsc --strict --noEmit — 0 errors

Step 4: 커밋
```

### Phase 1과 동시 처리

```
  D. 20260304000015_rpc_generate_product_number.sql — generate_product_number
  E. 20260304000016_orders_status_extend.sql        — OrderStatus CHECK 확장
  F. 20260304000017_get_commission_rate.sql          — get_commission_rate (선택)
  G. 20260304000018_dedup_indexes.sql                — dedup 유니크 인덱스 (선택)
```

---

## SECTION 10: V3 Phase 0 양호 항목

공정한 평가를 위해, V3 Phase 0에서 **V2 대비 올바르게 개선된 사항**:

| 마이그레이션 | 개선 내용 |
|------------|---------|
| 001 | consignment_requests CHECK 7값 통일 — V2 진화 과정의 최종 상태와 일치 |
| 002 | settlement_queue(match_id), return_shipments(consignment_id) UNIQUE 추가 — V2에 없던 무결성 강화 |
| 003 | idx_sold_items_seller_settlement 복합 인덱스 — V2에 없던 성능 최적화 |
| 004 | consignment_anon_read 토큰 기반 RLS — V2의 보안 공백 해소 |
| 005 | sold_items FOR UPDATE 잠금 + count 검증 — V2에 없던 동시성 보호 |
| 008 | upload_session_id — V2의 "상대 데이터 삭제" 문제 해결 |
| 009 | _batch_progress 신규 테이블 — V2에 없던 배치 추적 |
| 010 | hold_token 기반 orders RLS — V2의 USING(true) 정책 보안 강화 |

**11개 파일 중 6개(001, 002, 003, 004, 008, 009, 010)는 양호 또는 V2 대비 개선.**
**3개(005, 006, 007)에 문제가 집중.** 그 중 005와 007이 CRITICAL.

---

## SECTION 11: 결론

### Phase 0의 문제 원인

V3 Phase 0 RPC(005, 006, 007)는 **plan5.md 명세 기반으로 재구성**되었으며, V2 실제 DB 스키마와의 교차 검증이 부족했음.
- RPC 005: settlements 테이블 컬럼명과 CHECK 값이 V2와 불일치
- RPC 007: st_products 테이블 구조를 잘못 가정 (존재하지 않는 컬럼 참조, NOT NULL 컬럼 누락)

### 수정 우선순위

1. **즉시 수정 필수**: FIX-1(RPC 005) + FIX-2(RPC 007) + FIX-3(트리거) → Phase 0 패치
2. **Phase 1과 동시**: generate_product_number + OrderStatus CHECK 확장
3. **Phase 4에서**: get_commission_rate, settlement_matches, audit_log
