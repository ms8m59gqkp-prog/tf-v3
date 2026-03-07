# Phase 1 V2 정렬 계획서 ↔ 현재 코드베이스 충돌 시뮬레이션 리포트

**작성일**: 2026-03-05
**분석 대상**: `phase1-v2-alignment-plan.md` (Phase 0 Patch 이전 작성)
**분석 방법**: 계획서 13개 SECTION × 현재 코드베이스 16개 마이그레이션 + TS 파일 교차 대조

---

## 판정 요약

| 등급 | 건수 | 설명 |
|------|------|------|
| **CRITICAL** | 1건 | 마이그레이션 번호 충돌 — 012/013/014 이미 점유 |
| **REDUNDANT** | 5건 | 이미 완료된 작업을 재실행하면 중복/덮어쓰기 |
| **STALE** | 2건 | 계획서의 전제가 현재 상태와 불일치 |
| **OK** | 3건 | 계획서와 현재 코드가 일치 (작업 불필요) |

---

## CRITICAL-1: 마이그레이션 번호 충돌

계획서는 3개 신규 마이그레이션을 **012/013/014**로 제안하지만,
이 번호는 **Phase 0 Patch에서 이미 점유**되었고, 동일 내용이 **다른 번호로 이미 존재**한다.

| 계획서 번호 | 계획서 내용 | 실제 점유 (Phase 0 Patch) | 동일 내용의 실제 위치 |
|------------|-----------|--------------------------|---------------------|
| **012** | generate_product_number RPC | `012_fix_rpc_settlement_v2.sql` | **015** (`rpc_generate_product_number.sql`) |
| **013** | orders_status_extend CHECK | `013_fix_rpc_consignment_v2.sql` | **016** (`orders_status_extend.sql`) |
| **014** | fix_rpc_consignment 'RECEIVED'→'APPLIED' | `014_updated_at_triggers.sql` | **013** (`fix_rpc_consignment_v2.sql` L69) |

### 현재 마이그레이션 전체 번호표

```
001 consignment_status_check       ← Phase 0 원본
002 unique_constraints             ← Phase 0 원본
003 performance_indexes            ← Phase 0 원본
004 rls_policies                   ← Phase 0 원본
005 rpc_settlement                 ← Phase 0 원본 (→011→012에서 교체)
006 rpc_order                      ← Phase 0 원본
007 rpc_consignment                ← Phase 0 원본 (→013에서 교체)
008 upload_session_id              ← Phase 0 원본
009 batch_progress                 ← Phase 0 원본
010 public_orders_rls              ← Phase 0 원본
011 fix_rpc_settlement             ← Phase 0 원본 (→012에서 교체)
012 fix_rpc_settlement_v2          ← Phase 0 Patch ★ 계획서가 덮으려는 번호
013 fix_rpc_consignment_v2         ← Phase 0 Patch ★ 계획서가 덮으려는 번호
014 updated_at_triggers            ← Phase 0 Patch ★ 계획서가 덮으려는 번호
015 rpc_generate_product_number    ← Phase 1 V2 정렬 (= 계획서 012 내용)
016 orders_status_extend           ← Phase 1 V2 정렬 (= 계획서 013 내용)
```

### 그대로 실행 시 결과

012/013/014 파일 덮어쓰기 → Phase 0 Patch 소실:
- settlement RPC v2 (draft 상태, settlement_period_start/end, item_count) **소실**
- consignment RPC v2 (14파라미터, product_condition, COALESCE) **소실**
- updated_at 트리거 3개 **소실**

→ **DB 런타임 에러 다수 발생**

---

## REDUNDANT-1: order.ts — 이미 완료

| 계획서 제안 (SECTION 3+4) | 현재 코드 상태 |
|--------------------------|---------------|
| OrderStatus 10값 | `order.ts:8-19` — 이미 10값 |
| ALLOWED_TRANSITIONS V2 기반 | `order.ts:23-34` — 이미 V2 워크플로우 기반 |
| Condition N/S/A/B | `order.ts:36` — 이미 `N \| S \| A \| B` |
| CONDITION_LABELS 'NEW' | `order.ts:39` — 이미 `N: 'NEW'` |
| derivePrices/deriveOriginalPrice | `order.ts:51-67` — 이미 존재 |

---

## REDUNDANT-2: brand.ts — 이미 완료

| 계획서 제안 (SECTION 1) | 현재 코드 상태 |
|------------------------|---------------|
| V2 43개 + V3 16개 = 59개 병합 | `brand.ts` — 이미 59개 브랜드 병합 완료 |
| normalizeBrand 함수 유지 | `brand.ts:294-297` — 변경 불필요 |

테스트: `utils.test.ts:64-67` — `canonicals.size >= 59` 이미 검증 중

---

## REDUNDANT-3: id.ts — 이미 완료

| 계획서 제안 (SECTION 2) | 현재 코드 상태 |
|------------------------|---------------|
| YYYYMMDD-XXXXXX (주문) | `id.ts:13-18` — 이미 구현 |
| YYYYMMDD-AAAAAA (상품) | `id.ts:25-33` — 이미 구현 |
| crypto.randomInt 유지 | `id.ts:7` — 이미 사용 중 |

---

## REDUNDANT-4: generate_product_number RPC — 이미 존재

계획서 SECTION 2.3의 RPC SQL과 현재 migration 015 비교:

| 항목 | 계획서 012 | 현재 015 |
|------|-----------|---------|
| 함수명 | `generate_product_number(UUID)` | 동일 |
| pg_advisory_xact_lock | 있음 | 있음 (L24) |
| LPAD 3자리 | 있음 | 있음 (L34) |
| GRANT | 있음 | 있음 (L40) |

**결론**: 100% 동일 내용. 번호만 012→015로 이동.

---

## REDUNDANT-5: complete_consignment 'RECEIVED' 수정 — 이미 해결 + 확장

계획서 SECTION 5의 핵심 수정(`'RECEIVED'` → `'APPLIED'`)은 현재 migration 013에서 이미 해결.

`013_fix_rpc_consignment_v2.sql:69`:
```sql
VALUES (p_order_number, p_customer_name, p_customer_phone, 'APPLIED')
```

현재 migration 013은 계획서보다 **더 포괄적**:

| 항목 | 계획서 014 | 현재 013 |
|------|-----------|---------|
| 파라미터 수 | 11개 | **14개** (p_product_name, p_sale_price, p_seller_id 추가) |
| 'RECEIVED'→'APPLIED' | ✅ | ✅ |
| product_condition 수정 (C-5) | ❌ | ✅ |
| product_name NOT NULL (H-1) | ❌ | ✅ (COALESCE) |
| seller_id 정산 연결 (H-2) | ❌ | ✅ |

**주의**: 계획서 014의 11파라미터 버전을 실행하면 현재 013의 14파라미터 버전을 **퇴보**시킴.

---

## STALE-1: 계획서의 SETTLEMENT_STATUSES 전제 불일치

계획서는 settlement 관련 변경을 언급하지 않고, "영향 없는 파일"에 `settlement.ts`를 포함 (SECTION 6.3).

현재 상태 (충돌 수정 완료):
- `SETTLEMENT_STATUSES`: `['pending','confirmed','paid']` → `['draft','confirmed','paid','failed']`
- `Settlement` 인터페이스: `itemCount?`, `periodStart?`, `periodEnd?` 추가
- `settlement.repo.ts`: `settlement_period_start/end` 컬럼명 수정

**리스크**: 직접 충돌은 아님 (계획서가 settlement을 건드리지 않으므로).
단, 계획서의 리스크 분석(SECTION 7)에서 settlement 상태 불일치가 누락.

---

## STALE-2: 계획서의 Phase 2 검증 전제 불일치

계획서 SECTION 6.2 Phase 2 파급 파일:

| 계획서 전제 | 현재 상태 |
|------------|----------|
| `settlement.repo.ts`가 `period_start/period_end` 사용 | 이미 `settlement_period_start/end`로 수정 완료 |
| `sellers.repo.ts`가 `updated_at` 미포함 | 이미 추가 완료 |

**리스크**: 이미 해결된 문제를 다시 검증하려 함 → 시간 낭비지만 위험하지 않음.

---

## OK — 현재 코드와 일치 (3건)

### OK-1: types.test.ts OrderStatus 10값 검증

계획서 SECTION 3.4 테스트 = 현재 `types.test.ts:58-108` 일치.

### OK-2: utils.test.ts ID 패턴 검증

계획서 SECTION 2.5 정규식 = 현재 `utils.test.ts:130-148` 일치.

### OK-3: orders_status_extend CHECK 10값

계획서 SECTION 3.3 SQL = 현재 migration 016 내용 100% 동일 (번호만 013→016).

---

## 교차 영향 매트릭스

```
                계획서 제안        현재 코드베이스       판정
────────────────────────────────────────────────────────────
order.ts        10값+Condition     이미 동일            REDUNDANT
brand.ts        59개 병합          이미 동일            REDUNDANT
id.ts           YYYYMMDD 형식     이미 동일            REDUNDANT
migration 012   generate_prod_num  015에 존재 + 012 점유  CRITICAL
migration 013   orders CHECK      016에 존재 + 013 점유  CRITICAL
migration 014   fix consignment   013에 포함 + 014 점유  CRITICAL
settlement.ts   (미언급)           draft/failed 변경됨   STALE
settlement.repo (미언급)           V2 컬럼명 수정됨      STALE
sellers.repo    (미언급)           updated_at 추가됨     STALE
types.test.ts   10값 검증          이미 동일            OK
utils.test.ts   ID 패턴 검증      이미 동일            OK
```

---

## 결론

### 실행 판정: 계획서를 그대로 실행하면 안 됨

| 항목 | 판정 |
|------|------|
| TS 변경 (order.ts, brand.ts, id.ts) | **이미 완료** — 재실행 불필요 |
| SQL 변경 (012/013/014) | **번호 충돌** — 실행 시 Phase 0 Patch 소실 |
| 테스트 변경 | **이미 완료** — 재실행 불필요 |
| **추가 작업 필요 여부** | **없음** — 계획서 전체가 이미 실행된 상태 |

### 계획서가 현재 코드보다 부족한 1건

계획서 SECTION 5의 `complete_consignment` 수정은 11파라미터 버전.
현재 migration 013은 14파라미터 + 추가 버그 5건 수정.
계획서대로 실행하면 **기능 퇴보** 발생.

### 계획서가 인지하지 못한 변경 3건

1. `SETTLEMENT_STATUSES` → `['draft','confirmed','paid','failed']`
2. `settlement.repo.ts` V2 컬럼명 정렬
3. `sellers.repo.ts` `updated_at` 추가

이 3건은 계획서 작성 이후 Phase 0↔1 충돌 수정에서 처리됨.

---

## 권장 조치

이 계획서는 **폐기(archive)** 처리하고, 현재 코드베이스 상태를 기준으로 Phase 3-4 진행.
계획서의 의사결정 기록(SECTION 10)은 여전히 유효하므로 참조 자료로 보존.
