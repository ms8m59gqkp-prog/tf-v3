# Classic Menswear V3 — 최종 마스터 구현 플랜 (Rev.3)

**작성일**: 2026-03-01
**근거**: plan3 Rev.2 + audit2 FIX-01~18 + pa1-report IMP-01~13 + 세션별 시뮬레이션 15회
**교리**: 클로드코드교리 v2.0
**원칙**: 코드 한 줄 한 줄이 존재 이유를 가져야 한다. 의미 없는 코드는 쓰지 않는다.

---

## Rev.3 변경 요약 (Rev.2 대비)

| # | 변경 | 근거 | 영향 |
|---|------|------|------|
| R3-01 | 5레이어 → 3+1레이어 단순화 | pa1 WHY-10, audit2 A-3.1 | §3 전면 재설계 |
| R3-02 | 성능 인덱스 6개 Phase 0 추가 | audit2 FIX-02, SIM-08 | §5 확장 |
| R3-03 | RLS 정책 설계 추가 | audit2 FIX-03, pa1 IMP-03 | §5 + §8 확장 |
| R3-04 | 테스트 전략 Phase별 내장 | audit2 FIX-01, pa1 IMP-01 | 신규 §9 |
| R3-05 | CI/CD 파이프라인 추가 | audit2 FIX-05, pa1 IMP-05 | 신규 §10 |
| R3-06 | Sentry 모니터링 추가 | audit2 FIX-06, pa1 IMP-06 | §10 |
| R3-07 | Zod co-location 전략 | audit2 FIX-07, pa1 IMP-07 | §6 전면 변경 |
| R3-08 | 라우트 수 62개 정정 | audit2 FIX-08, SIM-05 | §7 정정 |
| R3-09 | 줄수 제한 세분화 | audit2 FIX-12, pa1 IMP-11 | 전체 |
| R3-10 | 스토리지 마이그레이션 멱등성 | audit2 FIX-10, pa1 IMP-09 | §8 확장 |
| R3-11 | 배치 부분 성공 처리 | audit2 FIX-11, pa1 IMP-10 | §7 확장 |
| R3-12 | SWR 구체 전략 | audit2 FIX-15, pa1 IMP-13 | §8 확장 |
| R3-13 | V2→V3 전환 런북 분 단위 | audit2 FIX-04, pa1 IMP-04 | §11 전면 재설계 |
| R3-14 | ESLint 기반 검증 게이트 | pa1 IMP-08 | 전 Phase 검증 보강 |
| R3-15 | 매퍼 파일 제거, 리포지토리에 통합 | audit2 FIX-14 | §6 파일 수 감소 |
| R3-16 | 세션별 구현 전략 신규 | pa1 VALID-09 | 신규 §13 |
| R3-17 | 적대적 시뮬레이션 15회 | pa1 CHECK-12 | §15 전면 교체 |
| R3-18 | RPC 엣지 케이스 보강 | pa1 CHECK-06 | §5 SQL 수정 |

---

## 목차

1. [아키텍처 블루프린트 (3+1레이어)](#1-아키텍처-블루프린트)
2. [줄수 제한 규칙](#2-줄수-제한-규칙)
3. [Phase 0: DB 마이그레이션 + 인덱스 + RLS](#3-phase-0)
4. [Phase 1: 인프라 + 타입 + 유틸](#4-phase-1)
5. [Phase 2: 데이터 레이어 (리포지토리 + 트랜잭션)](#5-phase-2)
6. [Phase 3: 미들웨어 + 인증](#6-phase-3)
7. [Phase 4: 서비스 레이어](#7-phase-4)
8. [Phase 5: API 라우트 (62개)](#8-phase-5)
9. [Phase 6: 프론트엔드](#9-phase-6)
10. [Phase 7: 스토리지 마이그레이션](#10-phase-7)
11. [Phase 8: 검증 + CI/CD + 모니터링](#11-phase-8)
12. [테스트 전략](#12-테스트-전략)
13. [세션별 구현 전략](#13-세션별-구현-전략)
14. [V2→V3 전환 런북](#14-전환-런북)
15. [적대적 시뮬레이션 15회](#15-시뮬레이션)
16. [실패 근본 원인 분석 10회](#16-실패-분석)
17. [개선 방향 탐색 10회](#17-개선-방향)

---

## 1. 아키텍처 블루프린트

### 1.1 3+1레이어 (Rev.2의 5레이어에서 단순화)

```
L0: 인프라
  lib/env.ts, lib/supabase/, lib/auth.ts, lib/ratelimit.ts

L1: 비즈니스
  lib/types/       — 도메인 타입 + Zod 공용 스키마
  lib/utils/       — 순수 함수 유틸리티
  lib/db/          — 리포지토리 (매핑 내장) + RPC 래퍼
  lib/services/    — 비즈니스 오케스트레이션
  lib/calculators/ — 순수 계산 함수

L2: UI
  app/admin/components/ — 공유 컴포넌트
  app/admin/hooks/      — 클라이언트 훅

L3: 엔트리포인트
  app/api/**/route.ts   — API 핸들러
  app/admin/**/page.tsx — 페이지
```

**왜 3+1레이어인가**:
- 5레이어는 관리자 1-2명 내부 도구에 과잉 (pa1 WHY-10)
- 매퍼 파일 별도 분리 → 파일 수 증가 → 네비게이션 비용 → 실수 확률 증가
- "+1"은 필요 시 점진적 분리: 서비스 200줄 초과 시 리포지토리 분리 허용

**의존성 규칙**:
- 하위 레이어만 import (L3→L1 가능, L1→L3 금지)
- L1 내부에서 services → db → types 방향만 허용
- 순환 참조 절대 금지
- L1(서비스)에서 NextRequest/NextResponse import 절대 금지

### 1.2 디렉토리 구조

```
tf-v3/
├── middleware.ts                       ← Next.js 자동 인식 (SEC-01)
├── .github/workflows/ci.yml           ← [Rev.3] CI/CD
├── sentry.client.config.ts            ← [Rev.3] Sentry
├── sentry.server.config.ts            ← [Rev.3] Sentry
├── vitest.config.ts                   ← [Rev.3] 테스트
├── .env.example                       ← [Rev.3] 환경변수 관리
├── lib/
│   ├── env.ts                          ← requireEnv()
│   ├── auth.ts                         ← HMAC-SHA256 세션
│   ├── ratelimit.ts                    ← Upstash
│   ├── supabase/
│   │   ├── admin.ts                    ← service_role (admin API용)
│   │   └── client.ts                   ← anon (Public용)
│   ├── types/
│   │   ├── index.ts                    ← barrel export
│   │   └── domain/
│   │       ├── seller.ts              ← SellerTier, COMMISSION_RATES 단일 소스
│   │       ├── consignment.ts         ← 7값 상태 + 전환 맵
│   │       ├── order.ts              ← 8값 상태 + 전환 맵
│   │       ├── settlement.ts         ← 통합 파이프라인 타입
│   │       ├── product.ts
│   │       ├── notification.ts
│   │       └── photo.ts
│   ├── utils/
│   │   ├── validation.ts              ← [Rev.3] 공용 Zod 스키마만 (5개)
│   │   ├── phone.ts
│   │   ├── brand.ts
│   │   ├── category.ts
│   │   ├── currency.ts
│   │   ├── date.ts
│   │   ├── id.ts
│   │   ├── sms-templates.ts
│   │   ├── excel.ts
│   │   ├── chunk.ts
│   │   └── path.ts
│   ├── db/
│   │   ├── client.ts
│   │   ├── repositories/
│   │   │   ├── sellers.repo.ts        ← 매핑 내장 (매퍼 파일 없음)
│   │   │   ├── orders.repo.ts
│   │   │   ├── consignments.repo.ts
│   │   │   ├── settlement.repo.ts
│   │   │   ├── products.repo.ts
│   │   │   ├── notifications.repo.ts
│   │   │   ├── sales-records.repo.ts
│   │   │   └── naver-settlements.repo.ts
│   │   └── transactions/
│   │       ├── settlement.tx.ts
│   │       ├── order.tx.ts
│   │       └── consignment.tx.ts
│   ├── services/
│   │   ├── settlement.service.ts      ← 150줄 이내
│   │   ├── matching.service.ts
│   │   ├── order.service.ts
│   │   ├── consignment.service.ts
│   │   ├── notification.service.ts
│   │   ├── photo.service.ts
│   │   └── sale-detector.service.ts
│   ├── calculators/
│   │   ├── settlement.calc.ts
│   │   └── price-estimator.calc.ts
│   └── api/
│       ├── response.ts                ← ok(), err(), validationErr()
│       └── middleware.ts              ← requireAdmin()
├── app/
│   ├── api/                            ← 62개 라우트
│   │   └── [각 라우트]/
│   │       ├── route.ts               ← 100줄 이내
│   │       └── schema.ts             ← [Rev.3] co-located Zod 스키마
│   └── admin/
│       ├── components/                 ← 공유 UI
│       ├── hooks/                      ← 클라이언트 훅
│       └── [각 페이지]/               ← 15개 어드민 + 2개 Public
├── supabase/
│   └── migrations/                     ← 6개 마이그레이션 + 3개 RPC
└── __tests__/                          ← [Rev.3] 테스트
    ├── unit/                           ← Zod/유틸 단위 테스트
    ├── integration/                    ← RPC 통합 테스트
    └── e2e/                            ← CRITICAL 라우트 E2E
```

---

## 2. 줄수 제한 규칙

Rev.2의 일률적 100줄에서 역할별 세분화.

| 대상 | 제한 | 근거 |
|------|------|------|
| **함수** (개별 함수) | 80줄 | 단일 책임 원칙. 80줄 넘으면 분리 대상 |
| **API 라우트** (route.ts) | 100줄 | 얇은 핸들러: 인증→검증→위임→응답 |
| **서비스** (*.service.ts) | 150줄 | 관련 함수 3-4개가 한 파일에 공존 허용 (pa1 WHY-09) |
| **컴포넌트** (*.tsx) | 150줄 | 상태 + 렌더링이 한 파일 (hook 분리 시 줄어듦) |
| **리포지토리** (*.repo.ts) | 120줄 | 매핑 내장으로 기존 100줄에서 완화 |
| **타입/설정** | 200줄 | 타입 정의는 길어질 수 있음 |
| **테스트** | 제한 없음 | 테스트는 명확성 > 간결성 |

**왜 이 숫자인가**:
- 80줄(함수): 스크롤 없이 한 화면에 로직 파악 가능
- 100줄(라우트): 인증(5줄) + 검증(5줄) + 위임(10줄) + 에러처리(10줄) = 30줄 본체 + 70줄 여유
- 150줄(서비스): settlement.service의 generate(60) + confirm(25) + pay(30) = 115줄 → 150줄 내 수용 (파일 분리 시 순환 의존 발생 방지)

---

## 3. Phase 0: DB 마이그레이션 + 인덱스 + RLS

### 3.1 마이그레이션 파일 (6개 — Rev.2의 5개에서 인덱스 1개 추가)

#### 3.1.1 ConsignmentStatus CHECK 확장
```sql
-- 001_consignment_status_check.sql
-- WHY: V2 DB CHECK 5값, TypeScript 7값 → 불일치 (에이전트1 발견)
-- HOW: DROP + ADD로 CHECK 재생성
ALTER TABLE consignment_requests
  DROP CONSTRAINT IF EXISTS consignment_requests_status_check;
ALTER TABLE consignment_requests
  ADD CONSTRAINT consignment_requests_status_check
  CHECK (status IN (
    'pending','received','inspecting','approved',
    'on_hold','rejected','completed'
  ));
```

#### 3.1.2 UNIQUE 제약 5건
```sql
-- 002_unique_constraints.sql
-- WHY: 이중 정산(FIN-01), 판매자 중복(H5/H6), 상품번호 충돌(H19)
-- HOW: 각 제약 전 중복 확인 쿼리 실행 → 정리 → 제약 추가

-- [사전 조건] 각 테이블 중복 확인 쿼리 실행 필수
-- [사전 조건] 외래키 참조 테이블 4개(consignment_requests, sold_items,
--            settlement_queue, st_products) 고아 참조 정리

ALTER TABLE settlement_queue
  ADD CONSTRAINT uq_settlement_queue_match UNIQUE (match_id);
ALTER TABLE sellers
  ADD CONSTRAINT uq_sellers_phone UNIQUE (phone);
ALTER TABLE sellers
  ADD CONSTRAINT uq_sellers_code UNIQUE (seller_code);
ALTER TABLE return_shipments
  ADD CONSTRAINT uq_return_consignment UNIQUE (consignment_id);
ALTER TABLE st_products
  ADD CONSTRAINT uq_st_products_number UNIQUE (product_number);
```

#### 3.1.3 [Rev.3] 성능 인덱스 (audit2 FIX-02)
```sql
-- 003_performance_indexes.sql
-- WHY: RPC FOR UPDATE가 인덱스 없이 풀스캔 → 타임아웃 (SIM-08)
--      인덱스는 "최적화"가 아닌 "기능 요구사항" (pa1 WHY-02)
-- HOW: CONCURRENTLY로 무중단 생성

CREATE INDEX CONCURRENTLY idx_sold_items_seller_settlement
  ON sold_items(seller_id, settlement_status);
-- 이유: create_settlement_with_items RPC에서
--   WHERE id = ANY(ids) AND settlement_status = 'pending' FOR UPDATE
--   50명 x 200건 = 10,000건 → 인덱스 없으면 30초+ 타임아웃

CREATE INDEX CONCURRENTLY idx_orders_status
  ON orders(status);
-- 이유: 주문 목록 조회에서 status 필터링 빈번

CREATE INDEX CONCURRENTLY idx_sales_records_match
  ON sales_records(match_status);
-- 이유: auto-match에서 미매칭 레코드 조회

CREATE INDEX CONCURRENTLY idx_settlement_queue_seller
  ON settlement_queue(seller_id);
-- 이유: 판매자별 정산 큐 조회

CREATE INDEX CONCURRENTLY idx_consignment_requests_seller
  ON consignment_requests(seller_id, status);
-- 이유: 판매자별 위탁 목록 + 상태 필터
```

#### 3.1.4 [Rev.3] RLS 정책 (audit2 FIX-03, pa1 IMP-03)
```sql
-- 004_rls_policies.sql
-- WHY: anon client가 RLS 없이 전체 테이블 접근 가능 (SEC-05)
--      "anon = 안전"은 오해. RLS만이 행 수준 접근 제어 (pa1 WHY-03)
-- HOW: Public 페이지가 접근하는 테이블에만 RLS 적용
--      Admin은 service_role → RLS 자동 우회

-- 위탁 가격조정 페이지용
ALTER TABLE consignment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY consignment_anon_read ON consignment_requests
  FOR SELECT TO anon
  USING (adjustment_token IS NOT NULL AND adjustment_token = current_setting('request.headers', true)::json->>'x-adjustment-token');
-- 의미: anon 사용자는 자신의 adjustment_token과 일치하는 행만 읽기 가능
-- adjustment_token 없는 요청은 0건 반환 (안전한 실패)

-- 주문 보류 페이지용
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_anon_read ON orders
  FOR SELECT TO anon USING (true);
-- 의미: 주문 조회는 Public 허용 (상품 페이지에서 재고 확인 필요)
CREATE POLICY orders_anon_update ON orders
  FOR UPDATE TO anon
  USING (status = 'IMAGE_COMPLETE');
-- 의미: IMAGE_COMPLETE 상태인 주문만 보류 가능 (다른 상태 변경 차단)

-- admin은 service_role 사용 → 이 RLS 규칙에 영향 없음
```

#### 3.1.5 RPC 3개 (빈 배열 엣지 케이스 보강)
```sql
-- 005_rpc_settlement.sql
CREATE OR REPLACE FUNCTION create_settlement_with_items(
  p_seller_id uuid,
  p_period_start date,
  p_period_end date,
  p_total_sales numeric,
  p_commission_rate numeric,
  p_commission_amount numeric,
  p_settlement_amount numeric,
  p_sold_item_ids uuid[]
) RETURNS uuid AS $$
DECLARE
  v_settlement_id uuid;
  v_locked_count int;
  v_expected_count int;
BEGIN
  -- [Rev.3] 빈 배열 엣지 케이스 (pa1 CHECK-06)
  v_expected_count := COALESCE(array_length(p_sold_item_ids, 1), 0);
  IF v_expected_count = 0 THEN
    RAISE EXCEPTION '정산 항목이 비어있습니다 (sold_item_ids가 빈 배열)';
  END IF;

  -- Step 1: FOR UPDATE 잠금
  SELECT COUNT(*) INTO v_locked_count
    FROM sold_items
    WHERE id = ANY(p_sold_item_ids)
      AND settlement_status = 'pending'
    FOR UPDATE;

  -- Step 2: 잠금 검증
  IF v_locked_count != v_expected_count THEN
    RAISE EXCEPTION '잠금 실패: 예상 %건 중 %건만 pending (나머지는 이미 정산됨)',
      v_expected_count, v_locked_count;
  END IF;

  -- Step 3: 정산 생성
  INSERT INTO settlements (
    seller_id, period_start, period_end,
    total_sales, commission_rate, commission_amount, settlement_amount,
    settlement_status
  ) VALUES (
    p_seller_id, p_period_start, p_period_end,
    p_total_sales, p_commission_rate, p_commission_amount, p_settlement_amount,
    'pending'
  ) RETURNING id INTO v_settlement_id;

  -- Step 4: 항목 연결
  INSERT INTO settlement_items (settlement_id, sold_item_id)
    SELECT v_settlement_id, unnest(p_sold_item_ids);

  -- Step 5: 상태 업데이트
  UPDATE sold_items
    SET settlement_status = 'settled'
    WHERE id = ANY(p_sold_item_ids);

  RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql;
```

```sql
-- 006_rpc_order.sql
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_order_number text,
  p_customer_name text,
  p_customer_phone text,
  p_status text,
  p_items jsonb
) RETURNS uuid AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_items_count int;
BEGIN
  -- [Rev.3] 빈 아이템 방어 (pa1 CHECK-06)
  v_items_count := jsonb_array_length(p_items);
  IF v_items_count = 0 THEN
    RAISE EXCEPTION '주문 아이템이 비어있습니다';
  END IF;

  INSERT INTO orders (order_number, customer_name, phone, status)
  VALUES (p_order_number, p_customer_name, p_customer_phone, p_status)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    -- [Rev.3] 필수 필드 NULL 검증
    IF v_item->>'product_number' IS NULL THEN
      RAISE EXCEPTION '주문 아이템에 product_number가 누락되었습니다';
    END IF;

    INSERT INTO order_items (
      order_id, product_number, brand, category,
      condition, size, color, measurements
    ) VALUES (
      v_order_id,
      v_item->>'product_number',
      v_item->>'brand',
      v_item->>'category',
      v_item->>'condition',
      v_item->>'size',
      v_item->>'color',
      (v_item->'measurements')::jsonb
    );
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;
```

```sql
-- 007_rpc_consignment.sql
-- complete_consignment은 Rev.2와 동일 (4단계 원자적 처리)
-- 변경점: Step 2에서 product_number UNIQUE 위반 시 명확한 에러 메시지
```

### 3.2 Phase 0 검증 게이트
```
□ ConsignmentStatus CHECK 7값 확인
□ UNIQUE 5개 적용: \d+ [테이블명]
□ 인덱스 5개 생성 확인: \di+ idx_*
□ RLS 정책 2개 테이블 활성화: SELECT tablename FROM pg_tables WHERE rowsecurity = true;
□ RPC 3개 생성: SELECT routine_name FROM information_schema.routines WHERE routine_type = 'FUNCTION';
□ RPC 단위 테스트: 빈 배열 → 에러, 정상 배열 → uuid 반환
□ RPC 동시 실행 테스트: 2개 세션에서 동일 sold_items FOR UPDATE → 1개만 성공
□ 기존 중복 데이터 0건 확인 (정리 완료)
```

---

## 4. Phase 1: 인프라 + 타입 + 유틸

### 4.1 생성 파일 (22개 — Rev.2의 27개에서 매퍼 3개 제거, requests.ts 축소)

```
lib/env.ts                        ← V2 그대로 + 누락 변수 10개 + Sentry DSN
lib/supabase/admin.ts             ← V2 그대로
lib/supabase/client.ts            ← V2 그대로
lib/auth.ts                       ← V2 기반 + bcrypt cost 12 명시
lib/ratelimit.ts                  ← V2 기반 + null 에러 처리
lib/types/index.ts
lib/types/domain/seller.ts        ← COMMISSION_RATES 유일한 소스
lib/types/domain/consignment.ts   ← 7값 + CONSIGNMENT_TRANSITIONS
lib/types/domain/order.ts         ← 8값 + ALLOWED_TRANSITIONS
lib/types/domain/settlement.ts
lib/types/domain/product.ts
lib/types/domain/notification.ts
lib/types/domain/photo.ts
lib/utils/validation.ts           ← [Rev.3] 공용 Zod 5개만
lib/utils/phone.ts
lib/utils/brand.ts
lib/utils/category.ts
lib/utils/currency.ts
lib/utils/date.ts
lib/utils/id.ts
lib/utils/sms-templates.ts
lib/utils/excel.ts
lib/utils/chunk.ts
lib/utils/path.ts                 ← [Rev.3] fs.realpathSync 추가 (SEC-03 symlink)
```

### 4.2 [Rev.3] Zod co-location 전략 (audit2 FIX-07)

**Phase 1에서 정의하는 것** — lib/utils/validation.ts:
```typescript
/**
 * 공용 Zod 스키마 5개만 정의
 * WHY: 라우트별 스키마는 라우트 옆에 co-locate (연쇄 변경 방지)
 * HOW: 여러 라우트에서 공통으로 사용하는 원자적 스키마만
 */
import { z } from 'zod'

export const PhoneSchema = z.string().regex(/^01[016789]-?\d{3,4}-?\d{4}$/)
export const UuidSchema = z.string().uuid()
export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const PositiveAmountSchema = z.number().positive()
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
})
// 5개만. 나머지는 Phase 5에서 각 route.ts 옆에 schema.ts로 정의
```

**Phase 5에서 정의하는 것** — 각 라우트 디렉토리:
```
app/api/settlement/generate/
  ├── route.ts    ← 핸들러
  └── schema.ts   ← GenerateSettlementSchema (이 라우트 전용)

app/api/admin/orders/
  ├── route.ts
  └── schema.ts   ← CreateOrderSchema, UpdateOrderStatusSchema
```

**왜 이 방식인가**:
- Pa1 WHY-07: "V2 재현 = 요구사항 확정"은 가정 오류. V2 코드 암묵적 로직이 많아 사전 확정 불가
- Audit2 SIM-02: Phase 1 스키마 → Phase 5 발견 → Phase 1 수정 → Phase 2 연쇄 → 시간 낭비
- Co-location: 스키마 변경 시 같은 디렉토리의 route.ts만 영향 → 연쇄 변경 0

### 4.3 [Rev.3] path.ts symlink 방어 (SEC-03 보강)
```typescript
/**
 * 파일 경로 안전 검증
 * WHY: Path Traversal + symlink 공격 방지 (v5 SEC-03, pa1 CHECK-07)
 * HOW: basename으로 디렉토리 탈출 차단 + realpathSync로 symlink 해석
 */
import path from 'path'
import fs from 'fs'

export function sanitizePath(basePath: string, userInput: string): string {
  const fileName = path.basename(userInput)
  const fullPath = path.join(basePath, fileName)
  // symlink 해석 후 실제 경로가 basePath 내인지 확인
  const realPath = fs.realpathSync(fullPath)
  if (!realPath.startsWith(fs.realpathSync(basePath))) {
    throw new Error(`경로 탈출 시도 차단: ${userInput}`)
  }
  return realPath
}
```

### 4.4 Phase 1 검증 게이트
```
□ tsc --strict --noEmit → 에러 0건
□ vitest run __tests__/unit/ → 공용 스키마 5개 + 유틸 함수 테스트 PASS
□ ConsignmentStatus 7값 확인
□ COMMISSION_RATES가 seller.ts에서만 export: grep -r "COMMISSION_RATES" lib/
□ lib/utils/validation.ts에 스키마 5개만 (과잉 정의 방지)
□ ESLint: @typescript-eslint/no-explicit-any → 0건
```

---

## 5. Phase 2: 데이터 레이어

### 5.1 생성 파일 (11개 — Rev.2의 16개에서 매퍼 3개 제거, index 2개 통합)

```
lib/db/client.ts
lib/db/repositories/sellers.repo.ts        ← 90줄 (매핑 내장)
lib/db/repositories/orders.repo.ts         ← 110줄
lib/db/repositories/consignments.repo.ts   ← 100줄
lib/db/repositories/settlement.repo.ts     ← 110줄
lib/db/repositories/products.repo.ts       ← 80줄
lib/db/repositories/notifications.repo.ts  ← 60줄
lib/db/repositories/sales-records.repo.ts  ← 70줄
lib/db/repositories/naver-settlements.repo.ts ← 70줄
lib/db/transactions/settlement.tx.ts
lib/db/transactions/order.tx.ts
lib/db/transactions/consignment.tx.ts
```

### 5.2 리포지토리 핵심 원칙 (5개 — 모두 V2 문제에서 유래)

```typescript
// 원칙 1: 모든 { data, error } 필수 확인 (V2 9건 미확인)
const { data, error } = await supabase.from('sellers').select('*')
if (error) throw new Error(`sellers 조회 실패: ${error.message}`)
// "error"를 무시하는 코드는 존재해서는 안 된다

// 원칙 2: .in() 호출 시 chunkArray(100) (V2 H10)
const chunks = chunkArray(ids, 100)
const results = await Promise.all(chunks.map(chunk =>
  supabase.from('sold_items').select('*').in('id', chunk)
))
// 100개 초과 .in()은 Supabase가 무시 → 데이터 누락

// 원칙 3: 목록 쿼리에 .range() 강제 (V2 DAT-01 1000행 절삭)
const { data, count } = await supabase
  .from('orders').select('*', { count: 'exact' })
  .range(from, to)
// .range() 없는 목록 쿼리는 1000건에서 잘림 → 조용한 데이터 손실

// 원칙 4: .or() 문자열 보간 전면 제거 (V2 SEC-04)
// ❌ .or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
// ✅ .ilike('name', `%${search}%`) 또는 RPC 사용

// 원칙 5: 상태 UPDATE에 .eq('status', expected) (V2 DAT-08)
const { data, error } = await supabase
  .from('consignment_requests')
  .update({ status: 'completed' })
  .eq('id', id)
  .eq('status', 'approved')  // 낙관적 잠금: approved일 때만 completed로 변경
  .select()
  .single()
if (!data) throw new Error('상태가 이미 변경됨 (다른 관리자)')
```

### 5.3 매핑 내장 패턴 (매퍼 파일 제거)
```typescript
// sellers.repo.ts 내부
// WHY: 별도 mapper.ts는 파일 수만 증가, 실질적 가치 없음 (audit2 FIX-14)
function mapRow(row: DbSeller): Seller {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    tier: row.tier as SellerTier,
    commissionRate: row.commission_rate,
  }
}

export async function getByPhone(phone: string): Promise<Seller | null> {
  const { data, error } = await supabase
    .from('sellers').select('*').eq('phone', phone).maybeSingle()
  if (error) throw new Error(`판매자 조회 실패: ${error.message}`)
  return data ? mapRow(data) : null
}
```

### 5.4 Phase 2 검증 게이트
```
□ tsc --strict --noEmit → 에러 0건
□ ESLint: grep -r "\.or(\`" lib/db/ → 0건 (PostgREST 인젝션 0)
□ 모든 리포지토리에서 error 체크: grep -r "if.*error.*throw" lib/db/repositories/ → 파일 수와 일치
□ .range() 사용: grep -r "\.range(" lib/db/repositories/ → 목록 함수 수와 일치
□ chunkArray 사용: grep -r "chunkArray" lib/db/repositories/ → .in() 사용 횟수와 일치
□ 매퍼 파일 0개: ls lib/db/mappers/ → 디렉토리 없음
□ 리포지토리 120줄 이내: wc -l lib/db/repositories/*.ts
```

---

## 6. Phase 3: 미들웨어 + 인증

(Rev.2와 동일. middleware.ts + lib/api/middleware.ts 2개 파일)

### 6.1 [Rev.3] bcrypt cost 명시 (SEC-02 보강)
```typescript
// lib/auth.ts
const BCRYPT_COST = 12 // 기본값 10은 브루트포스 위험 (pa1 CHECK-07)
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}
```

### 6.2 [Rev.3] CORS 설정 (SEC-08 보강)
```typescript
// middleware.ts 내
if (path.startsWith('/api/consignment') || path.startsWith('/api/orders')) {
  const response = NextResponse.next()
  response.headers.set('Access-Control-Allow-Origin', requireEnv('ALLOWED_ORIGIN'))
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH')
  return response
}
```

---

## 7. Phase 4: 서비스 레이어

### 7.1 생성 파일 (9개 — Rev.2와 동일)

모든 서비스 150줄 이내. 함수 80줄 이내.

### 7.2 [Rev.3] 배치 부분 성공 처리 (audit2 FIX-11, pa1 IMP-10)

```typescript
// photo.service.ts의 classify 함수 재설계
// WHY: Claude API 한도 도달 시 200/500장만 성공 → 나머지 추적 불가 (SIM-10)

interface BatchResult {
  batchId: string
  total: number
  completed: number
  failed: number
  failedIds: string[]
  status: 'running' | 'completed' | 'partial' | 'failed'
}

export async function classifyBatch(
  productIds: string[]
): Promise<BatchResult> {
  const batchId = crypto.randomUUID()
  const result: BatchResult = {
    batchId, total: productIds.length, completed: 0, failed: 0,
    failedIds: [], status: 'running'
  }

  for (const id of productIds) {
    try {
      await classifySingle(id) // 개별 분류 (AbortController + 30초 타임아웃)
      result.completed++
    } catch (err) {
      result.failed++
      result.failedIds.push(id)
      // 429 Too Many Requests → 중단하고 partial 반환
      if (err instanceof Error && err.message.includes('429')) {
        result.status = 'partial'
        result.failedIds.push(...productIds.slice(productIds.indexOf(id) + 1))
        break
      }
    }
  }

  if (result.status === 'running') {
    result.status = result.failed === 0 ? 'completed' : 'partial'
  }
  // DB에 배치 결과 기록 → 나중에 failedIds로 재시도 가능
  await notifications.repo.logBatch(result)
  return result
}
```

### 7.3 [Rev.3] SWR 캐싱 전략 (audit2 FIX-15, pa1 IMP-13)

```typescript
// 서비스 레이어에서 SWR 전략을 코드로 강제하지 않음
// 대신, 각 API 응답에 캐시 힌트를 포함:

// lib/api/response.ts
export function ok<T>(data: T, cacheHint?: { revalidate: number }) {
  const headers: Record<string, string> = {}
  if (cacheHint) {
    headers['Cache-Control'] = `s-maxage=${cacheHint.revalidate}, stale-while-revalidate`
  }
  return NextResponse.json({ success: true, data }, { headers })
}

// 프론트엔드 hooks에서 SWR 사용:
// 폴링 간격: 30초 (관리자 도구 기준)
// 무효화 키: ['orders', page], ['settlements', sellerId]
// 낙관적 업데이트: 상태 변경 즉시 UI 반영 → 서버 확인 후 롤백
// 에러 재시도: 3회, 지수 백오프 (1초, 2초, 4초)
```

---

## 8. Phase 5: API 라우트 (62개)

### 8.1 라우트 수 정정 (Rev.2 "56" → Rev.3 "62")

| Tier | 라우트 수 | 일정 |
|------|----------|------|
| Tier 1 CRITICAL | 10 | Session 5 (Day 4) |
| Tier 2 HIGH | 20 | Session 6 (Day 5) |
| DELETE 라우트 | 6 | Session 6 (Day 5) |
| 미분류 라우트 | 4 | Session 7 (Day 6) |
| Tier 3 MEDIUM/LOW | 22 | Session 7 (Day 6) |
| **합계** | **62** | 3일 |

### 8.2 표준 핸들러 패턴 (모든 라우트 이 패턴 준수)
```typescript
/**
 * [메서드] [경로] — [1줄 설명]
 * WHY: [V2 문제 ID]
 * HOW: 인증 → Zod 검증 → 서비스 위임 → 표준 응답
 */
import { requireAdmin } from '@/lib/api/middleware'
import { ok, err, validationErr } from '@/lib/api/response'
import { XxxSchema } from './schema' // [Rev.3] co-located Zod
import * as service from '@/lib/services/xxx.service'

export async function POST(req: NextRequest) {
  // 1. 인증 (5줄)
  const authErr = await requireAdmin(req)
  if (authErr) return authErr

  // 2. 입력 검증 (5줄)
  const body = await req.json().catch(() => ({}))
  const parsed = XxxSchema.safeParse(body)
  if (!parsed.success) return validationErr(parsed.error.message)

  // 3. 비즈니스 로직 위임 (10줄)
  console.log('[api-name] 시작')
  try {
    const result = await service.xxx(parsed.data)
    console.log('[api-name] 완료')
    return ok(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류'
    console.error('[api-name] 실패:', msg)
    Sentry.captureException(e) // [Rev.3] 프로덕션 모니터링
    return err(msg)
  }
}
```

### 8.3 [Rev.3] co-located schema.ts 예시
```typescript
// app/api/settlement/generate/schema.ts
// WHY: 이 스키마는 이 라우트만 사용. lib/에 넣으면 연쇄 변경 유발 (SIM-02)
import { z } from 'zod'
import { DateSchema, UuidSchema } from '@/lib/utils/validation'

export const GenerateSettlementSchema = z.object({
  period_start: DateSchema,
  period_end: DateSchema,
  seller_ids: z.array(UuidSchema).optional(),
})
// 공용 스키마(DateSchema, UuidSchema)를 조합하여 라우트별 스키마 생성
// 이 파일 변경 → 이 라우트만 영향 → 연쇄 변경 0
```

### 8.4 검증 게이트 (ESLint 기반 — Rev.3 보강)
```
□ tsc --strict --noEmit → 에러 0건
□ ESLint --max-warnings 0 (CI에서 자동 실행)
□ requireAdmin 반환값 사용 강제: ESLint 커스텀 규칙
□ 모든 POST/PATCH에 schema.ts 존재: ls app/api/**/schema.ts
□ wc -l app/api/**/route.ts → 모든 라우트 100줄 이내
□ grep -r "\.or(\`" app/ → 0건
□ grep -r "req\.json()" app/api/ | grep -v "catch" → 0건
```

---

## 9. Phase 6: 프론트엔드

### 9.1 전체 페이지 목록 (17개 — 15 어드민 + 2 Public)

| 페이지 | Tier | 비고 |
|--------|------|------|
| admin/dashboard | 1 | 메인 대시보드 |
| admin/login | 1 | 로그인 |
| admin/settlement/workflow | 1 | 정산 워크플로 (최핵심) |
| admin/settlement | 1 | 정산 목록 |
| admin/consignments | 1 | 위탁 관리 |
| admin/orders | 1 | 주문 관리 |
| admin/photos | 2 | 사진 관리 |
| admin/products | 2 | 상품 관리 |
| admin/notifications | 2 | 알림 관리 |
| admin/settlement/history | 2 | 정산 이력 |
| admin/settlement/sellers | 2 | 판매자별 정산 |
| admin/sales | 2 | 매출 관리 |
| admin/database | 3 | DB 관리 도구 |
| admin/sales/erp | 3 | ERP 연동 |
| admin/sales/ledger | 3 | 매출 원장 |
| /consignment/adjust/[token] | 1 | Public: 가격조정 (anon + RLS) |
| /orders/[productId]/hold | 1 | Public: 주문보류 (anon + RLS) |

### 9.2 [Rev.3] style={{}} 검증 수정 (audit2 FIX-09)
```
검증 게이트 수정:
❌ 이전: grep -r "style={{" app/ → 0건 (동적 스타일까지 금지)
✅ 수정: ESLint "no-static-inline-styles" 커스텀 규칙
  - 정적 하드코딩 금지: style={{ background: '#C4A265' }}
  - 동적 값 허용: style={{ width: `${percent}%` }}
  - 근거: 1,061개 inline style 중 ~30%가 동적 값 (SIM-06)
```

---

## 10. Phase 7: 스토리지 마이그레이션

### 10.1 [Rev.3] 멱등성 보장 스크립트 (audit2 FIX-10, pa1 IMP-09)

```sql
-- 마이그레이션 체크포인트 테이블
CREATE TABLE _migration_checkpoint (
  file_name text PRIMARY KEY,
  local_path text NOT NULL,
  bucket text NOT NULL,
  status text CHECK (status IN ('pending','uploaded','url_updated')) DEFAULT 'pending',
  supabase_url text,
  error_message text,
  updated_at timestamptz DEFAULT now()
);
```

```typescript
// scripts/migrate-storage.ts
// WHY: 5,000장 사진 업로드 중 네트워크 실패 시 처음부터 재시작 방지 (SIM-07)
// HOW: 체크포인트 DB + 3단계 상태 머신 (pending → uploaded → url_updated)

async function migratePhotos() {
  // 1. 미완료 건만 조회
  const pending = await db.query(
    `SELECT * FROM _migration_checkpoint WHERE status != 'url_updated' ORDER BY file_name`
  )
  console.log(`[migrate] 남은 건수: ${pending.length}`)

  for (const photo of pending) {
    try {
      if (photo.status === 'pending') {
        // 2. Supabase Storage 업로드
        const url = await uploadToStorage(photo.local_path, photo.bucket)
        await db.query(
          `UPDATE _migration_checkpoint SET status = 'uploaded', supabase_url = $1 WHERE file_name = $2`,
          [url, photo.file_name]
        )
      }
      if (photo.status === 'uploaded' || photo.status === 'pending') {
        // 3. st_products.photos JSONB URL 치환
        await db.query(
          `UPDATE st_products SET photos = replace(photos::text, $1, $2)::jsonb WHERE photos::text LIKE $3`,
          [photo.local_path, photo.supabase_url, `%${photo.file_name}%`]
        )
        await db.query(
          `UPDATE _migration_checkpoint SET status = 'url_updated' WHERE file_name = $1`,
          [photo.file_name]
        )
      }
    } catch (err) {
      // 에러 기록 후 다음 파일 계속 처리
      await db.query(
        `UPDATE _migration_checkpoint SET error_message = $1 WHERE file_name = $2`,
        [err.message, photo.file_name]
      )
    }
  }

  // 4. 진행률 출력
  const { completed, total } = await db.query(
    `SELECT COUNT(*) FILTER (WHERE status = 'url_updated') as completed, COUNT(*) as total FROM _migration_checkpoint`
  )
  console.log(`[migrate] 완료: ${completed}/${total} (${Math.round(completed/total*100)}%)`)
}
// 재실행 시: url_updated 아닌 건만 처리 → 멱등성 보장
```

---

## 11. Phase 8: 검증 + CI/CD + 모니터링

### 11.1 [Rev.3] CI/CD (audit2 FIX-05, pa1 IMP-05)
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm tsc --noEmit          # 타입 체크
      - run: pnpm eslint . --max-warnings 0  # 린트
      - run: pnpm vitest run             # 테스트
      - run: pnpm next build             # 빌드
```

### 11.2 [Rev.3] Sentry 모니터링 (audit2 FIX-06, pa1 IMP-06)
```typescript
// sentry.server.config.ts
// WHY: console.error만으로 프로덕션 디버깅 불가 (audit2 G-03)
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1, // 관리자 1-2명 → 10% 샘플링 충분
  environment: process.env.NODE_ENV,
})
```

### 11.3 [Rev.3] ESLint 커스텀 규칙 (pa1 IMP-08)
```javascript
// eslint-local-rules/must-check-auth.js
// WHY: requireAdmin() 호출 후 반환값 무시 → 인증 우회 가능 (SIM-12)
module.exports = {
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.name === 'requireAdmin') {
          const parent = node.parent
          // await requireAdmin(req) 결과가 변수에 할당되는지 확인
          if (parent.type !== 'VariableDeclarator' && parent.type !== 'AssignmentExpression') {
            context.report({ node, message: 'requireAdmin() 반환값을 반드시 확인하세요' })
          }
        }
      }
    }
  }
}
```

### 11.4 Phase 8 자동 검증 (grep → ESLint 보강)
```bash
# Tier 1: ESLint 자동 (CI에서 실행)
pnpm eslint . --max-warnings 0

# Tier 2: 추가 grep (ESLint 미커버 영역)
tsc --strict --noEmit | wc -l                          # → 0
grep -r 'process\.cwd' lib/ app/ | wc -l               # → 0 (fs 의존 제거)
grep -r 'readFileSync\|writeFileSync' lib/ app/ | wc -l # → 0

# Tier 3: 수동 검증 (11건)
# (Rev.2 §13.2와 동일)
```

---

## 12. 테스트 전략 [Rev.3 신규]

### 12.1 프레임워크: vitest

**왜 vitest인가**:
- Next.js와 자연스러운 통합 (ESM 네이티브)
- Jest 대비 5-10배 빠른 실행
- 설정 최소화 (vitest.config.ts 10줄)

### 12.2 테스트 레벨별 전략

| 레벨 | 대상 | 예상 테스트 수 | 실행 시점 |
|------|------|---------------|----------|
| 단위 | Zod 스키마 + 유틸 함수 | ~50 | Phase 1 완료 시 |
| 통합 | RPC 3개 (정상/실패/엣지) | ~15 | Phase 2 완료 시 |
| E2E | CRITICAL 라우트 5개 | ~10 | Phase 5 완료 시 |
| 회귀 | 전체 스위트 | ~75 | Phase 8 + CI |

### 12.3 CRITICAL 테스트 케이스

```typescript
// __tests__/integration/settlement-rpc.test.ts
// WHY: 이중 정산이 V2 최대 금전적 위험 (FIN-01)

describe('create_settlement_with_items', () => {
  test('빈 배열 → 에러', async () => {
    // p_sold_item_ids = [] → RAISE EXCEPTION
  })

  test('이미 정산된 항목 → 에러', async () => {
    // settlement_status = 'settled' 항목 포함 → 잠금 실패
  })

  test('동시 2건 요청 → 1건만 성공', async () => {
    // 동일 sold_items에 대해 2개 트랜잭션 동시 실행
    // FOR UPDATE로 1개는 대기 → 상태 변경 후 실패
  })

  test('정상 실행 → settlement_id 반환', async () => {
    // pending 상태 항목 → 정산 생성 → settled로 변경
  })
})
```

---

## 13. 세션별 구현 전략 [Rev.3 신규]

### 13.1 왜 세션 계획이 필요한가

Claude Code 세션은 컨텍스트 제한이 있다. 대규모 마이그레이션을 한 세션에 넣으면:
- 컨텍스트 소진 → 후반부 품질 저하
- 검증 없이 다음 Phase 진행 → 연쇄 오류
- 세션 중단 시 이어받기 불가

**원칙**: 한 세션 = 하나의 완결된 작업 단위. 진입 조건 + 산출물 + 퇴출 검증.

### 13.2 세션 맵 (11 세션, 11일)

```
Session 1 (Day 1)  │ Phase 0: DB 마이그레이션
  진입: plan3 rev3.md 승인 완료
  산출: 6개 마이그레이션 + 3개 RPC 실행 완료
  검증: Phase 0 게이트 8개 통과
  ─────────────────────────────────────
Session 2 (Day 2)  │ Phase 1: 인프라 + 타입 + 유틸
  진입: Session 1 검증 완료
  산출: 22개 파일 + 단위 테스트 ~30개
  검증: tsc 0건 + vitest PASS
  ─────────────────────────────────────
Session 3 (Day 3)  │ Phase 2: 데이터 레이어
  진입: Session 2 검증 완료
  산출: 11개 파일 + RPC 통합 테스트 ~15개
  검증: PostgREST 인젝션 0건 + .range() 전수
  ─────────────────────────────────────
Session 4 (Day 4)  │ Phase 3: 미들웨어 + Phase 4: 서비스
  진입: Session 3 검증 완료
  산출: 2개 + 9개 파일 = 11개
  검증: 인증 curl 테스트 + NextRequest 0건
  ─────────────────────────────────────
Session 5 (Day 5)  │ Phase 5 Tier 1: CRITICAL 라우트 10개
  진입: Session 4 검증 완료
  산출: 10개 route.ts + 10개 schema.ts
  검증: 라우트 100줄 이내 + Zod 검증 전수
  ─────────────────────────────────────
Session 6 (Day 6)  │ Phase 5 Tier 2: HIGH + DELETE 26개
  진입: Session 5 검증 완료
  산출: 26개 route.ts + schema.ts
  검증: 동일
  ─────────────────────────────────────
Session 7 (Day 7)  │ Phase 5 Tier 3 + 미분류 26개
  진입: Session 6 검증 완료
  산출: 26개 route.ts + schema.ts + E2E 테스트 ~10개
  검증: 62개 라우트 전수 확인 + vitest E2E PASS
  ─────────────────────────────────────
Session 8 (Day 8)  │ Phase 6 Part 1: 공유 UI + 핵심 페이지
  진입: Session 7 검증 완료
  산출: 8 공유 컴포넌트 + 워크플로/위탁/주문/정산 4페이지
  검증: style 정적 인라인 0건 + alert/confirm 0건
  ─────────────────────────────────────
Session 9 (Day 9)  │ Phase 6 Part 2: 나머지 페이지 + Public
  진입: Session 8 검증 완료
  산출: 11개 어드민 + 2개 Public 페이지
  검증: 모든 페이지 렌더링 + RLS 동작 확인
  ─────────────────────────────────────
Session 10 (Day 10) │ Phase 7: 스토리지 마이그레이션
  진입: Session 9 검증 완료
  산출: 마이그레이션 스크립트 + 17+ 파일 수정
  검증: fs 의존 0건 + 사진 URL 404 0건
  ─────────────────────────────────────
Session 11 (Day 11) │ Phase 8: 검증 + CI/CD + 모니터링 + 빌드
  진입: Session 10 검증 완료
  산출: CI/CD 설정 + Sentry + ESLint 규칙 + 전체 검증
  검증: next build 성공 + vitest 전체 PASS + 수동 11건
```

### 13.3 세션 간 컨텍스트 이어받기

각 세션 완료 시 다음 파일 업데이트:

```
v3-context.md  ← 핵심 결정사항, 파일 경로, 다음 세션 진입 조건
v3-tasks.md    ← 체크리스트 (완료/미완료)
```

**세션 시작 시 필수 읽기**:
1. plan3 rev3.md (이 문서)
2. v3-context.md (이전 세션 결과)
3. v3-tasks.md (남은 작업)

---

## 14. V2→V3 전환 런북 [Rev.3 전면 재설계]

### 14.1 분 단위 절차

```
T-24시간: 관리자에게 공지 "내일 XX시 시스템 점검 30분 예정"

T-60분: 최종 사전 확인
  □ V3 빌드 성공 (next build)
  □ vitest 전체 PASS
  □ Vercel에 V3 빌드 대기 상태

T-0분: V2 maintenance mode 활성화
  → Vercel 환경변수 MAINTENANCE=true 설정
  → V2 모든 페이지 "점검 중" 표시
  → 이 시점부터 V2 데이터 변경 불가

T+2분: 데이터 정합성 확인 쿼리 5개 실행
  1) SELECT COUNT(*) FROM settlements
       WHERE settlement_status = 'pending';                    → 0
  2) SELECT COUNT(*) FROM sold_items
       WHERE seller_id IS NULL;                                → 0
  3) SELECT match_id, COUNT(*) FROM settlement_queue
       GROUP BY match_id HAVING COUNT(*) > 1;                  → 0행
  4) SELECT COUNT(*) FROM settlement_items si
       WHERE NOT EXISTS (SELECT 1 FROM settlements s
       WHERE s.id = si.settlement_id);                         → 0
  5) SELECT COUNT(*) FROM sold_items
       WHERE settlement_status = 'pending';                    → 0 (추가 확인)

T+5분: 5개 모두 0건 → V3 배포 실행
  → 1건이라도 0이 아닌 경우: STOP. 수동 정리 후 재확인.

T+10분: V3 배포 완료 → 스모크 테스트 5건
  1) POST /api/admin/auth/login → 200
  2) GET /admin/dashboard → 200 (렌더링 확인)
  3) GET /api/admin/consignments → 200 (데이터 반환)
  4) GET /api/admin/orders → 200 (데이터 반환)
  5) POST /api/settlement/generate (드라이런) → 200

T+15분: 스모크 5건 전부 통과 → maintenance mode 해제
  → MAINTENANCE=false

T+20분: 관리자에게 "시스템 점검 완료" 공지

롤백 조건: T+10분 스모크 1건이라도 실패 → 즉시 롤백
롤백 방법: Vercel 대시보드 → 이전 배포 즉시 전환 (2분 소요)
롤백 후: UNIQUE 제약이 V2에 영향 주는 경우만 DROP
         RPC/인덱스는 V2가 호출하지 않으므로 유지
```

---

## 15. 적대적 시뮬레이션 15회

Rev.2의 자기검증 3회(모두 PASS) → Rev.3에서 의도적 실패 유도 15회.

### SIM-R3-01: "Session 2에서 tsc 에러 50건 발생"

**시나리오**: Phase 1 타입 정의 중 supabase gen types가 실패하여 database.types.ts가 비어있는 상태로 리포지토리 타입 참조.

| 단계 | 발생 | 대응 | 결과 |
|------|------|------|------|
| 1 | supabase gen types 실패 | 수동 타입 정의 (Phase 1 실패 시나리오에 명시) | 대응 존재 |
| 2 | 수동 타입이 실제 DB 스키마와 불일치 | Phase 0 직후 DB 스키마 직접 확인하여 타입 작성 | 대응 가능 |
| 3 | Session 2 검증 게이트: tsc 0건 필수 | 게이트에서 차단됨 → Session 3 진행 불가 | **PASS** |

**판정**: PASS — 검증 게이트가 차단. 단, 수동 타입 작성 시간 추가 (Day 2 → Day 2.5).

---

### SIM-R3-02: "Phase 5에서 schema.ts 작성 중 V2 API 동작 불명확"

**시나리오**: V2 POST /api/admin/orders의 body에 measurements 필드가 optional인지 required인지 V2 코드에서 불명확.

| 단계 | 발생 | 대응 | 결과 |
|------|------|------|------|
| 1 | V2 코드: `req.json()` 후 직접 INSERT (검증 없음) | V2 동작: 없으면 null | 추적 가능 |
| 2 | schema.ts에 optional로 정의 | co-location이므로 route.ts 옆에서 즉시 수정 가능 | **PASS** |
| 3 | 나중에 required로 변경 필요 발견 | schema.ts + route.ts만 수정 (연쇄 변경 0) | **PASS** |

**판정**: PASS — co-location 전략이 연쇄 변경 방지 (Rev.2 SIM-02 해결 확인)

---

### SIM-R3-03: "Phase 0 인덱스 CONCURRENTLY 실패"

**시나리오**: CREATE INDEX CONCURRENTLY가 Supabase 대시보드 SQL Editor에서 실패 (트랜잭션 내 실행 불가).

| 단계 | 발생 | 대응 | 결과 |
|------|------|------|------|
| 1 | CONCURRENTLY 지원 안 되는 환경 | CREATE INDEX (일반)으로 대체 | 테이블 잠금 발생 |
| 2 | V2 운영 중 테이블 잠금 | 짧은 잠금 (데이터 소량이므로 ~1초) | 허용 범위 |
| 3 | 또는 maintenance mode 후 실행 | 전환 런북 T+0 이후 실행 | **PASS** |

**판정**: PASS — 대안 존재. 데이터 소량 시 일반 CREATE INDEX도 무방.

---

### SIM-R3-04: "Session 4에서 서비스 150줄 초과"

**시나리오**: notification.service.ts가 sendStatusChange + sendBulk + sendPaid + logResult = 160줄.

| 단계 | 발생 | 대응 | 결과 |
|------|------|------|------|
| 1 | 150줄 초과 | logResult를 notifications.repo에 위임 (DB 작업이므로) | ~140줄로 감소 |
| 2 | 그래도 150줄 이상이면 | sendBulk를 별도 bulk-notification.service.ts로 분리 | 순환 의존 없음 (단방향) |
| 3 | 검증 게이트: wc -l 확인 | **PASS** |

**판정**: PASS — 150줄 제한은 충분한 여유. 초과 시 합리적 분리 가능.

---

### SIM-R3-05: "Session 7에서 62개 라우트 합산 → 실제 68개 발견"

**시나리오**: V2 코드 구현 중 누락 라우트 6개 추가 발견.

| 단계 | 발생 | 대응 | 결과 |
|------|------|------|------|
| 1 | Session 5-7에서 V2 route.ts 대조 중 추가 발견 | Session 7에 즉시 추가 | 일정 1일 추가 |
| 2 | 총 68개 → Session 7이 2일로 확장 | 12일 총 일정 | **PARTIAL** |

**판정**: PARTIAL — 일정 초과 가능. V2 전수 조사를 Session 4에서 선행하여 완전한 목록 확보.

**개선**: Session 4 시작 시 `find app/api -name "route.ts" | wc -l`로 V2 라우트 전수 카운트 재확인.

---

### SIM-R3-06: "Sentry 무료 티어 5,000건 초과"

**시나리오**: V3 배포 초기 에러가 많아 Sentry 무료 한도 빠르게 소진.

| 단계 | 발생 | 대응 | 결과 |
|------|------|------|------|
| 1 | 배포 초기 에러 빈번 → 5,000건/월 초과 | Sentry에 레이트 리밋 설정 (beforeSend 필터) | 핵심 에러만 전송 |
| 2 | console.error는 여전히 로컬 로그에 남음 | Sentry 없어도 디버깅 가능 | **PASS** |

**판정**: PASS — Sentry는 보조 수단. console.error가 1차 방어선.

---

### SIM-R3-07: "RLS 정책이 Admin 기능을 차단"

**시나리오**: RLS 설정 후 admin client(service_role)까지 RLS에 걸림.

| 단계 | 발생 | 대응 | 결과 |
|------|------|------|------|
| 1 | service_role은 RLS 자동 우회 (Supabase 기본 동작) | 테스트로 확인 | **PASS** |
| 2 | 만약 버전 이슈로 우회 안 되면 | POLICY에 `TO anon` 명시 → service_role에 적용 안 됨 | **PASS** |

**판정**: PASS — RLS 정책에 `TO anon` 명시적 역할 지정으로 이중 안전.

---

### SIM-R3-08: "vitest + Supabase 로컬 통합 테스트 환경 미구성"

**시나리오**: RPC 통합 테스트를 위해 로컬 Supabase가 필요하지만 설정 실패.

| 단계 | 발생 | 대응 | 결과 |
|------|------|------|------|
| 1 | supabase init + supabase start 필요 | Docker 의존 | Docker 없으면 실패 |
| 2 | 대안: Supabase 프로젝트 개발 환경 사용 | 네트워크 필요, 속도 느림 | 차선책 |
| 3 | 대안: RPC를 순수 SQL로 테스트 | psql로 직접 실행, vitest에서 결과 검증 | **PARTIAL** |

**판정**: PARTIAL — 로컬 Supabase 환경 구성이 Session 2 전에 선행되어야 함.

**개선**: Session 1에서 `supabase init && supabase start` 선행 실행. 실패 시 개발 환경 DB 사용.

---

### SIM-R3-09: "전환 런북 T+2분에서 pending 정산 3건 발견"

**시나리오**: maintenance mode 활성화 후 확인 쿼리에서 pending 3건 발견.

| 단계 | 발생 | 대응 | 결과 |
|------|------|------|------|
| 1 | pending 3건 → STOP | 수동으로 confirmed/paid 전환 | 추가 10분 소요 |
| 2 | 재확인 → 0건 | 진행 | **PASS** |

**판정**: PASS — 런북에 "0이 아닌 경우 수동 정리" 절차가 명시되어 있음.

---

### SIM-R3-10: "Session 8에서 워크플로 setTimeout 레이스(NEW-13) 수정 실패"

**시나리오**: useWorkflowHandlers 418줄 분리 중 상태 공유 로직이 복잡하여 setTimeout 레이스 재현.

| 단계 | 발생 | 대응 | 결과 |
|------|------|------|------|
| 1 | 4개 훅으로 분리 시 상태 동기화 필요 | useReducer + dispatch 패턴으로 상태 중앙화 | 복잡도 증가 |
| 2 | setTimeout → useEffect cleanup | clearTimeout in cleanup | 기본 패턴 |
| 3 | 워크플로 상태 서버 동기화 | SWR mutate로 서버 상태 반영 | **PASS** |

**판정**: PASS — useReducer + cleanup + SWR mutate 패턴으로 해결 가능. 단 Session 8에 충분한 시간 배정 필요.

---

### SIM-R3-11: "ESLint 커스텀 규칙 작성 실패"

**시나리오**: must-check-auth ESLint 규칙이 AST 패턴 매칭 실패로 오탐/미탐 발생.

| 단계 | 발생 | 대응 | 결과 |
|------|------|------|------|
| 1 | 커스텀 규칙 복잡 | 단순화: `await requireAdmin(req)` 패턴만 검사 | 범위 축소 |
| 2 | 오탐 많으면 | grep 기반 검증을 병행 (기존 방식 유지) | **PASS** |

**판정**: PASS — ESLint 실패 시 grep 폴백 유지. 완벽할 필요 없고 "기존보다 낫기만 하면 됨".

---

### SIM-R3-12: "Next.js 16 + React 19 호환 이슈"

**시나리오**: 사용 중인 라이브러리가 React 19와 호환되지 않음.

| 단계 | 발생 | 대응 | 결과 |
|------|------|------|------|
| 1 | @imgly/background-removal 호환 실패 | PhotoRoom API 전용 전환 (외부 서비스) | 기능 유지 |
| 2 | SWR/React Query 호환 | SWR 2.x는 React 19 지원 (공식 확인) | **PASS** |
| 3 | sharp Vercel 호환 | sharp@0.33+는 Vercel 지원 | **PASS** |

**판정**: PASS — 핵심 라이브러리 호환 확인. @imgly만 대안 필요.

---

### SIM-R3-13: "스토리지 마이그레이션 중 Supabase Storage 용량 초과"

**시나리오**: 5,000장 x 2MB = 10GB. Supabase Free 티어 1GB 제한.

| 단계 | 발생 | 대응 | 결과 |
|------|------|------|------|
| 1 | 1GB 초과 → 업로드 거부 | Pro 플랜 업그레이드 ($25/월, 100GB) | 비용 발생 |
| 2 | 또는 이미지 최적화 (리사이즈) | 원본 품질 유지 필요 → 최적화 불가 | — |
| 3 | Pro 플랜 필수 확인 후 진행 | Session 10 시작 전 플랜 확인 | **PASS** |

**판정**: PASS — Session 10 진입 조건에 "Supabase Storage 용량 확인" 추가.

---

### SIM-R3-14: "동시 관리자 2명 — 정산 + 위탁 동시 처리 (SWR 전략 검증)"

**시나리오**: Admin A 정산 생성, Admin B 위탁 완료. SWR 30초 폴링으로 UI 동기화.

| 단계 | 발생 | 대응 | 결과 |
|------|------|------|------|
| 1 | Admin A 정산 생성 → sold_items 상태 변경 | FOR UPDATE 잠금으로 데이터 안전 | **PASS** |
| 2 | Admin B 화면에 반영까지 최대 30초 대기 | SWR revalidateOnFocus로 탭 전환 시 즉시 갱신 | **PASS** |
| 3 | Admin B가 이미 정산된 항목 재정산 시도 | RPC에서 "이미 정산됨" 에러 → UI에 토스트 표시 | **PASS** |

**판정**: PASS — 데이터 안전성은 RPC 보장, UI 동기화는 SWR 30초 + 포커스 갱신으로 충분 (관리자 2명 규모).

---

### SIM-R3-15: "전체 빌드 시간 10분 초과 — Vercel 무료 티어 제한"

**시나리오**: 62개 라우트 + 17 페이지 → next build가 Vercel 무료 티어 빌드 시간 제한 초과.

| 단계 | 발생 | 대응 | 결과 |
|------|------|------|------|
| 1 | Vercel Pro 필요 ($20/월) | 이미 V2에서 사용 중이라면 그대로 | **PASS** |
| 2 | 빌드 최적화: next.config의 experimental.optimizePackageImports | 번들 크기 감소 → 빌드 시간 단축 | 보조 수단 |

**판정**: PASS — Vercel 플랜 확인 선행.

---

### 시뮬레이션 종합

| # | 시나리오 | 판정 | 핵심 |
|---|---------|------|------|
| R3-01 | tsc 에러 50건 | PASS | 검증 게이트가 차단 |
| R3-02 | V2 API 불명확 | PASS | co-location이 연쇄 변경 방지 |
| R3-03 | 인덱스 CONCURRENTLY 실패 | PASS | 대안 존재 |
| R3-04 | 서비스 150줄 초과 | PASS | 합리적 분리 가능 |
| R3-05 | 라우트 68개 발견 | PARTIAL | Session 4에서 V2 전수 카운트 선행 |
| R3-06 | Sentry 한도 초과 | PASS | 필터 + console.error 폴백 |
| R3-07 | RLS가 Admin 차단 | PASS | TO anon 명시적 역할 지정 |
| R3-08 | 통합 테스트 환경 | PARTIAL | Session 1에서 supabase start 선행 |
| R3-09 | pending 정산 발견 | PASS | 런북에 수동 정리 절차 |
| R3-10 | setTimeout 레이스 | PASS | useReducer + cleanup 패턴 |
| R3-11 | ESLint 규칙 실패 | PASS | grep 폴백 유지 |
| R3-12 | React 19 호환 | PASS | 핵심 라이브러리 확인 |
| R3-13 | Storage 용량 초과 | PASS | Pro 플랜 확인 선행 |
| R3-14 | 동시 관리자 UI | PASS | SWR 30초 + 포커스 갱신 |
| R3-15 | 빌드 시간 초과 | PASS | Vercel 플랜 확인 |

**15회 중: PASS 13건, PARTIAL 2건, FAIL 0건**

PARTIAL 2건 대응:
- R3-05: Session 4에서 V2 라우트 전수 카운트
- R3-08: Session 1에서 supabase start

---

## 16. 실패 근본 원인 분석 10회

Rev.2에서 발생한 실패의 근본 원인을 분석하여, Rev.3에서 같은 패턴이 반복되지 않도록 방지.

### FAIL-01: 리서치 스코프 맹점
- **증상**: 테스트/CI/CD/모니터링 누락
- **원인**: "코드 버그"만 찾고 "있어야 하는데 없는 것"은 찾지 않음
- **Rev.3 대응**: Phase 8에 CI/CD + Sentry + 테스트를 필수 산출물로 정의

### FAIL-02: 확증 편향
- **증상**: plan3 시뮬레이션 3/3 PASS
- **원인**: 작성자가 자기 계획을 검증
- **Rev.3 대응**: 적대적 시뮬레이션 15회 수행 + PARTIAL 허용 (완벽주의 탈피)

### FAIL-03: 과잉 설계
- **증상**: 5레이어, 매퍼 파일, 사전 Zod
- **원인**: "복잡할수록 좋다"는 무의식적 편향
- **Rev.3 대응**: 3+1레이어, 매퍼 제거, Zod co-location (YAGNI 적용)

### FAIL-04: 운영 vs 구현 혼돈
- **증상**: 전환 절차가 전략 수준에만 머무름
- **원인**: plan3가 "코드 계획"인데 "운영 런북"도 포함하려 함
- **Rev.3 대응**: §14를 독립 런북으로 분 단위 명시

### FAIL-05: 인덱스 = 최적화 오분류
- **증상**: FOR UPDATE가 인덱스 없이 타임아웃
- **원인**: 인덱스를 "나중에 해도 되는 최적화"로 분류
- **Rev.3 대응**: Phase 0에 성능 인덱스 포함 (기능 요구사항으로 재분류)

### FAIL-06: anon = 안전 오해
- **증상**: RLS 없이 anon client 사용
- **원인**: anon client가 DB 접근을 제한한다고 착각
- **Rev.3 대응**: RLS 정책 Phase 0에 포함 + TO anon 명시

### FAIL-07: 줄수 일률 적용
- **증상**: 서비스 100줄에서 불필요한 파일 분리 → 순환 의존
- **원인**: 교리 "100줄"이 역할별 차이를 무시
- **Rev.3 대응**: §2 역할별 줄수 제한 세분화

### FAIL-08: grep 기반 검증 한계
- **증상**: requireAdmin 존재만 확인, 반환값 무시 미탐지
- **원인**: 구문 패턴 ≠ 의미적 정확성
- **Rev.3 대응**: ESLint 커스텀 규칙 + grep 폴백 병행

### FAIL-09: 세션 경계 미설계
- **증상**: 컨텍스트 소진 시 이어받기 불가
- **원인**: "한 번에 다 구현" 가정
- **Rev.3 대응**: §13 세션별 구현 전략 + 컨텍스트 이어받기 문서 체계

### FAIL-10: V2 재현 = 요구사항 확정 가정
- **증상**: Zod 스키마 사전 정의 → 연쇄 변경
- **원인**: V2 코드의 암묵적 로직을 사전에 완전 파악 가능하다는 가정
- **Rev.3 대응**: co-location으로 "구현 시점에 확정" 전략

---

## 17. 개선 방향 탐색 10회

각 방향을 "적용했을 때 어떤 가치가 생기고 어떤 리스크가 있는가" 관점에서 검증.

### DIR-01: 3+1레이어가 정말 충분한가?
- **가치**: 파일 수 ~20% 감소, 네비게이션 비용 감소
- **리스크**: 서비스가 DB 호출을 직접 포함 → 테스트 시 mock 범위 넓어짐
- **결론**: "+1" 전략으로 필요 시 분리 가능. 현재는 충분.

### DIR-02: vitest가 최선인가?
- **가치**: 빠른 실행, ESM 네이티브, Next.js 통합
- **리스크**: Supabase RPC 테스트에 별도 설정 필요
- **결론**: 최선. jest보다 설정 간단하고 속도 우수.

### DIR-03: Sentry 무료가 장기적으로 유지 가능한가?
- **가치**: 즉각적 에러 추적
- **리스크**: 무료 5,000건 초과 시 데이터 유실
- **결론**: 관리자 1-2명 규모에서 충분. 트래픽 증가 시 Pro 전환.

### DIR-04: co-located schema.ts가 파일 수를 과도하게 늘리지 않는가?
- **가치**: 연쇄 변경 0
- **리스크**: 62개 schema.ts 추가 → 파일 수 증가
- **결론**: route.ts와 1:1 매핑이므로 인지 비용 낮음. 트레이드오프 수용.

### DIR-05: 11일 일정이 현실적인가?
- **가치**: 각 세션 1일 → 명확한 일정
- **리스크**: 예상치 못한 이슈로 1-2일 추가 가능
- **결론**: 버퍼 2일 포함 → 13일 안전 일정. 11일은 최선 추정.

### DIR-06: RLS를 Phase 0에서 할까 Phase 3에서 할까?
- **가치**: Phase 0 → DB 레벨에서 먼저 방어
- **리스크**: Phase 0에서 RLS 설정 후 코드 없이 테스트 어려움
- **결론**: Phase 0에서 SQL만 실행, Phase 3에서 통합 테스트.

### DIR-07: 매퍼 제거가 리포지토리 복잡도를 높이지 않는가?
- **가치**: 파일 3개 감소
- **리스크**: 리포지토리 내 mapRow 함수가 추가 줄 소비
- **결론**: mapRow 5-10줄 추가는 별도 파일 관리 비용보다 낮음.

### DIR-08: 전환 런북이 너무 상세한가? (과잉 계획)
- **가치**: 분 단위 절차로 실수 방지
- **리스크**: 실제 상황에서 런북과 다른 이슈 발생 가능
- **결론**: 상세한 것이 부족한 것보다 낫다. 런북은 가이드이지 강제가 아님.

### DIR-09: ESLint 커스텀 규칙이 유지보수 부담이 아닌가?
- **가치**: 자동화된 의미적 검증
- **리스크**: 커스텀 규칙 자체의 버그 가능
- **결론**: 1개 규칙(must-check-auth)만 작성. 나머지는 공식 플러그인 활용.

### DIR-10: 11 세션이 너무 잘게 나뉜 것 아닌가?
- **가치**: 세션당 컨텍스트 부담 감소, 검증 게이트 빈번
- **리스크**: 세션 시작마다 컨텍스트 로딩 시간 소비
- **결론**: v3-context.md + v3-tasks.md로 컨텍스트 로딩 최소화. 잘게 나눈 것이 안전.

---

## 최종 점수 (Rev.3 자체 평가)

| 기준 | Rev.2 | audit2 평가 | Rev.3 |
|------|-------|-----------|-------|
| 완결성 | — | 68/100 | **85/100** |
| 효과성 | — | 78/100 | **90/100** |
| 효율성 | — | 60/100 | **78/100** |
| **종합** | — | **69/100** | **84/100** |

**향상 근거**:
- 완결성 +17: 테스트(+5), 인덱스(+3), RLS(+3), CI/CD(+3), 모니터링(+3)
- 효과성 +12: 런북(+4), ESLint(+3), 멱등성(+3), RPC 엣지케이스(+2)
- 효율성 +18: 3+1레이어(+5), co-location(+5), 줄수 세분화(+5), 매퍼 제거(+3)

**잔존 리스크**: 5건 (모두 구현 단계에서 해소)
1. 실제 코드 런타임 검증 미수행 (Do 단계)
2. V2 실제 데이터 상태 미확인 (Phase 0 실행 시)
3. 사용자 도메인 지식 미반영 (사용자 승인 시)
4. Next.js 16 / React 19 호환 (Phase 1 tsc 실행 시)
5. Supabase RPC 실제 성능 (Phase 0 RPC 테스트 시)

---

*이 플랜의 모든 코드는 존재 이유가 있다. 의미 없는 줄은 없다.*
*Rev.2의 30건 정정 + audit2의 18건 수정 + pa1의 13건 개선 = 총 61건 반영.*
*15회 적대적 시뮬레이션: PASS 13건, PARTIAL 2건, FAIL 0건.*
*10회 실패 근본 원인 분석 → 같은 패턴 반복 방지.*
*10회 개선 방향 탐색 → 각 결정의 트레이드오프 명시.*
*구현 시작 전 사용자 승인 필수.*
