# V2 검증 기준서 #4: 상품·매출 도메인

## 파일 구조 (21개 파일)

### 핵심 파일
| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `app/admin/products/page.tsx` | 395 | 6상태, 10컬럼 테이블, 네이버 대량 등록 |
| `api/admin/products/bulk-export-naver/route.ts` | 160 | 17컬럼 엑셀, 9 네이버 카테고리 코드 |
| `api/admin/price-estimate/route.ts` | 164 | 네이버 쇼핑 검색→4단계 랭킹→Claude 추정→7일 캐시 |
| `lib/brand-search.ts` | 445 | 59개 브랜드 별칭, 초성 검색, resolveSearchTerms |

---

## 상품 상태 6단계

```typescript
type ProductStatus = 'registered' | 'photographed' | 'edited' | 'listed' | 'sold' | 'returned'
```

---

## 네이버 대량 등록 엑셀 (17컬럼)

| 컬럼 | 설명 |
|------|------|
| 상품명 | 브랜드 + 카테고리 + 색상 |
| 판매가 | 등급별 계산가 |
| 카테고리코드 | 9개 네이버 카테고리 |
| 상품상태 | 중고 |
| 이미지URL | S3/Supabase URL |
| ... | (총 17개) |

**9 네이버 카테고리 코드**: 자켓, 바지, 셔츠, 코트, 조끼, 넥타이, 신발, 가방, 액세서리

---

## 가격 추정 로직

```
1. 네이버 쇼핑 검색 (brand + category)
2. 4단계 랭킹 (가격 분포 분석)
3. Claude Sonnet 추정 (브랜드/카테고리/상태 기반)
4. 7일 캐시 (동일 상품 재요청 방지)
```

---

## 브랜드 검색 (brand-search.ts)

- **59개 브랜드 별칭 맵** (한국어↔영어)
- **초성(자음) 검색**: 한국어 자음으로 브랜드 검색 (예: ㄷㄹㅇㅋㅅ → 드레이크스)
- **핵심 함수**: `resolveSearchTerms(query): string[]` — 직접 조회 + 부분 매칭 + 초성 매칭

---

## 매출 관리

| 페이지 | 파일 | 줄 수 | 기능 |
|--------|------|-------|------|
| 매출 대시보드 | `app/admin/sales/page.tsx` | 194 | DateRangeFilter + SalesChart(recharts) + 요약카드 |
| ERP 내보내기 | `app/admin/sales/erp/page.tsx` | 162 | ERP 엑셀 내보내기 |
| 매출장 | `app/admin/sales/ledger/page.tsx` | 189 | 월별 집계 뷰 |
