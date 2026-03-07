# Phase 1 재구현 실행계획서 (From Scratch)

**작성일**: 2026-03-07
**방식**: 전체 삭제 후 0에서 새로 작성 (기존 코드 42개 파일 삭제 완료)
**기준 문서**: phase1-reimpl-reference.md (검증 완료), plan5.md §4.1, phase1-v2-alignment-plan.md
**사전 검증**: 3단계 + 재검증 2라운드 완료

---

## I. 검증 이력 요약

### 1.1 사전 검증 3단계

| 단계 | 내용 | 결과 | 수정 건수 |
|------|------|------|----------|
| 검증 1 | 레퍼런스 문서 정확성 | 완료 | 4건 수정 (orders.status 10값, ORDER_STATUSES, complete_consignment 14파라미터, H-13) |
| 검증 2 | Tokyo DB 상태 확인 | 완료 | 26테이블, 11 RPC, psql 직접 연결 확인 |
| 검증 3 | 문서 간 교차 일관성 | 완료 | 1건 수정 (v2-full-deep-research-report.md orders.status → 리팩토링 V2 8값) |

### 1.2 사용자 의사결정 기록 (확정)

| 결정 | 선택 | 근거 |
|------|------|------|
| 재구현 방식 | 0에서 새로 작성 | 기존 코드 수정보다 오류 가능성 낮음 (사용자 2026-03-07 확정) |
| 상품번호 포맷 | 13자리 숫자: YYMMDD + 랜덤2 + 셀러코드5 | Phase 0 마이그레이션 019로 DB RPC 교체 완료 |
| 셀러코드 | 5자리 숫자: hash(이름+전화+주소) | Phase 0 마이그레이션 018로 DB RPC 추가 완료 |
| OrderStatus | V2 8값 + CONFIRMED + CANCELLED = 10값 | 운영상 필요 |
| Condition 라벨 | N="NEW" (V2 "Brand New"에서 변경) | 사용자 지시 |
| 브랜드 별칭 | V2 43개 + V3 16개 병합 (59개) | 충돌 0건 |
| ALLOWED_TRANSITIONS | 옵션 C (V2 워크플로우 기반) | 사용자 선택 |

---

## II. 현재 상태

- `apps/web/lib/` 디렉토리: **비어있음** (42개 파일 전체 삭제 완료)
- Phase 0 마이그레이션 19개: **정상** (supabase/migrations/)
- Tokyo DB: **정상** (26테이블, 11 RPC)
- Phase 2 리포지토리/트랜잭션: **삭제됨** (Phase 1 완료 후 재작성)
- 테스트: **삭제됨** (Phase 1 완료 후 재작성)

---

## III. 생성 파일 목록 (24개)

### 3.1 인프라 (5개)

| # | 파일 | 내용 |
|---|------|------|
| 1 | lib/env.ts | 환경변수 검증 (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD_HASH) |
| 2 | lib/supabase/client.ts | Supabase 브라우저 클라이언트 (createBrowserClient) |
| 3 | lib/supabase/admin.ts | Supabase 서버 전용 클라이언트 (service_role, auth.admin) |
| 4 | lib/auth.ts | 관리자 인증 (bcrypt cost=12, verifySessionToken) |
| 5 | lib/ratelimit.ts | IP 기반 레이트 리미트 (인메모리) |

### 3.2 도메인 타입 (8개)

| # | 파일 | 상수 | 인터페이스 | V2 근거 |
|---|------|------|-----------|---------|
| 6 | types/domain/seller.ts | SELLER_STATUSES(5), SELLER_TIERS(3), CHANNEL_TYPES(3), COMMISSION_RATES | Seller | sellers 25컬럼 |
| 7 | types/domain/consignment.ts | CONSIGNMENT_STATUSES(7), CONSIGNMENT_SOURCES(4), SELLER_RESPONSES(3), ALLOWED_TRANSITIONS | ConsignmentRequest | consignment_requests 28컬럼 |
| 8 | types/domain/order.ts | ORDER_STATUSES(10), INSPECTION_STATUSES(3), CONDITION_LABELS, OrderItem | Order, OrderItem | orders 19 + order_items 23컬럼 |
| 9 | types/domain/settlement.ts | SETTLEMENT_STATUSES(4), SOLD_ITEM_STATUSES(4), SALES_CHANNELS(2), MATCH_STATUSES(3) | Settlement, SettlementItem(3필드), SoldItem(V2 20컬럼), SalesRecord, NaverSettlement | settlements 16 + settlement_items 3 + sold_items 20 + sales_records 19 + naver_settlements 13컬럼 |
| 10 | types/domain/product.ts | PRODUCT_TYPES(2), PHOTO_STATUSES(4), SMARTSTORE_STATUSES(4), RETAIL_PRICE_SOURCES(3) | StProduct | st_products 36컬럼 |
| 11 | types/domain/notification.ts | SMS_STATUSES(3) | NotificationLog | notification_logs 10컬럼 |
| 12 | types/domain/photo.ts | — | Photo, PhotoUpload | photos 9 + photo_uploads 8컬럼 |
| 13 | types/index.ts | — | re-export all | — |

### 3.3 유틸리티 (11개)

| # | 파일 | 내용 | V2 근거 |
|---|------|------|---------|
| 14 | utils/validation.ts | Zod 스키마 5개 (phone, sellerCode, productNumber, orderId, price) | plan5 §4.1 |
| 15 | utils/phone.ts | 전화번호 포맷 (010-XXXX-XXXX ↔ 01012345678) | V2 실데이터 패턴 |
| 16 | utils/brand.ts | 브랜드 별칭 매핑 (59개), normalizeBrand() | V2 brand_aliases + V3 추가 |
| 17 | utils/category.ts | 카테고리 목록, normalizeCategory() | V2 st_products.category |
| 18 | utils/currency.ts | 통화 포맷 (₩1,234,567) | V2 integer 가격 |
| 19 | utils/date.ts | 날짜 포맷 (YYYY-MM-DD, 상대 시간 등) | V2 date/timestamptz |
| 20 | utils/id.ts | generateOrderNumber(YYYYMMDD-XXXXXX), generateProductNumber 삭제(DB RPC 대체) | V2 RPC 참조 |
| 21 | utils/sms-templates.ts | SMS 템플릿 (위탁 접수/승인/완료 등) | V2 notification_logs 패턴 |
| 22 | utils/excel.ts | 엑셀 파싱 유틸리티 | V2 excel_uploads |
| 23 | utils/chunk.ts | 배열 청크 분할 (배치 처리용) | V2 _batch_progress |
| 24 | utils/path.ts | 파일 경로 유틸리티 | V2 photo_uploads 패턴 |

---

## IV. 실행 순서 (8 Step)

### Step 1: 디렉토리 구조 생성
- `apps/web/lib/supabase/`, `types/domain/`, `utils/`, `db/` 디렉토리 생성
- **검증**: 디렉토리 존재 확인

### Step 2: 인프라 5개 파일 작성
- **대상**: env.ts, supabase/client.ts, supabase/admin.ts, auth.ts, ratelimit.ts
- **근거**: phase1-reimpl-reference.md + plan5 §4.1
- **주의**: Tokyo Supabase URL/키는 환경변수에서 읽기, 하드코딩 금지
- **검증**: tsc --noEmit

### Step 3: 도메인 타입 8개 파일 작성
- **대상**: seller.ts, consignment.ts, order.ts, settlement.ts, product.ts, notification.ts, photo.ts, index.ts
- **핵심 규칙**:
  - V2 DB 컬럼과 1:1 대응 (팬텀 필드 0건)
  - SettlementItem → 3필드만 (C-1)
  - SoldItem → V2 sold_items 20컬럼만 (H-9~12 제거)
  - StProduct → retailPrice, salePrice, photos (H-6~8 매핑)
  - ConsignmentRequest → brand, category 없음 (H-1~2 제거)
  - CHECK 상수 18종 전체 정의 (레퍼런스 §II)
  - COMMISSION_RATES는 seller.ts에서만 export (단일 소스)
- **검증**: tsc --noEmit

### Step 4: 유틸리티 11개 파일 작성
- **대상**: validation.ts, phone.ts, brand.ts, category.ts, currency.ts, date.ts, id.ts, sms-templates.ts, excel.ts, chunk.ts, path.ts
- **핵심 규칙**:
  - validation.ts: 공용 Zod 스키마 5개만 (co-location 원칙)
  - id.ts: generateOrderNumber만 (YYYYMMDD-XXXXXX, 0-999999 범위). generateProductNumber/generateSellerCode 없음 (DB RPC 대체)
  - brand.ts: 59개 브랜드 별칭
  - getCommissionRate(): seller.ts에서 import한 COMMISSION_RATES 사용
- **검증**: tsc --noEmit

### Step 5: 테스트 작성
- **대상**: types.test.ts, utils.test.ts, validation.test.ts
- **핵심 검증**:
  - 상수 18종 값 검증
  - ConsignmentStatus 7값 확인
  - SETTLEMENT_STATUSES 4값 (draft, confirmed, paid, failed)
  - SOLD_ITEM_STATUSES 4값 (pending, calculated, settled, returned)
  - generateOrderNumber 포맷 검증 (YYYYMMDD-XXXXXX)
  - getCommissionRate 티어별 기본값 + 개별값 우선순위
  - validation 스키마 5개 통과/거부 테스트
- **검증**: vitest run

### Step 6: 최종 검증 게이트
- tsc --strict --noEmit → 에러 0건
- vitest run → 전체 PASS
- ConsignmentStatus 7값 확인
- COMMISSION_RATES 단일 소스 (seller.ts에서만 export)
- validation.ts 공용 스키마 5개만
- 팬텀 필드 0건 (V2 DB 교차 대조)

### Step 7: Phase 2 재작성 (Phase 1 완료 후)
- 리포지토리 9종 + 트랜잭션 래퍼 3종
- Phase 1 타입/상수 기반으로 새로 작성
- V2 DB 컬럼명과 정확히 일치

### Step 8: 커밋
- Phase 1 완료 커밋 (사용자 승인 후)

---

## V. 검증 게이트 (MUST 조건)

| # | 게이트 | 검증 방법 | 기준 |
|---|-------|----------|------|
| M1 | TypeScript 컴파일 | tsc --strict --noEmit | 에러 0건 |
| M2 | 단위 테스트 | vitest run | 전체 PASS |
| M3 | ConsignmentStatus | grep 확인 | 7값 일치 |
| M4 | COMMISSION_RATES | grep -r "COMMISSION_RATES" lib/ | 1건 export |
| M5 | validation.ts | 스키마 수 확인 | 5개만 |
| M6 | any 사용 금지 | grep -r ": any" lib/ | 0건 |
| M7 | 코드 길이 | wc -l | 함수/컴포넌트 100줄 이내 |
| M8 | 팬텀 필드 0건 | V2 DB 교차 대조 | Phase 1 타입에 V2에 없는 컬럼 참조 0건 |

---

## VI. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 0에서 작성 시 누락 | 파일/상수 빠짐 | 레퍼런스 §I~VII 체크리스트 순회 |
| DB 컬럼명 불일치 | 런타임 에러 | Tokyo DDL 01_tables.sql과 1:1 대조 |
| Phase 2 미작성 상태 | import 에러 | Phase 2는 Phase 1 완료 후 별도 Step |
| 테스트 커버리지 부족 | 검증 사각 | 상수/포맷/비즈니스 규칙 최소 커버 |

---

## VII. 파일 참조

| 카테고리 | 경로 |
|---------|------|
| 레퍼런스 (검증 완료) | docs/03-analysis/phase1-reimpl-reference.md |
| V2 딥리서치 | docs/03-analysis/v2-full-deep-research-report.md |
| Tokyo DDL | supabase/tokyo-ddl/0{0~6}_*.sql |
| 마스터 플랜 | docs/Strategic/plan5.md |
| V2 정렬 계획 | docs/Strategic/phase1-v2-alignment-plan.md |

---

## VIII. 재검증 결과 (2라운드)

### 8.1 라운드 1: 실행계획 vs 전략문서

| 항목 | 결과 | 비고 |
|------|------|------|
| A) 파일 범위 일치성 | 일치 | plan5 22개 + index.ts + chunk.ts = 24개 |
| B) V2 1:1 원칙 준수 | 일치 | OrderStatus/Condition/Brand/Transition 모두 일치 |
| C) 의도적 제외 존중 | 일치 | generate_product_id 제외, 매퍼 3개 미포함 |
| D) Phase 2/3/4 의존 안전 | 일치 | verifySessionToken 보존, Phase 2는 별도 Step |
| E) MUST 조건 완전성 | 일치 | M1~M8 plan5 게이트 전수 포함 |

### 8.2 라운드 2: 실행계획 vs 레퍼런스 + 실제 상태

| 항목 | 결과 | 비고 |
|------|------|------|
| A) 디렉토리 상태 | 확인 | apps/web/lib/ 비어있음 (42파일 삭제 완료) |
| B) Phase 0 정상 | 확인 | 마이그레이션 19개 + Tokyo DB 정상 |
| C) 레퍼런스 이슈 24건 | 전수 반영 | C-1, H-1~15, M-1~6, L-1~2 모두 설계에 포함 |
| D) 상품번호/셀러코드 | DB RPC 대체 | TS에서 생성 로직 없음, DB에서만 생성 |

### 8.3 재검증 종합 판정

- **실행계획 정합성**: 전략문서 5개 + 레퍼런스 1개와 **완전 일치**
- **미결 의사결정**: 0건
- **재구현 준비 상태**: READY
