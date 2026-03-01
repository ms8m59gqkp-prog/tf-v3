# Classic Menswear V3 — 최종 마스터 구현 플랜 (Rev.4)

**작성일**: 2026-03-01
**근거**: plan3 Rev.3 + aud1-1 잔존 갭 4건 + audit2 FIX-01~18 + pa1-report IMP-01~13 + 적대적 시뮬레이션 16회 + 병렬 팀 시뮬레이션 10회
**교리**: 클로드코드교리 v2.0
**원칙**: 코드 한 줄 한 줄이 존재 이유를 가져야 한다. 의미 없는 코드는 쓰지 않는다.

---

## Rev.4 변경 요약 (Rev.3 대비)

| # | 변경 | 근거 | 영향 |
|---|------|------|------|
| R4-01 | upload-naver-settle 세션 기반 삭제 패턴 | aud1-1 GAP-07 (DAT-09) | §3 SQL +1, §5 repo 패턴 추가, §8 라우트 명시 |
| R4-02 | /api/health 헬스체크 엔드포인트 추가 | aud1-1 GAP-NEW-01 (FIX-17) | §8 라우트 62→63, Tier 1 추가 |
| R4-03 | Phase 5 검증 게이트 DB-우선 응답 체크 | aud1-1 GAP-05 (FIN-07) | §8.4 게이트 항목 +1 |
| R4-04 | _batch_progress 테이블 DDL + batch.repo | aud1-1 GAP-09 (IMP-10) | §3 SQL +1, §5 파일 11→12 |
| R4-05 | 에이전트 팀 배치 전략 (세션별) | 교리 v2.0 팀 모드 필수 | §13.4 신규 |
| R4-06 | 일별 제작 계획 (13일) | 교리 v2.0 PDCA | §13.2 전면 확장 |
| R4-07 | SIM-R3-14 범위 확장 | aud1-1 DAT-09 동시 접근 | §15 시뮬레이션 보강 |
| R4-08 | Rev.4-SEC/OPS 보강 패치(추가) | 운영/보안 경계(health/RLS), 업로드 세션 흐름, 에러 표준화, RLS/세션/배치 재시도 테스트, 사진 URL 헬퍼 및 게이트 항목을 문서에 **명시** | §3/§4/§8/§9/§12 보강 + 게이트 항목 추가 |

### Rev.3까지의 누적 변경

| 버전 | 변경 건수 | 핵심 |
|------|----------|------|
| Rev.2 → Rev.3 | 18건 (R3-01~18) | 3+1레이어, 인덱스, RLS, 테스트, CI/CD, Sentry, co-location |
| Rev.3 → Rev.4 | 7건 (R4-01~07) | 잔존 갭 4건 해소 + 에이전트 팀 배치 + 일별 계획 |
| **총 누적** | **audit2 18 + pa1 13 + aud1-1 4 = 35건** | |

---

## 목차

1. [아키텍처 블루프린트 (3+1레이어)](#1-아키텍처-블루프린트)
2. [줄수 제한 규칙](#2-줄수-제한-규칙)
3. [Phase 0: DB 마이그레이션 + 인덱스 + RLS](#3-phase-0)
4. [Phase 1: 인프라 + 타입 + 유틸](#4-phase-1)
5. [Phase 2: 데이터 레이어 (리포지토리 + 트랜잭션)](#5-phase-2)
6. [Phase 3: 미들웨어 + 인증](#6-phase-3)
7. [Phase 4: 서비스 레이어](#7-phase-4)
8. [Phase 5: API 라우트 (63개)](#8-phase-5)
9. [Phase 6: 프론트엔드](#9-phase-6)
10. [Phase 7: 스토리지 마이그레이션](#10-phase-7)
11. [Phase 8: 검증 + CI/CD + 모니터링](#11-phase-8)
12. [테스트 전략](#12-테스트-전략)
13. [세션별 구현 전략 + 에이전트 팀 배치 + 일별 계획](#13-세션별-구현-전략)
14. [V2→V3 전환 런북](#14-전환-런북)
15. [적대적 시뮬레이션 16회](#15-시뮬레이션)
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
│   │   │   ├── naver-settlements.repo.ts
│   │   │   └── batch.repo.ts          ← [Rev.4] _batch_progress 테이블 CRUD
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
│   ├── api/                            ← [Rev.4] 63개 라우트 (Rev.3: 62개)
│   │   ├── health/                     ← [Rev.4] 헬스체크 (R4-02)
│   │   │   └── route.ts
│   │   └── [각 라우트]/
│   │       ├── route.ts               ← 100줄 이내
│   │       └── schema.ts             ← [Rev.3] co-located Zod 스키마
│   └── admin/
│       ├── components/                 ← 공유 UI
│       ├── hooks/                      ← 클라이언트 훅
│       └── [각 페이지]/               ← 15개 어드민 + 2개 Public
├── supabase/
│   └── migrations/                     ← [Rev.4] 9개 마이그레이션 (Rev.3: 7개) + 3개 RPC
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
- 150줄(서비스): settlement.service의 generate(60) + confirm(25) + pay(30) = 115줄 → 150줄 내 수용

---

## 3. Phase 0: DB 마이그레이션 + 인덱스 + RLS


### 3.0 Preflight SQL + 데이터 정리 런북 (SEC/OPS 보강)

> **목표**: UNIQUE/RLS/RPC 적용 전에 “현재 데이터가 제약을 만족하는지”를 **팩트(쿼리 결과)**로 확인하고, 정리 정책을 명시한다.  
> **원칙**: 정리(삭제/병합)는 자동화하지 않는다. **탐지 쿼리 → 스냅샷 저장 → 수동 승인 후 정리**.

#### 3.0.1 중복 탐지 (UNIQUE 5건 대상)

- settlement_queue(match_id) 중복
```sql
SELECT match_id, COUNT(*) 
FROM settlement_queue
GROUP BY match_id
HAVING COUNT(*) > 1;
```

- sellers(phone) 중복
```sql
SELECT phone, COUNT(*)
FROM sellers
GROUP BY phone
HAVING COUNT(*) > 1;
```

- sellers(seller_code) 중복
```sql
SELECT seller_code, COUNT(*)
FROM sellers
GROUP BY seller_code
HAVING COUNT(*) > 1;
```

- return_shipments(consignment_id) 중복
```sql
SELECT consignment_id, COUNT(*)
FROM return_shipments
GROUP BY consignment_id
HAVING COUNT(*) > 1;
```

- st_products(product_number) 중복
```sql
SELECT product_number, COUNT(*)
FROM st_products
GROUP BY product_number
HAVING COUNT(*) > 1;
```

#### 3.0.2 고아 FK 탐지 (예시)

> 실제 FK 구성에 맞게 테이블/컬럼을 확정하고, 아래 패턴으로 전수 탐지한다.

```sql
-- 예: sold_items.seller_id가 sellers.id를 참조한다면
SELECT si.id
FROM sold_items si
LEFT JOIN sellers s ON s.id = si.seller_id
WHERE si.seller_id IS NOT NULL AND s.id IS NULL
LIMIT 200;
```

#### 3.0.3 정리 정책(반드시 문서화)

- “살릴 row”의 기준을 먼저 고정한다. (예: created_at 최신, status 우선순위 등)
- 삭제/병합 실행 전, 대상 row id 목록을 별도 파일(예: `v3-preflight-fixes.sql`)로 저장하고 리뷰 승인 후 실행.
- 실행 직전 **DB 백업/스냅샷**(또는 Supabase Point-in-time/backup)을 확인한다.

### 3.1 마이그레이션 파일 ([Rev.4] 8개 — Rev.3의 6개에서 +2)

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

CREATE INDEX CONCURRENTLY idx_orders_status
  ON orders(status);

CREATE INDEX CONCURRENTLY idx_sales_records_match
  ON sales_records(match_status);

CREATE INDEX CONCURRENTLY idx_settlement_queue_seller
  ON settlement_queue(seller_id);

CREATE INDEX CONCURRENTLY idx_consignment_requests_seller
  ON consignment_requests(seller_id, status);
```

#### 3.1.4 [Rev.3] RLS 정책 (audit2 FIX-03, pa1 IMP-03)
```sql
-- 004_rls_policies.sql
-- WHY: anon client가 RLS 없이 전체 테이블 접근 가능 (SEC-05)
-- HOW: Public 페이지가 접근하는 테이블에만 RLS 적용

ALTER TABLE consignment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY consignment_anon_read ON consignment_requests
  FOR SELECT TO anon
  USING (adjustment_token IS NOT NULL AND adjustment_token = current_setting('request.headers', true)::json->>'x-adjustment-token');

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_anon_read ON orders
  FOR SELECT TO anon USING (true);
CREATE POLICY orders_anon_update ON orders
  FOR UPDATE TO anon
  USING (status = 'IMAGE_COMPLETE');
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
  v_expected_count := COALESCE(array_length(p_sold_item_ids, 1), 0);
  IF v_expected_count = 0 THEN
    RAISE EXCEPTION '정산 항목이 비어있습니다 (sold_item_ids가 빈 배열)';
  END IF;

  SELECT COUNT(*) INTO v_locked_count
    FROM sold_items
    WHERE id = ANY(p_sold_item_ids)
      AND settlement_status = 'pending'
    FOR UPDATE;

  IF v_locked_count != v_expected_count THEN
    RAISE EXCEPTION '잠금 실패: 예상 %건 중 %건만 pending', v_expected_count, v_locked_count;
  END IF;

  INSERT INTO settlements (
    seller_id, period_start, period_end,
    total_sales, commission_rate, commission_amount, settlement_amount,
    settlement_status
  ) VALUES (
    p_seller_id, p_period_start, p_period_end,
    p_total_sales, p_commission_rate, p_commission_amount, p_settlement_amount,
    'pending'
  ) RETURNING id INTO v_settlement_id;

  INSERT INTO settlement_items (settlement_id, sold_item_id)
    SELECT v_settlement_id, unnest(p_sold_item_ids);

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
  v_items_count := jsonb_array_length(p_items);
  IF v_items_count = 0 THEN
    RAISE EXCEPTION '주문 아이템이 비어있습니다';
  END IF;

  INSERT INTO orders (order_number, customer_name, phone, status)
  VALUES (p_order_number, p_customer_name, p_customer_phone, p_status)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
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

#### 3.1.6 [Rev.4] upload_session_id 컬럼 (R4-01: DAT-09)
```sql
-- 008_upload_session_id.sql
-- WHY: V2에서 DELETE .eq('match_status', 'unmatched') → 동시 관리자 업로드 시 상대 데이터 삭제 (v5 DAT-09)
--      세션 기반 삭제로 자기 업로드 데이터만 정리 가능하게 변경
-- HOW: sales_records에 upload_session_id 컬럼 추가 + 인덱스

ALTER TABLE sales_records ADD COLUMN upload_session_id uuid;
CREATE INDEX CONCURRENTLY idx_sales_records_session
  ON sales_records(upload_session_id)
  WHERE upload_session_id IS NOT NULL;
-- 기존 데이터: upload_session_id = NULL (마이그레이션 영향 없음)
-- V3부터 모든 업로드에 세션 ID 발급
```

#### 3.1.7 [Rev.4] _batch_progress 테이블 (R4-04: IMP-10)
```sql
-- 009_batch_progress.sql
-- WHY: logBatch(result) 호출이 §7.2에 있으나 테이블 DDL이 없었음 (aud1-1 GAP-09)
-- HOW: 배치 진행 상태를 기록하는 테이블 생성

CREATE TABLE _batch_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id text NOT NULL UNIQUE,
  total int NOT NULL,
  completed int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  failed_ids jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN ('running','completed','partial','failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- batch_id UNIQUE: 동일 배치 중복 기록 방지
-- failed_ids: 실패한 product ID 목록 → 재시도 시 사용
```


#### 3.1.8 [SEC/OPS 보강] Public 접근(orders) 토큰 기반 RLS로 축소

> **문제**: `orders_anon_read USING (true)`는 orders 전체 읽기를 허용해 과잉이다.  
> **해결**: Public 기능이 요구하는 “해당 row만” 접근하도록 **토큰 기반**으로 제한한다.

```sql
-- 010_public_orders_rls.sql (SEC/OPS)
-- 1) Public hold 기능을 위한 토큰 컬럼(1회성/랜덤) 추가
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS hold_token text;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_hold_token
  ON orders(hold_token)
  WHERE hold_token IS NOT NULL;

-- 2) 기존 USING(true) 제거 후, 토큰 일치 row만 허용
DROP POLICY IF EXISTS orders_anon_read ON orders;
DROP POLICY IF EXISTS orders_anon_update ON orders;

-- Supabase(PostgREST)에서 request header를 RLS에 전달하는 방식은 환경에 따라 다르므로,
-- 표준화된 함수/세팅을 프로젝트에서 1개로 확정해야 한다.
-- 아래는 “요청 헤더 기반 토큰 전달”을 전제로 한 예시이다.
CREATE POLICY orders_anon_read ON orders
  FOR SELECT TO anon
  USING (
    hold_token IS NOT NULL
    AND hold_token = current_setting('request.headers', true)::json->>'x-hold-token'
  );

CREATE POLICY orders_anon_update ON orders
  FOR UPDATE TO anon
  USING (
    hold_token IS NOT NULL
    AND hold_token = current_setting('request.headers', true)::json->>'x-hold-token'
    AND status = 'IMAGE_COMPLETE'
  );
```

- **중요**: `current_setting('request.headers', true)` 전달 방식은 실제 Supabase 환경에서 동작을 **반드시 실측**한다.  
  동작이 불안정하면, “토큰을 헤더가 아니라 쿼리 파라미터/바디로 받고 서버(Route)에서 service_role로 검증 후 업데이트” 방식으로 전환한다.

### 3.2 Phase 0 검증 게이트 ([Rev.4] 10개 — Rev.3의 8개에서 +2)
```
□ ConsignmentStatus CHECK 7값 확인
□ UNIQUE 5개 적용: \d+ [테이블명]
□ 인덱스 5개 생성 확인: \di+ idx_*
□ RLS 정책 2개 테이블 활성화: SELECT tablename FROM pg_tables WHERE rowsecurity = true;
□ RPC 3개 생성: SELECT routine_name FROM information_schema.routines WHERE routine_type = 'FUNCTION';
□ RPC 단위 테스트: 빈 배열 → 에러, 정상 배열 → uuid 반환
□ RPC 동시 실행 테스트: 2개 세션에서 동일 sold_items FOR UPDATE → 1개만 성공
□ 기존 중복 데이터 0건 확인 (정리 완료)
□ [Rev.4] upload_session_id 컬럼 확인: \d sales_records → upload_session_id uuid 존재
□ [Rev.4] _batch_progress 테이블 확인: \d _batch_progress → 8개 컬럼 존재

□ [SEC/OPS] Preflight 중복/고아 FK 탐지 쿼리 실행 결과 스냅샷 저장 (승인 전에는 정리 SQL 실행 금지)
□ [SEC/OPS] RLS 실측 테스트:
  - anon(토큰 없음)으로 orders/consignment 조회 → 0 row 또는 403
  - 토큰 일치 시 해당 row만 조회 가능
  - anon update 시 토큰 불일치/상태 불일치 → 0 row 또는 403
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
```

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


### 4.5 [SEC/OPS 보강] 사진 URL 헬퍼 (Phase 7 대비)

> **목표**: 프론트(Phase 6)가 사진 경로를 하드코딩하지 않도록 “단일 함수”로 강제하고,  
> Phase 7(Storage 전환)은 **환경변수만**으로 스위치한다.

```typescript
// lib/utils/photo-url.ts
import { createClient } from '@/lib/supabase/client'

export function getPhotoUrl(productId: string, fileName: string): string {
  const mode = process.env.PHOTO_STORAGE_MODE ?? 'legacy' // 'legacy' | 'supabase'
  if (mode === 'supabase') {
    // public bucket을 전제. private bucket이면 signed URL 전략으로 변경.
    const supabase = createClient()
    const { data } = supabase.storage.from('photos').getPublicUrl(`${productId}/${fileName}`)
    return data.publicUrl
  }
  return `/uploads/photos/${productId}/${fileName}` // V2 호환 (Phase 7 전까지)
}
```

---

## 5. Phase 2: 데이터 레이어

### 5.1 생성 파일 ([Rev.4] 12개 — Rev.3의 11개에서 batch.repo +1)

```
lib/db/client.ts
lib/db/repositories/sellers.repo.ts        ← 90줄 (매핑 내장)
lib/db/repositories/orders.repo.ts         ← 110줄
lib/db/repositories/consignments.repo.ts   ← 100줄
lib/db/repositories/settlement.repo.ts     ← 110줄
lib/db/repositories/products.repo.ts       ← 80줄
lib/db/repositories/notifications.repo.ts  ← 60줄
lib/db/repositories/sales-records.repo.ts  ← 70줄 + [Rev.4] 세션 기반 delete
lib/db/repositories/naver-settlements.repo.ts ← 70줄
lib/db/repositories/batch.repo.ts          ← [Rev.4] ~40줄 (logBatch + getByBatchId)
lib/db/transactions/settlement.tx.ts
lib/db/transactions/order.tx.ts
lib/db/transactions/consignment.tx.ts
```

### 5.2 리포지토리 핵심 원칙 (5개 — 모두 V2 문제에서 유래)

```typescript
// 원칙 1: 모든 { data, error } 필수 확인 (V2 9건 미확인)
const { data, error } = await supabase.from('sellers').select('*')
if (error) throw new Error(`sellers 조회 실패: ${error.message}`)

// 원칙 2: .in() 호출 시 chunkArray(100) (V2 H10)
const chunks = chunkArray(ids, 100)
const results = await Promise.all(chunks.map(chunk =>
  supabase.from('sold_items').select('*').in('id', chunk)
))

// 원칙 3: 목록 쿼리에 .range() 강제 (V2 DAT-01 1000행 절삭)
const { data, count } = await supabase
  .from('orders').select('*', { count: 'exact' })
  .range(from, to)

// 원칙 4: .or() 문자열 보간 전면 제거 (V2 SEC-04)
// ❌ .or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
// ✅ .ilike('name', `%${search}%`) 또는 RPC 사용

// 원칙 5: 상태 UPDATE에 .eq('status', expected) (V2 DAT-08)
const { data, error } = await supabase
  .from('consignment_requests')
  .update({ status: 'completed' })
  .eq('id', id)
  .eq('status', 'approved')
  .select()
  .single()
if (!data) throw new Error('상태가 이미 변경됨 (다른 관리자)')
```

### 5.3 [Rev.4] 세션 기반 삭제 패턴 (R4-01: DAT-09)

```typescript
// sales-records.repo.ts 내부
// WHY: V2의 DELETE .eq('match_status', 'unmatched')는 모든 미매칭 데이터 삭제
//      → 동시 관리자 업로드 시 상대방 데이터까지 삭제 (v5 DAT-09)
// HOW: upload_session_id 기반으로 자기 세션 데이터만 삭제

export async function deleteBySession(sessionId: string) {
  const { error } = await supabase
    .from('sales_records')
    .delete()
    .eq('upload_session_id', sessionId)
    .eq('match_status', 'unmatched')
  if (error) throw new Error(`세션 기반 삭제 실패: ${error.message}`)
}

export async function insertWithSession(records: SalesRecord[], sessionId: string) {
  const withSession = records.map(r => ({ ...r, upload_session_id: sessionId }))
  const { error } = await supabase
    .from('sales_records')
    .insert(withSession)
  if (error) throw new Error(`세션 기반 삽입 실패: ${error.message}`)
}
```

### 5.4 [Rev.4] batch.repo.ts (R4-04)

```typescript
// lib/db/repositories/batch.repo.ts
/**
 * 배치 진행 상태 CRUD
 * WHY: classifyBatch의 logBatch(result) 호출에 대응하는 DB 레이어 (aud1-1 GAP-09)
 * HOW: _batch_progress 테이블 기반
 */

import { supabase } from '../client'
import type { BatchResult } from '@/lib/types/domain/photo'

export async function logBatch(result: BatchResult) {
  const { error } = await supabase
    .from('_batch_progress')
    .upsert({
      batch_id: result.batchId,
      total: result.total,
      completed: result.completed,
      failed: result.failed,
      failed_ids: result.failedIds,
      status: result.status,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'batch_id' })
  if (error) throw new Error(`배치 기록 실패: ${error.message}`)
}

export async function getByBatchId(batchId: string) {
  const { data, error } = await supabase
    .from('_batch_progress')
    .select('*')
    .eq('batch_id', batchId)
    .single()
  if (error) throw new Error(`배치 조회 실패: ${error.message}`)
  return data
}
```

### 5.5 매핑 내장 패턴 (매퍼 파일 제거)
```typescript
// sellers.repo.ts 내부
function mapRow(row: DbSeller): Seller {
  return {
    id: row.id, name: row.name, phone: row.phone,
    tier: row.tier as SellerTier, commissionRate: row.commission_rate,
  }
}
```

### 5.6 Phase 2 검증 게이트
```
□ tsc --strict --noEmit → 에러 0건
□ ESLint: grep -r "\.or(\`" lib/db/ → 0건 (PostgREST 인젝션 0)
□ 모든 리포지토리에서 error 체크: grep -r "if.*error.*throw" lib/db/repositories/ → 파일 수와 일치
□ .range() 사용: grep -r "\.range(" lib/db/repositories/ → 목록 함수 수와 일치
□ chunkArray 사용: grep -r "chunkArray" lib/db/repositories/ → .in() 사용 횟수와 일치
□ 매퍼 파일 0개: ls lib/db/mappers/ → 디렉토리 없음
□ 리포지토리 120줄 이내: wc -l lib/db/repositories/*.ts
□ [Rev.4] sales-records.repo.ts에 deleteBySession 존재: grep "deleteBySession" lib/db/repositories/sales-records.repo.ts
□ [Rev.4] batch.repo.ts 존재: ls lib/db/repositories/batch.repo.ts
```

---

## 6. Phase 3: 미들웨어 + 인증

(Rev.2와 동일. middleware.ts + lib/api/middleware.ts 2개 파일)

### 6.1 [Rev.3] bcrypt cost 명시 (SEC-02 보강)
```typescript
// lib/auth.ts
const BCRYPT_COST = 12
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
interface BatchResult {
  batchId: string
  total: number
  completed: number
  failed: number
  failedIds: string[]
  status: 'running' | 'completed' | 'partial' | 'failed'
}

export async function classifyBatch(productIds: string[]): Promise<BatchResult> {
  const batchId = crypto.randomUUID()
  const result: BatchResult = {
    batchId, total: productIds.length, completed: 0, failed: 0,
    failedIds: [], status: 'running'
  }

  for (const id of productIds) {
    try {
      await classifySingle(id)
      result.completed++
    } catch (err) {
      result.failed++
      result.failedIds.push(id)
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
  await batchRepo.logBatch(result) // [Rev.4] batch.repo.ts 사용
  return result
}
```

### 7.3 [Rev.3] SWR 캐싱 전략 (audit2 FIX-15, pa1 IMP-13)

```typescript
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

## 8. Phase 5: API 라우트 ([Rev.4] 63개)

### 8.1 라우트 수 정정 ([Rev.4] Rev.3 "62" → Rev.4 "63")

| Tier | 라우트 수 | 일정 |
|------|----------|------|
| Tier 1 CRITICAL | [Rev.4] **11** (Rev.3: 10 + health 1) | Session 5 (Day 5) |
| Tier 2 HIGH | 20 | Session 6 (Day 6) |
| DELETE 라우트 | 6 | Session 6 (Day 6) |
| 미분류 라우트 | 4 | Session 7 (Day 7) |
| Tier 3 MEDIUM/LOW | 22 | Session 7 (Day 7) |
| **합계** | **63** | 3일 |

### 8.2 표준 핸들러 패턴 (모든 라우트 이 패턴 준수)
```typescript
/**
 * [메서드] [경로] — [1줄 설명]
 * WHY: [V2 문제 ID]
 * HOW: 인증 → Zod 검증 → 서비스 위임 → 표준 응답
 */
import { requireAdmin } from '@/lib/api/middleware'
import { ok, err, validationErr } from '@/lib/api/response'
import { XxxSchema } from './schema'
import * as service from '@/lib/services/xxx.service'

export async function POST(req: NextRequest) {
  const authErr = await requireAdmin(req)
  if (authErr) return authErr

  const body = await req.json().catch(() => ({}))
  const parsed = XxxSchema.safeParse(body)
  if (!parsed.success) return validationErr(parsed.error.message)

  console.log('[api-name] 시작')
  try {
    const result = await service.xxx(parsed.data)
    console.log('[api-name] 완료')
    return ok(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류'
    console.error('[api-name] 실패:', msg)
    Sentry.captureException(e)
    return err(msg)
  }
}
```


### 8.2.1 [SEC/OPS 보강] 에러 응답 표준화 (운영 품질)

> **목표**: 프론트가 “무슨 에러인지”를 코드로 분기 가능하게 하고, Public 라우트는 메시지를 무해하게 제한한다.

- 표준 에러 형태:
```ts
{ success:false, error:{ code:'VALIDATION'|'AUTH'|'CONFLICT'|'NOT_FOUND'|'RATE_LIMIT'|'INTERNAL', message:string } }
```

- 내부 구현 권장:
  - `lib/api/errors.ts`: `AppError(code, message, httpStatus)`
  - `lib/api/response.ts`: `errFrom(e)`로 AppError → HTTP status/코드 매핑
  - Public 라우트는 `message`를 “처리할 수 없습니다” 수준으로 축소(상세는 Sentry만)

### 8.3 [Rev.4] /api/health 헬스체크 (R4-02: FIX-17)


> **보안 경계(필수)**  
> - 외부 호출은 `HEALTHCHECK_TOKEN`(예: 헤더 `x-health-token`)이 없으면 **404 또는 401**  
> - 토큰이 없을 때는 `{ status }`만 반환(체크 상세/에러 메시지/latency 숨김)  
> - 토큰이 있을 때만 `{ checks, timestamp }` 포함

```typescript
// app/api/health/route.ts
// WHY: 프로덕션 모니터링 — DB+Storage+SMS 상태를 단일 엔드포인트로 확인 (audit2 FIX-17)
// HOW: 인증 불필요 (외부 모니터링 서비스 접근용), GET만 허용

export async function GET() {
  const checks = {
    db: await checkDB(),        // SELECT 1 FROM sellers LIMIT 1
    storage: await checkStorage(), // supabase.storage.listBuckets()
    sms: await checkSMS(),      // 알리고 잔액 API → 잔액 > 0
  }
  const allOk = Object.values(checks).every(v => v.ok)
  return NextResponse.json(
    { status: allOk ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  )
}

// 각 체크는 try-catch로 개별 실패 시에도 나머지 체크 수행
// { ok: boolean, latency_ms: number, error?: string }
```

### 8.4 [Rev.4] upload-naver-settle 세션 기반 패턴 (R4-01: DAT-09)


> **세션 정책(필수 확정)**  
> - **업로드 1회 = 1세션**(재시도 포함). `sessionId`는 클라이언트가 보관하고 재시도 요청에 `x-upload-session-id`로 재전송한다.  
> - 동시 업로드(A/B)는 서로 다른 `sessionId`로 완전 격리된다.  
> - “관리자별 이전 세션 자동 정리”가 필요하면 `admin_id ↔ last_session_id` 매핑 테이블을 별도로 둔다(옵션).

```typescript
// app/api/admin/sales/upload-naver-settle/route.ts (개념)
// WHY: V2의 DELETE .eq('match_status', 'unmatched')는 다른 관리자 데이터도 삭제 (DAT-09)
// HOW: 업로드 시작 시 세션 ID 발급 → 세션 기반 삭제 → 세션 기반 삽입

export async function POST(req: NextRequest) {
  const authErr = await requireAdmin(req)
  if (authErr) return authErr

  // 세션 ID: 업로드 1회(재시도 포함)의 식별자
  // - 최초 업로드: 서버가 발급해 응답으로 돌려줌
  // - 재시도 업로드: 클라이언트가 기존 sessionId를 다시 보냄
  const incoming = req.headers.get('x-upload-session-id')
  const sessionId = incoming ?? crypto.randomUUID()

  // 1) 같은 세션 재시도 시, 해당 세션의 미매칭만 정리 (동시 업로드 격리)
  if (incoming) {
    await salesRecordsRepo.deleteBySession(sessionId)
  }

  // 2. 새 데이터를 세션 ID와 함께 삽입
  await salesRecordsRepo.insertWithSession(parsedRecords, sessionId)

  // 3. 자동 매칭 실행
  await matchingService.autoMatch()

  return ok({ sessionId, inserted: parsedRecords.length })
}
```

### 8.5 co-located schema.ts 예시
```typescript
// app/api/settlement/generate/schema.ts
import { z } from 'zod'
import { DateSchema, UuidSchema } from '@/lib/utils/validation'

export const GenerateSettlementSchema = z.object({
  period_start: DateSchema,
  period_end: DateSchema,
  seller_ids: z.array(UuidSchema).optional(),
})
```

### 8.6 검증 게이트 ([Rev.4] ESLint 기반 — 8개 항목)
```
□ tsc --strict --noEmit → 에러 0건
□ ESLint --max-warnings 0 (CI에서 자동 실행)
□ requireAdmin 반환값 사용 강제: ESLint 커스텀 규칙
□ 모든 POST/PATCH에 schema.ts 존재: ls app/api/**/schema.ts
□ wc -l app/api/**/route.ts → 모든 라우트 100줄 이내
□ grep -r "\.or(\`" app/ → 0건
□ grep -r "req\.json()" app/api/ | grep -v "catch" → 0건
□ [Rev.4] DB 업데이트 → 응답 생성 순서 준수: 모든 서비스에서 DB 작업 후 Response 생성 확인 (R4-03: FIN-07)
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
```

---

## 10. Phase 7: 스토리지 마이그레이션

### 10.1 [Rev.3] 멱등성 보장 스크립트 (audit2 FIX-10, pa1 IMP-09)

```sql
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
  const pending = await db.query(
    `SELECT * FROM _migration_checkpoint WHERE status != 'url_updated' ORDER BY file_name`
  )
  console.log(`[migrate] 남은 건수: ${pending.length}`)

  for (const photo of pending) {
    try {
      if (photo.status === 'pending') {
        const url = await uploadToStorage(photo.local_path, photo.bucket)
        await db.query(
          `UPDATE _migration_checkpoint SET status = 'uploaded', supabase_url = $1 WHERE file_name = $2`,
          [url, photo.file_name]
        )
      }
      if (photo.status === 'uploaded' || photo.status === 'pending') {
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
      await db.query(
        `UPDATE _migration_checkpoint SET error_message = $1 WHERE file_name = $2`,
        [err.message, photo.file_name]
      )
    }
  }
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
      - run: pnpm tsc --noEmit
      - run: pnpm eslint . --max-warnings 0
      - run: pnpm vitest run
      - run: pnpm next build
```

### 11.2 [Rev.3] Sentry 모니터링 (audit2 FIX-06, pa1 IMP-06)
```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
})
```

### 11.3 [Rev.3] ESLint 커스텀 규칙 (pa1 IMP-08)
```javascript
// eslint-local-rules/must-check-auth.js
module.exports = {
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.name === 'requireAdmin') {
          const parent = node.parent
          if (parent.type !== 'VariableDeclarator' && parent.type !== 'AssignmentExpression') {
            context.report({ node, message: 'requireAdmin() 반환값을 반드시 확인하세요' })
          }
        }
      }
    }
  }
}
```

### 11.4 Phase 8 자동 검증

추가 운영 가드(SEC/OPS):
- Day 5 대량 E2E 시 **동시 DB 커넥션** 폭주 방지: QA는 순차 실행(Alpha→Beta→Gamma) 또는 PgBouncer 사용
- Tier 1 라우트 p95 목표/측정(예: 500ms)과 실패 기준을 런북에 명시

```bash
# Tier 1: ESLint 자동
pnpm eslint . --max-warnings 0

# Tier 2: 추가 grep
tsc --strict --noEmit | wc -l                          # → 0
grep -r 'process\.cwd' lib/ app/ | wc -l               # → 0
grep -r 'readFileSync\|writeFileSync' lib/ app/ | wc -l # → 0

# Tier 3: 수동 검증 (11건)
```

---

## 12. 테스트 전략 [Rev.3 신규]

### 12.1 프레임워크: vitest

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
describe('create_settlement_with_items', () => {
  test('빈 배열 → 에러', async () => {})
  test('이미 정산된 항목 → 에러', async () => {})
  test('동시 2건 요청 → 1건만 성공', async () => {})
  test('정상 실행 → settlement_id 반환', async () => {})
})
```

---

## 13. 세션별 구현 전략 + 에이전트 팀 배치 + 일별 계획 [Rev.4 전면 확장]

### 13.1 왜 세션 계획이 필요한가

Claude Code 세션은 컨텍스트 제한이 있다. 대규모 마이그레이션을 한 세션에 넣으면:
- 컨텍스트 소진 → 후반부 품질 저하
- 검증 없이 다음 Phase 진행 → 연쇄 오류
- 세션 중단 시 이어받기 불가

**원칙**: 한 세션 = 하나의 완결된 작업 단위. 진입 조건 + 산출물 + 퇴출 검증.

### 13.2 [Rev.4] Phase 간 병렬 전략 (2~3팀 동시 운영)

#### 의존성 분석 결과

```
Phase 0 → Phase 1 → Phase 2 → Phase 3+4  (순차 필수, 4일)
                                    ↓
                    ┌───────────────┼───────────────┐
                    ↓               ↓               ↓
              Phase 5 Tier 1  Phase 5 Tier 2  Phase 5 Tier 3   ← 3팀 동시 (1일)
                    │               │               │
                    └───────┬───────┘               │
                            ↓                       ↓
                      Cross-team QA (E2E + 63개 전수)         ← 합류 (0.5일)
                            ↓
                    ┌───────┴───────┐
                    ↓               ↓
              Phase 6 공유+핵심  Phase 6 나머지    ← 2팀 동시 (1일)
                    └───────┬───────┘
                            ↓
                      Phase 7 스토리지            ← 1팀 (1일)
                            ↓
                      Phase 8 검증+빌드           ← 1팀 (1일)
```

**병렬화 근거**:
- Phase 5 Tier 1/2/3: 모든 라우트가 Phase 4(서비스)에만 의존. 라우트 간 의존 없음 → **3팀 동시 가능**
- Phase 6 Part 1/2: 공유 컴포넌트 생성 후 페이지는 독립 → **2팀 동시 가능** (공유 컴포넌트 선행 후)

**일정 압축**: 13일(순차) → **9일 (8일 작업 + 1일 버퍼)**

### 13.3 세션 맵 (9일 = 8일 작업 + 1일 버퍼)

---

#### Day 1 — Session 1: Phase 0 DB 마이그레이션 [1팀]

**진입 조건**: plan3 rev4.md 승인 완료
**산출물**: [Rev.4] 9개 마이그레이션 + 3개 RPC 실행 완료
**검증**: Phase 0 게이트 [Rev.4] 10개 통과

| 역할 | 에이전트 타입 | 담당 | 병렬 |
|------|-------------|------|------|
| CTO Lead | cto-lead | 전략 수립, 마이그레이션 순서 결정, 품질 총괄 | — |
| DB-1 | infra-architect | SQL 001~004 실행 (CHECK + UNIQUE + INDEX + RLS) | ✅ |
| DB-2 | bkend-expert | SQL 005~007 실행 (RPC 3개) + 빈 배열 엣지 테스트 | ✅ |
| DB-3 | general-purpose | **[R4-01]** SQL 008 + **[R4-04]** SQL 009 실행 | ✅ |
| QA | qa-strategist | Phase 0 게이트 10개 전수 검증 + RPC 동시 실행 테스트 | 순차 |

**R4 변경 포함**: upload_session_id 컬럼 (R4-01) + _batch_progress 테이블 (R4-04)

---

#### Day 2 — Session 2: Phase 1 인프라 + 타입 + 유틸 [1팀]

**진입 조건**: Session 1 검증 완료
**산출물**: 22개 파일 + 단위 테스트 ~30개
**검증**: tsc 0건 + vitest PASS

| 역할 | 에이전트 타입 | 담당 | 병렬 |
|------|-------------|------|------|
| CTO Lead | cto-lead | 타입 설계 방향 + 의존성 순서 관리 | — |
| 타입 전문가 | typescript-pro | 22개 타입/유틸 파일 작성 (domain 7개 + utils 11개 + 인프라 4개) | ✅ |
| 인프라 | general-purpose | env.ts, supabase/, auth.ts, ratelimit.ts | ✅ |
| 테스트 | test-automator | 단위 테스트 ~30개 작성 (Zod 5개 스키마 + 유틸 함수) | 순차 |
| 리뷰 | architect-review | tsc 0건 + 아키텍처 검증 + any 0건 | 순차 |

---

#### Day 3 — Session 3: Phase 2 데이터 레이어 [1팀]

**진입 조건**: Session 2 검증 완료
**산출물**: [Rev.4] 12개 파일 + RPC 통합 테스트 ~15개
**검증**: PostgREST 인젝션 0건 + .range() 전수

| 역할 | 에이전트 타입 | 담당 | 병렬 |
|------|-------------|------|------|
| CTO Lead | cto-lead | 리포지토리 패턴 검증 + .range() 전수 확인 | — |
| 데이터-1 | general-purpose | 리포지토리 4개 (seller, consignment, order, product) | ✅ |
| 데이터-2 | general-purpose | 리포지토리 4개 (sold-item, settlement, notification, return) | ✅ |
| 데이터-3 | general-purpose | 리포지토리 3개 (sales-record **[R4-01]** + naver-settlement + **[R4-04]** batch.repo) + transactions 3개 | ✅ |
| QA | qa-strategist | RPC 통합 테스트 ~15개 + PostgREST 인젝션 0건 + deleteBySession 존재 확인 | 순차 |

**R4 변경 포함**: sales-records.repo.ts에 세션 기반 delete (R4-01) + batch.repo.ts 신규 (R4-04)

---

#### Day 4 — Session 4: Phase 3 미들웨어 + Phase 4 서비스 [1팀]

**진입 조건**: Session 3 검증 완료
**산출물**: 2개 + 9개 파일 = 11개
**검증**: 인증 curl 테스트 + NextRequest 0건

| 역할 | 에이전트 타입 | 담당 | 병렬 |
|------|-------------|------|------|
| CTO Lead | cto-lead | 서비스 레이어 오케스트레이션 설계 | — |
| 미들웨어 | general-purpose | middleware.ts + lib/api/middleware.ts + lib/api/response.ts | ✅ |
| 서비스-1 | general-purpose | 서비스 5개 (settlement, consignment, order, product, photo) | ✅ |
| 서비스-2 | general-purpose | 서비스 4개 (sales, notification, seller, return) | ✅ |
| 리뷰 | code-reviewer | NextRequest import 0건 + 150줄 이내 + batchRepo.logBatch 호출 확인 | 순차 |

**추가 작업**: Session 4 시작 시 V2 라우트 전수 카운트 재확인

---

#### Day 5 — Session 5/6/7 동시: Phase 5 전체 63개 라우트 [★ 3팀 동시 운영]

**진입 조건**: Session 4 검증 완료
**운영 방식**: 3개 독립 팀이 같은 날 동시 작업. 각 팀은 별도 git worktree 또는 디렉토리 분리.

##### Team Alpha — Tier 1 CRITICAL ([Rev.4] 11개)

| 역할 | 에이전트 타입 | 담당 | 병렬 |
|------|-------------|------|------|
| Alpha Lead | cto-lead | Tier 1 품질 총괄 + **[R4-03]** DB-우선 원칙 감시 | — |
| 라우트-A1 | general-purpose | 라우트 4개 (auth login, settlement generate/confirm/pay) | ✅ |
| 라우트-A2 | general-purpose | 라우트 4개 (consignment CRUD, order CRUD) | ✅ |
| 라우트-A3 | general-purpose | 라우트 2개 (dashboard, consignment/adjust) + **[R4-02]** /api/health | ✅ |
| QA-A | qa-strategist | 11개 검증 + DB-우선 순서 확인 | 순차 |

**산출물**: 11개 route.ts + 10개 schema.ts + /api/health
**R4 포함**: /api/health (R4-02), DB-우선 검증 게이트 (R4-03)

##### Team Beta — Tier 2 + DELETE (26개)

| 역할 | 에이전트 타입 | 담당 | 병렬 |
|------|-------------|------|------|
| Beta Lead | general-purpose | Tier 2 배분 + upload-naver-settle 세션 패턴 감시 | — |
| 라우트-B1 | general-purpose | Tier 2 라우트 10개 (photos, products, notifications, history, sellers) | ✅ |
| 라우트-B2 | general-purpose | Tier 2 라우트 10개 (sales, 기타 CRUD) | ✅ |
| 라우트-B3 | general-purpose | DELETE 6개 + **[R4-01]** upload-naver-settle 세션 기반 패턴 | ✅ |
| QA-B | qa-strategist | 26개 전수 검증 + sessionId 사용 확인 | 순차 |

**산출물**: 26개 route.ts + schema.ts
**R4 포함**: upload-naver-settle 세션 기반 삭제 (R4-01)

##### Team Gamma — Tier 3 + 미분류 (26개)

| 역할 | 에이전트 타입 | 담당 | 병렬 |
|------|-------------|------|------|
| Gamma Lead | general-purpose | Tier 3 배분 + 미분류 라우트 관리 | — |
| 라우트-G1 | general-purpose | Tier 3 라우트 13개 | ✅ |
| 라우트-G2 | general-purpose | Tier 3 라우트 9개 + 미분류 4개 | ✅ |
| QA-G | qa-strategist | 26개 전수 검증 | 순차 |

**산출물**: 26개 route.ts + schema.ts

##### Day 5 합류: Cross-team QA + E2E

3팀 모두 완료 후:
| 역할 | 에이전트 타입 | 담당 |
|------|-------------|------|
| CTO Lead | cto-lead | 63개 라우트 전수 확인 총괄 |
| 테스트 | test-automator | E2E 테스트 ~10개 (CRITICAL 라우트) |
| QA | qa-strategist | `ls app/api/**/route.ts \| wc -l` = **63** + vitest E2E PASS |
| 리뷰 | code-reviewer | 3팀 코드 일관성 검증 (네이밍, 패턴, 에러 처리) |

**Day 5 총 에이전트**: Alpha 5 + Beta 5 + Gamma 4 + Cross-QA 4 = **최대 18명**
**3팀 동시 이점**: Phase 5 (3일 소요) → **1일로 압축**

---

#### Day 6 — Session 8/9 동시: Phase 6 전체 17페이지 [★ 2팀 동시 운영]

**진입 조건**: Day 5 Cross-team QA 완료 (63개 라우트 전수 + E2E PASS)
**운영 방식**: 공유 컴포넌트를 Team Alpha가 선행 생성 → 양 팀 동시 페이지 구현

##### Team Alpha — 공유 컴포넌트 + 핵심 페이지 (6개)

| 역할 | 에이전트 타입 | 담당 | 병렬 |
|------|-------------|------|------|
| Alpha Lead | cto-lead | UI 아키텍처 + 컴포넌트 구조 결정 | — |
| 공유 UI | frontend-developer | 공유 컴포넌트 8개 (Table, Modal, Form, Button, Toast, Layout, Sidebar, SearchInput) | **선행** |
| UI-A1 | frontend-developer | 핵심 페이지 3개 (settlement/workflow, settlement, consignments) | ✅ |
| UI-A2 | frontend-developer | 핵심 페이지 2개 (orders, dashboard) + Public 1개 (/consignment/adjust) | ✅ |
| 리뷰 | code-reviewer | 정적 인라인 0건 + alert/confirm 0건 + 150줄 이내 | 순차 |

**산출물**: 공유 컴포넌트 8개 + 핵심 6페이지

##### Team Beta — 나머지 페이지 (11개)

**시작 조건**: 공유 컴포넌트 8개 생성 완료 후 시작 (Alpha 선행 작업 ~2시간 후)

| 역할 | 에이전트 타입 | 담당 | 병렬 |
|------|-------------|------|------|
| Beta Lead | general-purpose | 페이지 배분 + import 경로 일관성 | — |
| UI-B1 | frontend-developer | 어드민 4개 (photos, products, notifications, settlement/history) | ✅ |
| UI-B2 | frontend-developer | 어드민 4개 (settlement/sellers, sales, database, sales/erp) | ✅ |
| UI-B3 | frontend-developer | 어드민 2개 (sales/ledger, login) + Public 1개 (/orders/hold) | ✅ |
| QA-B | qa-strategist | 11개 페이지 렌더링 + RLS 검증 (anon vs service_role) | 순차 |

**산출물**: 나머지 11페이지

##### Day 6 합류: 전수 검증

| 역할 | 에이전트 타입 | 담당 |
|------|-------------|------|
| CTO Lead | cto-lead | 17개 페이지 전수 렌더링 확인 |
| QA | qa-strategist | RLS 동작 확인 + 크로스 페이지 네비게이션 검증 |

**Day 6 총 에이전트**: Alpha 5 + Beta 5 + Cross-QA 2 = **최대 12명**
**2팀 동시 이점**: Phase 6 (2일 소요) → **1일로 압축**

---

#### Day 7 — Session 10: Phase 7 스토리지 마이그레이션 [1팀]

**진입 조건**: Day 6 검증 완료 + **Supabase Storage 용량 확인 (Pro 플랜)**
**산출물**: 마이그레이션 스크립트 + 17+ 파일 수정
**검증**: fs 의존 0건 + 사진 URL 404 0건

| 역할 | 에이전트 타입 | 담당 | 병렬 |
|------|-------------|------|------|
| CTO Lead | cto-lead | 마이그레이션 전략 + 멱등성 보장 감시 | — |
| 스토리지 | general-purpose | 마이그레이션 스크립트 작성 + _migration_checkpoint 테이블 생성 | ✅ |
| 수정 | general-purpose | 17+ 파일 fs→Storage URL 수정 (st_products, photo.service 등) | ✅ |
| QA | qa-strategist | `grep -r "require('fs')" → 0건` + 사진 URL 404 0건 + 체크포인트 정합성 | 순차 |

---

#### Day 8 — Session 11: Phase 8 검증 + CI/CD + 모니터링 + 최종 빌드 [1팀]

**진입 조건**: Day 7 검증 완료
**산출물**: CI/CD 설정 + Sentry + ESLint 규칙 + 전체 검증
**검증**: next build 성공 + vitest 전체 PASS + 수동 11건

| 역할 | 에이전트 타입 | 담당 | 병렬 |
|------|-------------|------|------|
| CTO Lead | cto-lead | 최종 품질 총괄 + 릴리스 판단 | — |
| CI/CD | general-purpose | .github/workflows/ci.yml + Sentry 설정 (server + client) | ✅ |
| ESLint | general-purpose | ESLint 커스텀 규칙 (must-check-auth) + 전체 스캔 | ✅ |
| 테스트 | test-automator | 전체 vitest 실행 + 리그레션 ~75개 | ✅ |
| 빌드 | general-purpose | `next build` 성공 확인 + 번들 크기 점검 | 순차 |

**최종 게이트**: `next build` 성공 + `vitest` 전체 PASS + 수동 11건 + [Rev.4] /api/health 200 응답

---

#### Day 9 — 버퍼 (리스크 대응)

**용도**: 병렬 팀 합류 시 충돌 해소 또는 예상치 못한 이슈 대응

| 시나리오 | 대응 |
|---------|------|
| Day 5 3팀 합류 시 코드 충돌 | 충돌 해소 + 패턴 통일 |
| Day 5 E2E 테스트 실패 | 디버깅 + 수정 |
| Day 6 공유 컴포넌트 지연 → Beta 팀 대기 | Alpha 지원 투입 |
| 스토리지 마이그레이션 이슈 | 재실행 (멱등성 보장) |
| next build 실패 | 타입 에러 수정 |
| 전환 런북 드라이런 | T+0~T+20분 시뮬레이션 |

---

### 13.4 병렬 팀 운영 규칙

#### 코드 충돌 방지
- **Day 5 (3팀)**: 각 팀은 `app/api/` 하위 디렉토리를 완전히 분리. 팀 간 공유 파일(lib/) 수정 금지.
- **Day 6 (2팀)**: Team Alpha가 `app/admin/components/` 선행 완료 → Team Beta는 컴포넌트 import만.
- 모든 팀은 `lib/` 디렉토리를 **읽기 전용**으로 취급 (Day 4까지 완성)

#### 팀 간 커뮤니케이션
- 각 팀 Lead는 작업 시작/완료 시 CTO Lead에게 보고
- 공유 타입/스키마 변경 필요 시 → 작업 중단, CTO Lead 승인 후 진행
- Cross-team QA는 모든 팀 완료 후에만 시작

#### 실패 시 폴백
- 3팀 중 1팀이 지연 → 다른 팀이 지원 투입 (Day 9 버퍼 활용)
- 2팀 이상 지연 → 순차 모드로 전환 (Day 5를 Day 5~6으로 확장)

### 13.5 에이전트 팀 규모 총괄 (병렬 구조)

| Day | Phase | 팀 수 | 에이전트 수 | 구성 |
|-----|-------|-------|-----------|------|
| 1 | Phase 0 | 1 | 5 | CTO + 3 DB + 1 QA |
| 2 | Phase 1 | 1 | 5 | CTO + 1 TS + 1 인프라 + 1 테스트 + 1 리뷰 |
| 3 | Phase 2 | 1 | 5 | CTO + 3 데이터 + 1 QA |
| 4 | Phase 3+4 | 1 | 5 | CTO + 1 미들 + 2 서비스 + 1 리뷰 |
| **5** | **Phase 5 ALL** | **3** | **18** | **Alpha 5 + Beta 5 + Gamma 4 + Cross-QA 4** |
| **6** | **Phase 6 ALL** | **2** | **12** | **Alpha 5 + Beta 5 + Cross-QA 2** |
| 7 | Phase 7 | 1 | 4 | CTO + 1 스토리지 + 1 수정 + 1 QA |
| 8 | Phase 8 | 1 | 5 | CTO + 2 설정 + 1 테스트 + 1 빌드 |
| 9 | 버퍼 | 1 | 5 | 상황 대응 |
| **총** | | | **64명·일** | **피크: Day 5 (18명 동시)** |

### 13.6 순차 vs 병렬 비교

| 항목 | 순차 (Rev.3) | 병렬 (Rev.4) | 차이 |
|------|-------------|-------------|------|
| 총 일수 | 13일 (11+2버퍼) | **9일 (8+1버퍼)** | **-4일 (31% 단축)** |
| Phase 5 일수 | 3일 | **1일** | -2일 |
| Phase 6 일수 | 2일 | **1일** | -1일 |
| 피크 에이전트 | 5명 | **18명** | +13명 |
| 총 에이전트·일 | 54 | **64** | +10 (19% 증가) |
| 리스크 | 낮음 | **중간** | 팀 간 충돌 가능 |
| 버퍼 | 2일 | **1일** | -1일 |

### 13.7 세션 간 컨텍스트 이어받기

각 세션 완료 시 다음 파일 업데이트:

```
v3-context.md  ← 핵심 결정사항, 파일 경로, 다음 세션 진입 조건
v3-tasks.md    ← 체크리스트 (완료/미완료)
```

**세션 시작 시 필수 읽기**:
1. plan3 rev4.md (이 문서)
2. v3-context.md (이전 세션 결과)
3. v3-tasks.md (남은 작업)

**병렬 팀 특별 규칙**: Day 5/6에서 각 팀은 자기 팀의 context 파일을 별도 유지:
- `v3-context-alpha.md`, `v3-context-beta.md`, `v3-context-gamma.md`
- Cross-team QA 후 통합하여 `v3-context.md`로 머지

### 13.8 [Rev.4] R4 변경사항 세션 분포

| R4 변경 | 해당 Day | 팀 | 에이전트 |
|---------|---------|-----|---------|
| R4-01 SQL (upload_session_id) | **Day 1** | 단일팀 | DB-3 |
| R4-01 Repo (deleteBySession) | **Day 3** | 단일팀 | 데이터-3 |
| R4-01 Route (upload-naver-settle) | **Day 5** | **Team Beta** | 라우트-B3 |
| R4-02 Route (/api/health) | **Day 5** | **Team Alpha** | 라우트-A3 |
| R4-03 Gate (DB-우선 체크) | **Day 5** | **Team Alpha** | QA-A |
| R4-04 SQL (_batch_progress) | **Day 1** | 단일팀 | DB-3 |
| R4-04 Repo (batch.repo.ts) | **Day 3** | 단일팀 | 데이터-3 |

---

## 14. V2→V3 전환 런북 [Rev.3 전면 재설계]

### 14.1 분 단위 절차

```
T-24시간: 관리자에게 공지 "내일 XX시 시스템 점검 30분 예정"

T-60분: 최종 사전 확인
  □ V3 빌드 성공 (next build)
  □ vitest 전체 PASS
  □ Vercel에 V3 빌드 대기 상태
  □ [Rev.4] /api/health 200 응답 확인

T-0분: V2 maintenance mode 활성화
  → Vercel 환경변수 MAINTENANCE=true 설정
  → V2 모든 페이지 "점검 중" 표시
  → 이 시점부터 V2 데이터 변경 불가

T+2분: 데이터 정합성 확인 쿼리 5개 실행
  1) SELECT COUNT(*) FROM settlements WHERE settlement_status = 'pending';        → 0
  2) SELECT COUNT(*) FROM sold_items WHERE seller_id IS NULL;                      → 0
  3) SELECT match_id, COUNT(*) FROM settlement_queue GROUP BY match_id HAVING COUNT(*) > 1; → 0행
  4) SELECT COUNT(*) FROM settlement_items si WHERE NOT EXISTS (SELECT 1 FROM settlements s WHERE s.id = si.settlement_id); → 0
  5) SELECT COUNT(*) FROM sold_items WHERE settlement_status = 'pending';          → 0

T+5분: 5개 모두 0건 → V3 배포 실행

T+10분: V3 배포 완료 → 스모크 테스트 [Rev.4] 6건
  1) GET /api/health → 200 (DB+Storage+SMS 정상)  ← [Rev.4 추가]
  2) POST /api/admin/auth/login → 200
  3) GET /admin/dashboard → 200
  4) GET /api/admin/consignments → 200
  5) GET /api/admin/orders → 200
  6) POST /api/settlement/generate (드라이런) → 200

T+15분: 스모크 6건 전부 통과 → maintenance mode 해제

T+20분: 관리자에게 "시스템 점검 완료" 공지

롤백 조건: T+10분 스모크 1건이라도 실패 → 즉시 롤백
롤백 방법: Vercel 대시보드 → 이전 배포 즉시 전환 (2분 소요)
```

---

## 15. 적대적 시뮬레이션 [Rev.4] 16회 (Rev.3의 15회 + 1회 추가)

### SIM-R3-01 ~ SIM-R3-15 (Rev.3과 동일)

(생략 — Rev.3 §15 참조. 15회 중 PASS 13건, PARTIAL 2건.)

### SIM-R4-16: [Rev.4 추가] "upload-naver-settle 동시 2명 업로드 — 세션 격리 검증"

**시나리오**: Admin A와 Admin B가 동시에 네이버 정산 엑셀을 업로드. 각각 다른 세션 ID. Admin A의 삭제가 Admin B의 데이터를 삭제하는지 검증.

| 단계 | 발생 | 대응 | 결과 |
|------|------|------|------|
| 1 | Admin A: sessionId = 'aaa', 100건 업로드 | deleteBySession('aaa') → 자기 이전 데이터만 삭제 | **PASS** |
| 2 | Admin B: sessionId = 'bbb', 50건 동시 업로드 | deleteBySession('bbb') → 자기 이전 데이터만 삭제 | **PASS** |
| 3 | 결과: A의 100건 + B의 50건 모두 보존 | upload_session_id 기반 WHERE 절이 격리 보장 | **PASS** |
| 4 | 자동 매칭 후 미매칭 조회 | match_status = 'unmatched' AND upload_session_id = 'aaa' → A의 미매칭만 | **PASS** |

**판정**: PASS — 세션 ID 격리가 동시 접근 데이터 보호를 완전히 보장. V2의 DAT-09 재현 불가.

### 시뮬레이션 종합 [Rev.4]

| # | 시나리오 | 판정 | 핵심 |
|---|---------|------|------|
| R3-01~R3-15 | (Rev.3과 동일) | PASS 13, PARTIAL 2 | — |
| R4-16 | 동시 업로드 세션 격리 | **PASS** | 세션 ID 기반 WHERE 격리 |

**16회 중: PASS 14건, PARTIAL 2건, FAIL 0건**

---

## 16. 실패 근본 원인 분석 10회

(Rev.3과 동일 — FAIL-01~10 참조)

---

## 17. 개선 방향 탐색 10회

(Rev.3과 동일 — DIR-01~10 참조)

---

## 최종 점수 (Rev.4 자체 평가)

| 기준 | Rev.2 | audit2 평가 | Rev.3 | Rev.4 |
|------|-------|-----------|-------|-------|
| 완결성 | — | 68/100 | 85 | **86/100** (+1) |
| 효과성 | — | 78/100 | 90 | **91/100** (+1) |
| 효율성 | — | 60/100 | 78 | **78/100** (0) |
| **종합** | — | **69/100** | **84** | **85/100** (+1) |

**Rev.4 향상 근거**:
- 완결성 +1: 헬스체크 엔드포인트(+0.5) + _batch_progress DDL(+0.5)
- 효과성 +1: 세션 기반 삭제(+0.5) + DB-우선 게이트(+0.5)
- 효율성 0: 파일 수 미세 증가(repo +1, SQL +2)는 품질 향상 대비 무시할 수준

**aud1-1 재보정 기준 (83점)과의 차이**:
- aud1-1은 Rev.3를 83점으로 평가 (헬스체크 -1점)
- Rev.4에서 4건 갭 모두 해소 → 83 + 2 = **85점**

**잔존 리스크**: 5건 (모두 구현 단계에서 해소)
1. 실제 코드 런타임 검증 미수행 (Do 단계)
2. V2 실제 데이터 상태 미확인 (Phase 0 실행 시)
3. 사용자 도메인 지식 미반영 (사용자 승인 시)
4. Next.js 16 / React 19 호환 (Phase 1 tsc 실행 시)
5. Supabase RPC 실제 성능 (Phase 0 RPC 테스트 시)

---

---

## 18. 병렬 팀 운영 시뮬레이션 10회 [Rev.4 신규]

### 분류: Day 5 (3팀 동시) 시나리오 6회 + Day 6 (2팀 동시) 시나리오 2회 + 크로스 Phase 시나리오 2회

---

### PSIM-01: "Day 5 — Team Beta가 upload-naver-settle 구현 중 matching.service.ts 버그 발견"

**시나리오**: Team Beta 라우트-B3가 upload-naver-settle 라우트 구현 중, `matchingService.autoMatch()` 호출부에서 matching.service.ts의 인자 불일치 발견. 수정하려면 `lib/services/matching.service.ts`를 변경해야 함. 그런데 lib/는 "읽기 전용" 규칙.

| 단계 | 발생 | 위험 | 대응 |
|------|------|------|------|
| 1 | Beta가 matching.service.ts 수정 필요 발견 | **lib/ 수정 = 3팀 공유 영역 침범** | Beta 작업 중단, CTO Lead에게 즉시 보고 |
| 2 | Alpha/Gamma도 같은 서비스를 import하는 라우트가 있을 수 있음 | **인터페이스 변경 시 Alpha/Gamma 라우트 빌드 실패** | CTO Lead가 영향 범위 분석: matching.service를 호출하는 라우트 목록 확인 |
| 3 | 영향 범위: upload-naver-settle(Beta) + auto-match(Beta) + sales-detect(Gamma) | 3팀 중 2팀에 영향 | CTO Lead가 수정안 작성 → Alpha/Beta/Gamma 전부에 공유 |
| 4 | lib/ 수정 반영 방법 | git merge 충돌 가능 | **CTO Lead가 lib/ 수정을 단독 수행 → 3팀 모두 pull** |

**판정**: 🔴 **HIGH RISK**
- lib/ 서비스 레이어 버그가 Day 5 병렬 작업 중 발견되면 **3팀 모두 중단** 필요
- 현재 규칙 "lib/ 읽기 전용"은 발견된 버그 수정을 차단함

**대응책**:
1. **Day 4 검증 강화**: Phase 4 완료 시 모든 서비스 함수의 시그니처를 테스트로 확인 (호출 규약 검증)
2. **lib/ 핫픽스 프로토콜**: CTO Lead만 lib/ 수정 권한 → 수정 후 3팀에 `git pull` 지시 → 각 팀 빌드 재확인
3. **시그니처 프리징**: Day 4 완료 시 모든 export 함수의 시그니처를 `v3-api-contract.md`로 문서화 → Day 5 팀들이 참조

---

### PSIM-02: "Day 5 — Team Alpha와 Team Gamma가 상태 전환 로직을 각자 하드코딩"

**시나리오**: Alpha의 `/api/admin/consignments` 라우트와 Gamma의 `/api/admin/consignments/[id]/complete` 라우트가 동일한 `ConsignmentStatus` 타입 사용. 각 팀이 서비스 위임 대신 라우트에서 직접 상태 전환을 하드코딩.

| 단계 | 발생 | 위험 | 대응 |
|------|------|------|------|
| 1 | Alpha: consignment PATCH에서 status 전환 `pending→received` 구현 | 타입은 lib/에 이미 정의됨 (Phase 1) | 문제 없음 |
| 2 | Gamma: consignment complete에서 `approved→completed` 전환 구현 | 동일 타입 사용 | 문제 없음 |
| 3 | Alpha가 추가 전환 `received→inspecting`을 route-level에서 하드코딩 | **CONSIGNMENT_TRANSITIONS 맵과 불일치 가능** | 위험 |
| 4 | Gamma도 `inspecting→approved` 전환을 route-level에서 하드코딩 | **상태 전환 로직이 2곳에 분산** | 위험 |

**판정**: ⚠️ **MEDIUM RISK**
- `CONSIGNMENT_TRANSITIONS` 맵이 유일한 전환 규칙 소스여야 하는데, 각 팀이 독자적으로 하드코딩할 위험
- 비즈니스 로직 불일치 → 프로덕션에서 상태 전환 비정합 발생 가능

**대응책**:
1. **Day 5 진입 시 브리핑**: "상태 전환은 반드시 `CONSIGNMENT_TRANSITIONS[current].includes(next)` 사용. 하드코딩 금지"
2. **Cross-team QA에 추가**: `grep -r "status.*=.*'" app/api/ | grep -v TRANSITIONS` → 0건 (하드코딩 탐지)
3. **서비스 위임 원칙 재확인**: 상태 전환 로직은 서비스 레이어(lib/services/)에만 존재. 라우트는 서비스 호출만.

---

### PSIM-03: "Day 5 — 3팀 코드 합류 시 git merge 충돌 없이 패턴 불일치 통과"

**시나리오**: 3팀이 각각 별도 worktree에서 작업 후 main에 merge. 3팀 간 에러 처리 패턴, 로깅 메시지 포맷, import 순서가 미세하게 다름.

| 단계 | 발생 | 위험 | 대응 |
|------|------|------|------|
| 1 | Alpha: `console.log('[settlement-generate] 시작')` | 정상 | — |
| 2 | Beta: `console.log('[photos] 시작')` → 중괄호 내 이름이 디렉토리명 | **Alpha는 full-path, Beta는 short-name** | 패턴 불일치 |
| 3 | Gamma: `console.log('[api/admin/database] 시작')` → 전체 경로 | Alpha와 Gamma도 불일치 | 3팀 전부 다름 |
| 4 | git merge 자체는 충돌 없음 (다른 파일) | **충돌 없이 불일치가 통과됨** | QA에서도 미탐지 |
| 5 | Phase 8 CI/CD에서 ESLint 패턴 규칙 없음 | 불일치 그대로 프로덕션 진입 | 운영 시 로그 파싱 어려움 |

**판정**: ⚠️ **MEDIUM RISK**
- git 충돌은 없지만 **코드 일관성** 파괴
- 63개 라우트가 3가지 스타일로 작성되면 유지보수 비용 증가

**대응책**:
1. **Day 5 진입 시 컨벤션 문서 배포**: `v3-route-convention.md` 작성 — 로깅 포맷(`[api-name]` = 라우트 디렉토리명), import 순서(middleware → response → schema → service), 에러 메시지 포맷
2. **템플릿 라우트 제공**: 1개 "모범 라우트"(예: settlement/generate)를 Day 4 마지막에 작성 → 3팀 모두 이 파일을 복사해서 시작
3. **Cross-team QA에 일관성 검증 추가**: import 순서 검증 ESLint import/order 규칙 강제
4. **리뷰어 1명 cross-team**: Day 5에서 1명이 3팀 코드를 교차 리뷰 (일관성 전담)

---

### PSIM-04: "Day 5 — 3팀 동시 Supabase 테스트 시 DB 커넥션 풀 소진"

**시나리오**: Day 5 각 팀의 QA 에이전트(QA-A, QA-B, QA-G)가 동시에 Supabase에 라우트 검증 요청을 보냄. 3팀이 동시에 총 63개 라우트를 테스트하면서 Supabase Free/Pro 플랜의 커넥션 풀(기본 60개)에 부하.

| 단계 | 발생 | 위험 | 대응 |
|------|------|------|------|
| 1 | QA-A: Tier 1 11개 라우트에 대해 E2E 테스트 → DB 커넥션 11개 동시 | 개별로는 문제 없음 | — |
| 2 | QA-B: Tier 2 26개 라우트 테스트 → DB 커넥션 26개 동시 | 개별로는 문제 없음 | — |
| 3 | QA-G: Tier 3 26개 라우트 테스트 → DB 커넥션 26개 동시 | **총 63개 동시 커넥션** | Supabase Pro 기본 60 커넥션 초과 |
| 4 | 일부 요청에서 `FATAL: too many connections` | **테스트 결과 위양성: 코드는 정상인데 인프라 제약으로 실패** | QA가 코드 버그로 오판 |
| 5 | QA가 "이 라우트 실패" 보고 → 팀이 디버깅 시작 | **디버깅에 시간 소비, 실제는 커넥션 풀 문제** | 시간 낭비 |

**판정**: ⚠️ **MEDIUM RISK**
- Supabase Pro 플랜 커넥션 풀(60~100개)이 3팀 동시 테스트에 충분하지 않을 수 있음
- 테스트 위양성 → 디버깅 시간 낭비 → Day 5 일정 지연
- 코드 문제가 아닌 인프라 문제를 코드에서 찾으려는 오판 위험

**대응책**:
1. **QA 시간 분리**: QA-A → QA-B → QA-G 순차 실행 (동시 테스트 회피). 3팀 구현은 병렬, QA만 순차.
2. **Supabase 커넥션 풀 사전 확인**: Day 5 시작 전 `SELECT count(*) FROM pg_stat_activity;`로 현재 사용량 확인
3. **Supabase Pooler(PgBouncer) 사용**: `supabase.pooler.supabase.com:6543` 사용 시 커넥션 수 대폭 완화
4. **에러 패턴 문서화**: `too many connections` 에러 발생 시 "인프라 문제, 코드 아님" 즉시 판단 기준 배포

---

### PSIM-05: "Day 5 — Team Gamma 라우트 구현 중 새로운 공용 스키마 필요 발견"

**시나리오**: Gamma가 `/api/admin/sales/ledger` 라우트 구현 중, `DateRangeSchema` (시작일~종료일 쌍 + 시작 ≤ 종료 검증)가 필요. settlement/generate에서도 쓰이는 패턴. lib/utils/validation.ts에 추가해야 할까, 각 schema.ts에 정의할까?

| 단계 | 발생 | 위험 | 대응 |
|------|------|------|------|
| 1 | Gamma: DateRangeSchema 필요 → lib/utils/validation.ts에 추가하고 싶음 | **lib/ 수정 = 읽기 전용 위반** | Gamma 작업 중단 |
| 2 | Alpha: settlement/generate에서 이미 `DateSchema` 2개로 개별 정의 | Alpha는 co-located schema.ts에 넣음 | 문제 없음 |
| 3 | Gamma가 lib/ 수정 요청 → CTO Lead 승인 대기 | **Gamma 1명 유휴 + CTO Lead 응답 시간** | 지연 |
| 4 | CTO Lead: "co-location 원칙에 따라 각 schema.ts에 중복 정의" 결정 | 코드 중복 2건 발생 | 트레이드오프 |
| 5 | 나중에 DateRange 검증 로직이 달라지면? | 2곳 수정 필요 | 허용 범위 (2건) |

**판정**: ⬇️ **LOW RISK**
- co-location 원칙이 이미 이 상황을 예상하고 설계됨
- 공용 스키마는 Phase 1에서 5개만 정의, 나머지는 의도적으로 중복 허용

**대응책**:
1. **Day 5 진입 시 명확화**: "새로운 공용 스키마 필요 시 → schema.ts에 각자 정의. lib/ 추가 금지. Day 8에서 중복 3건 이상 발견 시 lib/로 승격"
2. **의사결정 기준 문서화**: "중복 2건 이하 = co-located 유지, 3건 이상 = lib/ 승격 후보"
3. **비동기 질문**: CTO Lead에게 보고하되 **응답 기다리지 않고 co-located로 선진행** → CTO Lead가 나중에 교정

---

### PSIM-06: "Day 5 — Team Gamma 조기 완료 → 유휴 + 성급한 main merge"

**시나리오**: Gamma(Tier 3 + 미분류 26개)가 상대적으로 간단한 라우트를 담당해 Alpha/Beta보다 3시간 먼저 완료. Gamma Lead가 "우리 팀 완료, main에 먼저 merge하겠다"고 판단.

| 단계 | 발생 | 위험 | 대응 |
|------|------|------|------|
| 1 | Gamma: 26개 라우트 전부 구현 + QA-G 통과 | 정상 | Gamma 유휴 상태 진입 |
| 2 | Gamma Lead: "Cross-QA 기다리지 않고 main에 먼저 merge" 결정 | **Alpha/Beta 작업 중 main이 변경됨** | Alpha/Beta가 pull 시 충돌 가능 |
| 3 | Alpha: settlement/generate 라우트에서 `lib/api/response.ts`의 ok() 함수 사용 중 | Gamma가 동일 파일의 다른 라우트에서 같은 import 사용 | **물리적 충돌은 없지만 merge 순서에 따라 tsc 에러 가능** |
| 4 | Beta: 아직 작업 중인데 main이 바뀜 → `git pull` 해야 하는지 혼란 | **Beta 작업 중단 + merge 충돌 해소 시간** | 1시간 낭비 |
| 5 | Cross-team QA가 "어떤 코드가 merge되었고 어떤 코드가 아직인가" 파악 불가 | **QA 범위 혼란** | 검증 누락 가능 |

**판정**: ⚠️ **MEDIUM RISK**
- 팀 속도 불균형은 반드시 발생 (Tier 3이 Tier 1보다 간단)
- 성급한 merge가 다른 팀의 작업 흐름을 교란
- Cross-team QA의 "전팀 완료 후 시작" 전제 조건 붕괴

**대응책**:
1. **merge 금지 규칙**: "Cross-team QA 완료 전 어떤 팀도 main에 merge 금지. 각 팀은 자기 브랜치에만 커밋"
2. **조기 완료 팀 재배치**: Gamma 완료 → Gamma 에이전트를 Alpha/Beta 지원에 투입 (라우트 리뷰, 추가 E2E 테스트 작성)
3. **merge 순서 명시**: Cross-team QA 후 CTO Lead가 Alpha → Beta → Gamma 순서로 순차 merge (충돌 최소화)
4. **유휴 시간 활용 목록**: 조기 완료 팀은 `v3-route-convention.md` 대비 전체 코드 일관성 사전 점검

---

### PSIM-07: "Day 6 — Team Alpha 공유 컴포넌트 지연 → Team Beta 완전 대기"

**시나리오**: Team Alpha가 공유 컴포넌트 8개(Table, Modal, Form, Button, Toast, Layout, Sidebar, SearchInput) 중 Table 컴포넌트에서 예상 외 복잡성 발견. 정렬+필터+페이지네이션 조합이 150줄 초과. 3시간 지연.

| 단계 | 발생 | 위험 | 대응 |
|------|------|------|------|
| 1 | Table 컴포넌트 150줄 초과 → 분리 설계 필요 | Alpha 내부 지연 | Alpha Lead가 useTableSort 훅 분리 결정 |
| 2 | Team Beta는 공유 컴포넌트 대기 중 | **Beta 전체 유휴 (11페이지 작업 불가)** | 3시간 × 5명 = 15명·시간 낭비 |
| 3 | Beta가 기다리다 못해 자체 임시 컴포넌트로 시작 | **나중에 Alpha 컴포넌트로 교체 시 이중 작업** | 더 큰 낭비 |
| 4 | Day 6을 1일 내 완료 불가 → Day 7로 밀림 | **Phase 7, 8도 연쇄 지연** | 전체 일정 +1일 |

**판정**: 🔴 **HIGH RISK — 병렬화의 최대 약점**
- 공유 컴포넌트가 **병목(bottleneck)**. Alpha 선행 실패 시 Beta 전체 대기.
- Day 6 2팀 병렬의 실제 효과가 "1.5팀 순차"로 퇴화할 수 있음.

**대응책**:
1. **공유 컴포넌트 인터페이스 선정의 (Day 5 저녁)**: Day 5 Cross-QA 후 CTO Lead가 8개 컴포넌트의 **props 인터페이스만** 미리 정의 → `components/types.ts`로 공유
2. **스텁 컴포넌트 전략**: Alpha가 8개 컴포넌트의 **빈 껍데기(스텁)**를 30분 내 생성 → Beta 즉시 시작 → Alpha가 내부 구현 완성
3. **비의존 페이지 선행**: Beta의 11개 중 공유 컴포넌트 미사용 페이지(login, database) 먼저 구현 → 대기 시간 활용
4. **최악의 경우**: 공유 컴포넌트 완성 전 Beta 전원 Day 5 잔여 작업(E2E 추가, 라우트 리뷰) 지원 → 유휴 최소화

---

### PSIM-08: "Day 6 — Team Beta가 Day 5에서 누락된 API 라우트 발견"

**시나리오**: Beta UI-B1이 `admin/photos` 페이지 구현 중, 사진 분류 결과를 조회하는 `GET /api/admin/photos/[id]/classify-result` 라우트가 Day 5 63개 목록에 없었음을 발견. V2에서는 이 기능이 단일 페이지 내 inline 호출이었지만, V3에서는 별도 API가 필요.

| 단계 | 발생 | 위험 | 대응 |
|------|------|------|------|
| 1 | Beta UI-B1: photos 페이지에서 분류 결과 조회 API 호출 필요 | **Day 5에서 만들어야 했던 라우트가 누락** | Beta 작업 중단 |
| 2 | 라우트 추가하려면 `app/api/admin/photos/[id]/classify-result/route.ts` 생성 필요 | **Day 5 산출물(63개) 검증이 불완전했다는 의미** | Cross-team QA 신뢰성 문제 |
| 3 | lib/services/photo.service.ts의 함수는 존재 (Day 4에서 생성) | 서비스는 있지만 라우트 엔트리포인트가 없음 | 라우트만 추가하면 됨 |
| 4 | Beta가 직접 라우트 추가 → **Day 6은 프론트엔드만 해야 하는데 API도 만듦** | Phase 경계 침범, QA 범위 확장 | 일정 지연 |

**판정**: ⚠️ **MEDIUM RISK**
- 63개 라우트 목록이 V2 전수 분석에서 도출되었지만, V3에서 새로 필요한 라우트를 놓칠 수 있음
- Day 5 Cross-team QA가 "63개 존재 확인"만 했지 "프론트엔드가 실제로 필요한 모든 API 존재 확인"은 안 함
- Phase 경계를 넘는 작업이 발생하면 검증 체계가 흔들림

**대응책**:
1. **Day 5 Cross-QA에 프론트엔드 시뮬레이션 추가**: 17개 페이지가 호출하는 모든 API endpoint를 목록화 → 63개 대비 교차 검증. 누락 발견 시 Day 5 내 추가 생성
2. **API 호출 매핑 문서**: Day 4 완료 시 `v3-page-api-mapping.md` 작성 — 각 페이지가 어떤 API를 호출하는지 매핑
3. **Day 6 라우트 추가 프로토콜**: 발견 즉시 CTO Lead 승인 → Beta가 라우트 생성 → QA가 해당 라우트만 즉시 검증 → 이후 페이지 구현 속행. Phase 경계 침범을 **공식 허용 절차**로 관리.
4. **라우트 수 유연화**: "63개 ± 3개" 허용 범위 설정. 프론트엔드 구현 시 추가 필요한 라우트가 3개 이내면 Day 6에서 바로 추가 허용.

---

### PSIM-09: "Day 7 — 스토리지 마이그레이션이 Day 6 프론트엔드의 하드코딩된 경로 발견"

**시나리오**: Day 7 스토리지 마이그레이션 팀이 `fs` → Supabase Storage URL 변환 중, Day 6에서 생성된 프론트엔드 컴포넌트에 로컬 파일 경로가 하드코딩되어 있음을 발견. Alpha/Beta 팀이 V2의 사진 표시 로직을 그대로 가져오면서 `src="/uploads/photos/{id}.jpg"` 패턴을 사용.

| 단계 | 발생 | 위험 | 대응 |
|------|------|------|------|
| 1 | Day 7 스토리지 팀: `grep -r "/uploads/" app/` 실행 | **Day 6 생성 컴포넌트에서 8건 발견** | 프론트엔드 파일 수정 필요 |
| 2 | 수정 대상: photos, products, consignments 등의 이미지 표시 부분 | **Day 7은 스토리지 팀만 운영 (4명)** | 프론트엔드 수정 역량 부족 가능 |
| 3 | 사진 URL을 `getPublicUrl(bucket, path)` 헬퍼로 교체해야 함 | **헬퍼 함수를 새로 만들어야 할 수도 있음** | lib/ 수정 필요 (Phase 4 이후 추가) |
| 4 | 수정 범위가 예상보다 넓어 Day 7 내 완료 불가 | **Day 8(검증+빌드)에도 프론트엔드 수정 작업 잔존** | 검증 단계가 "수정+검증"으로 변질 |

**판정**: 🔴 **HIGH RISK**
- Phase 6(프론트엔드)과 Phase 7(스토리지)이 **양방향 의존**: 프론트엔드가 사진 URL을 사용하는데, URL 체계가 Phase 7에서 바뀜
- Day 6 팀이 "V3에서 사진 URL이 바뀔 예정"임을 모르고 V2 패턴을 그대로 사용할 위험 높음
- 순차 실행에서도 발생할 수 있지만, 병렬에서는 피드백 루프가 더 느림

**대응책**:
1. **Day 6 진입 시 사진 URL 규칙 브리핑**: "모든 이미지 src는 `getPhotoUrl(id)` 헬퍼 사용. 직접 경로 하드코딩 금지." → 헬퍼를 Day 4에서 미리 생성 (lib/utils/photo-url.ts)
2. **Phase 1에서 사진 URL 헬퍼 포함**: `lib/utils/photo-url.ts` — V2 로컬 경로와 V3 Storage URL을 모두 지원하는 유틸. Phase 7 전까지는 V2 경로 반환, Phase 7 후 Storage URL 반환 (환경변수 기반 스위칭)
3. **Day 7 시작 시 전수 검사**: `grep -r '"/uploads\|/photos\|src=.*\.(jpg\|png\|webp)' app/` → 0건 확인 후 마이그레이션 시작. 발견 시 Day 7 초반에 일괄 수정.
4. **검증 게이트 추가**: Phase 6 게이트에 `grep -r "src=.*uploads" app/ → 0건` 항목 추가

---

### PSIM-10: "Day 8 — next build에서 3팀 코드의 타입 불일치로 빌드 실패"

**시나리오**: Day 8 최종 빌드 시 `next build`를 실행하면, Day 5에서 3팀이 독립적으로 작성한 63개 라우트 코드에서 미세한 타입 불일치가 발견됨. 각 팀이 `ok()` 응답 함수에 전달하는 타입이 서로 다른 형태.

| 단계 | 발생 | 위험 | 대응 |
|------|------|------|------|
| 1 | `next build` 실행 → tsc strict 모드에서 에러 12건 | **Day 5에서 각 팀이 자체 tsc 통과만 확인** | 통합 빌드에서만 발견되는 에러 |
| 2 | Alpha: `ok({ settlements: data })` — 타입: `{ settlements: Settlement[] }` | 정상 | — |
| 3 | Beta: `ok({ data: photos, total: count })` — 타입: `{ data: Photo[], total: number }` | **응답 형태 불일치** | 프론트엔드에서 `res.data.settlements` vs `res.data.data` 혼란 |
| 4 | Gamma: `ok(products)` — 배열을 직접 전달 | **wrapper 없이 배열 반환** | ok()의 제네릭 타입 추론 문제 가능 |
| 5 | 12건 에러 수정에 2시간 소요 | **Day 8이 검증+빌드인데 수정 작업 포함** | Day 8 일정 압박 |

**판정**: ⚠️ **MEDIUM RISK**
- Day 5에서 각 팀이 `tsc --noEmit`을 자체 worktree에서만 실행 → 통합 시 타입 충돌
- 특히 `ok()` 제네릭 응답의 래핑 방식 차이는 ESLint로 탐지 불가
- Day 8에서 수정 → 검증 → 재빌드 루프가 발생하면 일정 초과

**대응책**:
1. **Cross-team QA에 통합 빌드 포함**: Day 5 Cross-QA에서 `tsc --strict --noEmit` **통합 빌드** 실행 필수 (자체 worktree가 아닌 merge 후 전체에서)
2. **응답 래핑 컨벤션 명시**: `v3-route-convention.md`에 "ok()에 전달하는 데이터는 반드시 `{ [리소스명복수]: T[], total?: number }` 형태" 명시
3. **Day 4 마지막에 모범 라우트에 응답 타입까지 포함**: `ok({ sellers: data, total: count })` 패턴을 명확히 보여주기
4. **Day 8 버퍼 활용**: tsc 에러 12건 정도는 2시간 내 수정 가능 → Day 9 버퍼를 Day 8로 앞당겨 사용 가능

---

## 19. 시뮬레이션 종합 판정 및 보강 대책 (10회 기반)

### 위험도 매트릭스

| # | 시나리오 | Day | 위험도 | 영향 범위 | 발생 확률 | 대응 존재 |
|---|---------|-----|--------|----------|----------|----------|
| PSIM-01 | lib/ 서비스 버그 발견 | Day 5 | 🔴 HIGH | 3팀 전부 중단 | 중간 | △ 부분적 |
| PSIM-02 | 비즈니스 로직 하드코딩 | Day 5 | ⚠️ MEDIUM | 2팀 불일치 | 중간 | ✅ 대응 가능 |
| PSIM-03 | 코드 패턴 불일치 (3팀 스타일) | Day 5 | ⚠️ MEDIUM | 63개 라우트 | 높음 | ✅ 대응 가능 |
| PSIM-04 | DB 커넥션 풀 소진 | Day 5 | ⚠️ MEDIUM | 테스트 위양성 | 중간 | ✅ 대응 가능 |
| PSIM-05 | 공용 스키마 추가 요청 | Day 5 | ⬇️ LOW | 1명 유휴 | 높음 | ✅ 대응 가능 |
| PSIM-06 | Gamma 조기 완료 → 성급한 merge | Day 5 | ⚠️ MEDIUM | 2팀 교란 | 높음 | ✅ 대응 가능 |
| PSIM-07 | 공유 컴포넌트 지연 → Beta 대기 | Day 6 | 🔴 HIGH | Day 6 전체 지연 | 높음 | △ 부분적 |
| PSIM-08 | 프론트엔드가 누락 API 발견 | Day 6 | ⚠️ MEDIUM | Phase 경계 침범 | 중간 | ✅ 대응 가능 |
| PSIM-09 | 스토리지 마이그레이션 vs 하드코딩 경로 | Day 7 | 🔴 HIGH | 8+ 파일 수정 | 높음 | △ 부분적 |
| PSIM-10 | 통합 빌드 타입 불일치 | Day 8 | ⚠️ MEDIUM | 빌드 실패 | 중간 | ✅ 대응 가능 |

### 위험도별 분류

| 위험도 | 건수 | 시나리오 |
|--------|------|---------|
| 🔴 HIGH | **3건** | PSIM-01 (lib/ 버그), PSIM-07 (컴포넌트 병목), PSIM-09 (사진 URL 하드코딩) |
| ⚠️ MEDIUM | **6건** | PSIM-02, 03, 04, 06, 08, 10 |
| ⬇️ LOW | **1건** | PSIM-05 |

### 시뮬레이션에서 도출된 필수 보강 사항 10건

| # | 보강 사항 | 적용 시점 | 위험 대상 | 우선순위 |
|---|----------|----------|----------|---------|
| **FIX-P01** | Day 4 완료 시 **서비스 API 시그니처 프리징** + 호출 규약 테스트 | Day 4 | PSIM-01 | 🔴 필수 |
| **FIX-P02** | Day 4 마지막에 **모범 라우트 1개 + `v3-route-convention.md`** 배포 | Day 4→5 | PSIM-03, 10 | 🔴 필수 |
| **FIX-P03** | Day 5 진입 시 **상태 전환 하드코딩 금지 + 서비스 위임** 브리핑 | Day 5 | PSIM-02 | ⚠️ 권장 |
| **FIX-P04** | Day 5 QA는 **순차 실행** (3팀 구현은 병렬, QA만 순차) + PgBouncer | Day 5 | PSIM-04 | ⚠️ 권장 |
| **FIX-P05** | Day 5 **merge 금지 규칙**: Cross-QA 완료 전 main merge 금지 | Day 5 | PSIM-06 | 🔴 필수 |
| **FIX-P06** | Day 5 Cross-QA에 **통합 빌드(tsc) + 일관성 검증 + API 매핑 교차 검증** | Day 5 | PSIM-03, 08, 10 | 🔴 필수 |
| **FIX-P07** | Day 6 진입 시 **공유 컴포넌트 스텁 전략** (인터페이스 선정의 + 스텁 선배포) | Day 5→6 | PSIM-07 | 🔴 필수 |
| **FIX-P08** | Phase 1에서 **사진 URL 헬퍼** `lib/utils/photo-url.ts` 미리 생성 | Day 2 | PSIM-09 | 🔴 필수 |
| **FIX-P09** | **lib/ 핫픽스 프로토콜**: CTO Lead 단독 수정 → 3팀 pull → 재빌드 | 상시 | PSIM-01, 05 | 🔴 필수 |
| **FIX-P10** | Day 6 게이트에 **사진 경로 하드코딩 0건 검증** 추가 | Day 6 | PSIM-09 | ⚠️ 권장 |

### 🔴 HIGH RISK 3건 특별 대응

#### PSIM-01 대응: lib/ 서비스 버그 — 시그니처 프리징 + 핫픽스 프로토콜

```
Day 4 완료 시:
  1. 모든 서비스의 export 함수 시그니처를 v3-api-contract.md로 문서화
  2. 각 서비스 함수에 대해 호출 규약 테스트 1개씩 작성 (인자 타입 + 반환 타입)
  3. vitest 통과 필수

Day 5 발생 시 (핫픽스 프로토콜):
  1. 발견한 팀 → CTO Lead에게 즉시 메시지 (작업 중단)
  2. CTO Lead → 영향 받는 팀 식별 (grep으로 import 추적)
  3. CTO Lead → lib/ 수정을 main 브랜치에서 단독 수행
  4. CTO Lead → 3팀에 "git pull origin main" 지시
  5. 각 팀 → pull 후 tsc 재확인 → 작업 속행
  6. 소요 시간: 30분~1시간 (Day 5 일정 내 흡수 가능)
```

#### PSIM-07 대응: 공유 컴포넌트 병목 — 스텁 전략

```
Day 5 저녁 (Cross-QA 완료 후):
  CTO Lead → 8개 컴포넌트 props 인터페이스 정의 (components/types.ts)

Day 6 시작 (T+0):
  Alpha 공유 UI 에이전트 → 8개 스텁 컴포넌트 생성 (30분)
    - 각 컴포넌트: props 타입 + return <div>TODO</div>
    - tsc 빌드 통과하는 수준의 최소 구현

Day 6 T+30분:
  Beta 팀 시작 가능 (스텁 import로 페이지 골격 구현)
  Alpha 공유 UI 에이전트 → 실제 구현으로 교체 (병렬)

Day 6 T+4시간:
  Alpha 공유 컴포넌트 실제 구현 완료
  Beta 페이지들이 이미 스텁 기반으로 동작 → 실제 컴포넌트로 자동 교체 (import 경로 동일)

결과: Beta 대기 시간 = 30분 (3시간 → 30분으로 단축)
```

#### PSIM-09 대응: 사진 URL 하드코딩 — Phase 1 선제 조치

```
Day 2 (Phase 1):
  lib/utils/photo-url.ts 생성:
    export function getPhotoUrl(productId: string, fileName: string): string {
      const useStorage = process.env.PHOTO_STORAGE === 'supabase'
      if (useStorage) {
        return supabase.storage.from('photos').getPublicUrl(`${productId}/${fileName}`).data.publicUrl
      }
      return `/uploads/photos/${productId}/${fileName}`  // V2 호환
    }
  → Phase 7 전까지 V2 경로 반환, Phase 7 후 환경변수 전환으로 Storage URL 반환

Day 6 (Phase 6):
  모든 프론트엔드 이미지 표시에 getPhotoUrl() 사용 강제
  게이트 추가: grep -r 'src=.*uploads\|src=.*photos.*\.(jpg\|png)' app/ → 0건

Day 7 (Phase 7):
  환경변수 PHOTO_STORAGE=supabase 설정만으로 URL 자동 전환
  → 프론트엔드 파일 수정 0건 (이미 헬퍼 사용 중)
```

### 보강 사항의 Phase별 적용 맵

| Day | 적용할 보강 | 대상 시뮬레이션 |
|-----|-----------|---------------|
| **Day 2** | FIX-P08: photo-url.ts 헬퍼 생성 | PSIM-09 |
| **Day 4** | FIX-P01: 시그니처 프리징 | PSIM-01 |
| **Day 4→5** | FIX-P02: 모범 라우트 + 컨벤션 문서 | PSIM-03, 10 |
| **Day 5 진입** | FIX-P03: 하드코딩 금지 브리핑 | PSIM-02 |
| **Day 5** | FIX-P04: QA 순차 실행 | PSIM-04 |
| **Day 5** | FIX-P05: merge 금지 규칙 | PSIM-06 |
| **Day 5 QA** | FIX-P06: 통합 빌드 + 일관성 + API 매핑 | PSIM-03, 08, 10 |
| **Day 5→6** | FIX-P07: 스텁 컴포넌트 전략 | PSIM-07 |
| **Day 6 QA** | FIX-P10: 사진 경로 0건 검증 | PSIM-09 |
| **상시** | FIX-P09: lib/ 핫픽스 프로토콜 | PSIM-01, 05 |

### 최종 판정

**병렬 전략 유지 가능성**: ✅ **유지 가능** (보강 10건 중 필수 7건 적용 조건)

**보강 적용 전후 위험도 변화**:

| # | 시나리오 | 보강 전 | 보강 후 | 변화 |
|---|---------|--------|--------|------|
| PSIM-01 | lib/ 서비스 버그 | 🔴 HIGH | ⚠️ MEDIUM | 시그니처 프리징으로 발생 확률 ↓ |
| PSIM-02 | 비즈니스 로직 하드코딩 | ⚠️ MEDIUM | ⬇️ LOW | 브리핑 + Cross-QA 탐지 |
| PSIM-03 | 코드 패턴 불일치 | ⚠️ MEDIUM | ⬇️ LOW | 컨벤션 문서 + 모범 라우트 |
| PSIM-04 | DB 커넥션 풀 소진 | ⚠️ MEDIUM | ⬇️ LOW | QA 순차 + PgBouncer |
| PSIM-05 | 공용 스키마 추가 | ⬇️ LOW | ⬇️ LOW | 변화 없음 (이미 대응됨) |
| PSIM-06 | Gamma 조기 완료 merge | ⚠️ MEDIUM | ⬇️ LOW | merge 금지 규칙 |
| PSIM-07 | 공유 컴포넌트 지연 | 🔴 HIGH | ⚠️ MEDIUM | 스텁 전략 (3시간→30분) |
| PSIM-08 | 누락 API 발견 | ⚠️ MEDIUM | ⬇️ LOW | API 매핑 교차 검증 |
| PSIM-09 | 사진 URL 하드코딩 | 🔴 HIGH | ⬇️ LOW | photo-url.ts 헬퍼 선제 생성 |
| PSIM-10 | 통합 빌드 타입 불일치 | ⚠️ MEDIUM | ⬇️ LOW | Cross-QA 통합 빌드 |

**보강 후 잔존 위험**:
- 🔴 HIGH: **0건** (3건 → 0건)
- ⚠️ MEDIUM: **2건** (PSIM-01 ↓, PSIM-07 ↓)
- ⬇️ LOW: **8건**

**일정 달성 확률**:
- 보강 미적용: **60%** (9일 → 11~12일로 퇴화 예상)
- 보강 적용(10건 전부): **90%** (Day 9 버퍼가 10% 잔존 리스크 흡수)
- 보강 적용(필수 7건만): **85%** (권장 3건 미적용 시 소폭 하락)

---

*이 플랜의 모든 코드는 존재 이유가 있다. 의미 없는 줄은 없다.*
*Rev.2의 30건 정정 + audit2의 18건 수정 + pa1의 13건 개선 + aud1-1의 4건 해소 = 총 65건 반영.*
*16회 적대적 시뮬레이션: PASS 14건, PARTIAL 2건, FAIL 0건.*
*10회 병렬 팀 운영 시뮬레이션: HIGH 3건 → 보강 후 0건, 보강 사항 10건 도출.*
*10회 실패 근본 원인 분석 → 같은 패턴 반복 방지.*
*10회 개선 방향 탐색 → 각 결정의 트레이드오프 명시.*
*Phase 간 병렬 전략: Day 5 (3팀 동시, 63 라우트) + Day 6 (2팀 동시, 17 페이지).*
*보강 10건 적용 시 일정 달성 확률 90%. 잔존 HIGH 리스크 0건.*
*총 64명·일 투입. 피크: Day 5 (18명 동시).*
*9일 일정 (8일 작업 + 1일 버퍼). 순차 대비 31% 단축.*
*구현 시작 전 사용자 승인 필수.*
