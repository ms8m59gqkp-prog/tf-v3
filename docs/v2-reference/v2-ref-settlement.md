# V2 참조: 정산 도메인 (구현용)

> V3 구현 시 실시간 참조용 — V2 파일 경로, 코드 스니펫, V3 매핑
> **가장 복잡한 도메인** — 45개 파일, 6단계 워크플로우

## V2 파일 인벤토리

### 정산 6단계 스텝 컴포넌트
| V2 파일 | 역할 |
|---------|------|
| `SalesLedgerStep` | Step 1: 매출장 엑셀 업로드 |
| `NaverSettleStep` | Step 2: 네이버 정산 엑셀 업로드 |
| `MatchingStep` | Step 3: 자동+수동 매칭 |
| `QueueStep` | Step 4: 정산 큐 등록 |
| `PayoutStep` | Step 5: 지급 처리 |
| `ReviewStep` | Step 6: 최종 검토 |

### 파서 라이브러리
| V2 파일 | 역할 |
|---------|------|
| `lib/settlement/sales-ledger-parser.ts` | 매출장 멀티시트 엑셀 파싱 |
| `lib/settlement/naver-settle-parser.ts` | 네이버 정산 엑셀 파싱 |
| `lib/settlement/product-matcher.ts` | 3단계 자동 매칭 알고리즘 |
| `lib/settlement/excel-exporter.ts` | 지급 엑셀 생성 (2시트) |

### 수동 매칭 UI
| V2 컴포넌트 | 역할 |
|------------|------|
| `ManualMatchPanel` | 좌우 분할 — 미매칭 매출 vs 미매칭 네이버 |

---

## 6단계 워크플로우 상세

### Step 1: 매출장 업로드 (SalesLedgerStep)

**파서**: `sales-ledger-parser.ts`

**입력**: 다중 시트 엑셀 (.xlsx)

**핵심 로직**:
- 여러 시트를 순회하며 행 파싱
- **"위탁." 접두사 감지**: 상품명이 "위탁."으로 시작 → 위탁 상품으로 분류
- 위탁 상품에서 셀러 정보 자동 추출
- 빈 행/헤더 행 스킵

**출력 타입**:
```typescript
interface SalesRecord {
  id: string
  productName: string
  buyerName: string
  finalAmount: number
  productNumber: string      // 16자리+ 상품주문번호
  saleDate: string
  // ... 추가 필드
}
```

### Step 2: 네이버 정산 업로드 (NaverSettleStep)

**파서**: `naver-settle-parser.ts`

**입력**: paySettleDailyDetail.xlsx (네이버 스마트스토어 정산 내역)

**핵심 로직**:
- 네이버 정산 엑셀 고정 포맷 파싱
- **배송비 행 제외**: 상품명에 "배송비" 포함 행 필터링
- 금액 정규화 (문자열→숫자)

**출력 타입**:
```typescript
interface NaverSettlement {
  id: string
  productName: string
  buyerName: string
  settleAmount: number
  productOrderNo: string    // 네이버 상품주문번호
  // ... 추가 필드
}
```

### Step 3: 매칭 (MatchingStep)

**3단계 자동 매칭** (product-matcher.ts):

```
Step 3-1: 상품주문번호 완전일치
  조건: productNumber.length >= 16 && productNumber === productOrderNo
  matchType: 'product_order_no'
  matchScore: 1.0

Step 3-2: 구매자명 + 금액 완전일치
  조건: buyerName === buyerName && finalAmount === settleAmount
  matchType: 'buyer_amount'
  matchScore: 0.9

Step 3-3: 상품명 자카드 유사도
  조건: productNameSimilarity(productName, productName) >= THRESHOLD_MANUAL
  matchType: 'product_name'
  matchScore: 계산값 (0.70~1.0)
```

**자카드 유사도 계산**:
```typescript
// V2 소스: lib/settlement/product-matcher.ts:67-107
// tokenize라는 별도 함수는 없음. normalize + split 방식 사용.

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

function normalize(text: string): string {
  return decodeHtmlEntities(text).toLowerCase().replace(/\s+/g, ' ').trim()
}

function normalizeBrand(text: string): string {
  const lower = text.toLowerCase().replace(/\s+/g, '')
  return BRAND_MAP[lower] ?? lower
}

function jaccard(a: string, b: string): number {
  const setA = new Set(normalize(a).split(/\s+/).filter(Boolean))
  const setB = new Set(normalize(b).split(/\s+/).filter(Boolean))
  const intersection = [...setA].filter((t) => setB.has(t)).length
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : intersection / union
}

function productNameSimilarity(a: string, b: string): number {
  const normA = normalizeBrand(normalize(a))
  const normB = normalizeBrand(normalize(b))
  return jaccard(normA, normB)
}
```

**임계값**:
- `THRESHOLD_AUTO = 0.85` → 자동 확정 (auto_matched)
- `THRESHOLD_MANUAL = 0.70` → 수동 검토 필요 (needs_review)
- `< 0.70` → 매칭 안 됨 (unmatched)

**수동 매칭 (ManualMatchPanel)**:
- 좌측: 미매칭 SalesRecord 목록
- 우측: 미매칭 NaverSettlement 목록
- 각 한 건씩 선택 → "매칭" 버튼 → 사유 입력
- matchType: 'manual', matchScore: 1.0

### Step 4: 정산 큐 등록 (QueueStep)

**3중 방어 (중복 방지)**:
1. **DB UNIQUE 인덱스**: settlement_matches 테이블 unique constraint
2. **업로드 중복 검사**: 동일 파일 해시 비교
3. **큐 상태 검사**: confirmed/paid 상태 건 재등록 차단

**셀러별 그룹화**: 매칭 완료 건을 seller_id 기준으로 집계

### Step 5: 지급 처리 (PayoutStep)

**엑셀 생성** (excel-exporter.ts):
- **시트 1: 대금지급명세** — 전체 건별 상세 (상품명, 판매가, 수수료, 지급액, 매칭타입)
- **시트 2: 셀러별 요약** — 셀러명, 건수, 총 판매액, 총 수수료, 순 지급액

### Step 6: 최종 검토 (ReviewStep)

- 정산 기간 표시 (periodStart ~ periodEnd)
- 총 건수 / 총 금액 / 총 수수료 / 순 지급액
- 확정 버튼 → status: 'draft' → 'confirmed'

---

## 정산 상태 전이

```typescript
// V2 소스: lib/settlement/types.ts:189
type SettlementStatus = 'pending' | 'confirmed' | 'paid'
// 주의: V2에는 3가지 상태만 존재 (draft/failed 없음)
// 주의: V2에 SETTLEMENT_TRANSITIONS 상수 정의 없음

// V3에서 확장한 버전 (V2에 없는 V3 자체 설계):
// V3: lib/types/domain/settlement.ts
// type SettlementStatus = 'draft' | 'confirmed' | 'paid' | 'failed'
// SETTLEMENT_TRANSITIONS = { draft→confirmed/failed, confirmed→paid/failed, ... }
```

---

## V3 매핑 현황

### 이미 구현됨 (Phase 2~4)
| V2 기능 | V3 파일 | 상태 |
|---------|---------|------|
| 3단계 매칭 | `lib/services/matching.service.ts` | ✅ |
| 자카드 유사도 | `matching.service.ts` (jaccardSimilarity) | ✅ |
| 수동 매칭 | `matching.service.ts` (manualMatch) | ✅ |
| 매칭 취소 | `matching.service.ts` (cancelMatch) | ✅ |
| 정산 큐 | `matching.service.ts` (queueSettlements) | ✅ (부분) |
| 정산 생성 | `settlement.service.ts` (generate) | ✅ |
| 정산 확정 | `settlement.service.ts` (confirm) | ✅ |
| 정산 지급 | `settlement.service.ts` (pay) | ✅ |
| 상태 전이 검증 | SETTLEMENT_TRANSITIONS | ✅ |
| 정산 계산 | `calculators/settlement.calc.ts` | ✅ |

### 미구현 (Phase 5+)
| V2 기능 | 필요 작업 |
|---------|----------|
| 매출장 엑셀 파싱 | `lib/parsers/sales-ledger.parser.ts` |
| 네이버 정산 파싱 | `lib/parsers/naver-settle.parser.ts` |
| 지급 엑셀 생성 | `lib/exporters/settlement-excel.exporter.ts` |
| 6단계 스텝퍼 UI | Phase 6 |
| ManualMatchPanel | Phase 6 |
| 3중 방어 로직 | API route에서 구현 |

---

## V3 구현 체크리스트

### Phase 4 (서비스 레이어) — 대부분 완료
- [x] `matching.service.ts` — autoMatch, manualMatch, cancelMatch
- [x] `settlement.service.ts` — generate, confirm, pay, list, getById
- [x] `settlement.calc.ts` — calculateSettlement
- [ ] 매출장 파서 서비스
- [ ] 네이버 정산 파서 서비스
- [ ] 지급 엑셀 생성 서비스

### Phase 5 (API 라우트)
- [ ] `POST /api/admin/settlement/upload-sales` — 매출장 업로드
- [ ] `POST /api/admin/settlement/upload-naver` — 네이버 정산 업로드
- [ ] `POST /api/admin/settlement/auto-match` — 자동 매칭
- [ ] `POST /api/admin/settlement/manual-match` — 수동 매칭
- [ ] `POST /api/admin/settlement/generate` — 정산 생성
- [ ] `POST /api/admin/settlement/[id]/confirm` — 확정
- [ ] `POST /api/admin/settlement/[id]/pay` — 지급
- [ ] `GET /api/admin/settlement/export` — 지급 엑셀 다운로드

### Phase 6 (UI)
- [ ] 6단계 스텝퍼 UI
- [ ] 매출장 업로드 + 파싱 결과 미리보기
- [ ] 네이버 정산 업로드 + 미리보기
- [ ] 매칭 결과 테이블 (auto/review/unmatched)
- [ ] ManualMatchPanel (좌우 분할)
- [ ] 정산 큐 셀러별 집계
- [ ] 지급 처리 + 엑셀 다운로드
- [ ] 최종 검토 요약

### V2 핵심 UX 유지 사항
1. **6단계 순서**: 매출장→네이버→매칭→큐→지급→검토
2. **"위탁." 접두사 감지**: 매출장 파싱 시 위탁 상품 자동 분류
3. **배송비 행 제외**: 네이버 정산 파싱 시 필터링
4. **3단계 매칭 순서**: 주문번호→구매자+금액→자카드 (순서 중요)
5. **수동 매칭 좌우 분할**: 미매칭 건 나란히 비교
6. **3중 방어**: DB unique + 업로드 dedup + 큐 상태 check
7. **2시트 엑셀**: 건별 상세 + 셀러별 요약
