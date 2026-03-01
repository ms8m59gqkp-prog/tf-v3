# PR Title
(한 줄로 무엇을 바꾸는지)

## What / Why
- What:
- Why (V2 문제/리스크/플랜 근거):

## Change Type (체크)
- [ ] L1 UI/문구/스타일 (로직 없음)
- [ ] L2 API/서비스/비즈니스 로직
- [ ] L3 DB/RPC/정산/상태전이 (고위험)

---

# ✅ Global Process Checklist (필수)

## Done 기준(증거 포함)
- [ ] `pnpm tsc --noEmit` PASS (로그/캡처)
- [ ] `pnpm next build` PASS (로그/캡처)
- [ ] (해당 시) `pnpm vitest run` PASS (로그/캡처)
- [ ] (해당 시) 변경 영향 범위 설명 + 롤백 방법 1줄

## 기본 품질
- [ ] 타입/검증: 입력은 Zod로 검증했고 실패 시 `validationErr()`로 종료
- [ ] 에러 처리: try/catch + `Sentry.captureException(e)` + `err()`로 표준 응답
- [ ] 페이지네이션: 목록은 `.range()` 사용 (limit max=100 준수)
- [ ] 보안: `.or(\`...\`)` 문자열 보간 없음 (PostgREST 인젝션 방지)

## 운영/보안 경계 (Rev.4 SEC/OPS)
- [ ] `/api/health`는 보호됨 (토큰/allowlist/응답 축소 중 1개 적용)
- [ ] Public(anon) 라우트는 민감 에러 메시지/내부 규칙 노출 없음

---

# 🔥 L3 Deep Checklist (DB/RPC/정산 전용) — L3일 때만 필수

## DB 변경 판정 (하나라도 해당하면 L3)
- [ ] 테이블/컬럼/인덱스 변경
- [ ] RLS/정책 변경
- [ ] RPC 수정
- [ ] 트랜잭션 코드 수정
- [ ] 정산/상태전이 규칙 변경(= DB 결과 변경)

## Preflight SQL / 데이터 정리 런북
- [ ] UNIQUE/제약 추가 전 중복 탐지 쿼리 실행 결과 첨부
- [ ] 고아 FK 탐지 쿼리 실행 결과 첨부
- [ ] 데이터 정리 정책(어떤 row를 살리고 버리는지) 1줄 명시
- [ ] 실패/롤백 계획 1줄 명시

## RLS (anon 경계)
- [ ] anon 접근: 토큰 없이 0 row/403 확인
- [ ] anon 접근: 토큰 일치 시 해당 row만 조회/갱신 확인
- [ ] orders RLS에서 `USING (true)` 같은 과잉 허용 없음

## upload_session / 동시성 / 멱등성
- [ ] upload_session 흐름 정책 확정(재시도 세션 / 관리자별 최신 세션 중 택1) + 구현 일치
- [ ] “동일 요청 2번”에서 중복 생성/중복 발송/중복 정산 없음(멱등성)
- [ ] 동시성(락/FOR UPDATE/RPC): 동시 요청 시 1건만 성공(또는 충돌 처리) 테스트 증거 첨부

## batch partial / 재시도
- [ ] 429 등 partial 발생 시 `failedIds`가 남고 `_batch_progress`에 기록됨
- [ ] 재시도 시 failedIds만 재처리 가능(증거 첨부)

## Storage/Photo URL 경계
- [ ] 이미지 URL은 하드코딩 금지, `getPhotoUrl()` 헬퍼 사용
- [ ] `grep -r 'src=.*uploads\|/uploads/' app/` → 0건 (증거 첨부)

---

## Evidence (붙여넣기)
- Build log:
- Test log:
- DB snapshot / API response sample:
