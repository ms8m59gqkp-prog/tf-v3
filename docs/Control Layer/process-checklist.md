tf-v3 — PR Validation Process v1.0

목적:
PR Merge 가능 여부를 기계적으로 판정한다.

⸻

1. 변경 레벨 지정

L1 — UI
L2 — API/Service
L3 — DB/RPC/정산

레벨 미지정 → FAIL

⸻

2. 공통 게이트

MUST:
	•	빌드 성공
	•	테스트 통과
	•	산출물 1개 이상 첨부

⸻

3. L3 전용 게이트

MUST:
	•	동일 요청 2회 테스트
	•	동시성 테스트
	•	DB 전/후 row 비교
	•	RLS 테스트

FAIL:
	•	멱등성 검증 없음
	•	상태 꼬임 발생
	•	중복 row 생성

⸻

4. 보안 게이트

MUST:
	•	.or(` 없음
	•	SELECT * 없음
	•	내부 메시지 노출 없음

⸻

5. Merge 조건
	•	레벨 명시
	•	증거 첨부
	•	리뷰 승인 1인 이상
