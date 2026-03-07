# Phase 1 V2 계승 수정 계획서

**작성일**: 2026-03-04
**목적**: V3 Phase 1을 V2 시스템 체계에 정렬하는 수정 계획 및 리스크 분석
**상태**: 승인 대기 (수정 전 보고 단계)

---

## 사용자 지시 요약

| # | 항목 | 지시 내용 |
|---|------|---------|
| 1 | 브랜드 별칭 | V2 클래식 브랜드 43개 계승. 럭셔리 브랜드 취급 안 함. 병합 리스크 없으면 병합, 있으면 V3 포기 |
| 2 | 상품/주문번호 | V2 체계(YYYYMMDD) 따름. 위탁 RPC 이관 면밀 분석. crypto.randomInt 보안 유지 |
| 3 | OrderStatus | V2 8개 계승 + CANCELLED/CONFIRMED 추가. ALLOWED_TRANSITIONS 옵션 C(V2 워크플로우 기반) |
| 4 | Condition | V2 N/S/A/B 고정. Brand New 라벨 → "NEW"로 변경 |
| 5 | Phase 0 RPC 007 | 'RECEIVED' → V2 상태로 변경. 확실히 추적 체크하고 따로 보고 |
| 6 | 후속 | Phase 1 수정 후 Phase 2도 동일 수정 진행 |

---

## SECTION 1: 브랜드 별칭 (RISK-1)

### 1.1 리서치 결과

| | V2 | V3 | 교차 분석 |
|---|---|---|---|
| 구조 | `Record<string, string[]>` (정규명→별칭배열) | `Record<string, string>` (별칭→정규명) | 역방향 구조 |
| 브랜드 수 | 43개 (클래식 남성복 중심) | 23개 (럭셔리 중심) | 겹침 7개 |
| V2에만 | 36개 | — | drake's, ralph lauren, engineered garments 등 핵심 클래식 |
| V3에만 | — | 16개 | dior, chanel, balenciaga 등 럭셔리 |

### 1.2 병합 안전성 분석

| 검증 항목 | 결과 |
|----------|------|
| 키 충돌 (같은 별칭 → 다른 정규명) | **0건** — 안전 |
| 겹치는 7개 브랜드 매핑 일치 | **100%** — 충돌 없음 |
| 한글 표기 차이 | 1건 (보테가베네타 vs 보테가 베네타) — 양쪽 모두 포함하면 해결 |

**결론: 병합 리스크 없음. 안전하게 병합 가능.**

### 1.3 수정 방안

**사용자 지시**: 럭셔리 취급 안 함. 병합 리스크 없으면 병합 OK.
**판단**: 리스크 0이므로 병합 진행 (V2 43개 + V3 고유 16개 = 59개 정규 브랜드)

**변경 파일**:

| 파일 | 변경 |
|------|------|
| `lib/utils/brand.ts` | BRAND_ALIAS_MAP에 V2 36개 브랜드를 V3 역방향 구조로 추가 |
| `__tests__/unit/utils.test.ts` | normalizeBrand 테스트 케이스 추가 (V2 클래식 브랜드 검증) |

**normalizeBrand() 함수**: 변경 불필요 (맵 확장만으로 동작)

### 1.4 리스크

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| 없음 | — | 키 충돌 0건 확인 완료 |

---

## SECTION 2: 상품/주문번호 채번 (RISK-2)

### 2.1 V2 채번 체계 (확정)

| 종류 | 형식 | 생성 방식 | 예시 |
|------|------|---------|------|
| 주문번호 | `YYYYMMDD-XXXXXX` (8자리일+6숫자) | 랜덤 | `20260304-482917` |
| 상품번호 (직접접수) | `YYYYMMDD-AAAAAA` (8자리일+6알파벳) | 랜덤 | `20260304-TKBMXF` |
| 상품번호 (위탁) | `CT-{SELLER_CODE}-{SEQ:3}` | DB RPC 순번 | `CT-NF001-001` |

### 2.2 V3 수정 방안

**id.ts 전면 재작성**:

```typescript
// 주문번호: YYYYMMDD-XXXXXX (6자리 숫자)
export function generateOrderNumber(date?: Date): string {
  const d = date ?? new Date()
  const prefix = d.toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = String(randomInt(100000, 999999))
  return `${prefix}-${suffix}`
}

// 상품번호 (직접접수): YYYYMMDD-AAAAAA (6자리 대문자 알파벳)
export function generateProductNumber(date?: Date): string {
  const d = date ?? new Date()
  const prefix = d.toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = Array.from({ length: 6 }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[randomInt(0, 26)]
  ).join('')
  return `${prefix}-${suffix}`
}
```

- `crypto.randomInt` 유지 (V2의 Math.random 보안 취약점 개선)
- 형식은 V2와 동일

### 2.3 위탁 상품번호 RPC 이관 (CRITICAL)

**현상**: V2의 `generate_product_number` RPC가 V3 Phase 0 마이그레이션에 누락

**V2 RPC 원본** (settlement-phase1.sql):
```sql
CREATE OR REPLACE FUNCTION generate_product_number(p_seller_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_seller_code TEXT;
  v_next_seq INTEGER;
  v_product_number TEXT;
BEGIN
  SELECT seller_code INTO v_seller_code
  FROM sellers WHERE id = p_seller_id;

  IF v_seller_code IS NULL THEN
    RAISE EXCEPTION 'Seller not found: %', p_seller_id;
  END IF;

  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(product_number, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO v_next_seq
  FROM st_products
  WHERE product_number LIKE 'CT-' || v_seller_code || '-%';

  v_product_number := 'CT-' || v_seller_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');
  RETURN v_product_number;
END;
$$ LANGUAGE plpgsql;
```

**V3 이관 마이그레이션 (신규 생성 필요)**:

파일: `supabase/migrations/20260304000012_rpc_generate_product_number.sql`

```sql
-- WHY: V2 generate_product_number RPC가 V3 Phase 0에 누락. 위탁 승인 시 상품번호 생성에 필수.
-- HOW: sellers.seller_code 기반 순번 채번 (CT-{SELLER_CODE}-{SEQ:3})
-- WHERE: 위탁 승인 API (PATCH /api/admin/consignments/[id], status=approved)

CREATE OR REPLACE FUNCTION generate_product_number(p_seller_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_seller_code TEXT;
  v_next_seq INTEGER;
  v_product_number TEXT;
BEGIN
  -- Step 1: 셀러 코드 조회
  SELECT seller_code INTO v_seller_code
  FROM sellers WHERE id = p_seller_id;

  IF v_seller_code IS NULL THEN
    RAISE EXCEPTION '셀러를 찾을 수 없습니다: %', p_seller_id;
  END IF;

  -- Step 2: 해당 셀러의 현재 최대 순번 조회 + 1
  -- FOR UPDATE로 동시성 보호 (같은 셀러에 대한 동시 호출 시 직렬화)
  PERFORM pg_advisory_xact_lock(hashtext('gen_prod_num_' || v_seller_code));

  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(product_number, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO v_next_seq
  FROM st_products
  WHERE product_number LIKE 'CT-' || v_seller_code || '-%';

  -- Step 3: 형식 조립 (CT-{SELLER_CODE}-{SEQ:3})
  v_product_number := 'CT-' || v_seller_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');

  RETURN v_product_number;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION generate_product_number(UUID) TO authenticated, service_role;
```

**V2 대비 개선점**: `pg_advisory_xact_lock` 추가 — 동일 셀러에 대한 동시 호출 시 순번 중복 방지 (V2에는 없던 동시성 보호)

### 2.4 의존성 확인

| 테이블/컬럼 | V3 Phase 0 존재 여부 |
|-----------|-------------------|
| `sellers.seller_code` | **존재** (UNIQUE 제약 포함, migration 000002) |
| `st_products.product_number` | **존재** (UNIQUE 제약 포함, migration 000002) |
| `consignment_requests.product_number` | **존재** |

**결론: 의존 테이블 모두 존재. RPC 마이그레이션만 추가하면 동작.**

### 2.5 변경 파일

| 파일 | 변경 |
|------|------|
| `lib/utils/id.ts` | 전면 재작성 (주문번호 + 직접접수 상품번호) |
| `__tests__/unit/utils.test.ts` | 패턴 정규식 업데이트 (`/^\d{8}-\d{6}$/`, `/^\d{8}-[A-Z]{6}$/`) |
| `supabase/migrations/20260304000012_rpc_generate_product_number.sql` | **신규 생성** |

### 2.6 리스크

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| RPC 동시성 (같은 셀러 동시 승인) | MEDIUM | `pg_advisory_xact_lock` 추가로 해결 |
| 순번 3자리 한계 (999개 초과) | LOW | 셀러당 999개 충분. 초과 시 LPAD 자릿수 확장 |
| 주문번호/상품번호 충돌 | 없음 | 숫자(주문) vs 알파벳(상품) vs CT-(위탁)으로 네임스페이스 분리 |

---

## SECTION 3: OrderStatus (RISK-3)

### 3.1 V2 상태값 계승 + 확장

**V2 기본 8개 + V3 추가 2개 = 10개**:

| # | 상태 | 한글 | 출처 | 비고 |
|---|------|------|------|------|
| 1 | APPLIED | 신청 접수 | V2 | 초기 상태 |
| 2 | SHIPPING | 배송중 | V2 | |
| 3 | COLLECTED | 수거완료 | V2 | |
| 4 | INSPECTED | 검수 완료 | V2 | |
| 5 | PRICE_ADJUSTING | 가격 조정 중 | V2 | 보류/재협상 |
| 6 | RE_INSPECTED | 재검수 완료 | V2 | |
| 7 | IMAGE_PREPARING | 이미지 준비 중 | V2 | |
| 8 | IMAGE_COMPLETE | 이미지 완료 | V2 | |
| 9 | CONFIRMED | 최종 확정 | **V3 신규** | 정산 연계용 |
| 10 | CANCELLED | 취소 | **V3 신규** | 운영 필수 |

### 3.2 ALLOWED_TRANSITIONS (옵션 C: V2 워크플로우 기반)

V2 실제 운영 코드 분석 결과:

```typescript
export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  APPLIED:         ['SHIPPING', 'CANCELLED'],
  SHIPPING:        ['COLLECTED', 'CANCELLED'],
  COLLECTED:       ['INSPECTED', 'CANCELLED'],
  INSPECTED:       ['PRICE_ADJUSTING', 'IMAGE_PREPARING', 'CANCELLED'],
  PRICE_ADJUSTING: ['RE_INSPECTED', 'CANCELLED'],
  RE_INSPECTED:    ['IMAGE_PREPARING', 'CANCELLED'],
  IMAGE_PREPARING: ['IMAGE_COMPLETE', 'CANCELLED'],
  IMAGE_COMPLETE:  ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:       [],  // 종료
  CANCELLED:       [],  // 종료
}
```

**V2 코드 근거**:
- `APPLIED → SHIPPING`: OrdersTable.tsx L219 "배송 시작" 버튼
- `SHIPPING → COLLECTED`: OrdersTable.tsx L222 "수거 완료" 버튼
- `COLLECTED → INSPECTED`: useOrderHandlers.ts L54 자동 전이
- `INSPECTED → PRICE_ADJUSTING`: useOrderHandlers.ts L103 보류 시
- `INSPECTED → IMAGE_PREPARING`: 검수 후 바로 이미지 준비 가능
- `PRICE_ADJUSTING → RE_INSPECTED`: useOrderHandlers.ts L132
- `RE_INSPECTED → IMAGE_PREPARING`: OrdersTable.tsx L225
- `IMAGE_PREPARING → IMAGE_COMPLETE`: OrdersTable.tsx L228
- `IMAGE_COMPLETE → CONFIRMED`: **V3 신규** — 정산 확정
- 모든 비종료 상태 → CANCELLED: **V3 신규** — 취소 가능

### 3.3 DB 마이그레이션 (CHECK 확장)

```sql
-- 파일: 20260304000013_orders_status_extend.sql
-- WHY: V2 CHECK 8값에 CONFIRMED, CANCELLED 추가 (V3 운영 필수)
-- HOW: DROP + ADD CHECK constraint
-- WHERE: orders.status 컬럼

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
ADD CONSTRAINT orders_status_check
CHECK (status IN (
  'APPLIED', 'SHIPPING', 'COLLECTED', 'INSPECTED',
  'PRICE_ADJUSTING', 'RE_INSPECTED', 'IMAGE_PREPARING', 'IMAGE_COMPLETE',
  'CONFIRMED', 'CANCELLED'
));
```

### 3.4 변경 파일

| 파일 | 변경 |
|------|------|
| `lib/types/domain/order.ts` | ORDER_STATUSES 10값, ALLOWED_TRANSITIONS 재설계 |
| `__tests__/unit/types.test.ts` | OrderStatus 테스트 — 10값 assertion, 전이 규칙 검증 |
| `supabase/migrations/20260304000013_orders_status_extend.sql` | **신규 생성** |

### 3.5 리스크

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| V3의 HOLD_REQUEST/CHECKING_ITEMS/DELIVERED 참조 코드 | LOW | Phase 3+ 미구현 상태. 현재 참조 파일 없음 |
| Phase 2 orders.repo.ts 캐스팅 | LOW | `as OrderStatus` — V2 값이면 자연스러움 |
| RPC 010 RLS 정책의 `status = 'IMAGE_COMPLETE'` | 없음 | IMAGE_COMPLETE 유지됨 |

---

## SECTION 4: Condition 등급 (RISK-5)

### 4.1 V2 체계로 변경

| 등급 | 라벨 (V2) | 라벨 (수정) | 설명 | 가격 비율 |
|------|---------|----------|------|----------|
| N | Brand New | **NEW** | 미사용, 택채 | 1.00 |
| S | 민트급 | 민트급 | 1~2회 착용 | 0.85 |
| A | 사용감 적음 | 사용감 적음 | 상태 양호 | 0.70 |
| B | 사용감 있음 | 사용감 있음 | 하자 있음 | 0.50 |

**사용자 지시**: N의 라벨을 "Brand New" → "NEW"로 변경

### 4.2 derivePrices 함수 계승

V2에서 검증된 가격 계산 로직 추가:

```typescript
export function derivePrices(originalPrice: number): Record<Condition, number> {
  const round = (v: number) => Math.round(v / 1000) * 1000
  return {
    N: originalPrice,
    S: round(originalPrice * 0.85),
    A: round(originalPrice * 0.70),
    B: round(originalPrice * 0.50),
  }
}

export function deriveOriginalPrice(estimatedPrice: number, condition: Condition): number {
  const ratios: Record<Condition, number> = { N: 1, S: 0.85, A: 0.7, B: 0.5 }
  return Math.round((estimatedPrice / (ratios[condition] ?? 0.7)) / 1000) * 1000
}
```

### 4.3 변경 파일

| 파일 | 변경 |
|------|------|
| `lib/types/domain/order.ts` | Condition → N/S/A/B, CONDITION_LABELS 수정, derivePrices/deriveOriginalPrice 추가 |
| `__tests__/unit/db.test.ts` | 기존 테스트에 'A' 사용 — 변경 불필요 (유효값) |

### 4.4 리스크

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| C/D 등급 제거 | 없음 | V3 미배포. 프로덕션 데이터 없음 |
| V2 DB CHECK 호환 | 없음 | V2 CHECK (N,S,A,B) — 완벽 일치 |

---

## SECTION 5: Phase 0 RPC 007 추적 보고 (CRITICAL)

### 5.1 문제

**파일**: `supabase/migrations/20260304000007_rpc_consignment.sql`
**위치**: complete_consignment 함수 내부

```sql
-- 현재 (버그)
INSERT INTO orders (order_number, customer_name, phone, status)
VALUES (p_order_number, p_customer_name, p_customer_phone, 'RECEIVED')
--                                                          ^^^^^^^^ V2 CHECK에 없는 값
```

### 5.2 영향

| 영향 | 상세 |
|------|------|
| V2 DB 연동 시 | `CHECK violation: RECEIVED not in (APPLIED, SHIPPING, ...)` 에러 |
| V3 DB (현재) | Phase 0에서 orders.status CHECK 미생성 → 에러 없이 통과하나 비정상 값 |
| V2 운영 로직 | V2 위탁 완료 시 orders.status = 'APPLIED' 사용 (route.ts L294) |

### 5.3 수정 방안

**방법 A (권장)**: 새 마이그레이션으로 RPC 재정의

```sql
-- 파일: 20260304000014_fix_rpc_consignment_status.sql
-- WHY: complete_consignment RPC가 'RECEIVED' 사용 — V2 DB CHECK 위반
-- HOW: CREATE OR REPLACE로 'APPLIED'로 변경
-- WHERE: complete_consignment 함수

CREATE OR REPLACE FUNCTION complete_consignment(
  p_consignment_id uuid,
  p_product_number text,
  p_brand text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_condition text DEFAULT NULL,
  p_size text DEFAULT NULL,
  p_color text DEFAULT NULL,
  p_measurements jsonb DEFAULT NULL,
  p_order_number text DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL
) RETURNS uuid AS $$
-- (전체 함수 본문에서 'RECEIVED' → 'APPLIED'로 변경)
-- INSERT INTO orders (..., status) VALUES (..., 'APPLIED')
$$
```

### 5.4 추적 체크리스트

| # | 확인 항목 | 상태 |
|---|----------|------|
| 1 | RPC 007에서 'RECEIVED' 사용 위치 특정 | ✅ 확인 (INSERT INTO orders ... 'RECEIVED') |
| 2 | V2 대응 코드 확인 | ✅ V2는 'APPLIED' 사용 (consignments/[id]/route.ts L294) |
| 3 | V2 DB CHECK에 'RECEIVED' 없음 확인 | ✅ V2 CHECK: 8값 중 'RECEIVED' 미포함 |
| 4 | V3 Phase 0에 orders.status CHECK 없음 확인 | ✅ 11개 마이그레이션 중 해당 CHECK 미생성 |
| 5 | 수정 마이그레이션 SQL 작성 | ✅ 위 5.3 참조 |
| 6 | consignment.tx.ts에 미치는 영향 | 확인 필요 — Phase 2 수정 시 함께 처리 |
| 7 | 수정 후 전체 RPC 테스트 | 수정 시 수행 |

---

## SECTION 6: 전체 Blast Radius

### 6.1 Phase 1 수정 파일 (5개 수정 + 3개 신규)

| # | 파일 | 작업 | RISK |
|---|------|------|------|
| 1 | `lib/types/domain/order.ts` | OrderStatus 10값 + Condition N/S/A/B + TRANSITIONS + derivePrices | 1,3,4 |
| 2 | `lib/utils/brand.ts` | BRAND_ALIAS_MAP V2+V3 병합 (~59개 브랜드) | 1 |
| 3 | `lib/utils/id.ts` | 채번 전면 재작성 (주문/직접상품 2종) | 2 |
| 4 | `__tests__/unit/types.test.ts` | OrderStatus 10값 + 전이 규칙 검증 | 3 |
| 5 | `__tests__/unit/utils.test.ts` | ID 패턴 + 브랜드 테스트 수정 | 1,2 |
| 6 | `supabase/migrations/20260304000012_rpc_generate_product_number.sql` | **신규** — 위탁 RPC | 2 |
| 7 | `supabase/migrations/20260304000013_orders_status_extend.sql` | **신규** — CHECK 확장 | 3 |
| 8 | `supabase/migrations/20260304000014_fix_rpc_consignment_status.sql` | **신규** — RPC 버그 수정 | 5 |

### 6.2 Phase 2 후속 수정 파일 (검증/수정 필요)

| # | 파일 | 확인 사항 |
|---|------|---------|
| 1 | `lib/db/repositories/orders.repo.ts` | `as OrderStatus` 캐스팅 — V2 값이면 자연스러움. 검증만 |
| 2 | `lib/db/repositories/products.repo.ts` | `as string` → `as Condition` 타입 강화 권장 |
| 3 | `lib/db/transactions/order.tx.ts` | status 파라미터 string — 변경 불필요 |
| 4 | `lib/db/transactions/consignment.tx.ts` | complete_consignment 호출 — RPC 수정 반영 확인 |
| 5 | `__tests__/unit/db.test.ts` | condition 'A' 사용 — 유효값, 변경 불필요 |

### 6.3 영향 없는 파일

auth.ts, env.ts, ratelimit.ts, supabase/*.ts, validation.ts, phone.ts, category.ts, chunk.ts, currency.ts, date.ts, excel.ts, sms-templates.ts, path.ts, photo-url.ts, 기타 도메인 타입 (seller.ts, consignment.ts, settlement.ts, notification.ts, photo.ts)

---

## SECTION 7: 리스크 종합 평가

### 7.1 수정 후 리스크

| # | 리스크 | 심각도 | 발생 확률 | 대응 |
|---|--------|--------|---------|------|
| R1 | Phase 0 마이그레이션 3개 추가 시 기존 DB 영향 | LOW | 낮음 | CREATE OR REPLACE + ADD CONSTRAINT IF NOT EXISTS 패턴 사용 |
| R2 | generate_product_number 동시성 | MEDIUM | 낮음 | pg_advisory_xact_lock 추가로 해결 |
| R3 | OrderStatus 10값 vs V2 UI 8값 표시 | LOW | — | Phase 6 (Frontend)에서 필터 처리 |
| R4 | Phase 2 repo 재검증 누락 | MEDIUM | — | 수정 후 vitest 전체 실행으로 검증 |
| R5 | 테스트 assertion 불일치 | LOW | 높음 | 테스트 동시 수정 필수 |

### 7.2 수정하지 않을 경우 리스크

| # | 리스크 | 심각도 |
|---|--------|--------|
| R6 | Phase 0 RPC 007 'RECEIVED' 버그 — V2 DB 연동 시 런타임 에러 | **CRITICAL** |
| R7 | OrderStatus V2/V3 불일치 — DB CHECK 위반 | **HIGH** |
| R8 | Condition C/D — V2 DB CHECK 위반 | **HIGH** |
| R9 | 브랜드 36개 누락 — 정산 매칭 실패 | **CRITICAL** |
| R10 | ID 접두사 ORD-/PRD- — V2 운영 패턴 불일치 | **MEDIUM** |

---

## SECTION 8: 완성도 구조 평가

### 수정 후 예상 상태

| 평가 축 | 수정 전 | 수정 후 | 비고 |
|---------|--------|--------|------|
| V2 DB 호환성 | 60% | **98%** | RPC 버그 수정 + CHECK 확장 |
| 브랜드 커버리지 | 54% (23/43) | **100%+** (59개) | V2 전체 + V3 고유 |
| 상태 관리 안전성 | 50% (V2/V3 불일치) | **95%** | V2 계승 + TRANSITIONS |
| 채번 체계 | 30% (접두사 충돌) | **100%** | V2 3종 체계 완전 계승 |
| Docs 규칙 준수 | 100% (12/12) | **100%** (유지) | Phase 1 MUST 조건 영향 없음 |

### Phase 1 MUST 조건 영향 확인

| # | 규칙 | 수정 후 영향 |
|---|------|------------|
| M1 | COMMISSION_RATES 단일 소스 | 영향 없음 |
| M2 | any 0건 | 영향 없음 (타입 더 강화됨) |
| M3 | validation.ts 스키마 5개 | 영향 없음 |

---

## SECTION 9: 실행 순서 (승인 후)

```
Step 0: Phase 0 마이그레이션 보강 (순차)
  0-A. 20260304000012_rpc_generate_product_number.sql 생성
  0-B. 20260304000013_orders_status_extend.sql 생성
  0-C. 20260304000014_fix_rpc_consignment_status.sql 생성

Step 1: Phase 1 타입/유틸 수정 (순차)
  1-A. order.ts — OrderStatus + Condition + TRANSITIONS + derivePrices
  1-B. brand.ts — BRAND_ALIAS_MAP 병합
  1-C. id.ts — 채번 재작성

Step 2: 테스트 수정 (Step 1 완료 후)
  2-A. types.test.ts — OrderStatus 10값 + 전이 검증
  2-B. utils.test.ts — ID 패턴 + 브랜드 검증

Step 3: 검증 게이트
  3-A. tsc --noEmit (0 에러)
  3-B. vitest run (전체 PASS)
  3-C. ESLint (0 warning)

Step 4: Phase 2 후속 검증
  4-A. orders.repo.ts 캐스팅 확인
  4-B. consignment.tx.ts RPC 반영 확인
  4-C. vitest run (전체 PASS 재확인)

Step 5: 커밋
```

---

## SECTION 10: 의사결정 기록

| 결정 | 선택 | 근거 | 지시자 |
|------|------|------|--------|
| V3 럭셔리 브랜드 처리 | 병합 유지 (리스크 0) | 키 충돌 없음, 사용자 "리스크 없으면 병합 OK" | 사용자 |
| 상품번호 형식 | YYYYMMDD (8자리) | V2 실제 코드 확인. 사용자 "YYYYMMDD가 맞다" 확인 | 사용자 |
| 위탁 상품번호 | CT-{SELLER_CODE}-{SEQ} 유지 | 셀러 추적성 + 감사 편의성. 사용자 비권장 동의 | 분석 결과 |
| OrderStatus CANCELLED | V3에서 추가 | "운영상 주문 취소는 불가피" — 사용자 지시 | 사용자 |
| OrderStatus CONFIRMED | V3에서 추가 | "정산 연계를 위해 최종 확정 상태 바람직" — 사용자 동의 | 사용자 |
| ALLOWED_TRANSITIONS | 옵션 C (V2 워크플로우 기반) | 사용자 명시적 선택 | 사용자 |
| Condition N 라벨 | "NEW" (V2 "Brand New"에서 변경) | 사용자 명시적 지시 | 사용자 |
| crypto.randomInt 유지 | V2 형식 + V3 보안 | V2의 Math.random 보안 취약점 개선 유지 | 분석 결과 |
| RPC 동시성 보호 | pg_advisory_xact_lock 추가 | V2에 없던 개선. docs L3 동시성 요구사항 | 분석 결과 |

---

## SECTION 11: Phase 0 수정 사항 (Phase 1 수정의 선행 조건)

Phase 1 수정을 진행하려면 **Phase 0 DB 마이그레이션 3개를 먼저** 추가해야 한다.
Phase 1 타입/유틸이 DB 스키마와 정합성을 가지려면 DB가 먼저 준비되어야 하기 때문이다.

### 11.1 현재 Phase 진행 상황

| Phase | 상태 | 커밋 | 비고 |
|-------|------|------|------|
| Phase 0 (DB 마이그레이션) | ✅ 완료 → **보강 필요 (3건)** | `540558d` | 마이그레이션 11개 → 14개로 확장 |
| Phase 1 (인프라+타입+유틸) | ✅ 완료 → **V2 정렬 수정 대기** | `dcb60a7` | 75 테스트 |
| Phase 2 (리포지토리) | ✅ 완료 → **Phase 1 수정 후 후속 검증** | `c65b0b7` | 92 테스트 |
| Phase 3-4 (Auth+Service) | 계획서 완료 → 미착수 | — | phase3-4-plan.md |

### 11.2 Phase 0 신규 마이그레이션 3건 상세

#### 마이그레이션 012: generate_product_number RPC 추가

| 항목 | 내용 |
|------|------|
| **파일** | `supabase/migrations/20260304000012_rpc_generate_product_number.sql` |
| **이유** | V2에 있는 위탁 상품번호 생성 RPC가 V3 Phase 0에 **누락**. 위탁 승인 시 `CT-{SELLER_CODE}-{SEQ}` 형식 상품번호 생성 불가 |
| **의존** | `sellers.seller_code` (UNIQUE), `st_products.product_number` (UNIQUE) — 모두 존재 확인 완료 |
| **V2 대비 개선** | `pg_advisory_xact_lock` 추가로 동시성 보호 (V2에는 없음) |
| **위험도** | LOW — 신규 함수 추가. 기존 DB 영향 없음 |

#### 마이그레이션 013: orders.status CHECK 확장

| 항목 | 내용 |
|------|------|
| **파일** | `supabase/migrations/20260304000013_orders_status_extend.sql` |
| **이유** | V2 CHECK 8값에 `CONFIRMED`, `CANCELLED` 2개 추가. 운영상 주문 취소/확정 상태 필수 |
| **작업** | `DROP CONSTRAINT IF EXISTS` → `ADD CONSTRAINT CHECK (10값)` |
| **위험도** | LOW — 기존 8값 유지 + 2값 추가. 기존 데이터 영향 없음 |

#### 마이그레이션 014: complete_consignment RPC 버그 수정

| 항목 | 내용 |
|------|------|
| **파일** | `supabase/migrations/20260304000014_fix_rpc_consignment_status.sql` |
| **이유** | 현재 RPC가 `'RECEIVED'` 사용 — V2 DB CHECK에 없는 값. `'APPLIED'`로 변경 (V2 동일) |
| **작업** | `CREATE OR REPLACE FUNCTION complete_consignment(...)` 전체 재정의, `'RECEIVED'` → `'APPLIED'` |
| **위험도** | LOW — 기존 RPC를 올바른 값으로 교체. V2와 동일한 동작으로 복원 |
| **CRITICAL** | 이 수정 없이 orders.status CHECK 013이 적용되면, `'RECEIVED'`가 새 CHECK에도 없으므로 RPC 호출 시 에러 발생. **반드시 013과 함께 적용** |

### 11.3 마이그레이션 적용 순서 (의존성)

```
012 (generate_product_number) ← 독립. 단독 적용 가능
013 (orders.status CHECK 확장) ← 014와 반드시 함께
014 (complete_consignment 수정) ← 013과 반드시 함께

권장 순서: 012 → 013 → 014 (순차 적용)
```

**주의**: 013과 014를 분리 적용하면 안 됨.
- 013만 적용 (CHECK 10값) + 014 미적용 → RPC가 'RECEIVED' INSERT → CHECK 위반 에러
- 014만 적용 (RPC 수정) + 013 미적용 → 동작은 하나 CHECK 미확장 상태

### 11.4 전체 실행 순서 (확정)

```
━━━ Phase 0 보강 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 0-A: 20260304000012_rpc_generate_product_number.sql 생성
Step 0-B: 20260304000013_orders_status_extend.sql 생성
Step 0-C: 20260304000014_fix_rpc_consignment_status.sql 생성

━━━ Phase 1 V2 정렬 수정 ━━━━━━━━━━━━━━━━━━━━
Step 1-A: order.ts — OrderStatus 10값 + Condition N/S/A/B + TRANSITIONS + derivePrices
Step 1-B: brand.ts — BRAND_ALIAS_MAP V2+V3 병합 (59개 브랜드)
Step 1-C: id.ts — 채번 전면 재작성 (주문 YYYYMMDD-숫자6, 상품 YYYYMMDD-알파벳6)

━━━ 테스트 수정 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 2-A: types.test.ts — OrderStatus 10값 + 전이 규칙 검증
Step 2-B: utils.test.ts — ID 패턴 + 브랜드 테스트 수정

━━━ 검증 게이트 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 3-A: tsc --noEmit (0 에러)
Step 3-B: vitest run (전체 PASS)
Step 3-C: ESLint (0 warning)

━━━ Phase 2 후속 검증 ━━━━━━━━━━━━━━━━━━━━━━━
Step 4-A: orders.repo.ts — OrderStatus 캐스팅 검증
Step 4-B: products.repo.ts — Condition 타입 강화 검토
Step 4-C: consignment.tx.ts — RPC 수정 반영 확인
Step 4-D: vitest run (전체 PASS 재확인)

━━━ 커밋 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 5: Phase 0 보강 + Phase 1 수정 + Phase 2 검증 일괄 커밋
```

---

## SECTION 12: 수정 시 리스크 상세 설명

SECTION 7.1의 리스크 5건은 **수정 과정에서 함께 처리하는 체크리스트**이다.
수정 후 새로 나타나는 예상 못한 문제가 아님.

| # | 리스크 | 처리 시점 | 처리 방법 |
|---|--------|---------|---------|
| R1 | Phase 0 마이그레이션 3개 추가 시 기존 DB 영향 | Step 0 (마이그레이션 작성 시) | `CREATE OR REPLACE`, `IF NOT EXISTS` 패턴으로 안전 작성 |
| R2 | generate_product_number 동시성 | Step 0-A (RPC 작성 시) | `pg_advisory_xact_lock` 이미 설계에 포함 |
| R3 | OrderStatus 10값 vs V2 UI 8값 표시 | Phase 6 (Frontend 구현 시) | 타입만 먼저 정의, UI는 Phase 6에서 CONFIRMED/CANCELLED 표시 추가 |
| R4 | Phase 2 repo 재검증 누락 | Step 4 (검증 게이트) | `vitest run` 전체 실행으로 자동 검출 |
| R5 | 테스트 assertion 불일치 | Step 2 (테스트 수정) | 타입/유틸 수정과 동시에 테스트도 수정 |

**5건 중 4건은 수정 작업 안에서 해결. 1건(R3)은 Phase 6에서 처리하되, 현재는 타입 정의만이므로 실제 문제 미발생.**

---

## SECTION 13: 수정 vs 미수정 리스크 비교

### 수정할 경우 (관리 가능한 리스크)

| 리스크 | 심각도 | 성격 |
|--------|--------|------|
| DB 마이그레이션 안전성 | LOW | 수정 과정에서 해결 |
| RPC 동시성 | MEDIUM | 설계에 이미 반영 |
| UI 표시 불일치 | LOW | Phase 6에서 처리 |
| Phase 2 재검증 | MEDIUM | vitest로 자동 검출 |
| 테스트 불일치 | LOW | 동시 수정 |

### 수정하지 않을 경우 (서비스 장애 리스크)

| 리스크 | 심각도 | 성격 |
|--------|--------|------|
| RPC 007 'RECEIVED' 버그 → **런타임 에러** | **CRITICAL** | 서비스 불가 |
| 브랜드 36개 누락 → **정산 매칭 실패** | **CRITICAL** | 매출 누락 |
| OrderStatus V2/V3 불일치 → **DB CHECK 위반** | **HIGH** | 주문 생성/수정 불가 |
| Condition C/D → **DB CHECK 위반** | **HIGH** | 검수 데이터 저장 불가 |
| ID 접두사 불일치 → V2 운영 패턴 혼란 | **MEDIUM** | 운영 혼선 |

**결론**: 수정 시 최대 MEDIUM (관리 가능), 미수정 시 CRITICAL 2건 + HIGH 2건 (서비스 장애).
수정이 필수이며, 수정 과정의 리스크는 계획된 절차로 모두 해소 가능.
