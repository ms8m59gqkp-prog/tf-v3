tf-v3 — Architecture Specification (Agent-Enforced) v1.0

목적:
tf-v3 코드베이스의 구조를 고정하고,
레이어 침범 / 보안 경계 위반 / 구조 오염을 자동으로 판정 가능하게 만든다.

이 문서는 설명서가 아니라 구조 규약이다.

⸻

1. 레이어 모델 (3+1)

L0 — Infrastructure
L1 — Business Core
L2 — UI
L3 — Entry (API / Page)

Supabase는 외부 시스템으로 간주한다.

⸻

2. 의존성 규칙 (절대 규칙)

허용:

L3 → L1
L2 → L3 (HTTP 호출만)
L1 → L0

금지:

L1 → L3 import
L1 → NextRequest / NextResponse import
L0 → L1 import
순환 참조

위반 시: Architecture Violation

⸻

3. 파일 역할 정의

L0:
	•	env.ts
	•	supabase client
	•	auth
	•	ratelimit

L1:
	•	services
	•	repositories
	•	transactions
	•	calculators
	•	types
	•	utils

L2:
	•	components
	•	hooks

L3:
	•	app/api/**/route.ts
	•	app/**/page.tsx

⸻

4. 서비스 규칙

MUST:
	•	서비스는 Next.js 객체를 모른다
	•	서비스는 HTTP 응답을 만들지 않는다
	•	서비스는 DB 직접 호출하지 않는다 (repo 경유)

MUST NOT:
	•	NextRequest import
	•	fetch 직접 호출
	•	response 생성

위반 시: FAIL

⸻

5. 리포지토리 규칙

MUST:
	•	모든 DB 에러 체크
	•	목록 쿼리는 .range() 필수
	•	.in() 사용 시 chunkArray
	•	상태 업데이트는 expected 상태 포함

MUST NOT:
	•	SELECT *
	•	.or(` 사용
	•	문자열 보간 필터

위반 시: Security Violation

⸻

6. RLS 규칙

MUST:
	•	Public 접근은 토큰 기반 row 제한
	•	anon update는 상태 조건 포함
	•	USING (true) 금지

FAIL 조건:
	•	토큰 없이 row 조회 가능
	•	anon이 다중 row 수정 가능

⸻

7. Photo URL 규칙

MUST:
	•	getPhotoUrl() 사용

MUST NOT:
	•	/uploads/ 직접 참조
	•	storage bucket 경로 하드코딩

위반 시: FAIL

⸻

8. Health Endpoint 규칙

MUST:
	•	HEALTHCHECK_TOKEN 보호
	•	외부 응답은 상세 정보 미노출

MUST NOT:
	•	DB 내부 구조 노출
	•	에러 스택 노출

⸻

9. 줄수 제한

함수: 80줄
route.ts: 100줄
service: 150줄
repo: 120줄

초과 시: 분리 필요

⸻

이 문서는 tf-v3 구조를 보호하기 위한 강제 규약이다.
예외는 없다.