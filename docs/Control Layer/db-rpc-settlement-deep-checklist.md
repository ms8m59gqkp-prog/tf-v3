tf-v3 — DB/RPC/정산 전용 심화 체크리스트 v1.1

(Ralph Loop Integrated · Rev.5 기준)

적용 대상: L3 변경(고위험)
	•	DB 스키마/인덱스/RLS/정책 변경
	•	RPC(plpgsql) 변경
	•	트랜잭션/상태전이/정산 규칙 변경(= DB 결과가 달라짐)
	•	업로드 세션/배치 진행(_batch_progress)/재시도 로직 변경

이 문서는 설명서가 아니다.
증거 기반 Merge 판정용 고위험 게이트 문서다.

⸻

0) PR 메타 (반드시 채우기)
	•	변경 레벨: L3 (DB/RPC/정산)
	•	변경 유형(복수 선택)
	•	DDL(테이블/컬럼/인덱스/제약)
	•	RLS/정책
	•	RPC
	•	트랜잭션/상태전이
	•	정산 계산(수수료/합계/반올림)
	•	업로드 세션/격리
	•	배치 partial/재시도
	•	영향 범위(최소 1개 이상)
	•	sellers / orders / consignments / sold_items / settlements / settlement_items
	•	settlement_queue / sales_records / st_products
	•	storage photos / outbox / notifications
	•	증거 링크(최소 1개 이상)
	•	SQL 결과 스냅샷
	•	API 응답 JSON 샘플
	•	vitest 결과(통합/RPC/E2E)
	•	로그 라인(배치/헬스/정산)

⸻

1) Ralph Loop — L3 강제 적용 규칙 🔴

L3는 단일 PASS로 Merge 불가.

1.1 누적 회귀 구조 (Cumulative Gate)

다음 영역은 독립 PASS가 아니다:
	•	논리
	•	동시성
	•	보안/RLS
	•	운영/롤백
	•	적대 시나리오

새 영역 수정 시
이전 영역 자동 재검증 MUST.

이전 PASS 유지 실패 → 즉시 FAIL.

⸻

1.2 최소 증거 깊이 (Depth Gate)

L3 변경은 다음 최소 증거량을 충족해야 PASS 인정:
	•	동시성 → 서로 다른 3 시나리오 전부 통과
	•	보안/RLS → 경계 시나리오 3개 전부 통과
	•	운영/롤백 → 2 시나리오 통과
	•	적대 테스트 → 1 이상 통과

부분 통과 → FAIL.

⸻

1.3 안정성 반복 규칙
	•	연속 3회 PASS 시 Ralph PASS 인정
	•	FAIL 발생 시 streak 초기화
	•	최대 반복 한도 = 70회
	•	70회 초과 → Merge 금지 + 설계 결함 의심

L3는 반드시 안정성 반복을 증명해야 한다.

⸻

2) Phase 0 선행 체크 (DDL/제약/인덱스/RLS 변경 시 필수)

2.1 Preflight (데이터 정리 런북 준수)
	•	UNIQUE/제약 추가 전 중복 탐지 쿼리 실행 및 결과 저장
	•	고아 FK 탐지 실행 및 결과 저장
	•	정리 정책 문서화
	•	정리 SQL은 수동 승인 후 실행

2.2 마이그레이션 안전성
	•	CONCURRENTLY 인덱스 사용
	•	락/다운타임 리스크 평가
	•	롤백 전략 존재

⸻

3) RLS / 공개 경계 심사

3.1 최소권한 원칙
	•	USING (true) 없음
	•	Public 접근은 토큰 기반 row 제한
	•	anon UPDATE는 토큰 + 상태 조건 동시 적용

3.2 실측 테스트
	•	anon(토큰 없음) SELECT → 0 row 또는 403
	•	anon(토큰 있음) SELECT → 해당 row만
	•	anon UPDATE 경계 검증 완료

3.3 Health 보안 경계
	•	외부 호출에 민감정보 없음
	•	내부 호출만 상세 checks
	•	stack/키 문자열 노출 없음

⸻

4) RPC 품질 체크

4.1 입력 검증
	•	빈 배열/빈 jsonb 명시적 거부
	•	필수필드 누락 시 실패

4.2 락 / 동시성
	•	FOR UPDATE 잠금 적용
	•	기대 건수 vs 잠금 건수 비교
	•	동시 2요청 테스트 수행

4.3 원자성
	•	중간 상태 외부 노출 없음
	•	트랜잭션 순서 정합성 유지
	•	실패 시 롤백 보장

4.4 에러 메시지
	•	외부 노출 메시지 최소화
	•	내부 로그는 충분히 기록

⸻

5) 정산(Settlement) 전용 체크

5.1 정합성 불변조건
	•	settlement_items는 settlements와 1:N 유지
	•	settlement_status 전이 규칙 준수
	•	중복 정산 방지 유지

5.2 계산 규칙
	•	COMMISSION_RATES 단일 소스 사용
	•	반올림/절사 규칙 명시
	•	DB 저장 전/후 동일성 증거 첨부

5.3 DB-우선 응답 게이트
	•	DB write 성공 후 응답 생성
	•	실패 시 성공 응답 금지
	•	2회 호출 시 중복 생성 없음

⸻

6) 업로드 세션 격리 체크
	•	세션 정책 명확화
	•	deleteBySession은 해당 세션만 삭제
	•	동시 업로드 격리 보장
	•	재시도 시 중복/누락 없음

⸻

7) 배치(_batch_progress) / partial / 재시도
	•	_batch_progress DDL/CRUD 존재
	•	partial 상태 기록 정확
	•	failedIds 기록 존재
	•	재시도는 failedIds만 대상
	•	batch_id UNIQUE 적용

⸻

8) 테스트 명시 체크 (L3 필수)

RPC 통합 테스트
	•	빈 배열 실패
	•	정상 입력 성공
	•	동시 2요청 검증

RLS 시나리오
	•	anon 토큰 없음 → 차단
	•	토큰 일치 → 허용
	•	권한 경계 유지

E2E
	•	CRITICAL 라우트 최소 1개 검증
	•	실패 케이스 포함

⸻

9) 산출물 첨부 필수
	•	DB 스냅샷 1개 이상
	•	API 응답 JSON 샘플
	•	vitest 결과 로그
	•	(해당 시) batch/outbox 로그

⸻

10) 최종 FAIL 조건

다음 중 하나라도 해당하면 Merge 금지:
	•	RLS 과잉 허용 존재
	•	동시성/멱등성 증거 없음
	•	Preflight 없이 제약 추가
	•	내부 정보 노출
	•	partial 기록 누락
	•	Ralph Loop 안정성 조건 미충족

⸻

11) 체크 완료 선언
	•	위 항목 전부 확인
	•	증거 PR 첨부 완료
	•	데이터 결과 변경 지점 명시
	•	Ralph Loop 안정성 충족
