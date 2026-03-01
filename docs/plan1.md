# Classic Menswear V3 — 마스터 구현 플랜

**작성일**: 2026-03-01
**기준**: 클로드코드교리 v2.0
**기반**: 4차 리서치 보고서 (v2reserch1.md ~ v4reserch4.md)
**총 발견 사항**: 약 220건+ (1차 17건, 2차 51건, 3차 34건+82핸들러, 4차 135건)
**목표**: V2의 모든 실패 가능성을 구조적으로 차단하는 완전한 V3 시스템 구축

---

## 1. Context — 왜 이 플랜이 필요한가

### 1.1 V2 핵심 실패 현황

| 차원 | CRITICAL | HIGH | 주요 위험 |
|------|----------|------|----------|
| 보안 | 3건 | 2건 | 미들웨어 미작동(전체 인증 무효), PostgREST 인젝션 4곳, 경로 탐색 3곳 |
| 금전 | 2건 | 5건 | 이중 정산(UNIQUE 없음), 구/신 파이프라인 공존, 커미션 5곳 분산 |
| 데이터 | 5건 | 18건 | 1000행 사일런트 절삭, 비원자적 트랜잭션 3곳, Supabase 에러 미확인 9곳 |
| 런타임 | — | 18건 | req.json() 미보호 12곳(PUBLIC 4곳), Non-null assertion 3곳 |

### 1.2 V3가 해결해야 할 구조적 문제

1. **인증 전면 부재**: `proxy.ts` → Next.js가 미들웨어로 인식하지 않음 (파일명/함수명 불일치)
2. **정산 이중 지급 위험**: `settlement_queue.match_id` UNIQUE 없음 + 구/신 파이프라인 독립 동작
3. **데이터 무결성 부재**: 5개 테이블에 UNIQUE 제약 누락, 모든 상태 전환에 낙관적 잠금 없음
4. **코드 중복 심각**: 브랜드 정규화 4곳, 카테고리 추론 3곳, 커미션 정의 5곳, 에러 응답 44곳 불일치
5. **파일시스템 의존**: Vercel 배포 시 사진 소실 (이미 프로덕션 버그)

### 1.3 설계 원칙

- **5레이어 단방향 의존성**: Types(L1) → DB(L2) → Services(L3) → UI(L4) → Routes(L5)
- **교리 v2.0 완전 준수**: WHY/HOW/WHERE 헤더, 100줄 제한, `{success, error}` 응답, `[api-name]` 로깅, `any` 금지
- **DB 레벨 방어 우선**: UNIQUE 제약, RPC 트랜잭션, 상태 CHECK으로 앱 레벨 버그를 DB가 차단
- **Zod 입력 검증 일괄 적용**: req.json() 크래시 12건 + 경계값 다수를 한 레이어에서 해결

---

## 2. 아키텍처 블루프린트

### 2.1 5레이어 구조

```
LAYER 5: app/api/**/route.ts        — 라우트 핸들러 (100줄 이내, Zod 검증 → 서비스 위임)
          ↑
LAYER 4: app/admin/**/components/   — UI 컴포넌트 + 클라이언트 훅
          ↑
LAYER 3: lib/services/              — 비즈니스 로직 오케스트레이션 (NextRequest/Response 금지)
          ↑
LAYER 2: lib/db/                    — Supabase 리포지토리 + RPC 트랜잭션 + 매퍼
          ↑
LAYER 1: lib/types/ + lib/utils/    — 공유 타입, Zod 스키마, 순수 유틸리티
          ↑
LAYER 0: lib/env.ts + lib/supabase/ — 인프라 (환경변수, DB 클라이언트)
```

### 2.2 디렉토리 구조

```
tf-v3/
├── middleware.ts                    ← 인증 + 레이트 리밋 (proxy.ts 문제 해결)
├── lib/
│   ├── env.ts                       ← requireEnv() — 모든 환경변수 등록
│   ├── supabase/
│   │   ├── admin.ts                 ← createAdminClient()
│   │   └── client.ts                ← createBrowserClient()
│   ├── types/
│   │   ├── index.ts                 ← barrel re-export
│   │   ├── domain/
│   │   │   ├── seller.ts            ← SellerTier, Seller, COMMISSION_RATES (단일 소스)
│   │   │   ├── consignment.ts       ← ConsignmentStatus (7값 완전 정의)
│   │   │   ├── order.ts             ← OrderStatus + 허용 전환 맵
│   │   │   ├── settlement.ts        ← SettlementStatus, SoldItem, SalesRecord
│   │   │   ├── product.ts           ← StProduct, PhotoStatus
│   │   │   ├── notification.ts      ← SmsResult, NotificationLog
│   │   │   └── photo.ts             ← ClassifiedGroup, ClassifiedFile
│   │   ├── api/
│   │   │   ├── requests.ts          ← Zod 스키마 (모든 API 입력)
│   │   │   └── responses.ts         ← ApiSuccess<T>, ApiError
│   │   └── db/
│   │       └── database.types.ts    ← supabase gen types 자동생성
│   ├── utils/
│   │   ├── phone.ts                 ← normalizePhone(), digitsOnly() (2곳 통합)
│   │   ├── brand.ts                 ← normalizeBrand(), fuzzyBrandMatch() (4곳 통합)
│   │   ├── category.ts              ← inferCategory(), CategorySlug (3곳 통합)
│   │   ├── currency.ts              ← formatKRW(), parseKRW() (3곳 통합)
│   │   ├── date.ts                  ← toKSTDate(), getSettlementPeriod() (타임존 KST 통일)
│   │   ├── id.ts                    ← generateOrderNumber() (2곳 통합 + UNIQUE 재시도)
│   │   ├── sms-templates.ts         ← buildSmsMessage() 디스패치 테이블
│   │   ├── path.ts                  ← sanitizePath() (path.basename + startsWith 이중 검증)
│   │   ├── supabase-chunks.ts       ← chunkedIn() (.in() 100개 청크 분할)
│   │   └── validation.ts            ← 공통 검증 유틸 (isValidPhone, isValidPrice 등)
│   ├── db/
│   │   ├── client.ts                ← Supabase 팩토리
│   │   ├── repositories/
│   │   │   ├── sellers.repo.ts      ← sellers CRUD (80줄)
│   │   │   ├── orders.repo.ts       ← orders + order_items CRUD (90줄)
│   │   │   ├── consignments.repo.ts ← consignment_requests CRUD (80줄)
│   │   │   ├── settlement.repo.ts   ← settlements + sold_items CRUD (90줄)
│   │   │   ├── products.repo.ts     ← st_products CRUD (70줄)
│   │   │   └── notifications.repo.ts← notification_logs CRUD (50줄)
│   │   ├── mappers/
│   │   │   ├── order.mapper.ts
│   │   │   ├── consignment.mapper.ts
│   │   │   └── settlement.mapper.ts
│   │   └── transactions/
│   │       ├── settlement.tx.ts     ← RPC: 정산 원자적 생성 (FOR UPDATE 잠금)
│   │       ├── order.tx.ts          ← RPC: 주문+아이템 원자적 생성
│   │       └── consignment-complete.tx.ts ← RPC: 위탁완료 4단계 원자적 처리
│   ├── services/
│   │   ├── settlement.service.ts    ← 정산 생성/확인/지급 오케스트레이션
│   │   ├── order.service.ts         ← 주문 생성/검수/보류
│   │   ├── consignment.service.ts   ← 위탁 접수/검수/완료
│   │   ├── notification.service.ts  ← SMS 발송 + DB 로깅 + 실패 재시도
│   │   ├── photo.service.ts         ← 업로드/분류/매칭
│   │   ├── matching.service.ts      ← 자동매칭 오케스트레이션
│   │   └── price.service.ts         ← 가격 추정
│   ├── api/
│   │   ├── response.ts              ← ok(), err(), validationErr() (교리 표준)
│   │   └── middleware.ts            ← requireAdmin() 인라인 가드
│   └── auth.ts                      ← HMAC-SHA256 세션 검증 (V2 로직 유지)
├── app/
│   ├── api/                         ← 모든 라우트 핸들러 (100줄 이내)
│   └── admin/                       ← 페이지 + 컴포넌트
└── supabase/
    └── migrations/                  ← DB 마이그레이션 (UNIQUE 제약, RPC 함수)
```

---

## 3. DB 마이그레이션 (Phase 0 — 구현 전 필수)

### 3.1 UNIQUE 제약 추가 (5건)

| 테이블 | 제약 | 해결하는 문제 |
|--------|------|-------------|
| `settlement_queue` | `UNIQUE (match_id)` | 동일 매출 이중 큐 등록 → 이중 지급 |
| `sellers` | `UNIQUE (phone)` | 동시 Excel 업로드 시 판매자 중복 |
| `sellers` | `UNIQUE (seller_code)` | 판매자 코드 레이스 컨디션 |
| `return_shipments` | `UNIQUE (consignment_id)` | 반품 이중 접수 |
| `st_products` | `UNIQUE (product_number)` | 상품번호 충돌 시 stuck-consignment |

**사전 작업**: 기존 중복 데이터 조회 + 정리 스크립트 실행 후 제약 추가

### 3.2 RPC 트랜잭션 함수 (3건)

```sql
-- 1. 정산 원자적 생성 (이중 정산 방지)
CREATE OR REPLACE FUNCTION create_settlement_with_items(
  p_seller_id uuid, p_period_start date, p_period_end date,
  p_total_sales numeric, p_commission_rate numeric,
  p_commission_amount numeric, p_settlement_amount numeric,
  p_sold_item_ids uuid[]
) RETURNS uuid AS $$
DECLARE v_id uuid;
BEGIN
  -- sold_items FOR UPDATE 잠금
  PERFORM id FROM sold_items
    WHERE id = ANY(p_sold_item_ids) AND settlement_status = 'pending'
    FOR UPDATE;
  -- 잠금 성공 시에만 진행
  INSERT INTO settlements (...) VALUES (...) RETURNING id INTO v_id;
  INSERT INTO settlement_items (settlement_id, sold_item_id)
    SELECT v_id, unnest(p_sold_item_ids);
  UPDATE sold_items SET settlement_status = 'settled'
    WHERE id = ANY(p_sold_item_ids);
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- 2. 주문 + 아이템 원자적 생성
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_order jsonb, p_items jsonb[]
) RETURNS uuid ...

-- 3. 위탁 완료 원자적 처리 (st_products → orders → order_items → status)
CREATE OR REPLACE FUNCTION complete_consignment(
  p_consignment_id uuid, p_product jsonb, p_order jsonb, p_items jsonb[]
) RETURNS jsonb ...
```

### 3.3 상태 CHECK 제약 강화

```sql
-- ConsignmentStatus 7값 완전 정의 (V2는 타입에 3값만)
ALTER TABLE consignment_requests
  ADD CONSTRAINT chk_consignment_status
  CHECK (status IN ('pending','received','inspecting','approved','rejected','on_hold','completed'));

-- 주문 상태 전이 제약 (V2는 아무 값이나 가능)
-- → 앱 레벨 상태 머신 + DB CHECK으로 이중 보호
```

---

## 4. 구현 Phase 상세

### Phase 1: 기반 인프라 (Layer 0 + Layer 1)

**목표**: 프로젝트 스캐폴딩 + 타입 시스템 + 유틸리티 통합

#### 1-A: 프로젝트 초기화
- [ ] Next.js 16 + React 19 + TypeScript strict 프로젝트 생성
- [ ] `tsconfig.json` 강화 (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`)
- [ ] Tailwind CSS v4 설정 + 브랜드 컬러/spacing 토큰 등록
- [ ] ESLint + Prettier 설정
- [ ] `supabase gen types typescript` → `lib/types/db/database.types.ts`

#### 1-B: 환경변수 (`lib/env.ts`)
- [ ] V2에서 `requireEnv()` 누락된 10개 변수 포함 전수 등록
- [ ] `ADMIN_ID`/`ADMIN_PASSWORD` 미설정 시 인증 우회 차단 (CRITICAL 해결)

#### 1-C: 도메인 타입 (`lib/types/domain/`)
- [ ] `seller.ts`: `COMMISSION_RATES` 단일 소스 (5곳 분산 → 1곳 통합)
- [ ] `consignment.ts`: `ConsignmentStatus` 7값 완전 정의 (V2는 3값)
- [ ] `order.ts`: `OrderStatus` + `ALLOWED_TRANSITIONS` 맵 (상태 머신)
- [ ] `settlement.ts`: 통합 파이프라인 타입 (구/신 파이프라인 → 1개)
- [ ] `product.ts`, `notification.ts`, `photo.ts`

#### 1-D: API 입력 스키마 (`lib/types/api/requests.ts`)
- [ ] 모든 API 엔드포인트의 Zod 스키마 정의
- [ ] `sale_price`: `z.number().positive()` (null/0/음수 차단)
- [ ] `commission_rate`: `z.number().min(0.01).max(0.99)` (범위 강제)
- [ ] `referenceDate`: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` (Invalid Date 차단)
- [ ] 이것 하나로 req.json() 크래시 12건 + 경계값 다수 일괄 해결

#### 1-E: 유틸리티 통합 (`lib/utils/`)
- [ ] `phone.ts`: V2 2곳 통합 → `normalizePhone()` + `digitsOnly()`
- [ ] `brand.ts`: V2 4곳 통합 → `normalizeBrand()` + `fuzzyBrandMatch()` (볼리올리/보리올리 통일)
- [ ] `category.ts`: V2 3곳 통합 → `inferCategory()` + `CategorySlug` (재킷→jacket 통일)
- [ ] `currency.ts`: V2 3곳 통합 → `formatKRW()` + `parseKRW()` (부동소수점 → Math.round)
- [ ] `date.ts`: UTC/로컬 혼용 → KST 일관 사용 (`toKSTDate()`)
- [ ] `id.ts`: 주문번호 생성 통합 + DB UNIQUE 재시도 로직
- [ ] `supabase-chunks.ts`: `.in()` 100개 청크 분할 유틸
- [ ] `path.ts`: `sanitizePath()` — path.basename + resolve + startsWith 이중 검증

**Phase 1 해결하는 문제**: 총 약 55건
- CRITICAL: 인증 우회(`ADMIN_ID` 미설정), PostgREST 인젝션 4곳(Zod으로 사전 차단)
- HIGH: 커미션 5곳 분산, 상태 타입 불완전, 타임존 혼용, 경로 탐색 3곳
- 교리: 타입 안전성 기반 확보, `any` 근본 제거

---

### Phase 2: 데이터 접근 레이어 (Layer 2)

**목표**: Supabase 리포지토리 + RPC 트랜잭션 + 매퍼

#### 2-A: 리포지토리 (`lib/db/repositories/`)
- [ ] 6개 도메인별 리포지토리 (각 70-90줄)
- [ ] 모든 Supabase 작업 후 `{ data, error }` 반드시 확인 (9건 SILENT_DATA_LOSS 해결)
- [ ] 페이지네이션 필수 적용 (1000행 사일런트 절삭 해결)
- [ ] `.or()` 문자열 보간 전면 제거 → 파라미터화 메서드 사용 (PostgREST 인젝션 해결)

#### 2-B: 매퍼 (`lib/db/mappers/`)
- [ ] DB row → 도메인 타입 변환 (V2의 `mapOrder()` 등 라우트 내 인라인 로직 분리)
- [ ] null 안전 처리 (Non-null assertion 전면 제거)

#### 2-C: RPC 트랜잭션 (`lib/db/transactions/`)
- [ ] `settlement.tx.ts`: 정산 원자적 생성 (이중 정산 방지, FOR UPDATE 잠금)
- [ ] `order.tx.ts`: 주문+아이템 원자적 생성 (V2 고아 주문 방지)
- [ ] `consignment-complete.tx.ts`: 위탁 완료 4단계 원자적 처리 (stuck-consignment 방지)

**Phase 2 해결하는 문제**: 총 약 30건
- CRITICAL: 비원자적 트랜잭션 3곳, Supabase 에러 미확인 9곳
- HIGH: 고아 데이터 생성, match_status 불일치
- 1000행 절삭, `.in()` 100개 제한

---

### Phase 3: 인증 + API 인프라 (Layer 5 기반)

**목표**: 미들웨어 복원 + 인라인 가드 + 응답 표준화

#### 3-A: 미들웨어 (`middleware.ts`)
- [ ] 파일명 `middleware.ts` + 함수명 `middleware()` (V2 proxy.ts 근본 원인 해결)
- [ ] `/admin/*` 페이지: 세션 쿠키 검증 → 미인증 시 `/admin/login` 리다이렉트
- [ ] `/api/admin/*` API: 세션 쿠키 검증 → 미인증 시 `401` JSON
- [ ] `/api/admin/auth/login` 제외
- [ ] 레이트 리밋 통합

#### 3-B: 인라인 가드 (`lib/api/middleware.ts`)
- [ ] `requireAdmin()`: 미들웨어 우회 방어 (이중 보호)
- [ ] V2의 `lib/auth.ts` HMAC-SHA256 로직 재사용 (이미 잘 동작)

#### 3-C: 응답 표준화 (`lib/api/response.ts`)
- [ ] `ok<T>(data: T)` → `{ success: true, data }` + `200`
- [ ] `err(msg: string, status = 500)` → `{ success: false, error: msg }` + status
- [ ] `validationErr(msg: string)` → `{ success: false, error: msg }` + `400`
- [ ] V2의 44곳 불일치 → 단일 패턴으로 통합

**Phase 3 해결하는 문제**: 총 약 15건
- CRITICAL: 전체 인증 무효 (미들웨어 미작동)
- HIGH: API 인증 부재, Public API service role key 사용
- 교리: 에러 응답 44곳 불일치 → 표준화

---

### Phase 4: 비즈니스 로직 (Layer 3)

**목표**: 서비스 레이어 — 모든 비즈니스 로직의 단일 거처

#### 4-A: 정산 서비스 (`settlement.service.ts`)
- [ ] 구/신 파이프라인 → 1개 통합 파이프라인
- [ ] `generateSettlements()`: RPC 트랜잭션 위임, 커미션 `COMMISSION_RATES[tier]` 참조
- [ ] `confirmSettlement()`, `paySettlement()`: 상태 전이 검증 포함
- [ ] 부동소수점 → `Math.round()` 적용

#### 4-B: 주문 서비스 (`order.service.ts`)
- [ ] `createOrder()`: RPC 트랜잭션 위임, 주문번호 UNIQUE 재시도
- [ ] `updateOrderStatus()`: 상태 머신 `ALLOWED_TRANSITIONS` 검증
- [ ] `inspectOrder()`, `holdOrder()`

#### 4-C: 위탁 서비스 (`consignment.service.ts`)
- [ ] `completeConsignment()`: RPC 트랜잭션으로 4단계 원자적 처리
- [ ] `updateStatus()`: `.eq('status', expected)` 낙관적 잠금 (레이스 컨디션 방지)
- [ ] Excel 업로드: 배치 upsert (N+1 제거)

#### 4-D: 알림 서비스 (`notification.service.ts`)
- [ ] SMS 발송 + DB 로깅 통합
- [ ] dev mode 가짜 성공 제거 → `requireEnv()` 필수
- [ ] `paidMessage` 데드 코드 활성화 (지급 완료 SMS)
- [ ] 모든 상태 전환에 이벤트 기반 SMS 디스패치

#### 4-E: 사진 서비스 (`photo.service.ts`)
- [ ] Buffer 기반 파이프라인 (fs 의존 제거)
- [ ] PhotoRoom/Claude API 호출에 AbortController + 타임아웃 30초
- [ ] Claude API 빈 content 배열 검증

#### 4-F: 매칭 서비스 (`matching.service.ts`)
- [ ] `autoMatch()`: Promise.all 결과 검사 필수
- [ ] `manualMatch()`: 동일

**Phase 4 해결하는 문제**: 총 약 35건
- HIGH: 이중 정산, stuck-consignment, 상태 전이 미검증
- MEDIUM: SMS 미발송, NaN 전파, Promise.all 결과 무시
- 교리: 100줄 제한 (서비스 각 60-90줄)

---

### Phase 5: API 라우트 핸들러 (Layer 5)

**목표**: 52개 라우트 → 얇은 핸들러 (검증 → 서비스 위임 → 응답)

#### 표준 핸들러 패턴 (모든 라우트 적용)

```typescript
/**
 * POST /api/admin/settlement/generate — 정산 생성
 * WHY: V2는 163줄에 DB/비즈니스/HTTP 혼재, 이중 정산 위험
 * HOW: Zod 검증 → settlement.service 위임 → 표준 응답
 * WHERE: 정산 워크플로 큐 버튼
 */
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

#### 우선순위별 라우트 그룹

**Tier 1 — CRITICAL/FINANCIAL (먼저 구현)**
- [ ] `settlement/generate` (163줄 → 40줄)
- [ ] `settlement/queue-settlements` (289줄 → 60줄)
- [ ] `settlement/auto-match`, `manual-match`
- [ ] `admin/consignments/[id]` (496줄 → 60줄 + 핸들러 분리)
- [ ] `admin/orders` (220줄 → 80줄)
- [ ] `admin/auth/login` (인증 우회 차단)

**Tier 2 — HIGH (다음 구현)**
- [ ] `admin/notifications/*` (send-sms, resend, bulk-send — try/catch 없는 3곳)
- [ ] `admin/photos/*` (12개 라우트)
- [ ] `settlement/*` (나머지 10개 라우트)
- [ ] `consignment/adjust/*` (PUBLIC — req.json() 보호)

**Tier 3 — 나머지**
- [ ] `admin/products`, `admin/sellers`, `admin/sales`
- [ ] `orders/[productId]/hold`
- [ ] `health`, `ready`

**Phase 5 해결하는 문제**: 총 약 40건
- req.json() 미보호 12곳, try/catch 없는 8곳
- 모든 라우트 100줄 이내
- 교리: WHY/HOW/WHERE 헤더, `[api-name]` 로깅, `{success, error}` 응답

---

### Phase 6: 프론트엔드 (Layer 4)

**목표**: Server Component 활용, Tailwind 전면 전환, 공유 UI 라이브러리

#### 6-A: 공유 UI (`app/components/ui/`)
- [ ] `Modal.tsx` (V2 11개 독립 모달 오버레이 → 1개 통합)
- [ ] `StatusBadge.tsx` (V2 4곳 독립 → 1개 Tailwind)
- [ ] `StatCard.tsx`, `TableShell.tsx`, `FilterBar.tsx`
- [ ] `Toast.tsx` (V2 25+ `alert()` → 교체)
- [ ] `ConfirmDialog.tsx` (V2 6+ `confirm()` → 교체)

#### 6-B: Server Component 전환
- [ ] `AdminLayout`, `Sidebar` → Server Component
- [ ] `StatCard`, `StatusBadge`, `TableShell` → Server Component

#### 6-C: Client Component 최적화
- [ ] 모든 훅에 AbortController 표준화 (V2 2곳 누락)
- [ ] `dynamic()` import: ClassifyMatchModal, InspectionModal 등 무거운 모달
- [ ] `lib/api/client.ts` 활용 → `api.get<T>()` 제네릭

#### 6-D: 스타일 통합
- [ ] inline `style={{}}` 1,061회 → Tailwind 전면 전환
- [ ] `onMouseEnter`/`onMouseLeave` → CSS `hover:` 유틸리티
- [ ] 브랜드 컬러: `ORDER_STATUS_COLORS` 16진수 → Tailwind 클래스 맵

#### 6-E: 기능 페이지
- [ ] 정산 워크플로 페이지 → 새 서비스 연결
- [ ] 위탁 관리 페이지 → 새 서비스 연결
- [ ] 주문 관리 페이지 → 새 서비스 연결
- [ ] 사진 관리 페이지 → 새 서비스 연결
- [ ] 알림 관리 페이지 → 새 서비스 연결
- [ ] 판매자 관리, 상품 관리, 대시보드

**Phase 6 해결하는 문제**: 총 약 25건
- 코드 중복 DUP-01~10
- alert()/confirm() 남용
- AbortController 누락
- inline style 1,061회

---

### Phase 7: 스토리지 마이그레이션

**목표**: 로컬 파일시스템 → Supabase Storage

#### 7-A: Supabase Storage 설정
- [ ] `photos` 버킷 생성 (originals, processed, thumbnails)
- [ ] RLS 정책 설정 (admin만 업로드/삭제, 공개 읽기)

#### 7-B: 사진 파이프라인 전환
- [ ] `sharp` → Buffer 기반 처리 (fs.readFileSync 제거)
- [ ] PhotoRoom → presigned URL 또는 Buffer 전송
- [ ] HEIC 변환: 플랫폼 체크 (`process.platform !== 'darwin'` 시 대안)

#### 7-C: 데이터 마이그레이션
- [ ] 기존 사진 → Supabase Storage 업로드 스크립트
- [ ] `st_products.photos` JSONB URL 일괄 치환 스크립트
- [ ] 과도기: `storage-serve` 엔드포인트를 Storage 프록시로 유지

**Phase 7 해결하는 문제**: 총 약 10건
- HIGH: 파일시스템 사진 소실 (프로덕션 버그)
- 파일시스템 동시성 문제 4건
- TOCTOU 크래시

---

### Phase 8: 검증 + 경화

**목표**: 제로 결함 확인

#### 8-A: 자동 검증
```bash
# Zero any
tsc --strict --noEmit | grep "any" → 0건

# Zero inline style
grep -r "style={{" app/ → 0건

# Zero 타입 중복
grep -r "SellerTier" lib/ app/ → @/lib/types에서만 import

# 전체 라우트 인증
grep -r "requireAdmin" app/api/admin/ → 라우트 수와 일치

# 100줄 제한
wc -l app/api/**/*.ts → 모든 파일 100줄 이내

# 교리 헤더
grep -rL "WHY:" app/ lib/ → 0건

# PostgREST 인젝션 제로
grep -r "\.or(\`" lib/ app/ → 0건
grep -r '\.or(`' lib/ app/ → 0건

# Path traversal 제로
grep -r "path.join" app/api/ | grep -v "sanitizePath\|basename" → 0건
```

#### 8-B: 수동 검증
- [ ] 정산 생성 더블클릭 테스트 → 1건만 생성 확인
- [ ] 위탁 완료 중간 실패 시 롤백 확인
- [ ] 잘못된 JSON body → 400 응답 확인 (500 아님)
- [ ] PostgREST 인젝션 시도 → 차단 확인
- [ ] 파일 경로 조작 시도 → 차단 확인
- [ ] 1000건+ 데이터 조회 → 페이지네이션 동작 확인
- [ ] SMS 발송 확인 (모든 상태 전환)

#### 8-C: 빌드 체크
- [ ] `next build` → TypeScript 에러 0건
- [ ] Vercel 배포 테스트 → 정상 동작 확인
- [ ] `sharp` 네이티브 바이너리 호환 확인
- [ ] 번들 크기 50MB 미만 확인

---

## 5. 구현 후 리스크 대응표

| 리스크 | 등급 | 대응 |
|--------|------|------|
| Pipeline A `pending` 정산 고립 | HIGH | V3 배포 전 모든 pending 정산 완료 처리 |
| 기존 판매자 `commission_rate` 0.20 vs 신규 0.25 | HIGH | DB 값 유지, 신규만 `COMMISSION_RATES[tier]` 적용 |
| 사진 URL JSONB 일괄 재작성 | HIGH | 마이그레이션 스크립트 + 과도기 프록시 |
| 인증 활성화 시 비브라우저 API 중단 | HIGH | 서비스 토큰 메커니즘 또는 내부 호출 제외 |
| 타임존 변경 시 정산 경계 이동 | MEDIUM | 전환일 데이터 검증 + CI에 고정 타임존 |
| Dedup UNIQUE 인덱스 기존 중복 | MEDIUM | 마이그레이션 전 중복 정리 스크립트 |
| 진행 중 adjustment 토큰 링크 | MEDIUM | URL 구조 + 토큰 형식 유지 |
| 브랜드 스펠링 통합 (볼리올리/보리올리) | MEDIUM | 표준 스펠링 선택 + DB UPDATE 스크립트 |

---

## 6. 타임라인

### Plan A: 3일 공격적 일정

**전제**: 이미 V2를 충분히 분석했고, 핵심 패턴을 알고 있음. 팀 모드로 병렬 작업.

| 일차 | Phase | 작업 | 비고 |
|------|-------|------|------|
| **Day 1** | Phase 0 | DB 마이그레이션 (UNIQUE 5개 + RPC 3개) | 약 2시간 |
| | Phase 1 | 프로젝트 초기화 + 타입 + 유틸리티 | 약 4시간 |
| | Phase 2 | 리포지토리 6개 + 매퍼 3개 + 트랜잭션 3개 | 약 3시간 |
| | Phase 3 | 미들웨어 + 인라인 가드 + 응답 표준화 | 약 1시간 |
| **Day 2** | Phase 4 | 서비스 7개 | 약 5시간 |
| | Phase 5 Tier 1 | CRITICAL/FINANCIAL 라우트 10개 | 약 4시간 |
| | Phase 5 Tier 2 | HIGH 라우트 20개 | 약 3시간 |
| **Day 3** | Phase 5 Tier 3 | 나머지 라우트 22개 | 약 3시간 |
| | Phase 6 | 프론트엔드 핵심 페이지 (정산, 위탁, 주문) | 약 5시간 |
| | Phase 8 | 빌드 검증 + 수동 테스트 | 약 2시간 |

**Plan A 커버리지**:
- CRITICAL 10건 중 10건 해결 (100%)
- HIGH 55건 중 약 45건 해결 (~82%)
- **생략**: Phase 7 스토리지 마이그레이션, Phase 6 보조 페이지 (판매자, 상품, 대시보드)
- **위험**: 프론트엔드 품질 타협, 스토리지 문제 미해결

---

### Plan B: 15일 무결점 일정

**전제**: 모든 135건 실패 시나리오를 구조적으로 차단. 교리 v2.0 100% 준수.

| 일차 | Phase | 작업 | 검증 |
|------|-------|------|------|
| **Day 1-2** | Phase 0 | DB 마이그레이션 + 기존 데이터 정리 | 기존 중복 0건 확인 |
| **Day 2-3** | Phase 1 | 타입 + Zod + 유틸리티 | `tsc --noEmit` 에러 0 |
| **Day 4-5** | Phase 2 | 리포지토리 + 트랜잭션 + 매퍼 | 각 함수 단위 테스트 |
| **Day 5** | Phase 3 | 미들웨어 + 인증 | 인증 수동 테스트 |
| **Day 6-7** | Phase 4 | 서비스 7개 | 각 서비스 시나리오 테스트 |
| **Day 8-10** | Phase 5 | 전체 52개 라우트 | 모든 라우트 수동 테스트 |
| **Day 10-12** | Phase 6 | 프론트엔드 전체 | UI 수동 테스트 |
| **Day 12-13** | Phase 7 | 스토리지 마이그레이션 | 사진 URL 404 0건 |
| **Day 14** | Phase 8-A | 자동 검증 스크립트 실행 | 모든 체크 통과 |
| **Day 15** | Phase 8-B,C | 수동 검증 + 빌드 | Vercel 배포 성공 |

**Plan B 커버리지**:
- CRITICAL 10건 중 10건 해결 (100%)
- HIGH 55건 중 55건 해결 (100%)
- MEDIUM 41건 중 38건 해결 (~93%)
- LOW 29건 중 20건 해결 (~69%)
- **총 135건 중 123건 해결 (91%)** — 나머지 12건은 프로덕션 모니터링에서 대응

---

## 7. 팀 모드 구성

### 교리 v2.0 준수: PDCA + 팀 모드

```
사용자 요청 → /pdca plan → CTO Lead 전략
  → Phase별 팀원 배치:
    - Phase 0-1: 스키머(DB) + 빌더(타입/유틸)
    - Phase 2-3: 빌더(리포지토리/서비스) + 테스터(검증)
    - Phase 4-5: 빌더(서비스/라우트) + 리뷰어(코드 리뷰)
    - Phase 6: 빌더(프론트엔드) + 디렉터(UI/UX)
    - Phase 7-8: 빌더(마이그레이션) + 테스터(검증)
  → QA 검증 → 사용자 승인
```

---

## 8. 의존성 그래프 (빌드 순서)

```
Phase 0: DB 마이그레이션 ─────────────────────────┐
Phase 1: 타입 + 유틸리티 ─────────────────────┐   │
Phase 2: 리포지토리 + 트랜잭션 ←── Phase 1 + Phase 0
Phase 3: 미들웨어 + 인증 ←── Phase 1           │
Phase 4: 서비스 ←── Phase 2 + Phase 3          │
Phase 5: API 라우트 ←── Phase 4 + Phase 3      │
Phase 6: 프론트엔드 ←── Phase 5                │
Phase 7: 스토리지 (Phase 2 이후 언제든 병렬 가능) ──┘
Phase 8: 검증 ←── Phase 5 + Phase 6 + Phase 7
```

**병렬 가능 작업**:
- Phase 1과 Phase 0 (독립적)
- Phase 3과 Phase 2 (Phase 1 완료 후 병렬)
- Phase 7과 Phase 4-6 (Phase 2 완료 후 병렬)

---

## 9. 핵심 파일 참조 (V2 → V3 매핑)

| V2 파일 (문제) | V3 대체 | 해결하는 문제 |
|---------------|---------|-------------|
| `proxy.ts` (미들웨어 미작동) | `middleware.ts` | CRITICAL: 전체 인증 무효 |
| `settlement/generate/route.ts` (163줄, 이중 정산) | `settlement/generate/route.ts` (40줄) + `settlement.service.ts` + `settlement.tx.ts` | CRITICAL: 이중 정산 |
| `consignments/[id]/route.ts` (496줄, stuck-consignment) | `consignments/[id]/route.ts` (60줄) + `consignment.service.ts` + `consignment-complete.tx.ts` | HIGH: stuck-consignment |
| `lib/settlement/types.ts` + 4곳 (커미션 분산) | `lib/types/domain/seller.ts` (단일 소스) | HIGH: 커미션 불일치 |
| `lib/settlement/phone-normalizer.ts` + 인라인 (2곳) | `lib/utils/phone.ts` | MEDIUM: 전화번호 매칭 실패 |
| `lib/brand-aliases.ts` + 3곳 (4곳 분산) | `lib/utils/brand.ts` | MEDIUM: 브랜드 매칭 불일치 |
| `lib/settlement/helpers.ts` (UTC/로컬 혼용) | `lib/utils/date.ts` (KST 일관) | HIGH: 정산 기간 1일 오차 |
| `lib/api/response.ts` (미사용) | `lib/api/response.ts` (전면 채택) | 교리: 44곳 에러 응답 불일치 |

---

## 10. 성공 기준 체크리스트

### 보안
- [ ] `middleware.ts` 활성화 확인 (미들웨어 매니페스트에 등록)
- [ ] 모든 `/api/admin/*` 라우트 인증 확인
- [ ] PostgREST 인젝션 `.or()` 문자열 보간 0건
- [ ] 경로 탐색 취약점 0건

### 금전적 정확성
- [ ] `settlement_queue.match_id` UNIQUE 제약 확인
- [ ] 정산 RPC 트랜잭션 원자성 확인
- [ ] 커미션 정의 `lib/types/domain/seller.ts` 단일 소스 확인
- [ ] 부동소수점 → `Math.round()` 적용 확인

### 데이터 무결성
- [ ] UNIQUE 제약 5개 적용 확인
- [ ] 모든 상태 전환에 `.eq('status', expected)` 포함
- [ ] Supabase 에러 미확인 0건
- [ ] 1000행 절삭 → 페이지네이션 적용 확인

### 코드 품질
- [ ] `tsc --strict --noEmit` 에러 0건
- [ ] `any` 사용 0건
- [ ] 모든 파일 100줄 이내 (예외: 타입/설정 200줄)
- [ ] 모든 파일 WHY/HOW/WHERE 헤더
- [ ] inline `style={{}}` 0건

---

*이 플랜은 4차에 걸친 리서치 (총 220건+ 발견 사항)를 기반으로 작성되었습니다.*
*교리 v2.0 기준: 팀 모드 필수, PDCA 워크플로, 구현 전 계획 승인 필수.*
