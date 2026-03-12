# V2 참조: 상품·매출 도메인 (구현용)

> V3 구현 시 실시간 참조용 — V2 파일 경로, 코드 스니펫, V3 매핑

## V2 파일 인벤토리

### 상품 관리
| V2 파일 | 줄 수 | 역할 |
|---------|-------|------|
| `app/admin/products/page.tsx` | 395 | 6상태, 10컬럼 테이블, 네이버 대량 등록 |
| `api/admin/products/bulk-export-naver/route.ts` | 160 | 17컬럼 엑셀, 9 네이버 카테고리 |
| `api/admin/price-estimate/route.ts` | 164 | 네이버 검색→4단계→Claude 추정→7일 캐시 |
| `lib/brand-search.ts` | 445 | 59 브랜드 별칭 + 초성 검색 |
| `lib/brand-aliases.ts` | 70 | 50 브랜드 한영 매핑 |

### 매출 관리
| V2 파일 | 줄 수 | 역할 |
|---------|-------|------|
| `app/admin/sales/page.tsx` | 194 | 매출 대시보드 (DateRange + Chart + 요약) |
| `app/admin/sales/erp/page.tsx` | 162 | ERP 엑셀 내보내기 |
| `app/admin/sales/ledger/page.tsx` | 189 | 월별 집계 뷰 |

### 시세 조회
| V2 파일 | 역할 |
|---------|------|
| `app/admin/database/page.tsx` | market_prices 대시보드 |

---

## 상품 상태 6단계

```typescript
type ProductStatus = 'registered' | 'photographed' | 'edited' | 'listed' | 'sold' | 'returned'
```

```
registered → photographed → edited → listed → sold
                                        └→ returned
```

---

## 네이버 대량 등록

### 엑셀 17컬럼 (bulk-export-naver)

상품명, 판매가, 카테고리코드, 상품상태(중고), 이미지URL, 상세설명, 옵션, 재고, 배송비, 반품비, 교환비, A/S 정보, 제조사, 브랜드, 모델명, 원산지, 인증정보

### 9 네이버 카테고리 코드
자켓, 바지, 셔츠, 코트, 조끼, 넥타이, 신발, 가방, 액세서리

---

## 가격 추정 로직 (price-estimate)

```
1. 네이버 쇼핑 검색 API 호출 (brand + category)
   → display=20, sort=sim
   → 재시도 3회, 딜레이 [3s, 10s, 30s]

2. 4단계 랭킹 (가격 분포 분석)
   → 검색 결과에서 유사 상품 필터링
   → 가격대 분포 계산

3. Claude Sonnet 추정
   → 브랜드/카테고리/상태 + 시장 데이터 입력
   → 추정 가격 + 근거 출력

4. 7일 캐시
   → 동일 (brand + category + condition) 키로 캐싱
```

---

## 브랜드 검색 시스템

### brand-search.ts (445줄)
- **59개 브랜드 별칭**: 한국어→영어 매핑
- **초성 검색**: 한국어 자음으로 브랜드 검색
  - 예: "ㄷㄹㅇㅋㅅ" → "드레이크스" → "drake's"
- **resolveSearchTerms(query)**: 직접→부분→초성 순서로 매칭

### brand-aliases.ts (70줄)
- **50개 브랜드**: 영어 키 → 한국어 변형[] 배열
- 예: `"drake's": ["드레이크스", "드레익스", "drakes"]`

---

## 매출 관리 3개 뷰

### 1. 매출 대시보드 (sales/page.tsx)
- DateRangeFilter: 시작일~종료일
- SalesChart: recharts 라인/바 차트
- 요약 카드: 총 매출, 건수, 평균 단가

### 2. ERP 내보내기 (sales/erp/page.tsx)
- 기간 선택 → 엑셀 다운로드
- ERP 시스템 연동용 포맷

### 3. 매출장 (sales/ledger/page.tsx)
- 월별 집계 뷰
- 월별 매출/건수/수수료 합계

---

## 시세 조회 (database 페이지)

- **테이블**: `market_prices`
- **기능**: 브랜드 자동완성 검색 + 16개 카테고리 필터
- **결과**: 카드형 표시 (브랜드, 카테고리, 시세 범위)
- **용도**: 검수 시 가격 참고, 가격 추정 보조

---

## V3 구현 체크리스트

### Phase 4 (서비스 레이어)
- [ ] `product.service.ts` — CRUD + 상태 전이
- [ ] `price-estimate.service.ts` — 가격 추정 파이프라인
- [ ] `brand.service.ts` — 브랜드 검색/별칭
- [ ] `sales.service.ts` — 매출 조회/집계
- [ ] `market-price.service.ts` — 시세 CRUD

### Phase 5 (API 라우트)
- [ ] 상품 CRUD API
- [ ] 네이버 대량 등록 엑셀 API
- [ ] 가격 추정 API
- [ ] 매출 조회/집계 API
- [ ] 시세 CRUD API

### Phase 6 (UI)
- [ ] 상품 목록 (6상태, 10컬럼)
- [ ] 네이버 등록 버튼 + 엑셀 다운로드
- [ ] 매출 대시보드 (차트 + 요약)
- [ ] ERP 내보내기
- [ ] 매출장 월별 뷰
- [ ] 시세 조회 (브랜드 검색 + 카드형)

### V2 핵심 UX 유지 사항
1. **6상태 상품 관리**: 등록→촬영→편집→등록→판매 플로우
2. **네이버 대량 등록**: 17컬럼 엑셀 포맷 유지
3. **가격 추정 4단계**: 네이버→랭킹→Claude→캐시
4. **브랜드 초성 검색**: 한국어 자음 검색 기능 유지
5. **매출 3뷰 구조**: 대시보드/ERP/매출장
