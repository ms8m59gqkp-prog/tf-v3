# Classic Menswear V3 — 3차 심층 리서치 보고서

**작성일**: 2026-02-28
**기준**: 클로드코드교리 v2.0
**목적**: V3 최적 구현 설계를 위한 AS-IS/TO-BE 분석, 에러 최소화, 중첩 제거, 구현 후 리스크 검증
**원칙**: 코드 수정 없이 조사/보고만 수행

---

## 목차

1. [치명적 발견: 미들웨어 미작동 (전체 인증 무효)](#1-치명적-발견-미들웨어-미작동)
2. [기능별 AS-IS vs SHOULD-BE 분석](#2-기능별-as-is-vs-should-be-분석)
3. [전체 82개 핸들러 에러 최소화 테이블](#3-전체-82개-핸들러-에러-최소화-테이블)
4. [중첩/중복 책임 상세 분석](#4-중첩중복-책임-상세-분석)
5. [V3 최적 5레이어 아키텍처 블루프린트](#5-v3-최적-5레이어-아키텍처-블루프린트)
6. [구현 후 리스크 분석 (Post-Implementation Risks)](#6-구현-후-리스크-분석)
7. [통합 구현 권장사항](#7-통합-구현-권장사항)
8. [7단계 빌드 시퀀스](#8-7단계-빌드-시퀀스)
9. [전체 요약 및 우선순위](#9-전체-요약-및-우선순위)

---

## 1. 치명적 발견: 미들웨어 미작동

### 발견 내용

`.next/dev/server/middleware-manifest.json` 확인 결과:

```json
{ "version": 3, "middleware": {}, "sortedMiddleware": [], "functions": {} }
```

**`"middleware": {}`** — Next.js에 등록된 미들웨어가 **없음**.

### 근본 원인

| 항목 | 현재 상태 | Next.js 요구사항 |
|------|----------|----------------|
| 파일명 | `proxy.ts` | `middleware.ts` |
| 함수명 | `export function proxy()` | `export function middleware()` |
| config | `export const config = { matcher: [...] }` (올바른 형식) | — |

파일명과 함수명이 Next.js 컨벤션과 불일치하여 Next.js가 **미들웨어 자체를 인식하지 않음**.

### 영향 범위

- **세션 검증**: 모든 라우트에서 미실행
- **레이트 리밋**: 모든 라우트에서 미실행
- `/admin/*` 페이지: 로그인 없이 접근 가능
- `/api/admin/*` 엔드포인트: 완전 공개 상태
- **인증 인프라 자체는 정상**: `lib/auth.ts`의 HMAC-SHA256 + timing-safe 비교 구현은 올바름. 다만 **적용되지 않을 뿐**.

### V3 최적 구현

```typescript
// middleware.ts (루트)
export function middleware(request: NextRequest) {
  // 1. Rate limiting (기존 ratelimit.ts 로직 유지)
  // 2. /admin/* 페이지 → 세션 쿠키 검증 → 미인증 시 /admin/login 리다이렉트
  // 3. /api/admin/* API → 세션 쿠키 검증 → 미인증 시 401 JSON 응답
  // 4. /api/admin/auth/login 제외 (로그인 엔드포인트)
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
```

추가로 각 API 라우트에 `requireAdmin()` 인라인 가드 적용 (미들웨어 우회 방지):

```typescript
// lib/api/middleware.ts
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_session')?.value
  if (!token) return err('인증이 필요합니다', 401)
  const session = verifySession(token)
  if (!session) return err('세션이 만료되었습니다', 401)
  return null // 인증 통과
}
```

---

## 2. 기능별 AS-IS vs SHOULD-BE 분석

### Feature 1: 인증 (Auth)

| 항목 | AS-IS | SHOULD-BE |
|------|-------|-----------|
| 미들웨어 | `proxy.ts` — Next.js 미인식, 미작동 | `middleware.ts` — 파일명/함수명 수정 |
| API 인증 | `/api/admin/*` 완전 공개 | 모든 admin API에 `requireAdmin()` 적용 |
| 비밀번호 | 평문 비교 (`admin_password` 직접 비교) | bcrypt/argon2 해싱 |
| 세션 | HMAC-SHA256 7일 (구현은 정상) | 유지, 세션 갱신 로직 추가 |

### Feature 2: 위탁 접수 (Consignment)

| 항목 | AS-IS | SHOULD-BE |
|------|-------|-----------|
| 완료 처리 | 5단계 비원자적 (products→orders→status) | Supabase RPC 트랜잭션 1회 |
| 상태 타입 | 3값 정의 (`route.ts:14`) vs 7값 DB CHECK | 단일 7값 타입 (`lib/types/`) |
| 주문번호 | `Math.random()` — 충돌 시 실패, 재시도 없음 | UUID 또는 충돌 시 재시도 로직 |
| 판매자코드 | `sellerList.length`로 seq — 동시성 충돌 | DB sequence 또는 atomic counter |
| seller_type | `'general'` 하드코딩 | 실제 판매자 tier 참조 |
| 엑셀 업로드 | 행당 2-3 DB 호출 (N+1) | 배치 upsert |

### Feature 3: 정산 (Settlement)

| 항목 | AS-IS | SHOULD-BE |
|------|-------|-----------|
| 파이프라인 | **2개 병렬** (A: sold_items, B: settlement_queue) | **1개 통합** 파이프라인 |
| 원자성 | 비원자적: insert→items→status 순차 | Supabase RPC 트랜잭션 |
| 커미션 계산 | 5곳 분산 (0.25/0.20 불일치) | `lib/types/domain/seller.ts` 단일 소스 |
| 타임존 | UTC/로컬 혼용 — KST 서버에서 1일 오차 | KST 일관 사용 (`toKSTDate()`) |
| 이중 정산 방지 | 없음 | `FOR UPDATE` 잠금 또는 `settlement_id` FK UNIQUE |
| `paidMessage` | 데드 코드 — 판매자 지급 알림 미발송 | 지급 완료 시 SMS 트리거 |

### Feature 4: 사진 (Photos)

| 항목 | AS-IS | SHOULD-BE |
|------|-------|-----------|
| 스토리지 | 로컬 파일시스템 (`process.cwd()/storage/`) | Supabase Storage |
| Vercel 호환 | **불가** — 배포 시 사진 소실 (이미 프로덕션 버그) | 클라우드 스토리지로 전환 |
| 인증 | `storage-serve` 엔드포인트 인증 없음 | requireAdmin 또는 signed URL |
| 이미지 처리 | `sharp` + 로컬 파일 읽기 | Buffer 기반 파이프라인 |

### Feature 5: SMS 알림 (Notifications)

| 항목 | AS-IS | SHOULD-BE |
|------|-------|-----------|
| 발송 누락 | `on_hold`, `rejected`, `paid` 전환 시 SMS 없음 | 모든 상태 전환에 이벤트 디스패처 |
| 가격조정 | `console.log`만 — 실제 SMS 미발송 | `notification.service.ts` 통합 |
| 전화번호 | 하드코딩 (`templates.ts`) | 환경변수 |
| 로깅 | 산재 — 각 라우트에서 개별 처리 | 중앙 로깅 (`notifications.repo.ts`) |

### Feature 6: 주문 (Orders)

| 항목 | AS-IS | SHOULD-BE |
|------|-------|-----------|
| 상태 머신 | 없음 — 아무 상태로든 전환 가능 | 허용 전환 정의 + 타입 가드 |
| 페이지네이션 | GET 모든 주문 반환 (limit 없음) | 커서 기반 페이지네이션 |
| 주문 생성 | 비원자적 (orders→items, 실패 시 수동 delete) | Supabase RPC 트랜잭션 |
| mapOrder() | API 라우트 핸들러에 위치 | `lib/db/mappers/order.mapper.ts`로 분리 |

### 전체 기능 이슈 요약 테이블

| # | 기능 | 심각도 | 이슈 |
|---|------|--------|------|
| 1 | Auth | CRITICAL | `proxy.ts`가 미들웨어로 로드되지 않음 — 전체 인증 미작동 |
| 2 | Auth | HIGH | `/api/admin/*` 세션 체크 없음 (미들웨어 활성화되어도) |
| 3 | Auth | HIGH | 관리자 비밀번호 평문 비교 |
| 4 | Consignment | HIGH | `completed` 전환 DB 트랜잭션 없음 — 부분 생성 가능 |
| 5 | Consignment | MEDIUM | `Math.random()` 주문번호 — 부하 시 충돌 |
| 6 | Consignment | MEDIUM | 판매자코드 동시 업로드 시 중복 |
| 7 | Settlement | HIGH | `paidMessage()` 데드 코드 — 지급 알림 미발송 |
| 8 | Settlement | HIGH | 구/신 파이프라인 공존, 폐기 계획 없음 |
| 9 | Settlement | MEDIUM | 네이버 정산 재업로드 시 미매칭 데이터 전체 삭제 |
| 10 | Settlement | MEDIUM | 매칭 허용 오차 0% — 1원 쿠폰 차이로 매칭 실패 |
| 11 | Photos | HIGH | 로컬 파일시스템 — 배포 시 사진 소실 (프로덕션 버그) |
| 12 | Photos | HIGH | `storage-serve` 인증 없음 |
| 13 | SMS | MEDIUM | `on_hold`, `rejected`, `paid` 전환 시 SMS 미발송 |
| 14 | SMS | LOW | 사업자 전화번호 소스코드 하드코딩 |
| 15 | Orders | MEDIUM | 상태 머신 없음 — 임의 상태 전환 가능 |
| 16 | Orders | MEDIUM | GET 페이지네이션 없음 |

---

## 3. 전체 82개 핸들러 에러 최소화 테이블

### 컬럼 설명

- **IV** = Input Validation (Y/N/P=부분)
- **TC** = try/catch (Y/N)
- **PF** = Partial Failure 처리 (Tx=트랜잭션/MR=수동롤백/PA=Promise.all결과무시/SI=사일런트무시/None)
- **EL** = Error Logged (Y/N/P=부분)
- **RS** = 응답형태 준수 (Y/N)

```
라우트                                              메서드  IV  TC  PF     EL  RS  비고
──────────────────────────────────────────────────────────────────────────────────────────
admin/auth/login                                    POST   P   N   None   N   Y   request.json() 비보호 → 잘못된 body에 raw 500
admin/auth/logout                                   POST   N   Y   None   N   Y   —
admin/orders                                        GET    N   N   None   N   Y   try/catch 없음; DB 에러 시 사일런트 크래시
admin/orders                                        POST   P   N   MR     P   Y   try/catch 없음; 롤백(delete)이 에러 체크 안됨
admin/orders                                        PATCH  P   N   None   N   Y   try/catch 없음; 2개 독립 DB 변경 중 2번째 실패 시 롤백 불가
admin/orders/search                                 GET    P   Y   None   Y   Y   —
admin/products                                      GET    N   Y   None   Y   Y   —
admin/products/bulk-export-naver                    GET    N   Y   None   Y   Y   —
admin/consignments                                  GET    N   Y   None   Y   Y   —
admin/consignments                                  POST   P   Y   None   P   Y   행당 2-3 DB호출(N+1); 전화번호 정규화 불일치
admin/consignments/[id]                             PATCH  P   N   SI     P   Y   try/catch 없음; stuck-consignment 버그 (상세 아래)
admin/consignments/create-single                    POST   P   Y   None   Y   Y   —
admin/consignments/return-shipment                  POST   P   N   None   N   Y   try/catch 없음; 택배 API 성공→DB 실패 시 기록 없는 픽업
admin/consignments/upload-photo                     POST   P   Y   None   Y   Y   —
admin/notifications                                 GET    N   Y   None   Y   Y   —
admin/notifications/send-sms                        POST   P   N   None   N   Y   try/catch 없음; Solapi SDK 동기 예외 미처리
admin/notifications/resend                          POST   P   N   None   N   Y   try/catch 없음; 동일 Solapi 노출
admin/notifications/bulk-send                       POST   P   Y   SI     P   Y   건별 fire-and-forget; 벌크 에러 사일런트 무시
admin/photos/classify                               POST   P   Y   None   Y   Y   —
admin/photos/download                               GET    N   Y   None   Y   Y   —
admin/photos/edit                                   POST   P   Y   None   Y   Y   —
admin/photos/generate-detail-image                  POST   P   Y   None   Y   Y   —
admin/photos/generate-measurement-card              POST   P   Y   None   Y   Y   —
admin/photos/link-to-product                        POST   P   Y   None   Y   Y   —
admin/photos/list                                   GET    N   Y   None   Y   Y   —
admin/photos/match                                  POST   P   Y   None   Y   Y   SSE 스트림; 에러는 SSE 이벤트로 전달
admin/photos/process-storage                        POST   N   Y   None   Y   Y   —
admin/photos/storage                                GET    N   Y   None   Y   Y   —
admin/photos/storage-serve                          GET    N   Y   None   Y   Y   —
admin/photos/upload                                 POST   P   Y   None   Y   Y   —
admin/price-estimate                                GET    P   Y   None   Y   Y   —
admin/sales                                         GET    N   Y   None   Y   Y   —
admin/sales/erp                                     GET    N   Y   None   Y   Y   —
admin/sellers/for-notification                      GET    N   Y   None   Y   Y   —
admin/upload-photos                                 GET    N   Y   None   Y   Y   —
admin/upload-photos                                 POST   P   Y   None   P   Y   N+1 dedup; 스트리밍 업로드 설계상 의도
consignment/adjust/[token]                          GET    P   Y   None   Y   Y   —
consignment/adjust/[token]                          PATCH  P   Y   None   Y   Y   —
consignment/adjust/[token]/return                   POST   P   Y   None   Y   Y   —
orders/[productId]/hold                             POST   P   Y   None   Y   Y   —
settlement/auto-match                               POST   P   Y   PA     P   Y   Promise.all 결과 미확인; 일방적 매칭 상태
settlement/auto-match                               GET    N   Y   None   Y   Y   —
settlement/confirm/[id]                             POST   P   Y   None   Y   Y   —
settlement/detail/[id]                              GET    P   Y   None   Y   Y   —
settlement/export/mismatch-report                   GET    N   Y   None   Y   Y   스텁 — mismatches=[] 하드코딩
settlement/export/sales-ledger                      GET    N   Y   None   Y   Y   —
settlement/export/settlement-list/[id]              GET    P   Y   None   Y   Y   —
settlement/generate                                 POST   P   Y   SI     P   Y   insert 실패 시 continue; items/status 에러 미확인
settlement/generate-payout                          GET    N   Y   None   Y   Y   —
settlement/generate-payout                          POST   P   Y   None   P   Y   응답 생성 후 DB 업데이트; 실패 시 파일 소실
settlement/list                                     GET    N   Y   None   Y   Y   —
settlement/manual-match                             PATCH  P   Y   PA     P   Y   Promise.all 결과 미확인; 일방적 match_status
settlement/manual-match                             DELETE P   Y   PA     P   Y   Promise.all 결과 미확인; 롤백 반쪽만 적용 가능
settlement/pay/[id]                                 POST   P   Y   None   Y   Y   —
settlement/queue-settlements                        POST   P   Y   None   Y   Y   커미션 0.25 하드코딩 폴백
settlement/queue-settlements                        DELETE P   Y   None   P   Y   —
settlement/queue-settlements                        GET    N   Y   None   Y   Y   —
settlement/review-report                            GET    N   Y   None   Y   Y   순차 청크 쿼리; 병렬화 가능
settlement/sellers                                  GET    N   Y   None   Y   Y   —
settlement/upload-confirm                           POST   P   Y   None   P   Y   행당 1 UPDATE (N+1; 의도적 설계)
settlement/upload-naver-settle                      GET    N   Y   None   Y   Y   —
settlement/upload-naver-settle                      POST   P   Y   None   Y   Y   —
settlement/upload-sales                             POST   P   Y   None   Y   Y   —
settlement/upload-sales-ledger                      POST   P   Y   None   Y   Y   —
storage/[...path]                                   GET    P   Y   None   Y   Y   path.basename으로 traversal 방지
health                                              GET    N   Y   None   N   Y   —
ready                                               GET    N   Y   None   N   Y   —
```

### 요약 카운트

| 분류 | 건수 |
|------|-----|
| try/catch 없는 핸들러 | **8개** |
| Promise.all 결과 무시 | **3개** |
| 사일런트 부분 실패 | **3개** |
| N+1 DB 패턴 | **4개** |
| 스텁/미구현 | **1개** |

### 치명적 발견 상세

#### CF-1: Stuck-Consignment 버그

**파일**: `app/api/admin/consignments/[id]/route.ts:237-343`

```
Step 1: 상품번호 중복 체크 (222-233) → OK
Step 2: extractColorVision() 외부 API (236)
Step 3: st_products INSERT (237-265) → 성공, product.id 할당
Step 4: orders + order_items INSERT (282-322) → 에러 로깅 후 "무시"
Step 5: consignment_requests UPDATE status='completed' (325-343) → 실패 가능
```

**문제**: Step 5 실패 시:
- `st_products` 레코드 존재 (product_number 점유)
- `consignment_requests.status`는 여전히 `received`
- 재시도 시 Step 1에서 409 `"상품번호가 이미 존재합니다"` → **영구 복구 불가**

**V3 해결**: Step 5 실패 시 Step 3의 `st_products` 삭제 보상 로직 필요. 최적으로는 전체를 RPC 트랜잭션으로 래핑.

#### CF-2: generate-payout 파일 소실 버그

**파일**: `app/api/settlement/generate-payout/route.ts:199-224`

```typescript
// 1. xlsx 바이트 생성, Response 객체 생성
const response = new Response(new Uint8Array(buf), { headers: {...} })

// 2. DB 업데이트 (Response 생성 후)
const { error: updateErr } = await supabase
  .from('settlement_queue')
  .update({ queue_status: 'confirmed' })
  .in('id', queueIds)

if (updateErr) {
  return NextResponse.json({ error: ... }, { status: 500 })
  // → xlsx 파일은 반환되지 않고 소실
}

return response // DB 업데이트 성공 시에만 파일 반환
```

**V3 해결**: DB 업데이트를 먼저 수행하고, 성공 시 xlsx 생성/반환. 또는 트랜잭션으로 래핑.

#### CF-3: Promise.all 결과 무시

**파일**: `app/api/settlement/manual-match/route.ts:62-69`

```typescript
await Promise.all([
  supabase.from('sales_records').update({ match_status: 'manual_matched' })...,
  supabase.from('naver_settlements').update({ match_status: 'manual_matched' })...,
])
// 결과 미검사 → 한쪽만 업데이트되어도 감지 불가
```

**V3 해결**: 결과 검사 + 보상 트랜잭션 (한쪽 실패 시 매칭 레코드 삭제).

#### CF-4: settlement/generate 사일런트 스킵

**파일**: `app/api/settlement/generate/route.ts:114-146`

```typescript
if (settlementError) continue  // 사일런트 스킵 → sold_items는 'pending' 유지 → 다음 실행 시 재포함
```

**V3 해결**: 스킵하지 않고 에러 수집 → 최종 응답에 포함. RPC 트랜잭션으로 원자성 보장.

---

## 4. 중첩/중복 책임 상세 분석

### 4-A: 브랜드 정규화 — 4개 독립 구현

| # | 위치 | 함수 | 범위 |
|---|------|------|------|
| 1 | `lib/catalog/brand-normalizer.ts:18` | `normalizeBrand()` | `lib/brand-search.ts` ALIAS_MAP 래핑 (80+ 브랜드) |
| 2 | `photos/match/services/scoreCalculator.ts:89-119` | `normBrand()` + `BRAND_ALIASES` | 12개 로컬 맵; fuzzy 매칭; #1과 미연결 |
| 3 | `admin/orders/search/route.ts:20-31` | `BRAND_KO` + `expandKorean()` | 20개 한국어→영어 맵; 검색 전용 |
| 4 | `lib/brand-search.ts` | `resolveSearchTerms()` | 80+ 브랜드 (#1이 래핑하는 실제 소스) |

**구체적 불일치**:

| 브랜드 | brand-aliases.ts | brand-search.ts | product-matcher.ts |
|--------|-----------------|-----------------|---------------------|
| Boglioli | `"볼리올리"` | `'보리올리'` | 미등록 |
| Polo/RL | → `ralph lauren` | `'폴로': 'polo'` (별도 정규명) | 미등록 |
| Isaia | `"이자이아"` | `'이사이아'` | 미등록 |

**`볼리올리` vs `보리올리`** 위험: 한 경로로 저장된 상품이 다른 경로로 검색 시 누락됨.

**V3 최적 구현**: `lib/utils/brand.ts` 단일 파일로 통합.
- `ALIAS_MAP` 80+ 브랜드 + `scoreCalculator`의 고유 엔트리 (`gilman vintage`, `sunnei`, `invertere`) 병합
- `normalizeBrand()`, `fuzzyBrandMatch()`, `getKoreanExpansions()` 3개 함수 export
- 나머지 4개 소스 파일의 로컬 맵 삭제

### 4-B: 카테고리 추론 — 3개 독립 구현

| # | 위치 | 함수 | '재킷' 매핑 |
|---|------|------|-----------|
| 1 | `consignments/[id]/route.ts:46-79` | `inferCategory()` | → `'jacket'` |
| 2 | `scoreCalculator.ts:139-170` | `inferCategoryFromModel()` | → `normCategory('jacket')` → `'outer'` |
| 3 | `lib/photo-classifier.ts` | `classifyCategory()` | → `'outer'` |

**구체적 불일치**:
- `재킷`: #1=`jacket`, #2/#3=`outer`
- `블레이저`: #1=`blazer`, #2=`normCategory('blazer')`→`outer`, #3=`outer`
- `패딩/다운`: #1=`coat` (있음), #2=없음
- `bd shirt/dress shirt`: #2=있음, #1=없음
- 기본값: #1=`null`, #3=`shirt`

**"라나울 다운 베스트"** 예시: #1=`coat`(다운), #2=`vest`(베스트) → 동일 상품, 다른 분류.

**V3 최적 구현**: `lib/utils/category.ts` 단일 분류기.
- 3개 구현의 모든 패턴 병합 (중복 제거)
- `CategorySlug` 유니온 타입 (`blazer|coat|jacket|vest|suit|shirt|knitwear|trousers|shoes|sneakers|necktie|bag|scarf`)
- 사진 매칭의 `normCategory()` 코어시닝은 `scoreCalculator` 내부에서 별도 적용 (공유 라이브러리에 넣지 않음)

### 4-C: 전화번호 정규화 — 2개 구현

| # | 위치 | 동작 |
|---|------|------|
| 1 | `lib/settlement/phone-normalizer.ts` | 전체 포맷터: `010-XXXX-XXXX` 반환, 0접두사 복원 |
| 2 | `seller-matcher.ts:98-100` + `consignments/route.ts:36,155` | `digits.replace(/[^0-9]/g, '')` — 숫자만 |

**충돌**: `normalizePhone("010-1234-5678")` = `"010-1234-5678"` (포맷), 인라인 strip = `"01012345678"` (숫자). 동일 DB 컬럼에 두 형식이 혼재.

**V3 최적 구현**: `lib/utils/phone.ts`
- `normalizePhone()`: 저장용 (포맷된 문자열)
- `digitsOnly()`: 비교용 (숫자만)
- 두 함수의 역할을 명시적으로 분리하여 혼용 방지

### 4-D: 커미션 계산 — 5곳 분산 정의

| # | 위치 | 값 | 사용 여부 |
|---|------|---|---------|
| 1 | `lib/settlement/types.ts:20-24` `COMMISSION_RATES` | general=0.25, employee/vip=0.20 | **미사용 (orphaned)** |
| 2 | `admin/orders/types.ts:104-108` `DEFAULT_COMMISSION_RATES` | 동일 | **미사용 (orphaned)** |
| 3 | `settlement-calculator.ts:63` | DB에서 읽음 | 사용 (구 파이프라인) |
| 4 | `queue-settlements/route.ts:133` 폴백 | `?? 0.25` 하드코딩 | 사용 (신 파이프라인) |
| 5 | `consignments/route.ts:244` 신규 판매자 | `0.20` 하드코딩 | 사용 |

**핵심 충돌**: 엑셀 업로드로 생성된 판매자는 일괄 `0.20`(20%). `COMMISSION_RATES.general`은 `0.25`(25%). 상수 파일의 값과 실제 동작이 불일치. `queue-settlements` 폴백 `0.25`가 실제 `0.20` 판매자를 5% 과징수 가능.

**V3 최적 구현**: `lib/types/domain/seller.ts` 단일 소스.
```typescript
export const COMMISSION_RATES = {
  general: 0.25,
  employee: 0.20,
  vip: 0.20,
} as const satisfies Record<SellerTier, number>
```
- 신규 판매자 생성 시 `COMMISSION_RATES[tier]` 참조
- 폴백 `0.25` 제거 → 판매자 미매칭 시 큐 등록 건너뜀 + 경고 로그

### 4-E: 주문번호 생성 — 2개 동일 복사본

| # | 위치 |
|---|------|
| 1 | `admin/orders/route.ts:95-97` |
| 2 | `consignments/[id]/route.ts:272-274` |

동일 알고리즘: `YYYYMMDD-` + `Math.random() * 1000000`. 충돌 방지 없음.

**V3 최적 구현**: `lib/utils/id.ts`
```typescript
export function generateOrderNumber(date = new Date()): string {
  const d = date.toISOString().split('T')[0].replace(/-/g, '')
  const rand = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
  return `${d}-${rand}`
}
```
+ DB `UNIQUE` 제약 조건 + 충돌 시 재시도 로직.

### 4-F: 두 개의 완전 독립 정산 파이프라인

| 차원 | 구 파이프라인 (A) | 신 파이프라인 (B) |
|------|------------------|------------------|
| 엔트리 | `upload-sales` + `upload-confirm` | `upload-sales-ledger` + `upload-naver-settle` |
| 매칭 | `generate` (판매자명 매칭) | `auto-match` + `manual-match` |
| 큐 | `settlements` + `settlement_items` | `settlement_queue` |
| 계산 | `settlement-calculator.ts` | `queue-settlements/route.ts` 인라인 |
| 내보내기 | `export/settlement-list/[id]` | `generate-payout` |
| 커미션 | `seller.commission_rate` (라이브러리) | `seller.commission_rate ?? 0.25` (인라인) |

**두 파이프라인이 공유하는 코드: 0개, 공유하는 DB 테이블: sellers만.**

---

## 5. V3 최적 5레이어 아키텍처 블루프린트

### 아키텍처 결정

**엄격한 5레이어 + 단방향 의존성 규칙**. 각 레이어는 하위 레이어만 import. 순환 참조 금지. 레이어 건너뛰기 금지.

```
LAYER 5: app/                    (페이지, 라우트 핸들러)
          |
LAYER 4: app/components/ & hooks/ (UI 컴포넌트, 클라이언트 훅)
          |
LAYER 3: lib/services/           (비즈니스 로직 — 순수 함수 + 오케스트레이션)
          |
LAYER 2: lib/db/                 (데이터 접근 — Supabase 리포지토리)
          |
LAYER 1: lib/types/ + lib/utils/ (공유 타입, 순수 유틸리티)
          |
LAYER 0: lib/env.ts + lib/supabase/ (인프라스트럭처)
```

### Layer 1: 공유 타입 (`lib/types/`)

**규칙: 런타임 코드 0. 타입과 상수만. 모든 도메인이 여기서 import.**

```
lib/types/
  index.ts                 ← barrel re-export (30줄)
  domain/
    seller.ts              ← SellerTier, Seller, COMMISSION_RATES (50줄)
    consignment.ts         ← ConsignmentStatus (7값), ConsignmentApplication (60줄)
    order.ts               ← OrderStatus, OrderItem, Order, Condition (80줄)
    settlement.ts          ← SettlementStatus, Settlement, SoldItem (90줄)
    product.ts             ← ProductType, StProduct, PhotoStatus (50줄)
    notification.ts        ← SmsResult, NotificationLog (30줄)
    photo.ts               ← ClassifiedGroup, ClassifiedFile (60줄)
  api/
    requests.ts            ← Zod 스키마 전체 API 입력 (100줄)
    responses.ts           ← ApiSuccess<T>, ApiError, 타입 응답 형태 (60줄)
  db/
    database.types.ts      ← `supabase gen types` 자동생성
```

### Layer 2: 데이터 접근 (`lib/db/`)

**규칙: Supabase 호출만. `{ data, error }` 반환. 비즈니스 로직 없음. HTTP 없음.**

```
lib/db/
  client.ts                ← createAdminClient() 팩토리 (20줄)
  index.ts                 ← barrel re-export (20줄)
  repositories/
    sellers.repo.ts        ← sellers CRUD (80줄)
    orders.repo.ts         ← orders + order_items CRUD (90줄)
    consignments.repo.ts   ← consignment_requests CRUD (80줄)
    settlement.repo.ts     ← settlements + sold_items CRUD (90줄)
    products.repo.ts       ← st_products CRUD (70줄)
    notifications.repo.ts  ← notification_logs CRUD (50줄)
  mappers/
    order.mapper.ts        ← DB row → Order 도메인 타입 (60줄)
    consignment.mapper.ts  ← DB row → ConsignmentApplication (50줄)
    settlement.mapper.ts   ← DB row → Settlement (40줄)
  transactions/
    settlement.tx.ts       ← RPC: 정산 생성 + 아이템 연결 (70줄)
    order.tx.ts            ← RPC: 주문 생성 + 아이템 (50줄)
```

### Layer 3: 비즈니스 로직 (`lib/services/`)

**규칙: 순수 오케스트레이션. `lib/db/` + `lib/utils/`에서 import. 도메인 객체 반환. `NextRequest`/`NextResponse` 금지.**

```
lib/services/
  settlement.service.ts    ← generate, confirm, pay 오케스트레이션 (90줄)
  order.service.ts         ← create, inspect, hold 오케스트레이션 (80줄)
  consignment.service.ts   ← review, inspect 워크플로 (80줄)
  notification.service.ts  ← SMS 발송 + DB 로깅 (60줄)
  photo.service.ts         ← upload, classify, link 파이프라인 (90줄)
  matching.service.ts      ← auto-match 오케스트레이션 (70줄)
  price.service.ts         ← 가격 추정 순수 함수 (50줄)
```

### Layer 4: 공유 유틸리티 (`lib/utils/`)

**규칙: `lib/db/`나 `lib/services/`에서 import 금지. 순수 함수만.**

```
lib/utils/
  phone.ts         ← normalizePhone(), digitsOnly() (40줄)
  brand.ts         ← normalizeBrand(), fuzzyBrandMatch() (50줄)
  currency.ts      ← formatKRW(), parseKRW() (30줄)
  date.ts          ← toKSTDate(), getSettlementPeriod() (60줄)
  id.ts            ← generateOrderNumber(), generateProductNumber() (30줄)
  category.ts      ← inferCategory(), CategorySlug 타입 (60줄)
  sms-templates.ts ← buildSmsMessage() 디스패치 테이블 (80줄)
```

### Layer 5: API 라우트 레이어 (`app/api/`)

**규칙: 핸들러 100줄 이내. Zod으로 입력 검증. 서비스에 위임. 표준 래퍼로 응답.**

표준 핸들러 패턴:

```typescript
/**
 * POST /api/settlement/generate — 정산 생성 핸들러
 * WHY: V2는 163줄에 DB/비즈니스/HTTP 혼재
 * HOW: 검증 → 서비스 위임 → 응답
 * WHERE: 정산 워크플로 Step 4 큐 버튼에서 호출
 */
import { NextRequest } from 'next/server'
import { GenerateSettlementSchema } from '@/lib/types/api/requests'
import { generateSettlements } from '@/lib/services/settlement.service'
import { ok, err, validationErr } from '@/lib/api/response'
import { requireAdmin } from '@/lib/api/middleware'

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req)
  if (authError) return authError

  const body = await req.json().catch(() => ({}))
  const parsed = GenerateSettlementSchema.safeParse(body)
  if (!parsed.success) return validationErr(parsed.error.message)

  console.log('[settlement/generate] 시작')
  try {
    const result = await generateSettlements({
      referenceDate: parsed.data.referenceDate
        ? new Date(parsed.data.referenceDate)
        : undefined,
      holidays: parsed.data.holidays,
    })
    console.log(`[settlement/generate] 완료: ${result.created}건`)
    return ok(result)
  } catch (err_) {
    const msg = err_ instanceof Error ? err_.message : '알 수 없는 오류'
    console.error('[settlement/generate] 실패:', msg)
    return err(msg)
  }
}
// 총 40줄
```

### 프론트엔드: Server vs Client 결정 매트릭스

| 컴포넌트 | 타입 | 근거 |
|---------|------|------|
| `AdminLayout` | Server | 정적 사이드바 셸, 상태 없음 |
| `Sidebar` | Server | 정적 내비게이션 |
| `StatCard` | Server | 순수 표시 |
| `StatusBadge` | Server | 순수 표시 |
| `TableShell` | Server | 순수 렌더링 |
| `OrdersTable` | Client | 행 클릭 핸들러 |
| `OrderFilters` | Client | 제어 입력 |
| `*Modal` | Client | 다이얼로그 상태, 폼 인터랙션 |
| `*Step` | Client | 워크플로 상태 |
| `SalesChart` | Client | recharts DOM 의존 |
| `PhotoDropzone` | Client | File API |
| `ClassifyMatchModal` | Client | SSE 스트림 |

### 의존성 그래프 (엄격, 비순환)

```
lib/types/          ← 프로젝트 코드에서 import 없음
lib/utils/          ← lib/types/ 만 import
lib/calculators/    ← lib/types/, lib/utils/
lib/integrations/   ← lib/types/, lib/utils/
lib/db/             ← lib/types/, lib/utils/
lib/services/       ← lib/db/, lib/calculators/, lib/integrations/, lib/types/, lib/utils/
lib/api/            ← lib/types/, lib/auth.ts
app/components/     ← lib/types/, lib/utils/
app/api/**/route.ts ← lib/services/, lib/api/, lib/types/api/
app/admin/**/       ← app/components/, lib/types/, lib/utils/
```

---

## 6. 구현 후 리스크 분석

### RISK-01: ConsignmentStatus 3값 vs 7값 타입 불일치 [HIGH]

**현상**: `route.ts:14`는 `'pending' | 'approved' | 'rejected'` (3값). DB CHECK은 7값. 별도 `[id]/route.ts:81`은 7값 정의.

**구현 후 위험**: V3 Zod 스키마를 잘못된 소스(3값)에서 빌드하면 `?status=received` GET 요청이 400 반환. `inspecting` 상태 레코드가 필터 뷰에서 사라짐.

**대응**: V3 타입은 DB CHECK 제약의 7값과 정확히 일치시키기. 마이그레이션 시 `inspecting` 상태 레코드 존재 여부 확인.

### RISK-02: 두 정산 파이프라인 통합 [HIGH]

**구현 후 위험**:
- `sold_items.naver_order_id`(11자리 짧은 형식) vs `sales_records.naver_order_no`(짧은 형식이지만 `naver_settlements.product_order_no`는 16자리 긴 형식)과 매칭 → 단순 병합 시 매칭 불가 고아 행 발생
- Pipeline A에 `settlements.status='pending'` 레코드가 존재하는 상태에서 V3가 `/api/settlement/confirm`, `/api/settlement/pay` 엔드포인트를 제거하면 해당 판매자 정산이 영구 미완료
- 커미션 레이트가 판매 시점과 정산 생성 시점 사이에 변경되면 어느 시점의 레이트가 적용되는지 감사 기록 없음

**대응**:
1. V3 배포 전 Pipeline A의 pending 정산 모두 완료 처리
2. 양 파이프라인 데이터를 호환 형식으로 마이그레이션 스크립트 작성
3. 커미션 레이트를 판매 시점에 스냅샷으로 기록

### RISK-03: 인증 활성화 시 기존 워크플로 중단 [HIGH]

**현상**: 현재 모든 `/api/admin/*`와 `/api/settlement/*`가 인증 없이 접근 가능.

**구현 후 위험**:
- 자동화된 네이버 폼 업로드 웹훅 (cron/외부 트리거) → 세션 쿠키 없으므로 중단
- API를 직접 호출하는 스크립트/도구 → 중단
- 프로그래매틱 정산 파이프라인 호출 → 중단

**대응**: 내부 서비스 호출용 API 키 또는 서비스 토큰 메커니즘 준비. 또는 인증 대상에서 내부 호출 경로 제외.

### RISK-04: 주문 생성 트랜잭션 전환 [HIGH]

**현상**: `orders INSERT` → `order_items INSERT` → 실패 시 수동 `DELETE orders` (비원자적).

**구현 후 위험**: V3에서 RPC 트랜잭션으로 전환 시 에러 메시지가 커스텀 메시지 `"orders 생성 실패"`에서 raw Postgres 에러로 변경되어 UI 혼란 가능. 또한 고아 `orders` 행 (items 없는)이 이미 DB에 존재할 수 있음.

**대응**: RPC 내에서 `RAISE EXCEPTION '주문 생성 실패: ...'` 형식으로 에러 메시지 제어. 기존 고아 행 정리 마이그레이션 선행.

### RISK-05: 타임존 변경 시 정산 경계 이동 [MEDIUM]

**현상**: 현재 UTC 자정 기준 정산 기간 계산 = KST 오전 9시 컷오프.

**구현 후 위험**: V3에서 KST 자정으로 변경하면 경계가 9시간 이동. 수요일 기준 정산에서 이전/이후 매출이 다른 기간에 포함. 이미 지급된 정산은 재계산 불가.

**대응**: 전환일 기준 기존 데이터 검증. 과도기 수동 확인. CI/CD 테스트 환경에 고정 타임존 설정.

### RISK-06: Supabase 1000행 기본 제한 [MEDIUM]

**현상**: `detectConsignmentSales`가 미판매 위탁 상품 전체를 로드하지만 Supabase는 기본 1000행 제한.

**구현 후 위험**: 재고 1000건 초과 시 일부 상품의 판매 감지가 영구적으로 누락. 페이지네이션 없음.

**대응**: V3에서 모든 전체 테이블 쿼리에 `.range()` 페이지네이션 적용. 또는 Supabase 설정에서 `maxRows` 조정.

### RISK-07: 파일시스템 스토리지 → 클라우드 전환 [HIGH]

**현상**: `storage/before/`, `storage/photoroom/` 로컬 파일시스템 사용. Vercel에서는 배포 시 소멸 (이미 프로덕션 버그).

**구현 후 위험**:
- 기존 `st_products.photos` JSONB의 URL이 `/api/admin/photos/storage-serve?folder=photoroom&name=...` 형식 → 클라우드 전환 후 404
- `st_products.smartstore_data`에도 구 URL 참조 가능
- 사진 처리 파이프라인 (`sharp`, `photo-editor.ts`, `measurement-card.ts`)이 `fs.readFileSync`/`fs.writeFileSync` 의존

**대응**:
1. Supabase Storage로 전환
2. 기존 사진 URL 일괄 마이그레이션 스크립트
3. `editPhoto`, `removeBackground`를 Buffer 기반으로 리팩터
4. `process.cwd()/storage/` 참조 전수 검사 및 제거

### RISK-08: `sharp` 네이티브 바이너리 호환 [HIGH]

**현상**: `sharp`는 플랫폼별 네이티브 바이너리 필요. Vercel은 사전 빌드 레이어 제공하나 버전 일치 필요.

**구현 후 위험**: `sharp` 버전 불일치 시 서버리스 함수 로드 실패. `@imgly/background-removal-node` WASM + `sharp` + `xlsx` + `@anthropic-ai/sdk` 합산 시 Vercel 50MB 압축 함수 제한 초과 가능.

**대응**: `sharp` 버전을 Vercel 레이어와 일치시키기. `puppeteer`를 `devDependencies`로 이동 (또는 제거). 번들 크기 모니터링.

### RISK-09: 커미션 레이트 통합 시 기존 판매자 영향 [HIGH]

**현상**: 엑셀 업로드로 생성된 판매자는 `0.20`. V3에서 `general` 기본값을 `0.25`로 통일하면 기존 판매자 레이트가 변경됨.

**구현 후 위험**: 이미 `0.20`으로 정산된 건과 앞으로 `0.25`로 정산될 건 사이 불일치. 소급 재계산 시 금액 차이 발생.

**대응**: 기존 판매자의 `commission_rate`는 DB 값 유지. 신규 생성 시에만 `COMMISSION_RATES[tier]` 적용. 마이그레이션에서 기존 `0.20` 판매자의 `seller_tier`를 실제 등급으로 업데이트.

### RISK-10: 진행 중인 위탁 조정(adjustment) 토큰 링크 [MEDIUM]

**현상**: `on_hold` 상태 위탁에 `adjustment_token` SMS 링크가 발송된 상태. 판매자가 `/consignment/adjust/[token]/`에서 응답 대기 중.

**구현 후 위험**: V3에서 URL 구조나 토큰 검증 로직 변경 시 진행 중인 토큰 링크가 깨짐.

**대응**: V3 배포 시 기존 토큰 형식과 URL 구조 유지. 변경이 필요하면 기존 토큰에 대한 리다이렉트 미들웨어 추가.

### RISK-11: 사진 URL JSONB 재작성 [HIGH]

**현상**: `st_products.photos`는 `{url, order}[]` JSONB. URL이 로컬 파일시스템 서빙 경로.

**구현 후 위험**: 클라우드 마이그레이션 후 구 URL과 신 URL이 혼재. 일괄 업데이트 스크립트 없으면 기존 상품 사진 전부 404.

**대응**: 마이그레이션 스크립트로 `st_products.photos` JSONB 내 URL 일괄 치환. 과도기에는 `storage-serve` 엔드포인트를 클라우드 리다이렉트 프록시로 유지.

### RISK-12: Dedup UNIQUE 인덱스 생성 실패 [MEDIUM]

**현상**: `20260221_settlement_dedup.sql`의 UNIQUE 인덱스:
```sql
CREATE UNIQUE INDEX idx_sales_records_dedup
  ON sales_records (sale_date, naver_order_no, buyer_name, product_name)
  WHERE naver_order_no IS NOT NULL;
```

**구현 후 위험**: 마이그레이션 적용 전에 이미 중복 행이 존재하면 인덱스 생성 실패 → 배포 차단.

**대응**: 마이그레이션 전 중복 행 조회 + 정리 스크립트 선행.

---

## 7. 통합 구현 권장사항

### 7-1: V2에서 유지할 패턴 (이미 잘 작동하는 것)

| 패턴 | 위치 | V3 활용 방안 |
|------|------|-------------|
| WHY/HOW/WHERE 헤더 주석 | `lib/settlement/types.ts:1-7` | 전체 파일에 적용 |
| `{ success, data/error }` 응답 래퍼 | `lib/api/response.ts` | 전면 채택 |
| AbortController + 타입 fetch | `lib/api/client.ts` | 제네릭 `api.get<T>()` 형태로 확장 |
| 순수 함수 정산 계산기 | `settlement-calculator.ts` | `lib/calculators/`로 이동, 패턴 복제 |
| 훅 기반 워크플로 오케스트레이션 | `useInspectionWorkflow` | 유지, 25개 props를 3개 도메인 훅으로 분리 |
| `requireEnv()` 패턴 | `lib/env.ts` | 유지 |
| `TableShell<T>` 제네릭 | 기존 컴포넌트 | Server Component로 전환 |

### 7-2: V3에서 제거할 파일 (중복/통합 대상)

| 삭제 파일 | 통합 목적지 |
|----------|-----------|
| `lib/settlement/types.ts` | `lib/types/domain/` |
| `lib/settlement/phone-normalizer.ts` | `lib/utils/phone.ts` |
| `lib/catalog/brand-normalizer.ts` | `lib/utils/brand.ts` |
| `lib/brand-search.ts` | `lib/utils/brand.ts` |
| `lib/brand-aliases.ts` | `lib/utils/brand.ts` |
| `lib/settlement/helpers.ts` | `lib/utils/date.ts` |
| `lib/notification/templates.ts` | `lib/utils/sms-templates.ts` |
| `app/admin/consignments/types.ts` | `lib/types/domain/` |
| `app/admin/orders/types.ts` | `lib/types/domain/` (MEASUREMENT_FIELDS → `lib/utils/category.ts`) |
| `app/admin/sales/types.ts` | `lib/types/domain/` |
| `app/admin/settlement/workflow/types.ts` | `lib/types/domain/` |
| `app/admin/notifications/types.ts` | `lib/types/domain/` |
| `app/admin/database/types.ts` | `lib/types/domain/` |

### 7-3: Inline Style → Tailwind 전환 전략

**현황**: inline `style={{}}` **1,061회** (78파일) vs Tailwind `className=` **154회** (24파일)

**전략**:
1. `tailwind.config.ts`에 브랜드 컬러/spacing 커스텀 토큰 등록
2. `ORDER_STATUS_COLORS` 16진수 객체 → Tailwind 클래스 맵으로 교체
3. `onMouseEnter`/`onMouseLeave` JS hover → CSS `hover:` 유틸리티로 교체
4. `AdminLayout`부터 시작 (30+ inline style) → 페이지별 순차 전환

### 7-4: 에러 처리 표준 패턴

모든 라우트 핸들러:
```typescript
try {
  return ok(result)
} catch (err) {
  const msg = err instanceof Error ? err.message : '알 수 없는 오류'
  console.error('[api-name] 실패:', msg)
  return err(msg)
}
```

모든 서비스 함수:
```typescript
// 서비스는 { data, error } 반환 — throw하지 않음
// 라우트 핸들러가 포맷
```

### 7-5: Supabase RPC (원자적 트랜잭션)

```sql
-- supabase/migrations/YYYYMMDD_create_settlement_rpc.sql
CREATE OR REPLACE FUNCTION create_settlement_with_items(
  p_seller_id uuid, p_period_start date, p_period_end date,
  p_total_sales numeric, p_commission_rate numeric,
  p_commission_amount numeric, p_settlement_amount numeric,
  p_sold_item_ids uuid[]
) RETURNS uuid AS $$
DECLARE v_settlement_id uuid;
BEGIN
  INSERT INTO settlements (...) VALUES (...) RETURNING id INTO v_settlement_id;
  INSERT INTO settlement_items (settlement_id, sold_item_id)
    SELECT v_settlement_id, unnest(p_sold_item_ids);
  UPDATE sold_items SET settlement_status = 'settled'
    WHERE id = ANY(p_sold_item_ids);
  RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql;
```

### 7-6: tsconfig.json 강화

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true
  }
}
```

---

## 8. 7단계 빌드 시퀀스

### Phase 1: 기반 (Foundation)

- `lib/types/` 전체 도메인 타입 생성
- `supabase gen types typescript` → `lib/types/db/database.types.ts`
- `lib/utils/` — phone, currency, date, id, brand, category
- `lib/api/response.ts` 확장, `lib/api/middleware.ts` 신규
- `lib/types/api/requests.ts` Zod 스키마

### Phase 2: 데이터 접근 (Data Access)

- `lib/db/client.ts`
- 6개 리포지토리 (`lib/db/repositories/`)
- 3개 매퍼 (`lib/db/mappers/`)
- `lib/db/transactions/settlement.tx.ts` — Supabase RPC
- `lib/db/transactions/order.tx.ts`

### Phase 3: 서비스 + 계산기 (Services)

- 순수 계산기 → `lib/calculators/`
- 7개 서비스 파일 (`lib/services/`)
- settlement.service.ts가 V2와 동일 결과 생성 검증

### Phase 4: API 라우트 (Routes)

- `settlement/generate/route.ts` 리팩터 (163줄 → 40줄)
- `admin/orders/route.ts` 리팩터 (220줄 → 80줄)
- 모든 `/api/admin/*` 라우트에 `requireAdmin()` 추가
- 모든 핸들러에 Zod 검증 추가
- 기존 API 계약 보존 검증

### Phase 5: 공유 UI (Shared Components)

- `app/components/ui/` 라이브러리 (Modal, StatusBadge, StatCard, TableShell, FilterBar)
- `AdminLayout`, `Sidebar` → Server Component 전환
- inline style → Tailwind v4 일괄 교체 (`grep "style={{"` = 0 목표)
- `ORDER_STATUS_COLORS` 16진수 → Tailwind 클래스 맵

### Phase 6: 기능 페이지 (Feature Pages)

- 정산 워크플로 → 새 서비스 연결
- 위탁 페이지 → 새 서비스 연결
- 주문 페이지 → 새 서비스 연결
- `dynamic()` import: ClassifyMatchModal, StorageLightbox
- 모든 훅에 AbortController 패턴 표준화

### Phase 7: 검증 (Verification)

- Zero `any`: `tsc --strict --noEmit`
- Zero inline: `grep -r "style={{" app/` = 0
- Zero 타입 중복: `grep -r "SellerTier" lib/ app/` — `@/lib/types`에서만 import
- 전체 라우트 인증: `grep -r "requireAdmin" app/api/admin/` = 라우트 수와 일치
- 100줄 제한: `wc -l app/api/**/*.ts`

---

## 9. 전체 요약 및 우선순위

### 발견 사항 총계

| 심각도 | 건수 | 대표 문제 |
|--------|-----|---------|
| CRITICAL | 1건 | 미들웨어 미작동 → 전체 인증 무효 |
| HIGH | 16건 | 이중 정산, stuck-consignment, 파일시스템 사진 소실, 커미션 불일치, Pipeline A 미완료 정산 고립 |
| MEDIUM | 14건 | 타임존 9시간 이동, 1000행 제한, 브랜드 스펠링 불일치, 카테고리 추론 불일치 |
| LOW | 3건 | 전화번호 하드코딩, 세션 시크릿 로테이션 |

### V3 구현 우선순위

1. **인증 복원** (CRITICAL): `proxy.ts` → `middleware.ts` 리네이밍 + `requireAdmin()` 인라인 가드
2. **금전적 정확성** (HIGH): 정산 RPC 트랜잭션 + 커미션 단일 소스 + 타임존 KST 통일
3. **데이터 안전성** (HIGH): stuck-consignment 보상 로직 + Promise.all 결과 검사 + 고아 행 정리
4. **스토리지 마이그레이션** (HIGH): 로컬 파일시스템 → Supabase Storage + 기존 URL 마이그레이션
5. **아키텍처 기반** (Phase 1-2): 타입 통합 + 리포지토리 패턴 + 유틸 통합
6. **코드 품질** (Phase 3-5): 서비스 레이어 + 100줄 제한 + Tailwind 전환
7. **프론트엔드 현대화** (Phase 6-7): Server Component + AbortController + dynamic import

### 핵심 데이터 플로우 (V3)

```
POST /api/settlement/generate
  → middleware.ts: requireAdmin()
  → requests.ts: Zod.safeParse()
  → settlement.service.ts: generateSettlements()
      → sellers.repo.ts: getActiveSellers()          [DB]
      → settlement.repo.ts: getPendingSoldItems()    [DB]
      → settlement.calc.ts: calculateSettlement()    [순수]
      → settlement.tx.ts: createSettlementWithItems() [DB, 원자적 RPC]
  → response.ts: ok(result)
```

---

### 구현 후 리스크 요약 테이블

| 리스크 | 구체적 이슈 | 등급 |
|--------|-----------|------|
| ConsignmentStatus 3값 vs 7값 | Zod 스키마 소스 오류 시 `received`/`inspecting` 레코드 누락 | HIGH |
| 두 정산 파이프라인 통합 | Pipeline A pending 정산 고립; naver_order_id 형식 불일치 | HIGH |
| 인증 활성화 | 비브라우저 API 호출 일괄 중단 | HIGH |
| 주문 트랜잭션 전환 | 에러 메시지 변경; 고아 orders 행 존재 | HIGH |
| 파일시스템 → 클라우드 | 기존 사진 URL 404; JSONB 일괄 재작성 필요 | HIGH |
| sharp 네이티브 바이너리 | 버전 불일치 시 서버리스 함수 로드 실패 | HIGH |
| 커미션 레이트 통합 | 기존 0.20 판매자 vs 신규 0.25 기본값 충돌 | HIGH |
| 타임존 변경 | 정산 경계 9시간 이동; 이미 지급된 건 재계산 불가 | MEDIUM |
| Supabase 1000행 제한 | 감지 로직 사일런트 절단 | MEDIUM |
| 브랜드 스펠링 (볼리올리/보리올리) | 통합 시 한쪽 스펠링 선택 → 기존 DB 레코드 불일치 | MEDIUM |
| 카테고리 추론 통합 | `재킷` → jacket vs outer 통합 시 사진 매칭 점수 변동 | MEDIUM |
| Dedup UNIQUE 인덱스 | 기존 중복 행 있으면 마이그레이션 실패 | MEDIUM |
| adjustment 토큰 링크 | URL 변경 시 진행 중 링크 깨짐 | MEDIUM |
| 사진 URL JSONB 재작성 | 구/신 URL 혼재; 스크립트 없으면 기존 사진 전부 404 | HIGH |

---

*이 보고서는 코드를 수정하지 않고 조사만 수행한 결과입니다.*
*V3 구현 시 각 리스크의 대응 방안을 반드시 선행 처리해야 합니다.*
*교리 v2.0 기준: 모든 파일에 WHY/HOW/WHERE 헤더, 100줄 제한, `{ success: false, error }` 응답, `[api-name]` 로깅, `any` 금지.*
