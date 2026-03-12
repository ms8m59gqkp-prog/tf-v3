# V2 검증 기준서 #5: 정산 도메인

> 가장 복잡한 도메인 — 45개 파일, 6단계 워크플로우

## 파일 구조 (45개 파일)

### 핵심 파일
| 파일 | 줄 수 | 역할 |
|------|-------|------|
| 정산 메인 페이지 | - | 6단계 스텝퍼 UI |
| `lib/settlement/sales-ledger-parser.ts` | - | 멀티시트 엑셀 파싱, "위탁." 접두사 감지 |
| `lib/settlement/naver-settle-parser.ts` | - | paySettleDailyDetail.xlsx 파싱, 배송비 행 제외 |
| `lib/settlement/product-matcher.ts` | - | 3단계 매칭 알고리즘 |
| `lib/settlement/excel-exporter.ts` | - | 지급 시트 생성 (대금지급명세 + 셀러별요약) |

---

## 정산 6단계 워크플로우

```
Step 1: SalesLedgerStep — 매출장 업로드
Step 2: NaverSettleStep — 네이버 정산 업로드
Step 3: MatchingStep — 자동+수동 매칭
Step 4: QueueStep — 정산 큐 등록
Step 5: PayoutStep — 지급 처리
Step 6: ReviewStep — 최종 검토
```

---

## Step 1: 매출장 업로드 (SalesLedgerStep)

- **파서**: `sales-ledger-parser.ts`
- **입력**: 다중 시트 엑셀 파일
- **"위탁." 접두사 감지**: 상품명이 "위탁."으로 시작하면 위탁 상품으로 분류
- **위탁 셀러 추출**: 위탁 상품에서 셀러 정보 자동 추출
- **출력**: SalesRecord[] (id, productName, buyerName, finalAmount, productNumber, ...)

## Step 2: 네이버 정산 업로드 (NaverSettleStep)

- **파서**: `naver-settle-parser.ts`
- **입력**: paySettleDailyDetail.xlsx (네이버 스마트스토어 정산 다운로드)
- **배송비 행 제외**: 배송비 관련 행 자동 필터링
- **출력**: NaverSettlement[] (id, productName, buyerName, settleAmount, productOrderNo, ...)

## Step 3: 매칭 (MatchingStep)

**3단계 자동 매칭 알고리즘** (product-matcher.ts):

| 순서 | 매칭 방식 | 일치 조건 | matchScore |
|------|----------|----------|------------|
| 1 | 상품주문번호 | productNumber(16자리+) === productOrderNo | 1.0 |
| 2 | 구매자+금액 | buyerName + finalAmount 완전일치 | 0.9 |
| 3 | 상품명 자카드 | Jaccard(productName, productName) ≥ threshold | 0.0~1.0 |

**자카드 유사도 임계값**:
- `THRESHOLD_AUTO = 0.85` — 자동 확정 (auto_matched)
- `THRESHOLD_MANUAL = 0.70` — 수동 검토 필요 (needs_review)

**텍스트 정규화** (V2 소스: product-matcher.ts:78-98):
```
normalize(text): decodeHtmlEntities → toLowerCase → 공백 정리 → trim
jaccard(a, b): normalize → split(/\s+/) → Set 교집합/합집합
productNameSimilarity(a, b): normalizeBrand(normalize(x)) → jaccard
```
주의: V2에 `tokenize`라는 별도 함수는 없음. normalize+split 방식 사용.

**수동 매칭 패널** (ManualMatchPanel):
- 좌: 미매칭 매출장 목록
- 우: 미매칭 네이버 정산 목록
- 한 쌍 선택 → 수동 매칭 + 사유 입력

## Step 4: 정산 큐 (QueueStep)

- 매칭 완료된 건을 셀러별로 그룹화
- 3중 방어 (중복 방지):
  1. **DB UNIQUE 인덱스** — 동일 매칭 중복 삽입 방지
  2. **업로드 중복 검사** — 동일 파일 재업로드 감지
  3. **큐 상태 검사** — confirmed/paid 상태 건 재등록 방지

## Step 5: 지급 처리 (PayoutStep)

- 셀러별 정산 집계
- 지급 엑셀 생성 (excel-exporter.ts):
  - **시트 1**: 대금지급명세 (전체 건별 상세)
  - **시트 2**: 셀러별 요약 (셀러명, 건수, 총액, 수수료, 지급액)

## Step 6: 최종 검토 (ReviewStep)

- 정산 기간 요약
- 건수/금액 최종 확인
- 확정 처리

---

## 정산 상태 전이

```typescript
// V2 소스: lib/settlement/types.ts:189
type SettlementStatus = 'pending' | 'confirmed' | 'paid'
// 주의: V2에는 'draft'와 'failed' 없음. 3가지 상태만 존재.
// 주의: V2에 SETTLEMENT_TRANSITIONS 상수는 정의되어 있지 않음.
// V3에서 정의한 것이므로 V2 검증 기준으로 사용 불가.
```
