# Classic Menswear V3 — 4차 실패 가능성 심층 리서치 보고서

**작성일**: 2026-03-01
**기준**: 클로드코드교리 v2.0
**목적**: V2 기존 코드의 런타임 크래시, 동시성 실패, 외부 서비스 장애, 데이터 경계값 취약점 총 조사
**원칙**: 코드 수정 없이 조사/보고만 수행
**방법론**: 4개 전문 에이전트 병렬 투입 (Opus 4.6 × 4)

---

## 목차

1. [런타임 크래시 및 예외 경로 분석](#1-런타임-크래시-및-예외-경로-분석)
2. [동시성 및 레이스 컨디션 분석](#2-동시성-및-레이스-컨디션-분석)
3. [외부 서비스 장애 경로 분석](#3-외부-서비스-장애-경로-분석)
4. [데이터 경계값 및 엣지케이스 분석](#4-데이터-경계값-및-엣지케이스-분석)
5. [전체 실패 시나리오 통합 테이블](#5-전체-실패-시나리오-통합-테이블)
6. [V3 설계 시 필수 방어 체크리스트](#6-v3-설계-시-필수-방어-체크리스트)

---

## 1. 런타임 크래시 및 예외 경로 분석

### 1.1 보호되지 않은 `req.json()` 호출 (12건, 4건 PUBLIC)

모든 `await req.json()` 호출에서 malformed JSON 수신 시 `SyntaxError`로 즉시 크래시. 특히 PUBLIC 엔드포인트는 외부에서 의도적으로 트리거 가능.

| # | 파일 | 라인 | Public | 심각도 |
|---|------|------|--------|--------|
| 1 | `consignment/adjust/[token]/route.ts` | 65 | **YES** | CRASH |
| 2 | `consignment/adjust/[token]/return/route.ts` | 18 | **YES** | CRASH |
| 3 | `admin/auth/login/route.ts` | 27 | **YES** | CRASH |
| 4 | `orders/[productId]/hold/route.ts` | 48 | **YES** | CRASH |
| 5 | `admin/notifications/resend/route.ts` | 9 | No | CRASH |
| 6 | `admin/notifications/bulk-send/route.ts` | 9 | No | CRASH |
| 7 | `admin/notifications/send-sms/route.ts` | 11 | No | CRASH |
| 8 | `admin/sales/route.ts` | 61 | No | CRASH |
| 9 | `admin/orders/route.ts` | 79, 160 | No | CRASH |
| 10 | `admin/photos/edit/route.ts` | 40 | No | CRASH |
| 11 | `admin/consignments/return-shipment/route.ts` | 13 | No | CRASH |
| 12 | `admin/consignments/[id]/route.ts` | 99 | No | CRASH |

**유일한 안전 사례**: `settlement/generate/route.ts:47` — `await request.json().catch(() => ({}))`로 보호.

### 1.2 Non-null Assertion 크래시 (3건)

| # | 파일 | 라인 | 코드 | 트리거 조건 |
|---|------|------|------|------------|
| 1 | `consignments/create-single/route.ts` | 74 | `newSeller!.id` | Supabase insert가 `{data: null, error: null}` 반환 시 |
| 2 | `consignments/create-single/route.ts` | 101 | `consignment!.id` | 동일 |
| 3 | `consignments/route.ts` | 253 | `newSeller!.id as string` | 동일 |

### 1.3 배열 인덱스 미검증 (1건)

| 파일 | 라인 | 코드 | 트리거 |
|------|------|------|--------|
| `lib/photo-classify/claude-api.ts` | 21 | `msg.content[0].type` | Claude API가 빈 content 배열 반환 시 |

### 1.4 파일 시스템 크래시 (4건)

| # | 파일 | 라인 | 문제 | 심각도 |
|---|------|------|------|--------|
| 1 | `storage/[...path]/route.ts` | 73 | TOCTOU: `existsSync` → `readFileSync` 사이 파일 삭제 | CRASH |
| 2 | `lib/heic-to-jpeg.ts` | 43 | `/usr/bin/sips` macOS 전용, Linux에서 ENOENT | CRASH |
| 3 | `lib/heic-to-jpeg.ts` | 53 | `unlinkSync` temp 파일 미생성 시 ENOENT | CRASH |
| 4 | `lib/photoroom.ts` | 44 | `readFileSync` 파일 삭제 시 ENOENT | CRASH (상위에서 catch) |

### 1.5 외부 서비스 미보호 호출 (2건)

| # | 파일 | 라인 | 문제 |
|---|------|------|------|
| 1 | `consignment/adjust/[token]/return/route.ts` | 73 | `courier.requestPickup()` — try/catch 없음 (PUBLIC) |
| 2 | `admin/consignments/return-shipment/route.ts` | 78 | `courier.requestPickup()` — try/catch 없음 |

### 1.6 NaN 전파 (조용한 실패, 7건)

| # | 파일 | 라인 | 문제 | 결과 |
|---|------|------|------|------|
| 1 | `useAdjustmentChoice.ts` | 37 | `parseInt(counterPrice)` NaN | DB에 NaN 저장 |
| 2 | `PriceAdjustmentSection.tsx` | 53 | `parseInt(customPrice)` NaN | API에 NaN 전송 |
| 3 | `upload-sales-ledger/route.ts` | 29 | `parseInt(yearRaw)` NaN | "NaN-02-19" 날짜 |
| 4 | `consignment/adjust/[token]/route.ts` | 75 | `NaN <= 0` is `false` | NaN이 가격 검증 통과 |
| 5 | `consignments/route.ts` | 261 | 판매자 이름 업데이트 실패 무시 | Stale 데이터 |
| 6 | `auto-match/route.ts` | 118-125 | `Promise.all` 결과 미확인 | match_status 불일치 |
| 7 | `manual-match/route.ts` | 62-69 | `Promise.all` 결과 미확인 | match_status 불일치 |

### 런타임 크래시 요약

- **CRASH 레벨**: 18건 (12 req.json + 3 non-null + 1 배열 + 4 파일시스템 중 중복 제외)
- **SILENT 레벨**: 7건 (NaN 전파, Promise 결과 무시)
- **PUBLIC 엔드포인트 크래시**: 4건 (외부에서 트리거 가능)

---

## 2. 동시성 및 레이스 컨디션 분석

### 2.1 더블클릭/더블서밋 취약점 (8건)

| # | 기능 | 파일 | 영향 | 가능성 | 프론트엔드 가드 |
|---|------|------|------|--------|----------------|
| 1 | **정산 생성** | `settlement/generate/route.ts:66-147` | **FINANCIAL** | MEDIUM | `disabled={loading}` (단일 세션만) |
| 2 | **위탁 완료** | `admin/consignments/[id]/route.ts:197-354` | DATA_CORRUPTION | LOW | 없음 |
| 3 | **SMS 발송** | `admin/notifications/send-sms/route.ts:10-45` | DUPLICATE | HIGH | `disabled={submitting}` (단일 세션만) |
| 4 | **SMS 재발송** | `admin/notifications/resend/route.ts:8-40` | DUPLICATE | MEDIUM | 없음 |
| 5 | **대량 발송** | `admin/notifications/bulk-send/route.ts:8-65` | DUPLICATE | MEDIUM | 없음 |
| 6 | **주문 생성** | `admin/orders/route.ts:77-155` | DUPLICATE | LOW | `disabled={submitting}` |
| 7 | **정산 예정 등록** | `settlement/queue-settlements/route.ts:20-172` | **FINANCIAL** | MEDIUM | `disabled={loading}` (단일 세션만) |
| 8 | **지급 시트 다운로드** | `settlement/generate-payout/route.ts:136-230` | UX | LOW | 없음 |

**핵심 패턴**: 모든 프론트엔드 가드는 `disabled={loading}` 패턴으로 **단일 브라우저 세션**만 보호. 두 관리자 동시 작업, 네트워크 재시도, React 상태 업데이트 전 더블클릭에 무방비.

### 2.2 Read-Then-Write 레이스 컨디션 (8건)

| # | 기능 | 파일 | 핵심 문제 | 영향 |
|---|------|------|----------|------|
| 1 | 정산 확정 | `settlement/confirm/[id]/route.ts:45-73` | SELECT → 상태체크 → UPDATE (원자적이지 않음) | LOW |
| 2 | 정산 지급 | `settlement/pay/[id]/route.ts:45-71` | 동일 패턴 | LOW |
| 3 | **위탁 상태 전환** | `consignments/[id]/route.ts:111-159` | `.eq('id', id)` — 현재 상태 미확인 | **DATA_CORRUPTION** |
| 4 | **판매자 코드 생성** | `consignments/route.ts:152-168` | 인메모리 카운터, 동시 요청 시 중복 | **DATA_CORRUPTION** |
| 5 | **판매자 전화번호 중복** | `consignments/route.ts:233-258` | 인메모리 캐시, DB UNIQUE 없음 | **DATA_CORRUPTION** |
| 6 | 단건 판매자 코드 | `create-single/route.ts:49-53` | SELECT COUNT → INSERT 패턴 | DATA_CORRUPTION |
| 7 | 수동 매칭 중복체크 | `manual-match/route.ts:36-44` | UNIQUE 제약으로 실제 보호됨 | UX |
| 8 | **반품 접수 중복체크** | `return-shipment/route.ts:49-57` | `consignment_id` UNIQUE 없음 | **FINANCIAL** |

**최고 위험**: #3 위탁 상태 전환 — Admin A가 "완료" 처리(st_products, orders 생성) 후 Admin B가 "거절"로 덮어쓰면, 거절된 위탁에 고아 주문 데이터가 남음.

### 2.3 동시 Excel 업로드 (3건)

| # | 기능 | 파일 | 핵심 문제 | 영향 |
|---|------|------|----------|------|
| 1 | **위탁 Excel 업로드** | `consignments/route.ts:146-310` | per-request 인메모리 판매자 캐시, DB UNIQUE 없음 | DATA_CORRUPTION |
| 2 | 매출원장 업로드 | `upload-sales-ledger/route.ts:56-68` | DB UNIQUE 인덱스로 보호됨 (23505 에러 처리) | LOW |
| 3 | **네이버 정산 업로드** | `upload-naver-settle/route.ts:36-39` | 업로드 시작 시 `DELETE .eq('match_status', 'unmatched')` 실행 | **DATA_CORRUPTION** |

**최고 위험**: #3 네이버 정산 업로드 — Admin A 업로드 → Admin B 업로드 시 Admin A 데이터 완전 삭제.

### 2.4 상태 전이 레이스 (3건)

| # | 기능 | 핵심 문제 | 영향 |
|---|------|----------|------|
| 1 | **위탁 상태 덮어쓰기** | 모든 UPDATE에 `.eq('status', expected)` 없음 | DATA_CORRUPTION |
| 2 | **주문 상태 변경** | 상태 전이 검증 전혀 없음 (`PAID` → `APPLIED` 가능) | DATA_CORRUPTION |
| 3 | 정산 큐 상태 | 특정 ID로 업데이트하여 실제로는 안전 | LOW |

### 2.5 파일 시스템 동시성 (4건)

| # | 기능 | 파일 | 핵심 문제 |
|---|------|------|----------|
| 1 | 사진 업로드 동명 파일 | `upload-photos/route.ts:107-110` | 두 `createWriteStream`이 같은 경로에 병렬 쓰기 → 파일 손상 |
| 2 | 사진 처리 삭제 레이스 | `process-storage/route.ts:66-74` | 동일 productId 동시 처리 시 상대방 파일 삭제 |
| 3 | 상품 사진 덮어쓰기 | `photos/upload/route.ts:63-65` | Last-write-wins |
| 4 | 읽기 중 쓰기 | `storage/[...path]/route.ts:73` | 쓰기 중 readFileSync → 부분 파일 |

### 2.6 프론트엔드 Stale Data (3건)

| # | 기능 | 파일 | 핵심 문제 | 영향 |
|---|------|------|----------|------|
| 1 | **관리자 간 실시간 동기화 없음** | `useConsignments.ts`, `useOrders.ts` | 폴링/WebSocket/SSE 없음 | **모든 레이스 컨디션의 근본 원인** |
| 2 | **정산 워크플로우 세션 로컬** | `useWorkflow.ts` | React useState로만 관리, 서버 미동기화 | UX + 데이터 충돌 |
| 3 | 주문 상태 낙관적 동시성 미적용 | `useOrders.ts` | `updated_at` 체크 없이 덮어쓰기 | DATA_CORRUPTION |

### 2.7 정산 파이프라인 레이스 (4건)

| # | 기능 | 핵심 문제 | 영향 |
|---|------|----------|------|
| 1 | **구/신 파이프라인 공존** | `generate`(sold_items) vs `queue-settlements`(sales_records) — 동일 매출 이중 정산 가능 | **FINANCIAL** |
| 2 | 자동매칭 vs 수동매칭 | UNIQUE 제약으로 보호됨, 카운터만 부정확 | UX |
| 3 | upload-confirm vs generate | 타이밍 이슈, 다음 사이클에 포함 | LOW |
| 4 | **settlement_queue.match_id UNIQUE 없음** | 동일 매칭을 여러 번 큐 등록 가능 | **FINANCIAL** |

### 동시성 분석 요약

- **FINANCIAL 위험**: 4건 (정산 이중 생성, 정산 큐 중복, 구/신 파이프라인, 반품 이중 접수)
- **DATA_CORRUPTION**: 10건
- **근본 원인**: 관리자 간 실시간 동기화 없음 (모든 레이스를 가능하게 하는 amplifier)
- **총 발견**: 30건

---

## 3. 외부 서비스 장애 경로 분석

### 3.1 Supabase 데이터베이스

#### 에러 미확인 Supabase 작업 (9건)

| # | 파일 | 라인 | 작업 | 실패 시 결과 |
|---|------|------|------|-------------|
| 1 | `notification/index.ts` | 112-125 | `notification_logs` INSERT | 알림 로그 유실 |
| 2 | `settlement/generate/route.ts` | 134-139 | `settlement_items` INSERT | 정산은 생성되지만 항목 미연결 |
| 3 | `settlement/generate/route.ts` | 143-146 | `sold_items` UPDATE | 항목이 'pending' 유지 → 다음 정산에 이중 포함 |
| 4 | `settlement/auto-match/route.ts` | 118-125 | `sales_records`/`naver_settlements` UPDATE | match_status 불일치 |
| 5 | `settlement/manual-match/route.ts` | 62-69 | 동일 | match_status 불일치 |
| 6 | `settlement/queue-settlements/route.ts` | 213-222 | 상태 리셋 | 삭제 시 match_status 미복구 |
| 7 | `admin/consignments/[id]/route.ts` | 483 | `st_products` UPDATE (가격 추정) | 가격 미반영 |
| 8 | `lib/settlement/sale-detector.ts` | 103-111 | `st_products` UPDATE (sold_at) | 미판매 표시인데 SMS는 발송됨 |
| 9 | `admin/consignments/route.ts` | 261 | `sellers` UPDATE (이름 동기화) | 판매자 이름 stale |

#### 비원자적 다단계 작업 (3건)

| # | 파일 | 작업 단계 | 실패 시 결과 |
|---|------|----------|-------------|
| 1 | `consignments/[id]/route.ts:237-353` | st_products → orders → order_items → status 업데이트 | 중간 실패 시 고아 데이터 |
| 2 | `admin/orders/route.ts:111-154` | order → order_item (롤백 있지만 롤백 에러 미확인) | 고아 주문 |
| 3 | `settlement/generate/route.ts:114-150` | settlement → settlement_items → sold_items 업데이트 | 항목 없는 정산 |

#### RLS/빈 데이터 가정 (3건)

| # | 파일 | 문제 | 실패 시 결과 |
|---|------|------|-------------|
| 1 | `settlement/generate/route.ts:56-61` | 활성 판매자 없으면 경고 없이 빈 결과 | 무응답 |
| 2 | `consignments/route.ts:146-148` | 판매자 목록 쿼리 실패 시 빈 캐시 | 모든 행에 새 판매자 생성 → 대량 중복 |
| 3 | `queue-settlements/route.ts:26-30` | queuedMatchIds 쿼리 실패 시 빈 Set | 모든 매칭 재등록 → 이중 큐 |

### 3.2 SMS/Solapi API

| # | 문제 | 파일 | 영향 |
|---|------|------|------|
| 1 | **Dev mode 가짜 성공** | `lib/notification/sms.ts:45-49` | API키 미설정 시 `{success: true}` 반환 — 실제 미발송 |
| 2 | 레이트 리밋 미처리 | `sms.ts:52` | 대량 발송 중 429 시 나머지 전부 실패 |
| 3 | SENDER_PHONE 미검증 | `sms.ts:39` | `requireEnv()` 미포함 — 빈 문자열로 모든 SMS 실패 |
| 4 | 전화번호 포맷 미검증 | `sms.ts` | 잘못된 번호가 SMS 제공자까지 전달 |
| 5 | SMS 실패 = 워크플로우 계속 | `consignments/[id]/route.ts:190,346` | `.catch(() => {})` — 판매자 미통지 |

### 3.3 PhotoRoom API

| # | 문제 | 파일 | 영향 |
|---|------|------|------|
| 1 | **타임아웃 없음** | `lib/photoroom.ts:53` | AbortController 없음 — 무한 대기 |
| 2 | 손상 응답 처리 | `photoroom.ts:72-73` | ok=true + 빈 본문 → sharp 크래시 |
| 3 | @imgly 폴백 미설치 가능 | `lib/photo-editor.ts:86-108` | PhotoRoom 장애 + @imgly 미설치 = 배경 제거 불가 |
| 4 | 대용량 파일 동기 읽기 | `photoroom.ts:44` | `readFileSync` 50MB → 이벤트 루프 블로킹 |

### 3.4 Claude/Anthropic API

| # | 문제 | 파일 | 영향 |
|---|------|------|------|
| 1 | 65초 고정 대기 | `claude-api.ts:68-84` | 레이트 리밋 시 지수 백오프 없이 고정 65초 대기 |
| 2 | **빈 content 배열 크래시** | `claude-api.ts:20-31` | `msg.content[0]` 길이 미확인 → TypeError |
| 3 | 15초 타임아웃 리소스 낭비 | `claudeMatching.ts:34-57` | 타임아웃 후 API 호출은 계속 실행 (AbortController 없음) |
| 4 | 색상 추출 재시도 없음 | `color-extractor.ts:40-58` | 단일 실패로 색상 데이터 미생성 |

### 3.5 CJ 택배 API

- `lib/courier/cj-logistics.ts:49-53` — **구현 안 됨** (항상 `{success: false}`)
- `ManualCourierProvider` — 항상 `{success: true}` (추적번호 없이)
- 결과: 모든 반품 접수가 수동 처리 모드

### 3.6 네트워크/Fetch

| # | 문제 | 파일 | 영향 |
|---|------|------|------|
| 1 | PhotoRoom 타임아웃 없음 | `photoroom.ts:53` | 무한 대기 |
| 2 | 네이버 쇼핑 타임아웃 없음 | `naver-shopping.ts:46-52` | 무한 대기 |
| 3 | **네이버 JSON 파싱 미보호** | `naver-shopping.ts:66` | HTML 에러 페이지 수신 시 SyntaxError 크래시 |
| 4 | 클라이언트 API는 안전 | `lib/api/client.ts:26-85` | AbortController + 30초 타임아웃 (서버 측에서는 미사용) |

### 3.7 환경변수

#### `requireEnv()` 미포함 변수 (10건)

| 변수 | 파일 | 미설정 시 결과 |
|------|------|---------------|
| `COOLSMS_API_KEY` | `sms.ts:20` | dev mode 가짜 성공 |
| `COOLSMS_API_SECRET` | `sms.ts:21` | dev mode 가짜 성공 |
| `SENDER_PHONE` | `sms.ts:39` | 모든 SMS 실패 |
| `NAVER_CLIENT_ID` | `naver-shopping.ts:38` | **즉시 크래시** |
| `NAVER_CLIENT_SECRET` | `naver-shopping.ts:39` | **즉시 크래시** |
| `UPSTASH_REDIS_REST_URL` | `ratelimit.ts:17` | 레이트 리밋 비활성화 |
| `UPSTASH_REDIS_REST_TOKEN` | `ratelimit.ts:17` | 레이트 리밋 비활성화 |
| `CJ_API_KEY` | `cj-logistics.ts:18` | 수동 모드 (stub) |
| `CJ_API_SECRET` | `cj-logistics.ts:19` | 수동 모드 |
| `CJ_CONTRACT_CODE` | `cj-logistics.ts:20` | 수동 모드 |

#### Non-null Assertion으로 환경변수 접근 (4건)

| 파일 | 변수 | 미설정 시 결과 |
|------|------|---------------|
| `lib/supabase/admin.ts:24-25` | `SUPABASE_URL!`, `SERVICE_ROLE_KEY!` | Supabase 클라이언트 undefined로 생성 → 전체 DB 실패 |
| `lib/supabase/client.ts:21-22` | 동일 | 클라이언트 측 DB 실패 |
| `lib/auth.ts:27` | `SESSION_SECRET!` | 별도 길이 검증 있어서 안전 |
| `lib/price-lookup.ts:16-17` | Supabase URL/키 | 가격 조회 실패 |

### 외부 서비스 분석 요약

- **CRASH 위험**: 4건 (HEIC macOS, Claude 빈 응답, 네이버 JSON 파싱, 환경변수 미설정)
- **SILENT_DATA_LOSS**: 9건 (Supabase 에러 미확인)
- **WORKFLOW_BLOCKED**: 5건 (PhotoRoom/네이버 타임아웃, 프로세스 스토리지 선삭제, SENDER_PHONE, 자동매칭 타임아웃)

---

## 4. 데이터 경계값 및 엣지케이스 분석

### 4.1 빈/Null/Undefined 입력 (6건)

| # | 기능 | 파일 | 엣지케이스 | 결과 | 심각도 |
|---|------|------|-----------|------|--------|
| 1 | **로그인 인증 우회** | `admin/auth/login/route.ts:27` | `ADMIN_ID`/`ADMIN_PASSWORD` 환경변수 미설정 | `undefined === undefined` → 인증 성공 | **CRITICAL** |
| 2 | 주문 빈 필드 허용 | `admin/orders/route.ts:77-92` | `customerName: ""` | 빈 문자열로 주문 생성 | MEDIUM |
| 3 | 주문 PATCH 무동작 성공 | `admin/orders/route.ts:158-218` | `body: {}` | `{success: true}` 반환하지만 아무것도 안 함 | MEDIUM |
| 4 | **sale_price: null 허용** | `admin/products/route.ts:82-125` | `{sale_price: null}` | 정산 계산에서 NaN 발생 | HIGH |
| 5 | 삭제 카운트 오보 | `admin/consignments/route.ts:328-357` | 잘못된 UUID | `deleted: ids.length` (실제 삭제 0건) | MEDIUM |
| 6 | SMS 전화번호 미검증 | `notifications/send-sms/route.ts:11-25` | `phone: "invalid"` | SMS 제공자까지 전달 | LOW |

### 4.2 숫자 경계값 (8건)

| # | 문제 | 파일 | 엣지케이스 | 결과 | 심각도 |
|---|------|------|-----------|------|--------|
| 1 | sale_price: 0 | `settlement-calculator.ts:31-36` | 가격 0원 | 의미 없는 0원 정산 레코드 생성 | MEDIUM |
| 2 | **음수 sale_price** | `settlement-calculator.ts:66-72` | `-50000` | 음수 정산 금액 생성 | HIGH |
| 3 | **commission_rate 범위 없음** | `settlement-calculator.ts:63` | `1.5` (150%) | 음수 지급액 (-50000원) | HIGH |
| 4 | page/limit 범위 없음 | `admin/products/route.ts:19-21` | `page=0`, `limit=-1` | Supabase 음수 range → 500 에러 | MEDIUM |
| 5 | 주문번호 충돌 | `admin/orders/route.ts:95-97` | `Math.random()` 동시 생성 | 100만분의 1 확률 충돌 (재시도 없음) | MEDIUM |
| 6 | **0원 = null 처리** | `consignments/route.ts:228` | `"0원"` | `parseInt("0") || null` → 0이 falsy라 null 됨 | MEDIUM |
| 7 | 부동소수점 누적 | `settlement-calculator.ts:71` | 100+ 항목 | `Math.round()` 완화하지만 1원 차이 가능 | LOW |
| 8 | 음수 금액 유사도 | `product-matcher.ts:113` | `-100, 100` | 200% 차이로 잘못된 비교 결과 | LOW |

### 4.3 문자열 경계값 — PostgREST 필터 인젝션 (4건, **CRITICAL**)

| # | 파일 | 라인 | 취약 코드 | 공격 벡터 |
|---|------|------|----------|----------|
| 1 | `admin/products/route.ts` | 57 | `.or(\`product_name.ilike.%${search}%,...\`)` | `search=test%,is_active.eq.false` → 필터 주입 |
| 2 | `admin/orders/search/route.ts` | 106 | `brand.ilike.%${w}%,product_name.ilike.%${w}%` | 단어에 `,` 포함 시 필터 주입 |
| 3 | `admin/notifications/route.ts` | 40 | `message.ilike.%${search}%` 문자열 보간 | 동일 패턴 |
| 4 | `settlement/manual-match/route.ts` | 39 | `.or(\`sales_record_id.eq.${body.sales_record_id},...\`)` | ID에 `,` 포함 시 중복 체크 우회 |

**공통 원인**: Supabase `.or()` 메서드에 사용자 입력을 직접 문자열 보간. Supabase의 파라미터화된 메서드(`.ilike('column', value)`)를 사용해야 함.

### 4.4 경로 탐색 취약점 (4건, **CRITICAL**)

| # | 파일 | 라인 | 취약 입력 | 결과 |
|---|------|------|----------|------|
| 1 | `photos/upload/route.ts` | 64 | `file.name = "../../.env"` | 저장소 외부에 파일 쓰기 |
| 2 | `photos/upload/route.ts` | 42 | `productId = "../../etc"` | 임의 디렉터리 생성 |
| 3 | `consignments/upload-photo/route.ts` | 37 | `consignmentId = "../.."` | 저장소 외부에 파일 쓰기 |
| 4 | `upload-photos/route.ts` | 97-107 | `.split('/').pop()!` | 직접 `/`는 제거하지만 인코딩된 문자 미처리 |

**안전 사례**: `storage/[...path]/route.ts:54` — `path.basename()` 사용.

### 4.5 날짜 경계값 (5건)

| # | 문제 | 파일 | 엣지케이스 | 결과 |
|---|------|------|-----------|------|
| 1 | 잘못된 referenceDate | `settlement/generate/route.ts:48` | `"2026-13-45"` | `Invalid Date` → `"NaN-NaN-NaN"` 쿼리 → 빈 결과 (에러 없음) |
| 2 | 한국어 날짜 포맷 | `consignments/route.ts:204-206` | `"2024년 11월 18일"` | `null` (안전하게 처리됨) |
| 3 | 음수 Excel 시리얼 | `settlement/helpers.ts:57-59` | `-1` | `"1899-12-29"` 날짜 DB 저장 |
| 4 | **연도 경계 오류** | `sales-ledger-parser.ts:58` | 1월에 12월 시트 처리 | `2027-12-31` 대신 `2026-12-31` 이어야 함 |
| 5 | **타임존 경계** | `settlement/helpers.ts:120-142` | KST 자정 (UTC 15:00) | 정산 기간 1일 밀림 가능 |

### 4.6 파일 업로드 경계값 (5건)

| # | 문제 | 파일 | 엣지케이스 | 심각도 |
|---|------|------|-----------|--------|
| 1 | 빈 파일 허용 | `upload-sales/route.ts:32-48` | 0바이트 xlsx | xlsx 라이브러리 크래시 → 500 |
| 2 | **파일 크기/타입 미검증** | `upload-sales/route.ts:32-41` | 1GB .exe 파일 | 메모리 전부 소비 (OOM) | **HIGH** |
| 3 | **upload-confirm 동일** | `upload-confirm/route.ts:37-42` | 대용량 파일 | 메모리 소진 | **HIGH** |
| 4 | **upload-naver-settle 동일** | `upload-naver-settle/route.ts:21-24` | 대용량 파일 | 메모리 소진 | **HIGH** |
| 5 | 특수문자 파일명 | `photos/upload/route.ts:64` | `"사진 (1).jpg"` | 대부분 환경에서 동작 | LOW |

### 4.7 Excel 파싱 경계값 (6건)

| # | 문제 | 심각도 | 설명 |
|---|------|--------|------|
| 1 | **컬럼 인덱스 하드코딩** | HIGH | `raw[0]`, `raw[19]`, `raw[34]` — 네이버 엑셀 포맷 변경 시 사일런트 손상 |
| 2 | 헤더만 있는 엑셀 | LOW | 정상 처리 ("파싱된 데이터가 없습니다") |
| 3 | 수식 에러 셀 | MEDIUM | `#VALUE!` → `"[object Object]"` → `NaN` → `0원` |
| 4 | CSV를 xlsx로 업로드 | MEDIUM | 단일 컬럼으로 파싱 → 모든 가격 0원 |
| 5 | 병합 셀 | MEDIUM | 첫 행만 값 보유, 나머지 `null` → 데이터 유실 |
| 6 | **대용량 Excel (10000+ 행)** | HIGH | 행별 DB 쿼리 → O(n) 순차 처리 → 타임아웃 |

### 4.8 Supabase 특정 경계값 (6건)

| # | 문제 | 심각도 | 설명 |
|---|------|--------|------|
| 1 | **`.in()` 100개 제한 미처리** | HIGH | 대부분 `.in()` 호출이 청크 분할 없음 → 100개 초과 시 실패 |
| 2 | `.in()` 분할 미처리 (다수 라우트) | HIGH | `consignments`, `bulk-send`, `upload-naver-settle`, `upload-sales-ledger`, `queue-settlements`, `generate-payout` |
| 3 | **1000행 사일런트 절삭** | **CRITICAL** | orders GET, naver_settlements GET, sales_records GET, products summary → 1000행 초과 시 나머지 무시 |
| 4 | `.or()` 사용자 입력 미이스케이프 | CRITICAL | §4.3 PostgREST 인젝션과 동일 |
| 5 | **Public 엔드포인트 admin 클라이언트** | HIGH | `/api/orders/[productId]/hold`가 service role key 사용 — RLS 우회 |
| 6 | review-report 전체 메모리 로딩 | MEDIUM | 10000+ 레코드 시 메모리 문제 |

### 데이터 경계값 분석 요약

- **CRITICAL**: 6건 (인증 우회, PostgREST 인젝션 ×2, 경로 탐색 ×2, 1000행 절삭)
- **HIGH**: 16건 (sale_price null, 음수 정산, 파일 크기 미검증, .in() 미분할, admin 클라이언트 공개 등)
- **MEDIUM**: 18건
- **LOW**: 12건

---

## 5. 전체 실패 시나리오 통합 테이블

### 최고 위험 (FINANCIAL + CRITICAL)

| # | 카테고리 | 문제 | 심각도 | 가능성 | 영향 |
|---|----------|------|--------|--------|------|
| 1 | 동시성 | `settlement_queue.match_id` UNIQUE 없음 | **CRITICAL** | MEDIUM | 동일 매출 이중 지급 |
| 2 | 동시성 | 정산 생성 더블서밋 (생성 중 보호 없음) | **CRITICAL** | MEDIUM | 판매자에게 이중 정산 |
| 3 | 동시성 | 구/신 정산 파이프라인 공존 | **HIGH** | MEDIUM | 다른 경로로 이중 정산 |
| 4 | 경계값 | `ADMIN_ID` 미설정 시 인증 우회 | **CRITICAL** | LOW | 누구나 관리자 접근 |
| 5 | 경계값 | PostgREST 필터 인젝션 (4곳) | **CRITICAL** | MEDIUM | 데이터 노출/조작 |
| 6 | 경계값 | 경로 탐색으로 임의 파일 쓰기 (3곳) | **CRITICAL** | LOW | 서버 파일 시스템 접근 |
| 7 | 경계값 | 1000행 사일런트 절삭 | **CRITICAL** | HIGH | 통계/목록 데이터 부정확 |

### 높은 위험 (DATA_CORRUPTION + CRASH)

| # | 카테고리 | 문제 | 심각도 | 가능성 |
|---|----------|------|--------|--------|
| 8 | 런타임 | PUBLIC 엔드포인트 req.json() 미보호 (4건) | HIGH | HIGH |
| 9 | 런타임 | courier.requestPickup() try/catch 없음 | HIGH | MEDIUM |
| 10 | 동시성 | 위탁 상태 전환 레이스 (고아 주문 생성) | HIGH | MEDIUM |
| 11 | 동시성 | 네이버 정산 업로드 시 기존 데이터 완전 삭제 | HIGH | MEDIUM |
| 12 | 동시성 | 관리자 간 실시간 동기화 없음 (레이스 증폭기) | HIGH | HIGH |
| 13 | 동시성 | 판매자 전화번호/코드 중복 생성 | HIGH | MEDIUM |
| 14 | 외부서비스 | Supabase 에러 미확인 (9건) | HIGH | MEDIUM |
| 15 | 외부서비스 | SMS dev mode 가짜 성공 | HIGH | LOW |
| 16 | 경계값 | 파일 크기 미검증 (3 Excel 업로드) → OOM | HIGH | LOW |
| 17 | 경계값 | `.in()` 100개 제한 미처리 → 정산 데이터 불일치 | HIGH | MEDIUM |
| 18 | 경계값 | 대용량 Excel 행별 DB 쿼리 → 타임아웃 | HIGH | MEDIUM |
| 19 | 경계값 | 컬럼 인덱스 하드코딩 → 포맷 변경 시 사일런트 손상 | HIGH | MEDIUM |
| 20 | 외부서비스 | PhotoRoom/네이버 쇼핑 타임아웃 없음 | HIGH | MEDIUM |

### 중간 위험 (DEGRADED + SILENT)

| # | 카테고리 | 문제 | 건수 |
|---|----------|------|------|
| 21 | 런타임 | NaN 전파 (가격, 날짜, 상태) | 7건 |
| 22 | 동시성 | SMS 중복 발송 | 3건 |
| 23 | 동시성 | 파일 시스템 동시 쓰기/삭제 | 4건 |
| 24 | 동시성 | 주문 상태 전이 검증 없음 | 1건 |
| 25 | 외부서비스 | SMS 레이트 리밋 미처리 | 1건 |
| 26 | 외부서비스 | Claude API 65초 고정 대기 | 1건 |
| 27 | 경계값 | 연도/타임존 경계 오류 | 2건 |
| 28 | 경계값 | Excel 수식/병합/CSV 엣지케이스 | 3건 |
| 29 | 경계값 | 음수 정산, commission_rate 범위 없음 | 2건 |
| 30 | 경계값 | 0원 = null 처리 버그 | 1건 |

---

## 6. V3 설계 시 필수 방어 체크리스트

### 6.1 런타임 방어

```
□ 모든 API 라우트에 req.json() try/catch 래핑
□ 또는 Zod 스키마 파싱으로 일괄 보호
□ Non-null assertion (!) 전면 제거 → optional chaining + 명시적 에러
□ 배열 접근 전 길이 검증 (msg.content[0] 패턴)
□ 모든 외부 서비스 호출에 try/catch
□ parseInt/Number 결과에 isNaN 검증
□ HEIC 변환 플랫폼 체크 (process.platform)
□ fs 작업 비동기화 (readFile, writeFile)
```

### 6.2 동시성 방어

```
□ settlement_queue.match_id에 UNIQUE 제약 추가
□ 정산 생성 시 FOR UPDATE 또는 idempotency key
□ 모든 상태 UPDATE에 .eq('status', expected) 조건 포함
□ 네이버 정산 업로드: DELETE 대신 batch-specific cleanup
□ Supabase Realtime 또는 SWR polling으로 관리자 간 동기화
□ 판매자 테이블 phone UNIQUE 제약 추가
□ settlement_matches UNIQUE으로 이미 보호됨 — 유지
□ 서버 측 idempotency key 또는 mutex (정산, SMS)
```

### 6.3 외부 서비스 방어

```
□ 모든 fetch에 AbortController + 타임아웃 (30초)
□ Supabase 작업 후 { error } 반드시 확인
□ 다단계 작업은 Supabase RPC 트랜잭션으로 원자화
□ SMS dev mode 제거 → requireEnv()로 API 키 필수화
□ 환경변수 전수 requireEnv() 등록
□ Claude API content 배열 길이 검증
□ 네이버 쇼핑 res.json() try/catch 래핑
□ sharp/xlsx 에러 메시지 사용자 친화적으로
```

### 6.4 데이터 경계값 방어

```
□ Zod 스키마로 모든 API 입력 검증 (타입, 범위, 포맷)
□ .or() 문자열 보간 → 파라미터화 메서드 전환
□ 모든 파일 경로에 path.basename() 적용
□ 파일 업로드 크기 제한 (10MB) + MIME 타입 검증
□ .in() 호출 100개 청크 분할 유틸 생성
□ 페이지네이션 강제 (1000행 제한 대응)
□ commission_rate 범위 검증 (0 < rate < 1)
□ sale_price null/0/음수 검증
□ Excel 파싱 시 헤더 검증 (컬럼명 매칭)
□ 대량 처리 시 배치/스트리밍 패턴
```

### 6.5 핵심 DB 제약 (마이그레이션 필수)

```sql
-- 정산 큐 중복 방지
ALTER TABLE settlement_queue ADD CONSTRAINT uq_queue_match UNIQUE (match_id);

-- 판매자 전화번호 유니크
ALTER TABLE sellers ADD CONSTRAINT uq_sellers_phone UNIQUE (phone);

-- 판매자 코드 유니크
ALTER TABLE sellers ADD CONSTRAINT uq_sellers_code UNIQUE (seller_code);

-- 반품 접수 중복 방지
ALTER TABLE return_shipments ADD CONSTRAINT uq_return_consignment UNIQUE (consignment_id);

-- 상품번호 유니크
ALTER TABLE st_products ADD CONSTRAINT uq_st_products_number UNIQUE (product_number);
```

---

## 전체 통계

| 카테고리 | 에이전트 | 발견 건수 | CRITICAL | HIGH | MEDIUM | LOW |
|----------|---------|----------|----------|------|--------|-----|
| 런타임 크래시 | Runtime Crash Analyzer | 25 | 0 | 18 | 0 | 7 |
| 동시성/레이스 | Concurrency Analyzer | 30 | 0 | 12 | 13 | 5 |
| 외부 서비스 | External Service Analyzer | 28 | 4 | 9 | 10 | 5 |
| 데이터 경계값 | Data Boundary Analyzer | 52 | 6 | 16 | 18 | 12 |
| **합계** | | **135건** | **10** | **55** | **41** | **29** |

### 최우선 수정 5개 (V3 아키텍처 반영 필수)

1. **`settlement_queue.match_id` UNIQUE 제약 추가** — DB 레벨에서 이중 지급 차단
2. **모든 .or() 문자열 보간 → 파라미터화 전환** — PostgREST 인젝션 4건 즉시 차단
3. **모든 파일 경로에 `path.basename()` 적용** — 경로 탐색 3건 차단
4. **Zod 스키마 기반 입력 검증 레이어** — req.json() 크래시 12건 + 경계값 다수 일괄 해결
5. **Supabase 작업 에러 확인 + 트랜잭션 원자화** — 9건 SILENT_DATA_LOSS + 3건 비원자적 작업 해결

---

*이 보고서는 4개 전문 에이전트(Opus 4.6)가 각각 50-60개 도구 호출을 수행하여 작성되었습니다. 총 234개 도구 호출, 약 20분 분석. V2 코드는 일체 수정하지 않았습니다.*
