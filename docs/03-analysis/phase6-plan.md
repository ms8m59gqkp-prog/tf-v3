# Phase 6: 프론트엔드 구현 계획

**변경 레벨**: L1 (UI)
**위험 등급**: 등급 2 (중위험) — 새 컴포넌트/페이지 추가, RLS 기반 Public 페이지 포함
**기준 문서**: plan5.md §9, architecture-spec.md §3.3/§3.4, phase-checklists.md Phase 6

---

## 0. 현황 팩트

### 존재하는 것
- API 라우트 52개 (route.ts) (Phase 5 완료)
- 서비스 20개, 리포지토리 34개, 트랜잭션 3개 (Phase 2-4 완료)
- Next.js 16.1.6 + React 19.2.3 + Tailwind CSS 4
- xlsx 패키지 설치됨
- `app/layout.tsx` — 기본 레이아웃 (Geist 폰트)
- `app/globals.css` — Tailwind v4 기본 설정
- `app/page.tsx` — 기본 홈페이지

### 존재하지 않는 것
- page.tsx 0개 (admin/*, public 모두 미생성)
- components/ 디렉토리 0개
- hooks/ 디렉토리 0개
- lib/api/client.ts (브라우저용 fetch 래퍼) 없음
- UI 라이브러리 (shadcn/radix/lucide) 미설치
- recharts (차트) 미설치
- 사이드바/레이아웃 컴포넌트 없음

---

## 1. 아키텍처 규칙 (architecture-spec 준수)

### 레이어 배치
| 분류 | 레이어 | 경로 |
|------|--------|------|
| 공유 컴포넌트 | L2 | `components/` |
| 커스텀 훅 | L2 | `hooks/` |
| 페이지 | L3 | `app/admin/**/page.tsx`, `app/consignment/**/page.tsx`, `app/orders/**/page.tsx` |
| API 클라이언트 | L2 | `lib/api/client.ts` |

### 의존성 규칙
- L2(UI) → L3(Entry) HTTP 호출만 허용
- L2는 L1(Service/Repo) 직접 import 금지
- 페이지(L3)는 서비스(L1) 직접 import 금지 — 반드시 API 경유
- 단, L3(Page) → L1(Service) 직접 호출 허용 (architecture-spec §2.1)

### 줄수 제한
- 컴포넌트: 150줄 (service 기준 적용)
- 페이지(page.tsx): 100줄 (route.ts 기준 적용)
- 훅: 80줄 (함수 기준 적용)
- 초과 시 분리 필수

### 금지 사항
- `style={{}}` 정적 인라인 스타일 금지 (Tailwind 사용)
- `alert()`, `confirm()` 금지 (커스텀 모달/토스트 사용)
- `/uploads/` 하드코딩 금지 (`getPhotoUrl()` 사용)
- `any` 타입 금지

---

## 2. 선행 작업 (Phase 6 시작 전 필수)

### 2-1. 의존성 설치
```bash
# UI 컴포넌트
pnpm add lucide-react clsx
# 차트 (매출 대시보드용)
pnpm add recharts
# 엑셀 다운로드 (이미 xlsx 있음, 확인만)
```

결정: 순수 Tailwind (shadcn/radix 미사용). SWR 추가 설치 필요.
```bash
pnpm add swr
```

### 2-2. API 클라이언트 생성
```
lib/api/client.ts — fetch 래퍼 (V2 패턴 참조)
- api.get<T>(url), api.post<T>(url, body), api.patch<T>(url, body), api.delete<T>(url)
- 타임아웃 30초 (AbortController)
- 에러: APIError { message, status }
- 쿠키 자동 포함 (credentials: 'include')
```

### 2-3. 어드민 레이아웃
```
app/admin/layout.tsx — 사이드바 + 헤더 + 콘텐츠 영역
components/AdminSidebar.tsx — 네비게이션 (V2 메뉴 구조)
components/AdminHeader.tsx — 로그아웃 버튼 + 현재 페이지명
```

---

## 3. 공유 컴포넌트 + 유틸 (8개 컴포넌트 + 4개 유틸/훅 = 12개, 선행 생성)

plan5.md §13.3 Day 6 기준 공유 컴포넌트 8개 + 추가 유틸/훅 4개. 모든 페이지가 의존하므로 반드시 선행.

| # | 컴포넌트 | 역할 | V2 참조 |
|---|---------|------|---------|
| 1 | `TableShell<T>` | 제네릭 테이블 (columns, rows, keyField, onRowClick) | v2-ref-notification-auth.md — 114줄 |
| 2 | `Modal` | 모달 래퍼 (open, onClose, title, children) | 자체 설계 |
| 3 | `FormField` | 라벨 + 입력 + 에러 메시지 | 자체 설계 |
| 4 | `Button` | 버튼 (variant: primary/secondary/danger, loading, disabled) | 자체 설계 |
| 5 | `Toast` | 알림 토스트 (success/error/info, 자동 닫힘) | alert/confirm 대체 |
| 6 | `AdminLayout` | 사이드바 + 헤더 + 콘텐츠 | 위 2-3 참조 |
| 7 | `StatCard` | 통계 카드 (title, value, subtitle, trend) | v2-ref-notification-auth.md — 59줄 |
| 8 | `StatusBadge` | 상태별 색상 뱃지 (15개 상태-색상 매핑) | v2-ref-notification-auth.md — 91줄 |

추가 공통:
| # | 유틸/훅 | 역할 |
|---|--------|------|
| 9 | `SearchInput` | 디바운스 300ms 검색 입력 |
| 10 | `Pagination` | 페이지네이션 컨트롤 (page, pageSize, total) |
| 11 | `hooks/useApi` | SWR 패턴 훅 (GET 캐싱 + mutate) 또는 단순 fetch 훅 |
| 12 | `hooks/useDebounce` | 디바운스 훅 (300ms) |

---

## 4. 페이지 구현 (17개 = 15 어드민 + 2 Public)

### Tier 1 — CRITICAL (8개, 선행)

#### 4-1. admin/login (인증 진입점)
- V2 참조: v2-ref-notification-auth.md — 286줄 금색 테마 blur 카드
- 구현: ID/PW 폼 → POST /api/admin/auth/login → 쿠키 설정 → /admin/dashboard 리다이렉트
- 특이사항: 인증 없이 접근 가능한 유일한 어드민 페이지

#### 4-2. admin/dashboard (메인 대시보드)
- V2 참조: StatCard 4개 (주문, 위탁, 정산, 매출)
- 구현: 각 도메인 API 요약 조회 → StatCard 4개 + 최근 활동 목록
- 데이터 소스: 각 list API의 total 값 활용

#### 4-3. admin/consignments (위탁 관리)
- V2 참조: v2-ref-consignment.md — 12컬럼 테이블 + 6탭 + 통계카드 + 검수 7단계 모달
- 구현:
  - ConsignmentTable: 12컬럼 (TableShell 기반)
  - ConsignmentStats: 상태별 통계 (StatCard)
  - ConsignmentFilters: 상태/검색 필터
  - MainTabSelector: 전체/신청/검수/보류/반려/승인
  - InspectionModal: 검수 7단계 (question→measurement→...) — V2 191줄 훅
  - ExcelUploadButton: 엑셀 대량 등록 → POST /api/admin/consignments/bulk
  - ActionCell: 상태별 버튼 (수령확인/검수시작/검수모달/반송시작 등)
- 분리 필수: ConsignmentTable.tsx (V2 457줄 → 컴포넌트 분리)

#### 4-4. admin/orders (주문 관리)
- V2 참조: v2-ref-orders.md — 10컬럼, 검수 2단계 모달, 보류 모달
- 구현:
  - OrderTable: 10컬럼 (TableShell 기반)
  - InspectionModal 2단계: Step1 검수(등급 N/S/A/B + PriceAdjustmentSection) + Step2 실측(MeasurementStep 14카테고리)
  - HoldModal: 고객 동의 상태 + SMS 재발송
  - hooks/useOrderHandlers: 5핸들러 (statusChange, inspectionComplete, hold, measurementSave, measurementCard)
- 상수: MEASUREMENT_FIELDS 14카테고리 (V2 동일)

#### 4-5. admin/settlement (정산 목록)
- V2 참조: v2-ref-settlement.md — 정산 목록 테이블
- 구현: 정산 목록 + 상태 필터 + 페이지네이션

#### 4-6. admin/settlement/workflow (정산 워크플로우 — 최핵심)
- V2 참조: v2-ref-settlement.md — 6단계 스텝퍼
- 구현:
  - SettlementStepper: 6단계 스텝 표시
  - Step1 SalesLedgerStep: 매출장 엑셀 업로드 + 위탁 감지
  - Step2 NaverSettleStep: 네이버 정산 엑셀 업로드
  - Step3 MatchingStep: 자동매칭 결과 + ManualMatchPanel (좌우 분할)
  - Step4 QueueStep: 셀러별 그룹화 큐
  - Step5 PayoutStep: 지급 처리 + 엑셀 다운로드
  - Step6 ReviewStep: 최종 검토 + 확정
- 복잡도: 이 페이지가 전체 Phase 6에서 가장 복잡. 각 Step을 별도 컴포넌트로 분리 필수.

#### 4-7. /consignment/adjust/[token] (Public: 가격조정)
- V2 참조: v2-ref-consignment.md — 토큰 기반 위탁 조회 + 3선택지
- 구현:
  - 토큰으로 GET /api/consignment/adjust/[token] 호출
  - 3선택지: accepted(수락) | counter(역제안 금액 입력) | cancelled(거부)
  - POST로 응답 전송
- 보안: RLS 기반 anon 접근, 토큰 만료 체크 (G6-4 구현 완료)
- 개인정보: customerName 마스킹 (privacy.ts 활용)

#### 4-8. /orders/[productId]/hold (Public: 주문보류)
- V2 참조: v2-ref-orders.md — 고객 동의 페이지
- 구현:
  - 토큰으로 GET /api/orders/[productId]/hold 호출
  - 보류 아이템 목록 + 사유 + 조정 가격 표시
  - 동의/거부 버튼
- 보안: RLS + 토큰 + rate limit (이미 route에 구현됨)

### Tier 2 — HIGH (6개)

#### 4-9. admin/photos (사진 관리)
- V2 참조: v2-ref-photos.md — 3탭 (원본/처리됨/상품별)
- 구현:
  - 3탭 UI + 갤러리 그리드
  - ClassifyMatchModal: SSE 진행률 + Claude Vision 분류 결과
  - 드래그앤드롭 파일 순서 변경
  - 이미지 편집 진행률 표시
- 이미지 URL: `getPhotoUrl()` 필수 사용

#### 4-10. admin/products (상품 관리)
- V2 참조: v2-ref-products-sales.md — 6상태, 10컬럼
- 구현:
  - ProductTable: 10컬럼 + 6상태 필터
  - 네이버 대량 등록 버튼 → 엑셀 다운로드
  - 브랜드 초성 검색

#### 4-11. admin/notifications (알림 관리)
- V2 참조: v2-ref-notification-auth.md — 2탭 (SendTab + HistoryTab)
- 구현:
  - SendTab: 프로모션 발송 3단계 (target→compose→confirm)
  - HistoryTab: 발송 이력 7열 테이블 + 필터(상태/이벤트/검색)
  - ManualSendModal: 수동 발송 3단계
  - LogDetailModal: 상세 + 재발송 버튼

#### 4-12. admin/settlement/history (정산 이력)
- 기간별 정산 이력 테이블 + 필터

#### 4-13. admin/settlement/sellers (판매자별 정산)
- 셀러 목록 + 셀러별 정산 내역 드릴다운

#### 4-14. admin/sales (매출 관리)
- V2 참조: v2-ref-products-sales.md — DateRange + Chart + 요약
- 구현:
  - DateRangeFilter
  - SalesChart (recharts 라인/바)
  - StatCard 3개 (총 매출, 건수, 평균 단가)

### Tier 3 — MEDIUM/LOW (3개)

#### 4-15. admin/database (DB 관리/시세 조회)
- V2 참조: v2-ref-products-sales.md — market_prices 대시보드
- 브랜드 자동완성 + 16카테고리 필터 + 카드형 결과

#### 4-16. admin/sales/erp (ERP 연동)
- 기간 선택 → 엑셀 다운로드

#### 4-17. admin/sales/ledger (매출 원장)
- 월별 집계 뷰 (API: GET /api/admin/sales/ledger 이미 구현됨)

---

## 5. 구현 순서 (의존성 기반)

```
Session A: 선행 작업 (공유 컴포넌트 선행 필수)
───────────────────────────────────────────
Step 1. 의존성 설치 + lib/api/client.ts
Step 2. 공유 컴포넌트 8개 + 유틸/훅 4개 (TableShell, Modal, FormField, Button,
        Toast, AdminLayout, StatCard, StatusBadge + SearchInput, Pagination,
        hooks/useApi, hooks/useDebounce)
Step 3. admin/layout.tsx (사이드바 + 헤더)
Step 4. admin/login (인증 진입점, layout 의존)
───────────────────────────────────────────

Session B: Tier 1 핵심 (Team Alpha)
───────────────────────────────────────────
Step 5. admin/dashboard (StatCard 활용)
Step 6. admin/consignments (가장 큰 페이지, 검수 7단계 포함)
Step 7. admin/orders (검수 2단계 + 보류 모달)
Step 8. admin/settlement + admin/settlement/workflow (6단계 스텝퍼)
Step 9. Public 2개 (/consignment/adjust, /orders/hold)
───────────────────────────────────────────

Session C: Tier 2+3 나머지 (Team Beta, Session B 공유 컴포넌트 완성 후)
───────────────────────────────────────────
Step 10. admin/photos (3탭 + SSE)
Step 11. admin/products (6상태 + 네이버 등록)
Step 12. admin/notifications (2탭 + 3단계 발송)
Step 13. admin/settlement/history + admin/settlement/sellers
Step 14. admin/sales + admin/sales/erp + admin/sales/ledger
Step 15. admin/database
───────────────────────────────────────────

Session D: 전수 검증
───────────────────────────────────────────
Step 16. 17개 페이지 렌더링 전수 확인
Step 17. RLS Public 페이지 anon 동작 검증
Step 18. tsc --noEmit 0건 + ESLint 0건
Step 19. next build 성공
───────────────────────────────────────────
```

---

## 6. 검증 기준 (phase-checklists.md + process-checklist.md)

### phase-checklists.md Phase 6 게이트
- [ ] 전체 17 페이지 존재
- [ ] 정적 inline style 금지 (`style={{` grep 0건, 동적 제외)
- [ ] Public 페이지 RLS 기반 동작 확인
- [ ] 이미지 `getPhotoUrl()` 사용
- [ ] 하드코딩 경로 0건

### architecture-spec 준수
- [ ] L2→L3 HTTP 호출만 (컴포넌트에서 직접 서비스 import 0건)
- [ ] 컴포넌트 150줄 이하
- [ ] 페이지 100줄 이하
- [ ] 훅 80줄 이하
- [ ] `any` 타입 0건
- [ ] `/uploads/` 하드코딩 0건

### process-checklist.md 공통 게이트
- [ ] 빌드 성공 (`next build`)
- [ ] tsc --noEmit 0건
- [ ] ESLint 0 warnings

### analysis-techniques.md 등급 2 검증 (최소 10회)
```
[기획자] ─── 병렬 1
  딥시뮬레이션 × 2회 (정상 렌더링 / API 실패 시 UI)

[빌더] ─── 병렬 2
  엣지케이스 × 2회 (빈 데이터 / 대량 데이터)
  디펜던시 × 2회 (컴포넌트 간 의존 / API 변경 영향)

[테스터] ─── 병렬 3
  레드팀 × 2회 (XSS 입력 / CSRF)

→ 완료 후

[디렉터] ─── 순차
  아키텍트 리뷰 × 2회 (레이어 준수 / 확장성)
```

---

## 7. V2 핵심 UX 유지 사항 (각 V2 ref 종합)

V2에서 반드시 유지해야 하는 워크플로우/UX:

| # | 도메인 | 유지 사항 |
|---|--------|----------|
| 1 | 위탁 | 12컬럼 테이블 + 상태별 ActionCell 버튼 텍스트 동일 |
| 2 | 위탁 | 검수 7단계 플로우 (question→measurement→...) |
| 3 | 위탁 | 엑셀 대량 등록 + "위탁." 접두사 감지 |
| 4 | 주문 | 검수 2단계 (검수+실측) 모달 내 단계 유지 |
| 5 | 주문 | 등급 4단계 (N/S/A/B) + 가격 자동 계산 |
| 6 | 주문 | 실측 14카테고리 한글 키 프리셋 |
| 7 | 정산 | 6단계 순서: 매출장→네이버→매칭→큐→지급→검토 |
| 8 | 정산 | 수동 매칭 좌우 분할 패널 |
| 9 | 정산 | 2시트 엑셀 (건별 상세 + 셀러별 요약) |
| 10 | 사진 | 3탭 구조 + SSE 분류 진행률 |
| 11 | 상품 | 6상태 관리 + 네이버 대량 등록 |
| 12 | 알림 | 2탭 (발송+이력) + 프로모션 3단계 발송 |
| 13 | 알림 | SMS 6종 템플릿 트리거 |
| 14 | 로그인 | 금색 테마 blur 카드 디자인 |
| 15 | 공통 | StatCard (trend 표시) + StatusBadge (15상태) |

---

## 8. 파일 수 추정

| 분류 | 파일 수 | 비고 |
|------|---------|------|
| 공유 컴포넌트 8 + 유틸/훅 4 | 12 | plan5.md 8개 + SearchInput, Pagination, useApi, useDebounce |
| 페이지 (page.tsx) | 17 | plan5.md §9.1 기준 |
| 페이지별 컴포넌트 | ~35 | 각 페이지의 하위 컴포넌트 (Table, Modal, Filter 등) |
| 훅 | ~10 | useApi, useDebounce, useOrderHandlers, useConsignmentHandlers 등 |
| 유틸/상수 | ~5 | api/client.ts, MEASUREMENT_FIELDS, 카테고리 상수 등 |
| **합계** | **~79** | |

---

## 9. 사용자 결정 완료 (2026-03-13)

| # | 항목 | 결정 | 근거 |
|---|------|------|------|
| D1 | UI 라이브러리 | 순수 Tailwind | v4 네이티브, shadcn v4 미지원, 의존성 0 |
| D2 | 상태 관리 | useState + AuthContext | 글로벌 상태 세션 1개뿐 |
| D3 | 데이터 페칭 | SWR | Next.js 궁합, GET 중심 CRUD, ~4KB |
| D4 | 인증 리다이렉트 | proxy.ts(API) + Server Component redirect(페이지) | auth.ts bcryptjs → Edge 불가, proxy.ts 이미 존재 |
| D5 | 다크 모드 | 미지원 | 내부 어드민 1~3명, 작업량 절감 |

---

## 10. 리스크

| # | 리스크 | 영향 | 대응 |
|---|--------|------|------|
| 1 | settlement/workflow 복잡도 | 6단계 × 각 Step 컴포넌트 = 파일 증가 | Step별 컴포넌트 분리, 공유 로직 훅으로 추출 |
| 2 | SSE 스트리밍 (사진 분류) | 브라우저 호환성, 연결 끊김 | EventSource 폴리필, 재연결 로직 |
| 3 | 엑셀 파싱 (매출장/네이버) | 대용량 파일 시 브라우저 메모리 | Web Worker 또는 서버사이드 파싱 (현재 API route에서 처리) |
| 4 | 17페이지 동시 개발 시 충돌 | 공유 컴포넌트 변경 충돌 | 공유 컴포넌트 선행 완성 후 페이지 착수 |
