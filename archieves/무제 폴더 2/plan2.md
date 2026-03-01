# Classic Menswear V3 — 실제 코드베이스 기반 구현 계획 (Plan 2)

**작성일**: 2026-03-01
**근거**: V2 소스코드 전수 읽기 + 4차 리서치 보고서 (v2reserch1~v4reserch4)
**V2 위치**: `/Users/jeongmyeongcheol/classic-menswear-v2/`
**V3 위치**: `/Users/jeongmyeongcheol/tf-v3/`
**교리**: 클로드코드교리 v2.0

---

## 1. V2 실제 코드베이스 요약

### 1.1 규모

| 항목 | 수량 |
|------|------|
| TypeScript/TSX 파일 | 180+ |
| API 라우트 (route.ts) | 57개 엔드포인트 |
| 프론트엔드 컴포넌트 | 64개 |
| 커스텀 훅 | 17개 |
| lib 모듈 | 47개 |
| 타입 정의 파일 | 12개 |
| 어드민 페이지 | 15개 |
| DB 테이블 | 14개 (활성) |
| DB 마이그레이션 | 21개 |

### 1.2 핵심 의존성 (package.json)

| 패키지 | 버전 | 용도 |
|--------|------|------|
| next | 16.1.6 | 프레임워크 |
| react / react-dom | 19.2.3 | UI |
| @supabase/supabase-js | 2.95.3 | DB |
| @supabase/ssr | 0.8.0 | SSR 쿠키 |
| @anthropic-ai/sdk | 0.74.0 | AI 분류/매칭 |
| sharp | 0.34.5 | 이미지 처리 |
| @imgly/background-removal-node | 1.4.5 | 배경 제거 |
| solapi | 5.5.4 | SMS (한국) |
| xlsx | 0.18.5 | 엑셀 파싱 |
| puppeteer | 24.37.3 | 측정카드 |
| recharts | 3.7.0 | 차트 |
| @upstash/ratelimit | 2.0.8 | Rate Limiting |
| @sentry/nextjs | 10.39.0 | 에러 추적 |

### 1.3 V2 디렉토리 구조 (핵심)

```
classic-menswear-v2/
├── proxy.ts                 ← 미들웨어 (미작동 — 파일명/함수명 불일치)
├── app/
│   ├── admin/
│   │   ├── components/      ← 공유 UI (AdminLayout, Sidebar, StatCard, StatusBadge, TableShell)
│   │   ├── consignments/    ← 위탁 (page + hooks 4개 + components 12개)
│   │   ├── orders/          ← 주문 (page + hooks 2개 + components 8개)
│   │   ├── photos/          ← 사진 (page + components 10개)
│   │   ├── settlement/      ← 정산 (page + workflow/ + hooks 2개 + components 16개)
│   │   ├── sales/           ← 매출 (page + chart + erp/ledger 하위페이지)
│   │   ├── notifications/   ← 알림 (page + hooks 2개 + components 5개)
│   │   ├── database/        ← 시세 (page + hooks 2개 + components 3개)
│   │   ├── products/        ← 상품 (page)
│   │   └── login/           ← 로그인 (page)
│   ├── api/
│   │   ├── admin/           ← 관리자 API 32개 엔드포인트
│   │   ├── settlement/      ← 정산 API 18개 엔드포인트
│   │   ├── consignment/     ← 공개 위탁 API 3개
│   │   ├── orders/          ← 공개 주문 API 1개
│   │   ├── storage/         ← 파일 서빙 1개
│   │   ├── health/          ← 헬스체크 1개
│   │   └── ready/           ← 레디체크 1개
│   └── consignment/adjust/  ← 판매자용 가격조정 페이지
├── lib/
│   ├── auth.ts              ← HMAC 세션 (110줄)
│   ├── env.ts               ← 환경변수 검증 (34줄)
│   ├── ratelimit.ts         ← Upstash Rate Limiting (70줄)
│   ├── settlement/          ← 정산 모듈 14개 파일
│   ├── notification/        ← 알림 모듈 3개 파일
│   ├── photo-classify/      ← AI 분류 7개 파일
│   ├── courier/             ← 배송 4개 파일
│   ├── api/                 ← API 유틸 2개 (response.ts, client.ts)
│   ├── supabase/            ← Supabase 클라이언트 2개 (admin.ts, client.ts)
│   └── (기타)               ← brand-search, photo-editor, measurement-card 등
└── supabase/migrations/     ← 21개 SQL 마이그레이션
```

---

## 2. V2 실제 DB 스키마

### 2.1 테이블 목록 (14개 활성)

| 테이블 | 용도 | 주요 컬럼 | 비고 |
|--------|------|----------|------|
| **sellers** | 위탁 판매자 | id, name, phone, seller_code, commission_rate, tier | 사전 존재, phone UNIQUE 없음 |
| **consignment_requests** | 위탁 신청 | id, seller_id, product_name, desired_price, status, adjustment_token | 7단계 상태 머신 |
| **st_products** | 스마트스토어 상품 | id, product_number, brand, category, size, color, photos(JSONB), sold_at, photo_status | 사전 존재, 22개 ALTER 추가 |
| **orders** | 주문 | id, order_number(UNIQUE), status, customer_name, phone | 8단계 상태 머신 |
| **order_items** | 주문 상품 | id, order_id(FK), product_number(UNIQUE), brand, condition, measurements(JSONB) | CASCADE 삭제 |
| **sales_records** | 매출 레코드 | id, sale_date, naver_order_no, buyer_name, product_name, match_status | UNIQUE dedup 인덱스 |
| **naver_settlements** | 네이버 구매확정 | id, product_order_no, buyer_name, settle_amount, match_status | UNIQUE dedup 인덱스 |
| **settlement_matches** | 매출↔정산 매칭 | id, sales_record_id(FK,UNIQUE), naver_settlement_id(FK,UNIQUE), match_type, match_score | 1:1 보장 |
| **settlement_queue** | 정산 대기 큐 | id, match_id(FK), seller_id(FK), commission_rate, payout_amount, queue_status | match_id UNIQUE **없음** |
| **settlements** | 정산 결과 | id, seller_id, period, total_sales, commission_amount, settlement_amount | 사전 존재 (구 파이프라인) |
| **notification_logs** | 알림 이력 | id, consignment_id(FK), seller_id(FK), phone, message, status, api_response(JSONB) | — |
| **return_shipments** | 반품 택배 | id, consignment_id(FK), tracking_number, status | consignment_id UNIQUE **없음** |
| **market_prices** | 시장 시세 | id, brand, name, price, source, crawled_at | RLS 활성 |
| **settlement_audit_log** | 감사 로그 | id, action, entity_type, entity_id, old_value, new_value | — |
| **price_estimate_cache** | 가격 추정 캐시 | id, cache_key(UNIQUE), brand, product_name, retail_price | 7일 TTL |

### 2.2 누락 UNIQUE 제약 (V3 마이그레이션 필수)

| 테이블.컬럼 | 현재 | 필요 | 이유 |
|-------------|------|------|------|
| sellers.phone | 없음 | UNIQUE | 동일 전화번호 판매자 중복 생성 방지 |
| sellers.seller_code | 없음 | UNIQUE | NF001 등 코드 충돌 방지 |
| settlement_queue.match_id | 없음 | UNIQUE | 이중 정산 큐 등록 방지 (FINANCIAL) |
| return_shipments.consignment_id | 없음 | UNIQUE | 이중 반품 접수 방지 |
| st_products.product_number | 없음 | UNIQUE | 상품번호 충돌 방지 |

### 2.3 필요 RPC 함수 (Supabase)

| RPC | 용도 | 원자성 보장 대상 |
|-----|------|----------------|
| `create_order_with_items` | 주문+아이템 원자적 생성 | orders + order_items |
| `complete_consignment` | 위탁완료 원자적 처리 | st_products + orders + order_items + consignment_requests |
| `create_settlement_queue_batch` | 정산큐 배치 등록 | settlement_queue (FOR UPDATE 잠금) |

### 2.4 상태 머신 (실제 DB CHECK 제약 기준)

**consignment_requests.status** (7값):
```
pending → inspecting → approved → received → completed
                    ↘ on_hold → inspecting
                    ↘ rejected
```

**orders.status** (8값):
```
APPLIED → SHIPPING → COLLECTED → INSPECTED → PRICE_ADJUSTING → RE_INSPECTED → IMAGE_PREPARING → IMAGE_COMPLETE
```

**settlement_queue.queue_status** (3값):
```
pending → confirmed → paid
```

**return_shipments.status** (6값):
```
pending → requested → in_transit → delivered
       ↘ manual ↗
       ↘ failed
```

---

## 3. 문제 인벤토리 (4차 리서치 통합, 실제 코드 검증)

### 3.1 CRITICAL (10건)

| # | 문제 | V2 실제 파일 | 검증 결과 |
|---|------|-------------|----------|
| C1 | 미들웨어 미작동 → 전체 인증 무효 | `proxy.ts` (함수명 `proxy()`, 파일명 `proxy.ts`) | **확인됨**: Next.js는 `middleware.ts` + `middleware()` 요구. `.next/middleware-manifest.json`이 비어있음 |
| C2 | 정산 이중 실행 (더블클릭) | `settlement/generate/route.ts:66-147` | **확인됨**: sold_items SELECT→계산→UPDATE 비원자적, `disabled={loading}` 프론트엔드 가드만 존재 |
| C3 | 사진 Path Traversal | `photos/upload/route.ts:42,64` | **확인됨**: `productId`, `file.name` 미검증 직접 `path.join()` |
| C4 | 구/신 정산 파이프라인 병존 | A: `settlement/generate` + B: `settlement/queue-settlements` | **확인됨**: 두 파이프라인이 공유 코드 0, sellers 테이블만 공유 |
| C5 | PostgREST 필터 인젝션 (4곳) | `products/route.ts:57`, `orders/search:106`, `notifications:40`, `manual-match:39` | **확인됨**: `.or()` 문자열 보간으로 사용자 입력 직접 삽입 |
| C6 | 환경변수 미설정 시 인증 우회 | `admin/auth/login/route.ts:27` | **확인됨**: `ADMIN_ID`/`ADMIN_PASSWORD` undefined일 때 `undefined === undefined` → 로그인 성공 |
| C7 | 1000행 사일런트 절삭 | `admin/orders GET`, `settlement/sellers GET` 등 | **확인됨**: Supabase 기본 1000행 제한, `.range()` 미적용 |
| C8 | settlement_queue.match_id UNIQUE 없음 | `supabase/migrations/` 전수 확인 | **확인됨**: match_id에 FK만 있고 UNIQUE 제약 없음 → 이중 큐 등록 가능 |
| C9 | 경로 탐색 (upload-photo) | `consignments/upload-photo/route.ts:37` | **확인됨**: consignmentId 미검증 |
| C10 | `req.json()` PUBLIC 엔드포인트 크래시 (4건) | `adjust/[token]:65`, `return:18`, `login:27`, `hold:48` | **확인됨**: malformed JSON → SyntaxError → 500 |

### 3.2 HIGH (55건 → 주요 20건 선별)

| # | 문제 | V2 위치 | 영향 |
|---|------|---------|------|
| H1 | Stuck-Consignment 버그 | `consignments/[id]/route.ts:237-343` | Step5 실패 시 product_number 점유 → 영구 복구 불가 |
| H2 | 정산 후 가격 변경 미반영 | `upload-confirm/route.ts:69` | settlement 금액 재계산 메커니즘 없음 |
| H3 | 로컬 파일시스템 사진 소실 | `photos/upload:72`, `storage/[...path]` | Vercel 배포 시 사진 전부 소실 (프로덕션 버그) |
| H4 | 커미션 5곳 분산 (0.20 vs 0.25 충돌) | `settlement/types:20`, `queue-settlements:133`, `consignments:244` | 판매자 5% 과징수 가능 |
| H5 | 판매자코드 동시성 중복 | `consignments/route.ts:152-168` | `sellerSeq = sellerList.length` 인메모리 카운터 |
| H6 | 판매자 전화번호 중복 생성 | `consignments/route.ts:233-258` | sellers.phone UNIQUE 없음 |
| H7 | Promise.all 결과 미확인 (3곳) | `auto-match:118`, `manual-match:62`, `generate:134` | match_status 불일치 |
| H8 | sale-detector DB 실패 후 SMS 발송 | `sale-detector.ts:103-111` | st_products UPDATE 에러 미확인 → 판매자 오인 |
| H9 | try/catch 없는 핸들러 8개 | `send-sms`, `resend`, `orders GET/POST/PATCH`, `consignments/[id]`, `return-shipment`, `login` | DB/외부 서비스 에러 → raw 500 |
| H10 | .in() 100개 제한 미처리 | `bulk-send`, `upload-naver-settle`, `queue-settlements`, `generate-payout` | 100개 초과 ID → 실패 |
| H11 | 네이버 정산 업로드 시 기존 데이터 삭제 | `upload-naver-settle/route.ts:36-39` | DELETE .eq('match_status','unmatched') → 동시 업로드 시 데이터 소실 |
| H12 | 파일 크기 미검증 (Excel 3곳) | `upload-sales:32`, `upload-confirm:37`, `upload-naver-settle:21` | 1GB 파일 → OOM |
| H13 | 컬럼 인덱스 하드코딩 | `naver-settle-parser`, `sales-parser` | `raw[0]`, `raw[19]` — 포맷 변경 시 사일런트 데이터 손상 |
| H14 | 대용량 Excel 타임아웃 | `consignments POST:146-310` | 행당 2-3 DB 호출 → 200행 = 600 라운드트립 |
| H15 | UTC/KST 혼용 정산 기간 오류 | `settlement/helpers.ts:85-99, 116-142` | KST 서버 자정 전후 정산 기간 1일 밀림 |
| H16 | sale_price: 0 사일런트 처리 | `sales-parser.ts:95-101` | 엑셀 수식 오류 → 0원 매출 → 커미션 0원 |
| H17 | 브랜드 정규화 4곳 독립 구현 | `brand-search`, `brand-aliases`, `scoreCalculator`, `product-matcher` | 볼리올리 vs 보리올리 스펠링 불일치 |
| H18 | 카테고리 추론 3곳 독립 구현 | `consignments/[id]:46`, `scoreCalculator:139`, `photo-classifier:18` | 재킷 → jacket vs outer 불일치 |
| H19 | 주문번호 랜덤 충돌 | `orders/route.ts:95`, `consignments/[id]:272` | `Math.random()*1000000` 충돌 시 실패, 재시도 없음 |
| H20 | NaN 전파 (가격/날짜) 7건 | `useAdjustmentChoice:37`, `upload-sales-ledger:29` 등 | parseInt NaN → DB 저장/API 전송 |

### 3.3 문제 총계

| 심각도 | 건수 | V3에서 구조적으로 차단하는 방법 |
|--------|------|-------------------------------|
| CRITICAL | 10 | 미들웨어 정상화, Zod 검증, RPC 트랜잭션, UNIQUE 제약 |
| HIGH | 55 | 서비스 레이어 분리, 에러 처리 표준화, 유틸 통합 |
| MEDIUM | 41 | 타입 통합, AbortController, Tailwind 전환 |
| LOW | 29 | 메타데이터, ARIA, 접근성 |
| **합계** | **135** | — |

---

## 4. V3 아키텍처

### 4.1 5레이어 엄격 단방향 의존성

```
Layer 0: lib/env.ts + lib/supabase/           (인프라)
   ↑
Layer 1: lib/types/ + lib/utils/              (공유 타입, 순수 유틸)
   ↑
Layer 2: lib/db/                              (리포지토리 + 트랜잭션)
   ↑
Layer 3: lib/services/                        (비즈니스 오케스트레이션)
   ↑
Layer 4: app/admin/components/ + hooks/       (UI 컴포넌트)
   ↑
Layer 5: app/api/**/route.ts + app/admin/**   (라우트 + 페이지)
```

**의존성 규칙**:
- 각 레이어는 **하위 레이어만** import
- 순환 참조 금지
- 레이어 건너뛰기 금지 (L5 → L2 직접 호출 금지)

### 4.2 Layer 1: 타입 + 유틸 (V2 12개 타입 파일 → 단일 소스)

**V2 문제**: 타입이 12개 파일에 산재. `ConsignmentStatus` 3값/7값 불일치. `COMMISSION_RATES` 5곳 분산.

```
lib/types/
  index.ts                     ← barrel export (30줄)
  domain/
    seller.ts                  ← SellerTier, Seller, COMMISSION_RATES (단일 소스)
    consignment.ts             ← ConsignmentStatus (7값), ConsignmentApplication
    order.ts                   ← OrderStatus (8값), OrderItem, Order, Condition
    settlement.ts              ← SettlementStatus, SoldItem, SettlementMatch
    product.ts                 ← StProduct, PhotoStatus, SmartstoreStatus
    notification.ts            ← SmsResult, NotificationLog
    photo.ts                   ← ClassifiedGroup, SHOT_RULES
  api/
    requests.ts                ← Zod 스키마 (모든 API 입력 — C10 해결)
    responses.ts               ← ApiSuccess<T>, ApiError
  db/
    database.types.ts          ← `supabase gen types` 자동생성

lib/utils/
  phone.ts                     ← normalizePhone(), digitsOnly() — V2 2곳 통합
  brand.ts                     ← normalizeBrand(), fuzzyBrandMatch() — V2 4곳 통합 (350+ 별칭)
  currency.ts                  ← formatKRW(), parseKRW() — V2 3곳 통합
  date.ts                      ← toKSTDate(), getSettlementPeriod() — V2 helpers.ts 이전
  id.ts                        ← generateOrderNumber() — V2 2곳 통합 + DB UNIQUE 재시도
  category.ts                  ← inferCategory(), CategorySlug — V2 3곳 통합
  sms-templates.ts             ← buildSmsMessage() — V2 templates.ts 이전
  excel.ts                     ← parseExcelSafe(), validateHeaders() — V2 파서 강화
  chunk.ts                     ← chunkArray(100) — .in() 100개 제한 대응
  validation.ts                ← Zod 공용 스키마 (날짜, 전화번호, UUID)
```

### 4.3 Layer 2: 데이터 접근 (V2 API 핸들러에서 DB 로직 추출)

**V2 문제**: 모든 DB 호출이 route.ts 핸들러에 인라인. 에러 미확인 9건.

```
lib/db/
  client.ts                    ← createAdminClient() (V2 admin.ts 이전)
  index.ts                     ← barrel export

  repositories/
    sellers.repo.ts            ← getByPhone(), getByCode(), upsert(), list()
    orders.repo.ts             ← create(), getWithItems(), updateStatus(), search()
    consignments.repo.ts       ← list(), getById(), updateStatus(), batchCreate()
    settlement.repo.ts         ← getPendingSoldItems(), getMatchedRecords(), createQueue()
    products.repo.ts           ← create(), getByNumber(), updatePhotos(), listWithFilters()
    notifications.repo.ts      ← log(), getHistory()
    sales-records.repo.ts      ← batchInsert(), getUnmatched()
    naver-settlements.repo.ts  ← batchInsert(), getUnmatched(), deleteUnmatched()

  mappers/
    order.mapper.ts            ← V2 admin/orders/route.ts의 mapOrder() 추출
    consignment.mapper.ts      ← V2 consignments/route.ts의 매핑 로직 추출
    settlement.mapper.ts       ← V2 settlement/list의 매핑 로직 추출

  transactions/
    order.tx.ts                ← RPC: create_order_with_items (V2 H1 Stuck 해결)
    consignment.tx.ts          ← RPC: complete_consignment (V2 5단계 비원자적 → 1 RPC)
    settlement.tx.ts           ← RPC: create_settlement_queue_batch (C8 이중 큐 방지)
```

**핵심 원칙**:
- 모든 Supabase `{ data, error }` 반환값의 `error` 필수 확인 (V2 9건 미확인 해결)
- `.in()` 호출 시 `chunkArray(100)` 적용 (H10 해결)
- 모든 목록 쿼리에 `.range()` 강제 (C7 1000행 절삭 해결)

### 4.4 Layer 3: 서비스 (V2 route.ts에서 비즈니스 로직 추출)

**V2 문제**: `consignments/[id]/route.ts` 497줄에 상품 파싱 + 주문 생성 + SMS 발송 혼재.

```
lib/services/
  settlement.service.ts        ← generate(), confirm(), pay() — V2 163줄 → 서비스+리포로 분리
  matching.service.ts          ← autoMatch(), manualMatch() — V2 auto-match+manual-match 통합
  order.service.ts             ← create(), inspect(), hold() — V2 orders/route.ts 추출
  consignment.service.ts       ← review(), complete(), reject() — V2 consignments/[id] 추출
  notification.service.ts      ← sendStatusChange(), sendBulk() — V2 notification/index.ts 확장
  photo.service.ts             ← upload(), classify(), link() — V2 photos/* 추출
  sale-detector.service.ts     ← detect() — V2 sale-detector.ts 추출

lib/calculators/
  settlement.calc.ts           ← calculateSettlement() — V2 settlement-calculator.ts 이전
  price-estimator.calc.ts      ← estimate() — V2 price-estimator.ts 이전
```

**핵심 원칙**:
- 서비스는 `{ data, error }` 패턴 반환 — throw하지 않음
- `NextRequest`/`NextResponse` import 금지
- 순수 오케스트레이션: repo 호출 → 계산 → repo 호출

### 4.5 Layer 5: API 라우트 (V2 57개 → V3 리팩터)

**V2 문제**: 핸들러에 DB+비즈니스+HTTP 혼재. 100줄 초과 35건.

**V3 표준 핸들러 패턴** (모든 라우트 100줄 이내):

```typescript
/**
 * POST /api/admin/settlement/generate — 정산 생성
 * WHY: V2는 163줄에 DB/비즈니스/HTTP 혼재 (generate/route.ts)
 * HOW: Zod 검증 → 서비스 위임 → 표준 응답
 * WHERE: 정산 워크플로 Step 4에서 호출
 */
import { generateSettlements } from '@/lib/services/settlement.service'
import { GenerateSettlementSchema } from '@/lib/types/api/requests'
import { requireAdmin } from '@/lib/api/middleware'
import { ok, err, validationErr } from '@/lib/api/response'

export async function POST(req: NextRequest) {
  const authErr = await requireAdmin(req)
  if (authErr) return authErr

  const body = await req.json().catch(() => ({}))
  const parsed = GenerateSettlementSchema.safeParse(body)
  if (!parsed.success) return validationErr(parsed.error.message)

  console.log('[settlement/generate] 시작')
  try {
    const result = await generateSettlements(parsed.data)
    console.log(`[settlement/generate] 완료: ${result.created}건`)
    return ok(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류'
    console.error('[settlement/generate] 실패:', msg)
    return err(msg)
  }
}
```

### 4.6 미들웨어 (V2 C1 해결)

**V2 문제**: `proxy.ts` 파일명 + `proxy()` 함수명 → Next.js 미인식 → 인증 전면 무효.

**V3**:
```
middleware.ts (루트)
  ├─ /admin/* 페이지 → 세션 쿠키 검증 → 미인증 시 /admin/login 리다이렉트
  ├─ /api/admin/* API → 세션 쿠키 검증 → 미인증 시 401 JSON
  ├─ /api/admin/auth/login 제외
  └─ Rate Limiting (Upstash)

+ 각 API 라우트에 requireAdmin() 인라인 가드 (미들웨어 우회 방지)
```

### 4.7 프론트엔드 전략

**V2 문제**: inline style 1,061회, Tailwind 154회. 모든 페이지 `'use client'`. alert()/confirm() 25+회.

**V3 전략**:

| 결정 | V2 | V3 |
|------|----|----|
| 스타일링 | inline 1,061 + Tailwind 154 혼재 | Tailwind v4 전면 (inline 0 목표) |
| Server/Client | 전부 `'use client'` | AdminLayout, Sidebar, StatCard, StatusBadge, TableShell → Server Component |
| 다이얼로그 | alert()/confirm() 25+ | Toast + Dialog 컴포넌트 |
| 코드분할 | 없음 | `next/dynamic` → ClassifyMatchModal, StorageLightbox |
| 훅 패턴 | useXxx() + useXxxHandlers() (유지) | 동일 패턴 유지 + AbortController 표준화 |
| 데이터 갱신 | 수동 refetch | SWR 또는 Supabase Realtime (관리자 간 동기화) |

---

## 5. 단계별 구현 계획

### Phase 0: DB 마이그레이션

**목적**: V3 코드가 의존하는 DB 제약 조건 선행 적용.

**생성 파일**:
```
supabase/migrations/
  20260301_v3_unique_constraints.sql    ← 5개 UNIQUE 추가
  20260301_v3_rpc_order.sql             ← create_order_with_items()
  20260301_v3_rpc_consignment.sql       ← complete_consignment()
  20260301_v3_rpc_settlement.sql        ← create_settlement_queue_batch()
```

**SQL 상세**:

```sql
-- 20260301_v3_unique_constraints.sql

-- C8: 이중 정산 큐 방지
ALTER TABLE settlement_queue
  ADD CONSTRAINT uq_settlement_queue_match UNIQUE (match_id);

-- H6: 판매자 전화번호 중복 방지
ALTER TABLE sellers
  ADD CONSTRAINT uq_sellers_phone UNIQUE (phone);

-- H5: 판매자 코드 중복 방지
ALTER TABLE sellers
  ADD CONSTRAINT uq_sellers_code UNIQUE (seller_code);

-- 반품 중복 방지
ALTER TABLE return_shipments
  ADD CONSTRAINT uq_return_consignment UNIQUE (consignment_id);

-- H19: 상품번호 중복 방지
ALTER TABLE st_products
  ADD CONSTRAINT uq_st_products_number UNIQUE (product_number);
```

**선행 조건**: UNIQUE 추가 전 기존 중복 데이터 정리 스크립트 실행.

**검증**: `\d+ 테이블명`으로 제약 조건 확인.

---

### Phase 1: 타입 + Zod + 유틸리티 (Layer 0 + 1)

**목적**: V2의 12개 산재 타입 파일 → 단일 소스. V2의 5곳 분산 유틸 → 통합.

**V2 소스 → V3 매핑**:

| V2 파일 | V3 목적지 | 변환 내용 |
|---------|----------|----------|
| `app/admin/consignments/types.ts` (67줄) | `lib/types/domain/consignment.ts` | ConsignmentStatus 3값→7값 확장, SellerTier 유지 |
| `app/admin/orders/types.ts` (206줄) | `lib/types/domain/order.ts` + `lib/utils/category.ts` | OrderStatus 유지, MEASUREMENT_FIELDS 분리 |
| `lib/settlement/types.ts` (~300줄) | `lib/types/domain/settlement.ts` + `seller.ts` | COMMISSION_RATES 단일 소스화, 타입 분리 |
| `app/admin/sales/types.ts` (77줄) | `lib/types/domain/product.ts` 통합 | SalesProductType 등 |
| `app/admin/notifications/types.ts` (34줄) | `lib/types/domain/notification.ts` | 그대로 이전 |
| `app/admin/settlement/workflow/types.ts` | `lib/types/domain/settlement.ts` 통합 | 워크플로 타입 통합 |
| `lib/settlement/helpers.ts` (165줄) | `lib/utils/date.ts` | UTC/KST 혼용 수정 (H15) |
| `lib/settlement/phone-normalizer.ts` | `lib/utils/phone.ts` | 2개 구현 통합 |
| `lib/brand-search.ts` (446줄) + `brand-aliases.ts` (71줄) | `lib/utils/brand.ts` | 4곳 통합, 350+ 별칭 단일 맵 |
| `lib/photo-classifier.ts:classifyCategory` + `consignments/[id]:inferCategory` + `scoreCalculator:inferCategoryFromModel` | `lib/utils/category.ts` | 3곳 통합, CategorySlug 타입 |
| `lib/notification/templates.ts` (134줄) | `lib/utils/sms-templates.ts` | 하드코딩 전화번호 → 환경변수 |

**생성 파일 목록**:
```
lib/env.ts                         ← V2 그대로 이전 (34줄)
lib/supabase/admin.ts              ← V2 그대로 이전 (29줄)
lib/supabase/client.ts             ← V2 그대로 이전 (25줄)
lib/types/index.ts
lib/types/domain/seller.ts
lib/types/domain/consignment.ts
lib/types/domain/order.ts
lib/types/domain/settlement.ts
lib/types/domain/product.ts
lib/types/domain/notification.ts
lib/types/domain/photo.ts
lib/types/api/requests.ts          ← 모든 API Zod 스키마
lib/types/api/responses.ts
lib/utils/phone.ts
lib/utils/brand.ts
lib/utils/currency.ts
lib/utils/date.ts
lib/utils/id.ts
lib/utils/category.ts
lib/utils/sms-templates.ts
lib/utils/excel.ts
lib/utils/chunk.ts
lib/utils/validation.ts
lib/api/response.ts                ← V2 response.ts 확장 (ok, err, validationErr)
lib/api/middleware.ts               ← requireAdmin() 신규
lib/auth.ts                        ← V2 그대로 이전 (110줄)
lib/ratelimit.ts                   ← V2 그대로 이전 (70줄)
```

**검증**: `tsc --strict --noEmit` → 에러 0건

---

### Phase 2: 리포지토리 + 트랜잭션 (Layer 2)

**목적**: V2 route.ts 인라인 DB 호출 → 리포지토리 패턴 추출.

**V2 소스 → V3 리포지토리 매핑**:

| V2 API 핸들러 | 추출 대상 DB 호출 | V3 리포지토리 |
|---------------|------------------|--------------|
| `admin/orders/route.ts:15-75` GET | orders+order_items SELECT + mapOrder() | `orders.repo.ts` + `order.mapper.ts` |
| `admin/orders/route.ts:77-155` POST | orders INSERT + order_items INSERT | `orders.repo.ts` + `order.tx.ts` |
| `admin/consignments/route.ts:20-130` GET | consignment_requests SELECT + sellers JOIN | `consignments.repo.ts` + `consignment.mapper.ts` |
| `admin/consignments/route.ts:146-310` POST | sellers upsert + consignment_requests INSERT (행별) | `sellers.repo.ts` + `consignments.repo.ts` |
| `admin/consignments/[id]/route.ts:197-353` PATCH | st_products INSERT + orders INSERT + order_items INSERT + status UPDATE | `consignment.tx.ts` (RPC) |
| `settlement/generate/route.ts:66-146` POST | sellers SELECT + sold_items SELECT + settlement INSERT + items INSERT + status UPDATE | `settlement.repo.ts` + `settlement.tx.ts` |
| `settlement/queue-settlements/route.ts:20-172` POST | matches SELECT + queue INSERT (배치) | `settlement.repo.ts` |
| `admin/notifications/send-sms/route.ts:10-45` POST | notification_logs INSERT + SMS API | `notifications.repo.ts` |
| `settlement/auto-match/route.ts:30-200` POST | sales_records SELECT + naver_settlements SELECT + matches INSERT + status UPDATE | `sales-records.repo.ts` + `naver-settlements.repo.ts` |

**생성 파일 목록**:
```
lib/db/client.ts
lib/db/index.ts
lib/db/repositories/sellers.repo.ts
lib/db/repositories/orders.repo.ts
lib/db/repositories/consignments.repo.ts
lib/db/repositories/settlement.repo.ts
lib/db/repositories/products.repo.ts
lib/db/repositories/notifications.repo.ts
lib/db/repositories/sales-records.repo.ts
lib/db/repositories/naver-settlements.repo.ts
lib/db/mappers/order.mapper.ts
lib/db/mappers/consignment.mapper.ts
lib/db/mappers/settlement.mapper.ts
lib/db/transactions/order.tx.ts
lib/db/transactions/consignment.tx.ts
lib/db/transactions/settlement.tx.ts
```

**검증**: `tsc --strict --noEmit` → 에러 0건

---

### Phase 3: 미들웨어 + 인증 (Layer 5 기반)

**목적**: V2 C1 (전체 인증 무효) 해결.

**생성 파일**:
```
middleware.ts                      ← V2 proxy.ts 리네이밍 + 수정
```

**V2 → V3 변경점**:

| V2 (proxy.ts) | V3 (middleware.ts) |
|---------------|-------------------|
| 파일명: `proxy.ts` | 파일명: `middleware.ts` |
| 함수명: `proxy()` | 함수명: `middleware()` |
| `/admin/*` 페이지만 인증 | `/admin/*` 페이지 + `/api/admin/*` API 모두 인증 |
| Rate limit: API 전체 100/분 | Rate limit: 관리자 100/분, 공개 10/분, 로그인 5/분 (유지) |

**추가**: `lib/api/middleware.ts`의 `requireAdmin()` — 모든 admin API 라우트에 인라인 가드.

**검증**:
- `.next/server/middleware-manifest.json`에 `middleware` 등록 확인
- `curl /api/admin/orders` → 401 반환 확인

---

### Phase 4: 서비스 7개 (Layer 3)

**목적**: V2 route.ts의 비즈니스 로직을 서비스로 추출.

**생성 파일**:
```
lib/services/settlement.service.ts
lib/services/matching.service.ts
lib/services/order.service.ts
lib/services/consignment.service.ts
lib/services/notification.service.ts
lib/services/photo.service.ts
lib/services/sale-detector.service.ts
lib/calculators/settlement.calc.ts
lib/calculators/price-estimator.calc.ts
```

**V2 → V3 서비스 매핑 상세**:

#### settlement.service.ts
- V2 소스: `settlement/generate/route.ts:66-146` (163줄 핸들러)
- V3: `generate()` — 순수 오케스트레이션
  1. `sellers.repo.getActive()` 호출
  2. `settlement.repo.getPendingSoldItems()` 호출
  3. `settlement.calc.calculate()` 순수 계산
  4. `settlement.tx.createWithItems()` RPC (원자적)
- **해결하는 V2 문제**: C2 (이중 정산), H7 (에러 미확인)

#### matching.service.ts
- V2 소스: `settlement/auto-match/route.ts` (206줄) + `product-matcher.ts` (314줄)
- V3: `autoMatch()` + `manualMatch()`
  - V2의 3단계 매칭 알고리즘 유지
  - `brand.ts` 통합 맵 사용 (H17 해결)
  - Promise.all 결과 검사 필수 (H7 해결)

#### consignment.service.ts
- V2 소스: `consignments/[id]/route.ts:197-354` (497줄 핸들러)
- V3: `complete()` — RPC 트랜잭션으로 원자적 처리
  - V2의 5단계 비원자적 → 1 RPC (H1 Stuck 해결)
  - `category.ts` 통합 추론 사용 (H18 해결)
  - `id.ts` 통합 주문번호 생성 사용 (H19 해결)

**검증**: `tsc --strict --noEmit` → 에러 0건

---

### Phase 5: API 라우트 (Layer 5)

**목적**: V2 57개 엔드포인트 리팩터. 100줄 이내. Zod 검증. 서비스 위임.

#### Tier 1 — CRITICAL (인증 + 정산 + 주문 + 위탁)

| V2 라우트 | V3 파일 | V2 줄수 → V3 목표 |
|----------|---------|------------------|
| `admin/auth/login/route.ts` | 유지 + Zod 추가 | 49 → ~50 |
| `admin/auth/logout/route.ts` | 유지 | ~20 |
| `settlement/generate/route.ts` | 서비스 위임 | 163 → ~40 |
| `settlement/auto-match/route.ts` | 서비스 위임 | 206 → ~50 |
| `settlement/manual-match/route.ts` | 서비스 위임 | 113 → ~60 |
| `settlement/queue-settlements/route.ts` | 서비스 위임 | 290 → ~80 |
| `settlement/generate-payout/route.ts` | 서비스 위임 | 231 → ~70 |
| `admin/orders/route.ts` | 서비스 위임 (GET/POST/PATCH 분리) | 220 → ~80 |
| `admin/consignments/route.ts` | 서비스 위임 | 358 → ~80 |
| `admin/consignments/[id]/route.ts` | 서비스 위임 | 497 → ~60 |

#### Tier 2 — HIGH (알림 + 판매자 + 상품 + 사진 + 매출)

| V2 라우트 | V3 파일 | V2 줄수 → V3 목표 |
|----------|---------|------------------|
| `admin/notifications/send-sms/route.ts` | 서비스 위임 | 46 → ~40 |
| `admin/notifications/bulk-send/route.ts` | 서비스 위임 | ~65 → ~50 |
| `admin/notifications/resend/route.ts` | 서비스 위임 | ~40 → ~40 |
| `admin/notifications/route.ts` (GET) | 리포 위임 | ~50 → ~40 |
| `admin/sellers/for-notification/route.ts` | 리포 위임 | 32 → ~30 |
| `admin/products/route.ts` | 리포 위임 + .or() 인젝션 수정 | ~125 → ~60 |
| `admin/photos/upload/route.ts` | Supabase Storage + path.basename | 72 → ~50 |
| `admin/photos/list/route.ts` | 리포 위임 | ~40 → ~30 |
| `admin/sales/route.ts` | 리포 위임 | ~90 → ~50 |

#### Tier 3 — MEDIUM (나머지)

| V2 라우트 | V3 파일 |
|----------|---------|
| `settlement/list`, `detail/[id]`, `confirm/[id]`, `pay/[id]` | 리포 위임 |
| `settlement/upload-sales`, `upload-confirm`, `upload-sales-ledger`, `upload-naver-settle` | 서비스 위임 + Zod |
| `settlement/review-report`, `export/*` | 리포 위임 |
| `settlement/sellers` | 리포 위임 |
| `admin/consignments/create-single`, `return-shipment`, `upload-photo` | 서비스 위임 |
| `admin/photos/classify`, `edit`, `match`, `download`, `generate-*`, `link-to-product` | 서비스 위임 |
| `admin/photos/process-storage`, `storage`, `storage-serve` | 스토리지 서비스 |
| `admin/orders/search` | .or() 인젝션 수정 |
| `admin/price-estimate` | 캐시 서비스 |
| `consignment/adjust/[token]` (GET/PATCH) | Zod + 서비스 |
| `consignment/adjust/[token]/return` | Zod + 서비스 |
| `orders/[productId]/hold` | Zod + public client (admin 키 제거) |
| `health`, `ready` | 유지 |
| `storage/[...path]` | 유지 + path.basename 보강 |

**모든 라우트 공통**:
1. `requireAdmin()` (admin 라우트) 또는 토큰 검증 (public 라우트)
2. `Zod.safeParse()` 입력 검증
3. `try/catch` + `[api-name] 시작/완료/실패` 로깅
4. `ok(result)` / `err(msg)` 표준 응답

**검증**:
- `tsc --strict --noEmit` → 에러 0건
- 모든 라우트 100줄 이내: `wc -l app/api/**/route.ts`
- 인증: `grep -r "requireAdmin" app/api/admin/` = admin 라우트 수와 일치
- .or() 인젝션 0건: `grep -r '\.or(\`' app/` = 0

---

### Phase 6: 프론트엔드 (Layer 4 + 5)

**목적**: V2 64개 컴포넌트 + 17개 훅 리팩터. inline style → Tailwind. Server Component 도입.

#### 6-A: 공유 UI 컴포넌트

| V2 컴포넌트 | V3 변환 | 유형 |
|------------|---------|------|
| `AdminLayout.tsx` (186줄) | Tailwind 전환 + Server Component | Server |
| `Sidebar.tsx` (229줄) | Tailwind 전환 + Server Component | Server |
| `StatCard.tsx` (59줄) | Tailwind 전환 + Server Component | Server |
| `StatusBadge.tsx` (91줄) | Tailwind 전환 + Server Component | Server |
| `TableShell.tsx` | Tailwind 전환 + Server Component | Server |
| (신규) `Toast.tsx` | alert() 대체 | Client |
| (신규) `Dialog.tsx` | confirm() 대체 | Client |
| (신규) `ModalLayout.tsx` | V2 11개 모달 오버레이 통합 | Client |

#### 6-B: 기능 페이지 (V2 훅 패턴 유지)

**위탁 관리** (V2: page.tsx 97줄 + hooks 4개 + components 12개):
- 훅 패턴 유지: `useConsignments()` + `useConsignmentHandlers()`
- 모든 `fetch()` → `api.get<T>()`/`api.post<T>()` (V2 lib/api/client.ts 활용)
- AbortController 표준화
- inline style → Tailwind

**주문 관리** (V2: page.tsx 92줄 + hooks 2개 + components 8개):
- `InspectionModal` + `HoldModal` → 단일 `ProductInspectionModal` + mode prop (DUP-04 해결)
- `MeasurementStep` (375줄) → 컴포넌트 분리 (100줄 이내)

**정산 워크플로** (V2: workflow/page.tsx 155줄 + hooks 2개 + components 16개):
- `useWorkflowHandlers.ts` (16,909줄!) → Phase별 분리
  - `useUploadHandlers.ts` (Step 1-2)
  - `useMatchHandlers.ts` (Step 3)
  - `useQueueHandlers.ts` (Step 4)
  - `usePayoutHandlers.ts` (Step 5)
  - `useReviewHandlers.ts` (Step 6)

**사진 관리** (V2: page.tsx 184줄 + components 10개):
- `ClassifyMatchModal` (342줄) → `next/dynamic` 코드분할
- 사진 스토리지: 로컬 파일시스템 → Supabase Storage API

**매출/알림/시세** (V2: 각각 page + hooks + components):
- 패턴 유지, inline style → Tailwind 전환

#### 6-C: 공개 페이지

| V2 페이지 | V3 변환 |
|----------|---------|
| `consignment/adjust/[token]/` | Zod 검증 추가, 스타일 Tailwind |
| `orders/[productId]/hold/` | admin 클라이언트 → public 클라이언트 (C5 해결) |

**검증**:
- `grep -r "style={{" app/` = 0 (inline style 전면 제거)
- `grep -r "alert(" app/` = 0 (alert 전면 제거)
- Server Component 확인: `AdminLayout`, `Sidebar`, `StatCard`, `StatusBadge`에 `'use client'` 없음

---

### Phase 7: 스토리지 마이그레이션

**목적**: V2 로컬 파일시스템 (`process.cwd()/storage/`) → Supabase Storage (H3 해결).

**영향 V2 파일**:
```
lib/photoroom.ts               ← readFileSync → Buffer 파이프라인
lib/photo-editor.ts            ← readFileSync/writeFileSync → Buffer
lib/measurement-card.ts        ← fs.readFileSync → Buffer
lib/heic-to-jpeg.ts            ← writeFileSync/unlinkSync → Buffer
app/api/admin/photos/upload/route.ts          ← createWriteStream → Supabase upload
app/api/admin/photos/process-storage/route.ts ← readdirSync → Supabase list
app/api/admin/photos/storage/route.ts         ← readdirSync → Supabase list
app/api/admin/photos/storage-serve/route.ts   ← readFileSync → Supabase signed URL
app/api/storage/[...path]/route.ts            ← readFileSync → Supabase proxy
app/api/admin/consignments/upload-photo/route.ts ← createWriteStream → Supabase upload
app/api/admin/upload-photos/route.ts          ← createWriteStream → Supabase upload
```

**Supabase Storage 버킷 설계**:
```
originals/        ← 원본 사진 (before)
processed/        ← 편집된 사진 (photoroom)
consignment-photos/ ← 위탁 신청 사진
measurement-cards/  ← 측정카드 이미지
```

**데이터 마이그레이션**:
- 기존 `st_products.photos` JSONB URL 일괄 치환 스크립트
- 과도기: `storage-serve` 엔드포인트를 Supabase signed URL 프록시로 유지

---

### Phase 8: 검증 + 경화

**전수 검증 체크리스트**:

```
□ tsc --strict --noEmit → 에러 0건
□ middleware-manifest.json에 middleware 등록 확인
□ grep -r "requireAdmin" app/api/admin/ = admin 라우트 수와 일치
□ grep -r "\.or(\`" app/ = 0 (PostgREST 인젝션 0건)
□ grep -r "style={{" app/ = 0 (inline style 0건)
□ grep -r "alert(" app/ = 0
□ grep -r "as unknown" lib/ = 0
□ grep -r "as any" lib/ app/ = 0
□ wc -l app/api/**/route.ts → 모든 라우트 100줄 이내
□ 모든 파일 상단 WHY/HOW/WHERE 주석 존재
□ 모든 라우트 [api-name] 시작/완료/실패 로깅
□ 정산 더블클릭 테스트 → 1건만 생성
□ Supabase .in() 호출에 chunkArray 적용 확인
□ 모든 목록 쿼리에 .range() 페이지네이션 적용 확인
□ 판매자 중복 생성 테스트 → UNIQUE 제약에 의해 차단
□ 파일 업로드 path.basename() 적용 확인
□ Zod 스키마로 모든 API 입력 검증 확인
```

---

## 6. V2 유지 패턴 (그대로 가져갈 것)

| 패턴 | V2 위치 | V3 활용 |
|------|---------|---------|
| HMAC 세션 서명/검증 | `lib/auth.ts` (110줄) | 그대로 이전 |
| `requireEnv()` 환경변수 검증 | `lib/env.ts` (34줄) | 그대로 이전 |
| API fetch 래퍼 + AbortController | `lib/api/client.ts` (109줄) | 제네릭 `api.get<T>()` 확장 |
| `{ success, data/error }` 응답 | `lib/api/response.ts` (27줄) | 전면 채택 |
| 순수 함수 정산 계산기 | `settlement-calculator.ts` (124줄) | `lib/calculators/` 이전 |
| 훅 기반 상태관리 | `useXxx()` + `useXxxHandlers()` | 패턴 유지 |
| Upstash Rate Limiting | `lib/ratelimit.ts` (70줄) | 그대로 이전 |
| 3단계 자동매칭 알고리즘 | `product-matcher.ts` (314줄) | 로직 유지, brand.ts 통합 |
| Sentry 에러 추적 | `@sentry/nextjs` | 유지 |

---

## 7. V2에서 삭제할 코드 (중복/데드코드)

| V2 파일 | 사유 |
|---------|------|
| `lib/settlement/types.ts` (COMMISSION_RATES) | `lib/types/domain/seller.ts`로 통합 |
| `app/admin/orders/types.ts` (DEFAULT_COMMISSION_RATES) | 동일 — 미사용 orphan |
| `lib/settlement/phone-normalizer.ts` | `lib/utils/phone.ts`로 통합 |
| `lib/brand-aliases.ts` | `lib/utils/brand.ts`로 통합 |
| `lib/catalog/brand-normalizer.ts` | `lib/utils/brand.ts`로 통합 |
| `lib/settlement/helpers.ts` | `lib/utils/date.ts`로 통합 |
| `lib/notification/templates.ts` | `lib/utils/sms-templates.ts`로 통합 |
| `proxy.ts` | `middleware.ts`로 대체 |
| 구 파이프라인 A (`settlement/generate` 계열) | 신 파이프라인 B 단일화 후 제거 |

---

## 8. 리스크 대응 매트릭스

### 8.1 마이그레이션 리스크

| 리스크 | 등급 | 대응 |
|--------|------|------|
| UNIQUE 인덱스 생성 시 기존 중복 데이터 | HIGH | 마이그레이션 전 중복 데이터 조회+정리 스크립트 |
| 구 파이프라인 A pending 정산 고립 | HIGH | V3 배포 전 A 파이프라인 pending 정산 모두 완료 처리 |
| 기존 사진 URL 404 (로컬→클라우드) | HIGH | URL 일괄 치환 스크립트 + 과도기 프록시 |
| 진행 중 adjustment_token 링크 깨짐 | MEDIUM | V2 URL 구조 유지 또는 리다이렉트 |
| 커미션 0.20→0.25 전환 시 기존 판매자 영향 | HIGH | 기존 판매자 DB 값 유지, 신규만 COMMISSION_RATES 적용 |
| 타임존 변경 시 정산 경계 이동 | MEDIUM | 전환일 기준 데이터 검증 + 과도기 수동 확인 |

### 8.2 기술 리스크

| 리스크 | 등급 | 대응 |
|--------|------|------|
| sharp 네이티브 바이너리 Vercel 호환 | HIGH | sharp 버전 Vercel 레이어 일치, 번들 크기 모니터링 |
| puppeteer 50MB 번들 제한 | HIGH | devDependencies 이동 또는 측정카드 대안 |
| @imgly/background-removal-node WASM 크기 | MEDIUM | 필요 시 PhotoRoom API 전용 전환 |
| Supabase Realtime 복잡도 | MEDIUM | 1차 SWR polling으로 시작, 필요 시 Realtime 전환 |

---

## 9. 파일 생성 순서 (의존성 그래프 기반)

```
Phase 0: SQL 마이그레이션 4개
  ↓
Phase 1: (의존성 없음)
  lib/env.ts
  lib/supabase/{admin,client}.ts
  lib/auth.ts, lib/ratelimit.ts
  lib/types/**  (모든 타입)
  lib/utils/**  (모든 유틸)
  lib/api/{response,middleware}.ts
  ↓
Phase 2: (← Phase 1)
  lib/db/client.ts
  lib/db/repositories/**
  lib/db/mappers/**
  lib/db/transactions/**
  ↓
Phase 3: (← Phase 1)
  middleware.ts
  ↓
Phase 4: (← Phase 2)
  lib/services/**
  lib/calculators/**
  ↓
Phase 5: (← Phase 3, 4)
  app/api/**/route.ts (전체)
  ↓
Phase 6: (← Phase 5)
  app/admin/components/**
  app/admin/**/page.tsx
  app/admin/**/hooks/**
  app/admin/**/components/**
  ↓
Phase 7: (← Phase 5, 6)
  스토리지 마이그레이션
  ↓
Phase 8: (← 전체)
  검증 체크리스트 실행
```

---

## 10. V2 vs V3 핵심 차이 요약

| 차원 | V2 | V3 |
|------|----|----|
| 미들웨어 | 미작동 (proxy.ts) | 정상 (middleware.ts) |
| API 인증 | /api/admin/* 공개 | requireAdmin() 전체 적용 |
| 입력 검증 | 없음 (req.json() 직접) | Zod 스키마 전면 |
| 에러 응답 | 44개 라우트 불일치 | `ok()`/`err()` 단일 패턴 |
| 트랜잭션 | 비원자적 다단계 | Supabase RPC 원자적 |
| 타입 | 12개 파일 산재, 3값/7값 불일치 | 단일 소스 (`lib/types/`) |
| 유틸 | 4-5곳 독립 구현 | 통합 (`lib/utils/`) |
| 스타일 | inline 1,061 + Tailwind 154 | Tailwind v4 전면 |
| 사진 | 로컬 파일시스템 | Supabase Storage |
| 정산 | 구/신 2개 파이프라인 | 단일 파이프라인 |
| 코드 길이 | 35+ 파일 100줄 초과 (최대 497줄) | 모든 파일 100줄 이내 |
| 로깅 | 23개 라우트 없음 | 전체 [api-name] 시작/완료/실패 |
| DB 제약 | UNIQUE 5개 누락 | 전부 추가 |

---

*이 계획은 V2 소스코드 전수 읽기 (180+ 파일) + 4차 리서치 보고서 (220건+ 문제) + DB 스키마 (14 테이블, 21 마이그레이션) 기반으로 작성되었습니다.*
*구현 시작 전 사용자 승인을 받아야 합니다.*
