# V2 전체 딥리서치 보고서

**작성일**: 2026-03-06
**방법론**: Phase 1 3라운드(10에이전트) + V2 전체 4에이전트 = 총 14개 독립 에이전트 교차 검증
**기준 데이터**: V2 DB 백업 6파일 + V2 실데이터 5종 + V3 plan5.md + 마이그레이션 16개

---

## I. V2 시스템 전체 구조

### 1.1 DB 규모
- 26 테이블, 389 컬럼
- CHECK 제약 29개 (enum 값)
- FK 관계 32개
- 인덱스 129개 (PK 21, UNIQUE 28, 성능 70, 부분 5, 함수 2)
- RLS 정책 34개
- 트리거 4개 (updated_at 자동갱신)
- RPC 함수 11개 (비즈니스 6, 생성 3, 암호화 2)

### 1.2 비즈니스 도메인 10개

| 도메인 | 핵심 테이블 | 컬럼수 | 사용자 접점 |
|--------|-----------|--------|-----------|
| 판매자 관리 | sellers | 24 | 관리자+판매자 |
| 위탁 파이프라인 | consignment_requests | 28 | 관리자+판매자 |
| 주문 관리 | orders, order_items | 19+23 | 관리자 |
| 상품 마스터 | st_products | 36 | 관리자+공개 |
| 판매 기록 | sales_records, sales_ledger, sold_items | 19+23+20 | 관리자 |
| 정산 파이프라인 | settlements, settlement_items, settlement_queue | 16+3+14 | 관리자 |
| 매칭/검증 | settlement_matches, naver_settlements, mismatches | 8+13+15 | 관리자 |
| 가격 분석 | market_prices, price_references, price_estimate_cache | 19+10+10 | 내부 |
| 배치/업로드 | _batch_progress, excel_uploads | 9+15 | 관리자 |
| 검색/분류 | brand_aliases, search_synonyms | 5+5 | 내부+공개 |

### 1.3 핵심 워크플로우

```
위탁접수(pending) → 수령(received) → 검수(inspecting) → 승인(approved)
    ↓ [complete_consignment()]
상품등록(st_products) + 주문생성(orders+order_items)
    ↓
판매기록(sold_items, settlement_status='pending')
    ↓ [create_settlement_with_items()]
정산생성(settlements, status='draft') + 항목연결(settlement_items)
    ↓
정산확인(confirmed) → 지급(paid)
```

### 1.4 사용자 접근 패턴 (RLS 기반)

| 사용자 | 인증 | 테이블 수 | 권한 |
|--------|------|----------|------|
| admin | JWT role='admin' | 23개 | ALL |
| seller | auth.uid() | 4개 | SELECT only (자기 데이터) |
| anon | 토큰 헤더 (hold_token, adjustment_token) | 2개 | SELECT/UPDATE 제한적 |
| service | service_role 키 | 전체 | ALL (RLS 우회) |

### 1.5 CHECK 제약조건 전체 목록 (29개)

| 테이블.컬럼 | 값 |
|-----------|---|
| _batch_progress.status | running, completed, partial, failed |
| consignment_requests.status | pending, inspecting, on_hold, approved, rejected, received, completed |
| consignment_requests.source | naver_form, employee, manual, direct |
| consignment_requests.seller_response | accepted, counter, cancelled |
| excel_uploads.status | processing, completed, failed |
| excel_uploads.upload_type | smart_store_sales, smart_store_confirm, naver_form, legacy_products |
| mismatches.mismatch_type | seller_mismatch, product_not_found, seller_not_found |
| naver_settlements.match_status | unmatched, auto_matched, manual_matched |
| notification_logs.status | pending, sent, failed |
| order_items.inspection_status | pending, completed, hold |
| orders.seller_type | general, employee, vip |
| orders.status | APPLIED, SHIPPING, COLLECTED, INSPECTED, PRICE_ADJUSTING, RE_INSPECTED, IMAGE_PREPARING, IMAGE_COMPLETE (리팩토링 V2 기준 8값, 신청관리 전용) |
| return_shipments.trigger_type | rejected, hold_cancelled |
| return_shipments.status | pending, requested, manual, in_transit, delivered, failed |
| sales_ledger.channel | smart_store, self_mall |
| sales_ledger.sale_type | normal, return |
| sales_ledger.product_type | consignment, inventory |
| sales_records.match_status | unmatched, auto_matched, manual_matched |
| sellers.status | pending, active, inactive, suspended, expired |
| sellers.seller_tier | general, employee, vip |
| sellers.channel_type | half_size, full_size, both |
| settlement_matches.match_type | auto, manual |
| settlement_queue.queue_status | pending, confirmed, paid |
| settlements.status | draft, confirmed, paid, failed |
| sold_items.channel | smart_store, self_mall |
| sold_items.settlement_status | pending, calculated, settled, returned |
| st_products.product_type | consignment, inventory |
| st_products.photo_status | pending, shooting, editing, completed |
| st_products.smartstore_status | draft, ready, uploaded, selling |

---

## II. V2 핵심 비즈니스 규칙

### 2.1 수수료 계산 (get_commission_rate)
```
우선순위 1: sellers.commission_rate > 0 → 개별 설정값
우선순위 2: sellers.seller_tier 기반 기본값
  general  → 0.25 (25%)
  employee → 0.20 (20%)
  vip      → 0.20 (20%)
  기타     → 0.25 (기본값)
```

### 2.2 번호 생성 패턴
| 대상 | V2 포맷 | V3 포맷 (019 교체) | 예시 |
|------|---------|-------------------|------|
| 상품번호 | YYMMDD-AAAAAA | 13자리 숫자: YYMMDD + 랜덤2 + 셀러코드5 | V2: 260305-TKBMXF → V3: 2602157392528 |
| 셀러코드 | NF001 (수동) | 5자리 숫자: hash(이름+전화+주소) | V2: NF001 → V3: 92528 |
| 주문번호 | YYYYMMDD-NNNNNN | 동일 | 20260305-123456 |
| 제품ID | YYYYMMDD-AAAAAA (미사용) | 삭제 (데드코드) | — |

### 2.3 동시성 제어
- complete_consignment(): FOR UPDATE 행 잠금
- create_settlement_with_items(): FOR UPDATE 배열 잠금 + count 검증 (All-or-Nothing)
- generate_product_number(): pg_advisory_xact_lock + 중복 루프 (최대 100회)
- generate_seller_code(): 해시 기반 + 중복 시 재해싱 (최대 1000회)

### 2.4 정산 상태 머신
```
sold_items: pending → calculated → settled → returned
settlements: draft → confirmed → paid (+ failed)
settlement_queue: pending → confirmed → paid
```

---

## III. V2 실데이터 분석 (사용 패턴)

### 3.1 데이터 규모 (초기 단계)
| 데이터 | 건수 | 상태 |
|--------|------|------|
| 판매자 | 8명 | 모두 active, commission_rate=0.2 고정 |
| 위탁 요청 | 11건 | 8 pending, 3 completed |
| 주문 | 3건 | 모두 APPLIED |
| 주문 항목 | 3건 | 모두 PENDING, inspection_status=pending |
| 상품 | 3건 | 모두 draft, photo_status=pending |

### 3.2 활성/비활성 기능 분석

**활성 기능 (실데이터 존재)**:
- 위탁 접수 (source=employee)
- 위탁 승인→상품 생성 (3건 완료)
- 주문 생성 (APPLIED 상태)
- 수수료율 설정 (0.2 고정)
- 가격 추정 (retail_price_source=naver_estimate)

**비활성 기능 (0% 사용률)**:
- 가격 협상 (adjustment_token=null 11/11)
- 배송 관리 (address=empty 3/3)
- 보류/홀드 (hold_* 필드 모두 null)
- 은행 정보 (bank_name/account/holder 모두 null)
- 정산 실행 (commission=0, final_payout=0)
- 스마트스토어 등록 (smartstore_status=draft 고정)
- 이메일 (email=null 8/8)
- 신원 확인 (id_card_verified=false 8/8)

---

## IV. Phase 1 딥리서치 결과 (3라운드 검증)

### 4.1 CRITICAL — 즉시 수정 (1건)

**CRIT-1: settlement_items 인터페이스 ↔ V2 DB 불일치**
- V2 DB: 3컬럼 join 테이블 (id, settlement_id, sold_item_id)
- Phase 1 TS: 10필드 denormalized (productNumber, brand, model 등 포함)
- 조치: SettlementItem → 3필드로 축소, 필요 시 SettlementItemDetail 별도 정의

### 4.2 HIGH — 팬텀 필드 8건 (V2에 없는 컬럼 참조)

| # | 파일 | 팬텀 필드 | V2 유사 컬럼 | 조치 |
|---|------|---------|------------|------|
| PH-1 | consignments.repo.ts | brand | 없음 | 제거 |
| PH-2 | consignments.repo.ts | category | 없음 | 제거 |
| PH-3 | products.repo.ts | model | 없음 | 제거 |
| PH-4 | products.repo.ts | description | 없음 | 제거 |
| PH-5 | products.repo.ts | sub_category | 없음 | 제거 |
| PH-6 | products.repo.ts | original_price | retail_price | 매핑 수정 |
| PH-7 | products.repo.ts | estimated_price | sale_price | 매핑 수정 |
| PH-8 | products.repo.ts | image_urls | photos (jsonb) | 매핑 수정 |

### 4.3 MEDIUM — CHECK 상수 미정의 6건

| CHECK | V2 값 | 추가 시점 |
|-------|------|---------|
| sellers.status | pending, active, inactive, suspended, expired | Phase 1 수정 시 |
| sellers.channel_type | half_size, full_size, both | Phase 1 수정 시 |
| consignment_requests.source | naver_form, employee, manual, direct | Phase 3+ |
| consignment_requests.seller_response | accepted, counter, cancelled | Phase 3+ |
| order_items.inspection_status | pending, completed, hold | Phase 1 수정 시 |
| sold_items.channel | smart_store, self_mall | Phase 1 수정 시 |

### 4.4 설계 의도 확인 (수정 불필요)

- **필드 누락 58건**: plan5.md에서 의도적 제외 (email, id_card_*, contract_*, 등)
- **auth HIGH 3건**: V2도 JWT role 미사용, service_role 기반. Phase 3에서 세션 쿠키 기반 추가
- **검증 게이트**: Phase 1 8/8 PASS, Phase 2 8/9 PASS

### 4.5 이미 수정됨 (7건)

FIX-1~4 + APP-BUG-1~3 (커밋 57e9da4): SETTLEMENT_STATUSES, Settlement 인터페이스, 컬럼명, SOLD_ITEM_STATUSES 등

---

## V. V3 plan5.md vs V2 계승도 분석

### 5.1 높은 계승도 (90%+)
- 정산 구조 (settlements + settlement_items + settlement_queue)
- 판매자 기본정보 (name, phone, seller_code)
- 수수료율 체계 (commission_rate, seller_tier)
- 위탁 상태 머신 (7값)
- 주문 상태 머신 (10값, V2 확장)

### 5.2 V3 주요 개선점
- 상태 추적: V2 2단계 → V3 7~10단계 세분화
- 데이터 무결성: UNIQUE 제약 5개 추가
- 원자성: RPC 기반 트랜잭션 (FOR UPDATE + count 검증)
- 보안: RLS 정책 34→52개 (방어심화 +18)
- 세션 관리: upload_session_id (DAT-09 버그 수정)

### 5.3 V2 미활용→V3 신규 활성화 대상
- 가격 협상 (adjustment_token 기반 Public API)
- 배송 관리 (address 필드 활성화)
- 보류/홀드 (on_inspection, HOLD 상태)
- 이미지 자동분류 (Phase 7)

---

## VI. Phase 1 재구현 수정 목록

### 즉시 수정 (Phase 1/2 코드)

| 순서 | 심각도 | 파일 | 변경 내용 |
|------|--------|------|----------|
| 1 | CRIT | settlement.ts | SettlementItem → 3필드(id, settlementId, soldItemId) 축소 |
| 2 | HIGH | consignment.ts + consignments.repo.ts | brand, category 필드/COLUMNS 제거 |
| 3 | HIGH | product.ts + products.repo.ts | model, description, subCategory 제거 |
| 4 | HIGH | product.ts + products.repo.ts | originalPrice→retailPrice (V2: retail_price) |
| 5 | HIGH | product.ts + products.repo.ts | estimatedPrice→salePrice (V2: sale_price) |
| 6 | HIGH | product.ts + products.repo.ts | imageUrls→photos (V2: photos jsonb) |
| 7 | MED | seller.ts | SELLER_STATUSES 추가: pending, active, inactive, suspended, expired |
| 8 | MED | seller.ts | CHANNEL_TYPES 추가: half_size, full_size, both |
| 9 | MED | order.ts | INSPECTION_STATUSES 추가: pending, completed, hold |
| 10 | MED | settlement.ts 또는 별도 | SALES_CHANNELS 추가: smart_store, self_mall |
| 11 | LOW | settlement.repo.ts | 121→120줄 이내 조정 |

### V2 비즈니스 규칙 반영 (Phase 1 유틸리티)

| 항목 | 현재 | V2 기준 | 조치 |
|------|------|--------|------|
| 수수료 계산 | 미구현 | get_commission_rate() 티어별 기본값 | utils/commission.ts 또는 seller.ts에 추가 |
| 상품번호 포맷 | YYYYMMDD-ALPHA | YYMMDD-ALPHA | 이미 수정됨 (57e9da4) |
| 주문번호 난수 | 100000-999999 | 0-999999 | 범위 확인 후 결정 |

---

## VII. 파일 참조

| 카테고리 | 경로 |
|---------|------|
| V2 DB 백업 | supabase/backup/v2_{columns,constraints,indexes,functions,triggers,rls}.txt |
| V2 실데이터 | supabase/backup/{sellers,consignment_requests,orders,order_items,st_products}.json |
| Phase 1 타입 | apps/web/lib/types/domain/*.ts |
| Phase 1 유틸 | apps/web/lib/utils/*.ts |
| Phase 2 리포 | apps/web/lib/db/repositories/*.repo.ts |
| Phase 0 마이그레이션 | supabase/migrations/20260304000001~016_*.sql |
| V3 마스터 플랜 | docs/Strategic/plan5.md |
| Phase 3+4 계획 | docs/Strategic/phase3-4-plan.md |
