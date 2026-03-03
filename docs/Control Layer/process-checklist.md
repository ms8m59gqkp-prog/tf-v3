tf-v3 — PR Validation Process v1.3

목적:
PR Merge 가능 여부를 기계적으로 판정한다.
감정/의도/선의는 고려하지 않는다.
증거와 규칙만 본다.

⸻

1. 변경 레벨 지정

L1 — UI
L2 — API/Service
L3 — DB/RPC/정산

레벨 미지정 → FAIL

L3 지정 시 → DB/RPC/정산 심화 체크리스트 자동 적용

⸻

2. 공통 게이트

MUST
	•	빌드 성공
	•	테스트 통과
	•	산출물 1개 이상 첨부

FAIL
	•	빌드 실패
	•	테스트 실패
	•	증거 미첨부

⸻

3. L3 자동 확장 게이트 🔴

L3 변경인 경우 다음 문서가 필수 적용된다:

docs/db-rpc-settlement-deep-checklist.md

MUST
	•	해당 체크리스트의 “PR 메타” 항목 모두 기재
	•	최소 1개 이상 SQL 스냅샷 첨부
	•	멱등성/동시성 증거 1개 이상 첨부
	•	RLS 실측 증거 첨부
	•	DB-우선 응답 게이트 검증 명시

FAIL
	•	Deep Checklist 미첨부
	•	증거 없이 “테스트함”으로 기재
	•	동시성/멱등성 항목 누락
	•	Preflight 없이 제약 추가

⸻

4. 보안 게이트

MUST
	•	.or( 없음
	•	SELECT * 없음
	•	내부 메시지 노출 없음

FAIL
	•	필터 문자열 보간 존재
	•	RLS 우회 가능
	•	내부 스택 노출

⸻

5. 구조 게이트 (Architecture Gate)

MUST
	•	Architecture Violation 0건
	•	Security Violation 0건
	•	Structure Smell 방치 없음

FAIL
	•	레이어 침범
	•	의존 방향 위반
	•	무정당화 구조 변경
	•	Batch 위치 위반

⸻

5-1. Simplify 개입 보고 의무 🔵

다음 중 하나 발생한 경우,
해당 PR은 Simplify 검토 보고 없이는 Merge할 수 없다.

발동 조건
	•	동일 Phase 2회 이상 재오픈
	•	동일 PR 3회 이상 재검증 실패
	•	Ralph Loop 70회 도달
	•	구조 게이트는 통과했으나 반복 수정 발생

보고 의무

PR 설명에 반드시 다음을 명시해야 한다:
	•	단순화 가능성 검토 여부
	•	제거 가능한 추상화 존재 여부
	•	상태 전이 축소 가능성
	•	정책/레이어 축소 가능성
	•	왜 단순화 대신 현 구조를 유지하는지에 대한 근거

보고 없이 구조를 확장한 경우 → FAIL

“기술적으로는 맞다”는 이유로
복잡도 증가를 정당화할 수 없다.

Simplify 보고가 없는 PR은
구조적 안정성 검증이 완료된 것으로 인정하지 않는다.

⸻

6. Merge 조건

모든 해당 게이트 통과 시에만 Merge 가능.

필수 조건
	•	변경 레벨 명시
	•	증거 첨부
	•	Architecture Gate 통과
	•	보안 게이트 통과
	•	(L3인 경우) Deep Checklist 통과
	•	(발동 시) Simplify 보고 완료
	•	리뷰 승인 1인 이상

하나라도 미충족 → Merge 금지
