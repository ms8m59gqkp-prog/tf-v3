# V2→V3 마이그레이션 마스터 로그

**최종 업데이트**: 2026-03-06
**작성 목적**: 전체 마이그레이션 작업의 의사결정, 결과물, 미완료 과제, 향후 방향을 단일 문서로 통합
**참조 문서**:
- `v2-v3-delta-confirmed.md` — 확정 델타 10건 + APP-BUG 3건
- `phase0-phase1-unified-assessment.md` — Phase 0 감사 + Phase 1 수정 평가
- `phase0-phase1-conflict-report.md` — Phase 0↔1 충돌 4건 수정
- `phase-progress-log.md` — Phase별 커밋 이력
- `phase3-4-plan.md` — Phase 3+4 리서치 보고서 (승인 대기)

---

## 1. 프로젝트 개요

### 1.1 인프라

| 환경 | Supabase 프로젝트 | 리전 | 역할 |
|------|-------------------|------|------|
| **Mumbai** | `hmoxjhvjqzqepasvffbp` | ap-south-1 | V2 프로덕션 (원본) |
| **Tokyo** | `jmgscpmkrvvxxuzejrdf` | ap-northeast-1 | V3 타겟 (마이그레이션 완료) |

### 1.2 DB 규모

| 항목 | Mumbai (V2) | Tokyo (V3) | 비고 |
|------|------------|------------|------|
| 테이블 | 26 | 26 | 일치 |
| 컬럼 | 389 | 389 | 일치 |
| FK | 23 | 23 | 일치 |
| UNIQUE | 20 | 20 | 일치 |
| CHECK | 29 | 30 | +1 (DELTA-1: orders_status_check) |
| 인덱스 | 129 | 129 | 일치 |
| 함수 | 11 | 10 | -1 (generate_product_id 제거) |
| 트리거 | 4 | 4 | 일치 |
| RLS 정책 | 34 | 52 | +18 (9개 policyless 테이블 보강) |
| 데이터 행 | 5,326 | 5,326 | 완전 일치 |

---

## 2. 완료 작업 타임라인

### Phase 0: DB 마이그레이션 (커밋 `540558d`)

V3 RPC/마이그레이션 16개 작성. **plan5.md 명세 기반**으로 작성되어 V2 실제 DDL과 불일치 발생.

| # | 마이그레이션 | 내용 | 상태 |
|---|------------|------|------|
| 001 | consignment_status_check | 위탁 7값 CHECK | 완료 |
| 002 | unique_constraints | 5개 UNIQUE 제약 | 완료 |
| 003 | performance_indexes | 5개 인덱스 | 완료 |
| 004 | rls_policies | RLS 정책 | 완료 |
| 005 | rpc_settlement | 정산 RPC | →012에서 교체 |
| 006 | rpc_order | 주문 RPC | 완료 |
| 007 | rpc_consignment | 위탁 RPC | →013에서 교체 |
| 008 | upload_session_id | sales_records 컬럼 추가 | 완료 |
| 009 | batch_progress | _batch_progress 테이블 | 완료 |
| 010 | public_orders_rls | hold_token + RLS | 완료 |
| 011 | fix_rpc_settlement | 정산 RPC 1차 수정 | →012에서 교체 |

### Phase 0 Patch: V2 DB 정렬 (커밋 `cf8a3d9`)

V2 실제 DDL 대조 후 CRITICAL 에러 수정.

| # | 마이그레이션 | 내용 |
|---|------------|------|
| 012 | fix_rpc_settlement_v2 | 최종 정산 RPC — settlement_period_start/end, item_count, 'draft' |
| 013 | fix_rpc_consignment_v2 | 최종 위탁 RPC — 14 파라미터, product_condition |
| 014 | updated_at_triggers | update_updated_at() 함수 + 3 트리거 |

### Phase 1: Infrastructure + Types + Utils (커밋 `dcb60a7`)

Supabase 클라이언트, 도메인 타입 9종, 유틸리티 함수 18개. 75 tests PASS.

### Phase 1 V2 정렬 (커밋 `57e9da4`)

| # | 마이그레이션 | 내용 |
|---|------------|------|
| 015 | rpc_generate_product_number | CT-{CODE}-{SEQ:3} 형식 |
| 016 | orders_status_extend | CHECK 8→10값 |

OrderStatus 10값 + 전이 맵 확장, Condition 'N'→'S' 기본값 수정. 98 tests PASS.

### Phase 2: Repos + Transactions (커밋 `c65b0b7`)

리포지토리 9종, 트랜잭션 래퍼 3종. 92 tests (Phase 1 포함 시 98).

### V2 델타 분석 (4라운드)

V3 마이그레이션 16개 × V2 백업 6종 전수 대조. 4라운드 결과:

| 라운드 | 확정 델타 | 주요 발견 |
|--------|----------|----------|
| 1차 | 5건 | 초기 분석 |
| 2차 | 7건 (+2) | DELTA-2 버전 오류, DELTA-6/7 신규 |
| 3차 | 10건 (+3) | DELTA-8/9/10 + APP-BUG 3건 |
| **4차** | **10건 (안정화)** | V2 CHECK 29건 전수 교차, generate_product_id 데드코드 확정 |

### Phase 0↔1 충돌 수정 (2026-03-05)

Phase 0 Patch가 V2 DB 정렬하면서 Phase 1 타입 + Phase 2 repo에 파급. 4건 수정:

| FIX | 심각도 | 파일 | 내용 |
|-----|--------|------|------|
| FIX-1 | CRITICAL | settlement.ts | SETTLEMENT_STATUSES: pending/confirmed/paid → draft/confirmed/paid/failed |
| FIX-2 | HIGH | settlement.ts | Settlement 인터페이스 +itemCount, +periodStart, +periodEnd |
| FIX-3 | MEDIUM | settlement.repo.ts | 컬럼명 V2 정렬 + confirmed_at 추가 |
| FIX-4 | MEDIUM | sellers.repo.ts | COLUMNS에 updated_at 추가 + fallback 패턴 |

### APP-BUG 3건 TS 수정 (2026-03-06)

| BUG | 파일 | 변경 |
|-----|------|------|
| APP-BUG-1 | settlement.repo.ts | SETTLEMENT_COLUMNS: `updated_at` → `confirmed_at` (V2 실제 컬럼) |
| APP-BUG-2 | settlement.repo.ts | SOLD_ITEM_COLUMNS: `naver_order_id` → `order_id`, `seller_product_code` → `product_number` |
| APP-BUG-3 | settlement.ts | SOLD_ITEM_STATUSES: `['pending','settled']` → `['pending','calculated','settled','returned']` |

테스트: tsc 0 errors, vitest 99/99 PASS.

### Tokyo DB 구축 (2026-03-06)

7개 DDL 파일을 Supabase Management API로 Tokyo DB에 적용:

| # | 파일 | 내용 | 결과 |
|---|------|------|------|
| 1 | 00_extensions.sql | uuid-ossp, pgcrypto, 2 sequences | 성공 |
| 2 | 01_tables.sql | 26 CREATE TABLE, 389 컬럼 | 성공 |
| 3 | 02_constraints.sql | FK 23 + UNIQUE 20 + CHECK 30 | 성공 |
| 4 | 03_indexes.sql | 104 인덱스 (IF NOT EXISTS 추가) | 성공 |
| 5 | 04_functions.sql | 10 함수 | 성공 |
| 6 | 05_triggers.sql | 4 트리거 | 성공 |
| 7 | 06_rls.sql | 26 ENABLE + 52 정책 | 성공 |

### 데이터 이관 (2026-03-06)

FK 의존 순서 (Level 0→3) 준수하여 11개 테이블, 5,326행 이관:

| Level | 테이블 | 행 수 | 방법 |
|-------|--------|-------|------|
| 0 | sellers | 8 | json_populate_recordset + dollar-quoting |
| 0 | brand_aliases | 242 | 동일 |
| 0 | search_synonyms | 718 | 동일 |
| 0 | price_references | 2,160 | 500행 배치 (1.6MB) |
| 0 | market_prices | 2,160 | 500행 배치 (2.3MB) |
| 0 | orders | 3 | 동일 |
| 0 | excel_uploads | 12 | 동일 |
| 1 | order_items | 3 | 동일 (FK→orders) |
| 1 | st_products | 3 | 동일 (FK→sellers) |
| 2 | consignment_requests | 11 | 동일 (FK→sellers, st_products) |
| 3 | notification_logs | 6 | 동일 (FK→sellers, consignment_requests) |
| | **합계** | **5,326** | |

---

## 3. 전체 의사결정 레지스터

### 3.1 DB 스키마 결정

| # | 결정 | 선택 | 근거 | 리스크 |
|---|------|------|------|--------|
| D-01 | generate_product_id 함수 이관 | **미이관** | V2 dead code (호출처 0건). V3에서 generate_product_number(015)로 대체 | NONE |
| D-02 | 9개 policyless 테이블 RLS | **+18 정책 추가** | V2는 ENABLE만 되어 있고 정책 없음 → anon 접근 시 전부 차단됨. service_role 기본 정책으로 보안 강화 | LOW: 향후 anon 접근 필요 시 정책 추가 필요 |
| D-03 | orders_status_check 추가 | **DELTA-1 적용** | V2에 없던 CHECK를 V3(016)에서 추가. 10값 enum 보장 | NONE |
| D-04 | V2 CHECK 29건 완전 반영 | **전량 반영** | 4차 전수 교차 검증 완료 | NONE |
| D-05 | idx_consignment_seller 복합화 | **DELTA-5 적용** | V2: seller_id only → V3: (seller_id, status). 위탁 목록 조회 성능 개선 | NONE |
| D-06 | 03_indexes에 IF NOT EXISTS | **적용** | 02_constraints UNIQUE가 이미 인덱스 생성 → 실행 순서 무관하게 안전 | NONE |

### 3.2 TS 코드 결정

| # | 결정 | 선택 | 근거 | 리스크 |
|---|------|------|------|--------|
| D-07 | SETTLEMENT_STATUSES 'pending' | **제거** | V2 DB CHECK에 없음 → INSERT 시 CHECK 위반 | LOW: Phase 3+ 서비스에서 'pending' 사용처 없음 |
| D-08 | SETTLEMENT_STATUSES 'failed' | **추가** | V2 DB CHECK에 존재 | NONE |
| D-09 | Settlement 인터페이스 필드 | **optional 추가** | itemCount/periodStart/periodEnd — V2 DB 컬럼 존재, 비파괴적 | NONE |
| D-10 | settlement.repo 컬럼명 | **V2 정렬** | period_start → settlement_period_start 등. V2 DDL 증거 기반 | NONE |
| D-11 | SOLD_ITEM_STATUSES 확장 | **2→4값** | V2 CHECK: pending/calculated/settled/returned | NONE |
| D-12 | sold_items 컬럼명 | **V2 정렬** | naver_order_id → order_id, seller_product_code → product_number | NONE |
| D-13 | sellers.repo updated_at | **fallback 패턴** | `(row.updated_at \|\| row.created_at)` — NULL 안전 | NONE |
| D-14 | SQL 마이그레이션 추가 여부 | **없음** | 이번 수정은 TS 레이어만. DB 스키마는 Phase 0 Patch에서 정렬 완료 | NONE |

### 3.3 인프라 결정

| # | 결정 | 선택 | 근거 | 리스크 |
|---|------|------|------|--------|
| D-15 | Tokyo DB 접속 방법 | **Management API** | psql pooler "Tenant not found" 에러. API가 안정적 동작 확인 | LOW: 대용량 쿼리 시 body 크기 제한 |
| D-16 | 대용량 데이터 이관 | **500행 배치** | market_prices 2.3MB 단건 가능하나 안전을 위해 배치 | NONE |
| D-17 | JSON 이관 방식 | **dollar-quoting + json_populate_recordset** | 쿼터 이스케이프 문제 회피. PostgreSQL 네이티브 JSON 파싱 | NONE |

---

## 4. 결과물 인벤토리

### 4.1 DDL 파일 (supabase/tokyo-ddl/)

| 파일 | 줄 수 | 내용 |
|------|-------|------|
| 00_extensions.sql | ~27 | uuid-ossp, pgcrypto, 2 sequences |
| 01_tables.sql | ~580 | 26 CREATE TABLE, 389 컬럼 |
| 02_constraints.sql | ~330 | FK 23 + UNIQUE 20 + CHECK 30 |
| 03_indexes.sql | ~215 | 104 인덱스 (IF NOT EXISTS) |
| 04_functions.sql | ~353 | 10 함수 (V3 3 + V2 5 + 공유 2) |
| 05_triggers.sql | ~26 | 4 updated_at 트리거 |
| 06_rls.sql | ~331 | 26 ENABLE + 52 정책 |

### 4.2 수정된 TS 파일

| 파일 | 변경 요약 |
|------|----------|
| apps/web/lib/types/domain/settlement.ts | SETTLEMENT_STATUSES 4값, SOLD_ITEM_STATUSES 4값, Settlement 인터페이스 필드 추가 |
| apps/web/lib/db/repositories/settlement.repo.ts | SETTLEMENT_COLUMNS V2 정렬, SOLD_ITEM_COLUMNS V2 정렬, mapSettlementRow/mapSoldItemRow 수정 |
| apps/web/lib/db/repositories/sellers.repo.ts | COLUMNS에 updated_at 추가, mapRow fallback 패턴 |
| apps/web/__tests__/unit/types.test.ts | SETTLEMENT_STATUSES 4값, SOLD_ITEM_STATUSES 4값 검증 |
| apps/web/__tests__/unit/db.test.ts | settlement/sellers/sold_items mock V2 정렬 |

### 4.3 문서

| 파일 | 역할 |
|------|------|
| docs/Strategic/v2-v3-delta-confirmed.md | 확정 델타 10건 + APP-BUG 3건 상세 |
| docs/Strategic/phase0-v2-audit-report.md | Phase 0 V2↔V3 비교 감사 |
| docs/Strategic/phase0-phase1-conflict-report.md | Phase 0↔1 충돌 4건 |
| docs/Strategic/phase0-phase1-unified-assessment.md | 통합 평가 |
| docs/Strategic/phase-progress-log.md | Phase별 커밋 이력 |
| docs/Strategic/phase3-4-plan.md | Phase 3+4 리서치 (승인 대기) |
| docs/Strategic/v2-v3-migration-master-log.md | **본 문서** |

---

## 5. 확정 델타 10건 요약 (상세 → v2-v3-delta-confirmed.md)

| DELTA | 내용 | 심각도 | Tokyo 반영 |
|-------|------|--------|-----------|
| 1 | orders_status_check CHECK 10값 추가 | MEDIUM | 02_constraints.sql |
| 2 | create_settlement_with_items 함수 012 버전 | CRITICAL | 04_functions.sql |
| 3 | complete_consignment 함수 013 버전 | CRITICAL | 04_functions.sql |
| 4 | generate_product_number 함수 015 버전 | HIGH | 04_functions.sql |
| 5 | idx_consignment_seller 복합 인덱스 | LOW | 03_indexes.sql |
| 6 | V2 전용 함수 5개 (get_commission_rate 등) | HIGH | 04_functions.sql |
| 7 | update_updated_at 트리거 (014) orders 추가 | MEDIUM | 05_triggers.sql |
| 8 | uuid-ossp extensions 스키마 | MEDIUM | 00_extensions.sql |
| 9 | price_references/search_synonyms BIGINT+sequence | MEDIUM | 00_extensions + 01_tables |
| 10 | pgcrypto 확장 | LOW | 00_extensions.sql |

---

## 6. 미완료 과제 + 향후 방향

### 6.1 즉시 필요 작업 (DB 전환)

| # | 작업 | 상세 | 리스크 |
|---|------|------|--------|
| **SW-1** | .env.local SUPABASE_URL 전환 | `NEXT_PUBLIC_SUPABASE_URL`을 Mumbai→Tokyo로 변경 | HIGH: 프로덕션 트래픽이 있으면 다운타임 |
| **SW-2** | .env.local DB_URL 전환 | `SUPABASE_DB_URL`을 Tokyo로 변경 | 동일 |
| **SW-3** | Supabase CLI `supabase link` 재실행 | Tokyo 프로젝트에 링크 | LOW |

**전환 시점 결정 필요**: Phase 3+ 서비스 구현 전에 전환할지, 서비스 완료 후 전환할지.

### 6.2 Phase 3: Service Layer (승인 대기)

`phase3-4-plan.md` 기반. 아직 미승인.

| 서비스 | 역할 | V2 패턴 |
|--------|------|---------|
| auth.service | 세션 기반 admin 인증 | 평문 비교 + HMAC-SHA256 쿠키 |
| settlement.service | 정산 생성/확인/지급 | dual pipeline (Old+New) |
| consignment.service | 위탁 접수/검수/승인 | 7상태 FSM |
| order.service | 주문 CRUD + 상태 전이 | 10상태 FSM |
| product.service | 상품 관리 + 스마트스토어 | 4단계 photo_status |
| commission.service | 수수료 계산 | Math.round(totalSales * rate) |
| upload.service | 엑셀 업로드 + 파싱 | 4종 upload_type |

### 6.3 Phase 4: API Routes (승인 대기)

| 그룹 | 엔드포인트 수 | 주요 |
|------|-------------|------|
| auth | 2 | login, logout |
| orders | ~8 | CRUD + 상태 전이 |
| consignments | ~6 | 접수/검수/승인/반려 |
| settlements | ~5 | 생성/확인/지급 |
| products | ~6 | CRUD + 스마트스토어 |
| uploads | ~3 | 엑셀 업로드/파싱 |
| sellers | ~4 | CRUD |

### 6.4 Phase 5-9 (미착수)

| Phase | 내용 | 상태 |
|-------|------|------|
| 5 | Design System | 미착수 |
| 6 | UI Integration | 미착수 |
| 7 | SEO + Security | 미착수 |
| 8 | Code Review | 미착수 |
| 9 | Deployment | 미착수 |

### 6.5 알려진 리스크

| # | 리스크 | 심각도 | 대응 방안 |
|---|--------|--------|----------|
| R-1 | V2 admin API 인증 검증 0건 | HIGH | Phase 3 auth.service에서 middleware 필수 구현 |
| R-2 | V2 비밀번호 평문 비교 | HIGH | Phase 3에서 bcrypt 도입 검토 |
| R-3 | V2 정산 dual pipeline 복잡성 | MEDIUM | Phase 3에서 통합 또는 분리 결정 필요 |
| R-4 | Supabase 무료 플랜 한계 | MEDIUM | 두 프로젝트 동시 운영 시 quota 주의 |
| R-5 | psql 직접 접속 불가 | LOW | Management API로 대체 가능하나 대량 작업 시 제한 |

---

## 7. 검증 게이트 결과

### 7.1 TypeScript

| 검증 | 명령 | 결과 |
|------|------|------|
| strict compile | `cd apps/web && npx tsc --noEmit` | **0 errors** |
| unit tests | `cd apps/web && npx vitest run` | **99/99 PASS** |

### 7.2 Tokyo DB 무결성

| 항목 | Mumbai | Tokyo | 판정 |
|------|--------|-------|------|
| 테이블 | 26 | 26 | PASS |
| 인덱스 | 129 | 129 | PASS |
| 트리거 | 4 | 4 | PASS |
| 함수 | 11 | 10 | PASS (의도적 -1) |
| RLS 정책 | 34 | 52 | PASS (의도적 +18) |
| 데이터 총 행 | 5,326 | 5,326 | PASS |

### 7.3 데이터 행 수 일치 (11/11 테이블)

| 테이블 | Mumbai | Tokyo | 판정 |
|--------|--------|-------|------|
| sellers | 8 | 8 | PASS |
| brand_aliases | 242 | 242 | PASS |
| search_synonyms | 718 | 718 | PASS |
| price_references | 2,160 | 2,160 | PASS |
| market_prices | 2,160 | 2,160 | PASS |
| orders | 3 | 3 | PASS |
| excel_uploads | 12 | 12 | PASS |
| order_items | 3 | 3 | PASS |
| st_products | 3 | 3 | PASS |
| consignment_requests | 11 | 11 | PASS |
| notification_logs | 6 | 6 | PASS |

---

## 8. 다음 단계 권장

### 즉시 (DB 전환 결정)

1. **결정**: `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`을 Tokyo로 전환할 시점
   - 옵션 A: 지금 전환 → Phase 3부터 Tokyo 기반 개발
   - 옵션 B: Phase 4 API 완료 후 전환 → 안전하지만 Mumbai에서 개발
   - **권장**: 옵션 A — Tokyo DDL이 완전히 검증되었고, 프로덕션 트래픽 없음

2. **결정**: `supabase link`를 Tokyo로 변경할지
   - 마이그레이션 파일은 이미 DDL로 적용 완료 → link 필수 아님
   - 향후 `supabase db push` 사용하려면 link 필요

### 단기 (Phase 3)

1. `phase3-4-plan.md` 승인
2. Service layer 구현 (auth → settlement → consignment → order 순)
3. Zod 검증 스키마 도입 (V2에 없었던 입력 검증)
4. middleware.ts 구현 (V2에 없었던 API 인증 게이트)

### 중기 (Phase 4-6)

1. API routes 구현
2. Design system 구축
3. UI integration

### 장기 (Phase 7-9)

1. SEO + Security hardening
2. 최종 코드 리뷰
3. 프로덕션 배포
