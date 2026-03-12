# Phase 0 ↔ Phase 1 충돌 분석 리포트

**작성일**: 2026-03-05
**분석 범위**: Phase 0 (migrations 001-014) vs Phase 1 (TS + migrations 015-016)
**분석 방법**: 전체 16개 SQL 마이그레이션 + 10개 TS 파일 교차 대조

---

## 판정 요약

| 등급 | 건수 | 설명 |
|------|------|------|
| **CRITICAL** | 1건 | 런타임 에러 유발 가능 |
| **HIGH** | 1건 | 타입 안전성 위반 + 데이터 모델 불완전 |
| **MEDIUM** | 2건 | 동작하지만 잠재적 문제 |
| **OK** | 9건 | 정상 정렬 확인 |

---

## CRITICAL-1: SettlementStatus `'draft'` 누락

### 증거

| 위치 | 값 |
|------|-----|
| Phase 0 Patch `012_fix_rpc_settlement_v2.sql:45` | `'draft'` INSERT |
| Phase 1 `settlement.ts:8` | `SETTLEMENT_STATUSES = ['pending', 'confirmed', 'paid']` |

### 상세

Phase 0 Patch (migration 012)는 V2 DB 실측 기반으로 settlement 초기 상태를 `'pending'`→`'draft'`로 수정했다.
그러나 Phase 1의 `SettlementStatus` 타입은 `'draft'`를 포함하지 않는다.

```
Phase 0 원본 (005):   status = 'pending'    ← 틀렸음 (V2 DB는 'draft')
Phase 0 Fix  (011):   status = 'pending'    ← 여전히 틀림
Phase 0 Patch (012):  status = 'draft'      ← V2 DB 정렬 완료
Phase 1 TS 타입:      ['pending', 'confirmed', 'paid']  ← 'draft' 없음!
```

### 영향

1. **settlement.tx.ts** → RPC 호출 후 DB에 `'draft'` 상태 settlement이 생성됨
2. **settlement.repo.ts** → 해당 row를 읽으면 `row.status as SettlementStatus` 캐스팅이 컴파일 시점에는 통과하나, 런타임에서 V3 타입 시스템과 불일치
3. `SettlementStatus`를 검증하는 모든 서비스 로직에서 `'draft'`는 `pending | confirmed | paid`가 아니므로 분기 실패

### 수정 필요

```typescript
// settlement.ts
export const SETTLEMENT_STATUSES = ['draft', 'pending', 'confirmed', 'paid'] as const
```

---

## HIGH-1: Settlement `item_count` 필드 V3 타입 미반영

### 증거

| 위치 | 내용 |
|------|------|
| Phase 0 Patch `012:41` | `item_count` 컬럼 INSERT |
| Phase 1 `settlement.ts:14-28` | `Settlement` 인터페이스에 `itemCount` 없음 |

### 상세

Migration 012가 `settlement_items` 수를 `item_count` 컬럼에 저장하도록 추가했으나,
Phase 1의 `Settlement` 인터페이스에 해당 필드가 없다.

### 영향

- 데이터 손실은 아님 (INSERT만 하고 SELECT 안 하면 무시)
- 그러나 Phase 4 서비스에서 item_count가 필요할 때 타입에 없어서 별도 쿼리 필요
- **Phase 2 settlement.repo.ts도 SETTLEMENT_COLUMNS에 item_count를 포함하지 않음**

### 수정 필요

```typescript
// settlement.ts Settlement 인터페이스에 추가
itemCount?: number
```

---

## MEDIUM-1: Settlement `periodStart/periodEnd` 관련 컬럼명 불일치 체인

### 증거

| 위치 | 사용 컬럼명 |
|------|------------|
| Phase 0 원본 (005:41) | `period_start, period_end` |
| Phase 0 Fix (011:41) | `period_start, period_end` |
| Phase 0 Patch (012:39) | `settlement_period_start, settlement_period_end` ← V2 DB 실제 컬럼 |
| Phase 1 Settlement 타입 | periodStart/periodEnd 필드 **없음** |
| Phase 2 settlement.repo.ts:12 | `period_start, period_end` ← **V2 DB에 없는 컬럼명** |

### 상세

이것은 Phase 0 ↔ Phase 1 직접 충돌은 아니나, Phase 0 Patch가 V2 DB 컬럼명을 교정한 결과로 Phase 2에 파급 효과가 발생한다.

- Phase 0 Patch (012)이 RPC 함수 내부에서 `settlement_period_start`로 수정 → **RPC 래퍼(settlement.tx.ts)는 정상** (파라미터명은 `p_period_start`이므로)
- 그러나 Phase 2 `settlement.repo.ts`는 RPC가 아닌 **직접 테이블 SELECT**를 하면서 `period_start, period_end`를 사용 → V2 DB에는 이 컬럼이 없으므로 **런타임 에러**

### Phase 0 ↔ Phase 1 관점

- Phase 1의 `Settlement` 타입에 `periodStart/periodEnd` 필드가 아예 없음
- 이는 의도적인 누락인지 실수인지 불분명
- 정산 기간 조회가 필요한 Phase 4 서비스에서 타입 보충 필요

### 수정 필요 (Phase 2 대상)

```typescript
// settlement.repo.ts SETTLEMENT_COLUMNS
const SETTLEMENT_COLUMNS = '... settlement_period_start, settlement_period_end ...'
// Settlement 인터페이스에 추가
periodStart?: string
periodEnd?: string
```

---

## MEDIUM-2: sellers `updated_at` — Phase 0 트리거 vs Phase 2 fallback

### 증거

| 위치 | 내용 |
|------|------|
| Phase 0 Patch `014` | sellers 테이블에 `update_updated_at()` 트리거 부착 |
| Phase 1 Seller 타입 | `updatedAt: string` (필수) |
| Phase 2 `sellers.repo.ts:24` | `updatedAt: row.created_at as string` (fallback) |
| Phase 2 `sellers.repo.ts:11` | COLUMNS에 `updated_at` **미포함** |

### 상세

Phase 0 Patch (014)가 sellers 테이블에 `updated_at` 자동 갱신 트리거를 설치했다.
이는 V2 DB에 `updated_at` 컬럼이 존재한다는 뜻이다.
그러나 Phase 2 sellers.repo.ts는:

1. SELECT에 `updated_at`을 포함하지 않음
2. mapRow에서 `created_at`으로 fallback

결과: UPDATE 후에도 `updatedAt`이 항상 `createdAt`과 동일한 값을 반환.

### 영향

- 기능적 에러는 아님 (충돌하지 않음)
- 그러나 "마지막 수정 시간" 표시가 부정확해짐

---

## OK — 정상 정렬 확인 (9건)

### OK-1: complete_consignment RPC 파라미터 정렬 ✅

Phase 0 Patch (013) RPC 14개 파라미터 ↔ Phase 1 `consignment.tx.ts` 14개 파라미터
— **이름, 타입, 기본값 모두 일치**

```
013 RPC: p_consignment_id uuid, p_product_number text, p_product_name text DEFAULT NULL,
         p_sale_price integer DEFAULT 0, p_seller_id uuid DEFAULT NULL, ...

tx.ts:   p_consignment_id: input.consignmentId,
         p_product_number: input.productNumber,
         p_product_name: input.productName ?? null,
         p_sale_price: input.salePrice ?? 0,
         p_seller_id: input.sellerId ?? null, ...
```

### OK-2: OrderStatus 'APPLIED' 일관성 ✅

| 위치 | 값 |
|------|-----|
| Phase 0 Patch (013:69) | `'APPLIED'` (주문 생성 시) |
| Phase 1 `order.ts:9` | `ORDER_STATUSES[0] = 'APPLIED'` |
| Phase 1 `016:11` | CHECK 10값에 'APPLIED' 포함 |
| Phase 2 `db.test.ts:62` | `status: 'APPLIED'` |

### OK-3: orders.status CHECK 확장 호환성 ✅

Phase 1 migration 016 (8→10값)은 Phase 0의 모든 RPC와 정책에서 사용하는 상태값을 포함한다.

| Phase 0 사용 상태값 | 016 CHECK 포함 여부 |
|-------------------|-------------------|
| 013: 'APPLIED' | ✅ |
| 010: 'IMAGE_COMPLETE' | ✅ |
| 006: `p_status text` (런타임) | ✅ (CHECK가 검증) |

### OK-4: generate_product_number RPC 의존성 ✅

Phase 1 migration 015는 `sellers.seller_code`와 `st_products.product_number`에 의존.
Phase 0 migration 002에서 두 컬럼의 UNIQUE 제약이 확인됨 (존재 증명).

### OK-5: Condition 'N' 기본값 정렬 ✅

| 위치 | 기본값 |
|------|--------|
| Phase 0 Patch (013:73) | `COALESCE(p_condition, 'N')` |
| Phase 1 `order.ts:36` | `Condition = 'N' \| 'S' \| 'A' \| 'B'` |

### OK-6: 마이그레이션 실행 순서 정합성 ✅

```
001 → 002 → ... → 011 → 012 → 013 → 014 → 015 → 016
                         ↑ Phase 0 Patch    ↑ Phase 1
```

- CREATE OR REPLACE 함수: 마지막 정의가 승리 (012 > 011 > 005, 013 > 007)
- DROP CONSTRAINT IF EXISTS + ADD: 멱등
- CREATE TABLE IF NOT EXISTS: 멱등
- ALTER TABLE ADD COLUMN IF NOT EXISTS: 멱등

### OK-7: ID 형식 분리 ✅

| 유형 | 형식 | 생성 위치 |
|------|------|----------|
| 주문번호 | `YYYYMMDD-숫자6` | Phase 1 `id.ts:generateOrderNumber()` |
| 직접접수 상품번호 | `YYYYMMDD-알파벳6` | Phase 1 `id.ts:generateProductNumber()` |
| 위탁 상품번호 | `CT-{CODE}-{SEQ:3}` | Phase 1 migration 015 RPC |

세 형식이 겹치지 않으며, Phase 0 RPC (013)의 `p_product_number`는 어느 형식이든 수용.

### OK-8: consignment_requests STATUS CHECK ✅

Phase 0 (001)의 7값 CHECK와 Phase 1의 `ConsignmentStatus` 타입 7값이 동일:
`pending, received, inspecting, approved, on_hold, rejected, completed`

### OK-9: _batch_progress 테이블 ✅

Phase 0 (009) DDL과 Phase 1의 `BatchProgress` 타입, Phase 2의 `batch.repo.ts` 매핑이 정합.
4개 status CHECK값 `running, completed, partial, failed`도 `BATCH_STATUSES`와 일치.

---

## 교차 영향 매트릭스

```
               Phase 0       Phase 0 Patch    Phase 1       Phase 2
               (001-011)     (012-014)        (015-016+TS)  (repos+tx)
─────────────────────────────────────────────────────────────────────
Settlement     005→011       012(최종)         TS 타입        repo+tx
 RPC param     ✅            ✅               N/A            ✅ (tx)
 컬럼명        ❌period_*    ✅settle_*        N/A            ❌period_*
 status값      'pending'     'draft'          ❌ 없음         'pending' cast
 item_count    없음          ✅               ❌ 없음         ❌ 없음
─────────────────────────────────────────────────────────────────────
Consignment    007           013(최종)         TS tx+type     repo
 RPC param     11개          14개              14개 ✅        N/A
 status값      'RECEIVED'    'APPLIED' ✅      'APPLIED' ✅   'approved' ✅
─────────────────────────────────────────────────────────────────────
Order          006           N/A              016(CHECK)     repo
 status CHECK  8값           N/A              10값 ✅         10값 cast ✅
─────────────────────────────────────────────────────────────────────
updated_at     N/A           014(트리거)       N/A            fallback ⚠️
```

---

## 결론

### Phase 0 ↔ Phase 1 직접 충돌: 1건 (CRITICAL-1)

`SettlementStatus`에 `'draft'` 누락. Phase 0 Patch (012)가 V2 DB 정렬을 위해 도입한 `'draft'` 상태가
Phase 1 타입 시스템에 반영되지 않았다. **Phase 1 V2 정렬 작업에서 settlement.ts가 누락**된 것이 원인.

### Phase 0 Patch → Phase 2 파급: 2건 (MEDIUM)

Phase 0 Patch가 V2 DB 컬럼명을 교정하면서 Phase 2 repo의 가정이 무효화된 케이스.
settlement.repo.ts의 `period_start/period_end` 컬럼명과 sellers.repo.ts의 `updated_at` 미포함.

### 그 외: 정상 정렬 9건

Phase 0 ↔ Phase 1 간 RPC 파라미터, 상태값, CHECK 제약, ID 형식, 마이그레이션 순서 등
핵심 인터페이스는 모두 정합.

---

## 수정 완료 (2026-03-05)

| # | 대상 | 수정 내용 | 상태 |
|---|------|----------|------|
| 1 | `settlement.ts` | SETTLEMENT_STATUSES → `['draft','confirmed','paid','failed']` | **완료** |
| 2 | `settlement.ts` | Settlement에 `itemCount?`, `periodStart?`, `periodEnd?` 추가 | **완료** |
| 3 | `settlement.repo.ts` | COLUMNS V2 정렬 + mapRow 매핑 수정 | **완료** |
| 4 | `sellers.repo.ts` | COLUMNS에 `updated_at` 추가 + mapRow fallback | **완료** |
| 5 | `types.test.ts` | SETTLEMENT_STATUSES 4값 검증 | **완료** |
| 6 | `db.test.ts` | settlement/sellers mock V2 정렬 | **완료** |

검증: tsc 0 errors, vitest 99/99 PASS
