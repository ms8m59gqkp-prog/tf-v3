# tf-v3 — Agent Ops Guide (v1.0)

목표: tf-v3에서 에이전트(또는 본인)가 작업할 때,
규칙 위반/누락/재작업을 없애고 "검증 가능한 산출물"로만 전진한다.

---

## 0) 필수 문서(읽는 순서)

1) docs/process-checklist.md  (PR/레벨 게이트: L1/L2/L3)
2) docs/phase-checklists.md   (Phase 게이트)
3) docs/architecture-spec.md  (3+1 레이어 / 금지 규칙)
4) docs/db-rpc-settlement-deep-checklist.md (L3 심화)

plan5.md는 "설계/일정/전략"의 원문 마스터로 둔다(필요 시 참조).

---

## 1) 작업 시작 루틴 (매 세션 동일)

### 1.1 오늘 작업 범위 선언
- 오늘의 범위는 Phase 기준으로 1개만 잡는다.
- 변경 레벨(L1/L2/L3)을 먼저 선언한다.

### 1.2 금지사항 3개 (즉시 실패)
- lib/services에서 NextRequest/NextResponse 사용
- supabase .or() 템플릿 리터럴 사용
- 이미지 경로 하드코딩 (/uploads/photos 등)

---

## 2) 브랜치/PR 운영 규칙 (안전 모드)

### 2.1 브랜치 규칙
- main은 항상 "빌드 가능한 상태" 유지.
- 기능 작업은 feature/* 브랜치에서만.
- L3(DB/RPC/정산/상태전이)는 반드시 별도 브랜치에서 진행.

### 2.2 PR 규칙
- PR에는 반드시:
  - 변경 레벨(L1/L2/L3) 표시
  - 체크리스트 체크(증거 포함)
  - verify 로그(가능하면)

---

## 3) 검증(증거) 규칙

### 3.1 기본(항상)
- tsc --noEmit
- eslint --max-warnings 0
- vitest run
- next build (최소 daily 1회 또는 Phase 8)

### 3.2 L3 추가(필수)
- DB 산출물: 쿼리 결과/스냅샷 1개 이상
- 동시성/멱등성 시나리오 1개 이상 증명
- RLS 실측(anon 토큰 유/무) 결과 1개 이상

---

## 4) 자동 검사 실행

루트에서:
- scripts/verify.sh
- scripts/grep-guards.sh

"verify가 통과하면, 최소한의 규칙 위반 가능성은 닫힌다."

---

## 5) 작업 단위 설계 원칙

- 라우트(route.ts)는 얇게: 인증 → 검증 → 서비스 위임 → 응답
- 서비스는 오케스트레이션만: 상태전이/정산 로직은 서비스에, DB접근은 repo에
- repo는 반드시 error 체크 / range / chunk / expected status

---

## 6) 병렬 작업(여러 에이전트/여러 작업) 시 규칙

- 공용 파일(lib/*, docs/*) 수정은 1명만(리드 역할)
- 각자 app/api 하위 디렉토리 단위로 분리해서 충돌 회피
- Cross-QA 완료 전 main merge 금지

---

## 7) 문제 발생 시 판단 기준(가장 흔한 것)

- CI 실패인데 로컬 통과 → 작업 디렉토리/락파일/캐시/경로 문제부터 의심
- "too many connections" → 코드 버그로 판단하지 말고 QA 동시 실행부터 줄이기
- RLS 문제 → 토큰 전달 방식/anon 정책/헤더 전달부터 실측

---

## 8) 마지막 원칙

코드는 믿지 않는다.
로그/DB 산출물/테스트만 믿는다.
"됐겠지"는 금지.
