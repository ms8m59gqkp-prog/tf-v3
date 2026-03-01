# Classic Menswear V2 — 2차 심층 코드 리서치 보고서

**작성일**: 2026-02-28
**기준**: 클로드코드교리 v2.0
**목적**: V3 재설계를 위한 V2 코드베이스 문제 전수조사
**원칙**: 수정 없이 조사/보고만 수행

---

## 목차

1. [치명적 문제 (CRITICAL)](#1-치명적-문제-critical)
2. [교리 준수 위반 사항](#2-교리-v20-준수-위반-사항)
3. [기능 간 간섭 및 상태 충돌](#3-기능-간-간섭-및-상태-충돌)
4. [미묘한 버그 및 엣지 케이스](#4-미묘한-버그-및-엣지-케이스)
5. [코드 중복 분석](#5-코드-중복-분석)
6. [각 문제별 개선 방안 + 잠재 리스크 3중 검증](#6-각-문제별-개선-방안--잠재-리스크-3중-검증)

---

## 1. 치명적 문제 (CRITICAL)

### CRIT-01: `/api/admin/*` API 라우트 인증 부재

**위치**: `proxy.ts` (미들웨어)
**문제**: `/admin/*` 페이지만 세션 검증. `/api/admin/*` API는 인증 없이 통과.
**영향**: URL만 알면 누구나 주문/정산/SMS/파일삭제 등 모든 admin API 접근 가능.

### CRIT-02: 정산 이중 실행 (Double Settlement)

**위치**: `app/api/settlement/generate/route.ts:66-146`
**문제**: `settlement_status='pending'`인 sold_items를 읽고 → 계산 → `'settled'`로 업데이트하는 과정이 비원자적. 더블클릭이나 동시 호출 시 같은 sold_items가 2개의 settlements에 포함되어 이중 정산.
**영향**: 판매자에게 이중 지급 — 금전적 손실.

### CRIT-03: 사진 업로드 Path Traversal

**위치**: `app/api/admin/photos/upload/route.ts:42-65`
**문제**: `productId`와 `file.name`이 검증 없이 `path.join()`에 직접 사용. `productId=../../etc` 등으로 서버 파일시스템 임의 위치에 파일 쓰기 가능.
**영향**: 서버 장악 가능한 보안 취약점.

### CRIT-04: 두 개의 병렬 정산 파이프라인

**문제**: 구 파이프라인(`sold_items` 기반)과 신 파이프라인(`sales_records` + `settlement_queue` 기반)이 동일 데이터에 대해 독립적으로 동작.
- `sale-detector.ts`가 `st_products.sold_at` 기록 (신 파이프라인)
- `generate/route.ts`가 `sold_items.settlement_status` 기록 (구 파이프라인)
- 두 파이프라인 간 연결이 없어 동일 매출에 대해 각각 정산 가능 → 이중 지급

### CRIT-05: `ConsignmentStatus` 타입 불완전 정의

**위치**: `app/api/admin/consignments/route.ts:14`
**문제**: `type ConsignmentStatus = 'pending' | 'approved' | 'rejected'` — 7개 상태 중 3개만 정의. DB에는 7개 상태가 존재하는데 타입이 3개만 허용.
**영향**: TypeScript가 잘못된 상태 전환을 잡지 못함. 타입 안전성 완전 상실.

---

## 2. 교리 v2.0 준수 위반 사항

### 2-A. 파일 상단 주석 (WHY/HOW/WHERE) 누락

**교리 규정**: 모든 파일에 `/** [파일 목적] WHY: HOW: WHERE: */` 필수

**누락 파일 (총 ~40개)**:

| 디렉토리 | 누락 파일 수 | 대표 파일 |
|---------|------------|---------|
| `app/` (페이지/컴포넌트) | 26개 | `layout.tsx`, `error.tsx`, `admin/login/page.tsx`, `admin/sales/page.tsx` 등 |
| `app/api/` (라우트) | 8개 | `admin/auth/logout/route.ts`, `admin/notifications/*.ts`, `orders/[productId]/hold/route.ts` 등 |
| `lib/` | 14개 | `price-lookup.ts`, `brand-search.ts`, `courier/*.ts`, `notification/*.ts` 등 |
| `components/` | 1개 | `DaumAddressSearch.tsx` |

### 2-B. 코드 길이 제한 위반 (100줄 초과)

**교리 규정**: 함수/컴포넌트/API 핸들러 100줄 이내 (예외: 타입/설정 200줄)

**위반 파일 (35+건)**:

| 파일 | 라인수 | 핵심 위반 |
|------|-------|---------|
| `app/api/admin/consignments/[id]/route.ts` | 496 | PATCH 핸들러만 ~380줄 |
| `app/admin/settlement/workflow/hooks/useWorkflowHandlers.ts` | 418 | 단일 훅 |
| `app/admin/orders/components/MeasurementStep.tsx` | 375 | 단일 컴포넌트 |
| `app/admin/consignments/route.ts` | 357 | GET ~150줄, POST ~130줄 |
| `app/admin/photos/components/ClassifyMatchModal.tsx` | 342 | SSE + 상태머신 |
| `app/admin/settlement/workflow/components/steps/ManualMatchPanel.tsx` | 344 | 단일 컴포넌트 |
| `lib/settlement/product-matcher.ts` | 313 | 매칭 함수 |
| `app/api/settlement/queue-settlements/route.ts` | 289 | POST ~145줄, GET ~55줄 |
| `app/admin/orders/components/InspectionModal.tsx` | 273 | 단일 컴포넌트 |
| `app/admin/orders/components/OrdersTable.tsx` | 268 | 단일 컴포넌트 |
| `lib/photo-classifier.ts` | 269 | 분류 함수 |
| `lib/measurement-card.ts` | 260 | 카드 생성 |
| `app/api/settlement/review-report/route.ts` | 257 | GET ~230줄 |
| `app/admin/consignments/hooks/useConsignmentHandlers.ts` | 240 | 핸들러 훅 |
| `app/api/settlement/generate-payout/route.ts` | 230 | POST ~120줄, GET ~90줄 |

### 2-C. 에러 응답 형태 불일치

**교리 규정**: `{ success: false, error: msg }` + `console.error('[api-name] 실패:', msg)`

**위반 현황**:

| 위반 유형 | 건수 |
|---------|-----|
| `{ error }` 형태 사용 (교리 위반) | 44개 라우트 |
| `{ success: false, error }` 교리 준수 | 6개 라우트만 |
| `catch` 블록에 `console.error` 없음 | 30+ 라우트 |
| `try/catch` 자체가 없음 | 9개 라우트 |

**try/catch 없는 라우트 (9개)**:
- `admin/notifications/send-sms/route.ts`
- `admin/notifications/bulk-send/route.ts`
- `admin/notifications/resend/route.ts`
- `admin/notifications/route.ts`
- `admin/sellers/for-notification/route.ts`
- `admin/auth/logout/route.ts`
- `admin/orders/route.ts` (GET)
- `orders/[productId]/hold/route.ts` (GET)
- `admin/consignments/return-shipment/route.ts`

### 2-D. 로깅 규칙 위반

**교리 규정**: `[api-name] 시작` / `[api-name] 완료` / `[api-name] 실패:` 형식

| 위반 유형 | 건수 |
|---------|-----|
| 로깅 전혀 없음 | 23개 라우트 |
| `[api-name]` 접두사 누락 | 3+ 라우트 |
| `시작`/`완료` 중 하나만 있음 | 6+ 라우트 |

### 2-E. `any` 타입 및 타입 우회

**교리 규정**: `any` 사용 금지, 명시적 타입 선언

| 유형 | 건수 | 위치 |
|------|-----|------|
| 직접 `any` 사용 | 3건 | `bulk-export-naver/route.ts:94-95` |
| `as unknown` 캐스팅 | 10건 | `settlement/*.ts`, `notification/index.ts`, `consignment/adjust/` 등 |
| `as string` 강제 캐스팅 | 12건 | `queue-settlements/route.ts` 집중 |

**근본 원인**: Supabase JS 클라이언트가 JOIN 결과의 관계 컬럼 타입을 추론하지 못함. `supabase gen types` 실행으로 해결 가능.

### 2-F. `lib/api` 유틸 미사용

**교리 정신 위반**: 중복 제거 + 일관성

- `lib/api/response.ts` — `errorResponse()`, `successResponse()` 존재하나 거의 모든 라우트에서 미사용
- `lib/api/client.ts` — 타임아웃, Sentry, 타입 응답 처리 포함하나 프론트엔드에서 단 한 번도 사용 안 됨

---

## 3. 기능 간 간섭 및 상태 충돌

### INT-01: `sellers` 테이블 — 엑셀 업로드 시 이름 덮어쓰기 충돌

**위치**: `app/api/admin/consignments/route.ts:259-263`
**문제**: 위탁 엑셀 업로드 시 판매자 이름을 DB에서 직접 UPDATE. 정산 워크플로가 동시 실행 중이면 `matchSellerByName()`이 이전 이름으로 매칭 중인데 DB의 이름이 바뀜.
**영향**: 정산 매칭 실패 → 수동 매칭 작업 증가.

### INT-02: `sellers` 테이블 — seller_code 레이스 컨디션

**위치**: `app/api/admin/consignments/route.ts:151, 165-170`
**문제**: `sellerSeq = sellerList.length`로 초기화 → 순차 증가. 동시 엑셀 업로드 시 같은 seq에서 시작하여 중복 `seller_code` 생성.
**영향**: 판매자 코드 중복 → 정산 매칭 혼선.

### INT-03: `st_products` — `sold_at` vs `is_active` 비일관

**위치**: `lib/settlement/sale-detector.ts:103-111`, `app/api/admin/products/route.ts:45-71`
**문제**: `sale-detector`가 `sold_at`을 기록하지만 `is_active`는 변경하지 않음. 상품 목록의 요약 카운트가 `is_active=false`를 'inactive'로, `sold_at`이 있으면 'sold'로 분류하는데, `is_active=true AND sold_at IS NOT NULL`인 상품은 양쪽 카운트 모두에서 빠짐.
**영향**: 대시보드 통계 부정확.

### INT-04: `st_products` — `photo_status` 동시 쓰기 충돌

**위치**: `app/api/admin/photos/link-to-product/route.ts:48`, `PATCH /api/admin/products`
**문제**: `link-to-product`가 `photo_status: 'completed'`로 설정하는 동시에 관리자가 수동으로 `photo_status: 'pending'`으로 재설정하면 최종 값은 HTTP 요청 순서에 의존.
**영향**: 사진 상태 비일관.

### INT-05: `upload-confirm` — 정산 후 가격 변경

**위치**: `app/api/settlement/upload-confirm/route.ts:69`
**문제**: 정산 생성(`generate`) 후 `upload-confirm`으로 `sale_price` 업데이트 시, 이미 생성된 settlement 레코드의 `total_sales`는 구 가격 기반. 재계산/무효화 메커니즘 없음.
**영향**: 정산 금액 오류 — 금전적 손실 가능.

### INT-06: 위탁 완료 시 `seller_type` 하드코딩

**위치**: `app/api/admin/consignments/[id]/route.ts:306`
**문제**: 위탁 완료 → 주문 자동 생성 시 `seller_type: 'general'`로 하드코딩. 실제 판매자가 `employee` 또는 `vip`여도 무시.
**영향**: 하류 코드가 `seller_type`으로 분기할 경우 잘못된 처리.

### INT-07: SMS `paidMessage` 템플릿 미사용

**위치**: `lib/notification/templates.ts:74-81`
**문제**: `paidMessage` 템플릿 존재하나 어떤 라우트에서도 트리거하지 않음. `generate-payout`는 `queue_status: 'confirmed'`로만 업데이트 (`'paid'`가 아님).
**영향**: 판매자에게 정산 지급 알림이 안 감.

### INT-08: 커미션 레이트 5곳 분산 정의

| 위치 | 값 | 사용 여부 |
|------|---|---------|
| `lib/settlement/types.ts:20-24` COMMISSION_RATES | general 0.25, employee/vip 0.20 | **미사용 (orphaned)** |
| `app/admin/orders/types.ts:104-108` DEFAULT_COMMISSION_RATES | 동일 | **미사용 (orphaned)** |
| `settlement-calculator.ts:63` | DB에서 읽음 | 사용 |
| `queue-settlements/route.ts:133` 폴백 | 0.25 하드코딩 | 사용 |
| `admin/consignments/route.ts:244` 신규 판매자 | 0.20 하드코딩 | 사용 |

**충돌**: 자동생성된 판매자는 0.20(20%)인데, `COMMISSION_RATES.general`은 0.25(25%). 상수 파일의 값이 실제 동작과 불일치.

### INT-09: 카테고리 추론 로직 3곳 독립 구현

| 위치 | 함수 | 'blazer' 매핑 |
|------|------|-------------|
| `consignments/[id]/route.ts:46-79` | `inferCategory()` | → `'blazer'` |
| `photos/match/services/scoreCalculator.ts:139-170` | `inferCategoryFromModel()` | → `normCategory('blazer')` → `'outer'` |
| `lib/photo-classifier.ts:18-30` | `classifyCategory()` | → `'outer'` |

**충돌**: 위탁 완료 시 `st_products.category = 'blazer'`로 저장되나, 사진 매칭 시 `normCategory`로 정규화. 현재는 `normCategory`가 커버하지만 새 카테고리 추가 시 불일치 발생 위험.

### INT-10: 브랜드 정규화 5곳 독립 구현

| 위치 | 맵 이름 | 엔트리 수 |
|------|--------|---------|
| `lib/brand-aliases.ts` | BRAND_ALIASES | 50+ |
| `lib/brand-search.ts` | ALIAS_MAP | 100+ |
| `lib/catalog/brand-normalizer.ts` | (brand-search.ts 위임) | — |
| `photos/match/services/scoreCalculator.ts` | BRAND_ALIASES (로컬) | 12 |
| `lib/settlement/product-matcher.ts` | BRAND_MAP (로컬) | 12 |

**충돌**: `product-matcher.ts`는 `'드레익스' → "drake's"`를 알지만 `scoreCalculator.ts`의 로컬 맵은 한국어 변형을 모름.

### INT-11: 전화번호 정규화 2개 구현

- `lib/settlement/phone-normalizer.ts`: 네이버 0-접두사 탈락 처리 포함 (정교)
- `lib/settlement/seller-matcher.ts:98`: 단순 digits-only (0-접두사 미처리)

**충돌**: `seller-matcher`에서 전화번호 매칭 시 `'1012345678'` ≠ `'01012345678'` → 매칭 실패.

---

## 4. 미묘한 버그 및 엣지 케이스

### BUG-01: UTC/로컬 타임존 혼용 — 정산 기간 오류

**위치**: `lib/settlement/helpers.ts:85-99, 116-142`
**문제**:
- `getNextBusinessDay()`: `result.getDay()` (로컬) vs `result.setUTCDate()` (UTC) 혼용
- `getSettlementPeriod()`: `today.getDay()` (로컬) vs `today.getUTCDate()` (UTC) 혼용
**영향**: KST(UTC+9) 서버에서 자정 전후로 정산 기간이 하루 어긋남 → 정산 금액 오류.

### BUG-02: 엑셀 파서 — `sale_price: 0` 사일런트 처리

**위치**: `lib/settlement/sales-parser.ts:95-101`, `confirm-parser.ts:111-117`
**문제**: 엑셀 셀에 `#VALUE!`, `#N/A!` 등 수식 오류가 있으면 `parseSalePrice`가 `0`을 반환. 오류 없이 `sold_items`에 `sale_price: 0`으로 입력.
**영향**: 0원 매출로 정산 계산 → 커미션도 0원 → 판매자에게 전액 지급.

### BUG-03: `toStr()` — 숫자 0을 null로 변환

**위치**: `lib/settlement/naver-settle-parser.ts:82-85`, `sales-ledger-parser.ts:81-84`
**문제**: `String(0).trim()` = `"0"`, JS에서 `"0" || null` = `null`. `product_order_no`가 0이면 행이 스킵됨.
**영향**: 유효한 정산 데이터 누락.

### BUG-04: 하드코딩된 연도 2026

**위치**: `lib/settlement/sales-ledger-parser.ts:58`
**문제**: `sheetNameToDate(name, year = 2026)` — 2027년에도 2026으로 처리.
**참고**: 상위 호출부 `parseSalesLedgerSheet`에서 `year ?? new Date().getFullYear()`로 보정하고 있으나, 함수 직접 호출 시 트랩.

### BUG-05: `updatedCount` — 실제 업데이트가 아닌 시도 횟수

**위치**: `app/api/settlement/upload-confirm/route.ts:60-78`
**문제**: Supabase `.update().eq()`가 0행 매칭해도 `error: null` 반환. `updatedCount++` 실행되어 "N건 업데이트" 메시지가 실제 반영 건수와 다름.
**영향**: 관리자에게 잘못된 확인 정보 제공.

### BUG-06: sale-detector — DB 업데이트 실패 후 SMS 발송

**위치**: `lib/settlement/sale-detector.ts:103-123`
**문제**: `st_products` UPDATE 에러 체크 없이 `result.matched++` 증가 + SMS 발송. DB 업데이트 실패해도 판매자에게 "판매 완료" SMS가 감.
**영향**: 판매자가 판매되지 않은 상품에 대해 정산을 기대.

### BUG-07: product-matcher Step 2-B — 0.3 임계값으로 auto_matched

**위치**: `lib/settlement/product-matcher.ts:252-273`
**문제**: 동명이인 매칭에서 상품명 유사도 0.3(30%)만 넘으면 `auto_matched` 처리. 메인 매칭의 `THRESHOLD_AUTO = 0.85`와 불일치.
**영향**: 잘못된 자동 매칭 → 정산 오류.

### BUG-08: 날짜 문자열 검증 없이 DB 저장

**위치**: `lib/settlement/helpers.ts:34-49`
**문제**: `cellToDateString`이 인식 못하는 형식(`"2026년 2월 4일"`, `"2/4"`)을 원본 그대로 반환. 이 문자열이 DB에 저장되면 이후 `new Date(dateStr + 'T00:00:00Z')`에서 `Invalid Date` 발생.
**영향**: 정산 기간 필터링에서 해당 행이 누락.

### BUG-09: 날짜 정규식 — 유효하지 않은 날짜 허용

**위치**: `lib/settlement/naver-settle-parser.ts:65-70`
**문제**: `2026.13.45` → `"2026-13-45"` 생성. 월/일 범위 체크 없음.
**영향**: PostgreSQL DATE 컬럼 저장 시 오류 또는 비정상 날짜.

### BUG-10: 부동소수점 정산 금액 누적 오차

**위치**: `lib/settlement/settlement-calculator.ts:64-71`
**문제**: `totalSales += effectivePrice` 부동소수점 누적. `settlementAmount = totalSales - commissionAmount`에서 `225000.0000000003` 같은 비정수 금액 발생 가능.
**영향**: 엑셀 정산서에 소수점 금액 노출.

### BUG-11: `list/route.ts` — NaN 페이지네이션

**위치**: `app/api/settlement/list/route.ts:41-42`
**문제**: `pageSize=abc` → `Number("abc")` = `NaN` → `Math.min(100, NaN)` = `NaN` → Supabase `range(NaN, NaN)`.
**영향**: 예상치 못한 쿼리 결과 또는 에러.

### BUG-12: `useAdjustment` — AbortController 없음

**위치**: `app/consignment/adjust/[token]/hooks/useAdjustment.ts:17-29`
**문제**: 다른 모든 데이터 페칭 훅은 AbortController를 사용하지만 이 훅만 누락. 컴포넌트 언마운트 후 상태 업데이트 시도.
**영향**: React 메모리 릭 경고, Strict Mode에서 이중 fetch.

### BUG-13: `useNotificationHistory` — AbortController 없음 + 디바운스 미정리

**위치**: `app/admin/notifications/hooks/useNotificationHistory.ts:31-56`
**문제**: 필터 변경 시 동시 다발 fetch. 마지막 응답이 아닌 가장 느린 응답이 최종 데이터. 디바운스 타이머 언마운트 시 미정리.
**영향**: 검색/필터 시 잘못된 데이터 표시.

### BUG-14: 주문번호 랜덤 충돌

**위치**: `app/api/admin/orders/route.ts:95-97`, `consignments/[id]/route.ts:272-274`
**문제**: `Math.random() * 1000000`으로 6자리 숫자 생성. 동일일 대량 생성 시 충돌 가능. 충돌 시 주문 생성 실패, 재시도 로직 없음.
**영향**: 위탁 완료 시 주문 생성 실패 → `console.error` 후 무시.

### BUG-15: `auto-match` — 상태 업데이트 에러 무시

**위치**: `app/api/settlement/auto-match/route.ts:118-125`
**문제**: `Promise.all([update sales_records, update naver_settlements])` 에러 미체크. match는 기록되나 원본 레코드의 `match_status`는 `'unmatched'`로 남음. 다음 실행 시 재매칭 시도 → 중복 매칭.
**영향**: 정산 중복.

### BUG-16: `generate/route.ts` — `.single()` 실패 시 사일런트 스킵

**위치**: `app/api/settlement/generate/route.ts:114-128`
**문제**: settlement INSERT 실패 시 `continue` — sold_items가 `pending` 상태로 남아 다음 주에 재포함.
**영향**: 반복적인 정산 시도, 혼란.

---

## 5. 코드 중복 분석

### DUP-01: 모달 오버레이 스캐폴드 (11개 파일, ~20줄씩)

`ModalLayout.tsx`가 이미 존재하지만 `InspectionModal`, `HoldModal`, `ManualSendModal` 등이 각자 독립 구현.
- 이미 분기됨: `rgba(0,0,0,0.5)` vs `0.4` vs `0.8`

### DUP-02: StatusBadge 4개 독립 구현

| 파일 | 스타일 방식 |
|------|----------|
| `admin/components/StatusBadge.tsx` | Tailwind |
| `OrdersTable.tsx` 내부 | inline style |
| `ConsignmentTable.tsx` 내부 | inline style |
| `notifications/components/shared.tsx` 내부 | inline style |

### DUP-03: 에러 응답 패턴 32회 복붙

`lib/api/response.ts::errorResponse()` 존재하나 21개 파일 32곳에서 수동 복붙. 응답 형태도 불일치 (`{ error }` vs `{ success: false, error }`).

### DUP-04: InspectionModal ↔ HoldModal ~80줄 중복

동일한 state, handler, modal shell, 가격 파싱 로직. 핵심 차이는 `isHoldMode` 플래그 하나.

### DUP-05: 사진 업로드 블록 — 같은 파일 내 2회 복붙

`useConsignmentHandlers.ts:86-97` = `useConsignmentHandlers.ts:128-137` (character-for-character 동일)

### DUP-06: `formatCurrency()` 3곳 중복 정의

`HistoryComponents.tsx`, `settlement/page.tsx`, `SellerModal.tsx`

### DUP-07: `parseInt(customPrice.replace(/,/g, ''), 10)` 6곳

`InspectionModal`, `HoldModal`, `PriceAdjustmentSection`, `useOrderHandlers`

### DUP-08: 주문번호 생성 로직 2곳

`admin/orders/route.ts`, `consignments/[id]/route.ts`

### DUP-09: 골드 그래디언트 버튼 스타일 2곳

`OrderFilters.tsx`, `ConsignmentFilters.tsx`: `linear-gradient(135deg, #c9a96e, #a07840)`

### DUP-10: inline style vs Tailwind 혼재

- inline `style={}`: **1,061회** (78개 파일)
- Tailwind `className=`: **154회** (24개 파일)

---

## 6. 각 문제별 개선 방안 + 잠재 리스크 3중 검증

### 개선안 1: API 인증 통합 (CRIT-01)

**수정 방법**: `proxy.ts`에서 `/api/admin/*` 경로도 세션 검증 추가.

```
AS-IS: /api/admin/* → rate limit만 → 통과
TO-BE: /api/admin/* → rate limit → 세션 검증 → 통과/거부
```

**3중 잠재 리스크 검증**:

1. **리스크 1 — 기존 클라이언트 호환**: 프론트엔드 fetch 호출이 쿠키를 자동 전송하는지 확인 필요. `fetch('/api/admin/...')`는 same-origin이므로 쿠키 자동 포함. `credentials: 'include'`가 없어도 same-origin 기본값. → **안전**

2. **리스크 2 — Public API 분리**: `/api/consignment/adjust/[token]`과 `/api/orders/[productId]/hold`는 public이므로 인증 제외해야 함. 현재 이 경로는 `/api/admin/` 하위가 아니므로 → **안전**. 단, 미래에 `/api/admin/` 하위로 이동하면 문제.

3. **리스크 3 — Edge Runtime 제약**: `proxy.ts`는 Edge Runtime. `verifySession`이 `crypto.subtle`(Web Crypto API) 대신 Node `crypto`를 사용하는지 확인. 현재 `lib/auth.ts`는 `node:crypto`의 `createHmac` + `timingSafeEqual` 사용. Edge에서 Node crypto가 지원되는지는 Next.js 버전 의존. Next.js 16은 Edge에서 Node crypto polyfill 제공 → **주의 필요, 테스트 필수**

---

### 개선안 2: 정산 이중 실행 방지 (CRIT-02)

**수정 방법 A**: Supabase RPC로 원자적 정산 생성.
```sql
CREATE FUNCTION generate_settlement(seller_id uuid, items uuid[])
RETURNS uuid AS $$
BEGIN
  -- 트랜잭션 내에서:
  -- 1. sold_items 잠금 (FOR UPDATE)
  -- 2. settlement INSERT
  -- 3. settlement_items INSERT
  -- 4. sold_items status UPDATE
END;
$$ LANGUAGE plpgsql;
```

**수정 방법 B**: `sold_items`에 `settlement_id` FK 추가 + UNIQUE 제약.

**3중 잠재 리스크 검증**:

1. **리스크 1 — RPC 복잡도**: PostgreSQL 함수 내 에러 처리가 복잡. EXCEPTION 블록이 없으면 부분 실패 시 전체 롤백되나, 에러 메시지가 클라이언트에 전파되지 않을 수 있음. → **RPC 내에 RAISE NOTICE 포함 필수**

2. **리스크 2 — 기존 데이터 마이그레이션**: `sold_items`에 이미 중복 settlement이 있을 수 있음. UNIQUE 제약 추가 전 데이터 정리 필요. → **마이그레이션 스크립트 선행 필수**

3. **리스크 3 — 성능**: `FOR UPDATE` 잠금으로 동시 정산 요청이 직렬화. 판매자 50명 × 평균 20건 = 1000 행 잠금. 잠금 시간이 길면 타임아웃. → **판매자별 병렬 처리 + 개별 트랜잭션으로 분리**

---

### 개선안 3: Path Traversal 수정 (CRIT-03)

**수정 방법**: `path.basename()` + `startsWith()` 이중 검증.
```typescript
const safeProductId = path.basename(productId)
const productDir = path.join(ORIGINALS_DIR, safeProductId)
if (!productDir.startsWith(ORIGINALS_DIR)) throw new Error('invalid path')
const safeFileName = path.basename(file.name)
const savePath = path.join(productDir, safeFileName)
```

**3중 잠재 리스크 검증**:

1. **리스크 1 — `path.basename` 빈 문자열**: `productId = ""`이면 `path.basename("")` = `""`. `path.join(ORIGINALS_DIR, "")` = `ORIGINALS_DIR` 자체. 파일이 originals 루트에 저장됨. → **빈 문자열 체크 추가 필수**

2. **리스크 2 — 한국어/특수문자 파일명**: `file.name`에 한국어, 공백, 특수문자가 포함될 수 있음. `path.basename`은 이를 보존. 파일시스템 호환성 문제. → **영숫자+하이픈만 허용하는 sanitize 추가**

3. **리스크 3 — 심볼릭 링크**: 서버에 `ORIGINALS_DIR` 내 심볼릭 링크가 있으면 `startsWith` 검사를 우회할 수 있음. `path.resolve()` 후 `startsWith` 검사 필요. → **`fs.realpathSync`로 정규화 후 비교**

---

### 개선안 4: 에러 응답 통합 (교리 2-C)

**수정 방법**: 모든 라우트에서 `lib/api/response.ts`의 `errorResponse()` 사용 강제.

**3중 잠재 리스크 검증**:

1. **리스크 1 — 프론트엔드 호환**: 기존 프론트엔드가 `{ error }` 형태를 읽고 있음. `{ success: false, error }` 로 변경 시 프론트엔드 파싱 코드 전부 수정 필요. → **V3에서 일괄 마이그레이션 + API 클라이언트 래퍼 적용**

2. **리스크 2 — HTTP 상태 코드와 body 이중 전달**: 일부 라우트는 `status: 400`으로 명시적 에러를 반환하고 일부는 `status: 500`만 사용. 통합 시 status 코드 기준도 정리 필요. → **400 (클라이언트 오류) vs 500 (서버 오류) 명확한 기준표 필요**

3. **리스크 3 — Sentry 연동**: `errorResponse()`에 `console.error`만 있고 Sentry 캡처 없음. 에러 트래킹 누락 가능. → **Sentry `captureException()` 통합**

---

### 개선안 5: 코드 길이 100줄 제한 적용 (교리 2-B)

**수정 방법**: 496줄 `consignments/[id]/route.ts` 분리 예시:
```
consignments/[id]/
  route.ts           → 라우터 (50줄)
  handlers/
    update-status.ts → 상태 전환 핸들러 (80줄)
    complete.ts      → 완료 처리 (80줄)
    hold.ts          → 보류 처리 (60줄)
  utils/
    infer-category.ts → 카테고리 추론 (40줄)
    parse-product.ts  → 상품명 파싱 (40줄)
```

**3중 잠재 리스크 검증**:

1. **리스크 1 — 파일 수 폭증**: 35+ 위반 파일을 모두 분리하면 파일 수가 2-3배 증가. 디렉토리 탐색이 복잡해짐. → **논리적 그룹핑으로 1레벨만 분리, 과도한 중첩 방지**

2. **리스크 2 — import 순환 참조**: 분리된 파일들이 서로를 import하면 순환 참조 발생. 특히 상태 전환 로직이 공유 유틸에 의존하면서 유틸이 상태 타입을 import하는 경우. → **타입 파일을 최상위에 두고 단방향 의존성 유지**

3. **리스크 3 — 트랜잭션 경계 파편화**: 현재 하나의 핸들러 내에서 순차적으로 실행되는 DB 작업들이 여러 파일로 분산되면, 오류 발생 시 어디서 롤백해야 하는지 불명확. → **컨트롤러 패턴: route.ts가 트랜잭션 경계 관리, 분리된 함수는 순수 비즈니스 로직만**

---

### 개선안 6: 타임존 버그 수정 (BUG-01)

**수정 방법**: `helpers.ts`의 모든 날짜 연산에서 `getDay()` → `getUTCDay()` 변경.

**3중 잠재 리스크 검증**:

1. **리스크 1 — 기존 정산 데이터와의 일관성**: 지금까지 로컬 타임존으로 계산된 정산 기간과 UTC 기반 새 계산이 다를 수 있음. 전환 시점에 겹치는 정산 기간 발생 가능. → **전환일 기준 기존 데이터 검증 + 과도기 수동 확인**

2. **리스크 2 — 공휴일 목록**: 공휴일이 `YYYY-MM-DD` 형식으로 하드코딩. UTC 기준 날짜와 KST 기준 날짜가 다를 수 있는 시간대(15:00-24:00 KST). → **공휴일 비교도 UTC 기준으로 통일**

3. **리스크 3 — 테스트 환경**: CI/CD가 UTC에서 실행되면 로컬 개발(KST)과 다른 결과. → **모든 날짜 테스트에 고정 타임존 설정**

---

### 개선안 7: 프론트엔드 일관된 fetch 패턴 (BUG-12, 13)

**수정 방법**: `lib/api/client.ts` 활용 + 모든 훅에 AbortController 표준화.
```typescript
// 표준 패턴
const ac = useRef<AbortController>()
useEffect(() => {
  ac.current?.abort()
  ac.current = new AbortController()
  api.get('/api/...', { signal: ac.current.signal })
    .then(setData)
    .catch(err => err.name !== 'AbortError' && setError(err))
  return () => ac.current?.abort()
}, [deps])
```

**3중 잠재 리스크 검증**:

1. **리스크 1 — `api.get` 반환 타입**: `lib/api/client.ts`의 응답 타입이 제네릭이 아니면 각 호출부에서 타입 캐스팅 필요. → **제네릭 `api.get<T>(url): Promise<T>` 인터페이스로 개선**

2. **리스크 2 — Sentry 중복 보고**: `api/client.ts`가 Sentry에 에러를 보고하고, 호출부도 에러를 캐치하면 동일 에러가 2번 보고. → **에러 보고 위치 단일화 (클라이언트 or 호출부)**

3. **리스크 3 — SSR 호환**: Server Component에서 `api/client.ts`를 사용하면 `window`가 없어 실패. → **환경 감지 분기 또는 서버/클라이언트 별도 클라이언트 제공**

---

### 개선안 8: 중복 코드 통합 (DUP-01~10)

**수정 방법 요약**:

| 중복 | 해결 방법 |
|------|---------|
| 모달 오버레이 | `ModalLayout.tsx` 전면 채택 |
| StatusBadge | 공유 컴포넌트 통일, inline → Tailwind |
| 에러 응답 | `lib/api/response.ts` 전면 채택 |
| InspectionModal ↔ HoldModal | 단일 `ProductInspectionModal` + mode prop |
| 사진 업로드 블록 | `uploadConsignmentPhoto()` 유틸 추출 |
| formatCurrency | `lib/utils/format.ts`로 통합 |
| 주문번호 생성 | `lib/utils/id-generator.ts`로 통합 |
| inline style | Tailwind 전면 전환 |

**3중 잠재 리스크 검증**:

1. **리스크 1 — 통합 과정의 회귀 버그**: 11개 모달의 미묘한 차이(overlay 투명도, maxWidth, padding)를 하나의 컴포넌트로 통합 시 특정 모달에서 레이아웃 깨짐. → **각 모달의 현재 스타일 값을 스냅샷으로 기록 후, 통합 컴포넌트의 props로 커스터마이즈 가능하게 설계**

2. **리스크 2 — inline → Tailwind 전환 시 스타일 불일치**: 1,061개 inline style 각각이 정확한 Tailwind 유틸리티 클래스와 1:1 매핑되지 않을 수 있음 (커스텀 색상, 미세한 spacing). → **Tailwind 커스텀 테마에 브랜드 컬러/spacing 등록 후 전환**

3. **리스크 3 — 타입 통합 시 하위 호환**: `ConsignmentStatus`를 단일 소스로 통합 시, 기존에 3개 상태만 사용하던 `route.ts`에서 나머지 4개 상태 처리 로직 누락 가능. → **타입 통합과 동시에 각 소비 지점에서의 switch/if 문 완전성 검증 (TypeScript strict switch)**

---

## 전체 문제 요약

| 심각도 | 건수 | 대표 문제 |
|--------|-----|---------|
| CRITICAL | 5건 | API 인증 부재, 이중 정산, Path Traversal, 병렬 파이프라인, 타입 불완전 |
| HIGH | 16건 | 타임존 버그, sale_price 사일런트 0, DB 업데이트 미확인 SMS, 35+ 코드 길이 위반 |
| MEDIUM | 20건 | 브랜드/카테고리 중복 구현, AbortController 누락, 부동소수점, 커미션 분산 정의 |
| LOW | 10건 | 포맷 함수 중복, 골드 그래디언트 중복, ARIA 누락, 메타데이터 기본값 |

**총 발견 사항**: ~51건

---

## V3 개선 시 우선순위

1. **보안** (CRIT-01, 03): API 인증 + Path Traversal → 즉시
2. **금전적 정확성** (CRIT-02, 04, INT-05, BUG-01, 02, 10): 정산 원자성 + 타임존 + 파서 → 최우선
3. **교리 준수 인프라** (2-A~F): 파일 헤더, 에러 처리 통합, 로깅, 타입 → 기반 작업
4. **코드 품질** (DUP-01~10, 2-B): 중복 제거, 100줄 제한, 스타일 통일 → 점진적
5. **프론트엔드** (BUG-12~13, DUP-01~04): AbortController, 모달 통합, Server Component → 점진적

---

*이 보고서는 코드를 수정하지 않고 조사만 수행한 결과입니다.*
*V3 구현 시 각 개선안의 3중 잠재 리스크를 반드시 고려하여 진행해야 합니다.*
