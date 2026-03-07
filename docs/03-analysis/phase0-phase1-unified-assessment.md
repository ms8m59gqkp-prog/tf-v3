# Phase 0 문제점 + Phase 1 수정계획 + 수정 범위 평가

**작성일**: 2026-03-04
**목적**: Phase 0 감사 결과, Phase 1 수정 계획, 교차 충돌, 실행 전략을 단일 문서로 통합
**상태**: 의사결정 대기
**참조 문서**:
- `phase0-v2-audit-report.md` — Phase 0 V2↔V3 비교 감사 (CRITICAL 8 + HIGH 5 + MEDIUM 4 + LOW 2)
- `phase1-v2-alignment-plan.md` — Phase 1 수정 계획 (13 SECTION, 승인 전)
- `phase0-phase1-conflict-analysis.md` — 교차 충돌 분석 (7건)

---

## PART A: Phase 0 문제점 총괄

### A-1. 문제 원인

V3 Phase 0 RPC(005, 006, 007)는 **plan5.md 명세 기반**으로 작성되었으며,
V2 실제 DB 스키마와의 교차 검증이 부족했음.
11개 마이그레이션 중 **005, 007에 CRITICAL 집중**, 006에 경미한 문제.

### A-2. CRITICAL — 런타임 에러 (8건)

| # | 대상 | 버그 | V2 실제 | 에러 메시지 |
|---|------|------|---------|-----------|
| C-1 | RPC 005 | `period_start` 컬럼명 | `settlement_period_start` | column does not exist |
| C-2 | RPC 005 | `'pending'` 상태값 | CHECK: draft/confirmed/paid/failed | check constraint violation |
| C-3 | RPC 007 | `'RECEIVED'` 상태값 | CHECK: 8값 중 RECEIVED 없음 | check constraint violation |
| C-4 | RPC 007 | `consignment_id` 컬럼 | st_products에 **존재하지 않음** | column does not exist |
| C-5 | RPC 007 | `condition` 컬럼명 | `product_condition`이 맞음 | column does not exist |
| C-6 | RPC 007 | `product_name` 미제공 | NOT NULL (기본값 없음) | not-null constraint violation |
| C-7 | RPC 007 | `sale_price` 미제공 | NOT NULL (기본값 없음) | not-null constraint violation |
| C-8 | RPC 005 | `settlement_status` → `status` | **011에서 수정됨** (RESOLVED) | — |

**C-8은 해결됨. 나머지 7건은 미해결.**

### A-3. HIGH — 데이터 무결성 / 핵심 기능 누락 (5건)

| # | 대상 | 문제 | 영향 |
|---|------|------|------|
| H-1 | RPC 007 | st_products.seller_id 미제공 | 정산 연결 불가 (NULLABLE이라 에러는 안 남) |
| H-2 | RPC 007 | V2 필수 컬럼 다수 누락 | 데이터 불완전 |
| H-3 | Phase 0 전체 | `generate_product_number` RPC 누락 | 위탁 승인 시 상품번호 생성 불가 |
| H-4 | Phase 0 전체 | `get_commission_rate` RPC 누락 | DB 레벨 커미션 보장 상실 |
| H-5 | Phase 0 전체 | `update_updated_at()` 트리거 누락 | 일반 UPDATE 시 updated_at 갱신 안 됨 |

### A-4. MEDIUM (4건) + LOW (2건)

| # | 문제 | 영향 |
|---|------|------|
| M-1 | settlement_matches 테이블 미참조 | 정산 매칭 워크플로우 미구현 |
| M-2 | settlement_audit_log 미참조 | 감사 추적 불가 |
| M-3 | dedup 유니크 인덱스 미포함 | 중복 INSERT 방지 불가 |
| M-4 | RLS orders_anon_update에 IMAGE_COMPLETE 하드코딩 | CHECK 확장 시 정합성 검토 필요 |
| L-1 | orders에 seller_tier/seller_type 중복 | 정리 미진행 |
| L-2 | 레거시 테이블 정리 미계획 | 향후 Phase에서 결정 |

### A-5. 양호 항목 (공정 평가)

11개 파일 중 **6개(001, 002, 003, 004, 008, 009, 010)는 양호 또는 V2 대비 개선**.
- 001: consignment CHECK 7값 통일
- 002: settlement_queue, return_shipments UNIQUE 추가
- 003: sold_items 복합 인덱스 추가
- 004: consignment_anon_read 토큰 RLS
- 008: upload_session_id (V2 동시삭제 문제 해결)
- 009: _batch_progress 신규 테이블
- 010: hold_token 기반 orders RLS

---

## PART B: Phase 0 수정안

### B-1. FIX-1 — RPC 005 재작성 (C-1, C-2 해소)

**파일**: `20260304000012_fix_rpc_settlement_v2.sql`
**변경**:
- `period_start` → `settlement_period_start` (컬럼명 V2 일치)
- `period_end` → `settlement_period_end` (컬럼명 V2 일치)
- `'pending'` → `'draft'` (V2 CHECK 준수)
- `item_count` INSERT 추가 (v_expected_count 활용)

**RPC 시그니처 변경**: 없음 (내부 SQL만 수정)
**Phase 2 settlement.tx.ts 영향**: 없음

### B-2. FIX-2 — RPC 007 전면 재작성 (C-3~C-7, H-1, H-2 해소)

**파일**: `20260304000013_fix_rpc_consignment_v2.sql`
**변경**:
- `consignment_id` 컬럼 참조 제거 (V2에 없는 컬럼)
- `condition` → `product_condition` (V2 컬럼명)
- `'RECEIVED'` → `'APPLIED'` (V2 CHECK 준수)
- **파라미터 3개 추가**: `p_product_name`, `p_sale_price`, `p_seller_id` (모두 DEFAULT 있음)
- order_items에 `brand`, `model`, `condition` NOT NULL 대응 추가
- `product_id = v_product_id` 업데이트 추가 (V2 역방향 FK 연결)
- consignment_requests에서 seller_id, product_name COALESCE 폴백

**RPC 시그니처 변경**: 파라미터 3개 추가 (DEFAULT 값으로 기존 호출 호환)
**Phase 2 consignment.tx.ts 영향**: 코드 수정 필요 (3필드 추가). 단, 미수정 시에도 DEFAULT로 동작.

### B-3. FIX-3 — 트리거 추가 (H-5 해소)

**파일**: `20260304000014_updated_at_triggers.sql`
**변경**:
- `update_updated_at()` 트리거 함수 생성 (CREATE OR REPLACE)
- sellers, st_products, consignment_requests 3개 테이블에 BEFORE UPDATE 트리거 부착
- 멱등성: `IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = ...)` 패턴

**Phase 2 영향**: 없음 (트리거는 투명하게 동작)

### B-4. Phase 0 수정 리스크 매트릭스

| 수정안 | 수정 위험도 | 미수정 위험도 | TS 영향 |
|--------|-----------|-------------|---------|
| FIX-1 | **LOW** | **CRITICAL** | 0줄 |
| FIX-2 | **MEDIUM** | **CRITICAL** (5건) | consignment.tx.ts 선택적 |
| FIX-3 | **NONE** | **HIGH** | 0줄 |

---

## PART C: Phase 1 수정 계획 (현황 + 갱신 필요 사항)

### C-1. Phase 1 계획서 현재 내용 (승인 전)

| SECTION | 대상 | 핵심 변경 | 상태 |
|---------|------|---------|------|
| 1 | 브랜드 별칭 | BRAND_ALIAS_MAP V2+V3 병합 (59개) | 유효 |
| 2 | ID 채번 | id.ts 전면 재작성 + generate_product_number RPC | 유효 |
| 3 | OrderStatus | 10값 + ALLOWED_TRANSITIONS | 유효 |
| 4 | Condition | N/S/A/B + derivePrices | 유효 |
| 5 | RPC 007 버그 | 'RECEIVED' → 'APPLIED' **부분 수정만** | **갱신 필요** |
| 6 | Blast Radius | 5+3=8파일 | **갱신 필요** |
| 9 | 실행 순서 | 012/013/014 | **갱신 필요** |
| 11 | Phase 0 보강 | 마이그레이션 012/013/014 | **갱신 필요** |

### C-2. 충돌 분석에서 발견된 문제 7건

| # | 충돌 | 심각도 | 계획서 반영 |
|---|------|--------|-----------|
| X-1 | Migration 014 vs FIX-2: 같은 함수 이중 정의 | **CRITICAL** | 미반영 |
| X-2 | 마이그레이션 번호 012/013/014 이중 할당 | **HIGH** | 미반영 |
| X-3 | RPC 005 수정이 계획서에 없음 | **HIGH** | 미반영 |
| X-4 | consignment.tx.ts를 "확인"으로만 분류 | **HIGH** | 미반영 |
| X-5 | FIX-3 트리거가 계획서에 없음 | **MEDIUM** | 미반영 |
| X-6 | RLS + CHECK 확장 후 정합성 | **MEDIUM** | 미반영 |
| X-7 | RPC 006 p_status 방어 부재 | **LOW** | 미반영 |

### C-3. Phase 1 계획서 갱신이 필요한 구체적 항목

| 현재 계획서 | 문제 | 갱신 내용 |
|-----------|------|---------|
| SECTION 5: Migration 014 = 부분 수정 (1건만) | FIX-2가 6건 수정하므로 014 불필요 | **SECTION 5 전체 폐기** — Phase 0에서 FIX-2로 완전 해결됨을 명시 |
| SECTION 6.1: 신규 마이그레이션 3개 (012/013/014) | Phase 0 선행 시 012/013/014 이미 사용됨 | **015, 016으로 재할당** |
| SECTION 6.2: consignment.tx.ts "RPC 수정 반영 확인" | FIX-2로 시그니처 변경 → 코드 수정 필요 | **"확인" → "수정"으로 재분류** |
| SECTION 9: Step 0에서 012/013/014 생성 | 번호 충돌 | **Step 0에서 015/016만 생성** |
| SECTION 11: 3개 마이그레이션 상세 | 012/013은 번호 변경, 014는 폐기 | **015(generate_product_number), 016(CHECK 확장) 2개로 축소** |
| SECTION 11.3: 의존성 "013↔014 반드시 함께" | 014 폐기로 의존성 소멸 | **016은 독립 적용 가능 (FIX-2가 이미 'APPLIED' 사용)** |
| 없음 | RPC 005 수정(FIX-1)이 계획서에 누락 | **Phase 0에서 해결됨을 SECTION 11에 명시** |

### C-4. Phase 0 선행 후 Phase 1의 실제 수정 범위

Phase 0이 먼저 커밋된 후, Phase 1에서 실제로 해야 할 작업:

```
━━━ SQL 마이그레이션 (2개) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
015: generate_product_number RPC (Phase 1 계획서 SECTION 2)
016: orders.status CHECK 확장 8→10값 (Phase 1 계획서 SECTION 3)

━━━ TS 타입/유틸 수정 (3개) ━━━━━━━━━━━━━━━━━━━━━━━━━━━
order.ts: OrderStatus 10값 + Condition N/S/A/B + TRANSITIONS + derivePrices
brand.ts: BRAND_ALIAS_MAP V2+V3 병합 (59개)
id.ts:    채번 전면 재작성 (주문 YYYYMMDD-숫자6, 상품 YYYYMMDD-알파벳6)

━━━ Phase 2 후속 수정 (1개) ━━━━━━━━━━━━━━━━━━━━━━━━━━━
consignment.tx.ts: CompleteConsignmentInput에 productName, salePrice, sellerId 추가

━━━ 테스트 수정 (2개) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
types.test.ts: OrderStatus 10값 + 전이 규칙 검증
utils.test.ts: ID 패턴 + 브랜드 테스트

━━━ 검증 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
tsc --noEmit: 0 에러
vitest run: 전체 PASS
```

**총 8파일** (SQL 2 + TS 4 + 테스트 2)

---

## PART D: 실행 전략 — Phase 0 선행 권장

### D-1. 비교 분석

| 기준 | Phase 0 선행 → Phase 1 | 통합 계획 |
|------|----------------------|---------|
| **리스크 격리** | SQL 실패 ≠ TS 오염 | SQL+TS 혼합, 실패 시 연쇄 |
| **CRITICAL 해소 속도** | 즉시 (SQL 3파일 복사) | Phase 1 재계획 시간만큼 지연 |
| **Phase 1 계획 정확도** | DB 확정 상태 기반 (사실) | DB 예정 상태 기반 (가정) |
| **커밋 단위** | 2커밋 (각각 독립 rollback) | 1커밋 (14파일, rollback 거칠음) |
| **계획 오버헤드** | Phase 0은 계획 불필요 (감사 보고서=실행 계획) | 통합 문서 신규 작성 필요 |
| **consignment.tx.ts** | FIX-2 확정 후 확실한 수정 | FIX-2 계획 기반 수정 (가정) |

### D-2. 통합이 우월한 유일한 시나리오

> Phase 0 커밋 후, Phase 1 작업 중 "Phase 0 SQL을 다시 수정해야 하는 발견"이 나올 경우
> → 커밋 이력이 지저분해짐

**이 가능성이 낮은 이유**:
- FIX-1/2/3은 V2 실측 데이터 기반 (추측 아님)
- Phase 1 수정 범위(OrderStatus, Condition, brand, id)는 Phase 0 RPC와 직접 겹치지 않음
- 유일한 접점: orders.status CHECK 확장(016)은 FIX-2와 독립 ('APPLIED'는 이미 V2 CHECK에 존재)

### D-3. 권장 실행 흐름

```
[Phase 0 패치 — 즉시]
  012: FIX-1 (RPC 005 재작성) — SQL only
  013: FIX-2 (RPC 007 재작성) — SQL only
  014: FIX-3 (트리거) — SQL only
  → tsc --noEmit (0 에러, TS 변경 없음)
  → vitest run (92 테스트 PASS)
  → 커밋: "fix(phase0): RPC 005/007 V2 정렬 + updated_at 트리거"

[Phase 1 계획서 갱신]
  → SECTION 5 폐기 (FIX-2로 해결됨)
  → 번호 재할당 (012/013/014 → 015/016)
  → consignment.tx.ts "확인" → "수정"
  → 승인 요청

[Phase 1 실행]
  → SQL 2개 + TS 4개 + 테스트 2개 = 8파일
  → tsc + vitest + ESLint 검증
  → 커밋: "feat(phase1): V2 정렬 — OrderStatus/Condition/Brand/ID"
```

---

## PART E: 수정 범위에 대한 평가 의견

### E-1. Phase 0 수정 — 단순하지만 방심 불가

**난이도**: 낮음. SQL 3파일, 감사 보고서에 완성 코드 있음.

**그러나 주의할 점**:

| # | 우려 | 상세 |
|---|------|------|
| 1 | **FIX-2 SELECT * 사용** | `SELECT * INTO v_consignment FROM consignment_requests` — V2 테이블 컬럼이 변경되면 record 구조 변동. 명시적 컬럼 SELECT가 더 안전하나, V2 원본도 SELECT * 사용하므로 호환성 우선 유지 |
| 2 | **FIX-2 COALESCE 폴백 순서** | `COALESCE(p_seller_id, v_consignment.seller_id)` — p_seller_id=NULL이면 consignment의 seller_id 사용. 그런데 consignment에도 seller_id가 NULL이면? → NULL 저장됨. 정산 연결 불가. **서비스 레이어에서 seller_id 필수 검증 필요 (Phase 4)** |
| 3 | **FIX-1 item_count 추가** | V2 settlements.item_count DEFAULT 0. FIX-1이 v_expected_count를 넣는 건 V2보다 나은 개선이지만, **V2 기존 코드가 item_count를 읽는지 확인 안 됨**. 읽지 않으면 무해, 읽으면 동작 변경 가능 |
| 4 | **트리거 실행 순서** | FIX-3 트리거가 FIX-2의 `updated_at = now()` 명시 설정과 겹침. 트리거는 BEFORE UPDATE이므로 FIX-2의 명시 설정이 최종값. 무해하나 **중복 로직이 존재한다는 사실은 인지** |

### E-2. Phase 1 수정 — 핵심은 OrderStatus 전이 규칙

**난이도**: 중간. 타입 변경 자체는 단순하나 ALLOWED_TRANSITIONS가 비즈니스 로직의 심장.

| # | 우려 | 상세 |
|---|------|------|
| 1 | **ALLOWED_TRANSITIONS 검증 범위** | V2 코드에서 추출한 전이 규칙이지만, V2에 **명시적 전이 검증 코드가 없음** (UI 버튼 나열이 곧 규칙). 실제 운영에서 예외적 전이가 발생했을 가능성을 배제 불가 |
| 2 | **CONFIRMED/CANCELLED 전이 규칙** | V3 신규 상태. V2 운영 경험 없음. `IMAGE_COMPLETE → CONFIRMED`이 맞는지, 혹시 `INSPECTED → CONFIRMED`도 필요한지 **비즈니스 확인 없이 결정됨** |
| 3 | **derivePrices 비율 하드코딩** | `N:1.00, S:0.85, A:0.70, B:0.50` — V2에서 검증된 비율이나, **DB에 저장되지 않고 TS 코드에만 존재**. V2도 동일하므로 호환성은 OK이나, 비율 변경 시 코드 수정+배포 필요 |
| 4 | **id.ts 전면 재작성 위험** | 기존 generateOrderNumber, generateProductNumber 함수를 완전 교체. **다른 파일에서 import해서 사용하는 곳이 있다면** 시그니처 변경 시 문제. Phase 2 order.tx.ts에서 사용 중이므로 호환성 확인 필수 |
| 5 | **brand.ts 59개 병합 후 크기** | BRAND_ALIAS_MAP이 ~200줄 이상. 파일 크기 제한(100줄) 위반 가능. 상수 파일 예외(200줄)에 해당하나 경계선 |

### E-3. Phase 2 후속 수정 — 과소평가 위험

**consignment.tx.ts** 수정은 3필드 추가로 단순해 보이나:

| # | 우려 | 상세 |
|---|------|------|
| 1 | **테스트 수정 필요성** | `__tests__/unit/db.test.ts`에 consignment.tx.ts 관련 테스트가 있다면 수정 필요. 계획서에서 "변경 불필요"로 분류했으나 재확인 필요 |
| 2 | **Phase 2 커밋 무결성** | consignment.tx.ts를 Phase 1에서 수정하면, Phase 2 커밋(`c65b0b7`)의 코드와 Phase 1 커밋의 코드가 섞임. git blame 추적이 복잡해짐 |
| 3 | **선택적 vs 필수** | "DEFAULT로 동작하므로 선택적"이라 했으나, **product_name=NULL, sale_price=0이 DB에 저장되는 것은 데이터 품질 저하**. Phase 4까지 방치하면 불완전 데이터 누적 |

### E-4. 전체 수정 범위의 위험도 총평

| 범위 | 파일 수 | 난이도 | 가장 큰 위험 |
|------|--------|--------|------------|
| Phase 0 패치 | SQL 3개 | **낮음** | FIX-2 COALESCE NULL 폴백 (Phase 4에서 보완) |
| Phase 1 SQL | SQL 2개 | **낮음** | CHECK DROP↔ADD 사이 잠재적 공백 |
| Phase 1 TS | TS 3개 | **중간** | ALLOWED_TRANSITIONS 비즈니스 검증 미완 |
| Phase 1 테스트 | 테스트 2개 | **낮음** | 커버리지 갭 (신규 마이그레이션 미테스트) |
| Phase 2 후속 | TS 1개 | **낮음** | 불완전 데이터 누적 가능성 |

**총 11파일 (SQL 5 + TS 4 + 테스트 2)**

### E-5. 수정하지 않아도 되는 것 (과잉 수정 방지)

| 항목 | 이유 |
|------|------|
| settlement.tx.ts | FIX-1은 RPC 시그니처 변경 없음. 내부 SQL만 수정 |
| orders.repo.ts | `as OrderStatus` 캐스팅은 V2 값에서도 동작. CHECK 확장 후 더 자연스러워짐 |
| order.tx.ts | status 파라미터가 string이므로 V2/V3 값 모두 전달 가능 |
| products.repo.ts | Condition 캐스팅은 V2 N/S/A/B에서 유효. 변경 불필요 |
| db.test.ts | condition 'A' 사용 — 유효값. 변경 불필요 |

### E-6. 수정해야 하지만 Phase 1 범위에 포함하지 않는 것 (후속 Phase)

| 항목 | 시기 | 이유 |
|------|------|------|
| get_commission_rate RPC | Phase 4 | TS 서비스에서 대체 가능. DB 레벨 필수 아님 |
| settlement_matches 테이블 | Phase 4 | 매칭 서비스 전체 설계 필요 |
| settlement_audit_log | Phase 4 | 감사 서비스 전체 설계 필요 |
| dedup 유니크 인덱스 | Phase 4 | 업로드 서비스와 함께 설계 |
| RLS orders_anon_update WITH CHECK 보강 | Phase 6 | Frontend 구현 시 함께 |
| RPC 006 p_status 방어 로직 | Phase 4 | 서비스 레이어에서 비즈니스 검증 |

---

## PART F: 리스크 총괄

### F-1. 수정 시 리스크 (관리 가능)

| # | 리스크 | 심각도 | 확률 | 발생 시점 | 대응 |
|---|--------|--------|------|---------|------|
| 1 | FIX-2 COALESCE NULL 폴백 → 셀러 미연결 | MEDIUM | 낮음 | Phase 0 패치 후 | Phase 4 서비스에서 seller_id 필수 검증 |
| 2 | ALLOWED_TRANSITIONS 비즈니스 미검증 | MEDIUM | 중간 | Phase 1 실행 후 | Phase 6 Frontend에서 운영 피드백 반영 |
| 3 | CHECK DROP↔ADD 사이 공백 | LOW | 매우 낮음 | Phase 1 SQL 적용 시 | 단일 트랜잭션으로 실행 (Supabase 보장) |
| 4 | id.ts 전면 재작성 시 호환성 | LOW | 낮음 | Phase 1 실행 시 | vitest + tsc로 검증 |
| 5 | 불완전 데이터 (product_name=NULL) | MEDIUM | 100% | Phase 0 패치~Phase 4 사이 | Phase 1에서 tx.ts 선수정으로 완화 |

### F-2. 미수정 시 리스크 (서비스 장애)

| # | 리스크 | 심각도 |
|---|--------|--------|
| 1 | RPC 005 런타임 에러 (컬럼 없음 + CHECK 위반) | **CRITICAL** |
| 2 | RPC 007 런타임 에러 (5건 동시) | **CRITICAL** |
| 3 | 브랜드 36개 누락 → 정산 매칭 실패 | **CRITICAL** |
| 4 | OrderStatus V2/V3 불일치 → DB CHECK 위반 | **HIGH** |
| 5 | Condition C/D → V2 DB CHECK 위반 | **HIGH** |

### F-3. 판정

**수정 시 최대 리스크: MEDIUM (관리 가능)**
**미수정 시 최대 리스크: CRITICAL 3건 + HIGH 2건 (서비스 불가)**

수정이 필수이며, 수정 과정의 리스크는 계획된 절차(검증 게이트, 테스트)로 모두 해소 가능.

---

## PART G: 의사결정 요약

| 결정 사항 | 권장 | 근거 |
|----------|------|------|
| Phase 0/1 실행 순서 | **Phase 0 선행** | 리스크 격리, CRITICAL 즉시 해소, DB 확정 후 TS 작업 |
| Phase 1 계획서 | **갱신 후 재승인** | 충돌 7건 미반영, 번호 충돌, 014 폐기 필요 |
| consignment.tx.ts | **Phase 1에서 수정** (선택적이 아닌 권장) | 불완전 데이터 방지 |
| Phase 0 계획 문서 | **불필요** (감사 보고서 = 실행 계획) | SQL 완성 코드 이미 존재 |

---

## PART H: 최선의 수정 방안 (확정)

### H-1. 3단계 순차 실행

```
Step 1: Phase 0 패치        — SQL 3파일, 즉시 실행
Step 2: Phase 1 계획서 갱신  — 문서 업데이트, 승인
Step 3: Phase 1 실행        — 8파일, 팀 모드
```

### H-2. Step 1 — Phase 0 패치 (즉시)

CRITICAL 7건을 최단 시간에 해소. TS 변경 0줄이므로 부작용 없음.

| 파일 | 내용 | 코드 출처 |
|------|------|---------|
| `20260304000012_fix_rpc_settlement_v2.sql` | FIX-1: RPC 005 재작성 | 감사 보고서 SECTION 7.1 |
| `20260304000013_fix_rpc_consignment_v2.sql` | FIX-2: RPC 007 재작성 | 감사 보고서 SECTION 7.1 |
| `20260304000014_updated_at_triggers.sql` | FIX-3: 트리거 3개 | 감사 보고서 SECTION 7.1 |

**검증**: `tsc --noEmit` (0 에러) + `vitest run` (92 테스트 PASS)
**커밋**: `fix(phase0): RPC 005/007 V2 정렬 + updated_at 트리거`

**이것만 하면 CRITICAL 7건 + HIGH 1건 해소.**

### H-3. Step 2 — Phase 1 기준 문서 전환 (승인 필요)

기존 `phase1-v2-alignment-plan.md`를 별도로 갱신하지 않는다.
**본 문서(unified-assessment.md) PART C-4를 Phase 1의 실행 기준으로 채택.**

이유:
- 기존 계획서는 충돌 7건 미반영 상태 — 갱신하면 7개 SECTION 수정 필요
- 본 문서에 이미 갱신 내용이 전부 포함됨
- 기존 계획서의 핵심 분석(brand, OrderStatus, Condition, id.ts)은 여전히 유효하므로 **참조용으로 유지**

**승인 대상**: 본 문서 PART C-4의 8파일 범위 + PART H-4의 파일별 스펙

### H-4. Step 3 — Phase 1 실행 (팀 모드)

#### SQL 마이그레이션 (2개)

| 파일 | 내용 | 참조 |
|------|------|------|
| `20260304000015_rpc_generate_product_number.sql` | 위탁 상품번호 RPC (`CT-{SELLER_CODE}-{SEQ:3}`) | Phase 1 계획서 SECTION 2.3 |
| `20260304000016_orders_status_extend.sql` | CHECK 8→10값 (CONFIRMED, CANCELLED 추가) | Phase 1 계획서 SECTION 3.3 |

015 의존성: 독립. 단독 적용 가능.
016 의존성: 독립. FIX-2가 이미 'APPLIED' 사용하므로 CHECK 확장 전후 무관.

#### TS 타입/유틸 수정 (3개)

| 파일 | 변경 내용 | 참조 |
|------|---------|------|
| `lib/types/domain/order.ts` | OrderStatus 10값, Condition N/S/A/B, CONDITION_LABELS(N="NEW"), ALLOWED_TRANSITIONS(옵션C), derivePrices, deriveOriginalPrice | Phase 1 계획서 SECTION 3, 4 |
| `lib/utils/brand.ts` | BRAND_ALIAS_MAP V2 43개 + V3 고유 16개 = 59개 병합 | Phase 1 계획서 SECTION 1 |
| `lib/utils/id.ts` | 전면 재작성 — 주문 `YYYYMMDD-숫자6`, 상품 `YYYYMMDD-알파벳6`. crypto.randomInt 유지 | Phase 1 계획서 SECTION 2 |

#### Phase 2 후속 수정 (1개)

| 파일 | 변경 내용 | 이유 |
|------|---------|------|
| `lib/db/transactions/consignment.tx.ts` | CompleteConsignmentInput에 `productName?: string`, `salePrice?: number`, `sellerId?: string` 추가. RPC 호출부에 3파라미터 매핑 추가 | FIX-2로 RPC 시그니처 변경됨. DEFAULT로 동작은 하나 데이터 완전성 확보 |

#### 테스트 수정 (2개)

| 파일 | 변경 내용 | 참조 |
|------|---------|------|
| `__tests__/unit/types.test.ts` | OrderStatus 10값 assertion, ALLOWED_TRANSITIONS 전이 규칙 검증, Condition N/S/A/B 검증 | Phase 1 계획서 SECTION 3.4 |
| `__tests__/unit/utils.test.ts` | ID 패턴 정규식 (`/^\d{8}-\d{6}$/`, `/^\d{8}-[A-Z]{6}$/`), normalizeBrand V2 클래식 브랜드 테스트 | Phase 1 계획서 SECTION 1.3, 2.5 |

#### 수정하지 않는 파일 (명시)

| 파일 | 이유 |
|------|------|
| `settlement.tx.ts` | FIX-1은 RPC 시그니처 변경 없음 |
| `orders.repo.ts` | `as OrderStatus` 캐스팅은 V2 값에서 유효 |
| `order.tx.ts` | status가 string 파라미터 — 변경 불필요 |
| `products.repo.ts` | Condition 캐스팅은 V2 N/S/A/B에서 유효 |
| `db.test.ts` | condition 'A' — 유효값 |

#### 검증 게이트

```
G1: tsc --strict --noEmit          → 0 errors
G2: vitest run                     → 전체 PASS (92+ 테스트)
G3: grep -r "\.or(\`" lib/db/      → 0 matches (injection 방지)
G4: grep -r "select('\*')" lib/db/ → 0 matches
G5: grep -rn ": any\|as any" lib/  → 0 matches
```

**커밋**: `feat(phase1): V2 정렬 — OrderStatus/Condition/Brand/ID + consignment.tx.ts 보강`

### H-5. 이 방안이 최선인 이유

| 대안 | 문제 |
|------|------|
| Phase 0+1 통합 실행 | CRITICAL 해소가 Phase 1 재계획만큼 지연. 14파일 단일 커밋은 rollback 거칠음 |
| Phase 1 계획서 정식 갱신 | 기존 문서의 7개 SECTION을 수정하는 작업 자체가 비효율. 통합 평가 문서가 이미 갱신 내용 포함 |
| Phase 0만 하고 Phase 1은 나중에 | Phase 1 TS 불일치(OrderStatus, Condition, brand)가 방치됨. Phase 3-4 진행 불가 |
| consignment.tx.ts를 Phase 4로 미룸 | DEFAULT로 동작하긴 하나 product_name=NULL, sale_price=0 데이터 누적. 일찍 고치는 게 싸다 |

### H-6. 주의사항 (네거티브)

Phase 0 선행이 최선이지만 **리스크가 0은 아님**:

| # | 리스크 | 설명 | 대응 |
|---|--------|------|------|
| 1 | Phase 0 커밋~Phase 1 커밋 사이 **중간 상태** | DB는 정상인데 TS 타입은 V2 미정렬 | Phase 1을 Phase 0 직후 즉시 시작하여 간격 최소화 |
| 2 | FIX-2 DEFAULT로 인한 **불완전 데이터** | product_name=NULL, sale_price=0 가능 | Phase 1에서 consignment.tx.ts 수정으로 완화. 완전 해소는 Phase 4 서비스 |
| 3 | Phase 0 커밋 메시지에 **후속 작업 미명시** 시 추적 누락 | consignment.tx.ts 수정 필요성 잊힘 | 커밋 메시지에 "NOTE: consignment.tx.ts 3필드 추가 필요 (Phase 1에서 처리)" 명시 |
| 4 | **Phase 1 승인 지연** 시 CRITICAL은 해소됐으나 TS 불일치 장기화 | OrderStatus, Condition 등 V2 미정렬 상태 유지 | Phase 0 커밋 직후 Phase 1 승인 요청. 불필요한 계획 사이클 최소화 |

### H-7. 타임라인 예상

```
Phase 0 패치:  SQL 3파일 생성 + 검증 + 커밋         → 단시간
Phase 1 승인:  본 문서 PART C-4 + H-4 범위 승인     → 사용자 확인
Phase 1 실행:  8파일 수정 + 검증 게이트 + 커밋       → 팀 모드 병렬 처리
```

**Phase 0 완료 시점의 프로젝트 상태**:
- Phase 0: 14개 마이그레이션 (11 원본 + 3 패치) — DB CRITICAL 해소
- Phase 1: 28개 파일 (기존) — TS 수정 대기
- Phase 2: 17개 파일 (기존, 92 테스트) — consignment.tx.ts 수정 대기

**Phase 1 완료 시점의 프로젝트 상태**:
- Phase 0: 16개 마이그레이션 (14 + 015 + 016) — DB 완전 정렬
- Phase 1: 33개 파일 (28 기존 + 3 TS 수정 + 2 테스트 수정) — V2 정렬 완료
- Phase 2: 17개 파일 (92 테스트, consignment.tx.ts 보강) — 정렬 완료
- **V2 호환성: 98%+ 달성. Phase 3-4 진행 가능.**
