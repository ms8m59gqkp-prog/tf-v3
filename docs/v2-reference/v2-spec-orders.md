# V2 검증 기준서 #2: 주문 도메인

## 파일 구조 (18개 파일)

### 핵심 파일
| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `app/admin/orders/types.ts` | 206 | OrderStatus 8값(UPPER_CASE), Condition 4값, InspectionStatus 3값, derivePrices, MEASUREMENT_FIELDS 14카테고리 |
| `components/InspectionModal.tsx` | 274 | 2단계: 검수→실측 |
| `components/HoldModal.tsx` | 229 | 고객 동의 추적 + SMS 재발송 |
| `components/MeasurementStep.tsx` | 376 | 14카테고리 프리셋 + 커스텀 입력 |
| `hooks/useOrderHandlers.ts` | 216 | 5개 핸들러 + 비동기 실측카드 생성 |

---

## 주문 상태 전이 맵

```
APPLIED → SHIPPING → COLLECTED → INSPECTED ─┬→ PRICE_ADJUSTING → RE_INSPECTED ─┐
                                             │                                   │
                                             └→ IMAGE_PREPARING ←──────────────┘
                                                       │
                                                       └→ IMAGE_COMPLETE
```

| 현재 상태 | 다음 상태 | 트리거 |
|-----------|----------|--------|
| APPLIED | SHIPPING | 배송 시작 |
| SHIPPING | COLLECTED | 수거 완료 |
| COLLECTED | INSPECTED | 검수 완료 |
| INSPECTED | PRICE_ADJUSTING | 가격 조정 필요 |
| INSPECTED | IMAGE_PREPARING | 가격 확정 |
| PRICE_ADJUSTING | RE_INSPECTED | 재검수 |
| RE_INSPECTED | IMAGE_PREPARING | 가격 확정 |
| IMAGE_PREPARING | IMAGE_COMPLETE | 이미지 처리 완료 |

**주의**: V2 OrderStatus는 IMAGE_COMPLETE까지만 정의. on_sale/sold는 별도 도메인에서 관리.

---

## OrderStatus 열거형 (8개 값)

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

**주의**: V2에서는 UPPER_CASE 사용. on_sale/sold는 V2 OrderStatus에 없음.

## Condition (상품 등급) 4단계

| 등급 | 의미 | 가격 영향 |
|------|------|----------|
| N | 새상품 (New) | 기본가 |
| S | S급 | 약간 할인 |
| A | A급 | 중간 할인 |
| B | B급 | 최대 할인 |

## InspectionStatus

```typescript
// V2 소스: app/admin/orders/types.ts:20
type InspectionStatus = 'pending' | 'completed' | 'hold'
```

---

## derivePrices / deriveOriginalPrice 함수

- **derivePrices**: 상품 등급(Condition)에 따른 판매가 계산
- **deriveOriginalPrice**: 역산 — 판매가에서 원래가격 추정

---

## 실측(Measurement) 14개 카테고리

```typescript
// V2 소스: app/admin/orders/types.ts:111-182
// 키가 한글이며, 값은 {label, key}[] 형태
MEASUREMENT_FIELDS: Record<string, {label: string, key: string}[]> = {
  '자켓/블레이저': [{label:'어깨',key:'shoulder'}, {label:'가슴',key:'chest'}, {label:'소매',key:'sleeve'}, {label:'총장',key:'length'}],
  '셔츠':         [{label:'어깨',key:'shoulder'}, {label:'가슴',key:'chest'}, {label:'소매',key:'sleeve'}, {label:'총장',key:'length'}, {label:'목둘레',key:'neck'}],
  '바지/슬랙스':   [{label:'허리',key:'waist'}, {label:'엉덩이',key:'hip'}, {label:'허벅지',key:'thigh'}, {label:'밑단',key:'hem'}, {label:'총장',key:'length'}, {label:'밑위',key:'rise'}],
  '코트/아우터':   [{label:'어깨',key:'shoulder'}, {label:'가슴',key:'chest'}, {label:'소매',key:'sleeve'}, {label:'총장',key:'length'}],
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

---

## 검수 모달 2단계 플로우

**Step 1 — 검수 (InspectionModal)**
- 등급 선택 (N/S/A/B)
- 검수 이미지 업로드
- 이슈 메모 입력
- PriceAdjustmentSection: 등급별 가격 자동 계산

**Step 2 — 실측 (MeasurementStep)**
- 카테고리별 프리셋 필드
- 커스텀 필드 추가
- 원산지/소재 입력
- 실측카드 자동 생성 (fire-and-forget)
