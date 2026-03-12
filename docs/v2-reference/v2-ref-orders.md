# V2 참조: 주문 도메인 (구현용)

> V3 구현 시 실시간 참조용 — V2 파일 경로, 코드 스니펫, V3 매핑

## V2 파일 인벤토리

### 페이지/컴포넌트
| V2 파일 | 줄 수 | 역할 |
|---------|-------|------|
| `app/admin/orders/page.tsx` | - | 주문 목록 메인 |
| `app/admin/orders/types.ts` | 206 | OrderStatus 8값(UPPER_CASE), Condition 4값, InspectionStatus 3값, derivePrices, MEASUREMENT_FIELDS 14카테고리 |
| `components/InspectionModal.tsx` | 274 | 2단계: 검수→실측, PriceAdjustmentSection |
| `components/HoldModal.tsx` | 229 | 고객 동의 추적 + SMS 재발송 |
| `components/MeasurementStep.tsx` | 376 | 14카테고리 프리셋 + 커스텀 + 원산지/소재 |
| `hooks/useOrderHandlers.ts` | 216 | 5핸들러 + fire-and-forget 실측카드 |

---

## 상태 전이 상세

### OrderStatus (8개 값)
```typescript
// V2 소스: app/admin/orders/types.ts:6-14
type OrderStatus =
  | 'APPLIED'          // 신청 접수
  | 'SHIPPING'         // 배송중
  | 'COLLECTED'        // 수거완료
  | 'INSPECTED'        // 검수 완료
  | 'PRICE_ADJUSTING'  // 가격 조정 중
  | 'RE_INSPECTED'     // 재검수 완료
  | 'IMAGE_PREPARING'  // 이미지 준비 중
  | 'IMAGE_COMPLETE'   // 이미지 완료
```

**주의**: V2는 UPPER_CASE 사용. on_sale/sold는 V2 OrderStatus에 없음.

### 전이 맵
```
applied → shipping → collected → inspected ─┬→ price_adjusting → re_inspected ─┐
                                             │                                   │
                                             └→ image_preparing ←───────────────┘
                                                       │
                                                       └→ image_complete → on_sale → sold
```

### Condition (등급) 4단계
| 등급 | 의미 | 설명 |
|------|------|------|
| N | New | 새상품 (미착용/택 부착) |
| S | S급 | 1~2회 착용, 흠 없음 |
| A | A급 | 사용감 있으나 양호 |
| B | B급 | 사용감 많음, 흠 있음 |

### InspectionStatus
```typescript
// V2 소스: app/admin/orders/types.ts:20
type InspectionStatus = 'pending' | 'completed' | 'hold'
```

---

## 핵심 로직 스니펫

### 1. derivePrices (등급별 가격 계산)

```typescript
// V2 소스: app/admin/orders/types.ts:192-200
// 인자: originalPrice만 받음 (condition 인자 없음)
// 반환: 모든 Condition에 대한 가격을 Record로 반환
function derivePrices(originalPrice: number): Record<Condition, number> {
  const round = (v: number) => Math.round(v / 1000) * 1000
  return {
    N: originalPrice,
    S: round(originalPrice * 0.85),
    A: round(originalPrice * 0.70),
    B: round(originalPrice * 0.50),
  }
}

// 역산 함수
function deriveOriginalPrice(estimatedPrice: number, condition: Condition): number {
  const ratios: Record<Condition, number> = { N: 1, S: 0.85, A: 0.7, B: 0.5 }
  return Math.round((estimatedPrice / (ratios[condition] ?? 0.7)) / 1000) * 1000
}
```

### 2. MEASUREMENT_FIELDS (14카테고리)

```typescript
// V2 소스: app/admin/orders/types.ts:111-182
// 키가 한글, 값은 {label, key}[] 형태
const MEASUREMENT_FIELDS: Record<string, {label: string, key: string}[]> = {
  '자켓/블레이저': [{label:'어깨',key:'shoulder'}, {label:'가슴',key:'chest'}, {label:'소매',key:'sleeve'}, {label:'총장',key:'length'}],
  '셔츠':         [{label:'어깨',key:'shoulder'}, ...{label:'목둘레',key:'neck'}],  // 5필드
  '바지/슬랙스':   [{label:'허리',key:'waist'}, ...{label:'밑위',key:'rise'}],       // 6필드
  '코트/아우터':   [{label:'어깨',key:'shoulder'}, ...{label:'총장',key:'length'}],   // 4필드
  '넥타이':       [{label:'전폭 (가장 넓은 부분)',key:'width'}, {label:'총길이',key:'length'}],
  '스카프':       [{label:'가로',key:'width'}, {label:'세로',key:'height'}],
  '머플러':       [{label:'폭',key:'width'}, {label:'길이',key:'length'}],
  '장갑':         [{label:'총길이',key:'length'}, {label:'손바닥 둘레',key:'palm'}],
  '벨트':         [{label:'총길이',key:'length'}, {label:'폭',key:'width'}],
  '가방':         [{label:'가로',key:'width'}, {label:'세로',key:'height'}, {label:'폭(마치)',key:'depth'}],
  '지갑':         [{label:'가로',key:'width'}, {label:'세로',key:'height'}],
  '안경':         [{label:'렌즈 폭',key:'lensWidth'}, {label:'브릿지',key:'bridge'}, {label:'다리 길이',key:'templeLength'}],
  '서스펜더':     [{label:'총길이 (조절 최대)',key:'length'}, {label:'폭',key:'width'}],
  '악세서리 (기타)': [{label:'가로',key:'width'}, {label:'세로',key:'height'}, {label:'비고',key:'note'}],
}
```

### 3. 검수 모달 2단계 (InspectionModal)

**Step 1 — 검수**:
- 등급 선택 라디오 (N/S/A/B)
- 검수 이미지 업로드 (다중)
- 이슈 메모 textarea
- PriceAdjustmentSection: 등급 선택 시 자동 가격 계산 표시

**Step 2 — 실측 (MeasurementStep)**:
- 카테고리 선택 → 해당 프리셋 필드 표시
- 각 필드에 실측값(cm) 입력
- 커스텀 필드 추가 버튼
- 원산지 input
- 소재 구성 input (예: "울 80%, 캐시미어 20%")

### 4. useOrderHandlers (5개 핸들러)

```typescript
// V2: hooks/useOrderHandlers.ts
handleStatusChange(orderId, newStatus)      // 범용 상태 전이
handleInspectionComplete(orderId, data)     // 검수 완료 처리
handleHold(orderId, holdData)               // 보류 처리
handleMeasurementSave(orderId, measurements) // 실측 저장
handleMeasurementCardGenerate(orderId)      // 실측카드 생성 (fire-and-forget)
```

### 5. 보류 모달 (HoldModal)

```typescript
// V2: components/HoldModal.tsx (229줄)
// - 고객 동의 상태 표시 (agreed/pending/expired)
// - SMS 재발송 버튼
// - 보류 사유 표시
// - 가격 조정 히스토리
```

---

## V3 구현 체크리스트

### Phase 4 (서비스 레이어)
- [ ] `order.service.ts` — CRUD + 상태 전이 로직
- [ ] OrderStatus 타입 정의 (V2 8값 기준, UPPER_CASE)
- [ ] Condition 타입 정의 (N/S/A/B)
- [ ] derivePrices 로직 → `calculators/order.calc.ts`
- [ ] MEASUREMENT_FIELDS 상수 정의

### Phase 5 (API 라우트)
- [ ] `GET /api/admin/orders` — 목록 + 필터 + 페이지네이션
- [ ] `PATCH /api/admin/orders/[id]` — 상태 전이
- [ ] `POST /api/admin/orders/[id]/inspection` — 검수 완료
- [ ] `POST /api/admin/orders/[id]/measurement` — 실측 저장

### Phase 6 (UI)
- [ ] 주문 목록 테이블
- [ ] 검수 2단계 모달 (검수 + 실측)
- [ ] 보류 모달 (고객 동의 추적)
- [ ] 실측 14카테고리 프리셋 입력
- [ ] PriceAdjustmentSection (등급별 가격 표시)
- [ ] 실측카드 자동 생성

### V2 핵심 UX 유지 사항
1. **상태 전이 순서**: applied→...→sold 순서 그대로
2. **등급 4단계 (N/S/A/B)**: 동일 등급 체계 유지
3. **실측 14카테고리**: 한글 키 + {label, key}[] 형태 동일
4. **검수→실측 2단계 플로우**: 모달 내 단계 유지
5. **fire-and-forget 실측카드**: 비동기 생성 패턴 유지
