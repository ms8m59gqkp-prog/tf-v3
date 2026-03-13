# Phase 6 Session B: 상세 구현 계획

**작성일**: 2026-03-13
**변경 레벨**: L1 (UI)
**위험 등급**: 등급 2 (중위험)
**참조**: analysis-techniques.md, v2-ref-*.md 6종, architecture-spec.md

---

## 0. Session B 범위

Tier 1 핵심 페이지 8개 구현:
1. admin/dashboard
2. admin/consignments (+ 하위 컴포넌트 7개)
3. admin/orders (+ 하위 컴포넌트 6개)
4. admin/settlement (목록)
5. admin/settlement/workflow (6단계 스텝퍼)
6. /consignment/adjust/[token] (Public)
7. /orders/[productId]/hold (Public)

---

## 1. admin/dashboard

### 1-1. 컴포넌트 트리
```
page.tsx (Server Component, ~30줄)
└─ DashboardClient.tsx ('use client', ~80줄)
   ├─ StatCard × 4 (주문 수, 위탁 수, 미정산 건, 최근 매출)
   └─ RecentActivity.tsx (~70줄)
      └─ TableShell<ActivityRow>
```

### 1-2. API 매핑
| 컴포넌트 | API | 메서드 | 비고 |
|----------|-----|--------|------|
| StatCard (주문) | `/api/admin/orders?page=1&limit=1` | GET | total 값만 사용 |
| StatCard (위탁) | `/api/admin/consignments?page=1&limit=1` | GET | total 값만 사용 |
| StatCard (정산) | `/api/admin/settlements?status=draft&page=1&limit=1` | GET | total 값 |
| StatCard (매출) | `/api/admin/sales/ledger` | GET | 최근 월 합계 |
| RecentActivity | `/api/admin/orders?page=1&limit=5` | GET | 최근 5건 |

### 1-3. 파일 목록
| 파일 | 줄수 | 역할 |
|------|------|------|
| `app/admin/(dashboard)/dashboard/page.tsx` | ~30 | Server Component 래퍼 |
| `app/admin/(dashboard)/dashboard/DashboardClient.tsx` | ~80 | StatCard 4개 + 최근활동 |
| `app/admin/(dashboard)/dashboard/RecentActivity.tsx` | ~70 | 최근 주문/위탁 목록 |

---

## 2. admin/consignments

### 2-1. 컴포넌트 트리
```
page.tsx (~30줄)
└─ ConsignmentClient.tsx (~90줄)
   ├─ ConsignmentStats.tsx (~50줄) — StatCard × 상태별 집계
   ├─ TabSelector.tsx (~40줄) — 6탭 (전체/신청/검수/보류/반려/승인)
   ├─ SearchInput (공유)
   ├─ ConsignmentTable.tsx (~100줄) — 12컬럼 테이블
   │   ├─ StatusBadge (공유)
   │   └─ ActionCell.tsx (~80줄) — 상태별 버튼
   ├─ Pagination (공유)
   ├─ InspectionModal.tsx (~100줄) — 검수 진행 모달
   │   └─ hooks/useInspectionFlow.ts (~80줄) — 7단계 플로우 상태머신
   └─ ExcelUploadButton.tsx (~60줄) — 엑셀 대량 등록
```

### 2-2. V2 워크플로우 보존

**6탭 매핑** (V2 동일):
| 탭 | 필터 파라미터 | 설명 |
|-----|-------------|------|
| 전체 | (없음) | 모든 상태 |
| 신청 | `status=pending` | 접수 대기 |
| 검수 | `status=inspecting` | 검수 중 |
| 보류 | `status=on_hold` | 보류 상태 |
| 반려 | `status=rejected` | 반려됨 |
| 승인 | `status=approved` | 승인 완료 |

**12컬럼** (V2 동일 순서):
접수일, 접수번호, 고객명, 연락처, 브랜드, 카테고리, 상품명, 상태, 검수자, 예상가격, 확정가격, 액션

**검수 7단계 플로우**:
```
question (검수 결과?)
├─ "완료" → measurement (실측입력) → 승인 API
├─ "보류" → issue_type → hold_form → hold_sms → 보류 API
└─ "반려" → issue_type → reject_form → reject_address → reject_sms → 반려 API
```

**상태별 ActionCell 버튼**:
| 상태 | 버튼 |
|------|------|
| pending | 수령확인 |
| inspecting | 검수시작 |
| on_hold | 검수모달 (재검수) |
| approved | 완료처리 |
| rejected | (비활성) |

### 2-3. API 매핑
| 기능 | API | 메서드 |
|------|-----|--------|
| 목록 조회 | `/api/admin/consignments?status=&search=&page=&limit=` | GET |
| 단건 생성 | `/api/admin/consignments` | POST |
| 상세 조회 | `/api/admin/consignments/[id]` | GET |
| 상태 변경 | `/api/admin/consignments/[id]` | PATCH |
| 승인 처리 | `/api/admin/consignments/[id]/approve` | POST |
| 삭제 | `/api/admin/consignments/[id]` | DELETE |
| 대량 등록 | `/api/admin/consignments/bulk` | POST |

### 2-4. 파일 목록
| 파일 | 줄수 | 역할 |
|------|------|------|
| `app/admin/(dashboard)/consignments/page.tsx` | ~30 | Server Component |
| `app/admin/(dashboard)/consignments/ConsignmentClient.tsx` | ~90 | 메인 클라이언트 |
| `app/admin/(dashboard)/consignments/ConsignmentStats.tsx` | ~50 | 상태별 통계 |
| `app/admin/(dashboard)/consignments/ConsignmentTable.tsx` | ~100 | 12컬럼 테이블 |
| `app/admin/(dashboard)/consignments/ActionCell.tsx` | ~80 | 상태별 버튼 |
| `app/admin/(dashboard)/consignments/TabSelector.tsx` | ~40 | 6탭 |
| `app/admin/(dashboard)/consignments/InspectionModal.tsx` | ~100 | 검수 모달 |
| `app/admin/(dashboard)/consignments/ExcelUploadButton.tsx` | ~60 | 엑셀 업로드 |
| `hooks/useInspectionFlow.ts` | ~80 | 검수 7단계 상태머신 |

---

## 3. admin/orders

### 3-1. 컴포넌트 트리
```
page.tsx (~30줄)
└─ OrderClient.tsx (~90줄)
   ├─ SearchInput (공유)
   ├─ OrderTable.tsx (~100줄) — 10컬럼
   │   ├─ StatusBadge (공유)
   │   └─ OrderActionCell.tsx (~70줄) — 상태별 버튼
   ├─ Pagination (공유)
   ├─ OrderInspectionModal.tsx (~100줄) — 2단계 검수
   │   ├─ InspectionStep.tsx (~90줄) — Step1: 등급+가격
   │   └─ MeasurementStep.tsx (~100줄) — Step2: 14카테고리 실측
   ├─ HoldModal.tsx (~80줄) — 보류+고객동의
   └─ hooks/useOrderHandlers.ts (~80줄) — 5핸들러
```

### 3-2. V2 워크플로우 보존

**10 OrderStatus** (V2 정의):
APPLIED → SHIPPING → COLLECTED → INSPECTED → PRICE_ADJUSTING → RE_INSPECTED → IMAGE_PREPARING → IMAGE_COMPLETE → CONFIRMED / CANCELLED

**등급 4단계** (V2 derivePrices):
```
N(New): 원가 × 1.0
S(S급): 원가 × 0.85 (1000원 단위 반올림)
A(A급): 원가 × 0.70
B(B급): 원가 × 0.50
```

**실측 14카테고리** (V2 MEASUREMENT_FIELDS):
자켓/블레이저(4), 셔츠(5), 바지/슬랙스(6), 코트/아우터(4), 넥타이(2), 스카프(2), 머플러(2), 장갑(2), 벨트(2), 가방(3), 지갑(2), 안경(3), 서스펜더(2), 악세서리(3)

**검수 2단계 모달**:
- Step1: 등급 N/S/A/B 선택 → derivePrices → 가격 테이블 표시 → 검수메모/이슈
- Step2: 카테고리 선택 → 프리셋 필드 자동 표시 → 수치 입력 → 원산지/소재

**보류 모달 (HoldModal)**:
- 보류 사유 + 조정 가격 입력
- 고객 동의 상태 표시 (agreed/pending/rejected)
- SMS 재발송 버튼

### 3-3. API 매핑
| 기능 | API | 메서드 |
|------|-----|--------|
| 목록 조회 | `/api/admin/orders?status=&search=&page=&limit=` | GET |
| 상세 조회 | `/api/admin/orders/[id]` | GET |
| 상태 변경 | `/api/admin/orders/[id]` | PATCH |
| 검수 완료 | `/api/admin/orders/[id]/inspection` | PATCH |
| 실측 저장 | `/api/admin/orders/[id]/measurement` | PATCH |
| 아이템 목록 | `/api/admin/orders/[id]/items` | GET |
| 아이템 수정 | `/api/admin/orders/items/[itemId]` | PATCH |

### 3-4. 파일 목록
| 파일 | 줄수 | 역할 |
|------|------|------|
| `app/admin/(dashboard)/orders/page.tsx` | ~30 | Server Component |
| `app/admin/(dashboard)/orders/OrderClient.tsx` | ~90 | 메인 클라이언트 |
| `app/admin/(dashboard)/orders/OrderTable.tsx` | ~100 | 10컬럼 테이블 |
| `app/admin/(dashboard)/orders/OrderActionCell.tsx` | ~70 | 상태별 버튼 |
| `app/admin/(dashboard)/orders/OrderInspectionModal.tsx` | ~100 | 2단계 검수 래퍼 |
| `app/admin/(dashboard)/orders/InspectionStep.tsx` | ~90 | Step1 등급+가격 |
| `app/admin/(dashboard)/orders/MeasurementStep.tsx` | ~100 | Step2 14카테고리 |
| `app/admin/(dashboard)/orders/HoldModal.tsx` | ~80 | 보류 모달 |
| `hooks/useOrderHandlers.ts` | ~80 | 5핸들러 |
| `lib/constants/measurement-fields.ts` | ~120 | 14카테고리 상수 |

---

## 4. admin/settlement (목록)

### 4-1. 컴포넌트 트리
```
page.tsx (~30줄)
└─ SettlementClient.tsx (~80줄)
   ├─ StatCard × 3 (draft/confirmed/paid 건수)
   ├─ 상태필터 (inline select)
   ├─ TableShell<Settlement> (~12컬럼)
   │   └─ StatusBadge (공유)
   ├─ Pagination (공유)
   └─ Button "새 정산 시작" → /admin/settlement/workflow
```

### 4-2. API 매핑
| 기능 | API | 메서드 |
|------|-----|--------|
| 목록 조회 | `/api/admin/settlements?status=&page=&limit=` | GET |
| 상세 조회 | `/api/admin/settlements/[id]` | GET |

### 4-3. 파일 목록
| 파일 | 줄수 | 역할 |
|------|------|------|
| `app/admin/(dashboard)/settlement/page.tsx` | ~30 | Server Component |
| `app/admin/(dashboard)/settlement/SettlementClient.tsx` | ~80 | 목록 + 필터 |

---

## 5. admin/settlement/workflow (6단계 — 최고 복잡도)

### 5-1. 컴포넌트 트리
```
page.tsx (~30줄)
└─ WorkflowClient.tsx (~90줄)
   ├─ SettlementStepper.tsx (~60줄) — 6단계 진행 표시
   ├─ Step1_SalesLedger.tsx (~100줄) — 매출장 엑셀 업로드
   ├─ Step2_NaverSettle.tsx (~90줄) — 네이버 정산 업로드
   ├─ Step3_Matching.tsx (~100줄) — 자동매칭 결과 + 수동매칭
   │   └─ ManualMatchPanel.tsx (~100줄) — 좌우 분할
   ├─ Step4_Queue.tsx (~80줄) — 셀러별 그룹 큐
   ├─ Step5_Payout.tsx (~80줄) — 지급 처리 + 엑셀 다운로드
   └─ Step6_Review.tsx (~70줄) — 최종 검토 + 확정
```

### 5-2. V2 6단계 워크플로우

**Step 1: 매출장 업로드**
- 엑셀 파일 드래그 or 선택 → 브라우저에서 xlsx 파싱 → rows 배열 생성
- POST `/api/admin/sales/upload` body: `{ rows: Array<Record>, sessionId: UUID }` (JSON, FormData 아님)
- "위탁." 접두사 감지 → GET `/api/admin/sales/detect-consignment?batchId={UUID}` (GET, POST 아님)
- DELETE `/api/admin/sales/[sessionId]` → 업로드 롤백
- 파싱 결과 테이블 미리보기

**Step 2: 네이버 정산 업로드**
- 네이버 paySettleDailyDetail.xlsx 드래그 or 선택 → 브라우저에서 xlsx 파싱 → rows 배열
- POST `/api/admin/sales/naver/upload` body: `{ rows: Array<Record>, batchId: UUID }` (JSON, FormData 아님)
- 배송비 행 자동 제외
- 파싱 결과 미리보기

**Step 3: 매칭**
- POST `/api/admin/matching/auto` → 3-tier 자동매칭 실행 (body 없음)
- 결과: matched (≥0.85) / review (0.70-0.85) / unmatched (<0.70)
- ManualMatchPanel: 좌측 미매칭 매출건 / 우측 미매칭 네이버건 → 클릭 매칭
- POST `/api/admin/matching/manual` → 수동 매칭 저장 (body: salesRecordId, naverSettlementId, reason?)
- DELETE `/api/admin/matching/[id]` → 매칭 삭제 (취소용, GET 없음)

**Step 4: 대기열**
- POST `/api/admin/matching/queue` → 매칭 결과를 큐에 적재 (body 없음)
- GET `/api/admin/matching/queue/summary` → 셀러별 큐 요약 통계
- DELETE `/api/admin/matching/queue` → 큐 초기화 (재시작용)
- 셀러별 확인 후 "큐 확정" 버튼

**Step 5: 지급**
- POST `/api/admin/settlements/generate` → 정산서 생성
- POST `/api/admin/settlements/export` → 2시트 엑셀 다운로드 (건별상세 + 셀러요약)
- 지급 확인 후 POST `/api/admin/settlements/[id]/confirm`

**Step 6: 최종 검토**
- GET `/api/admin/settlements/[id]` → 정산 상세
- 검토 후 POST `/api/admin/settlements/[id]/pay` (optimistic lock)
- 완료 시 대시보드로 리다이렉트

### 5-3. API 매핑
| Step | API | 메서드 | 비고 |
|------|-----|--------|------|
| 1 | `/api/admin/sales/upload` | POST | JSON `{ rows, sessionId }` |
| 1 | `/api/admin/sales/detect-consignment?batchId=` | GET | 위탁 감지 |
| 1 | `/api/admin/sales/[sessionId]` | DELETE | 업로드 롤백 |
| 2 | `/api/admin/sales/naver/upload` | POST | JSON `{ rows, batchId }` |
| 3 | `/api/admin/matching/auto` | POST | 자동매칭 (body 없음) |
| 3 | `/api/admin/matching/manual` | POST | 수동매칭 `{ salesRecordId, naverSettlementId }` |
| 3 | `/api/admin/matching/[id]` | DELETE | 매칭 삭제 (취소용) |
| 4 | `/api/admin/matching/queue` | POST | 큐 적재 (body 없음) |
| 4 | `/api/admin/matching/queue/summary` | GET | 큐 요약 |
| 4 | `/api/admin/matching/queue` | DELETE | 큐 초기화 |
| 5 | `/api/admin/settlements/generate` | POST | `{ periodStart, periodEnd }` |
| 5 | `/api/admin/settlements/export` | POST | `{ settlementId }` → 바이너리 Excel |
| 5 | `/api/admin/settlements/[id]/confirm` | POST | 확정 (body 없음) |
| 6 | `/api/admin/settlements/[id]` | GET | 상세 |
| 6 | `/api/admin/settlements/[id]/pay` | POST | `{ paidBy, transferRef? }` |

### 5-4. 파일 목록
| 파일 | 줄수 | 역할 |
|------|------|------|
| `app/admin/(dashboard)/settlement/workflow/page.tsx` | ~30 | Server Component |
| `app/admin/(dashboard)/settlement/workflow/WorkflowClient.tsx` | ~90 | 스텝 라우터 |
| `app/admin/(dashboard)/settlement/workflow/SettlementStepper.tsx` | ~60 | 6단계 UI |
| `app/admin/(dashboard)/settlement/workflow/Step1_SalesLedger.tsx` | ~100 | 매출장 |
| `app/admin/(dashboard)/settlement/workflow/Step2_NaverSettle.tsx` | ~90 | 네이버 |
| `app/admin/(dashboard)/settlement/workflow/Step3_Matching.tsx` | ~100 | 자동매칭 |
| `app/admin/(dashboard)/settlement/workflow/ManualMatchPanel.tsx` | ~100 | 수동매칭 |
| `app/admin/(dashboard)/settlement/workflow/Step4_Queue.tsx` | ~80 | 대기열 |
| `app/admin/(dashboard)/settlement/workflow/Step5_Payout.tsx` | ~80 | 지급 |
| `app/admin/(dashboard)/settlement/workflow/Step6_Review.tsx` | ~70 | 검토 |

---

## 6. Public: /consignment/adjust/[token]

### 6-1. 컴포넌트 트리
```
page.tsx (~30줄)
└─ AdjustClient.tsx (~90줄)
   ├─ 상품 정보 표시 (마스킹된 고객명, 상품명, 가격)
   ├─ 3선택지 라디오
   │   ├─ accepted (수락)
   │   ├─ counter (역제안 — 금액 입력 필드)
   │   └─ cancelled (거부)
   └─ Button "제출" → POST
```

### 6-2. API 매핑
| 기능 | API | 메서드 |
|------|-----|--------|
| 위탁 정보 조회 | `/api/consignment/adjust/[token]` | GET |
| 응답 제출 | `/api/consignment/adjust/[token]` | POST |

### 6-3. 파일 목록
| 파일 | 줄수 | 역할 |
|------|------|------|
| `app/consignment/adjust/[token]/page.tsx` | ~30 | Server Component |
| `app/consignment/adjust/[token]/AdjustClient.tsx` | ~90 | 3선택지 폼 |

---

## 7. Public: /orders/[productId]/hold

### 7-1. 컴포넌트 트리
```
page.tsx (~30줄)
└─ HoldClient.tsx (~90줄)
   ├─ 보류 아이템 목록 (아이템별 사유 + 조정 가격 표시)
   ├─ 아이템별 동의/거부 버튼 (agreed: boolean)
   └─ Button "제출" → POST (per item)
```

### 7-2. API 매핑
| 기능 | API | 메서드 | 비고 |
|------|-----|--------|------|
| 보류 정보 조회 | `/api/orders/[productId]/hold?token=` | GET | token은 query param |
| 아이템별 동의/거부 | `/api/orders/[productId]/hold` | POST | body: `{ token, itemId, agreed }` |

### 7-3. 파일 목록
| 파일 | 줄수 | 역할 |
|------|------|------|
| `app/orders/[productId]/hold/page.tsx` | ~30 | Server Component |
| `app/orders/[productId]/hold/HoldClient.tsx` | ~80 | 동의/거부 폼 |

---

## 8. 구현 순서 (의존성 기반)

```
B-Step 1: 공유 상수/훅 (의존 없음)
───────────────────────────────────
  lib/constants/measurement-fields.ts
  hooks/useInspectionFlow.ts
  hooks/useOrderHandlers.ts

B-Step 2: Dashboard (가장 단순, 워밍업)
───────────────────────────────────
  dashboard/page.tsx + DashboardClient + RecentActivity

B-Step 3: Consignments (중복잡도)
───────────────────────────────────
  consignments/page.tsx + 하위 7개 컴포넌트

B-Step 4: Orders (중복잡도)
───────────────────────────────────
  orders/page.tsx + 하위 6개 컴포넌트

B-Step 5: Settlement 목록 (단순)
───────────────────────────────────
  settlement/page.tsx + SettlementClient

B-Step 6: Settlement Workflow (최고복잡도)
───────────────────────────────────
  settlement/workflow/page.tsx + 하위 8개 컴포넌트

B-Step 7: Public 2개 (단순)
───────────────────────────────────
  consignment/adjust/[token] + orders/[productId]/hold
```

---

## 9. 파일 총 집계

| 분류 | 파일 수 |
|------|---------|
| 공유 상수/훅 | 3 |
| Dashboard | 3 |
| Consignments | 9 |
| Orders | 10 |
| Settlement 목록 | 2 |
| Settlement Workflow | 10 |
| Public (가격조정) | 2 |
| Public (보류) | 2 |
| **합계** | **41** |

---

## 10. 아키텍처 준수 체크포인트

### 줄수 제한
- page.tsx: 30줄 이내 (Server Component 래퍼만)
- Client 컴포넌트: 100줄 이내 (architecture-spec 150줄, CLAUDE.md 100줄 → 안전하게 100)
- 훅: 80줄 이내
- 상수: 120줄 이내 (예외 허용)

### 의존성 규칙
- 모든 데이터 접근: `lib/api/client.ts` → HTTP API 경유
- 컴포넌트에서 서비스/리포지토리 직접 import 금지
- `any` 타입 금지

### 금지 패턴
- `style={{}}` 정적 인라인 → Tailwind 클래스 사용
- `alert()` / `confirm()` → Toast / Modal 사용
- `/uploads/` 하드코딩 → `getPhotoUrl()` 사용
- 브라우저 전용 API 서버 호출 시 사용 → `'use client'` 명시

---

## 11. 검증 계획 (등급 2, 10회)

Session B 완료 후 Session D 전에 중간 검증:

```
[기획자] ─── 병렬 1
  딥시뮬레이션 × 2회
    1) 정상 플로우: 로그인→대시보드→위탁검수→주문검수→정산6단계
    2) 실패 플로우: API 500 → Toast 표시, 빈 목록 → 빈 상태 UI

[빌더] ─── 병렬 2
  엣지케이스 × 2회
    1) 입력 극단: 정산 0건 매칭, 실측 필드 미입력
    2) 시스템 극단: 100+ 위탁 페이지네이션, 긴 상품명 truncate
  디펜던시 × 2회
    1) 직접 영향: 공유 컴포넌트 Props 변경 → 전체 영향
    2) 간접 영향: API 응답 스키마 변경 시 타입 불일치

[테스터] ─── 병렬 3
  레드팀 × 2회
    1) XSS: 상품명/<script> → sanitize 확인
    2) 권한: Public 페이지에서 admin API 호출 불가 확인

→ 병렬 완료 후

[디렉터] ─── 순차
  아키텍트 리뷰 × 2회
    1) 레이어 준수: L2에서 L1 import 0건
    2) 줄수 준수: 전 파일 100줄 이내 확인
```
