# V2 DDL vs V3 마이그레이션 확정 델타 분석 (4차 검증 완료)

**날짜**: 2026-03-05
**분석 방법**: V3 마이그레이션 16개 파일 × V2 백업 6종 (columns, constraints, indexes, triggers, rls, functions) 1:1 전수 대조
**근거 데이터**: `supabase/backup/v2_*.txt` (2026-03-05 추출)
**4차 검증**: V2 CHECK 29건 vs V3 타입 7파일 전수 교차 + 의사결정 항목 확정 + RLS ENABLE 확인

---

## 결론

**"V2 DDL을 거의 그대로 Tokyo에 적용하면 되고, 추가할 것은 orders CHECK 10값" → 부정확.**

4차 검증 결과, 확정 차이는 **10건** + 앱 레이어 버그 **3건**. (3차 대비 변동 없음 — 안정화 확인)

### 라운드별 발견 이력

| 라운드 | 확정 델타 수 | 주요 수정 |
|--------|------------|----------|
| 1차 | 5건 | 초기 분석 |
| 2차 | 7건 (+2) | 함수 본체 줄 단위 대조 → DELTA-2 버전 오류 수정, DELTA-4 심각도 상향, DELTA-6/7 신규 발견 |
| 3차 | 10건 (+3) | 확장/시퀀스 의존성 조사 + 앱 레이어 교차 검증 → DELTA-8/9/10 + APP-BUG 3건 |
| **4차** | **10건 (변동 없음)** | **V2 CHECK 29건 vs V3 타입 전수 교차 + generate_product_id 데드코드 확정 + RLS ENABLE 명시. 신규 DELTA/BUG 없음 → 안정화 확인** |

### 1차 분석 대비 수정 사항 (4건, 2차에서 확정)

| # | 수정 내용 | 1차 분석 | 2차 검증 결과 |
|---|----------|---------|-------------|
| 1 | DELTA-2 V2 함수 버전 | "011 버전" | **005 원본** (`settlement_status` 확인, line 131) |
| 2 | DELTA-2 에러 수 | "3가지 차이" | **5가지 에러** (+settlement_status→status, +item_count 누락) |
| 3 | DELTA-4 차이 수준 | "시그니처 차이" | **완전히 다른 구현** (V2: YYMMDD-랜덤, V3: CT-셀러코드-순번) |
| 4 | V2 전용 함수 누락 | 미조사 | **6개 함수 발견** (NEW DELTA-6) |
| 5 | 미적용 마이그레이션 수 | "4건 (012-016)" | **6건 (011-016)** |

---

## 확정 델타 목록 (10건)

### DELTA-1: orders_status_check CHECK 제약조건 (신규 추가)

**V3 마이그레이션**: 016_orders_status_extend.sql
**V2 상태**: `orders_status_check` 제약조건 **존재하지 않음**
**증거**: v2_constraints.txt — orders 테이블에 3건만 존재 (seller_type_check, pkey, order_number_key)

```sql
-- Tokyo에 추가할 내용 (정확히 10값):
CHECK (status IN (
  'APPLIED','SHIPPING','COLLECTED','INSPECTED',
  'PRICE_ADJUSTING','RE_INSPECTED','IMAGE_PREPARING','IMAGE_COMPLETE',
  'CONFIRMED','CANCELLED'
))
```

---

### DELTA-2: create_settlement_with_items 함수 (005 원본 → 012 교체)

**V3 마이그레이션**: 012_fix_rpc_settlement_v2.sql
**V2 상태**: **005 원본** 사용 중 (011도 미적용)

**증거** (v2_functions.txt):
- Line 129: `seller_id, period_start, period_end,` → 잘못된 컬럼명
- Line 131: `settlement_status` → **잘못된 컬럼명** (실제: `status`)
- Line 135: `'pending'` → **CHECK 위반** (허용값: draft/confirmed/paid/failed)

**에러 5가지**:

| # | V2 함수 (005 원본) | V2 DB 실제 | 에러 유형 |
|---|-------------------|-----------|----------|
| 1 | `period_start` | `settlement_period_start` | 컬럼명 불일치 → INSERT 실패 |
| 2 | `period_end` | `settlement_period_end` | 컬럼명 불일치 → INSERT 실패 |
| 3 | `settlement_status` | `status` | 컬럼명 불일치 → INSERT 실패 |
| 4 | `'pending'` | CHECK: draft/confirmed/paid/failed | CHECK 위반 → INSERT 실패 |
| 5 | `item_count` 없음 | `item_count INTEGER NOT NULL DEFAULT 0` | NOT NULL 컬럼 누락 (DEFAULT 0으로 안전하나 의도 불일치) |

**심각도**: CRITICAL — 이 함수 호출 시 **3중 에러** 발생 (컬럼명 3건 + CHECK 1건)

---

### DELTA-3: complete_consignment 함수 (007 원본 → 013 교체)

**V3 마이그레이션**: 013_fix_rpc_consignment_v2.sql
**V2 상태**: **007 원본** 사용 중 (11 파라미터)

**증거** (v2_functions.txt):
- Line 3: 시그니처 11 파라미터
- Line 27: `condition` 사용 → 실제 V2 컬럼: `product_condition`
- Line 28: `consignment_id` 사용 → 실제 V2 컬럼: `consignment_date`
- Line 43: `'RECEIVED'` 사용 → V3 의도: `'APPLIED'`

**에러 5가지**:

| # | V2 함수 (007 원본) | V2 DB 실제 | 에러 유형 |
|---|-------------------|-----------|----------|
| 1 | 11 파라미터 | 013은 14 파라미터 | 기능 부족 |
| 2 | `condition` | `product_condition` (v2_columns.txt line 375) | 컬럼명 불일치 → INSERT 실패 |
| 3 | `consignment_id` | `consignment_date` (v2_columns.txt line 365) | 컬럼명 불일치 → INSERT 실패 |
| 4 | `'RECEIVED'` | orders status 체계 | 값 불일치 |
| 5 | product_name/sale_price/seller_id 미포함 | NOT NULL 컬럼들 | NOT NULL 위반 가능 |

**심각도**: CRITICAL — 이 함수 호출 시 **런타임 에러** 발생

---

### DELTA-4: generate_product_number 함수 (완전히 다른 구현)

**V3 마이그레이션**: 015_rpc_generate_product_number.sql
**V2 상태**: 함수 존재하나 **구현이 완전히 다름**

**V2 구현** (v2_functions.txt lines 204-231):
```
generate_product_number(p_seller_id uuid DEFAULT NULL::uuid)
→ 형식: YYMMDD-ABCDEF (날짜-랜덤6자)
→ 로직: 랜덤 대문자 6자 생성, st_products 중복 체크, 최대 100회 시도
→ p_seller_id 파라미터 있으나 본체에서 사용하지 않음 (무시됨)
```

**V3 구현** (015 마이그레이션):
```
generate_product_number(p_seller_id UUID)  -- 필수 파라미터
→ 형식: CT-{SELLER_CODE}-{SEQ:3} (위탁-셀러코드-순번)
→ 로직: sellers.seller_code 조회, pg_advisory_xact_lock 동시성 보호, 순번 채번
→ p_seller_id 기반 seller_code 사용 (필수)
```

| 비교 항목 | V2 | V3 |
|----------|----|----|
| 형식 | `YYMMDD-ABCDEF` | `CT-S001-001` |
| 생성 방식 | 랜덤 | 순번 |
| seller_id 사용 | 무시 | 필수 (seller_code 조회) |
| 동시성 보호 | 없음 | pg_advisory_xact_lock |
| GRANT | 없음 | authenticated, service_role |

**심각도**: HIGH — 상품번호 체계 자체가 변경됨. Tokyo에는 V3 버전 사용.

---

### DELTA-5: idx_consignment_seller 인덱스 (컬럼 구성 차이)

**V3 마이그레이션**: 003_performance_indexes.sql
**V2 상태**: 인덱스 존재하나 **컬럼 구성 상이**
**증거**: v2_indexes.txt line 13 — `btree (seller_id)` (단일) vs V3 의도 `(seller_id, status)` (복합)

Tokyo: 복합 인덱스 `(seller_id, status)`로 생성.

---

### DELTA-6: V2 전용 함수 6건 — V3 마이그레이션에 미포함

**2차 검증에서 발견.** V2에 11개 함수가 존재하나, V3 마이그레이션은 5개만 다룸. 나머지 6개가 누락.

| # | 함수명 | 시그니처 | 용도 | V2 라인 |
|---|--------|---------|------|---------|
| 1 | `find_brand` | `(search_term text) → TABLE(official_name, alias)` | brand_aliases 검색 (ILIKE, LIMIT 10) | 149-168 |
| 2 | `generate_order_number` | `() → text` | 주문번호 생성 (YYYYMMDD-000000 형식) | 169-183 |
| 3 | `generate_product_id` | `() → text` | 상품ID 생성 (YYYYMMDD-ABCDEF 형식) ⚠️ | 184-203 |
| 4 | `get_commission_rate` | `(p_seller_id uuid) → numeric` | 수수료율 조회 (개별율 우선, 등급별 기본값) | 233-258 |
| 5 | `pgp_sym_decrypt_text` | `(cipher_text, key) → text` | pgcrypto 복호화 래퍼 | 260-266 |
| 6 | `pgp_sym_encrypt_text` | `(plain_text, key) → text` | pgcrypto 암호화 래퍼 | 267-273 |

**⚠️ generate_product_id 주의**: 본체에서 `order_items WHERE product_id = pid` 참조 (line 198). 그러나 V2 order_items 테이블에 `product_id` 컬럼 없음 (실제: `product_number`). **데드 코드 가능성** — 호출 시 에러 발생.

**Tokyo 조치**: 6건 모두 Tokyo 통합 DDL에 포함. 단, `generate_product_id`는 데드 코드 여부 확인 후 판단.

---

### DELTA-7: orders_updated_at 트리거 — V3 마이그레이션 014 누락

**V2 상태**: `orders_updated_at` 트리거가 orders 테이블에 존재 (v2_triggers.txt line 8)
**V3 마이그레이션 014**: sellers, st_products, consignment_requests 3개만 포함. orders 누락.

Tokyo: V2 DDL에서 4개 트리거 모두 포함.

---

### DELTA-8 (3차 신규): uuid-ossp 확장 의존성

**V2 상태**: 9개 테이블의 PK DEFAULT가 `extensions.uuid_generate_v4()` 사용

| # | 테이블 | column_default | v2_columns.txt 라인 |
|---|--------|---------------|-------------------|
| 1 | consignment_requests | `extensions.uuid_generate_v4()` | 17 |
| 2 | excel_uploads | `extensions.uuid_generate_v4()` | 45 |
| 3 | mismatches | `extensions.uuid_generate_v4()` | 79 |
| 4 | sales_ledger | `extensions.uuid_generate_v4()` | 215 |
| 5 | sellers | `extensions.uuid_generate_v4()` | 262 |
| 6 | settlement_items | `extensions.uuid_generate_v4()` | 295 |
| 7 | settlements | `extensions.uuid_generate_v4()` | 320 |
| 8 | sold_items | `extensions.uuid_generate_v4()` | 336 |
| 9 | st_products | `extensions.uuid_generate_v4()` | 356 |

**나머지 15개 테이블**: `gen_random_uuid()` 사용 (PG 내장, 확장 불필요)

**Tokyo 조치**:
```sql
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
```

**심각도**: CRITICAL — 이 확장 없이 9개 테이블 INSERT 시 `function extensions.uuid_generate_v4() does not exist` 에러

---

### DELTA-9 (3차 신규): 시퀀스 의존성 (비-UUID PK 2건)

**V2 상태**: 2개 테이블이 bigint PK + 시퀀스 사용

| # | 테이블 | PK 타입 | column_default | v2_columns.txt 라인 |
|---|--------|---------|---------------|-------------------|
| 1 | price_references | bigint | `nextval('price_references_id_seq'::regclass)` | 186 |
| 2 | search_synonyms | bigint | `nextval('search_synonyms_id_seq'::regclass)` | 257 |

**Tokyo 조치**: CREATE TABLE 전에 시퀀스 생성, 또는 `BIGSERIAL` 타입 사용 (자동 시퀀스 생성)
```sql
CREATE SEQUENCE IF NOT EXISTS price_references_id_seq;
CREATE SEQUENCE IF NOT EXISTS search_synonyms_id_seq;
```

**심각도**: HIGH — 시퀀스 없이 테이블 생성 시 `nextval` DEFAULT 에러

---

### DELTA-10 (3차 신규): pgcrypto 확장 의존성

**V2 상태**: 2개 함수가 pgcrypto 확장 함수 호출

| # | V2 함수 | 호출하는 pgcrypto 함수 | v2_functions.txt 라인 |
|---|--------|----------------------|---------------------|
| 1 | `pgp_sym_decrypt_text` | `pgp_sym_decrypt(decode(...), ...)` | 264 |
| 2 | `pgp_sym_encrypt_text` | `pgp_sym_encrypt(plain_text, ...)` | 271 |

**Tokyo 조치**:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

**심각도**: MEDIUM — pgcrypto 함수 호출 시 에러. Supabase 신규 프로젝트에서 기본 활성화될 수 있으나 보장 불가.

---

## 앱 레이어 버그 (3차 검증에서 발견, 3건)

V2 DB 컬럼과 V3 앱 코드 교차 검증에서 발견된 런타임 버그.
**이 버그들은 DB DDL이 아닌 TypeScript 코드 수정 대상**.

### APP-BUG-1: settlements.updated_at 컬럼 미존재

**파일**: `apps/web/lib/db/repositories/settlement.repo.ts` line 12
**현재 코드**:
```typescript
const SETTLEMENT_COLUMNS = '...item_count, status, created_at, updated_at'
```

**V2 DB 실제** (v2_columns.txt lines 320-335):
- settlements 테이블: **16개 컬럼**, `updated_at` **없음**
- 마지막 컬럼: `confirmed_at` (ordinal 16)
- V2 settlements에는 `confirmed_at`, `paid_at`이 있으나 generic `updated_at`은 없음

**영향**: PostgREST가 존재하지 않는 컬럼 select 시 에러 반환 → **모든 settlement 조회 실패**

**수정안**: SETTLEMENT_COLUMNS에서 `updated_at` 제거, `confirmed_at` 추가. mapSettlementRow의 updatedAt fallback도 수정.

---

### APP-BUG-2: sold_items 컬럼명 불일치 (2건)

**파일**: `apps/web/lib/db/repositories/settlement.repo.ts` line 14
**현재 코드**:
```typescript
const SOLD_ITEM_COLUMNS = 'id, naver_order_id, sale_price, seller_product_code, settlement_status, sold_at, seller_id'
```

**V2 DB 실제** (v2_columns.txt lines 336-355):
- `naver_order_id` → **미존재**. 가장 유사: `order_id` (line 339) 또는 `naver_product_id` (line 354)
- `seller_product_code` → **미존재**. 가장 유사: `product_code` (line 355) 또는 `product_number` (line 341)

**V2 sold_items 전체 20개 컬럼**:
```
id, seller_id, channel, order_id, product_name, product_number,
quantity, sale_price, shipping_fee, sold_at, purchase_confirmed,
purchase_confirmed_at, settlement_status, settlement_id, return_processed,
source_file, created_at, product_order_id, naver_product_id, product_code
```

**영향**: PostgREST가 존재하지 않는 컬럼 select 시 에러 반환 → **모든 sold_items 조회 실패**

**수정안**: `naver_order_id` → `order_id`, `seller_product_code` → `product_number` (또는 `product_code`)

---

### APP-BUG-3: SOLD_ITEM_STATUSES 불완전 (2값 vs V2 CHECK 4값)

**파일**: `apps/web/lib/types/domain/settlement.ts` line 11
**현재 코드**:
```typescript
export const SOLD_ITEM_STATUSES = ['pending', 'settled'] as const
```

**V2 DB CHECK** (v2_constraints.txt line 87):
```sql
CHECK ((settlement_status = ANY (ARRAY['pending'::text, 'calculated'::text, 'settled'::text, 'returned'::text])))
```

**누락 값**: `calculated`, `returned` (2개)

**영향**: V2 DB에서 `calculated` 또는 `returned` 상태의 sold_item 조회 시, TypeScript 타입 시스템에서 잡을 수 없음. 타입 안전성 위반.

**수정안**:
```typescript
export const SOLD_ITEM_STATUSES = ['pending', 'calculated', 'settled', 'returned'] as const
```

---

## V2 함수 전체 목록 (11개) vs V3 마이그레이션 커버리지

| # | 함수명 | V3 마이그레이션 | 커버 상태 |
|---|--------|---------------|----------|
| 1 | complete_consignment | 007 → 013 | ❌ 013 미적용 (DELTA-3) |
| 2 | create_order_with_items | 006 | ✅ V2=V3 일치 |
| 3 | create_settlement_with_items | 005 → 011 → 012 | ❌ 011, 012 미적용 (DELTA-2) |
| 4 | **find_brand** | **없음** | ❌ **V3 누락** (DELTA-6) |
| 5 | **generate_order_number** | **없음** | ❌ **V3 누락** (DELTA-6) |
| 6 | ~~generate_product_id~~ | **없음** | ❌ **데드코드 확정 (4차)** — 제외 |
| 7 | generate_product_number | 015 | ❌ 015 미적용, 구현 완전 상이 (DELTA-4) |
| 8 | **get_commission_rate** | **없음** | ❌ **V3 누락** (DELTA-6) |
| 9 | **pgp_sym_decrypt_text** | **없음** | ❌ **V3 누락**, pgcrypto 의존 (DELTA-6, DELTA-10) |
| 10 | **pgp_sym_encrypt_text** | **없음** | ❌ **V3 누락**, pgcrypto 의존 (DELTA-6, DELTA-10) |
| 11 | update_updated_at | 014 | ✅ V2=V3 일치 |

**요약**: 11개 함수 중 **2개만 V3와 일치** (create_order_with_items, update_updated_at)

---

## V3 마이그레이션 16건 적용 상태 (4차 검증 확정)

| # | 마이그레이션 | V2 Mumbai 상태 | 증거 | Tokyo 조치 |
|---|-------------|---------------|------|-----------|
| 001 | consignment_status_check | ✅ 적용됨 | 7값 CHECK 존재 | V2 그대로 |
| 002 | unique_constraints | ✅ 적용됨 | 5건 UNIQUE 존재 | V2 그대로 |
| 003 | performance_indexes | ⚠️ 부분 | 4/5 일치, 1건 컬럼 차이 | DELTA-5 |
| 004 | rls_policies | ✅ 적용됨 | consignment_anon_read 존재 | V2 그대로 |
| 005 | rpc_settlement (v1) | ✅ 적용됨 | **이것이 현재 V2 함수** | 012로 교체 |
| 006 | rpc_order | ✅ 적용됨 | 함수 내용 일치 | V2 그대로 |
| 007 | rpc_consignment (v1) | ✅ 적용됨 | **이것이 현재 V2 함수** | 013으로 교체 |
| 008 | upload_session_id | ✅ 적용됨 | 컬럼+인덱스 존재 | V2 그대로 |
| 009 | batch_progress | ✅ 적용됨 | 테이블 존재 | V2 그대로 |
| 010 | public_orders_rls | ✅ 적용됨 | hold_token+RLS 존재 | V2 그대로 |
| 011 | fix_rpc_settlement (v2) | ❌ **미적용** | V2 함수에 `settlement_status` 잔존 (line 131) | 012로 대체 |
| 012 | fix_rpc_settlement_v2 (v3) | ❌ **미적용** | V2 함수에 `period_start` 잔존 (line 129) | **DELTA-2** |
| 013 | fix_rpc_consignment_v2 | ❌ **미적용** | V2 함수 11파라미터 (line 3) | **DELTA-3** |
| 014 | updated_at_triggers | ✅ V2 원본 존재 | 4개 트리거+함수 확인 | V2 그대로 + orders |
| 015 | rpc_generate_product_number | ❌ **미적용** | V2 함수 완전 다른 구현 | **DELTA-4** |
| 016 | orders_status_extend | ❌ **미적용** | constraints 덤프에 없음 | **DELTA-1** |

**미적용: 6건 (011-016)**.

---

## V2에 이미 존재하는 항목 (변경 불필요, 그대로 사용)

### CHECK 제약조건 (7건) — 모두 V3 일치 ✅

| # | 테이블 | 제약조건명 | 값 |
|---|--------|-----------|---|
| 1 | consignment_requests | consignment_requests_status_check | 7값 |
| 2 | consignment_requests | consignment_requests_source_check | 4값 |
| 3 | consignment_requests | consignment_requests_seller_response_check | 3값+NULL |
| 4 | settlements | settlements_status_check | 4값 (draft/confirmed/paid/failed) |
| 5 | orders | orders_seller_type_check | 3값 (general/employee/vip) |
| 6 | sold_items | sold_items_settlement_status_check | 4값 |
| 7 | sold_items | sold_items_channel_check | 2값 |

### UNIQUE 제약조건 (5건) — 모두 존재 ✅
### 인덱스 (4/5건) — idx_consignment_seller만 차이 ⚠️
### RLS 정책 (3건) — 모두 존재 ✅
### 트리거 (4건) — 모두 존재 ✅ (orders_updated_at 포함)
### 컬럼 추가 (2건) — upload_session_id, hold_token 모두 존재 ✅
### 테이블 (1건) — _batch_progress 존재 ✅

---

## Tokyo 통합 DDL 작성 전략 (4차 확정)

### 0. 사전 의존성 (확장 + 시퀀스) — DELTA-8, 9, 10
```sql
-- 반드시 테이블 생성 전에 실행
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SEQUENCE IF NOT EXISTS price_references_id_seq;
CREATE SEQUENCE IF NOT EXISTS search_synonyms_id_seq;
```

### 1. V2 DDL에서 그대로 가져올 것
- 26개 테이블 CREATE TABLE (컬럼, 기본값, NOT NULL 포함)
- 모든 PK, FK, UNIQUE 제약조건 (98건)
- 모든 CHECK 제약조건 (orders_status_check 제외)
- 모든 인덱스 129건 (idx_consignment_seller만 복합으로 변경)
- 모든 RLS 정책 34건 (17개 테이블)
- **26개 테이블 RLS ENABLE** (Supabase 보안 기본)
- 트리거 4건 (sellers, st_products, consignment_requests, **orders**)
- 함수 2건: `update_updated_at`, `create_order_with_items`

### 2. V3 버전으로 교체해야 할 것 (3건)
1. `create_settlement_with_items` → 012 버전
2. `complete_consignment` → 013 버전
3. `idx_consignment_seller` → `(seller_id, status)` 복합 인덱스

### 3. V3에서 신규 추가해야 할 것 (2건)
1. `orders_status_check` CHECK 제약조건 (10값)
2. `generate_product_number` → 015 버전 (완전 새 구현 + GRANT)

### 4. V2 전용 함수 포함 (5건)
1. `find_brand` — 브랜드 검색 (운영 필수)
2. `generate_order_number` — 주문번호 생성 (운영 필수)
3. `get_commission_rate` — 수수료율 조회 (운영 필수)
4. `pgp_sym_decrypt_text` — pgcrypto 래퍼 (보안 기능, DELTA-10 확장 필요)
5. `pgp_sym_encrypt_text` — pgcrypto 래퍼 (보안 기능, DELTA-10 확장 필요)

### 5. 제외 항목 (4차 확정)
- ~~`generate_product_id`~~ — **데드코드 확정, 제외** (아래 증거 참조)

---

## V2 Mumbai에도 적용 필요한 미적용 마이그레이션 (6건)

| # | 마이그레이션 | 현재 상태 | 영향 |
|---|-------------|----------|------|
| 011 | fix_rpc_settlement | settlement_status 컬럼명 에러 | RPC 호출 시 INSERT 실패 |
| 012 | fix_rpc_settlement_v2 | period_start 컬럼명 에러 | RPC 호출 시 INSERT 실패 |
| 013 | fix_rpc_consignment_v2 | condition/consignment_id 에러 | RPC 호출 시 INSERT 실패 |
| 015 | rpc_generate_product_number | 구버전 (랜덤) | 기능적 차이 |
| 016 | orders_status_extend | status CHECK 없음 | 아무 값이나 INSERT 가능 |

**경고**: 011-013 미적용은 V2 Mumbai에서 정산/위탁 RPC 호출 시 **런타임 에러**가 발생함을 의미.
이 함수들이 V2 프로덕션에서 아직 호출되지 않았기 때문에 에러가 표면화되지 않은 것임.

---

## 4차 검증 신뢰도

| 항목 | 검증 방법 | 4차 재검증 | 신뢰도 |
|------|----------|-----------|--------|
| DELTA-1 (orders CHECK) | constraints 덤프 전수 검색 | ✅ 재확인 | **확정** |
| DELTA-2 (settlement RPC) | 함수 본체 line 129, 131, 135 대조 | ✅ 재확인 | **확정** |
| DELTA-3 (consignment RPC) | 함수 시그니처 + 본체 line 27-28, 43 대조 | ✅ 재확인 | **확정** |
| DELTA-4 (product number) | 함수 본체 전체 (lines 204-231 vs 015) | ✅ 재확인 | **확정** |
| DELTA-5 (인덱스) | indexes 덤프 line 13 대조 | ✅ 재확인 | **확정** |
| DELTA-6 (V2 전용 함수) | 함수 전체 목록 11건 대조 | ✅ generate_product_id 데드코드 확정 | **확정** |
| DELTA-7 (orders 트리거) | triggers 덤프 line 8 대조 | ✅ 재확인 | **확정** |
| DELTA-8 (uuid-ossp) | v2_columns.txt 9건 `extensions.uuid_generate_v4()` grep 확인 | ✅ 재확인 | **확정** |
| DELTA-9 (시퀀스) | v2_columns.txt 2건 `nextval` grep 확인 | ✅ 재확인 | **확정** |
| DELTA-10 (pgcrypto) | v2_functions.txt line 264, 271 `pgp_sym_encrypt`/`decrypt` 호출 확인 | ✅ 재확인 | **확정** |
| APP-BUG-1 (settlements.updated_at) | v2_columns.txt lines 320-335 전수 대조 — 16컬럼, updated_at 미존재 | ✅ 재확인 | **확정** |
| APP-BUG-2 (sold_items 컬럼명) | v2_columns.txt lines 336-355 전수 대조 — naver_order_id, seller_product_code 미존재 | ✅ 재확인 | **확정** |
| APP-BUG-3 (SOLD_ITEM_STATUSES) | v2_constraints.txt line 87 CHECK 4값 vs settlement.ts line 11 2값 | ✅ 재확인 | **확정** |

---

## generate_product_id 데드코드 확정 (4차 검증)

**의사결정**: EXCLUDE — **데드코드 확정**

**증거 체인 (4단계)**:

1. **함수 본체** (v2_functions.txt line 198):
```sql
EXIT WHEN NOT EXISTS (SELECT 1 FROM order_items WHERE product_id = pid);
```

2. **V2 order_items 실제 컬럼** (v2_columns.txt lines 117-139):
   - `product_number` (ordinal 3) — 존재
   - `product_id` — **미존재** (23개 컬럼 전수 확인)

3. **V2 인덱스 증거** (v2_indexes.txt lines 37-38):
```
idx_order_items_product_id  → btree (product_number)  ← 이름은 product_id, 실제는 product_number
order_items_product_id_key  → btree (product_number)  ← 이름은 product_id, 실제는 product_number
```
   → **결론**: `product_id` 컬럼이 `product_number`로 **리네임됨**. 인덱스 이름은 갱신 안 됨.

4. **V3 앱 코드** (apps/web/ 전체 grep):
   - `generate_product_id` 참조: **0건**
   - `product_id` 참조: **0건**
   → 앱에서도 사용하지 않음

**함수 호출 시 예상 에러**: `ERROR: column "product_id" of relation "order_items" does not exist`

---

## V2 CHECK 29건 vs V3 타입 전수 교차 대조 (4차 검증)

29개 V2 CHECK 제약조건을 V3 타입 정의 7파일과 1:1 교차 대조.

### 일치 (6건) ✅

| V2 CHECK | V3 타입 | 일치 |
|----------|---------|------|
| `_batch_progress_status_check` (4값) | photo.ts `BATCH_STATUSES` (4값) | ✅ |
| `consignment_requests_status_check` (7값) | consignment.ts `CONSIGNMENT_STATUSES` (7값) | ✅ |
| `notification_logs_status_check` (3값) | notification.ts `SmsStatus` (3값) | ✅ |
| `sellers_seller_tier_check` (3값) | seller.ts `SellerTier` (3값) | ✅ |
| `settlements_status_check` (4값) | settlement.ts `SETTLEMENT_STATUSES` (4값) | ✅ |
| `orders_seller_type_check` (3값) | seller.ts `SellerTier` (3값) | ✅ (Order.sellerType은 string이나 값은 동일) |

### 불일치 (1건) ❌ — APP-BUG-3

| V2 CHECK | V3 타입 | 차이 |
|----------|---------|------|
| `sold_items_settlement_status_check` (4값: pending/calculated/settled/returned) | settlement.ts `SOLD_ITEM_STATUSES` (2값: pending/settled) | ❌ `calculated`, `returned` 누락 |

### 잠재 이슈 (3건) ⚠️ — 런타임 리스크 없음

| V2 CHECK | V3 상태 | 리스크 |
|----------|---------|--------|
| `order_items_inspection_status_check` (3값) | order.ts `inspectionStatus: string` | 타입 약함 (string). 런타임 에러 없음 |
| `sellers_status_check` (5값) | seller.ts에 status 필드 없음, sellers.repo.ts COLUMNS에도 미포함 | select 안 함 → 런타임 에러 없음 |
| `settlement_queue_queue_status_check` (3값: pending/confirmed/paid) | settlement.ts `SettlementQueue.status: SettlementStatus` (4값: draft/confirmed/paid/failed) | repo 미존재 → 런타임 에러 없음 |

### 타입 미정의 (19건) ℹ️ — Phase 3+ 서비스 미구현 영역

해당 테이블/컬럼의 서비스 레이어가 아직 구현되지 않아 타입 정의 불필요.
`consignment_source`, `seller_response`, `excel_uploads`, `mismatches`, `naver_settlements`, `return_shipments`, `sales_ledger`, `sales_records`, `settlement_matches`, `st_products (4건)`, `sellers_channel_type` 등.

---

## RLS ENABLE 전략 (4차 확인)

V2 RLS 정책 34건이 17개 테이블에 분포. Tokyo DDL에서 **26개 테이블 전부 RLS ENABLE** 필요 (Supabase 보안 기본).

### RLS 정책 있는 테이블 (17개, 34 정책)

| 테이블 | 정책 수 | 주요 정책 |
|--------|---------|----------|
| consignment_requests | 3 | service_all, admin_all, anon_read (adjustment_token) |
| excel_uploads | 2 | admin_all, service_all |
| market_prices | 2 | public write, public read |
| mismatches | 2 | service_all, admin_all |
| order_items | 1 | Allow all (true) |
| orders | 2 | anon_update (hold_token), anon_read (hold_token) |
| photo_uploads | 1 | Allow all (true) |
| photos | 1 | Allow all (true) |
| price_estimate_cache | 1 | service_role full access |
| price_references | 2 | public write, public read |
| sales_ledger | 2 | admin_all, service_all |
| search_synonyms | 1 | anon read |
| sellers | 3 | service_all, seller_read_own, admin_all |
| settlement_items | 2 | admin_all, service_all |
| settlements | 3 | service_all, seller_read_own, admin_all |
| sold_items | 3 | admin_all, seller_read_own, service_all |
| st_products | 3 | service_all, seller_read_own, admin_all |

### RLS 정책 없는 테이블 (9개)

`_batch_progress`, `brand_aliases`, `naver_settlements`, `notification_logs`, `return_shipments`, `sales_records`, `settlement_audit_log`, `settlement_matches`, `settlement_queue`

→ RLS ENABLE 상태에서 정책 없음 = **service_role만 접근 가능** (Supabase 기본 동작)

---

## UUID 생성 방식 전체 매핑 (4차 검증)

| UUID 방식 | 테이블 수 | 확장 필요 |
|-----------|----------|----------|
| `extensions.uuid_generate_v4()` | 9 | uuid-ossp |
| `gen_random_uuid()` | 15 | 없음 (PG 내장) |
| `nextval('..._seq')` (bigint) | 2 | 시퀀스 |
| **합계** | **26** | — |

**9개 테이블** (uuid-ossp): consignment_requests, excel_uploads, mismatches, sales_ledger, sellers, settlement_items, settlements, sold_items, st_products

**15개 테이블** (gen_random_uuid): _batch_progress, brand_aliases, market_prices, naver_settlements, notification_logs, order_items, orders, photo_uploads, photos, price_estimate_cache, return_shipments, sales_records, settlement_audit_log, settlement_matches, settlement_queue

**2개 테이블** (bigint seq): price_references, search_synonyms

---

## settlements 테이블 V2 컬럼 전체 (16개, 3차 확인)

| ordinal | column_name | data_type | nullable | default |
|---------|------------|-----------|----------|---------|
| 1 | id | uuid | NOT NULL | extensions.uuid_generate_v4() |
| 2 | seller_id | uuid | NOT NULL | — |
| 3 | settlement_period_start | date | NOT NULL | — |
| 4 | settlement_period_end | date | NOT NULL | — |
| 5 | total_sales | integer | NOT NULL | 0 |
| 6 | commission_rate | numeric | NOT NULL | — |
| 7 | commission_amount | integer | NOT NULL | 0 |
| 8 | return_deduction | integer | NOT NULL | 0 |
| 9 | settlement_amount | integer | NOT NULL | 0 |
| 10 | item_count | integer | NOT NULL | 0 |
| 11 | status | text | nullable | 'draft' |
| 12 | paid_at | timestamptz | nullable | — |
| 13 | paid_by | text | nullable | — |
| 14 | transfer_reference | text | nullable | — |
| 15 | created_at | timestamptz | nullable | now() |
| 16 | confirmed_at | timestamptz | nullable | — |

**`updated_at` 없음 — APP-BUG-1 확정 근거**
