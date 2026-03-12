tf-v3 — Architecture Specification (Agent-Enforced) v1.2

목적:
tf-v3 코드베이스의 구조를 고정하고,
레이어 침범 / 보안 경계 위반 / 구조 오염을 자동으로 판정 가능하게 만든다.

이 문서는 설명서가 아니다.
이 문서는 **구조 규약(Structural Constitution)**이다.
예외는 없다.

⸻

제1조. 레이어 모델 (3+1 구조)

1.1 레이어 정의

L0 — Infrastructure
L1 — Business Core
L2 — UI
L3 — Entry (API / Page)

Supabase는 외부 시스템으로 간주한다.

⸻

1.2 레이어 목적
	•	L0: 환경, 인증, 클라이언트 초기화, 속도 제한 등 기반 계층
	•	L1: 비즈니스 로직, 상태 전이, 계산, 트랜잭션 조합
	•	L2: 사용자 인터페이스
	•	L3: HTTP 진입점 (API / Page)

⸻

제2조. 의존성 규칙 (절대 규칙)

2.1 허용 의존 방향
	•	L3 → L1
	•	L2 → L3 (HTTP 호출만 허용)
	•	L1 → L0

⸻

2.2 금지 의존 방향
	•	L1 → L3 import
	•	L1 → NextRequest / NextResponse import
	•	L0 → L1 import
	•	동일 계층 간 순환 참조
	•	교차 레이어 역참조

위반 시: Architecture Violation

⸻

제3조. 파일 역할 고정

3.1 L0 (Infrastructure)
	•	env.ts
	•	supabase client
	•	auth
	•	ratelimit

⸻

3.2 L1 (Business Core)
	•	services
	•	repositories
	•	transactions
	•	calculators
	•	types
	•	utils

⸻

3.3 L2 (UI)
	•	components
	•	hooks

⸻

3.4 L3 (Entry)
	•	app/api/**/route.ts
	•	app/**/page.tsx

⸻

제4조. 서비스 규칙 (L1)

4.1 MUST
	•	서비스는 Next.js 객체를 모른다
	•	서비스는 HTTP 응답을 만들지 않는다
	•	서비스는 DB 직접 호출하지 않는다 (반드시 repo 경유)
	•	상태 전이는 서비스 계층에서만 정의된다

⸻

4.2 MUST NOT
	•	NextRequest import
	•	fetch 직접 호출
	•	response 생성
	•	route.ts 내부에 비즈니스 로직 작성

위반 시: FAIL

⸻

제5조. 리포지토리 규칙 (데이터 경계)

5.1 MUST
	•	모든 DB 에러 체크
	•	목록 조회는 .range() 필수
	•	.in() 사용 시 chunkArray 적용
	•	상태 업데이트는 expected 상태 조건 포함
	•	반환 타입 명시

⸻

5.2 MUST NOT
	•	SELECT *
	•	.or(` 사용
	•	문자열 보간 필터
	•	상태 조건 없는 update

위반 시: Security Violation

⸻

제6조. Batch 구조 규칙

Batch는 작업 방식이 아니라 구조 패턴이다.
Batch 오케스트레이션은 반드시 L1(Service)에 존재해야 한다.

⸻

6.1 MUST
	•	Batch 오케스트레이션은 L1에만 존재
	•	멱등성 보장 구조 필수
	•	checkpoint 또는 진행 상태 기록 필수
	•	partial 처리 로직 존재
	•	재시도 시 중복 실행 방지 로직 존재

⸻

6.2 MUST NOT
	•	route.ts에서 반복 처리 구현
	•	repo에서 배치 오케스트레이션 수행
	•	멱등성 없는 대량 상태 전이

⸻

6.3 FAIL 조건
	•	재시도 시 동일 데이터 중복 반영 가능
	•	실패 시 부분 처리 제어 없음
	•	배치 로직이 HTTP 레이어에 존재

⸻

제7조. RLS 보안 규칙

7.1 MUST
	•	Public 접근은 토큰 기반 row 제한
	•	anon update는 상태 조건 포함
	•	RLS 정책은 명시적 조건 포함

⸻

7.2 MUST NOT
	•	USING (true)
	•	토큰 없이 row 조회 가능

FAIL 조건:
	•	anon이 다중 row 수정 가능
	•	토큰 없이 row 접근 가능

⸻

제8조. Photo URL 규칙

MUST:
	•	getPhotoUrl() 사용

MUST NOT:
	•	/uploads/ 직접 참조
	•	storage bucket 경로 하드코딩

위반 시: FAIL

⸻

제9조. Health Endpoint 규칙

MUST:
	•	HEALTHCHECK_TOKEN 보호
	•	외부 응답은 내부 정보 미노출

MUST NOT:
	•	DB 내부 구조 노출
	•	에러 스택 노출

⸻

제10조. 구조 복잡도 제한

10.1 줄수 기준
	•	함수: 80줄
	•	route.ts: 100줄
	•	service: 150줄
	•	repo: 120줄

초과 시: 분리 필요
미분리 유지 시: Structure Smell

⸻

제11조. 구조 변경 정당화 규칙

다음 행위는 구조 변경으로 간주한다:
	•	새로운 레이어 추가
	•	의존성 방향 변경
	•	공통 모듈 위치 이동
	•	새로운 추상화 계층 도입
	•	서비스/리포지토리 경계 재정의

⸻

11.1 MUST

구조 변경은 복잡도 증가 정당화 문서 없이 금지한다.

정당화 문서에는 반드시 포함:
	•	기존 구조로 해결 불가능한 이유
	•	대안 2개 이상 비교
	•	영향 범위 명시

미제출 시: Architecture Violation

⸻

제12조. 위반 분류 체계

Architecture Violation
→ 레이어 침범 / 의존 방향 위반 / 구조 변경 무정당화

Security Violation
→ RLS 위반 / SELECT * / 필터 보간 / 상태 조건 없는 update

Structure Smell
→ 줄수 초과 / 배치 위치 위반 / 경계 혼합

FAIL
→ 서비스가 HTTP를 아는 경우
→ 멱등성 없는 Batch
→ 보안 규칙 위반

⸻

제13조. 위반 시 운영 트리거
	•	동일 Phase 내 Architecture Violation이 2회 이상 발생하면
해당 Phase는 자동 재오픈 대상이 된다.
	•	재오픈 시 원인 분류 기록이 없으면 PASS 불가.

⸻

부록 A. 승인된 아키텍처 예외

A.1 settlement.repo → sold-items.repo cross-table import (2026-03-10 승인)

배경: settlement.repo.ts에서 PostgREST depth 2 FK JOIN (settlements → settlement_items → sold_items) 시
sold_items 20컬럼 매핑이 필요. sold-items.repo.ts에 이미 COLUMNS와 mapRow가 export됨.

정당화 (§11조 요건 충족):
- 기존 구조 불가 이유: 인라인 매핑(Option B)은 NUMERIC 타입 변경 시 silent bug 위험 (시뮬레이션 Sim3 CRITICAL)
- 대안 비교: 5개 옵션 + 10회 시뮬레이션 완료 (docs/03-analysis/settlement-repo-fix.md §2 참조)
  - Option A (cross-table import): 채택 — NUMERIC 안전, DRY 준수
  - Option B (인라인 매핑): 기각 — Sim3 CRITICAL
  - Option B+ (인라인 + toSafeNumber): 기각 — 완화만 됨
  - Option C (공유 매퍼): 기각 — sellers JOIN 필드가 repo별 상이
  - Option D (toCamelCase): 기각 — NUMERIC 미지원
- 영향 범위: settlement.repo.ts 1개 파일만. 다른 repo 확장 불가.

분류: Structure Smell (§12조) — Architecture Violation 아님.
근거: §2.2는 레이어 간 역참조와 순환 참조를 금지. repo→repo 수평 import는 금지 조항 없음.
이 예외는 프로젝트에서 유일하며, 동일 패턴의 추가 예외 생성 시 별도 정당화 필수.
