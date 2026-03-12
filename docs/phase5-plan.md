# Phase 5 — API 라우트 구현 계획 (Rev.3)

**변경 레벨**: L2 (API/Service)
**참조 문서**:
- `archieves/plan5.md` §8 (63개 라우트, Tier 구조, 표준 핸들러 패턴)
- `docs/Control Layer/architecture-spec.md` §3.4, §4 (레이어 규칙, 줄수 제한)
- `docs/Control Layer/analysis-techniques.md` (위험 등급별 검증)
- `docs/Operational Layer/agent-ops-guide.md` (작업 루틴, 검증 규칙)
- `archieves/phase-checklists.md` §Phase 5 (구현/검증 체크리스트)
- V2 참조 문서 6종 (v2-ref-consignment, orders, settlement, photos, products-sales, notification-auth)

---

## 현황

- **완료**: 8개 서비스, 25개 레포지토리, 인증/미들웨어/응답 헬퍼 모두 준비
- **기존 라우트**: `/api/admin/auth/login`, `/api/admin/auth/logout` (2개)
- **Rev.3 확정**: 64개 라우트 (Tier 1: 11, Tier 2: 20, DELETE: 6, Tier 3+미분류: 27)

---

## Rev.3 변경 이력 (analysis-techniques.md 등급 2 검증 결과)

### 검증 수행 내역 (10회 완료)

| Phase | 에이전트 | 기법 | 회차 |
|-------|---------|------|------|
| 병렬 1 | 기획자 | 딥시뮬레이션 (정상/실패) | 2회 |
| 병렬 2 | 빌더 | 엣지케이스 × 2 + 디펜던시 × 2 | 4회 |
| 병렬 3 | 테스터 | 레드팀 (입력 공격/권한 우회) | 2회 |
| 순차 | 디렉터 | 아키텍트 리뷰 (적합성/확장성) | 2회 |

### 디렉터 최종 판정: 수정필요 (Conditional Approve)

### 목록 변경 사항

| 변경 | Rev.2 | Rev.3 | 사유 |
|------|-------|-------|------|
| #42 제거 | `POST /notifications/status-change` | 삭제 | 내부 호출용 — API 노출은 불필요한 공격 표면 (엣지케이스+아키텍트) |
| Public GET 추가 | 없음 | `GET /consignment/adjust/[token]` | 페이지 렌더링 시 데이터 조회 필요 (아키텍트 Phase 6 대응) |
| Public GET 추가 | 없음 | `GET /orders/[productId]/hold` | 페이지 렌더링 시 상품 정보 조회 필요 (아키텍트 Phase 6 대응) |
| #58-63 확정 | "기타" 미정의 | 구체적 경로 확정 | 미확정 상태 구현 착수 금지 (아키텍트 P1-2) |
| 번호 재정렬 | 63개 | 64개 | #42 제거(-1) + Public GET 추가(+2) = 순증 +1 |

---

## P0 — Phase 5 착수 전 필수 해결 (전 4건 해결 완료)

| # | 문제 | 해결 | 상태 |
|---|------|------|------|
| P0-1 | Rate Limiter fail-open | `proxy.ts` 인메모리 fallback (`fallbackLimit`) 추가 — Redis 장애 시 fail-closed | ✅ |
| P0-2 | Public 라우트 전용 Rate Limit | `/api/consignment/*`, `/api/orders/*` 경로에 IP당 30/min 적용 (`proxy.ts`) | ✅ |
| P0-3 | 정산 이중 지급 TOCTOU | `settlement-status.repo.ts` `.eq('status','confirmed')` optimistic lock 기존 구현 확인 | ✅ (기존) |
| P0-4 | 동적 세그먼트 Zod 검증 | `validation.ts`에 `uuidSchema`, `tokenSchema`, `dateSchema`, `pageSchema` 추가 | ✅ |

---

## 위험 등급 판단 (analysis-techniques.md 기준)

**등급 2 (중위험)**: 새 API 엔드포인트 추가, DB 조회 쿼리, 입력값 검증, 페이지네이션
- 정산/매칭 등 L3 관련 라우트는 **등급 3**으로 상향 적용

**검증 계획** (등급 2: 최소 10회):
- [기획자] 딥시뮬레이션 × 2 (정상/실패)
- [빌더] 엣지케이스 × 2 + 디펜던시 × 2
- [테스터] 레드팀 × 2 (입력 공격/권한 우회)
- [디렉터] 아키텍트 리뷰 × 2

---

## 표준 핸들러 패턴 (plan5.md §8.2 기준)

```typescript
/**
 * [메서드] [경로] — [1줄 설명]
 * WHY: [비즈니스 목적]
 * HOW: withAdmin → Zod 검증 → 서비스 위임 → 표준 응답
 * WHERE: [이 라우트를 호출하는 UI 페이지]
 */
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { XxxSchema } from './schema'
import * as service from '@/lib/services/xxx.service'

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = XxxSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)
    const result = await service.xxx(parsed.data)
    return ok(result)
  } catch (e) { return errFrom(e) }
})
```

---

## 서비스 존재 여부 분류

### 서비스 있음 (Phase 4 완료) → 즉시 라우트 구현 가능
| 서비스 | 함수 | 비고 |
|--------|------|------|
| consignment.service | list, getById, bulkCreate, updateStatus, approveConsignment, batchDelete | 6함수 |
| order.service | list, getById, updateStatus, updateItem, getItems | 5함수 |
| product.service | list, getById, create, update, getSummary | 5함수 |
| settlement.service | list, getById, generate, confirm, pay | 5함수 |
| matching.service | autoMatch, manualMatch, cancelMatch, queueSettlements, getQueueSummary, clearQueue | 6함수 |
| sales.service | uploadSalesLedger, uploadNaverSettle, detectConsignmentSales | 3함수 |
| notification.service | sendCustom, list | 2함수 (notifyStatusChange는 내부 호출용) |
| photo.service | classify, match | 2함수 |

### 서비스 확장 필요 (Phase 5-B)
| 서비스 | 추가 함수 | 라우트 |
|--------|-----------|--------|
| consignment.service | create (단건 등록) | POST /api/admin/consignments |
| order.service | inspection, measurement | POST /api/admin/orders/[id]/inspection, measurement |
| notification.service | bulkSend, resend | POST /api/admin/notifications/bulk-send, resend |
| sales.service | deleteBySession | DELETE /api/admin/sales/[sessionId] |
| product.service | delete | DELETE /api/admin/products/[id] |

### 신규 서비스 필요 (Phase 5-C)
| 필요 서비스 | V2 ref 출처 | 라우트 |
|------------|-------------|--------|
| infra-check.service | plan5.md §8.3 | GET /api/health |
| price-estimate.service | v2-ref-products-sales | POST /api/admin/price-estimate |
| market-price.service | v2-ref-products-sales | GET/POST /api/admin/market-prices |
| photo-upload.service | v2-ref-photos | POST /api/admin/photos/upload |
| photo-edit.service | v2-ref-photos | POST /api/admin/photos/edit |
| naver-export.service | v2-ref-products-sales | POST /api/admin/products/bulk-export-naver, GET /api/admin/products/[id]/naver-export |
| seller.service | plan5.md | GET/GET [id]/PATCH /api/admin/sellers |
| dashboard.service | plan5.md | GET /api/admin/dashboard |
| settlement-export.service | v2-ref-settlement | POST /api/admin/settlements/export |
| (consignment adjust) | v2-ref-consignment | Public: GET/POST /api/consignment/adjust/[token] |
| (order hold) | plan5.md | Public: GET/POST /api/orders/[productId]/hold |

---

## 라우트 인벤토리 (Rev.3 확정 — 64개)

### Tier 1 CRITICAL (11개) — 가장 먼저

| # | HTTP | 경로 | 서비스 함수 | 상태 |
|---|------|------|------------|------|
| 1 | GET | `/api/health` | infra-check.service (신규) | 🆕 |
| 2 | GET | `/api/admin/consignments` | consignment.list | ✅ |
| 3 | POST | `/api/admin/consignments` | consignment.create (확장) | ⚠️ |
| 4 | POST | `/api/admin/consignments/bulk` | consignment.bulkCreate | ✅ |
| 5 | PATCH | `/api/admin/consignments/[id]` | consignment.updateStatus | ✅ |
| 6 | GET | `/api/admin/orders` | order.list | ✅ |
| 7 | PATCH | `/api/admin/orders/[id]` | order.updateStatus | ✅ |
| 8 | POST | `/api/admin/orders/[id]/inspection` | order.inspection (확장) | ⚠️ |
| 9 | POST | `/api/admin/orders/[id]/measurement` | order.measurement (확장) | ⚠️ |
| 10 | POST | `/api/admin/settlements/generate` | settlement.generate | ✅ |
| 11 | GET | `/api/admin/settlements` | settlement.list | ✅ |

### Tier 2 HIGH (20개)

| # | HTTP | 경로 | 서비스 함수 | 상태 |
|---|------|------|------------|------|
| 12 | GET | `/api/admin/consignments/[id]` | consignment.getById | ✅ |
| 13 | POST | `/api/admin/consignments/[id]/approve` | consignment.approveConsignment | ✅ |
| 14 | GET | `/api/admin/orders/[id]` | order.getById | ✅ |
| 15 | GET | `/api/admin/orders/[id]/items` | order.getItems | ✅ |
| 16 | PATCH | `/api/admin/orders/items/[itemId]` | order.updateItem | ✅ |
| 17 | GET | `/api/admin/products` | product.list | ✅ |
| 18 | POST | `/api/admin/products` | product.create | ✅ |
| 19 | GET | `/api/admin/products/[id]` | product.getById | ✅ |
| 20 | PATCH | `/api/admin/products/[id]` | product.update | ✅ |
| 21 | GET | `/api/admin/products/summary` | product.getSummary | ✅ |
| 22 | GET | `/api/admin/settlements/[id]` | settlement.getById | ✅ |
| 23 | POST | `/api/admin/settlements/[id]/confirm` | settlement.confirm | ✅ |
| 24 | POST | `/api/admin/settlements/[id]/pay` | settlement.pay (P0-3 TOCTOU 방어) | ✅ |
| 25 | POST | `/api/admin/matching/auto` | matching.autoMatch | ✅ |
| 26 | POST | `/api/admin/matching/manual` | matching.manualMatch | ✅ |
| 27 | GET | `/api/admin/matching/queue/summary` | matching.getQueueSummary | ✅ |
| 28 | POST | `/api/admin/matching/queue` | matching.queueSettlements | ✅ |
| 29 | POST | `/api/admin/photos/classify` | photo.classify | ✅ |
| 30 | POST | `/api/admin/photos/match` | photo.match | ✅ |
| 31 | GET | `/api/admin/notifications` | notification.list | ✅ |

### DELETE 라우트 (6개)

| # | HTTP | 경로 | 서비스 함수 | 상태 |
|---|------|------|------------|------|
| 32 | DELETE | `/api/admin/consignments/[id]` | consignment.batchDelete | ✅ |
| 33 | DELETE | `/api/admin/matching/[id]` | matching.cancelMatch | ✅ |
| 34 | DELETE | `/api/admin/matching/queue` | matching.clearQueue | ✅ |
| 35 | DELETE | `/api/admin/sales/[sessionId]` | sales.deleteBySession (확장) | ⚠️ |
| 36 | DELETE | `/api/admin/notifications/[id]` | notification.delete (확장) | ⚠️ |
| 37 | DELETE | `/api/admin/products/[id]` | product.delete (확장, FK cascade 확인) | ⚠️ |

### Tier 3 MEDIUM/LOW + 미분류 (27개)

| # | HTTP | 경로 | 서비스 함수 | 상태 |
|---|------|------|------------|------|
| 38 | POST | `/api/admin/sales/upload` | sales.uploadSalesLedger | ✅ |
| 39 | POST | `/api/admin/sales/naver/upload` | sales.uploadNaverSettle | ✅ |
| 40 | GET | `/api/admin/sales/detect-consignment` | sales.detectConsignmentSales | ✅ |
| 41 | POST | `/api/admin/notifications/send` | notification.sendCustom | ✅ |
| 42 | POST | `/api/admin/notifications/bulk-send` | notification.bulkSend (확장) | ⚠️ |
| 43 | POST | `/api/admin/notifications/resend` | notification.resend (확장) | ⚠️ |
| 44 | POST | `/api/admin/photos/upload` | photo-upload.service (신규) | 🆕 |
| 45 | POST | `/api/admin/photos/edit` | photo-edit.service (신규) | 🆕 |
| 46 | POST | `/api/admin/price-estimate` | price-estimate.service (신규) | 🆕 |
| 47 | POST | `/api/admin/products/bulk-export-naver` | naver-export.service (신규) | 🆕 |
| 48 | GET | `/api/admin/sellers` | seller.service (신규) | 🆕 |
| 49 | GET | `/api/admin/sellers/[id]` | seller.service (신규) | 🆕 |
| 50 | PATCH | `/api/admin/sellers/[id]` | seller.service (신규) | 🆕 |
| 51 | GET | `/api/admin/market-prices` | market-price.service (신규) | 🆕 |
| 52 | POST | `/api/admin/market-prices` | market-price.service (신규) | 🆕 |
| 53 | GET | `/api/admin/sales/erp` | sales.erp (확장) | ⚠️ |
| 54 | GET | `/api/admin/sales/ledger` | sales.ledger (확장) | ⚠️ |
| 55 | POST | `/api/admin/settlements/export` | settlement-export.service (신규) | 🆕 |
| 56 | GET | `/api/admin/dashboard` | dashboard.service (신규) | 🆕 |
| 57 | GET | `/api/admin/batch/[batchId]/progress` | batch-progress.repo 래핑 | 🆕 |
| 58 | GET | `/api/admin/settlements/history` | settlement.service 확장 | ⚠️ |
| 59 | GET | `/api/admin/sellers/[id]/history` | seller.service (신규) | 🆕 |
| 60 | GET | `/api/admin/products/[id]/naver-export` | naver-export.service (신규) | 🆕 |
| 61 | GET | `/api/consignment/adjust/[token]` | (Public: 토큰 검증+현재값 조회) | 🆕 |
| 62 | POST | `/api/consignment/adjust/[token]` | (Public: 가격조정 응답) | 🆕 |
| 63 | GET | `/api/orders/[productId]/hold` | (Public: 상품 정보 조회) | 🆕 |
| 64 | POST | `/api/orders/[productId]/hold` | (Public: 주문보류 요청) | 🆕 |

---

## 구현 카테고리 집계

| 카테고리 | 개수 | 설명 |
|----------|------|------|
| ✅ 서비스 있음 (Phase 5-A) | **34** | 라우트만 구현 |
| ⚠️ 서비스 확장 (Phase 5-B) | **10** | 기존 서비스에 함수 추가 |
| 🆕 신규 서비스 (Phase 5-C) | **20** | 서비스 + 라우트 동시 구현 |
| **합계** | **64** | + 기존 auth 2개 = 총 66 |

---

## 서비스 존재 여부별 구현 전략

### Phase 5-A: 서비스 있음 → 라우트만 구현 (34개)
바로 구현 가능. `withAdmin → Zod → service → ok/errFrom` 패턴 적용.

### Phase 5-B: 서비스 확장 필요 (10개)
기존 서비스에 함수 추가 후 라우트 구현:
- `consignment.service` → create (단건 등록)
- `order.service` → inspection, measurement
- `notification.service` → bulkSend, resend, delete
- `sales.service` → deleteBySession, erp, ledger
- `product.service` → delete (FK cascade 확인 필수)
- `settlement.service` → history

### Phase 5-C: 신규 서비스 필요 (20개)
서비스 + 레포지토리 + 라우트 동시 구현:
- infra-check, price-estimate, market-price, photo-upload, photo-edit
- naver-export, seller, dashboard, settlement-export, batch-progress 래퍼
- Public routes (consignment/adjust, orders/hold)

---

## 구현 순서

1. **P0 해결** (착수 전): Rate Limiter fallback, Public Rate Limit, 정산 TOCTOU, Zod 검증 표준
2. **Phase 5-A**: 서비스 있는 라우트 34개 (Tier 1 → Tier 2 → DELETE → Tier 3 순)
3. **Phase 5-B**: 서비스 확장 10개
4. **Phase 5-C**: 신규 서비스 20개

---

## plan5.md §8.3 — /api/health 상세

```typescript
// infra-check.service.ts로 래핑 (L3→L0 직접 의존 해소)
// HEALTHCHECK_TOKEN 없으면 { status } 만 반환
// 토큰 있으면 { status, checks: { db, storage, sms }, timestamp }
// 각 체크에 Promise.race(check(), timeout(3000)) 개별 타임아웃 적용
// 3개 체크 Promise.allSettled()로 병렬 실행
// DB: SELECT 1 FROM sellers LIMIT 1
// Storage: supabase.storage.listBuckets()
// SMS: 알리고 잔액 API → 잔액 > 0
```

## plan5.md §8.4 — upload-naver-settle 세션 기반 패턴

```typescript
// x-upload-session-id 헤더로 세션 관리
// 재시도 시 해당 세션의 미매칭만 정리 (동시 업로드 격리)
// sessionId는 클라이언트 보관, 재전송
```

---

## 검증 게이트 (plan5.md §8.6 + phase-checklists.md)

- [ ] `tsc --strict --noEmit` → 에러 0건
- [ ] ESLint `--max-warnings 0`
- [ ] requireAdmin 반환값 사용 강제
- [ ] 모든 POST/PATCH에 schema.ts 존재
- [ ] `wc -l app/api/**/route.ts` → 모든 라우트 100줄 이내
- [ ] `grep -r "\.or(\`" app/` → 0건
- [ ] `grep -r "req.json()" app/api/ | grep -v "catch"` → 0건
- [ ] DB 업데이트 → 응답 생성 순서 준수 (R4-03)
- [ ] 상태 하드코딩 0건
- [ ] [Rev.3] 모든 [id] 파라미터 Zod UUID 검증 확인

---

## 검증 결과 요약 (analysis-techniques.md)

### 상 등급 발견 (7건 → P0/P1로 대응)
- F-01: /api/ready 누락 → P3-4 (Kubernetes 배포 시 추가)
- F-02: consignment completed 자동생성 체인 → Phase 5-B에서 서비스 확장
- F-03: Phase 4 서비스 9건 미완 → Phase 5-C에서 신규 서비스로 구현
- F-04: 엑셀 파서 미구현 → sales.service 확장 시 포함
- F-05: photo upload/edit 서비스 미구현 → Phase 5-C 신규 서비스
- F-06: settlement export 엑셀 생성 미구현 → Phase 5-C 신규 서비스
- F-07: photos/classify SSE vs POST → Vercel 10초 내 가능하면 POST 유지

### 보안 Critical (4건 → P0로 대응)
- Rate Limiter fail-open → P0-1
- Public 라우트 무인증 + Rate Limit 부재 → P0-2
- 정산 이중 지급 TOCTOU → P0-3
- 토큰 브루트포스 → P0-2 + P0-4 (Zod 검증)

### 구조 주의 사항
- health → infra-check.service.ts로 래핑 (L3→L0 직접 의존 해소)
- dashboard.service → aggregator 패턴, 150줄 제한 엄격 적용
- price-estimate, market-price → 독립 서비스 유지 (product.service 비대화 방지)
- withAdmin에 adminId 주입 확장 포인트 → 멀티 관리자 전환 대비 (P3)

---

## agent-ops-guide.md 준수 사항

- 오늘 범위: Phase 5, 변경 레벨 L2
- 금지사항: services에서 NextRequest 사용, .or() 템플릿, 이미지 하드코딩
- route.ts는 얇게: 인증 → 검증 → 서비스 위임 → 응답
- feature/* 브랜치에서 작업
- Cross-QA 전 main merge 금지
