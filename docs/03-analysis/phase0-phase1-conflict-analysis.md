# Phase 0 × Phase 1 교차 충돌 분석 보고서

**작성일**: 2026-03-04
**입력 문서**:
- `phase0-v2-audit-report.md` (Phase 0 감사 — CRITICAL 8건 + HIGH 5건)
- `phase1-v2-alignment-plan.md` (Phase 1 계획 — 마이그레이션 012/013/014 + TS 수정)
**목적**: 두 수정안을 동시에 적용할 때 발생하는 충돌, 상충, 리스크를 면밀히 분석

---

## 요약: 발견된 충돌 7건

| # | 충돌 | 심각도 | 유형 |
|---|------|--------|------|
| **X-1** | Migration 014 vs FIX-2: 같은 함수 이중 정의 (범위 불일치) | **CRITICAL** | 덮어쓰기 충돌 |
| **X-2** | Migration 번호 충돌 (012/013/014 이중 할당) | **HIGH** | 네이밍 충돌 |
| **X-3** | Phase 1 계획서에 RPC 005 수정 누락 (C-1, C-2) | **HIGH** | 범위 누락 |
| **X-4** | Phase 2 consignment.tx.ts 영향 범위 과소평가 | **HIGH** | 영향도 오산 |
| **X-5** | FIX-3 (트리거) Phase 1 계획서에 미포함 | **MEDIUM** | 범위 누락 |
| **X-6** | Migration 010 RLS와 013 CHECK 확장 후 정합성 | **MEDIUM** | 정책 불일치 |
| **X-7** | RPC 006 p_status 방어 로직 부재 + CHECK 확장 후 상호작용 | **LOW** | 방어 미비 |

---

## X-1. CRITICAL — Migration 014 vs FIX-2: 같은 함수 이중 정의

### 문제

두 문서가 **동일한 함수(`complete_consignment`)를 서로 다른 범위로 재정의**한다.

| | Phase 1 계획서 Migration 014 | Phase 0 감사 FIX-2 |
|---|---|---|
| **수정 범위** | `'RECEIVED'` → `'APPLIED'` (1건만) | 5 CRITICAL + 1 HIGH (전면 재작성) |
| **파라미터** | 원본 시그니처 유지 (11개) | **3개 추가** (p_product_name, p_sale_price, p_seller_id) |
| **st_products INSERT** | 원본 유지 (consignment_id, condition 등 버그 유지) | **완전 수정** (product_condition, seller_id, product_name 등) |
| **order_items INSERT** | 원본 유지 (brand, model, condition 누락) | **V2 NOT NULL 대응** (brand, model, condition 추가) |
| **SQL 메커니즘** | `CREATE OR REPLACE FUNCTION` | `CREATE OR REPLACE FUNCTION` |

### 충돌 시나리오

**`CREATE OR REPLACE`는 마지막에 실행된 것이 승리.**

#### 시나리오 A: 014 먼저 → FIX-2 나중 (✅ 안전하지만 낭비)
```
014 적용 → 'RECEIVED'→'APPLIED' 수정, 나머지 4 CRITICAL 버그 유지
FIX-2 적용 → 014를 완전히 덮어씀. 014 작업이 무의미
```
결과: 동작은 하지만 014가 불필요한 마이그레이션 잔해로 남음

#### 시나리오 B: FIX-2 먼저 → 014 나중 (❌ 치명적)
```
FIX-2 적용 → 5 CRITICAL + 1 HIGH 모두 해결, 파라미터 3개 추가
014 적용 → FIX-2를 덮어씀! 원본 시그니처로 회귀
          → C-4(consignment_id), C-5(condition), C-6(product_name), C-7(sale_price), H-1(seller_id) 재발
```
**결과: FIX-2가 해결한 5건의 버그가 전부 다시 살아남** ← 가장 위험

#### 시나리오 C: 014를 생략하고 FIX-2만 적용 (✅ 권장)
```
FIX-2 적용 → 5 CRITICAL + 1 HIGH 해결 (014의 수정 범위 완전 포함)
014 불필요 → 생성하지 않음
```
**결과: 가장 깨끗하고 안전**

### 권장 조치

**Phase 1 계획서의 Migration 014를 폐기하고, Phase 0 감사의 FIX-2로 대체.**
FIX-2는 014의 수정 범위를 100% 포함하면서 추가 5건의 CRITICAL 버그도 해결.

---

## X-2. HIGH — Migration 번호 충돌

### 문제

두 문서가 동일한 마이그레이션 번호(012, 013, 014)에 **서로 다른 내용**을 할당.

| 번호 | Phase 1 계획서 | Phase 0 감사 |
|------|--------------|------------|
| 012 | generate_product_number RPC | FIX-1 (RPC 005 재작성) |
| 013 | orders.status CHECK 확장 | FIX-2 (RPC 007 재작성) |
| 014 | complete_consignment 부분 수정 | FIX-3 (updated_at 트리거) |

### 영향

두 문서를 그대로 실행하면:
- 012번 파일에 Phase 1의 generate_product_number와 Phase 0의 FIX-1 중 하나만 들어감
- 동일 번호에 2개 파일을 만들 수 없음 (Supabase 마이그레이션 충돌)

### 권장 조치: 통합 번호 체계

```
012: FIX-1 — RPC 005 (create_settlement_with_items) 재작성     [Phase 0 감사]
013: FIX-2 — RPC 007 (complete_consignment) 전면 재작성         [Phase 0 감사, Phase 1의 014 대체]
014: FIX-3 — update_updated_at() 트리거 함수 + 트리거 3개       [Phase 0 감사]
015: generate_product_number RPC 추가                          [Phase 1 계획서 원 012]
016: orders.status CHECK 확장 (8→10값)                         [Phase 1 계획서 원 013]
```

**의존성 재정의**:
```
012 (RPC 005 재작성)           ← 독립
013 (RPC 007 전면 재작성)      ← 독립 (내부에서 'APPLIED' 사용, CHECK 무관)
014 (트리거)                   ← 독립
015 (generate_product_number)  ← 독립
016 (orders.status CHECK 확장) ← 013 이후 (이미 'APPLIED' 사용하므로 순서 자유)
```

**013과 016의 의존성 해소**: Phase 1 계획서에서는 "013(CHECK)과 014(RPC)를 반드시 함께"라고 했으나, FIX-2가 이미 `'APPLIED'`를 사용하므로 **CHECK 확장(016)은 013 이후 언제든 독립 적용 가능**.

---

## X-3. HIGH — Phase 1 계획서에 RPC 005 수정 누락

### 문제

Phase 0 감사에서 발견된 **C-1(컬럼명 불일치) + C-2(CHECK 위반)이 Phase 1 계획서에 전혀 언급되지 않음.**

| Phase 0 감사 발견 | Phase 1 계획서 |
|------------------|---------------|
| C-1: `period_start` → `settlement_period_start` | 언급 없음 |
| C-2: `'pending'` → `'draft'` | 언급 없음 |
| FIX-1: RPC 005 전면 재작성 필요 | 언급 없음 |

### 영향

Phase 1 계획서의 실행 순서(SECTION 11.4)를 그대로 따르면:
- Step 0에서 012/013/014만 생성
- **RPC 005의 2건 CRITICAL 버그가 수정되지 않음**
- Phase 2 settlement.tx.ts가 RPC 005를 호출할 때 런타임 에러 지속

### 권장 조치

Phase 1 계획서 SECTION 11에 **RPC 005 재작성(FIX-1)을 추가**. 또는 두 문서를 병합한 통합 실행 계획 수립.

---

## X-4. HIGH — Phase 2 consignment.tx.ts 영향 범위 과소평가

### 문제

Phase 1 계획서 SECTION 6.2에서 `consignment.tx.ts`를:
> "RPC 수정 반영 확인"

으로만 분류 — **검증(확인)만 하면 된다**고 판단.

그러나 Phase 0 감사 FIX-2에서 RPC 007의 **파라미터 시그니처가 변경**됨:

```
Phase 1 014 (부분 수정):
  파라미터 변경 없음 → consignment.tx.ts 코드 수정 불필요

Phase 0 FIX-2 (전면 재작성):
  + p_product_name text DEFAULT NULL    ← 추가
  + p_sale_price integer DEFAULT 0      ← 추가
  + p_seller_id uuid DEFAULT NULL       ← 추가
  → consignment.tx.ts의 CompleteConsignmentInput 수정 필요
  → consignment.tx.ts의 RPC 호출 파라미터 수정 필요
```

### 영향도 비교

| | Phase 1 014만 적용 시 | Phase 0 FIX-2 적용 시 |
|---|---|---|
| consignment.tx.ts | 변경 불필요 | **코드 수정 필요** (interface + rpc call) |
| db.test.ts | 변경 불필요 | **테스트 수정 가능성** |
| Phase 2 커밋 재수정 | 불필요 | **필요** |

### FIX-2 적용 시 consignment.tx.ts 구체적 수정 범위

```typescript
// 현재 (Phase 2 커밋 c65b0b7):
interface CompleteConsignmentInput {
  consignmentId: string
  productNumber: string
  brand?: string
  category?: string
  condition?: string
  size?: string
  color?: string
  measurements?: Record<string, number>
  orderNumber?: string
  customerName?: string
  customerPhone?: string
}

// FIX-2 적용 후 필요한 변경:
interface CompleteConsignmentInput {
  consignmentId: string
  productNumber: string
  productName?: string       // ← 추가 (st_products NOT NULL 대응)
  salePrice?: number         // ← 추가 (st_products NOT NULL 대응)
  sellerId?: string          // ← 추가 (정산 연결)
  brand?: string
  category?: string
  condition?: string
  size?: string
  color?: string
  measurements?: Record<string, number>
  orderNumber?: string
  customerName?: string
  customerPhone?: string
}

// RPC 호출부도 수정:
const { data, error } = await supabase.rpc('complete_consignment', {
  p_consignment_id: input.consignmentId,
  p_product_number: input.productNumber,
  p_product_name: input.productName ?? null,     // ← 추가
  p_sale_price: input.salePrice ?? 0,            // ← 추가
  p_seller_id: input.sellerId ?? null,           // ← 추가
  // ... 기존 파라미터
})
```

### 리스크 평가

| 리스크 | 심각도 | 설명 |
|--------|--------|------|
| DEFAULT 값으로 인한 즉각 에러 없음 | **LOW** | 추가 파라미터 모두 DEFAULT 있음. 기존 코드가 새 파라미터 미전달해도 RPC는 동작 |
| 단, product_name=NULL, sale_price=0 저장 | **MEDIUM** | 데이터 품질 저하. 서비스에서 값을 채워야 하므로 Phase 4 전까지는 불완전 |
| consignment.tx.ts 수정 없이 FIX-2만 적용 | **LOW** | DEFAULT로 동작하나 데이터 불완전. tx.ts 수정은 Phase 4 전까지 선택적 |

### 권장 조치

**2단계 접근**:
1. FIX-2 적용 (Phase 0 패치) — DEFAULT 값으로 기존 호출 호환 보장
2. consignment.tx.ts 수정 (Phase 1 또는 Phase 4) — 데이터 완전성 보장

---

## X-5. MEDIUM — FIX-3 (트리거) Phase 1 계획서에 미포함

### 문제

Phase 0 감사 H-5에서 발견된 `update_updated_at()` 트리거 함수 + 3개 테이블 트리거가 Phase 1 계획서에 없음.

### 영향

- Phase 1 계획서 SECTION 6.1(Blast Radius)에서 **3개 신규 마이그레이션**만 나열 (012/013/014)
- 트리거 마이그레이션이 포함되지 않아 총 파일 수 과소 산정
- Phase 1 SECTION 9 실행 순서에도 트리거 단계 없음

### 리스크

| 리스크 | 심각도 | 설명 |
|--------|--------|------|
| 트리거 없이 운영 | **MEDIUM** | Phase 2 repo에서 UPDATE 시 updated_at이 갱신되지 않음 (RPC 내부는 명시적으로 처리하지만 일반 쿼리는 누락) |
| 즉시 에러 여부 | **NONE** | 트리거 없어도 DB 에러는 발생하지 않음. 단순히 updated_at이 최초 INSERT 시각에 고정 |

### 권장 조치

Phase 1 실행 순서에 트리거 마이그레이션 추가. 위험도 NONE이므로 우선순위는 가장 낮음.

---

## X-6. MEDIUM — Migration 010 RLS와 013 CHECK 확장 후 정합성

### 문제

Phase 0 Migration 010의 RLS 정책:
```sql
CREATE POLICY orders_anon_update ON orders
  FOR UPDATE TO anon
  USING (
    hold_token IS NOT NULL
    AND hold_token = current_setting('request.headers', true)::json->>'x-hold-token'
    AND status = 'IMAGE_COMPLETE'
  );
```

Phase 1 Migration 013에서 orders.status CHECK를 10값으로 확장하면:
- `IMAGE_COMPLETE` 상태에서 `CONFIRMED`로 전이 가능
- 그러나 anon 사용자의 UPDATE는 **오직 `IMAGE_COMPLETE` 상태일 때만** 허용
- `CONFIRMED` 상태에서는 anon UPDATE 불가

### 충돌 여부

**직접적 충돌 없음.** 그러나:

| 시나리오 | 결과 | 문제 |
|---------|------|------|
| anon이 IMAGE_COMPLETE 주문을 CONFIRMED로 변경 | USING 조건 통과 → UPDATE 허용 | 의도와 다를 수 있음 (CONFIRMED는 관리자만 설정해야 하지 않나?) |
| anon이 IMAGE_COMPLETE 주문을 CANCELLED로 변경 | USING 조건 통과 → UPDATE 허용 | **보안 우려**: 고객이 주문 취소를 직접 가능 |

### 리스크

| 리스크 | 심각도 | 설명 |
|--------|--------|------|
| anon이 status를 CANCELLED로 변경 가능 | **MEDIUM** | RLS USING 조건은 SELECT 조건만 체크 (status='IMAGE_COMPLETE'인 row를 UPDATE 가능). SET status='CANCELLED'을 막지 않음 |
| anon이 status를 CONFIRMED로 변경 가능 | **MEDIUM** | 위와 동일 |

### 대응 필요 여부

Phase 1에서는 **타입/유틸만 수정** (UI 미구현). 실제 anon UPDATE는 Phase 6(Frontend)에서 구현.
따라서 현재 시점에서는 리스크만 기록하고, Phase 6에서 RLS 정책 보강.

### 보강안 (Phase 6에서 적용)

```sql
-- orders_anon_update를 hold 관련 컬럼만 수정 가능하도록 제한
-- WITH CHECK 절 추가:
CREATE POLICY orders_anon_update ON orders
  FOR UPDATE TO anon
  USING (
    hold_token IS NOT NULL
    AND hold_token = current_setting('request.headers', true)::json->>'x-hold-token'
    AND status = 'IMAGE_COMPLETE'
  )
  WITH CHECK (
    status = 'IMAGE_COMPLETE'  -- anon은 status 변경 불가
  );
```

---

## X-7. LOW — RPC 006 p_status 방어 + CHECK 확장 상호작용

### 문제

Phase 0 RPC 006 (`create_order_with_items`):
```sql
INSERT INTO orders (order_number, customer_name, phone, status)
VALUES (p_order_number, p_customer_name, p_customer_phone, p_status)
```

`p_status`는 **자유 문자열**. DB CHECK가 방어하지만:

| CHECK 상태 | 유효 값 | p_status 방어 |
|-----------|---------|-------------|
| Phase 0 현재 (V2) | 8값 | DB CHECK로 방어 |
| Phase 1 013 적용 후 | 10값 | DB CHECK로 방어 (더 넓어짐) |

### 영향

CHECK 확장(10값) 후, 호출자가 `CONFIRMED`이나 `CANCELLED`를 초기 상태로 넣을 수 있음.
V2에서는 불가능했던 값이 통과됨.

### 리스크

**LOW** — RPC 006 호출은 Phase 4 서비스 레이어에서만 수행. 서비스에서 비즈니스 로직으로 방어.

---

## 통합 실행 계획 (두 문서 병합)

### AS-IS: 두 문서의 개별 실행 순서

```
Phase 1 계획서:                    Phase 0 감사:
  012 generate_product_number        012 FIX-1 (RPC 005 재작성)
  013 orders.status CHECK            013 FIX-2 (RPC 007 재작성)
  014 complete_consignment 부분수정   014 FIX-3 (트리거)
```

### TO-BE: 통합 실행 순서 (권장)

```
━━━ Phase 0 패치 (CRITICAL 해소) ━━━━━━━━━━━━━━━━━━━━
Step 0-A: 20260304000012_fix_rpc_settlement_v2.sql
  → RPC 005 전면 재작성 (C-1 컬럼명 + C-2 CHECK값)
  → Phase 1 계획서에 없었던 수정. 독립 적용 가능.

Step 0-B: 20260304000013_fix_rpc_consignment_v2.sql
  → RPC 007 전면 재작성 (C-3~C-7 + H-1 + H-2)
  → Phase 1 계획서의 014를 완전 대체 (상위 호환)
  → 내부에서 'APPLIED' 사용하므로 CHECK 확장 전에도 안전

Step 0-C: 20260304000014_updated_at_triggers.sql
  → update_updated_at() 트리거 함수 + 3개 트리거

Step 0-D: 20260304000015_rpc_generate_product_number.sql
  → Phase 1 계획서 원래 012. 내용 동일.

Step 0-E: 20260304000016_orders_status_extend.sql
  → Phase 1 계획서 원래 013. 내용 동일.
  → 0-B에서 이미 'APPLIED' 사용하므로 독립 적용 가능

━━━ Phase 1 V2 정렬 수정 (TS) ━━━━━━━━━━━━━━━━━━━━━
Step 1-A: order.ts — OrderStatus 10값 + Condition N/S/A/B + TRANSITIONS + derivePrices
Step 1-B: brand.ts — BRAND_ALIAS_MAP V2+V3 병합 (59개 브랜드)
Step 1-C: id.ts — 채번 전면 재작성

━━━ 테스트 수정 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 2-A: types.test.ts — OrderStatus 10값 + 전이 규칙 검증
Step 2-B: utils.test.ts — ID 패턴 + 브랜드 테스트

━━━ 검증 게이트 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 3-A: tsc --noEmit (0 에러)
Step 3-B: vitest run (전체 PASS)

━━━ Phase 2 후속 검증 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 4-A: consignment.tx.ts — CompleteConsignmentInput에 3 필드 추가 (선택적)
Step 4-B: settlement.tx.ts — RPC 파라미터명 변경 없음 확인
Step 4-C: orders.repo.ts — OrderStatus 캐스팅 검증
Step 4-D: vitest run (전체 PASS)

━━━ 커밋 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 5: 일괄 커밋
```

### 폐기 항목

| 원래 계획 | 폐기 사유 | 대체 |
|----------|---------|------|
| Phase 1 Migration 014 (`fix_rpc_consignment_status.sql`) | FIX-2(0-B)가 완전 상위 호환 | Step 0-B |

---

## 의존성 그래프 (통합 후)

```
Step 0-A (RPC 005)  ─── 독립 ───────────────────────┐
Step 0-B (RPC 007)  ─── 독립 ───────────────────────┤
Step 0-C (트리거)    ─── 독립 ───────────────────────┤
Step 0-D (gen_prod#) ── 독립 ───────────────────────┤
Step 0-E (CHECK 확장) ── 0-B 이후 권장 ─────────────┤
                                                    ↓
Step 1-A/B/C (TS 수정) ← 0-E 이후 (타입 정합성)     │
                                                    ↓
Step 2-A/B (테스트) ←── Step 1 이후                  │
                                                    ↓
Step 3 (게이트) ←────── Step 2 이후                  │
                                                    ↓
Step 4-A (consignment.tx.ts) ←── 0-B 이후 (선택적)   │
Step 4-B/C (검증) ←── Step 1 이후                    │
                                                    ↓
Step 5 (커밋)  ←────── Step 3 + Step 4 완료
```

---

## 리스크 총괄

### 통합 실행 시 리스크 (TO-BE)

| # | 리스크 | 심각도 | 확률 | 대응 |
|---|--------|--------|------|------|
| 1 | 마이그레이션 5개 동시 적용 시 순서 오류 | LOW | 낮음 | 번호순 자동 정렬 (Supabase 보장) |
| 2 | FIX-2 파라미터 추가로 Phase 2 tx.ts 불일치 | **LOW** | 100% | DEFAULT 값으로 기존 호출 호환. tx.ts 수정은 선택적 |
| 3 | CHECK 확장 후 RLS anon UPDATE 범위 확대 | MEDIUM | Phase 6까지 없음 | Phase 6에서 WITH CHECK 보강 |
| 4 | RPC 005 settlement.tx.ts 호환성 | **NONE** | 0% | RPC 시그니처 변경 없음 (내부만 수정) |
| 5 | 트리거와 RPC 내 updated_at 이중 설정 | **NONE** | 0% | 동일 값 (now()) — 무해 |

### 개별 실행 시 리스크 (AS-IS — 두 문서 독립 실행)

| # | 리스크 | 심각도 | 설명 |
|---|--------|--------|------|
| 1 | Migration 014가 FIX-2를 덮어쓰기 | **CRITICAL** | 5건 CRITICAL 버그 재발 |
| 2 | 번호 충돌로 마이그레이션 실패 | **HIGH** | 같은 번호 2개 파일 불가 |
| 3 | RPC 005 수정 누락 | **CRITICAL** | settlement.tx.ts 런타임 에러 지속 |

---

## 결론

### Phase 1 계획서 필요 수정 사항

| SECTION | 현재 내용 | 수정 필요 |
|---------|---------|---------|
| 11.2 (마이그레이션 012) | generate_product_number | **번호 015로 재할당** |
| 11.2 (마이그레이션 013) | orders.status CHECK | **번호 016으로 재할당** |
| 11.2 (마이그레이션 014) | complete_consignment 부분 수정 | **폐기** (FIX-2로 대체) |
| 11.2 (신규) | — | **RPC 005 재작성(012), RPC 007 재작성(013), 트리거(014) 추가** |
| 6.1 (Blast Radius) | 3개 신규 마이그레이션 | **5개로 확장** |
| 6.2 (Phase 2 후속) | consignment.tx.ts "확인" | **코드 수정 가능성 명시** |
| 11.3 (적용 순서) | 012→013→014 | **012→013→014→015→016** |
| 11.4 (전체 순서) | Step 0: 3파일 | **Step 0: 5파일** |

### 핵심 메시지

1. **Phase 1 Migration 014는 폐기**. Phase 0 FIX-2가 완전 상위 호환.
2. **Phase 1 계획서에 RPC 005 수정(FIX-1)을 추가**. 현재 누락 상태.
3. **마이그레이션 번호를 재할당**하여 충돌 방지.
4. **consignment.tx.ts는 "확인"이 아닌 "수정"**으로 분류 변경 (선택적이지만 명시).
5. 통합 실행 시 최대 리스크는 **LOW** (개별 실행 시 CRITICAL 2건).
