# Phase 6 Session C — 계획서

**작성일**: 2026-03-13
**변경 레벨**: L1(UI) — 프론트엔드 전용, DB/RPC 무변경
**전제**: Session A(16파일) + Session B(37파일) 완료, 검증 PASS

---

## 1. 대상 페이지 (9개)

| # | 페이지 | Tier | 핵심 기능 |
|---|--------|------|-----------|
| 1 | admin/photos | 2 | 사진 업로드 → AI분류 → 배경제거 → 상품매칭 |
| 2 | admin/products | 2 | 상품 CRUD + 필터 + 네이버 내보내기 |
| 3 | admin/notifications | 2 | 알림 목록 + 수동/대량 SMS 발송 |
| 4 | admin/settlement/history | 2 | 정산 이력 목록 (status/기간/셀러 필터) |
| 5 | admin/settlement/sellers | 2 | 셀러별 정산 현황 + 상세 드릴다운 |
| 6 | admin/sales | 2 | 매출대장 업로드 + 위탁감지 + 세션삭제 |
| 7 | admin/sales/erp | 3 | 네이버 정산 엑셀 업로드 |
| 8 | admin/sales/ledger | 3 | 매출장부 조회 (읽기전용) |
| 9 | admin/database | 3 | 시세 관리 (CRUD) — 사이드바 href=/admin/database |

---

## 2. API 엔드포인트 매핑 (검증 완료)

### 2.1 Photos (4 라우트)
| 메서드 | 경로 | 기능 |
|--------|------|------|
| POST | /api/admin/photos/upload | 메타데이터 등록 |
| POST | /api/admin/photos/classify | AI 분류 실행 |
| POST | /api/admin/photos/edit | 배경 제거 |
| POST | /api/admin/photos/match | 사진-상품 매칭 |

### 2.2 Products (6 라우트)
| 메서드 | 경로 | 기능 |
|--------|------|------|
| GET | /api/admin/products | 목록 (sellerId, brand, search, isActive) |
| POST | /api/admin/products | 등록 |
| GET | /api/admin/products/[id] | 상세 |
| PATCH | /api/admin/products/[id] | 수정 |
| DELETE | /api/admin/products/[id] | 비활성화 |
| GET | /api/admin/products/summary | 요약 통계 |
| GET | /api/admin/products/[id]/naver-export | 단일 네이버 내보내기 |
| POST | /api/admin/products/bulk-export-naver | 일괄 네이버 내보내기 |

### 2.3 Notifications (5 라우트)
| 메서드 | 경로 | 기능 |
|--------|------|------|
| GET | /api/admin/notifications | 목록 (status, triggerEvent, search) |
| POST | /api/admin/notifications/send | 커스텀 발송 |
| POST | /api/admin/notifications/bulk-send | 대량 발송 (max 50) |
| DELETE | /api/admin/notifications/[id] | 삭제 |
| POST | /api/admin/notifications/[id]/resend | 재발송 |

### 2.4 Settlements — History (이미 구현된 라우트 재사용)
| 메서드 | 경로 | 기능 |
|--------|------|------|
| GET | /api/admin/settlements | 목록 (status, periodFrom/To, sellerId) |
| GET | /api/admin/settlements/[id] | 상세 |
| POST | /api/admin/settlements/[id]/confirm | 확정 |
| POST | /api/admin/settlements/[id]/pay | 지급 (paidBy, transferRef) |

### 2.5 Sellers (settlement/sellers 페이지용)
| 메서드 | 경로 | 기능 |
|--------|------|------|
| GET | /api/admin/sellers | 목록 (status, search) |
| GET | /api/admin/sellers/[id] | 상세 |
| PATCH | /api/admin/sellers/[id] | 수정 |
| GET | /api/admin/sellers/[id]/history | 활동 이력 |

### 2.6 Sales (3 라우트)
| 메서드 | 경로 | 기능 |
|--------|------|------|
| POST | /api/admin/sales/upload | 매출대장 업로드 |
| GET | /api/admin/sales/detect-consignment | 위탁 매출 감지 (batchId) |
| DELETE | /api/admin/sales/[sessionId] | 세션 삭제 |

### 2.7 Sales/ERP (1 라우트)
| 메서드 | 경로 | 기능 |
|--------|------|------|
| POST | /api/admin/sales/naver/upload | 네이버 정산 업로드 |

### 2.8 Sales/Ledger (1 라우트)
| 메서드 | 경로 | 기능 |
|--------|------|------|
| GET | /api/admin/sales/ledger | 매출장부 목록 |

### 2.9 Market Prices (2 라우트)
| 메서드 | 경로 | 기능 |
|--------|------|------|
| GET | /api/admin/market-prices | 목록 (brand, category, condition, source) |
| POST | /api/admin/market-prices | 등록 |

### 2.10 보조 (products 등록 시 사용)
| 메서드 | 경로 | 기능 |
|--------|------|------|
| POST | /api/admin/price-estimate | 가격 추정 |

---

## 3. 파일 구조 + 줄수 예측

### Step 10: Photos (5파일)
```
app/admin/(dashboard)/photos/
  page.tsx                   — SSR 래퍼 (~15줄)
  PhotoClient.tsx            — 메인 클라이언트 (~90줄)
  PhotoUploadPanel.tsx       — 업로드 + 분류 실행 UI (~80줄)
  PhotoEditPanel.tsx         — 배경제거 + 매칭 실행 UI (~70줄)
  PhotoGrid.tsx              — 사진 그리드 표시 (~60줄)
```

### Step 11: Products (6파일)
```
app/admin/(dashboard)/products/
  page.tsx                   — SSR 래퍼 (~15줄)
  ProductClient.tsx          — 메인 클라이언트 (목록+필터) (~95줄)
  ProductTable.tsx           — 상품 테이블 (~70줄)
  ProductFormModal.tsx       — 등록/수정 모달 (~90줄)
  ProductDetailModal.tsx     — 상세 + 네이버 내보내기 (~80줄)
  ProductFilters.tsx         — 필터 바 (~50줄)
```

### Step 12: Notifications (5파일)
```
app/admin/(dashboard)/notifications/
  page.tsx                   — SSR 래퍼 (~15줄)
  NotificationClient.tsx     — 메인 클라이언트 (~85줄)
  NotificationTable.tsx      — 목록 테이블 (~65줄)
  SendModal.tsx              — 커스텀/대량 발송 모달 (~80줄)
  NotificationFilters.tsx    — 필터 (status, triggerEvent, search) (~45줄)
```

### Step 13: Settlement 하위 2페이지 + 레이아웃 (8파일)
```
app/admin/(dashboard)/settlement/
  layout.tsx                 — 탭 네비게이션 (목록/이력/셀러/워크플로) (~30줄) ★신규

app/admin/(dashboard)/settlement/history/
  page.tsx                   — SSR 래퍼 (~15줄)
  HistoryClient.tsx          — 정산 이력 목록 (~80줄)
  HistoryFilters.tsx         — 상태/기간/셀러 필터 (~55줄)

app/admin/(dashboard)/settlement/sellers/
  page.tsx                   — SSR 래퍼 (~15줄)
  SellerSettlementClient.tsx — 셀러별 정산 목록 (~85줄)
  SellerDetailModal.tsx      — 셀러 상세 + 활동이력 (~75줄)
```

### Step 14: Sales 하위 + Database (9파일)
```
app/admin/(dashboard)/sales/
  layout.tsx                 — 탭 네비게이션 (매출/ERP/장부) (~25줄) ★신규
  page.tsx                   — SSR 래퍼 (~15줄)
  SalesClient.tsx            — 매출 업로드 + 위탁감지 (~90줄)
  SalesUploadPanel.tsx       — 엑셀 업로드 UI (~70줄)

app/admin/(dashboard)/sales/erp/
  page.tsx                   — SSR 래퍼 (~15줄)
  ErpClient.tsx              — 네이버 정산 업로드 (~65줄)

app/admin/(dashboard)/sales/ledger/
  page.tsx                   — SSR 래퍼 (~15줄)
  LedgerClient.tsx           — 매출장부 조회 (~55줄)

app/admin/(dashboard)/database/
  page.tsx                   — SSR 래퍼 (~15줄)
  MarketPriceClient.tsx      — 시세 CRUD (~85줄)
```

### 신규 공유 컴포넌트/훅 (필요 시)
```
components/FileUpload.tsx    — 엑셀 파일 선택 + 파싱 공유 (~60줄)
hooks/useFileUpload.ts       — 파일 업로드 상태 관리 (~50줄)
```

---

## 4. 총 파일 수 요약

| Step | 페이지 | 파일 수 |
|------|--------|---------|
| 10 | photos | 5 |
| 11 | products | 6 |
| 12 | notifications | 5 |
| 13 | settlement/history + sellers + layout | 8 |
| 14 | sales + erp + ledger + layout + database | 9 |
| 공유 | FileUpload + useFileUpload | 2 |
| **합계** | **9 페이지** | **35 파일** |

---

## 5. 구현 순서 + 에이전트 배치

### 5.1 Step 10-11 (병렬)
- **빌더A**: photos 5파일
- **빌더B**: products 6파일
- 총 11파일

### 5.2 Step 12-13 (병렬)
- **빌더A**: notifications 5파일
- **빌더B**: settlement/layout 1파일 + history 3파일 + sellers 3파일
- 총 12파일

### 5.3 Step 14 (병렬)
- **빌더A**: sales/layout 1파일 + sales 3파일 + erp 2파일 + ledger 2파일
- **빌더B**: database 2파일 + 공유 컴포넌트 2파일
- 총 12파일 (→ 빌더B 여유분은 빌더A 지원)

### 5.4 Session D: 등급 2 검증
- Phase A: 4 에이전트 병렬 (기획자, 빌더, 테스터, 디렉터) × 10 라운드
- Phase B: MUST-FIX 수정 → 디렉터 최종 판정

---

## 6. 공유 패턴 (Session B에서 확립)

| 패턴 | 적용 |
|------|------|
| `useApi<T>(url)` | GET 캐싱 (SWR 기반) |
| `api.post/patch/get` | 뮤테이션 호출 |
| `{ success: true, data }` | API 응답 형태 |
| `TableShell + Pagination` | 목록 페이지 |
| `Modal + FormField` | 폼 모달 |
| `StatusBadge` | 상태 라벨 |
| `SearchInput + useDebounce` | 검색 |
| Double-click guard | `submitting` state |
| `Math.max(0, ...)` | 금액 음수 방지 |

---

## 7. 주의사항

1. **photos 페이지**: Storage 직접 업로드는 Phase 7 영역 → 메타 등록 API만 연결, 실제 파일 업로드는 placeholder
2. **네이버 내보내기**: bulk-export-naver는 POST (body: productIds[]) → 결과를 클립보드/다운로드
3. **매출대장 업로드**: 클라이언트에서 xlsx 파싱 → rows 배열을 POST body로 전송 (서버사이드 파일 검증은 Phase 4 백로그)
4. **price-estimate**: products 등록 모달 내부에서 호출 (별도 페이지 X)
5. **AdminSidebar**: 이미 9개 메뉴 등록 완료 (수정 불필요)
6. **백로그**: MarketPrice 타입이 domain/가 아닌 repo에 정의됨 (아키텍처 위반, Phase 2 영역 — 프론트엔드 영향 없음)
