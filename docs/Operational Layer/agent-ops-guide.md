tf-v3 — Agent Ops Guide (v1.1)

목표:
tf-v3에서 에이전트(또는 본인)가 작업할 때,
규칙 위반 / 누락 / 재작업을 없애고 “검증 가능한 산출물”로만 전진한다.

감정이 아니라 게이트 통과 상태만 인정한다.

⸻

0) 필수 문서 (읽는 순서)
	1.	docs/process-checklist.md  (PR/레벨 게이트: L1/L2/L3)
	2.	docs/phase-checklists.md   (Phase 게이트)
	3.	docs/architecture-spec.md  (3+1 레이어 / 금지 규칙)
	4.	docs/db-rpc-settlement-deep-checklist.md (L3 심화)

plan5.md는 “설계/일정/전략”의 원문 마스터로 둔다(필요 시 참조).

⸻

1) 작업 시작 루틴 (매 세션 동일)

1.1 오늘 작업 범위 선언
	•	오늘의 범위는 Phase 기준으로 1개만 잡는다.
	•	변경 레벨(L1/L2/L3)을 먼저 선언한다.

1.2 금지사항 3개 (즉시 실패)
	•	lib/services에서 NextRequest/NextResponse 사용
	•	supabase .or() 템플릿 리터럴 사용
	•	이미지 경로 하드코딩 (/uploads/photos 등)

위반 시 즉시 중단.

⸻

1.3 재오픈 시 단순화 검토 의무 (Simplify Trigger)

다음 중 하나 발생 시 구조 확장 전에 단순화 검토를 수행한다.
	•	동일 Phase 2회 이상 재오픈
	•	동일 PR 3회 이상 수정
	•	구조 게이트 통과 후 반복 수정 발생

검토 항목:
	•	기능 분해 가능 여부
	•	추상화 제거 가능 여부
	•	상태 전이 축소 가능 여부
	•	정책/레이어 축소 가능 여부

단순화 검토 없이 복잡도 증가 금지.

⸻

2) 브랜치/PR 운영 규칙 (안전 모드)

2.1 브랜치 규칙
	•	main은 항상 “빌드 가능한 상태” 유지.
	•	기능 작업은 feature/* 브랜치에서만.
	•	L3(DB/RPC/정산/상태전이)는 반드시 별도 브랜치에서 진행.

2.2 PR 규칙

PR에는 반드시:
	•	변경 레벨(L1/L2/L3) 표시
	•	체크리스트 체크(증거 포함)
	•	verify 로그(가능하면)

증거 없는 주장 금지.

⸻

3) 검증(증거) 규칙

3.1 기본 (항상)
	•	tsc --noEmit
	•	eslint --max-warnings 0
	•	vitest run
	•	next build (최소 daily 1회 또는 Phase 8)

⸻

3.2 L3 추가 (필수)
	•	DB 산출물: 쿼리 결과/스냅샷 1개 이상
	•	동시성/멱등성 시나리오 증명
	•	RLS 실측(anon 토큰 유/무) 결과 1개 이상

⸻

3.3 L3 안정성 반복 검증 (Ralph Loop 적용)

L3 변경은 단일 테스트 통과로 충분하지 않다.

다음 조건을 충족해야 한다:
	•	동시성 시나리오 최소 3개 전부 통과
	•	RLS 경계 시나리오 최소 3개 전부 통과
	•	운영/롤백 시나리오 최소 2개 통과
	•	PASS는 연속 3회 반복 검증 후 인정
	•	최대 반복 상한 70회

70회 초과 시 설계 결함 의심.
자동 재시도 대신 구조 점검 수행.

⸻

4) 자동 검사 실행

루트에서 실행:
	•	scripts/verify.sh
	•	scripts/grep-guards.sh

verify 통과 시 최소한의 규칙 위반 가능성은 닫힌다.

⸻

5) 작업 단위 설계 원칙
	•	route.ts는 얇게: 인증 → 검증 → 서비스 위임 → 응답
	•	서비스는 오케스트레이션만 수행
	•	상태전이/정산 로직은 서비스
	•	DB 접근은 repo 경유
	•	repo는 error 체크 / range / chunk / expected status 필수

레이어 침범은 구조 위반이다.

⸻

6) 병렬 작업 시 규칙
	•	공용 파일(lib/, docs/) 수정은 1명만 (리드 역할)
	•	app/api 하위 디렉토리 단위 분리
	•	Cross-QA 완료 전 main merge 금지

⸻

7) 문제 발생 시 판단 기준
	•	CI 실패인데 로컬 통과 → 디렉토리/락파일/캐시/경로 문제부터 의심
	•	“too many connections” → 코드 버그로 단정 금지, QA 동시 실행 수 먼저 확인
	•	RLS 문제 → 토큰 전달 방식/anon 정책/헤더 전달 실측

추측 금지.
실측 우선.

⸻

8) 마지막 원칙

코드는 믿지 않는다.
로그 / DB 산출물 / 테스트만 믿는다.

“됐겠지”는 금지.

⸻

9) 세션 안전 규칙 (70회 STOP)

AI와의 상호작용이 70회 이상 누적되면
구조 왜곡 위험이 상승한다.

70회 도달 시:
	•	작업 강제 정리
	•	dev docs 업데이트
	•	현재 구조 재점검
	•	새 세션에서 continue로 재개

무한 세션 지속은 금지한다.

⸻

최종 정렬 상태

이 문서는 다음과 정합된다:
	•	Manifesto (Ralph / Simplify / Batch 통제 축)
	•	Phase Gate (완료 판정)
	•	Process Gate (Merge 판정)
	•	Deep Checklist (L3 고위험 확장)

Agent Ops는 실행 레벨 통제 문서다.
통과하지 못하면 진행하지 않는다.