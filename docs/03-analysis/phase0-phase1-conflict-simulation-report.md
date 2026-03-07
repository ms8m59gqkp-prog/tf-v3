# Phase 0 ↔ Phase 1 충돌 시뮬레이션 보고서

**작성일**: 2026-03-06
**방법론**: 3개 독립 시뮬레이션 에이전트 병렬 실행 + 교차 검증
**기준**: Phase 0 마이그레이션 16개 + V2 백업 6종 + Phase 1 재구현 레퍼런스

---

## 시뮬레이션 구성

| # | 에이전트 | 검증 범위 | 소요 |
|---|---------|----------|------|
| SIM-1 | Schema Conflict | Phase 0 마이그레이션 16개 ↔ 레퍼런스 스키마 (CHECK, RPC, 컬럼) | ~93s |
| SIM-2 | Column-Type Mapping | V2 DB 228컬럼 ↔ Phase 1 타입 인터페이스 (nullable, camelCase) | ~109s |
| SIM-3 | Runtime Conflict | Phase 2 리포/트랜잭션 런타임 시나리오 4종 시뮬레이션 | ~106s |

---

## I. 교차 검증 결과 요약

### 3개 에이전트 일치 항목 (높은 신뢰도)

| # | 이슈 | SIM-1 | SIM-2 | SIM-3 | 심각도 |
|---|------|-------|-------|-------|--------|
| 1 | SettlementItem 10필드→V2 3컬럼 | CRITICAL | CRITICAL | CRITICAL | **CRITICAL** |
| 2 | products.repo.ts COLUMNS에 V2 없는 8개 필드 | HIGH | HIGH(6팬텀) | CRITICAL(select 에러) | **CRITICAL** |
| 3 | SoldItem 5개 팬텀 필드 (brand,model,commission,payout,updatedAt) | HIGH | HIGH | HIGH | **HIGH** |
| 4 | ConsignmentRequest brand/category 팬텀 | HIGH | HIGH | — | **HIGH** |
| 5 | complete_consignment() 14파라미터 vs V2 11파라미터 | HIGH | — | HIGH | **HIGH** |
| 6 | CHECK 상수 11개 미정의 | HIGH | — | — | **HIGH** |

### 2개 에이전트 일치 항목

| # | 이슈 | 발견 에이전트 | 심각도 |
|---|------|-------------|--------|
| 7 | Settlement.totalCommission↔commission_amount 필드명 불일치 | SIM-2, SIM-3 | **HIGH** |
| 8 | Settlement.totalPayout↔settlement_amount 필드명 불일치 | SIM-2, SIM-3 | **HIGH** |
| 9 | SalesRecord 6개 팬텀 필드 | SIM-2, SIM-3 | **HIGH** |
| 10 | BatchProgress 필드명 의미 차이 (completed→processedFiles) | SIM-2, SIM-3 | **MED** |

### 신규 발견 (이전 딥리서치에 없던 이슈)

| # | 이슈 | 발견 에이전트 | 심각도 |
|---|------|-------------|--------|
| ~~**NEW-1**~~ | ~~ORDER_STATUSES: 마이그레이션 016이 V2 값을 V3 값으로 교체~~ | ~~SIM-2, SIM-3~~ | ~~**CRITICAL**~~ **오탐 — 아래 정정 참조** |
| **NEW-2** | Settlement.return_deduction 누락 (V2 NOT NULL) | SIM-3 | **HIGH** |
| **NEW-3** | Settlement.updatedAt 팬텀 (V2에 없음) | SIM-2, SIM-3 | **HIGH** |
| **NEW-4** | NotificationLog.sentAt 팬텀 + consignmentId/triggerEvent/channel 누락 | SIM-2 | **MED** |
| **NEW-5** | StProduct.status/orderId/soldPrice 팬텀 (V2에 없는 3필드 추가) | SIM-2 | **HIGH** |

### NEW-CRIT-1 오탐(False Positive) 정정

**정정일**: 2026-03-07
**근거**: V2 프로젝트 `classic-menswear-v2/supabase/migrations/20260219_orders_system.sql` 원본 확인

016의 기본 8값은 V3/plan5 설계값이 아니라 **V2 신청 관리(위탁→수거→검수→이미지) 파이프라인 상태값**입니다:

```sql
-- V2 20260219_orders_system.sql (line 25-34)
CHECK (status IN (
  'APPLIED',          -- 신청 접수
  'SHIPPING',         -- 배송중
  'COLLECTED',        -- 수거완료
  'INSPECTED',        -- 검수 완료
  'PRICE_ADJUSTING',  -- 가격 조정 중
  'RE_INSPECTED',     -- 재검수 완료
  'IMAGE_PREPARING',  -- 이미지 준비 중
  'IMAGE_COMPLETE'    -- 이미지 완료
))
```

**오탐 원인**: 시뮬레이션이 `v2_constraints.txt`(Mumbai 라이브 덤프)만 참조하여 CHECK 미존재로 판단. 실제로는 V2 마이그레이션 소스에 정의되어 있었으나, Mumbai DB에는 `CREATE TABLE IF NOT EXISTS`로 인해 CHECK가 적용되지 않은 상태.

**v2_constraints.txt에 없는 이유**: `classic-menswear-frontend/schema.sql`로 먼저 테이블 생성 후, `classic-menswear-v2/migrations/20260219_orders_system.sql`의 `CREATE TABLE IF NOT EXISTS`가 스킵됨.

**결론**: 016 주석 "V2 CHECK 8값에 CONFIRMED, CANCELLED 추가"는 **사실적으로 정확**. 의사결정 불필요.

---

## II. CRITICAL 이슈 상세 분석

### ~~CRIT-1: ORDER_STATUSES V2↔Phase 0 마이그레이션 016 완전 불일치~~ (오탐 — 정정됨)

**2026-03-07 정정**: 이 이슈는 **오탐(False Positive)**으로 확정되었습니다.

시뮬레이션이 `v2_constraints.txt`(Mumbai 라이브 덤프)만 참조하여 V2에 CHECK가 없다고 판단했으나,
V2 마이그레이션 원본(`classic-menswear-v2/supabase/migrations/20260219_orders_system.sql`)에서
**동일한 8값 CHECK가 정의**되어 있음을 확인.

016의 10값 = V2 신청 관리 8값(APPLIED~IMAGE_COMPLETE) + V3 추가 2값(CONFIRMED, CANCELLED).
016 주석 "V2 CHECK 8값에 CONFIRMED, CANCELLED 추가"는 **사실적으로 정확**.
의사결정 불필요, 016 현행 유지.

자세한 정정 내용은 섹션 I. "NEW-CRIT-1 오탐 정정" 참조.

---

### CRIT-2: SettlementItem 구조 불일치 (기존 C-1 재확인)

3개 시뮬레이션 모두 동일하게 확인:
- V2 DB: 3컬럼 (id, settlement_id, sold_item_id)
- Phase 1 타입: 10필드 (7개 팬텀)
- Phase 2 리포: mapRow에서 7개 undefined 반환

**조치**: 3필드로 축소, SettlementItemDetail은 sold_items JOIN으로 별도 정의.

---

### CRIT-3: products.repo.ts COLUMNS → Supabase select() 런타임 에러

SIM-3에서 확인: COLUMNS 문자열에 V2에 없는 컬럼 포함 시 Supabase API가 에러 반환.

```typescript
// 현재 (에러 발생)
const COLUMNS = '..., model, sub_category, description, original_price, estimated_price, image_urls, order_id, ...'
//                    ^^^^   ^^^^^^^^^^^^   ^^^^^^^^^^^   ^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^   ^^^^^^^^^^   ^^^^^^^^
//                    V2 없음  V2 없음        V2 없음       V2 없음          V2 없음           V2 없음      V2 없음
```

**조치**: V2 실제 컬럼만으로 COLUMNS 재정의.

---

## III. HIGH 이슈 상세 분석

### HIGH-1: complete_consignment() Phase 0 마이그레이션 013 ↔ V2 불일치

마이그레이션 013이 V2에 없는 3개 파라미터를 추가:

```sql
-- 마이그레이션 013 (14파라미터)
p_product_name text DEFAULT NULL,   -- V2 RPC에 없음 (RPC 내부에서 consignment.product_name 사용)
p_sale_price integer DEFAULT 0,     -- V2 RPC에 없음 (V2는 desired_price 사용)
p_seller_id uuid DEFAULT NULL,      -- V2 RPC에 없음 (RPC 내부에서 consignment.seller_id 사용)
```

**V2 RPC**: 11파라미터 (위 3개 없음, 내부에서 consignment 레코드에서 추출)

**현실**: Tokyo DB에는 013이 이미 적용됨. 3개 파라미터가 DEFAULT를 가지므로 V2 11파라미터로 호출해도 동작함.

**의사결정 필요**:
- **옵션 A**: Phase 1 트랜잭션에서 3개 파라미터 제거 (V2 11파라미터만 전달)
- **옵션 B**: 013 마이그레이션을 V2 11파라미터로 재정의
- **권장**: 옵션 A — DB 마이그레이션 수정은 리스크 높음. 3개가 DEFAULT이므로 호출측에서 제거하면 됨.

---

### HIGH-2: Settlement 필드명 불일치 (NEW)

SIM-2, SIM-3에서 동시 발견:

| V2 DB 컬럼 | Phase 1 필드명 | 문제 |
|-----------|-------------|------|
| commission_amount | totalCommission | V2 컬럼명과 의미 다름 |
| settlement_amount | totalPayout | V2 컬럼명과 의미 다름 |
| return_deduction | (누락) | V2 NOT NULL, 정산금 계산에 필수 |
| paid_at | paidAt (mapRow에서 누락) | 지급일 추적 불가 |
| paid_by | (누락) | 지급자 추적 불가 |
| transfer_reference | (누락) | 이체 참조번호 누락 |
| (없음) | sellerName (hardcoded '') | V2에 없는 팬텀 필드 |
| (없음) | sellerType (hardcoded '') | V2에 없는 팬텀 필드 |
| (없음) | updatedAt | V2에 없음 (confirmed_at으로 대체 중) |

**조치**: Settlement 인터페이스를 V2 16컬럼 기반으로 재설계.

---

### HIGH-3: SalesRecord 6개 팬텀 필드 (NEW)

SIM-2에서 발견:

| 팬텀 필드 | V2 실체 | 분석 |
|----------|---------|------|
| model | 없음 | V2에 없음 |
| category | 없음 | V2에 없음 |
| condition | 없음 | V2에 없음 |
| sellerId | 없음 | V2는 consignment_seller(text) |
| sellerName | 없음 | V2에 없음 |
| soldAt | 없음 | V2는 sale_date |
| channel | 없음 | V2에 없음 |

**조치**: SalesRecord를 V2 19컬럼 기반으로 재설계.

---

### HIGH-4: StProduct 추가 팬텀 3개 (NEW)

기존 딥리서치에서 발견된 6개(model, description, subCategory, originalPrice→retailPrice, estimatedPrice→salePrice, imageUrls→photos)에 추가로 SIM-2에서 3개 더 발견:

| 팬텀 필드 | V2 | 분석 |
|----------|-----|------|
| soldPrice | 없음 | V2는 sold_amount |
| orderId | 없음 | V2에 해당 컬럼 없음 |
| status (string) | 없음 | V2에 없음 (smartstore_status, photo_status는 별도) |

**조치**: StProduct를 V2 36컬럼 기반으로 재설계.

---

## IV. MEDIUM 이슈

### MED-1: BatchProgress 필드명 의미 차이

| V2 DB | Phase 1 | 의미 차이 |
|-------|---------|----------|
| total | totalFiles | 동일 의미, 이름만 다름 |
| completed | processedFiles | V2: 완료 수 / Phase 1: 처리된 수 (의미 다름) |
| failed | failCount | 동일 의미, 이름만 다름 |
| failed_ids (jsonb) | (누락) | 실패 ID 목록 누락 |

**추가 팬텀**: successCount, startedAt, completedAt, errorMessage (V2에 없음)

---

### MED-2: NotificationLog 불일치

| V2 DB | Phase 1 | 상태 |
|-------|---------|------|
| consignment_id | (누락) | FK 누락 |
| trigger_event | (누락) | 트리거 이벤트 추적 불가 |
| channel | (누락) | 채널 정보 누락 |
| api_response | (누락) | API 응답 추적 불가 |
| (없음) | sentAt | 팬텀 (V2에 없음) |

---

## V. Phase 0 마이그레이션별 충돌 상태

| # | 마이그레이션 | Phase 1 충돌 | 상태 |
|---|------------|------------|------|
| 001 | consignment_status CHECK (7값) | CONSIGNMENT_STATUSES 일치 | **PASS** |
| 002 | UNIQUE 제약 5개 | 타입과 무관 | **PASS** |
| 003 | 성능 인덱스 5개 | 타입과 무관 | **PASS** |
| 004 | RLS (anon read) | auth.ts와 무관 | **PASS** |
| 005 | RPC settlement (초안) | 012에서 대체됨 | **N/A** |
| 006 | RPC order (5파라미터) | order.tx.ts 5파라미터 일치 | **PASS** |
| 007 | RPC consignment (초안) | 013에서 대체됨 | **N/A** |
| 008 | upload_session_id | 타입과 무관 | **PASS** |
| 009 | _batch_progress 테이블 | BatchProgress 필드명 차이 | **MED** |
| 010 | orders.hold_token + RLS | holdToken 필드 일치 | **PASS** |
| 011 | RPC settlement FIX | 012에서 대체됨 | **N/A** |
| 012 | RPC settlement FIX-V2 (8파라미터) | settlement.tx.ts 8파라미터 일치 | **PASS** |
| **013** | **RPC consignment FIX-V2 (14파라미터)** | **V2는 11파라미터. 3개 초과** | **HIGH** |
| 014 | updated_at 트리거 3테이블 | 타입과 무관 | **PASS** |
| 015 | RPC generate_product_number | CT-{CODE}-{SEQ} (위탁용, V3 신규) | **PASS** |
| 016 | orders_status_extend (10값) | V2 8값 + CONFIRMED/CANCELLED 일치 | **PASS** (오탐 정정) |

**요약**: 16개 마이그레이션 중 CRITICAL 0개, **HIGH 1개(013)**, **MED 1개(009)**, PASS 11개, N/A 3개.

---

## VI. 의사결정 필요 사항

### ~~결정 1: ORDER_STATUSES 기준~~ (해소됨)

**2026-03-07 해소**: 016은 V2 8값 + V3 추가 2값(CONFIRMED, CANCELLED)으로 확인.
016 현행 유지, 의사결정 불필요.

### ~~결정 2: 마이그레이션 013 처리~~ (해소됨)

**2026-03-07 해소**: 013은 이미 Tokyo DB에 적용된 현실. Phase 1은 현재 DB 기준(14파라미터)에 맞추면 됨. V2 마이그레이션 수정은 V3 작업 범위 밖.

### ~~결정 3: Settlement 필드명~~ (해소됨)

**2026-03-07 해소**: V2 1:1 원칙에 따라 V2 컬럼명 직역(commissionAmount, settlementAmount)으로 확정. 의사결정 불필요.

---

## VII. Phase 1 재구현 계획 수정사항

### 기존 24건 + 신규 4건 = 총 28건 (오탐 1건 제외)

| 분류 | 기존 | 신규 | 합계 |
|------|------|------|------|
| CRITICAL | 1 | 1 | **2** |
| HIGH | 15 | 4 | **19** |
| MEDIUM | 6 | 2 | **8** |
| LOW | 2 | 0 | **2** |
| **합계** | **24** | **7** | **31** |

### 신규 이슈 목록

| # | 심각도 | 이슈 | 조치 |
|---|--------|------|------|
| ~~NEW-CRIT-1~~ | ~~CRITICAL~~ | ~~ORDER_STATUSES 016 마이그레이션 V2와 다른 값~~ | **오탐 — V2 마이그레이션 원본에서 동일 8값 확인** |
| NEW-HIGH-1 | HIGH | Settlement return_deduction 누락 (V2 NOT NULL) | 인터페이스에 추가 |
| NEW-HIGH-2 | HIGH | Settlement.updatedAt 팬텀 + sellerName/sellerType 팬텀 | 제거, JOIN 별도 |
| NEW-HIGH-3 | HIGH | SalesRecord 6개 팬텀 필드 | V2 19컬럼 기반 재설계 |
| NEW-HIGH-4 | HIGH | StProduct.soldPrice/orderId/status 팬텀 3개 추가 | 제거 |
| NEW-MED-1 | MED | BatchProgress 필드명 의미 차이 + 5개 팬텀 | V2 9컬럼 기반 재설계 |
| NEW-MED-2 | MED | NotificationLog consignmentId/triggerEvent/channel 누락 + sentAt 팬텀 | V2 10컬럼 기반 재설계 |
| NEW-MED-3 | MED | Settlement 필드명 불일치 (totalCommission↔commissionAmount) | V2 컬럼명 직역 |

---

## VIII. 시뮬레이션 신뢰도

### 교차 검증 매트릭스

| 이슈 | SIM-1 | SIM-2 | SIM-3 | 재현율 |
|------|-------|-------|-------|--------|
| SettlementItem CRIT | O | O | O | 3/3 (100%) |
| products.repo COLUMNS | O | O | O | 3/3 (100%) |
| SoldItem 팬텀 | O | O | O | 3/3 (100%) |
| ConsignmentRequest 팬텀 | O | O | — | 2/3 (67%) |
| complete_consignment 14파라미터 | O | — | O | 2/3 (67%) |
| ~~ORDER_STATUSES 불일치~~ | — | O | O | 2/3 (67%) — **오탐 정정** |
| Settlement 필드명 | — | O | O | 2/3 (67%) |
| SalesRecord 팬텀 | — | O | O | 2/3 (67%) |

### 오탐(False Positive) 분석

- **NEW-CRIT-1 (ORDER_STATUSES)** → **오탐 확정 (2026-03-07)**. `v2_constraints.txt` 덤프에 CHECK 미존재로 판단했으나, V2 마이그레이션 원본(`20260219_orders_system.sql`)에서 동일 8값 확인. Mumbai에 `CREATE TABLE IF NOT EXISTS`로 인해 CHECK 미적용된 것이 원인.
- SIM-2의 "Seller 16컬럼 누락" → 설계 의도 (plan5.md 스코프 외). 오탐 아님, MISSING으로 분류
- SIM-3의 "Supabase 초과 파라미터 무시" → 확인: Supabase RPC는 미정의 파라미터를 무시함. 에러는 아니지만 인터페이스 불일치

### 최종 신뢰도: **A등급** (3개 독립 에이전트 교차 검증, 오탐 1건 사후 정정)

---

## IX. 파일 참조

| 카테고리 | 경로 |
|---------|------|
| 본 보고서 | docs/03-analysis/phase0-phase1-conflict-simulation-report.md |
| Phase 1 재구현 레퍼런스 | docs/03-analysis/phase1-reimpl-reference.md |
| 신뢰도 보고서 (4라운드) | docs/03-analysis/v2-deep-research-reliability-report.md |
| 마이그레이션 013 | supabase/migrations/20260304000013_fix_rpc_consignment_v2.sql |
| 마이그레이션 016 | supabase/migrations/20260304000016_orders_status_extend.sql |
| V2 제약조건 백업 | supabase/backup/v2_constraints.txt |
