# Phase 6: 작업 체크리스트

---

## Session A: 선행 작업 ✅ 완료

### A-1. 의존성 설치
- [x] lucide-react 설치
- [x] clsx 설치
- [x] recharts 설치
- [x] swr 설치
- [x] 결정 완료: 순수 Tailwind, useState+AuthContext, SWR, proxy.ts+Server redirect, 다크모드 미지원

### A-2. API 클라이언트
- [x] `lib/api/client.ts` — fetch 래퍼 (get/post/patch/delete + 타임아웃 30초 + APIError)

### A-3. 공유 컴포넌트 8개 + 유틸/훅 4개 (= 12개)
- [x] `components/TableShell.tsx` — 제네릭 테이블
- [x] `components/Modal.tsx` — 모달 래퍼
- [x] `components/FormField.tsx` — 라벨+입력+에러
- [x] `components/Button.tsx` — 버튼 (variant, loading)
- [x] `components/Toast.tsx` — 토스트 알림
- [x] `components/AdminSidebar.tsx` — 네비게이션
- [x] `components/AdminHeader.tsx` — 헤더+로그아웃
- [x] `components/StatCard.tsx` — 통계 카드
- [x] `components/StatusBadge.tsx` — 상태 뱃지 (15상태)
- [x] `components/SearchInput.tsx` — 디바운스 검색
- [x] `components/Pagination.tsx` — 페이지네이션
- [x] `hooks/useDebounce.ts` — 디바운스 훅
- [x] `hooks/useApi.ts` — SWR 기반 API 훅

### A-4. 레이아웃
- [x] `app/admin/layout.tsx` — 루트 레이아웃 (메타데이터만)
- [x] `app/admin/(dashboard)/layout.tsx` — 인증 체크 + 사이드바 + 헤더
- [x] `app/admin/login/page.tsx` — 로그인 (금색 blur 카드)

### A-검증
- [x] tsc --noEmit 0건
- [ ] 로그인 → 대시보드 리다이렉트 동작 (Session B에서 dashboard 생성 후 확인)

### A 산출물: 16파일
```
lib/api/client.ts
components/Button.tsx, Modal.tsx, FormField.tsx, Toast.tsx
components/StatCard.tsx, StatusBadge.tsx, TableShell.tsx
components/SearchInput.tsx, Pagination.tsx
components/AdminSidebar.tsx, AdminHeader.tsx
hooks/useDebounce.ts, useApi.ts
app/admin/layout.tsx, app/admin/(dashboard)/layout.tsx, app/admin/login/page.tsx
```

---

## Session B: Tier 1 핵심 페이지 ✅ 완료

### B-0. 공유 상수/훅
- [x] `lib/constants/measurement-fields.ts` — 14카테고리 프리셋
- [x] `hooks/useInspectionFlow.ts` — 위탁 검수 7단계 상태머신
- [x] `hooks/useOrderHandlers.ts` — 주문 5핸들러

### B-1. admin/dashboard
- [x] StatCard 4개 (주문/위탁/정산/매출)
- [x] 최근 활동 목록 (RecentActivity.tsx)

### B-2. admin/consignments
- [x] ConsignmentTable (12컬럼)
- [x] ConsignmentStats (상태별 통계)
- [x] ConsignmentClient (통합 관리)
- [x] TabSelector (6탭)
- [x] ActionCell (상태별 버튼)
- [x] InspectionModal (검수 7단계)
- [x] ExcelUploadButton (대량 등록)

### B-3. admin/orders
- [x] OrderTable (10컬럼)
- [x] OrderInspectionModal 2단계 (검수+실측)
- [x] MeasurementStep (14카테고리)
- [x] InspectionStep (등급별 가격 — derivePrices)
- [x] HoldModal (고객 동의 추적)
- [x] OrderActionCell (상태별 버튼)
- [x] OrderClient (통합 관리)

### B-4. admin/settlement
- [x] 정산 목록 테이블 + 상태 필터 (SettlementClient)

### B-5. admin/settlement/workflow
- [x] SettlementStepper (6단계 표시)
- [x] Step1_SalesLedger (매출장 업로드)
- [x] Step2_NaverSettle (네이버 정산 업로드)
- [x] Step3_Matching + ManualMatchPanel
- [x] Step4_Queue (대기열)
- [x] Step5_Payout (지급 + 엑셀)
- [x] Step6_Review (최종 검토 + 지급)
- [x] WorkflowClient (6단계 라우터)

### B-6. Public 페이지
- [x] `/consignment/adjust/[token]/page.tsx` — 가격조정 (3선택지)
- [x] `/orders/[productId]/hold/page.tsx` — 주문보류 (아이템별 동의/거부)

### B-검증
- [x] tsc --noEmit 0건
- [ ] 각 페이지 렌더링 확인
- [ ] Public 페이지 토큰 없이 접근 → 에러 표시

### B 산출물: 41파일
```
lib/constants/measurement-fields.ts
hooks/useInspectionFlow.ts, useOrderHandlers.ts
dashboard/page.tsx, DashboardClient.tsx, RecentActivity.tsx
consignments/page.tsx, ConsignmentClient.tsx, ConsignmentStats.tsx,
  ConsignmentTable.tsx, TabSelector.tsx, ActionCell.tsx,
  InspectionModal.tsx, ExcelUploadButton.tsx
orders/page.tsx, OrderClient.tsx, OrderTable.tsx, OrderActionCell.tsx,
  OrderInspectionModal.tsx, InspectionStep.tsx, MeasurementStep.tsx, HoldModal.tsx
settlement/page.tsx, SettlementClient.tsx
settlement/workflow/page.tsx, WorkflowClient.tsx, SettlementStepper.tsx,
  Step1_SalesLedger.tsx, Step2_NaverSettle.tsx, Step3_Matching.tsx,
  ManualMatchPanel.tsx, Step4_Queue.tsx, Step5_Payout.tsx, Step6_Review.tsx
consignment/adjust/[token]/page.tsx, AdjustClient.tsx
orders/[productId]/hold/page.tsx, HoldClient.tsx
```

---

## Session C: Tier 2+3 나머지

### C-1. admin/photos
- [ ] 3탭 UI (원본/처리됨/상품별)
- [ ] ClassifyMatchModal (SSE 진행률)
- [ ] 이미지 갤러리 그리드

### C-2. admin/products
- [ ] ProductTable (10컬럼 + 6상태)
- [ ] 네이버 대량 등록 엑셀 다운로드
- [ ] 브랜드 검색

### C-3. admin/notifications
- [ ] SendTab (프로모션 3단계)
- [ ] HistoryTab (이력 7열 + 필터)
- [ ] ManualSendModal (수동 3단계)
- [ ] LogDetailModal (상세 + 재발송)

### C-4. admin/settlement/history
- [ ] 기간별 이력 테이블

### C-5. admin/settlement/sellers
- [ ] 셀러 목록 + 드릴다운

### C-6. admin/sales
- [ ] DateRangeFilter + SalesChart + StatCard 3개

### C-7. admin/sales/erp
- [ ] 기간 선택 + 엑셀 다운로드

### C-8. admin/sales/ledger
- [ ] 월별 집계 뷰

### C-9. admin/database
- [ ] 시세 조회 (브랜드 검색 + 카드형)

### C-검증
- [ ] tsc --noEmit 0건
- [ ] 11개 페이지 렌더링 확인

---

## Session D: 전수 검증

### D-1. phase-checklists.md Phase 6 게이트
- [ ] 17개 페이지 존재 확인
- [ ] `style={{` 정적 인라인 0건
- [ ] Public RLS 동작 확인
- [ ] `getPhotoUrl()` 사용 확인
- [ ] 하드코딩 경로 0건

### D-2. architecture-spec 준수
- [ ] 컴포넌트에서 서비스 직접 import 0건
- [ ] 컴포넌트 150줄 / 페이지 100줄 / 훅 80줄 준수
- [ ] `any` 타입 0건

### D-3. 빌드
- [ ] tsc --noEmit 0건
- [ ] ESLint 0 warnings
- [ ] next build 성공

### D-4. 등급 2 검증 (10회)
- [ ] 딥시뮬레이션 × 2
- [ ] 엣지케이스 × 2
- [ ] 디펜던시 × 2
- [ ] 레드팀 × 2
- [ ] 아키텍트 리뷰 × 2
