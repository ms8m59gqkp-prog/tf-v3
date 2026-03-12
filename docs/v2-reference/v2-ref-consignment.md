# V2 참조: 위탁 도메인 (구현용)

> V3 구현 시 실시간 참조용 — V2 파일 경로, 코드 스니펫, V3 매핑

## V2 파일 인벤토리

### 페이지/컴포넌트
| V2 파일 | 줄 수 | V3 대응 |
|---------|-------|---------|
| `app/admin/consignments/page.tsx` | 96 | `app/admin/consignments/page.tsx` |
| `app/admin/consignments/ConsignmentTable.tsx` | 457 | 컴포넌트 분리 필요 |
| `app/admin/consignments/ConsignmentInspectionModal.tsx` | 99 | 검수 모달 |
| `app/admin/consignments/ConsignmentStats.tsx` | - | 통계 컴포넌트 |
| `app/admin/consignments/ConsignmentFilters.tsx` | - | 필터 컴포넌트 |
| `app/admin/consignments/MainTabSelector.tsx` | - | 탭 선택기 |

### 훅
| V2 파일 | 줄 수 | V3 대응 |
|---------|-------|---------|
| `hooks/useInspectionWorkflow.ts` | 191 | 검수 워크플로우 훅 |
| `hooks/useConsignmentHandlers.ts` | 240 | 위탁 핸들러 훅 |

### API 라우트
| V2 파일 | 줄 수 | V3 대응 |
|---------|-------|---------|
| `app/api/admin/consignments/route.ts` | - | GET(목록) + POST(생성) |
| `app/api/admin/consignments/[id]/route.ts` | 496 | PATCH(상태전이) + DELETE |
| `app/api/admin/consignments/bulk/route.ts` | - | POST(대량등록) |

### 공개 페이지
| V2 파일 | V3 대응 |
|---------|---------|
| `app/consignment/adjust/[token]/page.tsx` | 셀러 가격 조정 페이지 |

---

## 상태 전이 상세

### ALLOWED_TRANSITIONS (V2 PATCH route에서 정의)

```typescript
// V2 소스: app/api/admin/consignments/[id]/route.ts:81-92
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
**cancelled, return_shipping, return_completed는 V2에 없음**

### 상태별 UI 액션 (ConsignmentTable ActionCell)

| 상태 | 표시 버튼 | 핸들러 |
|------|----------|--------|
| pending | 수령 확인 | handleReceive |
| received | 검수 시작 | → inspecting 전이 |
| inspecting | 검수(모달) | handleInspectionComplete/Hold/Reject |
| on_hold | 검수 재개 | handleAction → completed |
| rejected | 반송 시작 | handleReturnShipment |
| return_shipping | 반송 완료 | handleAction → return_completed |
| completed | (비활성) | 상품 생성됨 |

---

## 핵심 로직 스니펫

### 1. handleExcelUpload (대량 등록)

```typescript
// V2: hooks/useConsignmentHandlers.ts
const handleExcelUpload = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/admin/consignments/bulk', { method: 'POST', body: formData })
  // ... 결과 처리
}
```

**V3 매핑**: `consignment.service.ts → bulkCreate(rows)` 이미 구현됨

### 2. completed 시 자동 생성 (PATCH route)

```typescript
// V2: api/admin/consignments/[id]/route.ts (496줄 중 일부)
if (newStatus === 'completed') {
  // 1. 채번: generate_product_number() RPC
  const productNumber = await supabase.rpc('generate_product_number')

  // 2. st_products 생성
  await supabase.from('st_products').insert({ product_number: productNumber, ... })

  // 3. orders 생성
  await supabase.from('orders').insert({ ... })

  // 4. order_items 생성
  await supabase.from('order_items').insert({ ... })

  // 5. 가격 추정
  await fetch('/api/admin/price-estimate', { ... })
}
```

**V3 매핑**: `consignment.service.ts → approveConsignment(id)` 부분 구현됨 (채번만). 상품/주문 생성 로직은 Phase 5+ 필요.

### 3. 검수 7단계 상태 머신

```typescript
// V2: hooks/useInspectionWorkflow.ts
type InspectionStep = 'question' | 'measurement' | 'issue_type' |
  'hold_form' | 'hold_sms' | 'reject_form' | 'reject_address' | 'reject_sms'

// 분기 로직:
// question에서 "완료" → measurement → completed
// question에서 "보류" → issue_type → hold_form → hold_sms → on_hold
// question에서 "반려" → issue_type → reject_form → reject_address → reject_sms → rejected
```

**V3 매핑**: 아직 미구현. Phase 5(UI) 이후.

### 4. 가격 조정 페이지 (셀러용)

```typescript
// V2: app/consignment/adjust/[token]/page.tsx
// 토큰으로 위탁 정보 조회
// 3가지 선택지: accepted | counter | cancelled
// counter 선택 시 역제안 금액 입력 폼
```

**V3 매핑**: 아직 미구현. 공개 페이지 설계 필요.

---

## V3 구현 체크리스트

### Phase 4 (서비스 레이어) — 현재
- [x] `consignment.service.ts` — list, getById, bulkCreate, updateStatus, approveConsignment, batchDelete
- [x] `consignments.repo.ts` — findById, generateProductNumber
- [x] `consignments-query.repo.ts` — list, updateStatus, batchDelete
- [x] `consignments-bulk.repo.ts` — bulkCreate
- [ ] completed 시 상품/주문 자동 생성 로직 (V2 PATCH route의 핵심)
- [ ] 가격 조정 토큰 생성 및 URL 발행

### Phase 5 (API 라우트)
- [ ] `GET /api/admin/consignments` — 목록 조회 + 필터 + 페이지네이션
- [ ] `POST /api/admin/consignments` — 단건 등록
- [ ] `POST /api/admin/consignments/bulk` — 대량 등록 (엑셀)
- [ ] `PATCH /api/admin/consignments/[id]` — 상태 전이 (V2 496줄 → 서비스로 분리)
- [ ] `DELETE /api/admin/consignments/[id]` — 삭제

### Phase 6 (UI)
- [ ] 위탁 목록 테이블 (12컬럼)
- [ ] 상태별 통계 카드
- [ ] 상태/검색 필터
- [ ] 탭 선택기 (전체/신청/검수/보류/반려/승인)
- [ ] 검수 7단계 모달
- [ ] 엑셀 업로드 UI
- [ ] 가격 조정 공개 페이지

### V2 핵심 UX 유지 사항
1. **12컬럼 테이블**: 순서와 컬럼명 V2 동일하게
2. **상태별 ActionCell**: 버튼 텍스트 V2 동일하게
3. **검수 7단계 플로우**: 단계 순서 유지 (UX 개선은 별도)
4. **"위탁." 접두사 감지**: 매출장 파싱 시 위탁 상품 자동 분류
5. **셀러 자동 생성**: 전화번호 기준 findOrCreate 로직 유지
