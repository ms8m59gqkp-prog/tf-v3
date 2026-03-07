# Phase 0 + Phase 1 완료 보고서

**작성일**: 2026-03-07
**방법론**: 4라운드 26에이전트 딥리서치 + 3단계 사전 검증 + 2라운드 재검증 + Tokyo DB 실데이터 통합 테스트
**범위**: Phase 0 (DB 마이그레이션) + Phase 1 (인프라 + 도메인 타입 + 유틸리티)

---

## I. 프로젝트 개요

### 1.1 목표

V2 시스템(Mumbai Supabase)의 워크플로우와 사용자 편의성을 계승하면서, V3 계획(plan5.md)의 개선 사항을 통합한 새로운 기반 시스템 구축.

### 1.2 전략

| 단계 | 방법론 | 결과물 |
|------|--------|--------|
| 딥리서치 | V2 DB 백업 6파일 + 실데이터 5종 + V3 plan5.md 교차 분석 | 24건 이슈 식별 |
| 검증 | 레퍼런스 정확성 + Tokyo DB 상태 + 문서 간 일관성 | 불일치 0건 |
| 구현 | 전체 삭제 후 0에서 새로 작성 | 24파일 + 4테스트 |
| 통합 테스트 | Tokyo DB 실데이터로 타입/상수/유틸/RPC 검증 | 79/79 PASS |

### 1.3 인프라 구성

| 항목 | V2 (Mumbai) | V3 (Tokyo) |
|------|-------------|------------|
| 리전 | ap-south-1 (Mumbai) | ap-northeast-1 (Tokyo) |
| Project ID | hmoxjhvjqzqepasvffbp | jmgscpmkrvvxxuzejrdf |
| Pooler | aws-0 | aws-1 |
| 테이블 | 26개 | 26개 (동일) |
| 컬럼 | 389개 | 390개 (+1 sellers.address) |
| RLS 정책 | 34개 | 52개 (+18 보안 강화) |
| RPC 함수 | 10개 | 11개 (+1 generate_seller_code) |

---

## II. Phase 0: DB 마이그레이션 (19건)

### 2.1 마이그레이션 전체 목록

| # | 파일명 | 내용 | 상태 |
|---|--------|------|------|
| 001 | consignment_status_check | 위탁 7값 CHECK | 배포 완료 |
| 002 | unique_constraints | 5개 UNIQUE 제약 | 배포 완료 |
| 003 | performance_indexes | 5개 인덱스 | 배포 완료 |
| 004 | rls_policies | RLS 정책 (+18) | 배포 완료 |
| 005 | rpc_settlement | 정산 RPC (→012에서 교체) | 교체됨 |
| 006 | rpc_order | 주문 RPC | 배포 완료 |
| 007 | rpc_consignment | 위탁 RPC (→013에서 교체) | 교체됨 |
| 008 | upload_session_id | sales_records 컬럼 추가 | 배포 완료 |
| 009 | batch_progress | _batch_progress 테이블 | 배포 완료 |
| 010 | public_orders_rls | hold_token + RLS | 배포 완료 |
| 011 | fix_rpc_settlement | 정산 RPC 수정 (→012에서 교체) | 교체됨 |
| 012 | fix_rpc_settlement_v2 | 최종 정산 RPC | 배포 완료 |
| 013 | fix_rpc_consignment_v2 | 최종 위탁 RPC (14파라미터) | 배포 완료 |
| 014 | updated_at_triggers | update_updated_at() + 3 트리거 | 배포 완료 |
| 015 | rpc_generate_product_number | CT-{CODE}-{SEQ} (→019에서 교체) | 교체됨 |
| 016 | orders_status_extend | CHECK 8→10값 | 배포 완료 |
| 017 | alter_sellers_add_address | sellers.address TEXT 추가 | 배포 완료 |
| 018 | rpc_generate_seller_code | 셀러코드 RPC (5자리 숫자) | 배포 완료 |
| 019 | replace_generate_product_number | 상품번호 RPC (13자리 숫자) | 배포 완료 |

### 2.2 Tokyo DB 최종 상태

| 항목 | 수량 |
|------|------|
| 테이블 | 26개 |
| 컬럼 | 390개 |
| 인덱스 | 129개 |
| CHECK 제약 | 30개 |
| RLS 정책 | 52개 |
| RPC 함수 | 11개 |
| 트리거 | 4개 |
| 데이터 행 (전체) | 5,314행 |

### 2.3 RPC 함수 11개 상세

| # | 함수명 | 파라미터 | 반환 | 동시성 제어 |
|---|--------|---------|------|-----------|
| 1 | update_updated_at | (trigger) | trigger | — |
| 2 | create_order_with_items | 5개 | uuid | — |
| 3 | create_settlement_with_items | 8개 | uuid | FOR UPDATE + count 검증 |
| 4 | complete_consignment | 14개 | uuid | FOR UPDATE 행 잠금 |
| 5 | generate_product_number | 1개 (seller_id) | text (13자리) | pg_advisory_xact_lock |
| 6 | generate_seller_code | 3개 (name, phone, address) | text (5자리) | 해시 기반 재시도 |
| 7 | find_brand | 1개 (search_term) | table | — |
| 8 | generate_order_number | 0개 | text | 무한 루프 중복 체크 |
| 9 | get_commission_rate | 1개 (seller_id) | numeric | — |
| 10 | pgp_sym_decrypt_text | 2개 | text | — |
| 11 | pgp_sym_encrypt_text | 2개 | text | — |

### 2.4 번호 생성 체계 (확정)

| 대상 | 포맷 | 예시 | 생성 위치 |
|------|------|------|----------|
| 상품번호 | 13자리 숫자: YYMMDD + 랜덤2 + 셀러코드5 | 2603070035402 | DB RPC (019) |
| 셀러코드 | 5자리 숫자: hash(이름+전화+주소) | 36466 | DB RPC (018) |
| 주문번호 | YYYYMMDD-XXXXXX | 20260307-042195 | DB RPC + TS 유틸 |

### 2.5 데이터 이관 (Mumbai → Tokyo)

FK 의존 순서(Level 0→3) 준수, 500행 배치 단위.

| Level | 테이블 | 행 수 |
|-------|--------|-------|
| 0 | sellers, brand_aliases, search_synonyms, price_references, market_prices, orders, excel_uploads | 5,303 |
| 1 | order_items, st_products | 6 |
| 2 | consignment_requests | 11 |
| 3 | notification_logs | 6 |
| **합계** | **11 테이블** | **5,326** |

### 2.6 데이터 정리 (2026-03-07)

| 작업 | 대상 | 수량 | 사유 |
|------|------|------|------|
| 셀러코드 교체 | NF001~008 → 5자리 숫자 | 8건 | V3 확정 포맷 불일치 |
| 더미 셀러 삭제 | 이름 1~6 | 6건 | 테스트 더미 데이터 |
| 더미 위탁 삭제 | 상품명 1~6 | 6건 | FK 연쇄 (위 셀러에 연결) |
| 무효 전화번호 수정 | 1, 2, 3 등 → 01000000001~6 | 6건 | 삭제 전 수정됨 → 셀러와 함께 삭제 |

**정리 후 실데이터**:

| 테이블 | 행 수 | 주요 데이터 |
|--------|-------|------------|
| sellers | 2 | 카바바(36466), 아라차(35402) |
| consignment_requests | 5 | 3 completed, 2 pending |
| orders | 3 | 모두 APPLIED |
| order_items | 3 | 모두 pending |
| st_products | 3 | 모두 draft |

---

## III. Phase 1: 인프라 + 도메인 타입 + 유틸리티

### 3.1 구현 방식

**전체 삭제 후 0에서 새로 작성**.

기존 Phase 1(25파일) + Phase 2(14파일) + 테스트(5파일) = 42파일을 전체 삭제하고, 검증된 레퍼런스 문서(phase1-reimpl-reference.md) 기반으로 24파일을 새로 작성.

선택 근거: 기존 코드 수정(15 HIGH + 6 MEDIUM 이슈)보다 0에서 작성이 오류 가능성 낮음 (사용자 판단).

### 3.2 파일 목록 (24개, 1,002줄)

**인프라 (5개, 143줄)**

| # | 파일 | 줄 수 | 역할 |
|---|------|-------|------|
| 1 | env.ts | 22 | 환경변수 검증 (SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY, ADMIN_PASSWORD_HASH) |
| 2 | supabase/client.ts | 14 | 브라우저용 Supabase 클라이언트 |
| 3 | supabase/admin.ts | 17 | 서버 전용 admin 클라이언트 (service_role, RLS 우회) |
| 4 | auth.ts | 41 | 관리자 인증 (bcrypt cost=12, 인메모리 세션, 24h TTL) |
| 5 | ratelimit.ts | 49 | IP 기반 레이트 리미터 (인메모리 Map, 1분/10회 기본) |

**도메인 타입 (8개, 439줄)**

| # | 파일 | 줄 수 | 상수 | 인터페이스 | V2 테이블 |
|---|------|-------|------|-----------|----------|
| 6 | seller.ts | 57 | SELLER_STATUSES(5), SELLER_TIERS(3), CHANNEL_TYPES(3), COMMISSION_RATES | Seller | sellers 25컬럼 |
| 7 | consignment.ts | 57 | CONSIGNMENT_STATUSES(7), CONSIGNMENT_SOURCES(4), SELLER_RESPONSES(3), ALLOWED_TRANSITIONS | ConsignmentRequest | consignment_requests 28컬럼 |
| 8 | order.ts | 72 | ORDER_STATUSES(10), INSPECTION_STATUSES(3), CONDITION_LABELS | Order, OrderItem | orders 19 + order_items 23컬럼 |
| 9 | settlement.ts | 116 | SETTLEMENT_STATUSES(4), SOLD_ITEM_STATUSES(4), SALES_CHANNELS(2), MATCH_STATUSES(3) | Settlement, SettlementItem(3필드), SettlementItemDetail, SoldItem, SalesRecord, NaverSettlement | 5개 테이블 |
| 10 | product.ts | 57 | PRODUCT_TYPES(2), PHOTO_STATUSES(4), SMARTSTORE_STATUSES(4), RETAIL_PRICE_SOURCES(3) | StProduct | st_products 36컬럼 |
| 11 | notification.ts | 37 | SMS_STATUSES(3), BATCH_STATUSES(4) | NotificationLog, BatchProgress | 2개 테이블 |
| 12 | photo.ts | 29 | — | Photo, PhotoUpload | 2개 테이블 |
| 13 | index.ts | 14 | — | re-export all | — |

**유틸리티 (11개, 420줄)**

| # | 파일 | 줄 수 | 주요 함수/내용 |
|---|------|-------|-------------|
| 14 | validation.ts | 28 | Zod 스키마 5개 (phone, sellerCode, productNumber, orderId, price) |
| 15 | phone.ts | 26 | formatPhone, normalizePhone, isValidPhone |
| 16 | brand.ts | 46 | BRAND_ALIASES (59개), normalizeBrand, isKnownBrand |
| 17 | category.ts | 31 | CATEGORIES (10개), normalizeCategory |
| 18 | currency.ts | 25 | formatCurrency (₩), formatNumber, parseCurrency |
| 19 | date.ts | 46 | formatDate, formatDateTime, formatRelativeTime, isValidDate |
| 20 | id.ts | 15 | generateOrderNumber (YYYYMMDD-XXXXXX). 상품번호/셀러코드는 DB RPC 대체 |
| 21 | sms-templates.ts | 45 | 5개 SMS 템플릿 (접수/승인/완료/반려/정산) |
| 22 | excel.ts | 44 | normalizeHeader, mapHeaders, parseExcelDate, isEmptyRow |
| 23 | chunk.ts | 15 | chunk<T> 배열 분할 |
| 24 | path.ts | 28 | getProductPhotoPath, getFileExtension, isImageFile |

### 3.3 Export 통계

| 항목 | 수량 |
|------|------|
| 상수 (as const) | 18종 |
| 타입 (type) | 18종 |
| 인터페이스 (interface) | 15종 |
| 함수 (function) | 38개 |
| **합계** | **89개 export** |

### 3.4 CHECK 제약 ↔ Phase 1 상수 대조 (18/30)

Phase 1에서 정의한 18개 상수가 Tokyo DB CHECK 제약 30개 중 해당하는 값과 100% 일치. 나머지 12개는 Phase 3/4에서 추가 예정.

| # | DB CHECK | Phase 1 상수 | 값 수 | 일치 |
|---|---------|-------------|-------|------|
| 1 | sellers.status | SELLER_STATUSES | 5 | PASS |
| 2 | sellers.seller_tier | SELLER_TIERS | 3 | PASS |
| 3 | sellers.channel_type | CHANNEL_TYPES | 3 | PASS |
| 4 | consignment_requests.status | CONSIGNMENT_STATUSES | 7 | PASS |
| 5 | consignment_requests.source | CONSIGNMENT_SOURCES | 4 | PASS |
| 6 | consignment_requests.seller_response | SELLER_RESPONSES | 3 | PASS |
| 7 | orders.status | ORDER_STATUSES | 10 | PASS |
| 8 | orders.seller_type | SELLER_TIERS (공유) | 3 | PASS |
| 9 | order_items.inspection_status | INSPECTION_STATUSES | 3 | PASS |
| 10 | settlements.status | SETTLEMENT_STATUSES | 4 | PASS |
| 11 | sold_items.settlement_status | SOLD_ITEM_STATUSES | 4 | PASS |
| 12 | sold_items.channel | SALES_CHANNELS | 2 | PASS |
| 13 | _batch_progress.status | BATCH_STATUSES | 4 | PASS |
| 14 | notification_logs.status | SMS_STATUSES | 3 | PASS |
| 15 | st_products.product_type | PRODUCT_TYPES | 2 | PASS |
| 16 | st_products.photo_status | PHOTO_STATUSES | 4 | PASS |
| 17 | st_products.smartstore_status | SMARTSTORE_STATUSES | 4 | PASS |
| 18 | st_products.retail_price_source | RETAIL_PRICE_SOURCES | 3 | PASS |

### 3.5 딥리서치 이슈 24건 해소 현황

| 심각도 | 이슈 수 | 해소 | 방법 |
|--------|---------|------|------|
| CRITICAL | 1 | 1/1 | SettlementItem 3필드로 축소 |
| HIGH | 15 | 15/15 | 팬텀 필드 제거(8), 매핑 수정(3), 번호 생성 DB 대체(2), 하드코딩 제거(2) |
| MEDIUM | 6 | 6/6 | CHECK 상수 18종 전체 정의 |
| LOW | 2 | — | Phase 3/4 대상 (bankHolder, productNumber optional) |
| **합계** | **24** | **22/24** | LOW 2건은 Phase 3/4 예정 |

---

## IV. 테스트 검증

### 4.1 테스트 구성 (4파일, 79 테스트)

| 파일 | 종류 | 수 | 검증 대상 |
|------|------|-----|----------|
| types.test.ts | 단위 | 23 | 상수 18종 값/길이, getCommissionRate 우선순위 |
| utils.test.ts | 단위 | 26 | 유틸 함수 10개 입출력 |
| validation.test.ts | 단위 | 17 | Zod 스키마 5개 통과/거부 |
| db-live.test.ts | **통합** | **13** | **Tokyo DB 실데이터 연결** |
| **합계** | | **79** | **ALL PASS** |

### 4.2 통합 테스트 상세 (db-live.test.ts)

Tokyo Supabase에 service_role 키로 직접 연결하여 검증.

| # | 테스트 | 검증 내용 | 결과 |
|---|--------|---------|------|
| 1 | sellers 조회 + Seller 타입 호환 | 25컬럼 존재, status/tier/channel CHECK 일치 | PASS |
| 2 | getCommissionRate vs DB RPC | TS 함수 결과 = DB get_commission_rate() 결과 동일 | PASS |
| 3 | consignment_requests 상태값 | status/source CHECK 상수 일치 | PASS |
| 4 | orders.status CHECK | 10값 일치 | PASS |
| 5 | order_items.inspection_status | 3값 일치 | PASS |
| 6 | st_products 36컬럼 + CHECK | retail_price/sale_price/photos 존재, model/description/sub_category 부재 확인 | PASS |
| 7 | generate_seller_code 결정적 | 같은 입력 → 같은 5자리 숫자 | PASS |
| 8 | generate_seller_code 고유성 | 다른 입력 → 다른 코드 | PASS |
| 9 | generate_product_number | 13자리 숫자 (YYMMDD + 랜덤2 + 셀러코드5) | PASS |
| 10 | generate_order_number | YYYYMMDD-XXXXXX 포맷 | PASS |
| 11 | formatPhone 실데이터 | 실제 판매자 전화번호 포맷 변환 | PASS |
| 12 | formatCurrency 실데이터 | 실제 상품 가격 원화 포맷 | PASS |
| 13 | formatDate 실데이터 | 실제 생성일 YYYY-MM-DD 변환 | PASS |

### 4.3 MUST 검증 게이트 (8/8 PASS)

| # | 게이트 | 기준 | 결과 |
|---|-------|------|------|
| M1 | tsc --noEmit | 에러 0건 | **PASS** |
| M2 | vitest run | 전체 PASS | **PASS** (79/79) |
| M3 | ConsignmentStatus 7값 | pending, received, inspecting, on_hold, approved, rejected, completed | **PASS** |
| M4 | COMMISSION_RATES 단일 소스 | seller.ts에서만 export | **PASS** |
| M5 | validation.ts 스키마 수 | 5개만 | **PASS** |
| M6 | `any` 사용 금지 | grep 0건 | **PASS** |
| M7 | 코드 길이 | 함수 100줄 이내 | **PASS** |
| M8 | 팬텀 필드 0건 | V2 DB 교차 대조 | **PASS** |

---

## V. 사용자 의사결정 기록

### 5.1 Phase 0 의사결정

| # | 결정 | 선택 | 근거 | 일시 |
|---|------|------|------|------|
| D-01 | generate_product_id 이관 | 미이관 | V2 dead code (호출처 0건) | 03-06 |
| D-02 | 9개 policyless 테이블 RLS | +18 정책 추가 | 보안 강화 | 03-06 |
| D-03 | 대용량 테이블 이관 | 500행 배치 | API body 크기 제한 | 03-06 |
| D-04 | 상품번호 체계 | 13자리 숫자: YYMMDD + 랜덤2 + 셀러코드5 | V2 YYMMDD 계승 + 셀러 추적 | 03-07 |
| D-05 | 셀러코드 체계 | 5자리 숫자: hash(이름+전화+주소) | 결정적 고유값, 개인정보 비가역 | 03-07 |
| D-06 | sellers.address 추가 | NULL 허용 | 셀러코드 해싱 + 향후 배송 기능 | 03-07 |
| D-07 | CT 포맷 | 폐기 | "V2 방식이 보기에 더 좋다" | 03-07 |

### 5.2 Phase 1 의사결정

| # | 결정 | 선택 | 근거 | 일시 |
|---|------|------|------|------|
| D-08 | 재구현 방식 | 0에서 새로 작성 | 기존 수정보다 오류 가능성 낮음 | 03-07 |
| D-09 | OrderStatus | V2 8값 + CONFIRMED + CANCELLED = 10값 | 신청관리 전용, 운영상 필요 | 03-07 |
| D-10 | Condition N 라벨 | "NEW" (V2 "Brand New" → 변경) | 사용자 지시 | 03-07 |
| D-11 | 브랜드 별칭 | V2 43개 + V3 16개 병합 (59개) | 충돌 0건 | 03-07 |
| D-12 | ALLOWED_TRANSITIONS | 옵션 C (V2 워크플로우 기반) | 사용자 선택 | 03-07 |
| D-13 | 더미 데이터 | 즉시 삭제 | NF 접두어 + 무효 전화번호 용납 불가 | 03-07 |

---

## VI. 프로젝트 규칙 추가

### 6.1 데이터 위생 규칙 (CLAUDE.md)

`/Users/jeongmyeongcheol/tf-v3/CLAUDE.md` 신규 생성.

| # | 규칙 |
|---|------|
| 1 | 통합 테스트 후 DB에 삽입된 테스트 데이터는 테스트 종료 시 반드시 삭제 |
| 2 | 더미 데이터 발견 시 즉시 리포트(테이블명, 행 수, 생성 경위) + FK 연쇄 확인 후 삭제 |
| 3 | 테스트용 데이터 삽입 시 식별 가능하게 작성 (예: `_test_` prefix) |
| 4 | 실데이터 수정/삭제 전 반드시 사용자 확인. 백업 없이 삭제 금지 |

---

## VII. 파일 트리

```
tf-v3/
├── CLAUDE.md                              # 프로젝트 규칙 (신규)
├── supabase/
│   ├── migrations/
│   │   ├── 20260304000001~019_*.sql       # Phase 0 마이그레이션 19개
│   ├── tokyo-ddl/
│   │   ├── 00_extensions.sql ~ 06_rls.sql # Tokyo DDL 7파일
│   └── backup/                            # V2 백업 데이터
├── apps/web/
│   ├── lib/
│   │   ├── env.ts                         # 환경변수 검증
│   │   ├── auth.ts                        # 관리자 인증
│   │   ├── ratelimit.ts                   # 레이트 리미터
│   │   ├── supabase/
│   │   │   ├── client.ts                  # 브라우저 클라이언트
│   │   │   └── admin.ts                   # 서버 admin 클라이언트
│   │   ├── types/
│   │   │   ├── index.ts                   # re-export
│   │   │   └── domain/
│   │   │       ├── seller.ts              # 판매자 (25컬럼, 상수4, 함수1)
│   │   │       ├── consignment.ts         # 위탁 (28컬럼, 상수3, 전이맵1)
│   │   │       ├── order.ts               # 주문 (42컬럼, 상수3)
│   │   │       ├── settlement.ts          # 정산 (5테이블, 상수4, 인터페이스6)
│   │   │       ├── product.ts             # 상품 (36컬럼, 상수4)
│   │   │       ├── notification.ts        # 알림/배치 (19컬럼, 상수2)
│   │   │       └── photo.ts              # 사진 (17컬럼)
│   │   └── utils/
│   │       ├── validation.ts              # Zod 스키마 5개
│   │       ├── phone.ts                   # 전화번호 포맷
│   │       ├── brand.ts                   # 브랜드 별칭 59개
│   │       ├── category.ts               # 카테고리 10개
│   │       ├── currency.ts               # 통화 포맷
│   │       ├── date.ts                    # 날짜 포맷
│   │       ├── id.ts                      # 주문번호 생성
│   │       ├── sms-templates.ts           # SMS 템플릿 5개
│   │       ├── excel.ts                   # 엑셀 파싱
│   │       ├── chunk.ts                   # 배열 청크
│   │       └── path.ts                    # 파일 경로
│   └── __tests__/
│       ├── unit/
│       │   ├── types.test.ts              # 상수 검증 (23)
│       │   ├── utils.test.ts              # 유틸 검증 (26)
│       │   └── validation.test.ts         # 스키마 검증 (17)
│       └── integration/
│           └── db-live.test.ts            # Tokyo DB 통합 (13)
```

---

## VIII. 다음 단계

| Phase | 내용 | 의존성 | 예상 파일 수 |
|-------|------|--------|------------|
| **Phase 2** | 리포지토리 9종 + 트랜잭션 래퍼 3종 | Phase 1 타입/상수 | ~12파일 |
| Phase 3 | API 라우트 + 서비스 레이어 | Phase 2 리포지토리 | ~20파일 |
| Phase 4 | UI 페이지 (위탁/주문/정산/상품) | Phase 3 API | ~30파일 |

### Phase 2 핵심 작업

- 리포지토리 9종: sellers, consignments, orders, products, settlement, sold-items, sales-records, naver-settlements, batch
- 트랜잭션 래퍼 3종: complete_consignment, create_order_with_items, create_settlement_with_items (DB RPC 호출)
- Phase 1 타입/상수를 import하여 V2 DB 컬럼명과 1:1 매핑

---

## IX. 참조 문서

| 문서 | 경로 |
|------|------|
| 레퍼런스 (검증 완료) | docs/03-analysis/phase1-reimpl-reference.md |
| 실행계획서 | docs/03-analysis/phase1-reimpl-execution-plan.md |
| V2 전체 딥리서치 | docs/03-analysis/v2-full-deep-research-report.md |
| Phase 진행 이력 | docs/Strategic/phase-progress-log.md |
| 마스터 플랜 | docs/Strategic/plan5.md |
| Tokyo DDL | supabase/tokyo-ddl/0{0~6}_*.sql |
| V2 DB 백업 | supabase/backup/v2_{columns,constraints,indexes,functions,triggers,rls}.txt |
