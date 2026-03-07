# Phase 1 V2 딥리서치 보고서

**작성일**: 2026-03-06
**방법론**: 3라운드 × 10개 독립 에이전트 교차 검증
**기준 데이터**: V2 DB 백업 6파일 (columns, constraints, indexes, functions, triggers, rls)

---

## 요약

| 분류 | 건수 | 설명 |
|------|------|------|
| CRITICAL (신규) | 1 | settlement_items 인터페이스 구조 불일치 |
| HIGH (신규) | 8 | 팬텀 필드 — V2에 없는 컬럼 참조 |
| MEDIUM (신규) | 6 | CHECK 상수 미정의 |
| LOW (신규) | 3 | 선택적 필드 추가, repo 줄 수 초과 |
| 이미 수정됨 | 7 | FIX-1~4, APP-BUG-1~3 (커밋 57e9da4) |
| 설계 의도 확인 | 61 | 필드 누락 58건 + auth HIGH 3건 |

---

## 1. CRITICAL — 즉시 수정 필요

### CRIT-1: settlement_items 인터페이스 ↔ V2 DB 구조 불일치

**V2 DB**: settlement_items는 3컬럼 join 테이블
```
id (uuid PK), settlement_id (uuid FK), sold_item_id (uuid FK)
```

**Phase 1 TS**: SettlementItem은 10필드 denormalized 뷰
```typescript
// apps/web/lib/types/domain/settlement.ts:49-60
interface SettlementItem {
  id, settlementId, soldItemId,
  productNumber, brand, model, soldPrice, commission, payout, createdAt
}
```

**V2 RPC** (마이그레이션 012):
```sql
INSERT INTO settlement_items (settlement_id, sold_item_id)
  SELECT v_settlement_id, unnest(p_sold_item_ids);
```

**판정**: TS 인터페이스가 DB 구조와 완전 불일치. productNumber~payout 7필드는 DB에 없음.

**권장 조치**:
- SettlementItem → 3필드(id, settlementId, soldItemId)로 축소
- 필요 시 `SettlementItemDetail` 인터페이스를 별도 정의 (JOIN 결과용)
- settlement.repo.ts에 JOIN 쿼리 명시화

**검증**: R1-A 발견 → R2-B 확인 → R3-B 최종 확정 (3라운드 일치)

---

## 2. HIGH — 팬텀 필드 8건 (V2에 없는 컬럼 참조)

### 2A. consignments.repo.ts — 2건

| # | Phase 1/2 필드 | V2 DB | V2 유사 컬럼 | 파일:줄 |
|---|-------------|-------|------------|---------|
| PH-1 | `brand` | 없음 | 없음 | consignments.repo.ts COLUMNS, consignment.ts:36 |
| PH-2 | `category` | 없음 | 없음 | consignments.repo.ts COLUMNS, consignment.ts:37 |

**권장 조치**: COLUMNS에서 제거, mapRow에서 제거, 타입에서 optional 유지 또는 제거

### 2B. products.repo.ts — 6건

| # | Phase 1/2 필드 | V2 DB | V2 유사 컬럼 | 매핑 제안 |
|---|-------------|-------|------------|----------|
| PH-3 | `model` | 없음 | 없음 (V2에 해당 개념 부재) | 제거 |
| PH-4 | `description` | 없음 | 없음 | 제거 |
| PH-5 | `sub_category` | 없음 | `category` (다른 의미) | 제거 |
| PH-6 | `original_price` | 없음 | `retail_price` | retail_price로 매핑 |
| PH-7 | `estimated_price` | 없음 | `sale_price` | sale_price로 매핑 |
| PH-8 | `image_urls` | 없음 | `photos` (jsonb) | photos로 매핑 + jsonb→string[] 파싱 |

**권장 조치**:
- PH-3~5: COLUMNS, mapRow, 타입에서 제거
- PH-6~8: V2 컬럼명으로 매핑 수정 (original_price→retail_price 등)

**검증**: R1-A 발견 → R2-A 분류(B=버그) → R3-A 정밀 대조 (3라운드 일치)

---

## 3. MEDIUM — CHECK 상수 미정의 6건

| # | 테이블.컬럼 | V2 CHECK 값 | Phase 1 상수 | 필요 시점 |
|---|-----------|-----------|------------|----------|
| CH-1 | sellers.status | pending, active, inactive, suspended, expired | 없음 | Phase 3+ |
| CH-2 | sellers.channel_type | half_size, full_size, both | 없음 | Phase 3+ |
| CH-3 | consignment_requests.source | naver_form, employee, manual, direct | 없음 | Phase 3+ |
| CH-4 | consignment_requests.seller_response | accepted, counter, cancelled | 없음 | Phase 3+ |
| CH-5 | order_items.inspection_status | pending, completed, hold | 없음 | Phase 3+ |
| CH-6 | sold_items.channel | smart_store, self_mall | 없음 | Phase 3+ |

**판정**: 현재 Phase 1/2에서 직접 사용하지 않는 주변 도메인 상수. 서비스 레이어(Phase 4) 구현 시 필요.

**권장 조치**: Phase 1 수정 시 일괄 추가 또는 Phase 3/4 구현 시 추가

**검증**: R1-A 발견 → R2-A 분류(A=의도적) → R3-B 최종 확인 (3라운드 일치)

---

## 4. LOW — 경미한 이슈

| # | 이슈 | 상세 | 권장 |
|---|------|------|------|
| LO-1 | sellers.bank_holder 미정의 | V2 데이터 0% 사용 (8/8 null) | 선택적 필드로 추후 추가 |
| LO-2 | consignment_requests.product_number 미정의 | V2 데이터 10% 사용 | 위탁 완료 역추적용, 선택적 추가 |
| LO-3 | settlement.repo.ts 121줄 | Phase 2 게이트 120줄 제한 1줄 초과 | 리팩토링 시 조정 |

---

## 5. 이미 수정된 항목 (커밋 57e9da4, cf8a3d9)

| # | 내용 | 커밋 |
|---|------|------|
| FIX-1 | SETTLEMENT_STATUSES: pending→draft, failed 추가 (3→4값) | 57e9da4 |
| FIX-2 | Settlement: itemCount, periodStart, periodEnd 추가 | 57e9da4 |
| FIX-3 | settlement.repo.ts: 컬럼명 V2 정렬 | 57e9da4 |
| FIX-4 | sellers.repo.ts: updated_at + fallback | 57e9da4 |
| APP-BUG-1 | settlements: updated_at→confirmed_at | 57e9da4 |
| APP-BUG-2 | sold_items: naver_order_id→order_id, seller_product_code→product_number | 57e9da4 |
| APP-BUG-3 | SOLD_ITEM_STATUSES: 2→4값 (calculated, returned 추가) | 57e9da4 |

---

## 6. 설계 의도 확인 (수정 불필요)

### 6A. 필드 누락 58건 = plan5.md 의도적 제외

sellers 13/14, consignment_requests 19/21, order_items 12/12, st_products 22/28 컬럼은 V3에서 의도적으로 제외.
plan5.md가 정의하지 않은 컬럼(email, id_card_*, contract_*, 등)은 V3 스코프 외.

### 6B. auth 패턴 HIGH 3건 = 단계적 설계

| 원래 HIGH | 판정 | 근거 |
|----------|------|------|
| auth.jwt()->>role 미설정 | 설계 의도 | V2도 실제로 JWT role 미사용, service_role 기반 |
| 세션 토큰 vs Supabase JWT | 설계 의도 | plan5.md §4.1: "V2 기반 + bcrypt cost 12" |
| admin role 정의 부재 | 설계 의도 | Phase 3 requireAdmin()에서 세션 쿠키 기반 추가 예정 |

---

## 7. 검증 게이트 결과

### Phase 1 (8/8 PASS)

| # | 게이트 | 상태 |
|---|-------|------|
| 1 | tsc --strict --noEmit 0 errors | PASS |
| 2 | ConsignmentStatus 7값 | PASS |
| 3 | COMMISSION_RATES single source | PASS |
| 4 | validation.ts 5 schemas | PASS |
| 5 | ESLint no-explicit-any | PASS |
| 6 | vitest 99/99 | PASS |
| 7 | Zod 공용 스키마 5개 | PASS |
| 8 | x-hold-token 단일화 확정 | PASS |

### Phase 2 (8/9 PASS)

| # | 게이트 | 상태 |
|---|-------|------|
| 1 | tsc --noEmit | PASS |
| 2 | .or() injection 0건 | PASS |
| 3 | error 체크 | PASS |
| 4 | .range() 사용 | PASS |
| 5 | chunkArray 사용 | PASS |
| 6 | 매퍼 파일 0개 | PASS |
| 7 | 리포지토리 120줄 제한 | FAIL (settlement.repo.ts 121줄) |
| 8 | deleteBySession 존재 | PASS |

---

## 8. 수정 우선순위

### 즉시 수정 (Phase 1/2 딥리서치 수정 배치)

| 순서 | 이슈 | 파일 | 변경 |
|------|------|------|------|
| 1 | CRIT-1 | settlement.ts | SettlementItem → 3필드 축소, SettlementItemDetail 별도 정의 |
| 2 | PH-1,2 | consignment.ts, consignments.repo.ts | brand, category 필드/COLUMNS 제거 |
| 3 | PH-3~5 | product.ts, products.repo.ts | model, description, subCategory 제거 |
| 4 | PH-6 | product.ts, products.repo.ts | originalPrice → retailPrice (V2: retail_price) |
| 5 | PH-7 | product.ts, products.repo.ts | estimatedPrice → salePrice (V2: sale_price) |
| 6 | PH-8 | product.ts, products.repo.ts | imageUrls → photos (V2: photos jsonb) |
| 7 | LO-3 | settlement.repo.ts | 121→120줄 이내 조정 |

### Phase 3/4 구현 시 추가

| 이슈 | 파일 | 변경 |
|------|------|------|
| CH-1~6 | 각 도메인 타입 파일 | 6개 CHECK 상수 정의 추가 |
| LO-1 | seller.ts | bankHolder?: string 선택적 추가 |
| LO-2 | consignment.ts | productNumber?: string 선택적 추가 |

---

## 9. 검증 방법론 기록

### 라운드 1: 4개 에이전트 병렬 (독립 탐색)
| 에이전트 | 범위 | 소요 |
|----------|------|------|
| R1-A | V2 columns + constraints ↔ Phase 1 타입 7종 | ~77s |
| R1-B | V2 functions 11개 ↔ Phase 1 utils 12개 | ~92s |
| R1-C | V2 RLS 34정책 + triggers 4개 ↔ Phase 1 인프라 | ~56s |
| R1-D | Phase 0 마이그레이션 16개 ↔ Phase 1 의존성 | ~77s |

### 라운드 2: 4개 에이전트 병렬 (교차 검증)
| 에이전트 | 검증 대상 | 결과 |
|----------|----------|------|
| R2-A | R1-A 필드 누락 진위 (A/B/C/D 분류) | 58 의도적, 2 추가필요, 8 버그 |
| R2-B | R1-B id.ts + 상태값 재검증 | 대부분 수정됨, settlement_items CRIT 발견 |
| R2-C | R1-C auth HIGH 3건 설계의도 확인 | 3건 모두 설계 의도 |
| R2-D | Phase 1/2 검증 게이트 실행 | Phase 1: 8/8, Phase 2: 8/9 |

### 라운드 3: 2개 에이전트 (최종 확인)
| 에이전트 | 검증 대상 | 결과 |
|----------|----------|------|
| R3-A | 팬텀 필드 8건 1:1 정밀 대조 | 8/8 버그 확정, 4건 매핑 제안 |
| R3-B | settlement_items + CHECK 상수 + 추가필드 | CRIT-1 확정, CH 6건 확인, LO 2건 확인 |

### 신뢰도
- **3라운드 일치율**: CRIT-1 3/3, PH-1~8 3/3, CH-1~6 3/3
- **오탐(False Positive) 제거**: auth HIGH 3건 → 설계 의도로 재분류
- **미탐(False Negative) 발견**: 팬텀 필드 8건은 R1에서 미발견 → R2에서 발견 → R3에서 확정

---

## 파일 참조

| 카테고리 | 경로 |
|---------|------|
| V2 DB 백업 | supabase/backup/v2_{columns,constraints,indexes,functions,triggers,rls}.txt |
| V2 데이터 | supabase/backup/{sellers,consignment_requests,orders,order_items,st_products}.json |
| Phase 1 타입 | apps/web/lib/types/domain/{seller,consignment,order,settlement,product,notification,photo}.ts |
| Phase 1 유틸 | apps/web/lib/utils/{validation,phone,brand,category,currency,date,id,sms-templates,excel,chunk,path,photo-url}.ts |
| Phase 1 인프라 | apps/web/lib/{auth,env,ratelimit}.ts, apps/web/lib/supabase/{admin,client}.ts |
| Phase 2 리포 | apps/web/lib/db/repositories/*.repo.ts |
| Phase 0 마이그레이션 | supabase/migrations/20260304000001~016_*.sql |
| Tokyo DDL | supabase/tokyo-ddl/0{0~6}_*.sql |
