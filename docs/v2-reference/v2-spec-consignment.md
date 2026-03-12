# V2 검증 기준서 #1: 위탁 도메인

## 파일 구조 (38개 파일)

### 메인 페이지
| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `app/admin/consignments/page.tsx` | 96 | 메인 페이지: MainTabSelector + ConsignmentStats + ConsignmentFilters + ConsignmentTable + ConsignmentInspectionModal |

### 컴포넌트
| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `ConsignmentTable.tsx` | 457 | 12컬럼 테이블, 상태별 ActionCell |
| `ConsignmentInspectionModal.tsx` | 99 | 7단계 검수 워크플로우 모달 |
| `ConsignmentStats.tsx` | - | 상태별 통계 카드 |
| `ConsignmentFilters.tsx` | - | 상태/검색 필터 |
| `MainTabSelector.tsx` | - | 탭 전환 (전체/신청/검수/보류/반려/승인) |

### 훅
| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `hooks/useInspectionWorkflow.ts` | 191 | 7단계 검수 상태 머신 |
| `hooks/useConsignmentHandlers.ts` | 240 | 8개 핸들러: handleAction, handleReceive, handleInspectionComplete, handleInspectionHold, handleInspectionReject, handleReturnShipment, handleExcelUpload, handleDelete |

---

## 위탁 상태 전이 맵

```
pending ──→ inspecting ──→ approved ──→ received ──→ completed ──→ (상품 등록)
               │               │           │
               ├──→ on_hold    ├──→ on_hold ├──→ on_hold
               │               │           │
               └──→ rejected   └──→ rejected└──→ rejected
```

### 상태별 허용 전이 (ALLOWED_TRANSITIONS)

```typescript
// V2 소스: app/api/admin/consignments/[id]/route.ts:84-92
type ConsignmentStatus = 'pending' | 'inspecting' | 'on_hold' | 'approved' | 'received' | 'completed' | 'rejected'

const ALLOWED_TRANSITIONS: Record<ConsignmentStatus, ConsignmentStatus[]> = {
  pending:    ['inspecting', 'approved', 'on_hold', 'rejected'],
  inspecting: ['approved', 'on_hold', 'rejected'],
  on_hold:    ['inspecting', 'approved', 'rejected'],
  approved:   ['received', 'on_hold', 'rejected'],
  received:   ['completed', 'on_hold', 'rejected'],
  completed:  [],   // 최종 상태
  rejected:   [],   // 최종 상태
}
```

**7개 상태**: pending, inspecting, on_hold, approved, received, completed, rejected

---

## 검수 워크플로우 (useInspectionWorkflow, 8단계)

| 단계 | 이름 | 설명 |
|------|------|------|
| 1 | question | 검수 결과 선택 (완료/보류/반려) |
| 2 | measurement | 실측 입력 (14개 카테고리) |
| 3 | issue_type | 보류/반려 사유 선택 |
| 4 | hold_form | 보류 폼 (조정가격 + 사유) |
| 5 | hold_sms | 보류 SMS 발송 확인 |
| 6 | reject_form | 반려 폼 (사유 입력) |
| 7 | reject_address | 반려 배송지 입력 |
| 8 | reject_sms | 반려 SMS 발송 확인 |

**분기**: 완료→1,2 / 보류→1,3,4,5 / 반려→1,3,6,7,8

---

## 위탁 완료 시 자동 생성 (PATCH /api/admin/consignments/[id])

`completed` 상태 전이 시 자동으로 4개 레코드 생성:
1. **st_products** — 상품 등록 (product_number 채번)
2. **orders** — 주문 생성
3. **order_items** — 주문 아이템 생성
4. **price_estimate** — 가격 추정 호출

- **API 파일**: `app/api/admin/consignments/[id]/route.ts` (496줄)
- **채번 규칙**: RPC `generate_product_number()` 호출

---

## 가격 조정 (셀러 공개 페이지)

- **경로**: `/consignment/adjust/[token]/`
- **인증**: 토큰 기반 (SMS로 전송)
- **3가지 선택지**:
  1. `accepted` — 조정가격 수락
  2. `counter` — 역제안 금액 입력
  3. `cancelled` — 위탁 취소

---

## 엑셀 대량 업로드

- **핸들러**: `handleExcelUpload` in `useConsignmentHandlers.ts`
- **API**: `POST /api/admin/consignments/bulk`
- **필수 컬럼**: 이름, 전화번호, 상품명, 희망가격, 상태
- **셀러 자동 생성**: 전화번호 기준 `findOrCreate`
