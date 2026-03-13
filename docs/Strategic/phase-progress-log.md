# Phase 진행 이력 로그

**최종 업데이트**: 2026-03-13

---

## 완료 이력

### Phase 0: DB 마이그레이션 (커밋 `540558d`)

| # | 마이그레이션 | 내용 |
|---|------------|------|
| 001 | consignment_status_check | 위탁 7값 CHECK |
| 002 | unique_constraints | 5개 UNIQUE 제약 |
| 003 | performance_indexes | 5개 인덱스 |
| 004 | rls_policies | RLS 정책 |
| 005 | rpc_settlement | 정산 RPC (→011→012에서 교체) |
| 006 | rpc_order | 주문 RPC |
| 007 | rpc_consignment | 위탁 RPC (→013에서 교체) |
| 008 | upload_session_id | sales_records 컬럼 추가 |
| 009 | batch_progress | _batch_progress 테이블 |
| 010 | public_orders_rls | hold_token + RLS |
| 011 | fix_rpc_settlement | 정산 RPC 수정 (→012에서 교체) |

### Phase 0 Patch: V2 DB 정렬 (커밋 `cf8a3d9`)

| # | 마이그레이션 | 내용 |
|---|------------|------|
| 012 | fix_rpc_settlement_v2 | 최종 정산 RPC — settlement_period_start/end, item_count, 'draft' |
| 013 | fix_rpc_consignment_v2 | 최종 위탁 RPC — 14 파라미터, product_condition |
| 014 | updated_at_triggers | update_updated_at() 함수 + 3 트리거 |

### Phase 1: Infrastructure + Types + Utils (커밋 `dcb60a7`)

- Supabase 클라이언트, 도메인 타입 9종, 유틸리티 함수 18개
- 75 tests PASS

### Phase 1 V2 정렬 (커밋 `57e9da4`)

| # | 마이그레이션 | 내용 |
|---|------------|------|
| 015 | rpc_generate_product_number | CT-{CODE}-{SEQ:3} 형식 |
| 016 | orders_status_extend | CHECK 8→10값 |

- OrderStatus 10값 + 전이 맵 확장, Condition 'N'→'S' 기본값 수정
- 98 tests PASS

### Phase 2: Repos + Transactions (초기 `c65b0b7` → 재구현 `b5c5aac`)

- 초기 구현: 리포지토리 9종, 트랜잭션 래퍼 3종, 92 tests PASS
- `df90e59`에서 Phase 1 재구현 시 Phase 2 전체 삭제
- **재구현 완료** (`b5c5aac`): Repository 25개 + Transaction 2개 + Service 13개 (45파일)

### Phase 3: Middleware + Auth (커밋 `9527713`)

- withAdmin 미들웨어, auth, API response/middleware 인프라 (18파일)

### Phase 4: Service Layer (커밋 `b5c5aac` 포함)

- Service 13개 — consignment, order, settlement, sales, photo, notification 등

### Phase 5: API Routes + Schemas (커밋 `d940150`, `dc32f0b`)

- API Route 34개 + Schema 34개 (68파일)
- 검증 수정 13건: 보안 강화 + 아키텍처 정렬 + 성능 최적화

### Phase 5 G6+G7 보안/기능 보강 (2026-03-13, 커밋 대기)

- G6-1: DB error vs NOT_FOUND 분류 — 5 repos `.maybeSingle()` + NOT_FOUND prefix
- G6-2: customerName 마스킹 — privacy.ts 신규
- G6-3: productId URL 검증 — GET 핸들러 params 검증
- G6-4: 토큰 만료 메커니즘 — migration 021 + repo JS 만료 체크
- G7-2: 매출장부 조회 라우트 — sales/ledger GET 엔드포인트

---

## Phase 0↔1 충돌 수정 (2026-03-05)

### 발견 경위

Phase 0 Patch(012-014)가 V2 DB 정렬을 수행하면서, Phase 1 타입 시스템과 Phase 2 리포지토리에 파급 효과 발생.
`phase0-phase1-conflict-report.md`에서 CRITICAL 1건 + HIGH 1건 + MEDIUM 2건 식별.

### 수정 내역

| # | FIX | 파일 | 변경 내용 |
|---|-----|------|----------|
| 1 | CRITICAL-1 | settlement.ts | SETTLEMENT_STATUSES: `['pending','confirmed','paid']` → `['draft','confirmed','paid','failed']` |
| 2 | HIGH-1 | settlement.ts | Settlement 인터페이스에 `itemCount?`, `periodStart?`, `periodEnd?` 추가 |
| 3 | MEDIUM-1 | settlement.repo.ts | SETTLEMENT_COLUMNS: `period_start/end` → `settlement_period_start/end` + `item_count`, `updated_at` 추가 |
| 4 | MEDIUM-2 | sellers.repo.ts | COLUMNS에 `updated_at` 추가, mapRow fallback 패턴 적용 |

### 테스트 수정

| 파일 | 변경 |
|------|------|
| types.test.ts | SETTLEMENT_STATUSES 3→4값, draft/failed 포함 검증 |
| db.test.ts | settlement mock: V2 컬럼명 + 'draft' + item_count + updated_at |
| db.test.ts | sellers mock: updated_at 추가 + fallback 테스트 분리 |

### 검증 결과

- `tsc --noEmit`: 0 errors
- `vitest run`: 99/99 PASS (sellers fallback 테스트 분리로 +1)

### 의사결정 기록

| 결정 | 선택 | 근거 |
|------|------|------|
| 'pending' 유지 여부 | 제거 | V2 DB CHECK에 없음 |
| 'failed' 추가 여부 | 추가 | V2 DB CHECK에 존재 |
| periodStart/End | optional 추가 | V2 DB 컬럼 존재, Phase 4에서 필요 |
| sellers updated_at | fallback 패턴 | `(row.updated_at \|\| row.created_at)` |
| SQL 마이그레이션 | 없음 | TS 레이어만 변경 |

---

## APP-BUG 3건 수정 (2026-03-06)

### 발견 경위

V2 백업 4차 델타 분석에서 TS 코드가 V2 DB에 존재하지 않는 컬럼을 참조하는 버그 3건 확인.

### 수정 내역

| # | BUG | 파일 | 변경 |
|---|-----|------|------|
| 1 | APP-BUG-1 | settlement.repo.ts | SETTLEMENT_COLUMNS: `updated_at` → `confirmed_at` |
| 2 | APP-BUG-2 | settlement.repo.ts | SOLD_ITEM_COLUMNS: `naver_order_id` → `order_id`, `seller_product_code` → `product_number` |
| 3 | APP-BUG-3 | settlement.ts | SOLD_ITEM_STATUSES: `['pending','settled']` → `['pending','calculated','settled','returned']` |

### 테스트 수정

| 파일 | 변경 |
|------|------|
| types.test.ts | SOLD_ITEM_STATUSES 2→4값, calculated/returned 포함 검증 |
| db.test.ts | settlement mock: confirmed_at, V2 컬럼명 |
| db.test.ts | sold_items mock: order_id, product_number |

### 검증 결과

- `tsc --noEmit`: 0 errors
- `vitest run`: 99/99 PASS

---

## Tokyo DB 구축 (2026-03-06)

### DDL 생성 (7파일)

V2 백업 6종(columns, constraints, indexes, triggers, rls, functions) + 확정 델타 10건을 반영하여 통합 DDL 7파일 생성:

| # | 파일 | 내용 |
|---|------|------|
| 1 | 00_extensions.sql | uuid-ossp, pgcrypto, 2 sequences |
| 2 | 01_tables.sql | 26 CREATE TABLE, 389 컬럼 |
| 3 | 02_constraints.sql | FK 23 + UNIQUE 20 + CHECK 30 |
| 4 | 03_indexes.sql | 104 인덱스 (IF NOT EXISTS) |
| 5 | 04_functions.sql | 10 함수 |
| 6 | 05_triggers.sql | 4 트리거 |
| 7 | 06_rls.sql | 26 ENABLE + 52 정책 |

### DDL 적용

Supabase Management API (`POST /v1/projects/{ref}/database/query`)로 7파일 순차 적용. 전량 성공.

### 데이터 이관

Mumbai→Tokyo, FK 의존 순서(Level 0→3) 준수. 11테이블 5,326행 이관 완료.

| Level | 테이블 | 행 수 |
|-------|--------|-------|
| 0 | sellers, brand_aliases, search_synonyms, price_references, market_prices, orders, excel_uploads | 5,303 |
| 1 | order_items, st_products | 6 |
| 2 | consignment_requests | 11 |
| 3 | notification_logs | 6 |

### 무결성 검증

| 항목 | Mumbai | Tokyo | 판정 |
|------|--------|-------|------|
| 테이블 | 26 | 26 | PASS |
| 인덱스 | 129 | 129 | PASS |
| 트리거 | 4 | 4 | PASS |
| 함수 | 11 | 10 | PASS (-1 의도적) |
| RLS 정책 | 34 | 52 | PASS (+18 의도적) |
| 데이터 행 | 5,326 | 5,326 | PASS |

### 의사결정

| 결정 | 선택 | 근거 |
|------|------|------|
| generate_product_id 이관 | 미이관 | V2 dead code (호출처 0건) |
| 9개 policyless 테이블 RLS | +18 정책 추가 | 보안 강화 |
| 03_indexes IF NOT EXISTS | 적용 | UNIQUE 제약조건과 중복 방지 |
| 대용량 테이블 이관 | 500행 배치 | API body 크기 제한 대응 |
| DB 접속 방법 | Management API | psql pooler 접속 실패 |

---

## Phase 0 추가 마이그레이션 (2026-03-07)

### 배경

Phase 1 재구현 사전 검증 과정에서 상품번호/셀러코드 체계 재정의. V2 generate_product_number(YYMMDD-ALPHA)도, V3 Phase 0의 CT-{CODE}-{SEQ}도 아닌 새로운 13자리 숫자 체계로 확정.

### 마이그레이션 3건

| # | 마이그레이션 | 내용 |
|---|------------|------|
| 017 | alter_sellers_add_address | sellers 테이블에 address TEXT 컬럼 추가 (셀러코드 해싱 + 향후 배송 기능) |
| 018 | rpc_generate_seller_code | 셀러코드 생성 RPC — hash(이름+전화+주소) → 5자리 숫자 랜덤 고유값, 충돌 시 재해싱 최대 1000회 |
| 019 | replace_generate_product_number | 상품번호 RPC 교체 — CT-{CODE}-{SEQ} → 13자리 숫자 (YYMMDD + 랜덤2 + 셀러코드5), 충돌 시 재시도 최대 100회 |

### 검증 결과

| 게이트 | 결과 |
|--------|------|
| 테이블 수 | 26개 (변경 없음) |
| sellers 컬럼 수 | 24→25개 (+address) |
| 함수 수 | 10→11개 (+generate_seller_code) |
| sellers.address 추가 | PASS |
| generate_seller_code 고유성 | PASS (같은 입력→같은 코드, 다른 입력→다른 코드) |
| generate_product_number 교체 | PASS (13자리, 날짜+랜덤+셀러코드) |
| psql 직접 연결 | PASS (aws-1-ap-northeast-1 pooler) |

### 문서 갱신

| 파일 | 변경 |
|------|------|
| supabase/tokyo-ddl/01_tables.sql | sellers 25컬럼 (+address) |
| supabase/tokyo-ddl/04_functions.sql | generate_product_number 교체 + generate_seller_code 추가 |
| docs/03-analysis/phase1-reimpl-reference.md | §3.4 상품번호 스펙 갱신, §3.4b 셀러코드 RPC 추가 |
| docs/03-analysis/v2-full-deep-research-report.md | §2.2 번호 생성 패턴 V2/V3 병기 |
| docs/03-analysis/phase1-reimpl-execution-plan.md | §1.3 의사결정, Step 5 갱신 |

### 사용자 의사결정

| 결정 | 선택 | 근거 |
|------|------|------|
| 상품번호 체계 | 13자리 숫자: YYMMDD + 랜덤2 + 셀러코드5 | V2 YYMMDD 계승 + 셀러 추적 가능 + 순수 숫자 |
| 셀러코드 체계 | 5자리 숫자: hash(이름+전화+주소) | 결정적 고유값, 순번 아닌 랜덤, 개인정보 비가역 |
| sellers.address | 추가 (NULL 허용) | 셀러코드 해싱 입력 + 향후 배송/반품 기능 |
| CT 포맷 | 폐기 | 사용자: "V2 방식이 보기에 더 좋다" |
| V2 기존 데이터 (NF001~8) | ~~유지~~ → 셀러코드 교체 + 더미 삭제 | 2026-03-07 즉시 정리 |

---

## 데이터 정리 (2026-03-07)

### 작업 내역

| # | 작업 | 대상 | 수량 |
|---|------|------|------|
| 1 | 셀러코드 교체 | NF001~008 → 5자리 숫자 | 8건 |
| 2 | 무효 전화번호 수정 | "1","2","3" → "01000000001~6" | 6건 |
| 3 | 더미 셀러 삭제 | 이름 1~6 (+ 셀러코드 재생성분 포함) | 6건 |
| 4 | 더미 위탁 삭제 | FK 연쇄 (consignment_requests) | 6건 |

### 정리 후 상태

| 테이블 | 행 수 |
|--------|-------|
| sellers | 2 (카바바 36466, 아라차 35402) |
| consignment_requests | 5 |
| orders | 3 |
| order_items | 3 |
| st_products | 3 |

---

## Phase 1 재구현 (2026-03-07, 커밋 대기)

### 방식

기존 Phase 1(25파일) + Phase 2(14파일) + 테스트(5파일) = 42파일 전체 삭제 후 0에서 새로 작성.

### 생성 파일

- 인프라 5개: env.ts, supabase/client.ts, supabase/admin.ts, auth.ts, ratelimit.ts
- 도메인 타입 8개: seller.ts, consignment.ts, order.ts, settlement.ts, product.ts, notification.ts, photo.ts, index.ts
- 유틸리티 11개: validation.ts, phone.ts, brand.ts, category.ts, currency.ts, date.ts, id.ts, sms-templates.ts, excel.ts, chunk.ts, path.ts
- **합계: 24파일, 1,002줄**

### 검증 결과

- tsc --noEmit: 0 errors
- vitest run: 79/79 PASS (단위 66 + 통합 13)
- MUST 게이트 M1~M8: 전체 PASS
- Tokyo DB 실데이터 통합 테스트: 13/13 PASS

### 프로젝트 규칙 추가

- `/tf-v3/CLAUDE.md` 신규 생성: 데이터 위생 규칙 4조

### 상세 보고서

- `docs/03-analysis/phase0-phase1-completion-report.md`

---

## 테스트 수 이력 (시점별 정리)

| 시점 | 커밋 | 단위 | 통합 | 합계 | 비고 |
|------|------|:---:|:---:|:---:|------|
| Phase 1 초기 완료 | `dcb60a7` | 62 | 13 | 75 | Phase 1 첫 구현 |
| Phase 1 V2 정렬 | `57e9da4` | 85 | 13 | 98 | OrderStatus 10값 등 |
| Phase 0↔1 충돌 수정 | (미커밋) | 86 | 13 | 99 | sellers fallback +1 |
| Phase 2 초기 완료 | `c65b0b7` | 79 | 13 | 92 | Phase 2 repo 단위 테스트 추가 |
| Phase 1 재구현 | `df90e59` | 66 | 13 | 79 | Phase 2 삭제됨 |
| Phase 2~5 재구현 | `d4619b8` | 66 | 52 | 118 | repo 25 + service 13 + route 34 |
| **Phase 5 G6+G7** | (커밋 대기) | **66** | **52** | **118** | 보안 보강, 스냅샷 갱신 |

---

## 문서 디렉토리 정리 (2026-03-09)

| 디렉토리 | 역할 | canonical |
|---------|------|:---------:|
| `docs/Strategic/` | 전략·진행·의사결정 문서 | ✓ |
| `docs/03-analysis/` | Phase별 상세 분석·계획·보고 | ✓ |

중복 파일 6건 정리 완료:
- 동일 5건: `03-analysis/` 에서 삭제 (Strategic이 canonical)
- 차이 1건(`conflict-report`): Strategic 최신 버전으로 `03-analysis/` 교체
