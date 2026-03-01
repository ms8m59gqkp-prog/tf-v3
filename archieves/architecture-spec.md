# 시스템 아키텍처 핵심 흐름 (plan4.md §1 기준)

## 1) 3+1 레이어 구조 요약
- L3 (Entry/Boundary): Next.js App Router의 route/page/middleware
- L1 (Business): 서비스 레이어 + 레포지토리/트랜잭션 + 도메인 타입/유틸
- L0 (Infra): supabase client/admin, env, auth, ratelimit 등 인프라 유틸
- + Supabase(Postgres): 테이블/RLS/RPC/인덱스/Storage

핵심 원칙:
- 라우트는 얇게(≈100줄), 서비스가 오케스트레이션, RPC가 원자성(락) 보장
- 모든 의존성은 "위→아래" 단방향만 허용 (경계/순환 참조 금지)

---

## 2) 클라이언트(브라우저) 진입점
- Admin UI: app/admin/**/page.tsx (약 15개)
  - SWR fetch로 API 호출
- Public UI: /consignment/adjust, /orders/hold (약 2개)
  - anon 직접 접근 가능 (단, RLS로 제한)

---

## 3) L3: 엔트리포인트(경계) 구성
### middleware.ts
- 역할: CORS + 경로 라우팅/기본 경계 처리
- 주의: 비즈니스 로직/DB 로직 절대 넣지 않음

### app/api/**/route.ts (약 63개)
표준 파이프라인(4단계 고정):
1) requireAdmin(req) : 인증 (lib/api/middleware 계열)
2) Schema.safeParse() : Zod 입력 검증 (각 라우트 ./schema.ts)
3) service.xxx() : 서비스 호출/위임 (lib/services/)
4) ok(result) : 표준 응답 (lib/api/response)

라우트 금지 규칙:
- 서비스 레이어로 위임 없이 DB 직접 호출 금지
- NextRequest/NextResponse를 L1로 전달 금지
- 라우트에서 계산/상태머신/정산 로직 구현 금지

---

## 4) L1: 비즈니스 레이어(오케스트레이션)
### lib/services/ (핵심 7개)
- settlement.service.ts : 정산 생성/확정/지급
- matching.service.ts : 매출-상품 자동 매칭
- order.service.ts : 주문 상태 전환
- consignment.service.ts : 위탁 7단계 상태 관리
- notification.service.ts : SMS/알림 발송(Outbox/기록 포함)
- photo.service.ts : AI 분류 + 배치 처리
- sale-detector.service.ts : 판매 감지/후처리(연쇄 트리거)

서비스 레이어 원칙:
- "흐름/규칙/오케스트레이션"만 담당
- DB 접근은 repository/transaction/RPC로만 수행
- 순수 계산은 calculators로 분리 (테스트 가능해야 함)
- 외부 API 호출/알림 발송은 한 곳(service)에서만 제어 (중복 방지)

### DB 접근 레이어
- lib/db/repositories/ (약 9개): 테이블 단위 CRUD/쿼리
- lib/db/transactions/ (약 3개): 트랜잭션 경계/원자 처리
- RPC 3개(원자성 보장, 락 기반):
  - create_settlement
  - create_order
  - complete_consignment

도메인/유틸:
- lib/types/domain/ : 도메인 타입
- lib/calculators/ : 순수 계산(정산 등)
- lib/utils/ : 공용 유틸(순수/재사용 중심)

---

## 5) L0: 인프라 레이어(단일 진실)
- lib/supabase/admin.ts : service_role (어드민 API 전용)
- lib/supabase/client.ts : anon key (Public 페이지 전용)
- lib/env.ts : requireEnv() 환경변수 검증
- lib/auth.ts : HMAC-SHA256 세션 + bcrypt
- lib/ratelimit.ts : Upstash Rate Limiting

Infra 원칙:
- L0는 "기술/접속/보안 유틸"만 제공
- L0가 L1의 비즈니스 로직을 import하거나 호출하면 안 됨

---

## 6) Supabase(PostgreSQL) 구조적 제약
- 테이블 + RLS 정책 (anon 접근 제한)
- RPC 3개는 FOR UPDATE 잠금 기반으로 이중 처리 방지(예: 이중 정산)
- 인덱스(약 5개)로 풀스캔 방지
- Storage: 사진 다량(약 5,000장), Phase 7에서 마이그레이션 예정

---

## 7) 의존성 규칙 (절대 준수)
허용:
- L3 → L1 → L0 단방향 import

금지:
- L0 → L1 (✗)
- L1 → L3 (✗)
- L1(서비스) → NextRequest/NextResponse (✗ 절대 금지)
- 순환 참조 (✗)

---

## 8) 요청 흐름 예시: 정산 생성 (표준 레퍼런스)
POST /api/settlement/generate
1) middleware.ts : CORS 체크
2) requireAdmin(req) : HMAC 세션 검증
3) GenerateSettlementSchema.safeParse(body) : Zod 검증
4) settlementService.generate(data)
   - soldItemsRepo.findPendingBySeller() : .range() 페이징
   - settlementCalc.calculate() : 순수 계산
   - RPC create_settlement_with_items() : FOR UPDATE 잠금
     - INSERT settlements
     - INSERT settlement_items
     - UPDATE sold_items SET status='settled'
5) ok({ settlements: [result] }) : 표준 JSON 응답

---

## 9) 위험 신호(이러면 구조가 무너짐)
- 라우트에서 DB 직접 호출
- 서비스가 NextRequest/NextResponse를 받기 시작
- repository가 비즈니스 규칙(상태머신/정산)을 품기 시작
- 원자성 필요한 작업을 RPC/tx 없이 다중 쿼리로 처리
- L0에서 비즈니스 레이어 import 시도

이 징후가 보이면: 즉시 중단 → plan 재검토 → 레이어 복구
