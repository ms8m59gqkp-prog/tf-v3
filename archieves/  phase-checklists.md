# Classic Menswear V3 — Phase별 체크리스트 (Rev.4 기준)

작성일: 2026-03-01
근거: plan Rev.4 §1~§19

---

## 공통 원칙 (모든 Phase 공통)

### Done(완료) 기준
- tsc --strict --noEmit ✅
- vitest run ✅ (해당 Phase에 테스트가 정의된 경우)
- next build ✅ (Phase 8 최종)
- 변경이 DB/RPC/상태전이/정산에 영향을 주면: **DB 산출물(쿼리 결과/스냅샷) 1개 이상** ✅

### 증거(산출물) 기본 세트
- 빌드/테스트 로그(명령어 + 결과)
- DB 쿼리 결과 스냅샷(필요 시)
- API 응답 JSON 샘플(필요 시)
- 운영 로그(health/outbox/batch 등, 필요 시)

---

## Phase 0 체크리스트 — DB 마이그레이션 + 인덱스 + RLS + RPC (Rev.4)

### 0-A. Preflight(사전 탐지/정리 런북) — §3.0
- [ ] UNIQUE 대상 5건 **중복 탐지 쿼리 실행** 및 결과 저장
  - settlement_queue(match_id)
  - sellers(phone)
  - sellers(seller_code)
  - return_shipments(consignment_id)
  - st_products(product_number)
- [ ] 고아 FK 탐지 쿼리(패턴) 실행 및 결과 저장
- [ ] 정리 정책(살릴 row 기준) 문서화
- [ ] 정리 SQL은 자동 실행 금지: “탐지 → 스냅샷 → 승인 → 실행” 순서 고정
- [ ] 실행 직전 백업/스냅샷(또는 PITR/backup) 확인

### 0-B. 마이그레이션/DDL — §3.1
- [ ] ConsignmentStatus CHECK 7값 확장 적용(001)
- [ ] UNIQUE 5건 적용(002) (사전 중복 0건 확인 후)
- [ ] 인덱스 5개 CONCURRENTLY 생성(003)
- [ ] RLS 활성화 + 정책 생성(004)
- [ ] RPC 3개 생성(005~007)
- [ ] upload_session_id 컬럼 + 인덱스 생성(008) [R4-01]
- [ ] _batch_progress 테이블 생성(009) [R4-04]
- [ ] orders Public 접근: hold_token 기반 RLS 정책으로 축소(010) [SEC/OPS]

### 0-C. 검증 게이트(필수) — §3.2
- [ ] CHECK 7값 확인
- [ ] UNIQUE 5개 적용 확인(\d+)
- [ ] 인덱스 5개 생성 확인(\di+)
- [ ] RLS 활성화 확인(rowscurity)
- [ ] RPC 3개 생성 확인(information_schema)
- [ ] RPC 단위 테스트: 빈 배열 → 에러 / 정상 → uuid 반환
- [ ] RPC 동시 실행 테스트: 동일 sold_items FOR UPDATE → 1개만 성공
- [ ] 중복 데이터 0건 확인(정리 완료)
- [ ] sales_records.upload_session_id 존재 확인
- [ ] _batch_progress 스키마 확인
- [ ] [SEC/OPS] RLS 실측 테스트(anon):
  - 토큰 없음: orders/consignment 조회 → 0 row 또는 403
  - 토큰 일치: 해당 row만 조회
  - anon update: 토큰 불일치/상태 불일치 → 0 row 또는 403

### Phase 0 증거
- [ ] Preflight 쿼리 결과 스냅샷 파일(또는 캡처)
- [ ] 마이그레이션 실행 로그
- [ ] RPC 테스트 로그(동시성 포함)

---

## Phase 1 체크리스트 — 인프라 + 타입 + 유틸 (Rev.4)

### 1-A. 구현 — §4
- [ ] env/supabase/auth/ratelimit 기본 인프라 파일 생성
- [ ] 도메인 타입(Consignment 7값, Order 8값 등) 정의
- [ ] 공용 Zod 스키마는 5개만(lib/utils/validation.ts)
- [ ] path.ts symlink 방어 포함
- [ ] photo-url 헬퍼 생성(lib/utils/photo-url.ts) [SEC/OPS, PSIM-09 대응]

### 1-B. 검증 게이트 — §4.4
- [ ] tsc --strict --noEmit 에러 0
- [ ] vitest unit PASS
- [ ] COMMISSION_RATES 단일 소스 확인(grep)
- [ ] validation.ts 스키마 5개만 유지
- [ ] any 0건(ESLint)

### Phase 1 증거
- [ ] tsc 로그
- [ ] unit 테스트 로그
- [ ] photo-url.ts 존재 + 사용 방침(Phase 6에서 강제 예정)

---

## Phase 2 체크리스트 — 데이터 레이어(Repo + Tx) (Rev.4)

### 2-A. 구현 — §5
- [ ] repositories 12개 + transactions 3개 생성
- [ ] Repo 원칙 5개 준수:
  - error 체크 필수
  - .in() chunkArray(100)
  - 목록 .range() 강제
  - .or() 문자열 보간 금지
  - 상태 update는 .eq(status, expected) 포함
- [ ] sales_records: deleteBySession / insertWithSession 구현 [R4-01]
- [ ] batch.repo.ts upsert(onConflict=batch_id) 구현 [R4-04]

### 2-B. 검증 게이트 — §5.6
- [ ] tsc 0
- [ ] PostgREST 인젝션 패턴 0: grep ".or(`" = 0
- [ ] repo error 체크 패턴 점검
- [ ] 목록 함수에 .range() 전수
- [ ] .in() 사용 시 chunkArray 전수
- [ ] repo 줄수 제한(120) 점검(wc -l)
- [ ] deleteBySession 존재 확인
- [ ] batch.repo.ts 존재 확인

### Phase 2 증거
- [ ] grep 결과(인젝션/범위/청크)
- [ ] repo 줄수 결과
- [ ] rpc 통합 테스트(§12와 연결)

---

## Phase 3 체크리스트 — 미들웨어 + 인증 (Rev.4)

### 3-A. 구현 — §6
- [ ] middleware.ts + lib/api/middleware.ts 구성
- [ ] bcrypt cost=12 명시
- [ ] CORS 설정 경계(지정 라우트만)

### 3-B. 검증
- [ ] 인증/권한 curl 스모크(관리자 라우트 차단/허용)
- [ ] CORS 헤더 확인(해당 라우트만)

---

## Phase 4 체크리스트 — 서비스 레이어 (Rev.4)

### 4-A. 구현 — §7
- [ ] 서비스 9개 생성, 각 150줄 이내
- [ ] 함수 80줄 이내
- [ ] classifyBatch: partial 처리 + failedIds + status + logBatch 호출

### 4-B. 검증
- [ ] 서비스가 NextRequest/NextResponse import 하지 않음
- [ ] classifyBatch 429 시나리오에서 partial로 멈추는지(유닛/통합 중 택1)

---

## Phase 5 체크리스트 — API 라우트 63개 (Rev.4)

### 5-A. 공통 패턴 준수 — §8.2
- [ ] 인증(requireAdmin) → Zod 검증 → 서비스 위임 → 표준 응답(ok/err)
- [ ] req.json()은 catch 포함
- [ ] schema.ts co-location(POST/PATCH 전수)
- [ ] route.ts 100줄 이내

### 5-B. Rev.4 필수 항목
- [ ] /api/health 존재 [R4-02]
- [ ] health 보안 경계(토큰/응답 축소) 적용 [§8.3]
- [ ] upload-naver-settle 세션 정책 명시 + 구현 [R4-01, §8.4]
  - 업로드 1회=1세션, 재시도는 동일 sessionId 재전송
- [ ] DB-우선 응답 체크(게이트) 포함 [R4-03]

### 5-C. 검증 게이트 — §8.6
- [ ] tsc 0
- [ ] ESLint 0 warnings
- [ ] requireAdmin 반환값 사용 강제(커스텀 룰)
- [ ] schema.ts 존재 전수
- [ ] route.ts 100줄 전수
- [ ] ".or(`" 0
- [ ] req.json() catch 없는 곳 0

### 5-D. 병렬 운영(Day 5) 규칙 — §13 + PSIM FIX
- [ ] Cross-QA 전 main merge 금지(FIX-P05)
- [ ] Cross-QA에서 통합 tsc 실행(FIX-P06)
- [ ] 컨벤션(v3-route-convention) + 모범 라우트 배포(FIX-P02)
- [ ] QA는 순차 실행(커넥션 풀 이슈 회피)(FIX-P04)
- [ ] 상태 전환 로직 라우트 하드코딩 금지(FIX-P03)

---

## Phase 6 체크리스트 — 프론트 17페이지 (Rev.4)

### 6-A. 구현 — §9
- [ ] 17페이지 전수 존재(15 admin + 2 public)
- [ ] 정적 inline style 금지(ESLint no-static-inline-styles)
- [ ] Public 2페이지는 anon+RLS 전제(토큰 전달 방식 포함)

### 6-B. 사진 URL 강제 — §4.5 + PSIM-09 + FIX-P10
- [ ] 이미지 src 하드코딩 금지: getPhotoUrl() 사용
- [ ] 게이트: grep로 uploads/photos 하드코딩 0건

### 6-C. 병렬 운영(Day 6) 규칙 — PSIM-07
- [ ] 공유 컴포넌트 “스텁” 선배포 전략(FIX-P07)
- [ ] Beta는 공유 컴포넌트 import만(직접 구현 금지)

---

## Phase 7 체크리스트 — 스토리지 마이그레이션 (Rev.4)

### 7-A. 구현 — §10
- [ ] _migration_checkpoint 테이블 생성
- [ ] 스크립트 3단계 상태 머신(pending → uploaded → url_updated)
- [ ] 재실행 멱등성 보장(url_updated 제외)

### 7-B. 검증
- [ ] 체크포인트 정합성(중복/누락 없음)
- [ ] 사진 URL 404 0건(샘플링 + 핵심 화면)
- [ ] 하드코딩 경로 grep 0건(Phase 6 게이트와 결합)

---

## Phase 8 체크리스트 — 검증 + CI/CD + 모니터링 (Rev.4)

### 8-A. CI/CD — §11
- [ ] CI: install → tsc → eslint → vitest → next build 순서 고정
- [ ] Sentry 설정(server/client) 적용
- [ ] must-check-auth ESLint 룰 적용

### 8-B. 운영 가드 — §11.4
- [ ] Tier1 p95 목표/측정/실패 기준 런북 반영
- [ ] 대량 E2E 시 DB 커넥션 폭주 방지(순차/Pooler)

### 8-C. 최종 게이트
- [ ] next build 성공
- [ ] vitest 전체 PASS
- [ ] /api/health 정상(토큰/외부 축소 응답 포함)
- [ ] 전환 런북(§14) 스모크 6건 드라이런 가능 상태

---

## V2→V3 전환 런북 체크(요약) — §14

- [ ] T-60: next build + vitest PASS
- [ ] T-0: V2 maintenance mode
- [ ] T+2: 정합성 쿼리 5개 “0” 확인
- [ ] T+10: 스모크 6건
- [ ] 1건이라도 실패 시 즉시 롤백