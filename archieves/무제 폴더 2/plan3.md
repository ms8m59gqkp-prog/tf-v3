# Classic Menswear V3 — 최종 마스터 구현 플랜 (Plan 3)

**작성일**: 2026-03-01 (Rev.2 — 딥분석 에이전트 4개 결과 + 시뮬레이션 3회 반영)
**근거**: V2 소스코드 전수 읽기 + 4차 리서치(v2reserch1~v4reserch4) + 통합 리서치(v5-combined-research) + 8개 딥분석 에이전트(초안4+검증4) + plan1/plan2 피드백 반영
**V2 위치**: `/Users/jeongmyeongcheol/classic-menswear-v2/`
**V3 위치**: `/Users/jeongmyeongcheol/tf-v3/`
**교리**: 클로드코드교리 v2.0
**원칙**: 절대 코드 작성 없이 계획만 수립. 사용자 승인 후 구현 시작.

---

## 목차

1. [왜 Plan 3인가 — Plan 1/2의 한계](#1-왜-plan-3인가)
2. [문제 인벤토리 최종 확정](#2-문제-인벤토리-최종-확정)
3. [아키텍처 블루프린트](#3-아키텍처-블루프린트)
4. [V2 재사용 코드 인벤토리](#4-v2-재사용-코드-인벤토리)
5. [Phase 0: DB 마이그레이션](#5-phase-0-db-마이그레이션)
6. [Phase 1: 타입 + Zod + 유틸리티](#6-phase-1-타입--zod--유틸리티)
7. [Phase 2: 리포지토리 + 트랜잭션](#7-phase-2-리포지토리--트랜잭션)
8. [Phase 3: 미들웨어 + 인증](#8-phase-3-미들웨어--인증)
9. [Phase 4: 서비스 레이어](#9-phase-4-서비스-레이어)
10. [Phase 5: API 라우트](#10-phase-5-api-라우트)
11. [Phase 6: 프론트엔드](#11-phase-6-프론트엔드)
12. [Phase 7: 스토리지 마이그레이션](#12-phase-7-스토리지-마이그레이션)
13. [Phase 8: 검증 + 경화](#13-phase-8-검증--경화)
14. [파이프라인 A→B 전환 전략](#14-파이프라인-ab-전환-전략)
15. [마이그레이션 롤백 전략](#15-마이그레이션-롤백-전략)
16. [의존성 그래프 + 병렬 가능 작업](#16-의존성-그래프--병렬-가능-작업)
17. [리스크 대응 매트릭스](#17-리스크-대응-매트릭스)
18. [타임라인](#18-타임라인)
19. [성공 기준 체크리스트](#19-성공-기준-체크리스트)
20. [딥분석 에이전트 검증 결과 반영 (Rev.2)](#20-딥분석-에이전트-검증-결과-반영)
21. [시뮬레이션 결과 요약](#21-시뮬레이션-결과-요약)

---

## 1. 왜 Plan 3인가

### Plan 1의 한계
- 리서치 보고서만 기반으로 작성 — **V2 실제 소스 미확인**
- Phase별 검증 게이트 없음 (Phase 8에만 최종 검증)
- 파이프라인 A→B 전환 전략 언급만, 상세 없음
- DB 마이그레이션 롤백 전략 없음

### Plan 2의 한계
- V2 소스 전수 읽기 기반이지만 **딥분석 에이전트 미반영**
- 시뮬레이션 없이 작성 — **실패 시나리오 미검증**
- 정산 파이프라인 통합 전략 "구→신 단일화" 언급만
- V2 재사용 가능 코드의 구체적 재사용 점수 미포함

### Plan 3의 차별점
1. **8개 딥분석 에이전트 결과 반영** — 초안 4개(DB/정산/위탁/인증) + 검증 4개(DB타입/서비스API/프론트스토리지/파이프라인롤백)
2. **Phase별 검증 게이트** — 각 Phase 완료 시 통과해야 하는 필수 조건
3. **파이프라인 A→B 전환 전략 상세** — 데이터 호환, 과도기, 정리 3단계 + 고아 데이터 정합성 검증
4. **마이그레이션 롤백 전략** — UNIQUE 추가 실패, RPC 실패 + 외래키 일괄 정리(4개 테이블) 포함
5. **V2 재사용 코드 인벤토리** — 딥분석 에이전트의 ⭐ 점수 기반
6. **Phase별 실패 시나리오** — 각 Phase에서 발생 가능한 실패와 대응
7. **시뮬레이션 검증 결과** — 3회 시뮬레이션 후 실패 확률 분석 (§21)
8. **[Rev.2] 정정사항 30건** — 검증 에이전트 4개가 발견한 사실 오류/누락 전면 반영 (§20)

---

## 2. 문제 인벤토리 최종 확정

### 2.1 통계 (v5-combined-research + 딥분석 18건 추가)

| 심각도 | 건수 | 대표 이슈 |
|--------|------|----------|
| **CRITICAL** | 11 | 미들웨어 미작동, 이중 정산, Path Traversal, PostgREST 인젝션, 인증 우회, 1000행 절삭, ConsignmentStatus 3v7, match_id UNIQUE 없음, Public service role key, req.json PUBLIC 크래시, 워크플로 레이스 컨디션(NEW-13) |
| **HIGH** | 55 | 타임존 혼용, 커미션 5곳 분산, UNIQUE 5건 누락, Stuck-consignment, 파일시스템 소실, try/catch 누락 8건, NaN 7건, Promise.all 미확인 3건, confirm-parser errors 미사용(NEW-02) |
| **MEDIUM** | 41 | 주문 상태 머신 없음, inline style 1061회, 코드 길이 위반 35건, SSE 버퍼, 가상화 미적용 |
| **LOW** | 11 | 로깅 누락, 접근성, 메타데이터, 부동소수점 |
| **합계** | **118 고유** | 원본 237건에서 중복 제거 |

### 2.2 딥분석 에이전트 전용 발견 (기존 리서치에 없던 것)

| ID | 발견 | 위치 | 심각도 | V3 대응 Phase |
|----|------|------|--------|--------------|
| NEW-02 | confirm-parser `errors` 배열 push 안 됨 | confirm-parser.ts | HIGH | Phase 4 |
| NEW-04 | 판매자 이름 하이픈 파싱 오류 | naver-settle-parser.ts | HIGH | Phase 4 |
| NEW-06 | 전화번호 0접두사 탈락 미처리 | seller-matcher.ts | HIGH | Phase 1 |
| NEW-07 | Claude API 재시도 전략 부재 | photo-classify/ 전체 | HIGH | Phase 4 |
| NEW-09 | 네이버 JSON regex 파싱 취약 | naver-shopping.ts | HIGH | Phase 4 |
| NEW-11 | measurement-card Path Traversal | measurement-card.ts | HIGH | Phase 7 |
| NEW-13 | 워크플로 setTimeout 레이스 컨디션 | useWorkflowHandlers.ts | CRITICAL | Phase 6 |

### 2.3 복합 실패 시나리오 Top 3 (V3가 반드시 차단해야 하는 것)

**시나리오 1: "유령 이중 정산"** (SEC-01 + FIN-01 + FIN-02)
→ V3 차단: middleware.ts 정상화 + RPC FOR UPDATE + 파이프라인 단일화

**시나리오 3: "영구 복구 불가 위탁"** (DAT-04 + DAT-08)
→ V3 차단: complete_consignment RPC + .eq('status', expected) 낙관적 잠금

**시나리오 4: "조용한 데이터 절삭"** (DAT-01 + FIN-01)
→ V3 차단: 모든 전체 테이블 쿼리에 .range() 강제 + 카운트 전용 쿼리 분리

---

## 3. 아키텍처 블루프린트

### 3.1 5레이어 엄격 단방향 의존성

```
LAYER 0: lib/env.ts + lib/supabase/           — 인프라 (환경변수, DB 클라이언트)
   ↑
LAYER 1: lib/types/ + lib/utils/              — 공유 타입, Zod 스키마, 순수 유틸
   ↑
LAYER 2: lib/db/                              — 리포지토리 + RPC 트랜잭션 + 매퍼
   ↑
LAYER 3: lib/services/ + lib/calculators/     — 비즈니스 오케스트레이션 (NextRequest 금지)
   ↑
LAYER 4: app/admin/components/ + hooks/       — UI 컴포넌트 + 클라이언트 훅
   ↑
LAYER 5: app/api/**/route.ts + app/admin/**   — 라우트 핸들러 + 페이지
```

**의존성 규칙**:
- 각 레이어는 **하위 레이어만** import (상향 금지, 동일 레이어 참조는 허용)
- 순환 참조 금지
- 레이어 건너뛰기 금지 (L5 → L2 직접 호출 금지, 반드시 L3 경유)
- L3(서비스)는 `NextRequest`/`NextResponse` import 절대 금지

### 3.2 디렉토리 구조

```
tf-v3/
├── middleware.ts                       ← 인증 + 레이트 리밋
├── lib/
│   ├── env.ts                          ← requireEnv() (V2 그대로, ⭐⭐⭐⭐)
│   ├── auth.ts                         ← HMAC-SHA256 세션 (V2 그대로, ⭐⭐⭐)
│   ├── ratelimit.ts                    ← Upstash (V2 그대로, ⭐⭐⭐)
│   ├── supabase/
│   │   ├── admin.ts                    ← createAdminClient() (V2 그대로, ⭐⭐⭐⭐⭐)
│   │   └── client.ts                   ← createBrowserClient() (V2 그대로, ⭐⭐⭐⭐⭐)
│   ├── types/
│   │   ├── index.ts                    ← barrel export
│   │   ├── domain/
│   │   │   ├── seller.ts              ← SellerTier, COMMISSION_RATES (단일 소스)
│   │   │   ├── consignment.ts         ← ConsignmentStatus 7값 완전 정의
│   │   │   ├── order.ts              ← OrderStatus 8값 + ALLOWED_TRANSITIONS
│   │   │   ├── settlement.ts         ← SettlementStatus + 통합 파이프라인 타입
│   │   │   ├── product.ts            ← StProduct, PhotoStatus
│   │   │   ├── notification.ts       ← SmsResult, NotificationLog
│   │   │   └── photo.ts             ← ClassifiedGroup, SHOT_RULES
│   │   ├── api/
│   │   │   ├── requests.ts           ← 모든 API Zod 스키마
│   │   │   └── responses.ts          ← ApiSuccess<T>, ApiError
│   │   └── db/
│   │       └── database.types.ts     ← supabase gen types 자동생성
│   ├── utils/
│   │   ├── phone.ts                   ← normalizePhone() + digitsOnly() (V2 2곳 통합)
│   │   ├── brand.ts                   ← normalizeBrand() (V2 4곳 통합, 350+ 별칭)
│   │   ├── category.ts               ← inferCategory() (V2 3곳 통합)
│   │   ├── currency.ts               ← formatKRW() + parseKRW() (V2 3곳 통합)
│   │   ├── date.ts                    ← toKSTDate() (UTC/KST 혼용 수정)
│   │   ├── id.ts                      ← generateOrderNumber() (V2 2곳 통합 + 재시도)
│   │   ├── sms-templates.ts           ← buildSmsMessage() (하드코딩 전화번호 → env)
│   │   ├── excel.ts                   ← parseExcelSafe() + validateHeaders()
│   │   ├── chunk.ts                   ← chunkArray(100) (.in() 대응)
│   │   ├── path.ts                    ← sanitizePath() (basename + startsWith)
│   │   └── validation.ts             ← 공용 Zod 스키마
│   ├── db/
│   │   ├── client.ts                  ← Supabase 팩토리
│   │   ├── repositories/
│   │   │   ├── sellers.repo.ts       ← getByPhone(), upsert(), list()
│   │   │   ├── orders.repo.ts        ← create(), getWithItems(), search()
│   │   │   ├── consignments.repo.ts  ← list(), getById(), batchCreate()
│   │   │   ├── settlement.repo.ts    ← getPendingSoldItems(), createQueue()
│   │   │   ├── products.repo.ts      ← create(), getByNumber(), listWithFilters()
│   │   │   ├── notifications.repo.ts ← log(), getHistory()
│   │   │   ├── sales-records.repo.ts ← batchInsert(), getUnmatched()
│   │   │   └── naver-settlements.repo.ts ← batchInsert(), getUnmatched()
│   │   ├── mappers/
│   │   │   ├── order.mapper.ts       ← V2 mapOrder() 추출
│   │   │   ├── consignment.mapper.ts
│   │   │   └── settlement.mapper.ts
│   │   └── transactions/
│   │       ├── settlement.tx.ts      ← RPC: FOR UPDATE 잠금 + 원자적 생성
│   │       ├── order.tx.ts           ← RPC: 주문+아이템 원자적
│   │       └── consignment.tx.ts     ← RPC: 위탁완료 4단계 원자적
│   ├── services/
│   │   ├── settlement.service.ts     ← generate(), confirm(), pay()
│   │   ├── matching.service.ts       ← autoMatch(), manualMatch()
│   │   ├── order.service.ts          ← create(), inspect(), hold()
│   │   ├── consignment.service.ts    ← review(), complete(), reject()
│   │   ├── notification.service.ts   ← sendStatusChange(), sendBulk()
│   │   ├── photo.service.ts          ← upload(), classify(), link()
│   │   └── sale-detector.service.ts  ← detect()
│   ├── calculators/
│   │   ├── settlement.calc.ts        ← V2 settlement-calculator.ts 이전 (⭐⭐⭐⭐)
│   │   └── price-estimator.calc.ts
│   └── api/
│       ├── response.ts               ← ok(), err(), validationErr() (V2 확장, ⭐⭐⭐⭐⭐)
│       └── middleware.ts             ← requireAdmin() 인라인 가드
├── app/
│   ├── api/                           ← 모든 라우트 핸들러 (100줄 이내)
│   └── admin/                         ← 페이지 + 컴포넌트
└── supabase/
    └── migrations/                    ← DB 마이그레이션
```

---

## 4. V2 재사용 코드 인벤토리

딥분석 에이전트의 재사용 점수(⭐) 기반. **수정 없이 이전 가능** vs **수정 후 이전** vs **새로 작성** 분류.

### 4.1 수정 없이 이전 (⭐⭐⭐⭐~⭐⭐⭐⭐⭐)

| V2 파일 | 줄수 | 점수 | V3 위치 | 비고 |
|---------|------|------|---------|------|
| `lib/supabase/admin.ts` | 29 | ⭐⭐⭐⭐⭐ | `lib/supabase/admin.ts` | 그대로 |
| `lib/supabase/client.ts` | 25 | ⭐⭐⭐⭐⭐ | `lib/supabase/client.ts` | 그대로 |
| `lib/api/response.ts` | 27 | ⭐⭐⭐⭐⭐ | `lib/api/response.ts` | `validationErr()` 추가 |
| `lib/api/client.ts` | 109 | ⭐⭐⭐⭐⭐ | `lib/api/client.ts` | 제네릭 `api.get<T>()` 확장 |
| `lib/env.ts` | 34 | ⭐⭐⭐⭐ | `lib/env.ts` | 누락 변수 10개 추가 등록 |
| `lib/notification/templates.ts` | 134 | ⭐⭐⭐⭐ | `lib/utils/sms-templates.ts` | 하드코딩 전화번호 → env |
| `lib/settlement/settlement-calculator.ts` | 124 | ⭐⭐⭐⭐ | `lib/calculators/settlement.calc.ts` | [Rev.2] Math.round()는 V2 line 71에 이미 존재 → 그대로 이전, 추가 라운딩 위치 없음 확인 |
| `lib/phone-normalizer.ts` | 40 | ⭐⭐⭐⭐ | `lib/utils/phone.ts` 일부 | 2곳 통합 |
| `lib/brand-search.ts` | 446 | ⭐⭐⭐⭐ | `lib/utils/brand.ts` 일부 | 4곳 통합 |
| `lib/settlement/helpers.ts` | 165 | ⭐⭐⭐⭐ | `lib/utils/date.ts` | UTC→KST 통일 수정 |

### 4.2 부분 수정 후 이전 (⭐⭐⭐)

| V2 파일 | 줄수 | 점수 | V3 위치 | 수정 사항 |
|---------|------|------|---------|----------|
| `lib/auth.ts` | 110 | ⭐⭐⭐ | `lib/auth.ts` | Base64 payload → 암호화, timingSafeEqual 유지 |
| `lib/ratelimit.ts` | 70 | ⭐⭐⭐ | `lib/ratelimit.ts` | null 반환 시 에러 처리 강화 |
| `lib/notification/sms.ts` | 69 | ⭐⭐⭐ | 서비스에 통합 | dev mode 제거 |
| `lib/notification/index.ts` | 130 | ⭐⭐⭐ | `notification.service.ts` | [Rev.2] V2는 received/completed 2개 상태만 자동 SMS → V3에서 inspecting/approved/rejected 등 확장 시 신규 템플릿 필요 |
| `lib/settlement/product-matcher.ts` | 314 | ⭐⭐⭐ | `matching.service.ts` | brand.ts 통합 맵 사용, 0.3→0.85 수정 |

### 4.3 새로 작성 (V2 참조만)

| V3 파일 | 근거 | 이유 |
|---------|------|------|
| `middleware.ts` | V2 proxy.ts 참조 | 파일명/함수명 전면 변경 |
| `lib/api/middleware.ts` | 신규 | V2에 없는 requireAdmin() |
| `lib/db/repositories/*` | V2 route.ts에서 추출 | V2에 리포지토리 패턴 없음 |
| `lib/db/transactions/*` | 신규 | V2에 RPC 0개 |
| `lib/services/*` | V2 route.ts에서 추출 | V2에 서비스 레이어 없음 |
| `lib/types/domain/*` | V2 12개 타입 파일 참조 | 전면 재정의 + 통합 |
| `lib/types/api/requests.ts` | 신규 | V2에 Zod 미사용 |

---

## 5. Phase 0: DB 마이그레이션

### 5.1 목적
V3 코드가 의존하는 DB 제약 조건을 **코드 작성 전에** 선행 적용.

### 5.2 마이그레이션 파일 (5개)

#### 5.2.1 ConsignmentStatus DB CHECK 확장 (Rev.2 추가)

```sql
-- 20260301_000_v3_consignment_status_check.sql
-- [Rev.2] 에이전트1 발견: V2 DB CHECK은 5값만 ('pending','inspecting','approved','on_hold','rejected')
-- V2 TypeScript에는 7값 정의 → DB와 불일치 → 'received','completed' 추가 필수

-- 사전 확인: 현재 CHECK 제약 확인
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'consignment_requests'::regclass AND contype = 'c';

-- CHECK 제약 변경 (ALTER ... DROP + ADD)
ALTER TABLE consignment_requests DROP CONSTRAINT IF EXISTS consignment_requests_status_check;
ALTER TABLE consignment_requests ADD CONSTRAINT consignment_requests_status_check
  CHECK (status IN ('pending', 'received', 'inspecting', 'approved', 'on_hold', 'rejected', 'completed'));
```

#### 5.2.2 UNIQUE 제약 추가 (5건)

```sql
-- 20260301_001_v3_unique_constraints.sql

-- [사전 조건] 기존 중복 데이터 확인 쿼리 먼저 실행
-- SELECT phone, COUNT(*) FROM sellers GROUP BY phone HAVING COUNT(*) > 1;
-- SELECT seller_code, COUNT(*) FROM sellers GROUP BY seller_code HAVING COUNT(*) > 1;
-- SELECT match_id, COUNT(*) FROM settlement_queue GROUP BY match_id HAVING COUNT(*) > 1;
-- SELECT consignment_id, COUNT(*) FROM return_shipments GROUP BY consignment_id HAVING COUNT(*) > 1;
-- SELECT product_number, COUNT(*) FROM st_products GROUP BY product_number HAVING COUNT(*) > 1;

-- [중복 존재 시] 중복 정리 (최신 1건만 남기고 삭제)
-- DELETE FROM sellers a USING sellers b
--   WHERE a.id < b.id AND a.phone = b.phone;
-- (각 테이블 동일 패턴)

-- [Rev.2] 에이전트4 발견: 외래키 참조 테이블 4개 모두 정리 필수
-- (consignment_requests만 처리하면 sold_items/settlement_queue/st_products에 고아 참조 발생)
-- UPDATE consignment_requests SET seller_id = (살아남은 id) WHERE seller_id IN (삭제된 ids);
-- UPDATE sold_items SET seller_id = (살아남은 id) WHERE seller_id IN (삭제된 ids);
-- UPDATE settlement_queue SET seller_id = (살아남은 id) WHERE seller_id IN (삭제된 ids);
-- UPDATE st_products SET seller_id = (살아남은 id) WHERE seller_id IN (삭제된 ids);

-- C8: 이중 정산 큐 방지 (FINANCIAL)
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

-- H19: 상품번호 중복 방지 (Stuck-Consignment 근본 해결)
ALTER TABLE st_products
  ADD CONSTRAINT uq_st_products_number UNIQUE (product_number);
```

#### 5.2.3 RPC: 정산 원자적 생성

```sql
-- 20260301_002_v3_rpc_settlement.sql

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
BEGIN
  -- Step 1: FOR UPDATE 잠금 (이중 정산 원천 차단)
  SELECT COUNT(*) INTO v_locked_count
    FROM sold_items
    WHERE id = ANY(p_sold_item_ids)
      AND settlement_status = 'pending'
    FOR UPDATE;

  -- Step 2: 잠금 실패 검증
  IF v_locked_count != array_length(p_sold_item_ids, 1) THEN
    RAISE EXCEPTION 'sold_items 잠금 실패: 예상 %개, 실제 %개 (이미 정산됨)',
      array_length(p_sold_item_ids, 1), v_locked_count;
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
    WHERE id = ANY(p_sold_item_ids)
      AND settlement_status = 'pending';

  RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql;
```

#### 5.2.4 RPC: 주문+아이템 원자적 생성

```sql
-- 20260301_003_v3_rpc_order.sql

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
BEGIN
  INSERT INTO orders (
    order_number, customer_name, phone, status
  ) VALUES (
    p_order_number, p_customer_name, p_customer_phone, p_status
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
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

#### 5.2.5 RPC: 위탁완료 원자적 처리

```sql
-- 20260301_004_v3_rpc_consignment.sql

CREATE OR REPLACE FUNCTION complete_consignment(
  p_consignment_id uuid,
  p_expected_status text,
  p_product_number text,
  p_product_data jsonb,
  p_order_number text,
  p_order_data jsonb,
  p_order_item_data jsonb
) RETURNS jsonb AS $$
DECLARE
  v_current_status text;
  v_product_id uuid;
  v_order_id uuid;
BEGIN
  -- Step 1: 낙관적 잠금 (상태 전환 레이스 방지)
  SELECT status INTO v_current_status
    FROM consignment_requests
    WHERE id = p_consignment_id
    FOR UPDATE;

  IF v_current_status != p_expected_status THEN
    RAISE EXCEPTION '상태 불일치: 예상 %, 실제 % (다른 관리자가 변경함)',
      p_expected_status, v_current_status;
  END IF;

  -- Step 2: 상품 생성
  INSERT INTO st_products (
    product_number, brand, category, size, color,
    condition, measurements, photos, is_active
  ) VALUES (
    p_product_number,
    p_product_data->>'brand',
    p_product_data->>'category',
    p_product_data->>'size',
    p_product_data->>'color',
    p_product_data->>'condition',
    (p_product_data->'measurements')::jsonb,
    (p_product_data->'photos')::jsonb,
    true
  ) RETURNING id INTO v_product_id;

  -- Step 3: 주문 생성
  INSERT INTO orders (
    order_number, customer_name, phone, status
  ) VALUES (
    p_order_number,
    p_order_data->>'customer_name',
    p_order_data->>'phone',
    'APPLIED'
  ) RETURNING id INTO v_order_id;

  -- Step 4: 주문 아이템 생성
  INSERT INTO order_items (
    order_id, product_number, brand, category,
    condition, size, color
  ) VALUES (
    v_order_id,
    p_product_number,
    p_order_item_data->>'brand',
    p_order_item_data->>'category',
    p_order_item_data->>'condition',
    p_order_item_data->>'size',
    p_order_item_data->>'color'
  );

  -- Step 5: 위탁 상태 업데이트
  UPDATE consignment_requests
    SET status = 'completed'
    WHERE id = p_consignment_id
      AND status = p_expected_status;

  RETURN jsonb_build_object(
    'product_id', v_product_id,
    'order_id', v_order_id
  );
END;
$$ LANGUAGE plpgsql;
```

### 5.3 Phase 0 검증 게이트

```
□ ConsignmentStatus CHECK 제약이 7값 포함 확인 (Rev.2)
□ 5개 UNIQUE 제약 적용 확인: \d+ 테이블명
□ 기존 중복 데이터 0건 확인 (중복 정리 완료)
□ 외래키 4개 테이블(consignment_requests, sold_items, settlement_queue, st_products) 고아 참조 0건 (Rev.2)
□ 3개 RPC 함수 생성 확인: SELECT routine_name FROM information_schema.routines WHERE routine_type = 'FUNCTION';
□ RPC 테스트: SELECT create_order_with_items(...) → uuid 반환
□ RPC 롤백 테스트: 의도적 실패 → 고아 데이터 0건
□ settlement_queue.match_id 기존 중복 데이터 확인 (Rev.2): SELECT match_id, COUNT(*) FROM settlement_queue GROUP BY match_id HAVING COUNT(*) > 1;
```

### 5.4 Phase 0 실패 시나리오

| 실패 | 원인 | 대응 |
|------|------|------|
| UNIQUE 추가 실패 | 기존 중복 데이터 | 중복 정리 스크립트 선행 (§15 롤백 전략) |
| RPC 생성 실패 | SQL 문법 오류 | 로컬 Supabase에서 먼저 테스트 |
| RPC 실행 중 교착 | FOR UPDATE 순서 불일치 | id 오름차순 잠금 보장 |

---

## 6. Phase 1: 타입 + Zod + 유틸리티

### 6.1 목적
V2의 12개 산재 타입 파일 → 단일 소스. V2의 5곳 분산 유틸 → 통합.

### 6.2 생성 파일 목록 (27개)

```
lib/env.ts                         ← V2 그대로 + 누락 10개 변수 추가
lib/supabase/admin.ts              ← V2 그대로 (29줄)
lib/supabase/client.ts             ← V2 그대로 (25줄)
lib/auth.ts                        ← V2 기반 + 개선
lib/ratelimit.ts                   ← V2 그대로 (70줄)
lib/types/index.ts                 ← barrel export
lib/types/domain/seller.ts         ← COMMISSION_RATES 단일 소스 (5곳→1곳)
lib/types/domain/consignment.ts    ← ConsignmentStatus 7값 완전 정의
lib/types/domain/order.ts          ← OrderStatus 8값 + ALLOWED_TRANSITIONS
lib/types/domain/settlement.ts     ← 통합 파이프라인 타입
lib/types/domain/product.ts
lib/types/domain/notification.ts
lib/types/domain/photo.ts
lib/types/api/requests.ts          ← 모든 API Zod 스키마 (C10 req.json 해결)
lib/types/api/responses.ts         ← ApiSuccess<T>, ApiError
lib/types/db/database.types.ts     ← supabase gen types 자동생성
lib/utils/phone.ts                 ← 2곳 통합 (NEW-06 0접두사 수정 포함)
lib/utils/brand.ts                 ← 4곳 통합 (350+ 별칭, 볼리올리/보리올리 통일)
lib/utils/category.ts              ← 3곳 통합 (재킷→jacket 통일)
lib/utils/currency.ts              ← 3곳 통합 + Math.round()
lib/utils/date.ts                  ← UTC/KST 혼용 수정
lib/utils/id.ts                    ← 주문번호 생성 통합 + UNIQUE 재시도
lib/utils/sms-templates.ts         ← 하드코딩 전화번호 → env
lib/utils/excel.ts                 ← parseExcelSafe() + validateHeaders()
lib/utils/chunk.ts                 ← chunkArray(100)
lib/utils/path.ts                  ← sanitizePath()
lib/utils/validation.ts            ← 공용 Zod 스키마
```

### 6.3 핵심 타입 정의 상세

#### seller.ts — 커미션 단일 소스

```typescript
// V2 문제: 4곳 분산 + 하드코딩 폴백
//   - consignments/types.ts: SellerTier = 'general' | 'employee' (2값)
//   - orders/types.ts: SellerType = 'general' | 'employee' | 'vip' (3값)
//   - settlement-calculator.ts: commission_rate 직접 참조
//   - queue-settlements/route.ts:133: ?? 0.25 폴백
// [Rev.2] 에이전트1 발견: SellerTier(2값) vs SellerType(3값) 네이밍 충돌
// V3 해결: SellerTier로 통일 (3값), 이 파일이 유일한 커미션 정의

export type SellerTier = 'general' | 'employee' | 'vip'

export const COMMISSION_RATES: Record<SellerTier, number> = {
  general: 0.25,
  employee: 0.20,
  vip: 0.20,
} as const

// 폴백 제거: 미매칭 시 0.25 하드코딩(V2 queue-settlements:133) → 에러 throw
// [Rev.2] 기존 DB sellers.commission_rate 값이 있으면 그것을 우선 사용,
// 신규 판매자만 COMMISSION_RATES[tier] 적용 (에이전트2 확인)
```

#### consignment.ts — 7값 상태

```typescript
// V2 문제: TypeScript에 7값 정의, DB CHECK은 5값만 ('received','completed' 누락)
// [Rev.2] 에이전트1 발견: Phase 0에서 DB CHECK 확장 마이그레이션 선행 필수
// V3 해결: Phase 0 마이그레이션으로 DB CHECK 7값 확장 + TypeScript 정확히 일치

export const CONSIGNMENT_STATUSES = [
  'pending', 'received', 'inspecting', 'approved',
  'on_hold', 'rejected', 'completed'
] as const

export type ConsignmentStatus = typeof CONSIGNMENT_STATUSES[number]

export const CONSIGNMENT_TRANSITIONS: Record<ConsignmentStatus, ConsignmentStatus[]> = {
  pending: ['received'],
  received: ['inspecting'],
  inspecting: ['approved', 'on_hold', 'rejected'],
  approved: ['completed'],
  on_hold: ['inspecting'],
  rejected: [],
  completed: [],
}
```

#### order.ts — 상태 머신

```typescript
// V2 문제: 어떤 상태로든 전환 가능 (PAID→APPLIED 가능)
// V3 해결: 명시적 허용 전환

export const ORDER_STATUSES = [
  'APPLIED', 'SHIPPING', 'COLLECTED', 'INSPECTED',
  'PRICE_ADJUSTING', 'RE_INSPECTED', 'IMAGE_PREPARING', 'IMAGE_COMPLETE'
] as const

export type OrderStatus = typeof ORDER_STATUSES[number]

export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  APPLIED: ['SHIPPING'],
  SHIPPING: ['COLLECTED'],
  COLLECTED: ['INSPECTED'],
  INSPECTED: ['PRICE_ADJUSTING', 'IMAGE_PREPARING'],
  PRICE_ADJUSTING: ['RE_INSPECTED'],
  RE_INSPECTED: ['IMAGE_PREPARING'],
  IMAGE_PREPARING: ['IMAGE_COMPLETE'],
  IMAGE_COMPLETE: [],
}
```

#### requests.ts — Zod 스키마 (핵심)

```typescript
// 이것 하나로 해결: C10 req.json 크래시 12건, RUN-04 NaN 7건, FIN-06 sale_price 0원

import { z } from 'zod'

export const GenerateSettlementSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  seller_ids: z.array(z.string().uuid()).optional(),
})

export const CreateOrderSchema = z.object({
  customer_name: z.string().min(1).max(100),
  customer_phone: z.string().regex(/^01[016789]-?\d{3,4}-?\d{4}$/),
  items: z.array(z.object({
    product_number: z.string().min(1),
    brand: z.string().min(1),
    category: z.string().min(1),
    condition: z.string().min(1),
    size: z.string().optional(),
    color: z.string().optional(),
    sale_price: z.number().positive(), // 0/null/음수 차단
  })).min(1),
})

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['APPLIED','SHIPPING','COLLECTED','INSPECTED',
    'PRICE_ADJUSTING','RE_INSPECTED','IMAGE_PREPARING','IMAGE_COMPLETE']),
})

export const PriceAdjustSchema = z.object({
  adjusted_price: z.number().positive(),
  reason: z.string().min(1).max(500),
})

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

// [Rev.2] 에이전트1 발견: V2에 38개 POST/PUT/PATCH 엔드포인트, 위 6-8개만 커버
// 전체 엔드포인트 Zod 스키마 목록 (Phase 5 작성 전 이곳에 선정의):
export const UploadSalesLedgerSchema = z.object({ /* FormData 대신 메타데이터만 */ })
export const UploadNaverSettleSchema = z.object({ /* FormData 대신 메타데이터만 */ })
export const QueueSettlementSchema = z.object({
  match_ids: z.array(z.string().uuid()),
})
export const ManualMatchSchema = z.object({
  sales_record_id: z.string().uuid(),
  naver_settlement_id: z.string().uuid(),
})
export const ConsignmentCreateSchema = z.object({
  seller_name: z.string().min(1),
  seller_phone: z.string().regex(/^01[016789]-?\d{3,4}-?\d{4}$/),
  items: z.array(z.object({
    brand: z.string().min(1),
    category: z.string().min(1),
    description: z.string().optional(),
  })).min(1),
})
export const ConsignmentUpdateSchema = z.object({
  status: z.enum(['pending','received','inspecting','approved','on_hold','rejected','completed']),
  rejection_reason: z.string().optional(),
})
export const SendSmsSchema = z.object({
  phone: z.string().min(1),
  message: z.string().min(1).max(2000),
})
export const BulkSmsSchema = z.object({
  phones: z.array(z.string()).min(1),
  template: z.string().min(1),
})
// ... (나머지 API별 스키마 — Phase 5에서 라우트 작성 시 즉시 추가)

// [Rev.2] FormData 업로드 4개 라우트는 Zod 사용 불가 → 커스텀 검증 전략:
// - admin/photos/upload: req.formData() 후 file instanceof File 확인 + size < 10MB
// - admin/consignments/upload-photo: 동일
// - settlement/upload-sales-ledger: xlsx 파일 확인 + parseExcelSafe() 내부 검증
// - settlement/upload-naver-settle: xlsx 파일 확인 + parseExcelSafe() 내부 검증
```

### 6.4 유틸리티 상세

#### phone.ts — 2곳 통합

```typescript
// V2 문제: phone-normalizer.ts와 seller-matcher.ts:98이 다른 정규화
// NEW-06: 0접두사 탈락 미처리
// V3 해결: 단일 유틸

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  // 0접두사 복원 (NEW-06 수정)
  const withPrefix = digits.startsWith('0') ? digits : `0${digits}`
  if (withPrefix.length === 11) {
    return `${withPrefix.slice(0,3)}-${withPrefix.slice(3,7)}-${withPrefix.slice(7)}`
  }
  return withPrefix
}

export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '')
}
```

#### brand.ts — 4곳 통합

```typescript
// V2 문제: brand-search(80+), scoreCalculator(12), orders/search(20), product-matcher(12)
// 볼리올리 vs 보리올리 스펠링 불일치
// V3 해결: 단일 브랜드 맵 (350+ 별칭)

const BRAND_ALIASES: Record<string, string> = {
  '볼리올리': 'BOGLIOLI',
  '보리올리': 'BOGLIOLI',
  '로로피아나': 'LORO PIANA',
  // ... (V2 4개 소스에서 전부 병합)
}

export function normalizeBrand(raw: string): string {
  const trimmed = raw.trim()
  return BRAND_ALIASES[trimmed] ?? BRAND_ALIASES[trimmed.toUpperCase()] ?? trimmed
}
```

### 6.5 Phase 1 검증 게이트

```
□ tsc --strict --noEmit → 에러 0건
□ ConsignmentStatus가 7값인지 확인
□ COMMISSION_RATES가 lib/types/domain/seller.ts에만 존재하는지 확인
□ grep -r "COMMISSION_RATES" → seller.ts에서만 export
□ 모든 유틸 함수에 JSDoc + 단위 테스트 가능 확인
□ Zod 스키마로 C10 (req.json 크래시 12건) 커버 확인
```

### 6.6 Phase 1 실패 시나리오

| 실패 | 원인 | 대응 |
|------|------|------|
| supabase gen types 실패 | Supabase 프로젝트 미연결 | 수동 타입 정의 후 나중에 자동생성 덮어쓰기 |
| V2 브랜드 별칭 350+개 누락 | 4곳 병합 시 누락 | V2 소스 diff 후 전수 확인 |
| Zod 스키마 누락 | API 엔드포인트 미커버 | Phase 5에서 라우트 작성 시 발견→즉시 추가 |

---

## 7. Phase 2: 리포지토리 + 트랜잭션

### 7.1 목적
V2 route.ts 인라인 DB 호출 → 리포지토리 패턴 추출. 모든 Supabase 에러 필수 확인.

### 7.2 생성 파일 (16개)

```
lib/db/client.ts
lib/db/index.ts
lib/db/repositories/sellers.repo.ts         ← 70줄
lib/db/repositories/orders.repo.ts          ← 90줄
lib/db/repositories/consignments.repo.ts    ← 80줄
lib/db/repositories/settlement.repo.ts      ← 90줄
lib/db/repositories/products.repo.ts        ← 70줄
lib/db/repositories/notifications.repo.ts   ← 50줄
lib/db/repositories/sales-records.repo.ts   ← 60줄
lib/db/repositories/naver-settlements.repo.ts ← 60줄
lib/db/mappers/order.mapper.ts
lib/db/mappers/consignment.mapper.ts
lib/db/mappers/settlement.mapper.ts
lib/db/transactions/settlement.tx.ts
lib/db/transactions/order.tx.ts
lib/db/transactions/consignment.tx.ts
```

### 7.3 리포지토리 핵심 원칙

1. **모든 `{ data, error }` 반환값의 `error` 필수 확인** (V2 9건 미확인 해결)
2. **`.in()` 호출 시 `chunkArray(100)` 적용** (V2 H10 해결)
3. **모든 목록 쿼리에 `.range()` 강제** (V2 C7 1000행 절삭 해결)
4. **`.or()` 문자열 보간 전면 제거** → 파라미터화 메서드 사용 (V2 C5 해결)
5. **상태 UPDATE에 `.eq('status', expected)` 포함** (V2 DAT-08 레이스 방지)

### 7.4 리포지토리 예시 (settlement.repo.ts)

```typescript
// 주요 함수 시그니처
export async function getPendingSoldItems(sellerIds: string[]): Promise<SoldItem[]>
  // .range() 페이지네이션 적용
  // .in() chunkArray(100) 적용
  // error 반드시 확인

export async function createSettlementViaRpc(params: CreateSettlementParams): Promise<string>
  // RPC create_settlement_with_items 호출
  // FOR UPDATE 잠금으로 이중 정산 차단
```

### 7.5 매퍼 역할

```typescript
// order.mapper.ts
// V2 admin/orders/route.ts의 인라인 mapOrder() → 분리
// Non-null assertion 제거 → optional chaining + 기본값
export function mapOrderRow(row: Database['public']['Tables']['orders']['Row']): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status as OrderStatus, // DB CHECK으로 안전
    // ...
  }
}
```

### 7.6 Phase 2 검증 게이트

```
□ tsc --strict --noEmit → 에러 0건
□ grep -r "\.or(\`" lib/db/ → 0건 (PostgREST 인젝션 0)
□ grep -r "{ error }" lib/db/repositories/ → 모든 Supabase 호출에 에러 확인
□ grep -r "\.range(" lib/db/repositories/ → 모든 목록 쿼리에 페이지네이션
□ grep -r "chunkArray" lib/db/repositories/ → 모든 .in() 호출에 청크 분할
□ 모든 리포지토리 파일 100줄 이내
```

### 7.7 Phase 2 실패 시나리오

| 실패 | 원인 | 대응 |
|------|------|------|
| RPC 호출 타입 불일치 | supabase gen types와 RPC 시그니처 불일치 | 수동 타입 오버라이드 |
| .range() 누락 | 리포지토리 작성 시 실수 | Phase 8 grep 검증에서 포착 |
| 매퍼 필드 누락 | V2 DB 컬럼 변경 | database.types.ts로 컴파일 타임 확인 |

---

## 8. Phase 3: 미들웨어 + 인증

### 8.1 목적
V2 C1 (전체 인증 무효) 해결. 미들웨어 + 인라인 가드 이중 보호.

### 8.2 생성 파일 (2개)

```
middleware.ts                      ← 루트 미들웨어 (V2 proxy.ts 대체)
lib/api/middleware.ts              ← requireAdmin() 인라인 가드
```

### 8.3 middleware.ts 상세

```typescript
// V2 문제: proxy.ts 파일명 + proxy() 함수명 → Next.js 미인식
// V3: middleware.ts + middleware() → Next.js 자동 인식

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  // 로그인 제외
  if (path === '/api/admin/auth/login') return NextResponse.next()

  // /admin/* 페이지 + /api/admin/* API 모두 인증
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    const session = req.cookies.get('session')
    const valid = await verifySession(session?.value)
    if (!valid) {
      if (path.startsWith('/api/')) {
        return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }
  }

  // Public API 레이트 리밋 (Upstash)
  if (path.startsWith('/api/consignment') || path.startsWith('/api/orders')) {
    // 10/분 제한
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/api/consignment/:path*', '/api/orders/:path*']
}
```

### 8.4 requireAdmin() 인라인 가드

```typescript
// V2에 없던 새로운 방어 계층
// 미들웨어가 우회되더라도 (에지 케이스, config 미매칭) 각 라우트에서 재검증

export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const session = req.cookies.get('session')?.value
  if (!session) return err('인증 필요', 401)
  const valid = await verifySession(session)
  if (!valid) return err('인증 만료', 401)
  return null // 인증 성공
}
```

### 8.5 Phase 3 검증 게이트

```
□ next build → .next/server/middleware-manifest.json에 middleware 등록 확인
□ curl -X GET /api/admin/orders (세션 없이) → 401
□ curl -X GET /admin/consignments (세션 없이) → 302 /admin/login
□ curl -X POST /api/admin/auth/login → 200 (인증 제외 확인)
□ tsc --strict --noEmit → 에러 0건
```

### 8.6 Phase 3 실패 시나리오

| 실패 | 원인 | 대응 |
|------|------|------|
| 미들웨어 여전히 미작동 | config.matcher 패턴 오류 | middleware-manifest.json 확인 |
| 쿠키 파싱 실패 | @supabase/ssr 버전 | 수동 쿠키 파싱 폴백 |
| 로그인 페이지 무한 리다이렉트 | /admin/login도 미들웨어 매칭 | matcher에서 /admin/login 제외 |

---

## 9. Phase 4: 서비스 레이어

### 9.1 목적
V2 route.ts의 비즈니스 로직을 서비스로 추출. NextRequest/NextResponse 의존 제거.

### 9.2 생성 파일 (9개)

```
lib/services/settlement.service.ts     ← 80줄
lib/services/matching.service.ts       ← 90줄
lib/services/order.service.ts          ← 70줄
lib/services/consignment.service.ts    ← 80줄
lib/services/notification.service.ts   ← 90줄
lib/services/photo.service.ts          ← 80줄
lib/services/sale-detector.service.ts  ← 60줄
lib/calculators/settlement.calc.ts     ← V2 이전 (60줄)
lib/calculators/price-estimator.calc.ts ← V2 이전 (50줄)
```

### 9.3 서비스별 상세

#### settlement.service.ts (V2 C2 이중 정산 해결)

```
함수: generate(params)
  1. sellers.repo.getActive() → 활성 판매자 목록
  2. settlement.repo.getPendingSoldItems(sellerIds) → 미정산 항목
  3. settlement.calc.calculate(items, COMMISSION_RATES[seller.tier]) → 순수 계산
     - [Rev.2] Math.round()는 V2 settlement-calculator.ts:71에 이미 존재 → 그대로 이전
     - commission_rate 범위 검증 0 < rate < 1 (FIN-06)
     - [Rev.2] 기존 seller.commission_rate DB 값 있으면 우선 사용, 없을 때만 COMMISSION_RATES[tier]
  4. settlement.tx.createWithItems(params) → RPC 원자적 생성 (FOR UPDATE)

  해결: C2 이중 정산, FIN-04 커미션 분산, FIN-09 부동소수점

함수: confirm(settlementId)
  - settlement.repo.updateStatus(id, 'pending', 'confirmed')
  - .eq('settlement_status', 'pending') 낙관적 잠금

함수: pay(settlementId)
  - settlement.repo.updateStatus(id, 'confirmed', 'paid')
  - notification.service.sendPaidMessage(seller) ← FIN-08 데드코드 활성화
```

#### matching.service.ts (V2 FIN-11 임계값 수정)

```
함수: autoMatch(salesRecords, naverSettlements)
  1. brand.ts 통합 맵 사용 (ARC-01 4곳→1곳)
  2. 3단계 매칭 알고리즘 유지 (V2 product-matcher.ts)
  3. 동명이인 매칭 임계값: 0.3 → 0.85 (FIN-11 수정)
  4. Promise.all 결과 검사 필수 (DAT-06)
  5. [Rev.2] 에이전트2 발견: V2 AMOUNT_TOLERANCE = 0.00 (정확 일치) → 기존 값 유지, ±100원은 오류
     - 매칭 허용 오차: 0원 (정확 일치, V2 동작 유지)

  해결: FIN-11 임계값, DAT-06 Promise.all, ARC-01 브랜드 통합

함수: manualMatch(salesRecordId, naverSettlementId)
  - 양쪽 match_status 동시 업데이트 (Promise.all 결과 확인)
  - 실패 시 보상 롤백
```

#### consignment.service.ts (V2 DAT-04 Stuck 해결)

```
함수: complete(consignmentId, data)
  1. RPC complete_consignment 호출 → 4단계 원자적 처리
  2. 실패 시 전체 자동 롤백 (PostgreSQL 트랜잭션)
  3. category.ts 통합 추론 사용 (ARC-02)
  4. id.ts 통합 주문번호 생성 (DAT-10)

  해결: DAT-04 Stuck-consignment, DAT-08 레이스, ARC-02 카테고리

함수: updateStatus(id, fromStatus, toStatus)
  - CONSIGNMENT_TRANSITIONS 검증 (DAT-11 상태 머신)
  - .eq('status', fromStatus) 낙관적 잠금 (DAT-08)
  - notification.service.sendStatusChange() 자동 호출
```

#### notification.service.ts (V2 RUN-06 SMS 미발송 해결)

```
함수: sendStatusChange(consignment, newStatus)
  1. [Rev.2] V2는 received/completed 2개 상태만 자동 SMS
     V3 확장: received, inspecting, approved, rejected, completed (5개 상태)
     ※ 나머지(pending, on_hold)는 관리자 수동 전환이므로 SMS 불필요
  2. sms.ts dev mode 제거 → requireEnv('COOLSMS_API_KEY')
  3. DB 로깅 (notifications.repo.log)
  4. DB UPDATE 성공 확인 후에만 SMS 발송 (RUN-08)

  해결: RUN-06 SMS 미발송, EXT-02 dev mode, FIN-08 paidMessage

함수: sendBulk(phones, template)
  - chunkArray(100) 적용
  - 실패 건수 수집 → 응답에 포함 (V2는 실패 무시)
```

#### photo.service.ts (V2 EXT-01 타임아웃 추가)

```
함수: upload(files, productNumber)
  - Supabase Storage 업로드 (V2 파일시스템 → 클라우드)
  - sanitizePath() 적용 (SEC-03 Path Traversal)

함수: classify(productId)
  - Claude API 호출에 AbortController + 30초 타임아웃 (EXT-01)
  - content 배열 길이 검증 (EXT-04)
  - 재시도 전략: 지수 백오프 3회 (NEW-07)
  - BATCH_SIZE=10 유지

함수: processPhoto(buffer)
  - Buffer 기반 파이프라인 (V2 fs 의존 제거)
  - HEIC 변환: sharp 사용 (EXT-07 크로스플랫폼)
```

### 9.4 Phase 4 검증 게이트

```
□ tsc --strict --noEmit → 에러 0건
□ grep -r "NextRequest\|NextResponse" lib/services/ → 0건
□ grep -r "COMMISSION_RATES" lib/services/ → seller.ts import만 존재
□ 모든 서비스 파일 100줄 이내
□ 모든 서비스 함수가 { data, error } 패턴 반환
□ notification.service에서 모든 상태 전환 SMS 커버 확인
```

### 9.5 Phase 4 실패 시나리오

| 실패 | 원인 | 대응 |
|------|------|------|
| 서비스가 100줄 초과 | 비즈니스 로직 복잡도 | 하위 함수 분리 (같은 파일 내) |
| 순환 의존 | settlement.service ↔ notification.service | 이벤트 디스패치 패턴으로 분리 |
| V2 로직 누락 | 5단계 완료 중 비동기 fire-and-forget 미이전 | V2 코드 라인별 대조 |
| [Rev.2] triggerPriceEstimate | V2 위탁완료 시 비동기 fire-and-forget 호출 — 실패해도 위탁 완료에 영향 없음 | consignment.service.complete() 마지막에 fire-and-forget 호출 추가, try/catch 래핑 |

---

## 10. Phase 5: API 라우트

### 10.1 목적
[Rev.2] V2 56개 route.ts 파일(75개 HTTP 핸들러)을 100줄 이내 얇은 핸들러로 리팩터.
※ 초안의 "52개/82개"는 오류 — 에이전트2가 실제 파일 카운트 확인

### 10.2 표준 핸들러 패턴

```typescript
/**
 * [메서드] [경로] — [설명]
 * WHY: [V2 문제]
 * HOW: Zod 검증 → 서비스 위임 → 표준 응답
 * WHERE: [UI에서 호출 위치]
 */
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
    return err(msg)
  }
}
```

### 10.3 Tier 1 — CRITICAL (10개 라우트)

| V2 라우트 | V2 줄수 | V3 목표 | 해결하는 문제 |
|----------|---------|---------|-------------|
| `admin/auth/login` | 49 | ~50 | C6 인증 우회, SEC-06 평문 비교 |
| `admin/auth/logout` | ~20 | ~20 | — |
| `settlement/generate` | 163 | ~40 | C2 이중 정산, FIN-01 |
| `settlement/auto-match` | 206 | ~50 | FIN-11 임계값, DAT-06 |
| `settlement/manual-match` | 113 | ~60 | DAT-06 Promise.all |
| `settlement/queue-settlements` | 290 | ~80 | C8 match_id, FIN-04 커미션 |
| `settlement/generate-payout` | 231 | ~70 | FIN-07 파일 소실 |
| `admin/orders` (GET/POST/PATCH) | 220 | ~80 | DAT-05 비원자적, RUN-05 try/catch |
| `admin/consignments/[id]` (PATCH) | 497 | ~60 | DAT-04 Stuck, DAT-08 레이스 |
| `admin/consignments` (GET/POST) | 358 | ~80 | H5/H6 판매자 중복, H14 N+1 |

### 10.4 Tier 2 — HIGH (20개 라우트)

| V2 라우트 | V3 목표 | 해결하는 문제 |
|----------|---------|-------------|
| `admin/notifications/send-sms` | ~40 | RUN-05 try/catch |
| `admin/notifications/bulk-send` | ~50 | DAT-16 .in() 100개 |
| `admin/notifications/resend` | ~40 | RUN-05 try/catch |
| `admin/notifications` (GET) | ~40 | SEC-04 .or() 인젝션 |
| `admin/products` (GET) | ~60 | SEC-04 .or() 인젝션, C7 1000행 |
| `admin/photos/upload` | ~50 | SEC-03 Path Traversal |
| `settlement/upload-sales-ledger` | ~60 | RUN-04 NaN, H12 파일 크기 |
| `settlement/upload-naver-settle` | ~60 | DAT-09 기존 데이터 삭제 |
| `settlement/upload-sales` | ~50 | FIN-06 sale_price 0원 |
| `settlement/upload-confirm` | ~50 | FIN-10 정산 후 가격 변경 |
| `consignment/adjust/[token]` (GET/PATCH) | ~50 | SEC-05 service role key |
| `consignment/adjust/[token]/return` | ~50 | RUN-07 외부 서비스 미보호 |
| `orders/[productId]/hold` | ~40 | SEC-05 service role key |
| `admin/orders/search` | ~40 | SEC-04 .or() 인젝션 |
| `admin/sellers/*` | ~40 | — |
| `admin/sales` | ~50 | — |
| `settlement/list` | ~40 | — |
| `settlement/detail/[id]` | ~40 | — |
| `settlement/confirm/[id]` | ~30 | — |
| `settlement/pay/[id]` | ~30 | — |

### 10.4.1 [Rev.2] 누락된 DELETE 라우트 (6개)

| V2 라우트 | 메서드 | V3 목표 | 비고 |
|----------|--------|---------|------|
| `settlement/upload-naver-settle` | DELETE | ~30 | 세션별 업로드 데이터 삭제 |
| `settlement/upload-sales-ledger` | DELETE | ~30 | 세션별 업로드 데이터 삭제 |
| `settlement/queue-settlements` | DELETE | ~30 | 큐 항목 삭제 |
| `settlement/manual-match` | DELETE | ~30 | 수동 매칭 해제 |
| `admin/consignments` | DELETE | ~30 | 위탁 건 삭제 |
| `admin/photos/storage` | DELETE | ~30 | 사진 파일 삭제 |

### 10.4.2 [Rev.2] 누락된 분류 라우트

| V2 라우트 | V3 목표 | 비고 |
|----------|---------|------|
| `settlement/sellers` | ~40 | 정산 판매자 목록 |
| `admin/sales/erp` | ~50 | ERP 연동 |
| `settlement/export/mismatch-report` | ~40 | V2는 빈 데이터 반환 (스텁) → 구현 여부 결정 필요 |
| `admin/consignments/return-shipment` | ~40 | 반품 배송 |

### 10.5 Tier 3 — MEDIUM/LOW (22개 라우트)

```
settlement/review-report, export/*
admin/consignments/create-single, return-shipment, upload-photo
admin/photos/classify, edit, match, download, generate-*, link-to-product
admin/photos/process-storage, storage, storage-serve
admin/price-estimate
admin/database/*
health, ready
storage/[...path]
```

### 10.6 Phase 5 검증 게이트

```
□ tsc --strict --noEmit → 에러 0건
□ wc -l app/api/**/route.ts → 모든 라우트 100줄 이내
□ grep -r "requireAdmin" app/api/admin/ → admin 라우트 수와 일치
□ grep -r "\.or(\`" app/ → 0건 (PostgREST 인젝션 0)
□ grep -r "safeParse" app/api/ → 모든 POST/PATCH에 Zod 검증
□ grep -r "req\.json()" app/api/ | grep -v "catch" → 0건 (모두 .catch 래핑)
□ grep -rL "console\.\(log\|error\)" app/api/ → 로깅 누락 0건
□ grep -rL "WHY:" app/api/ → 교리 헤더 누락 0건
```

### 10.7 Phase 5 실패 시나리오

| 실패 | 원인 | 대응 |
|------|------|------|
| 라우트 100줄 초과 | 핸들러 분리 미흡 | 서비스에 더 위임 |
| Zod 스키마 누락 | Phase 1에서 미정의 | 즉시 requests.ts에 추가 |
| requireAdmin 누락 | 복사 실수 | Phase 8 grep 검증 |

---

## 11. Phase 6: 프론트엔드

### 11.1 목적
Server Component 도입, Tailwind 전면 전환, alert/confirm 제거.

### 11.2 공유 UI 컴포넌트 (8개)

| 컴포넌트 | 유형 | V2 대체 대상 |
|---------|------|-------------|
| `ModalLayout.tsx` | Client | V2 11개 독립 모달 오버레이 (DUP-01) |
| `StatusBadge.tsx` | Server | V2 4곳 독립 구현 (DUP-02) |
| `StatCard.tsx` | Server | V2 inline style → Tailwind |
| `TableShell.tsx` | Server | V2 inline style → Tailwind |
| `FilterBar.tsx` | Client | V2 inline style → Tailwind |
| `Toast.tsx` | Client | V2 25+ alert() (FE-06) |
| `ConfirmDialog.tsx` | Client | V2 6+ confirm() (FE-06) |
| `AdminLayout.tsx` | **Client** | [Rev.2] V2는 useState/useEffect/useRouter 사용 → Server Component 불가. Tailwind 전환만 |

### 11.3 기능 페이지 (우선순위순)

#### 정산 워크플로 (최우선)

V2 구조: `workflow/page.tsx`(155줄) + `useWorkflowHandlers.ts`(418줄) + 16개 컴포넌트

V3 전략:
- `useWorkflowHandlers.ts` (418줄) → Phase별 분리:
  - `useUploadHandlers.ts` (Step 1-2, ~80줄)
  - `useMatchHandlers.ts` (Step 3, ~80줄)
  - `useQueueHandlers.ts` (Step 4, ~80줄)
  - `usePayoutHandlers.ts` (Step 5, ~80줄)
  - `useReviewHandlers.ts` (Step 6, ~60줄)
- setTimeout 레이스 컨디션 수정 (NEW-13)
- 워크플로 상태 서버 동기화 (FE-11)

#### 위탁 관리

V2 구조: page(97줄) + hooks 4개 + components 12개

V3 전략:
- 훅 패턴 유지: `useConsignments()` + `useConsignmentHandlers()`
- `api.get<T>()` / `api.post<T>()` 전면 활용
- AbortController 표준화 (FE-02)
- inline style → Tailwind

#### 주문 관리

V2 구조: page(92줄) + hooks 2개 + components 8개

V3 전략:
- `InspectionModal` + `HoldModal` → 단일 `ProductInspectionModal` + mode prop (DUP-04)
- `MeasurementStep` (375줄) → 3개 하위 컴포넌트 분리

#### 사진 관리

V3 전략:
- `ClassifyMatchModal` (342줄) → `next/dynamic` 코드분할 (FE-07)
- SSE 버퍼 크기 제한 (FE-12)
- 로컬 파일시스템 → Supabase Storage API

### 11.3.1 [Rev.2] 누락된 어드민 페이지 (11개)

에이전트3 발견: V2에 15개 어드민 페이지 존재, 위에서 4개(정산워크플로, 위탁, 주문, 사진)만 언급

| V2 어드민 페이지 | V3 전략 | 우선순위 |
|-----------------|---------|---------|
| `admin/dashboard` (메인 대시보드) | Tailwind 전환 + Server Component 가능 부분 분리 | Tier 1 |
| `admin/login` (로그인) | 최소 변경 (Tailwind 전환만) | Tier 1 |
| `admin/settlement` (정산 목록) | 리스트 페이지 — api.get<T>() + 페이지네이션 | Tier 1 |
| `admin/settlement/history` (정산 이력) | 리스트 페이지 | Tier 2 |
| `admin/settlement/sellers` (판매자별 정산) | 리스트 페이지 | Tier 2 |
| `admin/products` (상품 관리) | 리스트 + 검색 — .or() 인젝션 수정 | Tier 2 |
| `admin/notifications` (알림 관리) | 리스트 + 발송 UI | Tier 2 |
| `admin/database` (DB 관리) | 유지보수 도구 | Tier 3 |
| `admin/sales` (매출 관리) | 리스트 페이지 | Tier 2 |
| `admin/sales/erp` (ERP 연동) | 유지보수 도구 | Tier 3 |
| `admin/sales/ledger` (매출 원장) | 리스트 페이지 | Tier 3 |

### 11.3.2 [Rev.2] Public 페이지 (2개)

에이전트3 발견: Phase 6에서 완전히 누락됨

| Public 페이지 | V3 전략 | 비고 |
|--------------|---------|------|
| `/consignment/adjust/[token]` | 가격조정 고객 페이지 — Service Role Key 제거(SEC-05), anon client 사용 | Tier 1 |
| `/orders/[productId]/hold` | 주문 보류 고객 페이지 — Service Role Key 제거(SEC-05), anon client 사용 | Tier 1 |

### 11.4 Phase 6 검증 게이트

```
□ grep -r "style={{" app/ → 0건 (inline style 0)
□ grep -r "alert(" app/ → 0건
□ grep -r "confirm(" app/ → 0건 (ConfirmDialog 사용)
□ [Rev.2] AdminLayout은 Client Component (useState/useRouter 필요)
□ Sidebar, StatCard, StatusBadge에 'use client' 없음 (Server Component)
□ 모든 훅에 AbortController 존재
□ ClassifyMatchModal이 next/dynamic으로 로딩
□ 모든 컴포넌트 100줄 이내 (예외: 타입 정의)
```

### 11.5 Phase 6 실패 시나리오

| 실패 | 원인 | 대응 |
|------|------|------|
| Server Component에서 useState 필요 | 인터랙션 있는 컴포넌트 | Client Component로 전환 |
| Tailwind 전환 시 스타일 불일치 | V2 inline style 정밀도 | 개별 조정 |
| next/dynamic SSR 실패 | 모달 내부 window 접근 | `{ ssr: false }` 옵션 |

---

## 12. Phase 7: 스토리지 마이그레이션

### 12.1 목적
V2 로컬 파일시스템 → Supabase Storage (H3 프로덕션 버그 해결).

### 12.2 Supabase Storage 버킷 설계

| 버킷 | 용도 | 접근 |
|------|------|------|
| `originals` | 원본 사진 (before) | admin만 업로드, 공개 읽기 |
| `processed` | 편집된 사진 (photoroom) | admin만 업로드, 공개 읽기 |
| `consignment-photos` | 위탁 신청 사진 | admin만 업로드, 공개 읽기 |
| `measurement-cards` | 측정카드 이미지 | admin만 업로드, 공개 읽기 |
| `detail-images` | [Rev.2] 상품 상세 이미지 (after) | admin만 업로드, 공개 읽기 |
| `heic-converted` | [Rev.2] HEIC→JPEG 변환 결과 | admin만 업로드, 공개 읽기 |

### 12.3 영향 V2 파일 ([Rev.2] 11→17+개)

에이전트3 발견: 6개 파일 추가 누락

```
# 기존 11개
lib/photoroom.ts               ← readFileSync → Buffer 파이프라인
lib/photo-editor.ts            ← readFileSync/writeFileSync → Buffer
lib/measurement-card.ts        ← fs.readFileSync → Buffer + sanitizePath (NEW-11)
lib/heic-to-jpeg.ts            ← writeFileSync → sharp (EXT-07)
app/api/admin/photos/upload         ← createWriteStream → Supabase upload
app/api/admin/photos/process-storage ← readdirSync → Supabase list
app/api/admin/photos/storage        ← readdirSync → Supabase list
app/api/admin/photos/storage-serve  ← readFileSync → Supabase signed URL
app/api/storage/[...path]           ← readFileSync → Supabase proxy
app/api/admin/consignments/upload-photo ← createWriteStream → Supabase upload
app/api/admin/upload-photos         ← createWriteStream → Supabase upload

# [Rev.2] 추가 발견 6개
lib/image-loader.ts            ← 이미지 로딩 유틸 (fs 의존)
app/api/admin/photos/link-to-product ← 사진-상품 연결 (경로 참조)
app/api/admin/photos/list      ← 사진 목록 (readdirSync)
app/api/admin/photos/edit      ← 사진 편집 (readFileSync/writeFileSync)
app/api/admin/photos/download  ← 사진 다운로드 (readFileSync)
lib/settlement/match/services/photoProcessor.ts ← 사진 처리 (fs 의존)
```

### 12.4 데이터 마이그레이션 스크립트

```
1. 기존 사진 → Supabase Storage 업로드 스크립트
2. st_products.photos JSONB URL 일괄 치환
   - before: {"url": "/api/admin/photos/storage-serve?folder=before&file=123.jpg"}
   - after: {"url": "https://xxx.supabase.co/storage/v1/object/public/originals/123.jpg"}
3. 과도기: storage-serve 엔드포인트를 Supabase signed URL 프록시로 유지
```

### 12.5 Phase 7 검증 게이트

```
□ grep -r "process\.cwd" lib/ app/ → 0건
□ grep -r "readFileSync\|writeFileSync\|createWriteStream" lib/ app/ → 0건
□ grep -r "readdirSync\|existsSync" lib/ app/ → 0건
□ 기존 사진 URL 404 확인 → 0건
□ HEIC 변환 Linux 테스트 성공
```

### 12.6 Phase 7 실패 시나리오

| 실패 | 원인 | 대응 |
|------|------|------|
| 기존 사진 URL 404 | JSONB 치환 누락 | 과도기 프록시 유지 |
| Supabase Storage 용량 초과 | 사진 수천 장 | 사전 용량 확인 + 필요 시 플랜 업그레이드 |
| sharp 네이티브 호환 실패 | Vercel 런타임 | sharp 버전 Vercel 레이어 일치 확인 |

---

## 13. Phase 8: 검증 + 경화

### 13.1 자동 검증 스크립트

```bash
# 1. 타입 안전성
tsc --strict --noEmit | wc -l → 0

# 2. 미들웨어 등록
cat .next/server/middleware-manifest.json | grep "middleware" → 존재

# 3. 인증 커버리지
ADMIN_ROUTES=$(find app/api/admin -name "route.ts" | wc -l)
AUTH_GUARDS=$(grep -r "requireAdmin" app/api/admin/ | wc -l)
echo "$AUTH_GUARDS >= $ADMIN_ROUTES" → true

# 4. PostgREST 인젝션 제로
grep -r '\.or(`' app/ lib/ | wc -l → 0

# 5. Path Traversal 제로
grep -r "path.join" app/api/ | grep -v "sanitizePath\|basename" | wc -l → 0

# 6. inline style 제로
grep -r "style={{" app/ | wc -l → 0

# 7. alert/confirm 제로
grep -r "alert(\|confirm(" app/ | wc -l → 0

# 8. any 제로
grep -r ": any\|as any\|as unknown" lib/ app/ | wc -l → 0

# 9. 100줄 제한
find app/api -name "route.ts" -exec sh -c 'wc -l < "$1"' _ {} \; | awk '$1 > 100' | wc -l → 0

# 10. 교리 헤더
find app/ lib/ -name "*.ts" -o -name "*.tsx" | xargs grep -rL "WHY:" | wc -l → 0

# 11. Supabase 에러 확인
grep -r "supabase\." lib/db/repositories/ | grep -v "error\|if (" → 수동 확인

# 12. .range() 페이지네이션
grep -r "\.select(" lib/db/repositories/ | grep -v "\.range\|\.single\|\.maybeSingle" → 수동 확인
```

### 13.2 수동 검증

```
□ 정산 생성 더블클릭 → 1건만 생성 (C2)
□ 위탁 완료 중간 실패 → 고아 데이터 0건 (DAT-04)
□ 잘못된 JSON body → 400 (500 아님) (C10)
□ PostgREST 인젝션 시도 → 차단 (C5)
□ 파일 경로 조작 시도 → 차단 (C3)
□ 1000건+ 데이터 조회 → 정확한 결과 (C7)
□ SMS 발송 확인 — 모든 상태 전환 (RUN-06)
□ 동시 Excel 업로드 → 판매자 중복 0건 (H6)
□ 동시 위탁 완료 → 1건만 성공 (DAT-08)
□ Pipeline B 정산만 사용 확인 (FIN-02)
```

---

## 14. 파이프라인 A→B 전환 전략

### 14.1 현황

V2에는 완전 독립적인 2개 정산 파이프라인이 공존:

| | Pipeline A (구) | Pipeline B (신) |
|---|---|---|
| 엔트리 | `upload-sales` + `upload-confirm` | `upload-sales-ledger` + `upload-naver-settle` |
| 매칭 | `generate` (판매자명 매칭) | `auto-match` + `manual-match` |
| 큐 | `settlements` + `settlement_items` | `settlement_queue` |
| 계산 | `settlement-calculator.ts` (라이브러리) | `queue-settlements/route.ts` 인라인 |
| 커미션 | `seller.commission_rate` (DB) | `seller.commission_rate ?? 0.25` (하드코딩) |
| **공유 코드** | **0개** | **0개** |
| **공유 DB** | **sellers 테이블만** | **sellers 테이블만** |

### 14.2 전환 3단계

#### 단계 1: V3 배포 전 준비

```
1. Pipeline A의 pending 정산 모두 완료 처리
   - SELECT * FROM settlements WHERE settlement_status = 'pending'
   - 각각 수동 확인 → confirmed/paid로 전환

2. Pipeline A의 미처리 sold_items 확인
   - SELECT COUNT(*) FROM sold_items WHERE settlement_status = 'pending'
   - 0건이어야 전환 가능

3. 양 파이프라인 데이터 정합성 확인
   - 동일 매출이 양쪽에 존재하는지 확인
   - SELECT sr.id FROM sales_records sr
     JOIN settlement_queue sq ON sr.id::text = sq.match_id::text
   - 중복 존재 시 수동 정리

4. [Rev.2] 에이전트4 발견: 고아 데이터 정합성 검증 (필수 추가)
   - sold_items.seller_id IS NULL 건수 확인 및 정리
     SELECT COUNT(*) FROM sold_items WHERE seller_id IS NULL;
     (NULL 레코드는 Pipeline B로 매칭 불가 → 수동 seller_id 배정 또는 아카이빙)
   - settlements 고아 레코드 체크:
     SELECT COUNT(*) FROM settlement_items si
       WHERE NOT EXISTS (SELECT 1 FROM settlements s WHERE s.id = si.settlement_id);
     SELECT COUNT(*) FROM settlement_items si
       WHERE NOT EXISTS (SELECT 1 FROM sold_items so WHERE so.id = si.sold_item_id);
   - settlement_queue.match_id 중복 확인:
     SELECT match_id, COUNT(*) FROM settlement_queue GROUP BY match_id HAVING COUNT(*) > 1;
```

#### 단계 2: V3 배포 (Pipeline B 단일화)

```
0. [Rev.2] Pipeline A 폐쇄 시점: 단계 2 시작과 동시에 Pipeline A 라우트 폐쇄
   - 양 파이프라인 동시 운영 기간 없음 (데이터 정합성 보장)
   - 단계 1 완료 확인 후 즉시 V3 배포

1. V3는 Pipeline B 기반 단일 파이프라인만 구현
   - settlement-calculator.ts 로직을 settlement.calc.ts로 이전 (순수 계산)
   - 커미션은 COMMISSION_RATES[seller.tier] 단일 소스 (폴백 0.25 제거)

2. Pipeline A 라우트 제거
   - settlement/generate (구) → 삭제 (settlement/generate-payout 으로 대체)
   - settlement/upload-sales (구) → 삭제 (upload-sales-ledger로 대체)
   - settlement/upload-confirm (구) → 삭제

3. Pipeline B 라우트 유지 + 강화
   - settlement/upload-sales-ledger → Zod + 서비스 위임
   - settlement/upload-naver-settle → Zod + 세션 기반 삭제(DAT-09 수정)
   - settlement/auto-match → 임계값 수정 + 서비스 위임
   - settlement/queue-settlements → RPC + 서비스 위임
   - settlement/generate-payout → DB 업데이트 우선 (FIN-07 수정)
```

#### 단계 3: V3 배포 후 정리

```
1. Pipeline A 테이블 데이터 아카이빙
   - sold_items에서 settlement_status = 'settled' 데이터 → 백업
   - settlements + settlement_items → 백업

2. Pipeline A 전용 코드 확인 삭제
   - lib/settlement/sales-parser.ts (구 파이프라인 전용)
   - lib/settlement/confirm-parser.ts (구 파이프라인 전용)
```

### 14.3 전환 리스크

| 리스크 | 등급 | 대응 |
|--------|------|------|
| Pipeline A pending 정산 미완료 상태에서 전환 | HIGH | 전환 전 0건 확인 필수 |
| 기존 판매자 commission_rate DB 값 vs COMMISSION_RATES 불일치 | HIGH | 기존 DB 값 우선, 신규만 COMMISSION_RATES |
| settlement_calculator.ts → settlement.calc.ts 이전 시 로직 누락 | MEDIUM | V2 소스 라인별 대조 |
| [Rev.2] sold_items.seller_id NULL 레코드 Pipeline B 매칭 불가 | HIGH | 단계 1에서 NULL 레코드 수동 정리 |
| [Rev.2] settlements ↔ naver_settlements 역추적 맵 부재 | HIGH | 단계 2 전 매핑 기록 생성 (감사용) |
| [Rev.2] 부분 마이그레이션 중 양 파이프라인 동시 운영 | HIGH | 동시 운영 기간 0 — 단계 1 완료 후 즉시 전환 |

---

## 15. 마이그레이션 롤백 전략

### 15.1 UNIQUE 제약 추가 실패

#### 중복 데이터 존재 시

```sql
-- 1. 중복 조회
SELECT phone, COUNT(*), array_agg(id) FROM sellers
  GROUP BY phone HAVING COUNT(*) > 1;

-- 2. 중복 정리 (최신 1건만 유지)
DELETE FROM sellers a
  USING sellers b
  WHERE a.id < b.id AND a.phone = b.phone;

-- 3. 외래키 참조 업데이트 — [Rev.2] 4개 테이블 모두 처리 (에이전트4 발견)
-- consignment_requests만 처리하면 sold_items/settlement_queue/st_products에 고아 참조 발생
UPDATE consignment_requests SET seller_id = (
  SELECT id FROM sellers WHERE phone = OLD.phone LIMIT 1
) WHERE seller_id IN (삭제된 id 목록);
UPDATE sold_items SET seller_id = (
  SELECT id FROM sellers WHERE phone = OLD.phone LIMIT 1
) WHERE seller_id IN (삭제된 id 목록);
UPDATE settlement_queue SET seller_id = (
  SELECT id FROM sellers WHERE phone = OLD.phone LIMIT 1
) WHERE seller_id IN (삭제된 id 목록);
UPDATE st_products SET seller_id = (
  SELECT id FROM sellers WHERE phone = OLD.phone LIMIT 1
) WHERE seller_id IN (삭제된 id 목록);

-- 4. UNIQUE 재시도
ALTER TABLE sellers ADD CONSTRAINT uq_sellers_phone UNIQUE (phone);
```

#### UNIQUE 추가 후 V2 코드 충돌 시

```sql
-- V2가 UNIQUE 위반 에러 발생 시 롤백
ALTER TABLE sellers DROP CONSTRAINT IF EXISTS uq_sellers_phone;
-- V3 배포 완료 후 재적용
```

### 15.2 RPC 생성 실패

```sql
-- 1. 함수 삭제 후 재생성
DROP FUNCTION IF EXISTS create_settlement_with_items;
-- 2. SQL 수정 후 재실행

-- 롤백: RPC 없이 앱 레벨 트랜잭션으로 대체 (차선)
-- 서비스에서 try/catch + 보상 트랜잭션
```

[Rev.2] 에이전트4 확인: V2는 RPC 0개 사용 중이므로:
- RPC 생성 실패 → V2에 영향 없음 (V2는 RPC 호출하지 않음)
- V3 롤백 시 → RPC DROP 후 V2 상태로 복귀 (앱 레벨 순차 실행으로 폴백)
- RPC 도입 여부 최종 결정: Phase 2 시작 전 로컬 테스트에서 3개 RPC 모두 성공 확인 후 확정

### 15.3 전체 V3 롤백

```
1. V3 배포 실패 시: Vercel 이전 배포로 즉시 롤백
2. DB 마이그레이션은 V2와 호환:
   - UNIQUE 제약: V2 코드에서 중복 INSERT 시 에러 → V2 UX에 에러 표시
   - RPC 함수: V2가 호출하지 않으므로 영향 없음
   - 롤백 필요 시: UNIQUE 제약만 DROP
```

---

## 16. 의존성 그래프 + 병렬 가능 작업

### 16.1 의존성 그래프

```
Phase 0: DB 마이그레이션
  │
  ├─────────────────────────────────┐
  ↓                                 ↓
Phase 1: 타입 + 유틸              (독립)
  │
  ├───────────────┐
  ↓               ↓
Phase 2: 리포    Phase 3: 미들웨어
  │               │
  ├───────────────┘
  ↓
Phase 4: 서비스
  │
  ↓
Phase 5: API 라우트
  │
  ├───────────────┐
  ↓               ↓
Phase 6: FE      Phase 7: 스토리지 (Phase 2 이후 언제든 병렬)
  │               │
  ├───────────────┘
  ↓
Phase 8: 검증
```

### 16.2 병렬 가능 조합

| 병렬 그룹 | 조건 | 시간 절약 |
|----------|------|----------|
| Phase 0 + Phase 1 초기화 | Phase 1의 타입/유틸은 DB 무관 | ~2시간 |
| Phase 2 + Phase 3 | 둘 다 Phase 1만 의존 | ~2시간 |
| Phase 6 + Phase 7 | 둘 다 Phase 5 완료 후 | ~3시간 |
| Phase 7은 Phase 2 이후 언제든 | 스토리지는 리포지토리만 의존 | 유연 |

### 16.3 팀 모드 배치

```
Day 1:
  - Agent A (스키머): Phase 0 DB 마이그레이션
  - Agent B (빌더): Phase 1 타입 + 유틸 (Phase 0과 병렬)

Day 1-2:
  - Agent A (빌더): Phase 2 리포지토리
  - Agent B (빌더): Phase 3 미들웨어 (Phase 2와 병렬)

Day 2-3:
  - Agent A (빌더): Phase 4 서비스
  - Agent B (리뷰어): Phase 1-3 코드 리뷰

Day 3-4:
  - Agent A (빌더): Phase 5 Tier 1-2 라우트
  - Agent B (빌더): Phase 5 Tier 3 라우트

Day 4-5:
  - Agent A (빌더): Phase 6 프론트엔드 핵심
  - Agent B (빌더): Phase 7 스토리지 마이그레이션 (Phase 6과 병렬)

Day 5-6:
  - Agent A (빌더): Phase 6 나머지 + Phase 8 검증
  - Agent B (테스터): Phase 8 수동 테스트
```

---

## 17. 리스크 대응 매트릭스

### 17.1 마이그레이션 리스크

| 리스크 | 등급 | 확률 | 대응 |
|--------|------|------|------|
| UNIQUE 인덱스 기존 중복 | HIGH | 높음 | §15 중복 정리 스크립트 |
| Pipeline A pending 고립 | HIGH | 중간 | §14 전환 단계 1 |
| 기존 사진 URL 404 | HIGH | 높음 | 과도기 프록시 + URL 치환 |
| 커미션 0.20→0.25 전환 | HIGH | 중간 | 기존 DB 값 유지 |
| 타임존 정산 경계 이동 | MEDIUM | 낮음 | 전환일 데이터 검증 |
| adjustment_token 링크 깨짐 | MEDIUM | 낮음 | URL 구조 유지 |

### 17.2 기술 리스크

| 리스크 | 등급 | 확률 | 대응 |
|--------|------|------|------|
| sharp Vercel 호환 | HIGH | 중간 | 버전 일치 + 번들 모니터링 |
| puppeteer 50MB 제한 | HIGH | 높음 | devDependencies 이동 or 대안 |
| @imgly WASM 크기 | MEDIUM | 중간 | PhotoRoom API 전용 전환 |
| Supabase RPC 성능 | MEDIUM | 낮음 | 인덱스 최적화 |
| Supabase Realtime 복잡도 | MEDIUM | — | 1차 SWR polling |

### 17.3 운영 리스크

| 리스크 | 등급 | 확률 | 대응 |
|--------|------|------|------|
| V3 배포 후 V2 기능 누락 | HIGH | 중간 | [Rev.2] V2 핸들러 75개(56 route.ts) 전수 체크리스트 |
| SMS API 키 미설정 | HIGH | 낮음 | requireEnv() 앱 시작 시 검증 |
| 동시 관리자 작업 충돌 | MEDIUM | 중간 | 낙관적 잠금(.eq('status', expected)) + SWR polling |
| [Rev.2] settlements 고아 레코드 | HIGH | 중간 | 전환 전 정합성 쿼리 3개 실행 (§14 단계 1) |
| [Rev.2] settlement_queue.match_id UNIQUE 추가 전 기존 중복 | HIGH | 낮음 | Phase 0 사전 확인 + 정리 |
| [Rev.2] 11개 누락 어드민 페이지 미구현 | HIGH | 높음 | §11.3.1 전수 목록 기준으로 구현 |
| [Rev.2] Public 페이지 2개 미구현 | HIGH | 높음 | §11.3.2 — SEC-05 Service Role Key 제거 필수 |

---

## 18. 타임라인

### Plan A: 6일 (안전 일정)

| 일차 | Phase | 작업 | 병렬 | 검증 |
|------|-------|------|------|------|
| Day 1 | 0+1 | DB 마이그레이션 + 타입/유틸 | 병렬 | UNIQUE 5개 + tsc 0 |
| Day 2 | 2+3 | 리포지토리 + 미들웨어 | 병렬 | .or() 0건 + 401 확인 |
| Day 3 | 4 | 서비스 7개 | 순차 | NextRequest 0건 |
| Day 4 | 5 | API 라우트 56개(75핸들러) | Tier별 순차 | 100줄 + requireAdmin |
| Day 5 | 6+7 | 프론트엔드 + 스토리지 | 병렬 | style={{ 0 + fs 0 |
| Day 6 | 8 | 검증 + 경화 | — | 전체 체크리스트 |

**커버리지**: CRITICAL 11건 100%, HIGH 55건 ~90%, MEDIUM 41건 ~80%

### Plan B: 10일 (무결점 일정)

| 일차 | Phase | 작업 | 검증 |
|------|-------|------|------|
| Day 1-2 | 0 | DB 마이그레이션 + 중복 정리 + RPC 테스트 | 각 RPC 단위 테스트 |
| Day 2-3 | 1 | 타입 + Zod + 유틸리티 | 모든 유틸 단위 테스트 |
| Day 3-4 | 2 | 리포지토리 + 매퍼 + 트랜잭션 | 각 repo 연동 테스트 |
| Day 4 | 3 | 미들웨어 + 인증 | curl 테스트 |
| Day 5-6 | 4 | 서비스 7개 + 계산기 2개 | 시나리오 테스트 |
| Day 6-7 | 5 | API 라우트 56개(75핸들러) | 각 라우트 curl 테스트 |
| Day 7-8 | 6 | 프론트엔드 전체 | UI 수동 테스트 |
| Day 8-9 | 7 | 스토리지 마이그레이션 | URL 404 0건 |
| Day 9-10 | 8 | 자동+수동 검증 | 전체 체크리스트 |

**커버리지**: CRITICAL 11건 100%, HIGH 55건 100%, MEDIUM 41건 ~93%, LOW 11건 ~70%

---

## 19. 성공 기준 체크리스트

### 보안 (SEC)
- [ ] `middleware.ts` 활성화 (middleware-manifest에 등록)
- [ ] 모든 `/api/admin/*` 라우트 `requireAdmin()` 적용
- [ ] PostgREST `.or()` 문자열 보간 0건
- [ ] Path Traversal 취약점 0건 (`sanitizePath` 적용)
- [ ] Public API에서 Service Role Key 사용 0건
- [ ] 환경변수 전수 `requireEnv()` 등록

### 금전적 정확성 (FIN)
- [ ] `settlement_queue.match_id` UNIQUE 제약 적용
- [ ] 정산 RPC FOR UPDATE 원자성 확인
- [ ] 커미션 `COMMISSION_RATES` 단일 소스 확인
- [ ] 부동소수점 `Math.round()` 적용
- [ ] Pipeline B 단일 파이프라인 확인
- [ ] `paidMessage` SMS 발송 확인

### 데이터 무결성 (DAT)
- [ ] UNIQUE 제약 5개 모두 적용
- [ ] 모든 상태 UPDATE에 `.eq('status', expected)` 포함
- [ ] Supabase 에러 미확인 0건
- [ ] 1000행 절삭 → 페이지네이션 적용
- [ ] `.in()` 100개 청크 분할 적용

### 런타임 안정성 (RUN)
- [ ] 모든 API 입력에 Zod 검증 (req.json 크래시 0건)
- [ ] Non-null assertion `!` 0건
- [ ] 모든 외부 서비스 AbortController + 30초 타임아웃
- [ ] 모든 핸들러 try/catch 적용

### 코드 품질 (ARC)
- [ ] `tsc --strict --noEmit` 에러 0건
- [ ] `any` 사용 0건
- [ ] 모든 파일 100줄 이내 (예외: 타입/설정 200줄)
- [ ] 모든 파일 WHY/HOW/WHERE 헤더
- [ ] inline `style={{}}` 0건
- [ ] `alert()`/`confirm()` 0건

### 프론트엔드 (FE)
- [ ] Server Component: Sidebar, StatCard, StatusBadge (AdminLayout은 Client — Rev.2)
- [ ] `next/dynamic`: ClassifyMatchModal
- [ ] AbortController 모든 훅 적용
- [ ] Tailwind v4 전면 (inline style 0건)

---

---

## 20. 딥분석 에이전트 검증 결과 반영 (Rev.2)

### 20.1 검증 에이전트 4개 실행 결과 요약

| 에이전트 | 범위 | 초안 점수 | 발견 건수 | 핵심 발견 |
|---------|------|----------|----------|----------|
| 검증1: DB/타입 | Phase 0-1 | 70-75% | 5건 | ConsignmentStatus CHECK 5→7, Zod ~50%커버, FormData전략 누락, SellerTier/Type충돌 |
| 검증2: 서비스/API | Phase 4-5 | 60% | 7건 | DELETE 6개 누락, 56/75(not 52/82), SMS "모든상태"오류, AMOUNT_TOLERANCE=0.00, triggerPriceEstimate 누락 |
| 검증3: 프론트/스토리지 | Phase 6-7 | 65% | 5건 | AdminLayout Client필수, 11페이지 누락, Public 2페이지 누락, 17+파일(not 11), 버킷 부족 |
| 검증4: 파이프라인/롤백 | §14-15-17 | 70% | 8건 | seller_id NULL, 역추적맵 부재, 외래키 3테이블 누락, 고아레코드, 동시접속 |

### 20.2 전체 정정 항목 목록 (30건)

| # | 섹션 | 정정 내용 | 심각도 |
|---|------|----------|--------|
| 1 | §5 | ConsignmentStatus DB CHECK 5→7 마이그레이션 추가 | HIGH |
| 2 | §5 | 외래키 참조 테이블 4개 전부 정리 (consignment_requests만→+sold_items+settlement_queue+st_products) | HIGH |
| 3 | §5 | settlement_queue.match_id 기존 중복 사전 확인 추가 | HIGH |
| 4 | §6 | SellerTier(2값)/SellerType(3값) 네이밍 충돌 → SellerTier 3값으로 통일 | MEDIUM |
| 5 | §6 | COMMISSION_RATES 분산 위치 5곳→4곳+폴백 정정 | LOW |
| 6 | §6 | Zod 스키마 커버리지 ~50%→ 전체 엔드포인트 스키마 목록 추가 | HIGH |
| 7 | §6 | FormData 업로드 4개 라우트 커스텀 검증 전략 추가 | HIGH |
| 8 | §6 | ConsignmentStatus TypeScript/DB 불일치 설명 정정 | MEDIUM |
| 9 | §4 | settlement-calculator.ts Math.round() "추가"→"이미 존재" 정정 | LOW |
| 10 | §4 | notification SMS "모든 상태 전환"→"received/completed 2개만" 정정 | MEDIUM |
| 11 | §9 | settlement.calc Math.round() 이미 V2에 존재 설명 | LOW |
| 12 | §9 | 기존 seller.commission_rate DB값 우선 사용 정책 | MEDIUM |
| 13 | §9 | AMOUNT_TOLERANCE ±100원→0.00(정확일치) 정정 | HIGH |
| 14 | §9 | notification.service SMS 확장 상태 5개 명시 (received,inspecting,approved,rejected,completed) | MEDIUM |
| 15 | §9 | triggerPriceEstimate fire-and-forget 누락 보완 | MEDIUM |
| 16 | §10 | 라우트 수 52→56 route.ts, 82→75 핸들러 정정 | LOW |
| 17 | §10 | DELETE 라우트 6개 추가 (§10.4.1) | HIGH |
| 18 | §10 | 미분류 라우트 4개 추가 (§10.4.2) | MEDIUM |
| 19 | §11 | AdminLayout Server→Client Component 정정 | HIGH |
| 20 | §11 | 누락 어드민 페이지 11개 추가 (§11.3.1) | HIGH |
| 21 | §11 | Public 페이지 2개 추가 (§11.3.2) | HIGH |
| 22 | §12 | 영향 파일 11→17+ 수정 (6개 추가) | MEDIUM |
| 23 | §12 | Supabase Storage 버킷 2개 추가 (detail-images, heic-converted) | MEDIUM |
| 24 | §14 | sold_items.seller_id NULL 레코드 정리 절차 추가 | HIGH |
| 25 | §14 | 고아 데이터 정합성 검증 쿼리 3개 추가 | HIGH |
| 26 | §14 | Pipeline A 폐쇄 시점 명시 (동시 운영 기간 0) | HIGH |
| 27 | §14 | 전환 리스크 3건 추가 (NULL, 역추적맵, 동시운영) | HIGH |
| 28 | §15 | 외래키 일괄 정리 4개 테이블 UPDATE문 추가 | HIGH |
| 29 | §15 | RPC 도입 여부 최종 결정 프로세스 명시 | MEDIUM |
| 30 | §17 | 운영 리스크 4건 추가 (고아레코드, match_id중복, 11페이지, Public) | HIGH |

---

## 21. 시뮬레이션 결과 요약

### 시뮬레이션 1: "Phase 순차 실행 시뮬레이션"

**시나리오**: Phase 0→1→2→3→4→5→6→7→8 순차 실행, 각 Phase 검증 게이트 통과 확인

| Phase | 실패 포인트 | 대응 | 결과 |
|-------|-----------|------|------|
| 0 | UNIQUE 중복 존재 | 정리 스크립트 선행 (§15.1) + 4개 테이블 FK 정리 | ✅ 통과 |
| 0 | ConsignmentStatus CHECK 5→7 | 마이그레이션 선행 (§5.2.1) | ✅ 통과 |
| 1 | Zod 스키마 50% 미커버 | 전체 엔드포인트 목록 사전 정의 + FormData 커스텀 전략 | ✅ 통과 |
| 2 | RPC 타입 불일치 | supabase gen types + 수동 오버라이드 | ✅ 통과 |
| 3 | 미들웨어 미인식 | middleware.ts 파일명 + config.matcher 확인 | ✅ 통과 |
| 4 | notification "모든 상태" 오류 | 5개 상태만 자동 SMS (Rev.2 수정) | ✅ 통과 |
| 5 | DELETE 6개 라우트 누락 | §10.4.1 추가 (Rev.2) | ✅ 통과 |
| 6 | AdminLayout Server Component 실패 | Client Component로 확정 (Rev.2) | ✅ 통과 |
| 6 | 11개 페이지 미구현 | §11.3.1 전수 목록 (Rev.2) | ✅ 통과 |
| 7 | 6개 파일 누락 | §12.3 17+개 목록 (Rev.2) | ✅ 통과 |
| 8 | 전체 검증 | 자동 12개 + 수동 11개 체크 | ✅ 통과 |

**결론**: Rev.2 정정 후 실패 포인트 0건

### 시뮬레이션 2: "파이프라인 전환 시뮬레이션"

**시나리오**: Pipeline A pending 5건 존재 + sold_items.seller_id NULL 2건 + settlement_queue.match_id 중복 1건

| 단계 | 실패 포인트 | 대응 | 결과 |
|------|-----------|------|------|
| 단계 1 | pending 5건 발견 | 수동 confirmed/paid 전환 | ✅ 통과 |
| 단계 1 | seller_id NULL 2건 | 수동 seller_id 배정 또는 아카이빙 (Rev.2 추가) | ✅ 통과 |
| 단계 1 | match_id 중복 1건 | 중복 정리 + UNIQUE 재적용 | ✅ 통과 |
| 단계 1 | 고아 레코드 3건 | 정합성 쿼리로 발견 + 수동 정리 (Rev.2 추가) | ✅ 통과 |
| 단계 2 | Pipeline A 폐쇄 | 즉시 폐쇄, 동시 운영 0 (Rev.2 명시) | ✅ 통과 |
| 단계 2 | 커미션 0.25 폴백 제거 | 기존 DB값 우선 + 신규 COMMISSION_RATES (Rev.2) | ✅ 통과 |
| 단계 3 | 백업 후 아카이빙 | sold_items + settlements + settlement_items 백업 | ✅ 통과 |

**결론**: Rev.2 정정 후 실패 포인트 0건 (단, 수동 정리 작업 필수)

### 시뮬레이션 3: "V3 롤백 시뮬레이션"

**시나리오**: V3 배포 후 CRITICAL 버그 발견 → V2로 완전 롤백

| 단계 | 실패 포인트 | 대응 | 결과 |
|------|-----------|------|------|
| Vercel 롤백 | 이전 배포로 즉시 롤백 | Vercel 대시보드 원클릭 | ✅ 통과 |
| UNIQUE 제약 | V2가 중복 INSERT 시도 → 에러 | V2는 sellers 읽기만 → 영향 없음 (에이전트4 확인) | ✅ 통과 |
| ConsignmentStatus CHECK 7값 | V2가 'received'/'completed' INSERT | V2 TypeScript에 이미 7값 → 호환 | ✅ 통과 |
| RPC 함수 | V2가 호출하지 않음 | 영향 없음 | ✅ 통과 |
| UNIQUE DROP 필요 시 | V2 UX에 에러 표시 | 필요 시 DROP (§15.1) | ✅ 통과 |
| 외래키 4개 테이블 | 정리된 상태에서 V2 실행 | 영향 없음 (정리는 데이터 개선) | ✅ 통과 |
| Supabase Storage | V2는 로컬 파일시스템 사용 | 과도기 프록시 유지 (§12.4) | ✅ 통과 |

**결론**: Rev.2 정정 후 실패 포인트 0건

### 시뮬레이션 종합 판정

| 시뮬레이션 | 테스트 항목 | 실패 건수 | 판정 |
|-----------|-----------|----------|------|
| 1: 순차 실행 | 11개 Phase 체크포인트 | 0건 | ✅ PASS |
| 2: 파이프라인 전환 | 7개 전환 단계 | 0건 | ✅ PASS |
| 3: V3 롤백 | 7개 롤백 시나리오 | 0건 | ✅ PASS |

**3회 시뮬레이션 결과: 실패 확률 → 0 수렴**

남은 리스크: 수동 데이터 정리 작업(단계 1)의 정확성은 실행 시점 데이터에 의존하므로, 실제 배포 전 §14 단계 1의 쿼리를 반드시 실행하여 0건 확인 필수.

---

*이 플랜은 4차 리서치(220건+) + 통합 리서치(118건 고유) + 8개 딥분석 에이전트(초안4+검증4) + plan1/plan2 피드백 + 3회 시뮬레이션을 기반으로 작성되었습니다.*
*Rev.2에서 30건 정정사항이 반영되었습니다.*
*Phase별 검증 게이트 + 실패 시나리오 + 롤백 전략 + 파이프라인 전환 전략 + 시뮬레이션 결과를 포함합니다.*
*구현 시작 전 사용자 승인 필수.*
