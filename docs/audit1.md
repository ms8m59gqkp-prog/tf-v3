# Performance Deep Audit: plan3.md vs v5-combined-research.md

**작성일**: 2026-03-01
**목적**: plan3.md(구현 플랜)와 v5-combined-research.md(통합 리서치)를 성능 관점에서 깊이 비교 분석
**방법**: 두 문서를 전문 읽기 후 성능 관련 항목별 차이점 식별

---

## 1. 문서 성격 차이 (근본적 차이)

| 차원 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **역할** | 진단서 (무엇이 문제인가) | 처방전 (어떻게 고치는가) |
| **이슈 수** | ~220건 고유 (중복 제거 전 237건) | 118건 고유 (220건에서 재선별) |
| **성능 다루는 깊이** | 문제 증상 + 영향 범위 서술 | 구체적 해결 코드/SQL + Phase별 검증 게이트 |
| **검증 수단** | 없음 (보고서) | 시뮬레이션 3회 + 자동검증 스크립트 12개 |
| **Rev.2 정정** | 없음 | 30건 정정 반영 (검증 에이전트 4개 결과) |

---

## 2. 성능 관련 차이점 상세 분석

### 2.1 DB 쿼리 성능

#### 1000행 사일런트 절삭 (DAT-01)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **문제 기술** | Supabase 기본 1000행 제한으로 5개 쿼리 사일런트 절삭 나열 (orders, naver_settlements, sales_records, products, detectConsignmentSales) | 동일 문제 인식 + `.range()` 페이지네이션 강제 + 카운트 전용 쿼리 분리 명시 |
| **해결 상세도** | "V3 해결: .range() 페이지네이션 적용" (1줄) | Phase 2 리포지토리 핵심 원칙 #3으로 모든 목록 쿼리에 `.range()` 강제, Phase 8 검증 스크립트에 grep 자동 확인 포함 |
| **성능 영향 분석** | 비즈니스 규모 성장 시 시한폭탄이라는 경고만 | 리포지토리 패턴 도입으로 전체 .select() 호출을 grep 검증 가능하게 구조화 |

**차이 핵심**: v5는 "절삭된다"는 사실만, plan3는 "어떻게 구조적으로 방지하고 검증할 것인가"까지 설계

#### .in() 100개 제한 (DAT-16)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **문제 기술** | 영향 라우트 6개 나열 (consignments, bulk-send, upload-naver-settle 등) | `chunkArray(100)` 유틸 함수 생성 + lib/utils/chunk.ts 경로 확정 |
| **해결 상세도** | "chunkIn() 생성" (1줄) | Phase 2 리포지토리 핵심 원칙 #2로 모든 .in() 호출에 chunkArray(100) 적용, Phase 8 grep 검증 |
| **구현 위치** | 미지정 | lib/utils/chunk.ts 명시 |

**차이 핵심**: plan3는 유틸리티 파일 경로까지 확정, 리포지토리 계층에서 일괄 적용하는 아키텍처적 해결

---

### 2.2 동시성 / 레이스 컨디션 성능

#### 정산 이중 생성 (FIN-01)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **문제 분석** | 비원자적 read→calculate→update 패턴 + disabled={loading} 단일 세션 보호만 설명 | 동일 문제 + RPC SQL 전문 (create_settlement_with_items) 38줄 제공 |
| **해결 방식** | "Supabase RPC FOR UPDATE 잠금 + 원자적 트랜잭션" (1줄) | 5-Step RPC: FOR UPDATE 잠금 → 잠금 실패 검증 → 정산 생성 → 항목 연결 → 상태 업데이트, 완전한 SQL 코드 |
| **교착 감지** | 미언급 | Phase 0 실패 시나리오에 "FOR UPDATE 순서 불일치 → id 오름차순 잠금 보장" 명시 |
| **성능 테스트** | 미언급 | Phase 0 검증 게이트: "RPC 테스트: SELECT create_order_with_items(...) → uuid 반환" + "RPC 롤백 테스트: 의도적 실패 → 고아 데이터 0건" |

**차이 핵심**: v5는 "FOR UPDATE 쓰면 해결"이라는 방향만, plan3는 교착(deadlock) 방지 순서까지 고려한 완전한 SQL 제공

#### 위탁 상태 전환 레이스 (DAT-08)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **시나리오** | Admin A "완료" + Admin B "거절" 동시 → 고아 주문 | 동일 시나리오 + complete_consignment RPC 60줄 SQL 제공 |
| **해결 방식** | ".eq('status', expected) 포함" (1줄) | Step 1에서 FOR UPDATE + IF v_current_status != p_expected_status THEN RAISE EXCEPTION (낙관적 잠금 구현) |
| **복합 시나리오** | 시나리오 3 "영구 복구 불가 위탁"에서 DAT-04+DAT-08 조합만 서술 | 동일 + RPC 트랜잭션으로 5단계 원자화, 실패 시 전체 PostgreSQL 자동 롤백 |

**차이 핵심**: v5는 .eq() 조건 추가만, plan3는 트랜잭션 내부 예외 발생 시 자동 롤백까지 보장하는 완전한 구현

#### 워크플로 setTimeout 레이스 (NEW-13)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **발견** | CRITICAL — "setTimeout 콜백이 이미 변경된 상태 참조" | 동일 + Phase 6 정산 워크플로 섹션에서 해결 방안 구체화 |
| **해결** | 증상 기술만 | useWorkflowHandlers.ts(418줄) → 4개 훅으로 Phase별 분리 + setTimeout 레이스 수정 + 워크플로 상태 서버 동기화 |

**차이 핵심**: v5는 CRITICAL 라벨링만, plan3는 418줄 모놀리스를 80줄 단위 4개로 분리하는 구조적 해법

---

### 2.3 외부 서비스 타임아웃 / 네트워크 성능

#### 타임아웃 없는 외부 API 호출 (EXT-01)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **문제 범위** | PhotoRoom/Naver/Claude/Supabase 4개 서비스 각각 상세 서술 | 동일 4개 서비스 |
| **Claude API** | "65초 고정 대기, 지수 백오프 없음" | Phase 4 photo.service: AbortController + 30초 타임아웃 + 지수 백오프 3회 재시도 (NEW-07) |
| **PhotoRoom** | "readFileSync 50MB → 이벤트 루프 블로킹" | Phase 4 photo.service: Buffer 기반 파이프라인, fs 의존 제거 + 비동기화 |
| **해결 일관성** | 개별 서비스별 해결 나열 | photo.service.ts 단일 파일에서 모든 외부 서비스 호출 통합 관리 |

**차이 핵심**: v5는 서비스별 개별 문제 나열, plan3는 photo.service.ts라는 단일 서비스에서 타임아웃/재시도 패턴 통합

#### SMS dev mode 가짜 성공 (EXT-02)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **문제** | API키 미설정 시 {success: true} 반환 → 미발송인데 성공 처리 | 동일 |
| **해결** | "dev mode 제거 → requireEnv() 필수화" (1줄) | notification.service.ts에서 requireEnv('COOLSMS_API_KEY') + DB UPDATE 성공 확인 후에만 SMS 발송 (RUN-08) |

**차이 핵심**: plan3는 "DB 업데이트 성공 후에만 SMS 발송"이라는 순서 보장까지 추가

---

### 2.4 프론트엔드 렌더링 성능

#### inline style 1,061회 (FE-05)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **문제 상세** | 78개 파일, onMouseEnter/onMouseLeave hover 구현, 다크모드/반응형 불가 | 동일 |
| **해결** | "Tailwind v4 전면 전환" (1줄) | Phase 6 검증 게이트: `grep -r "style={{" app/ → 0건` 자동 검증, 브랜드 컬러/spacing 커스텀 토큰 |

**차이 핵심**: plan3는 grep 기반 자동 검증으로 0건 보장

#### Server Component 도입 (FE-04)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **문제** | "모든 어드민 페이지가 'use client'" | 동일 |
| **해결 후보** | ConsignmentStats, OrderStats, TableShell 등 → Server Component | StatusBadge, StatCard, Sidebar → Server Component 확정 |
| **Rev.2 정정** | 없음 | AdminLayout은 useState/useRouter 사용 → Client Component 유지 (검증 에이전트3 발견) |

**차이 핵심**: v5는 이상적 목표만 나열, plan3는 실제 코드 의존성 검증 후 AdminLayout은 Client Component 유지라는 현실적 결정

#### 코드 분할 (FE-07)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **대상** | ClassifyMatchModal, InspectionModal, ConsignmentInspectionModal | ClassifyMatchModal 명시 (next/dynamic) |
| **해결** | "next/dynamic 지연 로딩" (1줄) | Phase 6 검증 게이트에 "ClassifyMatchModal이 next/dynamic으로 로딩" 체크 항목 |

#### 테이블 가상화 (FE-13)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **문제** | 500+ 행 시 렌더링 성능 저하 | 성능 체크리스트 11-F에 포함 |
| **해결** | "react-virtual 또는 tanstack-virtual 적용" | 동일 (구체 라이브러리 미확정) |

**차이 핵심**: 이 부분은 두 문서 모두 동일 수준의 상세도

#### SSE 버퍼 무한 증가 (FE-12)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **문제** | ClassifyMatchModal SSE 버퍼 무제한 증가 → 장시간 메모리 이슈 | 동일 |
| **해결** | "버퍼 크기 제한 + 오래된 이벤트 드롭" | Phase 6 사진 관리 섹션에서 "SSE 버퍼 크기 제한 (FE-12)" 명시 |

---

### 2.5 DB 트랜잭션 성능

#### 비원자적 다단계 작업 3건 (DAT-05)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **문제** | 3건 나열 (위탁완료/주문생성/정산생성) + 실패 시 고아 데이터 | 동일 3건 |
| **해결** | "모두 Supabase RPC 트랜잭션" (1줄) | 3개 RPC SQL 전문 제공 (create_settlement_with_items 38줄, create_order_with_items 36줄, complete_consignment 64줄) |
| **롤백** | 미언급 | §15 마이그레이션 롤백 전략: RPC 생성 실패/교착/V2 호환 모두 대응 |

**차이 핵심**: plan3는 138줄의 완전한 RPC SQL + 롤백 전략. v5는 "RPC로 해결" 한 줄

#### Promise.all 결과 무시 3건 (DAT-06)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **문제** | auto-match/manual-match에서 한쪽만 업데이트 감지 불가 | 동일 |
| **해결** | "결과 검사 + 보상 트랜잭션. 최적으로는 RPC" | matching.service.ts에서 "Promise.all 결과 검사 필수 (DAT-06)" + "실패 시 보상 롤백" |

---

### 2.6 메모리 성능

#### Base64 이미지 DB 직접 저장 (FE-09)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **문제** | FileReader.readAsDataURL() → Base64 → DB 저장 → 스케일링 시 DB 용량 급증 | Phase 7 스토리지 마이그레이션에서 해결 |
| **해결** | "Supabase Storage 업로드 → URL만 DB 저장" | Supabase Storage 6개 버킷 설계 + 기존 URL 마이그레이션 스크립트 + 과도기 프록시 |

**차이 핵심**: plan3는 6개 버킷 설계 + URL 치환 스크립트 + 과도기 운영 전략까지

#### PhotoRoom 대용량 동기 읽기 (EXT-06)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **문제** | readFileSync 50MB → 이벤트 루프 블로킹 | 동일 |
| **해결** | "fs.readFile 비동기화. Buffer 기반 파이프라인" | photo.service processPhoto(): "Buffer 기반 파이프라인 (V2 fs 의존 제거)" |

#### Base64 이중 복사 (NEW-08)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **문제** | 원본 Buffer + Base64 문자열 메모리 이중 사용 | 직접 언급 없음 |

**차이 핵심**: v5에서 발견된 NEW-08은 plan3에서 직접 언급하지 않지만, Buffer 기반 파이프라인 전환으로 간접 해결

---

### 2.7 번들 크기 / 빌드 성능

#### sharp + puppeteer + WASM 번들 (ARC-13)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **문제** | sharp + @imgly WASM + xlsx + anthropic SDK 합산 → Vercel 50MB 함수 제한 초과 가능 | §17.2 기술 리스크로 관리 |
| **해결** | "번들 크기 모니터링. 불필요 의존성 정리" | "puppeteer 50MB 제한 → devDependencies 이동 or 대안" + "@imgly WASM → PhotoRoom API 전용 전환" |

**차이 핵심**: plan3는 각 의존성별 구체적 대안 제시

#### HEIC 변환 크로스플랫폼 (EXT-07)

| 항목 | v5-combined-research | plan3 |
|------|---------------------|-------|
| **문제** | /usr/bin/sips macOS 전용 → Linux/Vercel ENOENT 크래시 | 동일 |
| **해결** | "sharp로 변환 또는 process.platform 체크" | photo.service: "HEIC 변환: sharp 사용 (EXT-07 크로스플랫폼)" + Supabase Storage heic-converted 버킷 추가 |

---

## 3. plan3에만 존재하는 성능 관련 설계

| 항목 | 내용 | v5에 없는 이유 |
|------|------|---------------|
| **5레이어 엄격 단방향 의존성** | L0→L1→L2→L3→L4→L5, 레이어 건너뛰기 금지 | v5는 문제 진단서이므로 아키텍처 설계 범위 밖 |
| **Phase별 검증 게이트** | 각 Phase 완료 시 grep/tsc 기반 자동 검증 스크립트 | v5는 체크리스트만 제공 (§11), Phase별 게이트 없음 |
| **Phase별 실패 시나리오** | 각 Phase에서 실패 가능한 상황 + 대응책 테이블 | v5는 복합 실패 시나리오 7개만 (§10), Phase별 아님 |
| **의존성 그래프 + 병렬 배치** | Phase 2+3 병렬, Phase 6+7 병렬, Day별 Agent 배치 | v5에 시간 계획 자체가 없음 |
| **RPC SQL 전문** | 3개 RPC 함수 138줄 완전한 SQL | v5는 §11-G에서 축약된 RPC (골격만) |
| **Rev.2 정정 30건** | 검증 에이전트 4개의 사실 확인 결과 반영 | v5는 검증 에이전트 결과 미반영 (v5가 먼저 작성됨) |
| **시뮬레이션 3회 결과** | 순차 실행/파이프라인 전환/V3 롤백 시뮬레이션 | v5에 시뮬레이션 개념 없음 |
| **마이그레이션 롤백 전략** | UNIQUE 실패, RPC 실패, 전체 V3 롤백 각각 대응 | v5는 롤백 미언급 |
| **팀 모드 배치 (§16.3)** | Day 1~6 Agent A/B 역할 분배 | v5에 구현 계획 없음 |
| **100줄 코드 길이 제한** | 모든 route.ts/서비스/컴포넌트 100줄 이내 (타입/설정 200줄) | v5는 ARC-04에서 "35+건 위반" 보고만 |

---

## 4. v5에만 존재하는 성능 관련 항목

| 항목 | 내용 | plan3에서의 처리 |
|------|------|----------------|
| **복합 실패 시나리오 7개 전체** | 시나리오 1~7 상세 경로 + 탐지 난이도 | plan3는 Top 3만 축약 (§2.3) |
| **교차 참조 맵 (§12)** | 모든 이슈의 R1~R4+딥 출처 추적 | plan3는 이슈 ID만 참조 |
| **도메인별 심각도 분포 테이블** | 8개 도메인 x 4개 심각도 매트릭스 | plan3는 통합 통계만 (§2.1) |
| **82개 핸들러 상세 테이블** | 모든 API 핸들러 에러 테이블 (원본 참조) | plan3는 Tier 1/2/3 분류만 |
| **NEW-08 Base64 이중 복사** | photo-editor.ts에서 원본 Buffer + Base64 이중 복사 | plan3는 간접 해결 (Buffer 파이프라인) |
| **NEW-10 Puppeteer 좀비 프로세스** | browser.close() 실패 시 좀비 | plan3에서 직접 언급 없음 |
| **NEW-12 scoreCalculator 로컬 맵 drift** | 12개 로컬 브랜드맵이 메인 맵과 분리 | plan3에서 brand.ts 통합으로 간접 해결 |
| **NEW-17 JSON.parse try/catch 없음** | 다수 컴포넌트 | plan3에서 Zod 검증으로 간접 해결 |

---

## 5. 성능 관점 수치 비교

| 성능 지표 | v5 (진단) | plan3 (처방) | 갭 |
|----------|----------|-------------|-----|
| **RPC SQL 라인 수** | 0줄 (골격만) | 138줄 (완전한 함수) | plan3 압도 |
| **검증 스크립트** | 0개 | 12개 자동 + 11개 수동 | plan3 압도 |
| **실패 시나리오** | 7개 (복합) | Phase별 x 8Phase = 20+개 | plan3 3배 |
| **시뮬레이션** | 0회 | 3회 (25개 체크포인트) | plan3 유일 |
| **코드 예시** | 0줄 | ~500줄 (TypeScript + SQL) | plan3 유일 |
| **Rev.2 정정** | 0건 | 30건 (4개 검증 에이전트) | plan3 유일 |
| **롤백 전략** | 0건 | 3단계 (UNIQUE/RPC/전체) | plan3 유일 |
| **병렬 배치 계획** | 0건 | 4개 병렬 그룹 + Day별 배치 | plan3 유일 |

---

## 6. 성능 관련 불일치/모순점

### 6.1 매칭 허용 오차 (FIN-12)

| | v5 | plan3 |
|---|---|---|
| **진단** | "1원 쿠폰 차이로 매칭 실패. 허용 오차 없음" | 동일 |
| **해결** | "+-100원 허용 오차 설정" | **"AMOUNT_TOLERANCE = 0.00 (정확 일치, V2 동작 유지)"** |
| **판단** | v5가 +-100원 제안 | plan3 Rev.2에서 에이전트2가 V2 코드 확인 → 0.00 정확 일치가 V2 실제 동작이므로 유지 |

**결론**: plan3가 v5의 제안을 거부. V2 실제 코드를 확인한 결과 0.00이 의도된 동작이라 판단. **plan3가 데이터 기반 판단으로 더 정확**

### 6.2 이슈 건수 불일치

| | v5 | plan3 |
|---|---|---|
| **고유 이슈** | ~220건 (중복 제거 후) | 118건 (v5 기반 + 딥분석 18건 추가) |
| **CRITICAL** | 11건 | 11건 (일치) |
| **HIGH** | 55건 | 55건 (일치) |
| **API 핸들러 수** | "82 핸들러" | Rev.2 정정: "75 핸들러" (에이전트2 실제 카운트) |
| **route.ts 파일 수** | "57개 엔드포인트" | Rev.2 정정: "56개 route.ts" |

**결론**: plan3는 Rev.2 검증으로 수치를 보정. v5의 82→75, 57→56 정정

### 6.3 RPC SQL 불일치

| | v5 §11-G | plan3 §5 |
|---|---|---|
| **create_settlement_with_items** | 골격만 (FOR UPDATE 없음) | **FOR UPDATE 잠금 + 잠금 실패 검증 + 5-Step** |
| **create_order_with_items** | 골격만 (p_items jsonb[]) | **p_items jsonb + jsonb_array_elements로 반복** |
| **complete_consignment** | 골격만 (RETURNS void) | **RETURNS jsonb + 낙관적 잠금 + IF RAISE EXCEPTION** |

**결론**: v5의 RPC는 작동하지 않는 골격. plan3의 RPC는 실행 가능한 완전한 SQL

### 6.4 notification SMS 범위

| | v5 | plan3 |
|---|---|---|
| **v5 제안** | "모든 상태 전환에 이벤트 디스패처" | -- |
| **plan3 Rev.2** | -- | "V2는 received/completed 2개만 → V3 확장: received, inspecting, approved, rejected, completed (5개)" |

**결론**: v5는 "모든 상태"라고 했지만, plan3 Rev.2에서 pending/on_hold은 관리자 수동 전환이므로 SMS 불필요라고 판단. **plan3가 더 정밀**

---

## 7. 종합 판정

### v5-combined-research의 강점
1. **넓은 커버리지**: 220건의 이슈를 8개 도메인으로 분류하여 전수 조사
2. **복합 시나리오**: 7개의 카탈스트로피 시나리오로 이슈 간 상호작용 분석
3. **교차 참조**: 4개 리서치 + 딥분석의 출처 추적 가능
4. **독립적 진단**: 해결책에 편향되지 않은 순수한 문제 진단

### plan3의 강점
1. **실행 가능성**: 138줄 RPC SQL, 500줄 TypeScript 코드 예시가 즉시 구현 가능
2. **검증 가능성**: 12개 자동 검증 스크립트 + 3회 시뮬레이션으로 실패 확률 0 수렴
3. **정확성**: Rev.2로 30건 사실 오류 정정 (v5의 추측을 데이터로 교체)
4. **구조적 해결**: 5레이어 아키텍처 + 리포지토리 패턴 + Phase별 검증으로 문제 재발 방지
5. **운영 안전성**: 마이그레이션 롤백 3단계 + 파이프라인 전환 3단계 + V2 호환성 보장

### 성능 관점 최종 평가

| 평가 차원 | v5 점수 | plan3 점수 | 비고 |
|----------|---------|----------|------|
| 문제 발견 완전성 | 95/100 | 85/100 | v5가 더 넓은 범위 |
| 성능 해결책 구체성 | 30/100 | 92/100 | plan3 압도적 |
| 실행 가능성 | 15/100 | 95/100 | plan3만 즉시 구현 가능 |
| 검증 가능성 | 10/100 | 90/100 | plan3만 자동 검증 |
| 데이터 정확성 | 80/100 | 95/100 | plan3 Rev.2 정정 |
| 롤백/안전성 | 0/100 | 90/100 | plan3만 롤백 전략 |
| 병렬 실행 최적화 | 0/100 | 85/100 | plan3만 팀 배치 |

**결론**: v5는 뛰어난 진단서이고 plan3의 필수 입력물이나, 성능 관점의 해결 깊이에서 plan3가 압도적이다. plan3는 v5의 진단을 기반으로 검증 에이전트 4개로 사실 확인을 거쳐 30건을 정정했으며, 3회 시뮬레이션으로 실패 확률을 0으로 수렴시켰다. 다만 v5에서 발견된 NEW-08(Base64 이중 복사), NEW-10(Puppeteer 좀비), NEW-12(scoreCalculator drift), NEW-17(JSON.parse 미보호) 등은 plan3에서 직접 언급되지 않고 간접 해결에 의존하므로, 구현 시 명시적 확인이 필요하다.

---

*audit 기준: 성능(Performance) = DB 쿼리 효율, 동시성/레이스 컨디션, 네트워크 타임아웃, 프론트엔드 렌더링, 메모리 사용, 번들 크기, 트랜잭션 원자성*
