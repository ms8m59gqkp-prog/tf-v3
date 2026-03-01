# tf-v3 — Phase 체크리스트 (Rev.4 기준)

기준 문서: tf-v3 plan Rev.4  
목적: Phase별 구현 및 검증 기준 명확화

---

# 공통 Done 기준 (모든 Phase 공통)

- [ ] tsc --strict --noEmit = 0
- [ ] ESLint warnings = 0
- [ ] vitest PASS (해당 Phase 테스트 존재 시)
- [ ] DB/RPC 변경 시 쿼리 결과 스냅샷 확보
- [ ] API 응답은 표준 포맷(ok / err)

---

# Phase 0 — DB 마이그레이션 + 제약 + RLS + RPC

## 사전 점검

- [ ] UNIQUE 대상 중복 탐지 쿼리 실행
- [ ] 고아 FK 탐지 쿼리 실행
- [ ] 데이터 정리 정책 문서화
- [ ] 실행 전 DB 백업/스냅샷 확보

## DDL 적용

- [ ] 상태 CHECK 확장
- [ ] UNIQUE 제약 생성
- [ ] INDEX 생성 (CONCURRENTLY)
- [ ] RLS 활성화
- [ ] RLS 정책 생성
- [ ] RPC 생성
- [ ] upload_session_id 컬럼 추가
- [ ] _batch_progress 테이블 생성

## 검증

- [ ] CHECK 정상 반영
- [ ] UNIQUE 정상 생성
- [ ] INDEX 정상 생성
- [ ] RLS 활성화 확인
- [ ] RPC 정상 실행
- [ ] RPC 동시 실행 시 1건만 성공
- [ ] 중복 데이터 0건 확인

---

# Phase 1 — 인프라 + 타입 + 유틸

## 구현

- [ ] env 설정
- [ ] supabase 클라이언트 구성
- [ ] auth 유틸
- [ ] ratelimit 유틸
- [ ] 도메인 타입 정의
- [ ] 공용 Zod 스키마 정의
- [ ] path 유틸 (보안 포함)
- [ ] photo-url 헬퍼 생성

## 검증

- [ ] tsc 0
- [ ] any 타입 0건
- [ ] unit test PASS

---

# Phase 2 — Repository + Transaction

## 구현

- [ ] repository 파일 생성
- [ ] transaction 파일 생성
- [ ] repo error 체크 필수
- [ ] 목록 조회 .range() 적용
- [ ] .in() chunk 처리
- [ ] .or() 문자열 보간 금지
- [ ] 상태 update expected-status 조건 포함
- [ ] deleteBySession 구현
- [ ] batch.repo.ts 구현

## 검증

- [ ] tsc 0
- [ ] 인젝션 패턴 0건
- [ ] .range() 누락 0건
- [ ] repo 120줄 초과 0건

---

# Phase 3 — 미들웨어 + 인증

## 구현

- [ ] middleware.ts 생성
- [ ] requireAdmin 구현
- [ ] bcrypt cost=12 적용
- [ ] CORS 제한 설정

## 검증

- [ ] 관리자 API 인증 차단 정상 동작
- [ ] CORS 정상 동작

---

# Phase 4 — 서비스 레이어

## 구현

- [ ] 서비스 파일 생성
- [ ] 파일 150줄 이하
- [ ] 함수 80줄 이하
- [ ] partial 처리 구현
- [ ] 상태 전환 TRANSITIONS 사용

## 검증

- [ ] 서비스에서 NextRequest 사용 0건
- [ ] 상태 하드코딩 0건

---

# Phase 5 — API 라우트

## 구현

- [ ] requireAdmin → Zod → service → 표준 응답 패턴
- [ ] req.json() try/catch 포함
- [ ] schema.ts co-location
- [ ] route.ts 100줄 이하
- [ ] /api/health 존재
- [ ] 세션 기반 업로드 정책 적용

## 검증

- [ ] tsc 0
- [ ] ESLint 0 warnings
- [ ] requireAdmin 반환값 확인
- [ ] schema.ts 누락 0건
- [ ] 상태 하드코딩 0건

## 병렬 운영 규칙

- [ ] Cross-QA 전 main merge 금지
- [ ] 통합 tsc 실행
- [ ] QA는 순차 실행

---

# Phase 6 — 프론트엔드

## 구현

- [ ] 전체 페이지 존재
- [ ] 정적 inline style 금지
- [ ] Public 페이지 RLS 기반 동작 확인
- [ ] 이미지 getPhotoUrl() 사용

## 검증

- [ ] 하드코딩 경로 0건

---

# Phase 7 — 스토리지 마이그레이션

## 구현

- [ ] _migration_checkpoint 생성
- [ ] 상태 머신 구현
- [ ] 재실행 멱등성 보장

## 검증

- [ ] url_updated 아닌 것만 재처리
- [ ] 사진 404 0건
- [ ] fs 사용 0건

---

# Phase 8 — CI/CD + 최종 검증

## CI

- [ ] install → tsc → eslint → vitest → next build
- [ ] ESLint 커스텀 룰 적용
- [ ] Sentry 설정

## 최종 게이트

- [ ] next build 성공
- [ ] vitest 전체 PASS
- [ ] /api/health 200 응답
- [ ] 전환 런북 점검 완료
