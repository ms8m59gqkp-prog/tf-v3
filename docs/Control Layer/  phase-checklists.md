tf-v3 — Phase Completion Gate v1.1

(Ralph Loop Integrated)

목적:
각 Phase 완료 여부를 자동 판정 가능 상태로 만든다.
PASS는 체크 1회가 아니라 유지되는 안정 상태여야 한다.

이 문서는 Phase 게이트 정의서이며,
운영 트리거(Ralph Loop 포함)를 함께 규정한다.

⸻

0. 공통 완료 조건 (All Phases)

0.1 MUST (자동 판정)
	•	tsc --noEmit 0 에러
	•	next build 성공
	•	ESLint 0 warning
	•	vitest 실패 0

위 4개 중 하나라도 실패하면 즉시 FAIL.

⸻

0.2 산출물 증거 (Evidence Gate)
	•	DB 영향 변경 시 → DB 스냅샷 1개 이상
	•	API 영향 변경 시 → JSON 응답 샘플 1개 이상
	•	고위험(L3) 변경 시 → 동시성/멱등성 증거 포함

증거 없음 → FAIL.

⸻

0.3 FAIL 조건
	•	에러 1개 이상
	•	DB 스냅샷 없음 (DB 영향 변경 시)
	•	산출물 증거 없음
	•	Architecture Violation 존재
	•	보안 경계 위반 존재

⸻

1. Meta Trigger (운영 트리거 — Ralph Loop)

자동 판정 외 추가 규칙.

1.1 Phase 재오픈 규칙
	•	동일 Phase가 2회 이상 재오픈될 경우
→ Ralph Loop 점검 MUST 수행

점검 항목:
	•	스펙 모순
	•	아키텍처 경계 위반
	•	게이트 설계 오류
	•	구현 결함

Ralph Loop 점검 결과가 문서화되지 않으면
해당 Phase는 PASS 불가.

⸻

2. Ralph Loop 적용 규칙 (Phase 레벨)

Phase PASS는 다음 2개 축을 동시에 만족해야 한다.

2.1 누적 회귀 구조 (Cumulative Gate)

영역은 독립 PASS가 아니다.

1
1 + 2
1 + 2 + 3
1 + 2 + 3 + 4
1 + 2 + 3 + 4 + 5

새 영역 수정 시
이전 영역 자동 재검증 MUST.

이전 PASS 유지 실패 → Phase FAIL.

⸻

2.2 최소 증거 깊이 (Depth Gate)

각 영역은 최소 시나리오 수 충족해야 PASS.
	•	동시성 → 서로 다른 3 시나리오 전부 통과
	•	보안/RLS → 경계 3 시나리오 전부 통과
	•	운영/롤백 → 2 시나리오 통과
	•	적대 테스트 → 1 이상 통과

부분 통과는 PASS로 인정하지 않는다.

⸻

2.3 안정성 반복 규칙

PASS는 1회 통과로 인정하지 않는다.
	•	연속 3회 PASS 시 Ralph PASS 인정
	•	FAIL 발생 시 streak 초기화
	•	최대 반복 한도 = 70회
	•	70회 초과 → 자동 FAIL + 설계 결함 의심

⸻

3. Phase별 추가 조건

⸻

Phase 0 — DB

MUST
	•	중복 탐지 쿼리 실행
	•	고아 FK 탐지 실행
	•	UNIQUE 적용 전 정리 완료
	•	RLS 실측 테스트

FAIL
	•	동시성 테스트 없음
	•	RPC 빈 배열 허용
	•	USING (true) 존재

⸻

Phase 1 — Infrastructure

MUST
	•	COMMISSION_RATES 단일 소스
	•	any 0건
	•	validation.ts 스키마 5개 유지

⸻

Phase 2 — Repository

MUST
	•	.or( 0건
	•	SELECT * 0건
	•	.range() 전수 적용

⸻

Phase 3 — Auth

MUST
	•	bcrypt cost=12
	•	requireAdmin 적용

⸻

Phase 4 — Service

MUST
	•	서비스는 HTTP 객체를 모른다
	•	partial 처리 로직 존재 (batch)

⸻

Phase 5 — API

MUST
	•	Zod 존재
	•	requireAdmin 반환값 사용
	•	표준 응답 구조 사용

FAIL
	•	req.json() catch 없음
	•	DB-우선 응답 체크 없음

⸻

Phase 6 — Frontend

MUST
	•	getPhotoUrl() 사용
	•	inline style 금지

⸻

Phase 7 — Storage

MUST
	•	멱등성 보장
	•	checkpoint 존재

⸻

Phase 8 — CI/CD

MUST
	•	install → tsc → eslint → vitest → build 순서 고정
	•	/api/health 정상

⸻

4. 최종 PASS 정의

Phase PASS는 다음을 모두 충족해야 한다:
	1.	공통 게이트 통과
	2.	Phase별 MUST 충족
	3.	FAIL 조건 0건
	4.	Ralph Loop 누적 회귀 충족
	5.	최소 증거 깊이 충족
	6.	연속 3회 PASS 확보

위 조건 중 하나라도 미충족 시 FAIL.