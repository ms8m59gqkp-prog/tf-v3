tf-v3 — Phase Completion Gate v1.0

목적:
각 Phase 완료 여부를 자동 판정 가능하게 만든다.

⸻

공통 완료 조건 (모든 Phase)

MUST:
	•	tsc –noEmit 0 에러
	•	next build 성공
	•	ESLint 0
	•	vitest 실패 0

FAIL 조건:
	•	에러 1개 이상
	•	DB 스냅샷 없음 (DB 영향 변경 시)
	•	산출물 증거 없음

⸻

Phase 0 (DB)

추가 MUST:
	•	중복 탐지 쿼리 실행
	•	고아 FK 탐지 실행
	•	UNIQUE 적용 전 정리 완료
	•	RLS 실측 테스트

FAIL:
	•	동시성 테스트 없음
	•	RPC 빈 배열 허용
	•	USING (true) 존재

⸻

Phase 1 (인프라)

MUST:
	•	COMMISSION_RATES 단일 소스
	•	any 0건
	•	validation.ts 스키마 5개 유지

⸻

Phase 2 (Repo)

MUST:
	•	.or(` 0건
	•	SELECT * 0건
	•	.range() 전수

⸻

Phase 3 (Auth)

MUST:
	•	bcrypt cost=12
	•	requireAdmin 적용

⸻

Phase 4 (Service)

MUST:
	•	서비스는 HTTP 모름
	•	partial 처리 로직 존재 (batch)

⸻

Phase 5 (API)

MUST:
	•	Zod 존재
	•	requireAdmin 반환값 사용
	•	표준 응답 구조 사용

FAIL:
	•	req.json() catch 없음
	•	DB-우선 응답 체크 없음

⸻

Phase 6 (Frontend)

MUST:
	•	getPhotoUrl() 사용
	•	inline style 금지

⸻

Phase 7 (Storage)

MUST:
	•	멱등성 보장
	•	checkpoint 존재

⸻

Phase 8 (CI/CD)

MUST:
	•	install → tsc → eslint → vitest → build 순서 고정
	•	/api/health 정상