# Classic Menswear V2 → V3 — 통합 리서치 보고서 (합본)

**작성일**: 2026-03-01
**원본**: v2reserch1.md (1차), v2reserch2.md (2차), v3reserch3.md (3차), v4reserch4.md (4차)
**추가 소스**: 정산 모듈 딥 분석(9파일), 사진/외부서비스 딥 분석(27파일), 프론트엔드/API 딥 분석(12컴포넌트+라우트)
**방법론**: 3라운드 분석 — Round 1(딥 에이전트 병렬), Round 2(4개 보고서 교차검증), Round 3(실패 시뮬레이션)
**원칙**: 코드 수정 없이 조사/보고만 수행

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [보안 및 인증](#2-보안-및-인증-sec)
3. [정산 및 금전](#3-정산-및-금전-fin)
4. [데이터 무결성](#4-데이터-무결성-dat)
5. [런타임 안정성](#5-런타임-안정성-run)
6. [외부 서비스 통합](#6-외부-서비스-통합-ext)
7. [프론트엔드 및 UI](#7-프론트엔드-및-ui-fe)
8. [코드 품질 및 아키텍처](#8-코드-품질-및-아키텍처-arc)
9. [딥 분석 신규 발견](#9-딥-분석-신규-발견-new)
10. [복합 실패 시나리오](#10-복합-실패-시나리오)
11. [V3 방어 체크리스트](#11-v3-방어-체크리스트)
12. [교차 참조 맵](#12-교차-참조-맵)
13. [전체 통계](#13-전체-통계)

---

## 1. 프로젝트 개요

### 기술 스택
- **프레임워크**: Next.js 16.1.6, React 19.2.3, TypeScript
- **DB**: Supabase (PostgreSQL), RLS 미활용
- **스타일**: Tailwind v4 (154회) + inline style (1,061회 혼용)
- **외부 서비스**: Solapi SMS, Claude AI SDK, PhotoRoom, Naver Shopping, sharp, xlsx, puppeteer

### 코드베이스 규모
| 항목 | 수량 |
|------|------|
| 총 TS/TSX 파일 | 180+ |
| API 엔드포인트 | 57개 (82 핸들러) |
| 컴포넌트 | 64개 |
| 커스텀 훅 | 17개 |
| lib 모듈 | 47개 |
| DB 테이블 | 14개 |
| DB 마이그레이션 | 21개 |

### 리서치 원본별 발견 건수

| 리서치 | 발견 건수 | 주요 초점 |
|--------|----------|----------|
| 1차 (v2reserch1.md) | 17건 | 전반적 문제 파악 |
| 2차 (v2reserch2.md) | 51건 | 교리 위반, 기능 간섭, 엣지 케이스, 코드 중복 |
| 3차 (v3reserch3.md) | 34건 + 82핸들러 테이블 + 12 리스크 | 미들웨어 미작동, AS-IS/TO-BE, 아키텍처 |
| 4차 (v4reserch4.md) | 135건 | 런타임 크래시, 동시성, 외부 장애, 경계값 |
| 딥 분석 (3 에이전트) | 39건 (15 중복) | 정산 파서, 사진/외부, 프론트엔드 |

**중복 제거 후 고유 이슈**: ~220건

---

## 2. 보안 및 인증 (SEC)

### SEC-01: 미들웨어 완전 미작동 [CRITICAL]

**원본**: R3-§1 (근본 원인), R1-#1, R2-CRIT-01 (증상)

`proxy.ts` 파일명으로 작성되어 Next.js가 **미들웨어 자체를 인식하지 않음**.

```
.next/dev/server/middleware-manifest.json → { "middleware": {} }
```

| 항목 | 현재 상태 | Next.js 요구사항 |
|------|----------|----------------|
| 파일명 | `proxy.ts` | `middleware.ts` |
| 함수명 | `export function proxy()` | `export function middleware()` |

**영향**: 세션 검증, 레이트 리밋 모두 미실행. `/admin/*` 페이지와 `/api/admin/*` API 모두 인증 없이 접근 가능.

**V3 해결**: `middleware.ts`로 리네이밍 + 모든 API 라우트에 `requireAdmin()` 인라인 가드 이중 적용.

---

### SEC-02: ADMIN_ID 미설정 시 인증 우회 [CRITICAL]

**원본**: R4-§4.1-#1

`admin/auth/login/route.ts:27` — `ADMIN_ID`/`ADMIN_PASSWORD` 환경변수 미설정 시 `undefined === undefined` → **인증 성공**.

**V3 해결**: `requireEnv('ADMIN_ID')` + bcrypt/argon2 해싱. 비밀번호 평문 비교(R3-Feature1) 동시 제거.

---

### SEC-03: 경로 탐색(Path Traversal) [CRITICAL] — 3개소

**원본**: R2-CRIT-03, R4-§4.4

| # | 파일 | 취약 입력 |
|---|------|----------|
| 1 | `photos/upload/route.ts:42,64` | `productId`, `file.name` |
| 2 | `consignments/upload-photo/route.ts:37` | `consignmentId` |
| 3 | `upload-photos/route.ts:97-107` | `.split('/').pop()!` 인코딩 미처리 |

`productId=../../etc` 등으로 서버 파일시스템 임의 위치에 파일 쓰기 가능.

**안전 사례**: `storage/[...path]/route.ts:54` — `path.basename()` 사용.

**V3 해결**: 모든 파일 경로에 `path.basename()` + `startsWith()` 이중 검증. 빈 문자열 체크. `fs.realpathSync` 정규화 후 비교(심볼릭 링크 대응).

---

### SEC-04: PostgREST 필터 인젝션 [CRITICAL] — 4개소

**원본**: R4-§4.3

| # | 파일 | 취약 코드 |
|---|------|----------|
| 1 | `admin/products/route.ts:57` | `.or(\`product_name.ilike.%${search}%,...\`)` |
| 2 | `admin/orders/search/route.ts:106` | `brand.ilike.%${w}%` |
| 3 | `admin/notifications/route.ts:40` | `message.ilike.%${search}%` |
| 4 | `settlement/manual-match/route.ts:39` | `sales_record_id.eq.${body.sales_record_id}` |

**공격 벡터**: `search=test%,is_active.eq.false` → 필터 주입으로 숨겨진 데이터 노출/조작.

**V3 해결**: `.or()` 문자열 보간 전면 제거 → Supabase 파라미터화 메서드(`.ilike('column', value)`) 전환.

---

### SEC-05: Public API에서 Service Role Key 사용 [CRITICAL]

**원본**: R1-#2, R4-§4.8-#5

| 파일 | 문제 |
|------|------|
| `consignment/adjust/[token]/route.ts` | 공개 엔드포인트가 RLS 우회하는 admin 클라이언트 사용 |
| `orders/[productId]/hold/route.ts` | productId 브루트포스로 customer_agreed 변경 가능 |

**V3 해결**: Public API는 `createBrowserClient()` (RLS 적용) 사용. 필요 시 RPC로 제한된 권한만 부여.

---

### SEC-06: 평문 비밀번호 비교 [HIGH]

**원본**: R3-Feature1

`admin/auth/login/route.ts` — `admin_password` 환경변수를 평문 직접 비교. Timing attack 취약.

**V3 해결**: bcrypt/argon2 해싱 + `timingSafeEqual` (기존 `lib/auth.ts`의 세션 검증은 이미 사용 중).

---

### SEC-07: storage-serve 인증 없음 [HIGH]

**원본**: R3-Feature4

`admin/photos/storage-serve` GET — 인증 없이 저장 사진 접근 가능. URL만 알면 모든 사진 열람.

**V3 해결**: `requireAdmin()` 적용 또는 Supabase Storage signed URL 전환.

---

### SEC-08: 환경변수 미검증 10건 [HIGH]

**원본**: R4-§3.7

| 변수 | 미설정 시 결과 |
|------|---------------|
| `COOLSMS_API_KEY/SECRET` | dev mode 가짜 성공 (SMS 미발송) |
| `SENDER_PHONE` | 모든 SMS 실패 |
| `NAVER_CLIENT_ID/SECRET` | 즉시 크래시 |
| `UPSTASH_REDIS_REST_URL/TOKEN` | 레이트 리밋 비활성화 |
| `CJ_API_KEY/SECRET/CONTRACT_CODE` | 수동 모드 (stub) |

**V3 해결**: 모든 환경변수 `requireEnv()` 등록. 앱 시작 시 일괄 검증.

---

## 3. 정산 및 금전 (FIN)

### FIN-01: 정산 이중 생성 [CRITICAL]

**원본**: R2-CRIT-02, R4-§2.1-#1,#2

`settlement/generate/route.ts:66-147` — `settlement_status='pending'`인 sold_items를 읽고 → 계산 → `'settled'`로 업데이트. **비원자적**. 더블클릭/동시 호출 시 동일 sold_items가 2개의 settlements에 포함.

**프론트엔드 가드**: `disabled={loading}` — 단일 브라우저 세션만 보호. 두 관리자 동시 작업, 네트워크 재시도에 무방비.

**V3 해결**: Supabase RPC `FOR UPDATE` 잠금 + 원자적 트랜잭션. 판매자별 병렬 처리 + 개별 트랜잭션.

---

### FIN-02: 두 개의 완전 독립 정산 파이프라인 [CRITICAL]

**원본**: R2-CRIT-04, R3-§4-F, R4-§2.7-#1

| 차원 | Pipeline A (구) | Pipeline B (신) |
|------|----------------|----------------|
| 엔트리 | `upload-sales` + `upload-confirm` | `upload-sales-ledger` + `upload-naver-settle` |
| 매칭 | `generate` (판매자명 매칭) | `auto-match` + `manual-match` |
| 큐 | `settlements` + `settlement_items` | `settlement_queue` |
| 계산 | `settlement-calculator.ts` | `queue-settlements/route.ts` 인라인 |
| 커미션 | `seller.commission_rate` (라이브러리) | `seller.commission_rate ?? 0.25` (인라인) |

**공유 코드: 0개. 공유 DB 테이블: sellers만.**

동일 매출에 대해 각각 정산 가능 → 이중 지급.

**V3 해결**: 1개 통합 파이프라인. 배포 전 Pipeline A pending 정산 모두 완료 처리. 양 파이프라인 데이터 호환 형식 마이그레이션.

---

### FIN-03: settlement_queue.match_id UNIQUE 없음 [CRITICAL]

**원본**: R4-§2.7-#4

동일 매칭을 여러 번 큐 등록 가능 → 이중 지급.

**V3 해결**: `ALTER TABLE settlement_queue ADD CONSTRAINT uq_queue_match UNIQUE (match_id);`

---

### FIN-04: 커미션 레이트 5곳 분산 정의 [HIGH]

**원본**: R2-INT-08, R3-§4-D

| 위치 | 값 | 상태 |
|------|---|------|
| `lib/settlement/types.ts` | general=0.25, employee/vip=0.20 | **미사용** |
| `admin/orders/types.ts` | 동일 | **미사용** |
| `settlement-calculator.ts:63` | DB에서 읽음 | 사용 (구 파이프라인) |
| `queue-settlements/route.ts:133` | `?? 0.25` 하드코딩 | 사용 (신 파이프라인) |
| `consignments/route.ts:244` | `0.20` 하드코딩 | 사용 (신규 판매자) |

**충돌**: 엑셀 업로드 판매자는 0.20. `queue-settlements` 폴백 0.25가 실제 0.20 판매자를 **5% 과징수**.

**V3 해결**: `lib/types/domain/seller.ts` 단일 소스. 폴백 제거 → 미매칭 시 큐 건너뜀 + 경고 로그.

---

### FIN-05: 타임존 혼용 — 정산 기간 1일 오차 [HIGH]

**원본**: R2-BUG-01, R3-RISK-05, R4-§4.5-#5

`lib/settlement/helpers.ts` — `getDay()` (로컬) vs `setUTCDate()` (UTC) 혼용. KST 서버에서 자정 전후로 정산 기간이 하루 어긋남.

**V3 해결**: 모든 날짜 연산 KST 일관 사용 (`toKSTDate()`). 전환일 기준 기존 데이터 검증. CI 고정 타임존.

---

### FIN-06: sale_price 사일런트 0원/null/음수 [HIGH]

**원본**: R2-BUG-02, R4-§4.1-#4, R4-§4.2-#2,#3

| 시나리오 | 파일 | 결과 |
|---------|------|------|
| 엑셀 `#VALUE!` | `sales-parser.ts:95` | `parseSalePrice` → `0` → 커미션 0원 → 판매자에게 전액 지급 |
| `sale_price: null` | `admin/products/route.ts:82` | 정산 계산에서 NaN 발생 |
| `sale_price: -50000` | `settlement-calculator.ts:66` | 음수 정산 금액 생성 |
| `commission_rate: 1.5` | `settlement-calculator.ts:63` | 음수 지급액 (-50000원) |

**V3 해결**: Zod 스키마로 `sale_price > 0` 강제. `commission_rate` 범위 0~1 검증.

---

### FIN-07: generate-payout 파일 소실 버그 [HIGH]

**원본**: R3-CF-2

`settlement/generate-payout/route.ts:199-224` — Response 객체 생성 후 DB 업데이트. 업데이트 실패 시 xlsx 파일은 반환되지 않고 소실. `queue_status`는 `'confirmed'`로 변경 안 됨.

**V3 해결**: DB 업데이트 먼저 수행 → 성공 시 xlsx 생성/반환. 또는 트랜잭션으로 래핑.

---

### FIN-08: paidMessage 데드 코드 — 지급 알림 미발송 [HIGH]

**원본**: R2-INT-07, R3-Feature5

`lib/notification/templates.ts:74-81` — `paidMessage` 템플릿 존재하나 어떤 라우트에서도 트리거하지 않음. `generate-payout`는 `'confirmed'`로만 업데이트 (`'paid'` 아님).

**V3 해결**: 지급 완료 시 `paidMessage` SMS 트리거.

---

### FIN-09: 부동소수점 정산 금액 누적 오차 [MEDIUM]

**원본**: R2-BUG-10

`settlement-calculator.ts:64-71` — `totalSales += effectivePrice` 부동소수점 누적. `225000.0000000003` 같은 비정수 금액 발생 가능.

**V3 해결**: 모든 금액 연산에 `Math.round()` 적용. 또는 정수(원 단위) 연산 후 최종 출력 시 변환.

---

### FIN-10: upload-confirm — 정산 후 가격 변경 [HIGH]

**원본**: R2-INT-05

`settlement/upload-confirm/route.ts:69` — 정산 생성 후 `sale_price` 업데이트 시, 이미 생성된 settlement의 `total_sales`는 구 가격 기반. 재계산/무효화 메커니즘 없음.

**V3 해결**: 커미션 레이트를 판매 시점에 스냅샷으로 기록. 정산 생성 후 가격 변경 시 경고.

---

### FIN-11: product-matcher 0.3 임계값으로 auto_matched [HIGH]

**원본**: R2-BUG-07

`product-matcher.ts:252-273` — 동명이인 매칭에서 상품명 유사도 **0.3(30%)**만 넘으면 `auto_matched` 처리. 메인 매칭의 `THRESHOLD_AUTO = 0.85`와 불일치.

**V3 해결**: 동명이인 매칭도 0.85 이상 임계값 적용. 미달 시 `manual_required`.

---

### FIN-12: 매칭 허용 오차 0% [MEDIUM]

**원본**: R3-Feature3-#10

네이버 정산 매칭에서 1원 쿠폰 차이로 매칭 실패. 허용 오차(tolerance) 없음.

**V3 해결**: ±100원 허용 오차 설정.

---

## 4. 데이터 무결성 (DAT)

### DAT-01: 1000행 사일런트 절삭 [CRITICAL]

**원본**: R4-§4.8-#3, R3-RISK-06

Supabase 기본 1000행 제한으로 다음 쿼리들이 사일런트 절삭:
- `admin/orders` GET — 주문 목록
- `naver_settlements` GET — 네이버 정산 데이터
- `sales_records` GET — 매출 레코드
- `admin/products` GET — 상품 요약 카운트
- `detectConsignmentSales` — 위탁 판매 감지

**영향**: 재고 1000건 초과 시 통계/목록 데이터 부정확. 판매 감지 영구 누락.

**V3 해결**: 모든 전체 테이블 쿼리에 `.range()` 페이지네이션 적용. 카운트 전용 쿼리 분리.

---

### DAT-02: ConsignmentStatus 3값 vs 7값 타입 불일치 [CRITICAL]

**원본**: R2-CRIT-05, R3-RISK-01

`route.ts:14` — `type ConsignmentStatus = 'pending' | 'approved' | 'rejected'` (3값). DB CHECK은 7값(`pending`, `received`, `inspecting`, `approved`, `on_hold`, `rejected`, `completed`).

**영향**: TypeScript가 잘못된 상태 전환을 잡지 못함. `?status=received` GET 시 400 반환 가능.

**V3 해결**: DB CHECK 7값과 정확히 일치하는 단일 타입 정의. `lib/types/domain/consignment.ts`.

---

### DAT-03: UNIQUE 제약 누락 5건 [HIGH]

**원본**: R4-§2.2-#4,#5, R4-§2.7-#4, R4-§2.2-#8, R3-RISK-12

| 테이블.컬럼 | 현재 | 영향 |
|------------|------|------|
| `sellers.phone` | UNIQUE 없음 | 동시 엑셀 업로드 시 중복 판매자 |
| `sellers.seller_code` | UNIQUE 없음 | 판매자 코드 중복 → 정산 매칭 혼선 |
| `settlement_queue.match_id` | UNIQUE 없음 | 동일 매칭 이중 큐 → 이중 지급 |
| `return_shipments.consignment_id` | UNIQUE 없음 | 동일 위탁 이중 반품 접수 |
| `st_products.product_number` | UNIQUE 없음 | 상품번호 중복 |

**V3 해결**: 마이그레이션으로 5개 UNIQUE 제약 추가. 기존 중복 행 정리 선행 필수.

---

### DAT-04: Stuck-Consignment 버그 — 영구 복구 불가 [HIGH]

**원본**: R3-CF-1

`consignments/[id]/route.ts:237-343` — 위탁 완료 5단계 중 Step 5(status UPDATE) 실패 시:
- `st_products` 레코드 존재 (product_number 점유)
- `consignment_requests.status`는 여전히 `received`
- 재시도 시 Step 1에서 409 `"상품번호가 이미 존재합니다"` → **영구 복구 불가**

**V3 해결**: 전체를 RPC 트랜잭션으로 래핑. 실패 시 전체 롤백.

---

### DAT-05: 비원자적 다단계 작업 3건 [HIGH]

**원본**: R1-#5, R4-§3.1 비원자적

| # | 파일 | 작업 단계 | 실패 시 |
|---|------|----------|--------|
| 1 | `consignments/[id]/route.ts` | st_products → orders → order_items → status | 고아 데이터 |
| 2 | `admin/orders/route.ts:111-154` | order → order_item (롤백 있지만 에러 미확인) | 고아 주문 |
| 3 | `settlement/generate/route.ts:114-150` | settlement → items → sold_items UPDATE | 항목 없는 정산 |

**V3 해결**: 모두 Supabase RPC 트랜잭션으로 원자화.

---

### DAT-06: Promise.all 결과 무시 3건 [HIGH]

**원본**: R2-BUG-15, R3-CF-3, R4-§1.6-#6,#7

| 파일 | 문제 |
|------|------|
| `settlement/auto-match/route.ts:118-125` | match 기록 OK, 원본 `match_status` 미변경 → 재매칭 → 중복 |
| `settlement/manual-match/route.ts:62-69` | 한쪽만 업데이트 감지 불가 |
| `settlement/manual-match/DELETE` | 롤백 반쪽만 적용 가능 |

**V3 해결**: 결과 검사 + 보상 트랜잭션. 최적으로는 RPC.

---

### DAT-07: Supabase 에러 미확인 9건 [HIGH]

**원본**: R4-§3.1

| # | 파일 | 작업 | 실패 시 |
|---|------|------|--------|
| 1 | `notification/index.ts:112` | notification_logs INSERT | 로그 유실 |
| 2 | `settlement/generate:134` | settlement_items INSERT | 항목 미연결 |
| 3 | `settlement/generate:143` | sold_items UPDATE | 'pending' 유지 → 이중 포함 |
| 4-5 | `auto-match`, `manual-match` | UPDATE | match_status 불일치 |
| 6 | `queue-settlements:213` | 상태 리셋 | match_status 미복구 |
| 7 | `consignments/[id]:483` | st_products UPDATE | 가격 미반영 |
| 8 | `sale-detector.ts:103` | st_products UPDATE | 미판매인데 SMS 발송 |
| 9 | `consignments/route.ts:261` | sellers UPDATE | 판매자 이름 stale |

**V3 해결**: 모든 Supabase 작업 후 `{ error }` 반드시 확인.

---

### DAT-08: 위탁 상태 전환 레이스 — 고아 주문 [HIGH]

**원본**: R4-§2.2-#3, R4-§2.4-#1

모든 상태 UPDATE에 `.eq('status', expected)` 없음. Admin A가 "완료" 처리(st_products, orders 생성) 후 Admin B가 "거절"로 덮어쓰면, 거절된 위탁에 고아 주문 데이터 남음.

**V3 해결**: 모든 상태 UPDATE에 현재 상태 조건 포함. 상태 머신 정의.

---

### DAT-09: 네이버 정산 업로드 시 기존 데이터 삭제 [HIGH]

**원본**: R4-§2.3-#3, R3-Feature3-#9

`upload-naver-settle/route.ts:36-39` — 업로드 시작 시 `DELETE .eq('match_status', 'unmatched')` 실행. Admin A 업로드 → Admin B 동시 업로드 시 Admin A 데이터 완전 삭제.

**V3 해결**: 삭제 대신 batch-specific cleanup (업로드 세션 ID 기반).

---

### DAT-10: 주문번호 `Math.random()` 충돌 [MEDIUM]

**원본**: R2-BUG-14, R3-§4-E

`admin/orders/route.ts:95-97`, `consignments/[id]/route.ts:272-274` — 동일 알고리즘 2곳 복사. `Math.random() * 1000000`으로 6자리. 충돌 시 주문 생성 실패, 재시도 없음.

**V3 해결**: `lib/utils/id.ts` 단일 유틸 + DB UNIQUE 제약 + 충돌 시 재시도.

---

### DAT-11: 주문 상태 머신 없음 [MEDIUM]

**원본**: R3-Feature6-#15, R4-§2.4-#2

어떤 상태로든 전환 가능 (`PAID` → `APPLIED` 가능). 상태 전이 검증 전혀 없음.

**V3 해결**: 허용 전환 정의 + 타입 가드.

---

### DAT-12: 날짜 문자열 미검증 [MEDIUM]

**원본**: R2-BUG-08, R2-BUG-09, R4-§4.5

| 시나리오 | 결과 |
|---------|------|
| `"2026년 2월 4일"` | 원본 그대로 DB 저장 → `Invalid Date` |
| `"2026.13.45"` | `"2026-13-45"` 생성 → PostgreSQL 에러 |
| `referenceDate="invalid"` | `Invalid Date` → `"NaN-NaN-NaN"` 쿼리 → 빈 결과 (에러 없음) |

**V3 해결**: Zod 스키마로 날짜 포맷 검증.

---

### DAT-13: `toStr()` — 숫자 0을 null로 변환 [HIGH]

**원본**: R2-BUG-03, R4-§4.2-#6

`String(0).trim()` = `"0"`, JS에서 `"0" || null` = `null`. `product_order_no`가 0이면 행 스킵. 동일 패턴: `parseInt("0") || null` → 0 = falsy → null.

**V3 해결**: `?? null` 사용 (`||` 대신). `0` 명시적 허용.

---

### DAT-14: sold_at vs is_active 비일관 [MEDIUM]

**원본**: R2-INT-03

`sale-detector`가 `sold_at` 기록하지만 `is_active` 미변경. `is_active=true AND sold_at IS NOT NULL`인 상품은 양쪽 카운트에서 빠짐.

**V3 해결**: 판매 감지 시 `sold_at`과 `is_active` 동시 업데이트.

---

### DAT-15: updatedCount — 시도 횟수 반환 [MEDIUM]

**원본**: R2-BUG-05

`upload-confirm/route.ts:60-78` — Supabase `.update().eq()`가 0행 매칭해도 `error: null`. `updatedCount++` 실행 → 관리자에게 잘못된 확인 정보.

**V3 해결**: `.select()` 체이닝으로 실제 영향 행수 확인.

---

### DAT-16: .in() 100개 제한 미처리 [HIGH]

**원본**: R4-§4.8-#1,#2

대부분 `.in()` 호출이 청크 분할 없음. 100개 초과 시 실패.

**영향 라우트**: `consignments`, `bulk-send`, `upload-naver-settle`, `upload-sales-ledger`, `queue-settlements`, `generate-payout`

**V3 해결**: `.in()` 100개 청크 분할 유틸 `chunkIn()` 생성.

---

## 5. 런타임 안정성 (RUN)

### RUN-01: PUBLIC 엔드포인트 req.json() 미보호 [CRITICAL] — 4건

**원본**: R4-§1.1

| # | 파일 | Public |
|---|------|--------|
| 1 | `consignment/adjust/[token]/route.ts:65` | YES |
| 2 | `consignment/adjust/[token]/return/route.ts:18` | YES |
| 3 | `admin/auth/login/route.ts:27` | YES |
| 4 | `orders/[productId]/hold/route.ts:48` | YES |

외부에서 의도적으로 malformed JSON 전송 → `SyntaxError`로 즉시 크래시. **추가 8건 admin 라우트도 동일**.

**안전 사례**: `settlement/generate/route.ts:47` — `.catch(() => ({}))`.

**V3 해결**: Zod 스키마 파싱으로 일괄 보호. `await req.json().catch(() => ({}))` + `safeParse`.

---

### RUN-02: Non-null Assertion 크래시 3건 [HIGH]

**원본**: R4-§1.2

| 파일 | 코드 | 트리거 |
|------|------|--------|
| `create-single/route.ts:74` | `newSeller!.id` | Supabase insert → `{data: null, error: null}` |
| `create-single/route.ts:101` | `consignment!.id` | 동일 |
| `consignments/route.ts:253` | `newSeller!.id as string` | 동일 |

**V3 해결**: Non-null assertion `!` 전면 제거 → optional chaining + 명시적 에러.

---

### RUN-03: 파일 시스템 크래시 4건 [HIGH]

**원본**: R4-§1.4

| # | 파일 | 문제 |
|---|------|------|
| 1 | `storage/[...path]:73` | TOCTOU: `existsSync` → `readFileSync` 사이 파일 삭제 |
| 2 | `lib/heic-to-jpeg.ts:43` | `/usr/bin/sips` macOS 전용, Linux ENOENT |
| 3 | `lib/heic-to-jpeg.ts:53` | `unlinkSync` temp 파일 미생성 시 ENOENT |
| 4 | `lib/photoroom.ts:44` | `readFileSync` 파일 삭제 시 ENOENT |

**V3 해결**: fs 작업 비동기화 + try/catch. HEIC 변환 `process.platform` 체크. Supabase Storage 전환 시 대부분 해소.

---

### RUN-04: NaN 전파 (조용한 실패) 7건 [HIGH]

**원본**: R4-§1.6

| 파일 | 코드 | 결과 |
|------|------|------|
| `useAdjustmentChoice.ts:37` | `parseInt(counterPrice)` | DB에 NaN 저장 |
| `PriceAdjustmentSection.tsx:53` | `parseInt(customPrice)` | API에 NaN 전송 |
| `upload-sales-ledger/route.ts:29` | `parseInt(yearRaw)` | "NaN-02-19" 날짜 |
| `adjust/[token]/route.ts:75` | `NaN <= 0` is `false` | NaN이 가격 검증 통과 |

**V3 해결**: 모든 `parseInt/Number` 결과에 `isNaN` 검증. Zod으로 입력 단에서 차단.

---

### RUN-05: try/catch 없는 핸들러 8개 [HIGH]

**원본**: R2-§2-C, R3-§3

| 라우트 | 메서드 |
|--------|--------|
| `admin/auth/login` | POST |
| `admin/orders` | GET, POST, PATCH |
| `admin/consignments/[id]` | PATCH |
| `admin/consignments/return-shipment` | POST |
| `admin/notifications/send-sms` | POST |
| `admin/notifications/resend` | POST |

**V3 해결**: 모든 핸들러에 교리 표준 try/catch 패턴 적용.

---

### RUN-06: SMS 미발송 버그 [HIGH]

**원본**: R1-#4, R3-Feature5-#13

`useOrderHandlers.ts` 가격 조정/재발송 시나리오에서 실제 SMS API 호출 없이 `console.log`만 실행. 추가로 `on_hold`, `rejected`, `paid` 전환 시 SMS 없음.

**V3 해결**: 모든 상태 전환에 이벤트 디스패처. `notification.service.ts` 통합.

---

### RUN-07: 외부 서비스 미보호 호출 2건 [HIGH]

**원본**: R4-§1.5

| 파일 | 문제 |
|------|------|
| `adjust/[token]/return/route.ts:73` | `courier.requestPickup()` try/catch 없음 (**PUBLIC**) |
| `admin/consignments/return-shipment/route.ts:78` | 동일 |

**V3 해결**: 모든 외부 서비스 호출에 try/catch.

---

### RUN-08: sale-detector DB 실패 후 SMS 발송 [HIGH]

**원본**: R2-BUG-06

`sale-detector.ts:103-123` — `st_products` UPDATE 에러 체크 없이 `result.matched++` + SMS 발송. DB 업데이트 실패해도 "판매 완료" SMS 발송.

**V3 해결**: DB 업데이트 성공 확인 후에만 SMS 발송.

---

### RUN-09: settlement/generate 사일런트 스킵 [HIGH]

**원본**: R2-BUG-16, R3-CF-4

`settlement/generate/route.ts:114` — `if (settlementError) continue` → sold_items는 'pending' 유지 → 다음 실행 시 재포함 → 반복적 실패.

**V3 해결**: 스킵하지 않고 에러 수집 → 최종 응답에 포함.

---

## 6. 외부 서비스 통합 (EXT)

### EXT-01: 타임아웃 없는 외부 API 호출 [HIGH] — 4개 서비스

**원본**: R4-§3.3-#1, R4-§3.4, R4-§3.6, 딥 분석

| 서비스 | 파일 | 결과 |
|--------|------|------|
| PhotoRoom | `lib/photoroom.ts:53` | 무한 대기 |
| Naver Shopping | `naver-shopping.ts:46-52` | 무한 대기 |
| Claude AI | `claude-api.ts:68-84` | 65초 고정 대기 (지수 백오프 없음) |
| Supabase Storage | 다수 | 기본 타임아웃에 의존 |

**V3 해결**: 모든 fetch에 `AbortController` + 30초 타임아웃.

---

### EXT-02: SMS dev mode 가짜 성공 [HIGH]

**원본**: R4-§3.2-#1

`lib/notification/sms.ts:45-49` — API키 미설정 시 `{success: true}` 반환. 실제 SMS 미발송이지만 시스템은 성공으로 인식.

**V3 해결**: dev mode 제거 → `requireEnv('COOLSMS_API_KEY')` 필수화.

---

### EXT-03: CJ 택배 API 미구현 [MEDIUM]

**원본**: R1-#7, R4-§3.5

`lib/courier/cj-logistics.ts:49-53` — 항상 `{success: false}` 반환하는 스텁. `ManualCourierProvider` — 항상 `{success: true}` (추적번호 없이).

**V3 해결**: CJ API 실구현 또는 명시적 수동 모드 UI.

---

### EXT-04: Claude API 빈 content 배열 크래시 [HIGH]

**원본**: R4-§3.4-#2, 딥 분석

`claude-api.ts:20-31` — `msg.content[0].type` 길이 미확인 → TypeError 크래시.

**V3 해결**: 배열 길이 검증 후 접근. 빈 응답 시 재시도.

---

### EXT-05: 네이버 쇼핑 JSON 파싱 미보호 [HIGH]

**원본**: R4-§3.6-#3, 딥 분석

`naver-shopping.ts:66` — HTML 에러 페이지 수신 시 `SyntaxError` 크래시.

**V3 해결**: `res.json()` try/catch 래핑. Content-Type 확인.

---

### EXT-06: PhotoRoom 대용량 동기 읽기 [MEDIUM]

**원본**: R4-§3.3-#4, 딥 분석

`photoroom.ts:44` — `readFileSync` 50MB → 이벤트 루프 블로킹. PhotoRoom 장애 + @imgly 미설치 = 배경 제거 불가.

**V3 해결**: `fs.readFile` 비동기화. Buffer 기반 파이프라인.

---

### EXT-07: HEIC 변환 macOS 전용 [HIGH]

**원본**: R4-§1.4-#2, 딥 분석

`lib/heic-to-jpeg.ts:43` — `/usr/bin/sips` macOS 전용 명령어. Linux/Vercel에서 ENOENT 크래시.

**V3 해결**: `sharp`로 HEIC 변환 (`sharp(buffer).toFormat('jpeg')`). 또는 `process.platform` 체크 + 크로스플랫폼 라이브러리.

---

### EXT-08: 파일시스템 스토리지 — 배포 시 사진 소실 [HIGH]

**원본**: R3-Feature4-#11, R3-RISK-07, R3-RISK-11

`storage/before/`, `storage/photoroom/` 로컬 파일시스템 사용. Vercel에서 배포 시 소멸 (**이미 프로덕션 버그**).

기존 `st_products.photos` JSONB URL이 `/api/admin/photos/storage-serve?folder=...` 형식 → 클라우드 전환 후 404.

**V3 해결**: Supabase Storage 전환. 기존 사진 URL 일괄 마이그레이션 스크립트. `process.cwd()/storage/` 참조 전수 제거.

---

## 7. 프론트엔드 및 UI (FE)

### FE-01: 프론트엔드 fetch 에러 처리 누락 [HIGH]

**원본**: R1-#3, 딥 분석

| 파일 | 문제 |
|------|------|
| `useOrderHandlers.ts` | PATCH 실패해도 다음 로직 실행, `res.ok` 체크 없음 |
| `useOrders.ts:64-71` | `updateOrderStatus` 에러 핸들링 전무 |
| `OriginalsTab.tsx:43-52` | catch 블록 없음, unhandled rejection |
| 다수 컴포넌트 | `JSON.parse` try/catch 없음 |

**V3 해결**: `lib/api/client.ts` 전면 활용 + 모든 fetch에 에러 핸들링.

---

### FE-02: AbortController 누락 [HIGH]

**원본**: R2-BUG-12, R2-BUG-13

| 훅 | 문제 |
|----|------|
| `useAdjustment.ts:17-29` | AbortController 없음 → 메모리 릭 |
| `useNotificationHistory.ts:31-56` | 없음 + 디바운스 미정리 → 잘못된 데이터 표시 |

**V3 해결**: 모든 데이터 페칭 훅에 AbortController 표준 패턴 적용.

---

### FE-03: 관리자 간 실시간 동기화 없음 [HIGH]

**원본**: R4-§2.6-#1

폴링/WebSocket/SSE 없음. **모든 레이스 컨디션의 근본 원인(amplifier)**.

**V3 해결**: Supabase Realtime 또는 SWR polling.

---

### FE-04: 모든 어드민 페이지가 `'use client'` [MEDIUM]

**원본**: R1-#10, R3-§5

Server Component 활용 기회 전면 상실. `ConsignmentStats`, `OrderStats`, `TableShell` 등 정적 컴포넌트까지 클라이언트 렌더링.

**V3 해결**: Server vs Client 결정 매트릭스 적용 (R3-§5 참조). `AdminLayout`, `Sidebar`, `StatCard`, `StatusBadge`, `TableShell` → Server Component.

---

### FE-05: inline style 1,061회 vs Tailwind 154회 [MEDIUM]

**원본**: R1-#9, R2-DUP-10

78개 파일에서 inline `style={{}}`. `onMouseEnter`/`onMouseLeave`로 hover 효과 구현 (CSS 대신 JS). 다크모드, 테마, 반응형 불가능.

**V3 해결**: Tailwind v4 전면 전환. 브랜드 컬러/spacing 커스텀 토큰 등록.

---

### FE-06: `alert()`/`confirm()` 남용 [MEDIUM]

**원본**: R1-#13

25+ `alert()`, 6+ `confirm()`. 메인 스레드 블로킹, 스타일링 불가, 팝업 차단기.

**V3 해결**: Toast/Dialog 컴포넌트로 대체.

---

### FE-07: 코드 분할 미적용 [MEDIUM]

**원본**: R1-#11

`ClassifyMatchModal.tsx` (SSE+상태머신), `InspectionModal`, `ConsignmentInspectionModal` — 모달 안 열어도 번들에 포함.

**V3 해결**: `next/dynamic`으로 지연 로딩.

---

### FE-08: 에러 바운더리 부족 [MEDIUM]

**원본**: R1-#14

`error.tsx` 하나만 존재. 정산 워크플로, 사진 분류, 검수 모달 등 기능별 에러 바운더리 없음.

**V3 해결**: 기능별 Error Boundary 추가 (정산/사진/검수).

---

### FE-09: Base64 이미지를 DB에 직접 저장 [HIGH]

**원본**: R1-#8

`useOrderHandlers.ts:83-90` — 가격조정 이미지를 `FileReader.readAsDataURL()`로 Base64 변환 후 DB 저장. 스케일링 시 DB 용량 급증.

**V3 해결**: Supabase Storage에 업로드 → URL만 DB 저장.

---

### FE-10: 더블클릭/더블서밋 취약점 8건 [HIGH]

**원본**: R4-§2.1

모든 프론트엔드 가드는 `disabled={loading}` — 단일 브라우저 세션만 보호.

| 기능 | 영향 | 프론트엔드 가드 |
|------|------|----------------|
| 정산 생성 | **FINANCIAL** | 단일 세션만 |
| 위탁 완료 | DATA_CORRUPTION | 없음 |
| SMS 발송 | DUPLICATE | 단일 세션만 |
| SMS 재발송 | DUPLICATE | 없음 |
| 대량 발송 | DUPLICATE | 없음 |
| 주문 생성 | DUPLICATE | 단일 세션만 |
| 정산 예정 등록 | **FINANCIAL** | 단일 세션만 |
| 지급 시트 다운로드 | UX | 없음 |

**V3 해결**: 서버 측 idempotency key 또는 mutex. `disabled={loading}`은 UX 보조 수단으로만.

---

### FE-11: 정산 워크플로우 세션 로컬 [MEDIUM]

**원본**: R4-§2.6-#2, 딥 분석

`useWorkflow.ts` — React useState로만 관리, 서버 미동기화.

**V3 해결**: 워크플로 상태를 서버 동기화.

---

### FE-12: SSE 버퍼 무한 증가 [MEDIUM]

**원본**: 딥 분석 (프론트엔드)

`ClassifyMatchModal.tsx` — SSE 스트림 버퍼가 무한 증가. 장시간 분류 작업 시 메모리 문제.

**V3 해결**: 버퍼 크기 제한 + 오래된 이벤트 드롭.

---

### FE-13: 대규모 테이블 가상화 미적용 [MEDIUM]

**원본**: 딥 분석 (프론트엔드)

주문/상품/위탁 테이블이 전체 행을 DOM에 렌더링. 500+ 행 시 성능 저하.

**V3 해결**: `react-virtual` 또는 `tanstack-virtual` 적용.

---

## 8. 코드 품질 및 아키텍처 (ARC)

### ARC-01: 브랜드 정규화 4곳 독립 구현 [HIGH]

**원본**: R2-INT-10, R3-§4-A

| 위치 | 범위 | 불일치 |
|------|------|--------|
| `lib/catalog/brand-normalizer.ts` | 80+ 브랜드 | 기본 소스 |
| `photos/match/scoreCalculator.ts` | 12개 로컬 맵 | `볼리올리` vs `보리올리` |
| `admin/orders/search/route.ts` | 20개 한국어→영어 | 검색 전용 |
| `lib/settlement/product-matcher.ts` | 12개 로컬 맵 | 한국어 변형 미지원 |

**V3 해결**: `lib/utils/brand.ts` 단일 파일. 4개 소스 병합.

---

### ARC-02: 카테고리 추론 3곳 독립 구현 [HIGH]

**원본**: R2-INT-09, R3-§4-B

| 함수 | `재킷` | `블레이저` | 기본값 |
|------|--------|-----------|--------|
| `inferCategory()` | `jacket` | `blazer` | `null` |
| `inferCategoryFromModel()` | `outer` | `outer` | (없음) |
| `classifyCategory()` | `outer` | `outer` | `shirt` |

**"라나울 다운 베스트"**: #1=`coat`(다운), #2=`vest`(베스트) → 동일 상품, 다른 분류.

**V3 해결**: `lib/utils/category.ts` 단일 분류기. `CategorySlug` 유니온 타입.

---

### ARC-03: 전화번호 정규화 2곳 충돌 [HIGH]

**원본**: R2-INT-11, R3-§4-C

| 위치 | 동작 |
|------|------|
| `phone-normalizer.ts` | `010-XXXX-XXXX` 포맷, 0접두사 복원 |
| `seller-matcher.ts:98` + `consignments/route.ts:36,155` | 숫자만 strip |

**충돌**: `'1012345678'` ≠ `'01012345678'` → 매칭 실패.

**V3 해결**: `lib/utils/phone.ts` — `normalizePhone()` (저장용) + `digitsOnly()` (비교용).

---

### ARC-04: 코드 길이 100줄 초과 35+건 [MEDIUM]

**원본**: R2-§2-B

| 파일 | 라인수 |
|------|-------|
| `consignments/[id]/route.ts` | 496 |
| `useWorkflowHandlers.ts` | 418 |
| `MeasurementStep.tsx` | 375 |
| `consignments/route.ts` | 357 |
| `ManualMatchPanel.tsx` | 344 |
| `ClassifyMatchModal.tsx` | 342 |
| `product-matcher.ts` | 313 |
| `queue-settlements/route.ts` | 289 |
| ... (나머지 27건) | 100-273 |

**V3 해결**: 역할별 분리. 라우트 핸들러 → 서비스 위임. 컨트롤러 패턴.

---

### ARC-05: 에러 응답 형태 불일치 [MEDIUM]

**원본**: R2-§2-C

| 유형 | 건수 |
|------|-----|
| `{ error }` (교리 위반) | 44개 라우트 |
| `{ success: false, error }` (교리 준수) | 6개 라우트만 |
| catch에 `console.error` 없음 | 30+ 라우트 |
| try/catch 없음 | 9개 라우트 |

**V3 해결**: `lib/api/response.ts`의 `ok()`, `err()` 전면 채택.

---

### ARC-06: WHY/HOW/WHERE 헤더 누락 ~40파일 [MEDIUM]

**원본**: R2-§2-A

`app/` 26파일, `app/api/` 8파일, `lib/` 14파일, `components/` 1파일.

**V3 해결**: 모든 파일에 교리 헤더 적용.

---

### ARC-07: 로깅 규칙 위반 [LOW]

**원본**: R2-§2-D

| 유형 | 건수 |
|------|-----|
| 로깅 전혀 없음 | 23개 라우트 |
| `[api-name]` 접두사 누락 | 3+ |
| `시작`/`완료` 중 하나만 | 6+ |

**V3 해결**: 모든 라우트 `[api-name] 시작/완료/실패` 패턴.

---

### ARC-08: `any` 타입 및 타입 우회 [MEDIUM]

**원본**: R2-§2-E, R1-#12

| 유형 | 건수 |
|------|-----|
| 직접 `any` | 3건 |
| `as unknown` | 10건 |
| `as string` | 12건 |
| 인라인 타입 정의 | 다수 |

**근본 원인**: Supabase JOIN 결과 타입 추론 실패.

**V3 해결**: `supabase gen types` → 자동생성 타입. 공유 API 응답 타입.

---

### ARC-09: `lib/api` 유틸 미사용 [MEDIUM]

**원본**: R1-#17, R2-§2-F

- `lib/api/client.ts` — 타임아웃, Sentry, 타입 응답 처리 → **프론트엔드에서 0회 사용**
- `lib/api/response.ts` — `errorResponse()`, `successResponse()` → **6개 라우트만 사용**

**V3 해결**: `api/client.ts` 제네릭 `api.get<T>()` 확장. `response.ts` 전면 채택.

---

### ARC-10: 코드 중복 10패턴 [MEDIUM]

**원본**: R2-§5

| # | 중복 | 건수 |
|---|------|-----|
| DUP-01 | 모달 오버레이 스캐폴드 | 11개 파일 |
| DUP-02 | StatusBadge 독립 구현 | 4개 |
| DUP-03 | 에러 응답 패턴 복붙 | 32곳 |
| DUP-04 | InspectionModal ↔ HoldModal | ~80줄 |
| DUP-05 | 사진 업로드 블록 동일 복사 | 2곳 |
| DUP-06 | `formatCurrency()` | 3곳 |
| DUP-07 | `parseInt(customPrice.replace())` | 6곳 |
| DUP-08 | 주문번호 생성 | 2곳 |
| DUP-09 | 골드 그래디언트 버튼 | 2곳 |
| DUP-10 | inline style vs Tailwind 혼재 | 전체 |

**V3 해결**: 공유 컴포넌트/유틸 통합. `ModalLayout.tsx` 전면 채택. `lib/utils/format.ts` 통합.

---

### ARC-11: 설정/메타 미비 [LOW]

**원본**: R1-#15

- `layout.tsx` — `lang="en"` (한국어 앱), metadata "Create Next App"
- ESLint/Prettier 미설정
- `xlsx: "^0.18.5"` — 2022년 버전

---

### ARC-12: 접근성(A11Y) 미비 [LOW]

**원본**: R1-#16

ARIA 라벨 전무, 모달 `aria-modal`/포커스 트랩 없음, `<img>` `loading="lazy"` 없음, `next/image` 미사용.

---

### ARC-13: `sharp` 네이티브 바이너리 호환 문제 [MEDIUM]

**원본**: R3-RISK-08

`sharp` 플랫폼별 네이티브 바이너리 필요. `@imgly/background-removal-node` WASM + `sharp` + `xlsx` + `@anthropic-ai/sdk` 합산 시 Vercel 50MB 압축 함수 제한 초과 가능.

**V3 해결**: 번들 크기 모니터링. 불필요 의존성 정리.

---

## 9. 딥 분석 신규 발견 (NEW)

이전 4차 리서치에서 발견되지 않은, 딥 분석 에이전트(3개 병렬)를 통해 새로 발견된 항목.

### 정산 모듈 딥 분석 (9파일, 1,070 LOC)

| # | 파일 | 발견 | 심각도 |
|---|------|------|--------|
| NEW-01 | `condition-mapper.ts` | 하드코딩된 조건 매핑이 엣지 케이스 누락 (예: "세탁 있음" vs "세탁필요") | MEDIUM |
| NEW-02 | `confirm-parser.ts` | `errors` 배열이 선언만 되고 **한 번도 push되지 않음** — 파싱 에러 감지 불가 | HIGH |
| NEW-03 | `excel-exporter.ts` | 통화 포맷팅 일관성 없음 (일부 `toLocaleString`, 일부 직접 포맷) | LOW |
| NEW-04 | `naver-settle-parser.ts` | 판매자 이름에 하이픈 포함 시 (`김-민수`) 잘못된 파싱 | HIGH |
| NEW-05 | `product-classifier.ts` | 5개 카테고리만 분류 가능 — 나머지는 'etc'로 일괄 처리 | MEDIUM |
| NEW-06 | `seller-matcher.ts` | 전화번호 매칭 시 0접두사 탈락 미처리 (R2-INT-11 확장) | HIGH |

### 사진/외부서비스 딥 분석 (27파일, 3,844 LOC)

| # | 파일 | 발견 | 심각도 |
|---|------|------|--------|
| NEW-07 | `photo-classify/` 전체 | Claude API 재시도 전략 부재 — 단일 실패로 전체 분류 중단 | HIGH |
| NEW-08 | `photo-editing/photo-editor.ts` | Base64 인코딩된 이미지를 메모리에 이중 복사 (원본 Buffer + Base64 문자열) | MEDIUM |
| NEW-09 | `pricing/naver-shopping.ts` | JSON 응답 파싱에 regex 사용 (`/"hprice":"(\d+)"/`) — 비정상 JSON에 취약 | HIGH |
| NEW-10 | `export/bulk-export-naver/route.ts` | Puppeteer 스크립트가 메모리 해제(`browser.close()`) 실패 시 좀비 프로세스 | MEDIUM |
| NEW-11 | `measurement-card.ts` | 이미지 경로에 사용자 입력 직접 사용 — Path traversal 가능성 | HIGH |
| NEW-12 | `match/services/scoreCalculator.ts` | 12개 로컬 브랜드맵이 메인 맵과 분리되어 drift 위험 | MEDIUM |

### 프론트엔드/API 딥 분석 (12 컴포넌트 + 라우트)

| # | 파일 | 발견 | 심각도 |
|---|------|------|--------|
| NEW-13 | `useWorkflowHandlers.ts` | 상태 정리 로직에 레이스 컨디션 — setTimeout 콜백이 이미 변경된 상태 참조 | CRITICAL |
| NEW-14 | 다수 컴포넌트 | `setTimeout`으로 배치 처리 시 언마운트 후 콜백 실행 → 메모리 릭 | HIGH |
| NEW-15 | 다수 컴포넌트 | fetch 응답에 `res.ok` 체크 후 `.json()` 실패 케이스 미처리 | HIGH |
| NEW-16 | `ClassifyMatchModal.tsx` | SSE 이벤트 버퍼 무제한 증가 — 장시간 분류 시 메모리 이슈 | MEDIUM |
| NEW-17 | 다수 | `JSON.parse()` 호출에 try/catch 없음 | MEDIUM |
| NEW-18 | 다수 테이블 | 가상화(virtualization) 미적용 — 대량 행 시 렌더링 성능 저하 | MEDIUM |

---

## 10. 복합 실패 시나리오

단일 이슈가 아닌, **여러 이슈가 결합하여 발생하는 카탈스트로피 시나리오**.

### 시나리오 1: "유령 이중 정산" (SEC-01 + FIN-01 + FIN-02)

```
조건: 미들웨어 미작동(SEC-01) + 정산 비원자적(FIN-01) + 두 파이프라인 공존(FIN-02)
경로:
1. 관리자 A: Pipeline A로 정산 생성 (generate/route.ts)
2. 외부 공격자: URL 추측으로 Pipeline B 직접 호출 (queue-settlements)
3. 두 경로 모두 인증 없이 성공 → 동일 매출 이중 지급
영향: 금전적 손실 (양 파이프라인 합산)
탐지: 판매자가 초과 지급 보고 전까지 미발견 (감사 로그 미존재)
```

### 시나리오 2: "판매자 수백 명 생성" (DAT-03 + DAT-09)

```
조건: sellers.phone UNIQUE 없음(DAT-03) + 동시 Excel 업로드(DAT-09)
경로:
1. Admin A: 200행 Excel 업로드 시작
2. Admin B: 동시에 동일 Excel 업로드
3. per-request 인메모리 캐시 → 양쪽 모두 새 판매자 생성
4. sellers.phone UNIQUE 없으므로 DB에서도 미차단
영향: 판매자 수백 명 중복 → 정산 매칭 혼선 → 수동 정리 수일
```

### 시나리오 3: "영구 복구 불가 위탁" (DAT-04 + DAT-08)

```
조건: Stuck-consignment(DAT-04) + 상태 전환 레이스(DAT-08)
경로:
1. Admin A: 위탁 "완료" 처리 시작 (Step 3에서 st_products INSERT 성공)
2. Admin B: 동시에 "거절"로 상태 변경 (B의 UPDATE가 먼저 커밋)
3. Admin A: Step 5(status UPDATE) 시 '거절' 상태라 예상과 불일치 → 실패
4. st_products 레코드 존재하지만 consignment은 '거절' 상태
5. 재시도 시 "상품번호 이미 존재" 에러 → 영구 복구 불가
영향: 해당 위탁 접수건 영구 처리 불가, DB 수동 정리 필요
```

### 시나리오 4: "조용한 데이터 절삭" (DAT-01 + FIN-01)

```
조건: 1000행 절삭(DAT-01) + 정산 생성(FIN-01)
경로:
1. 재고가 1000건 초과 시 sale-detector가 1000건만 조회
2. 나머지 위탁 상품의 판매가 감지되지 않음
3. 해당 상품은 영구적으로 미판매 상태 유지
4. 판매자에게 정산 미지급 → 클레임
영향: 비즈니스 규모 성장 시 자동으로 발생하는 시한폭탄
```

### 시나리오 5: "무인증 서버 장악" (SEC-01 + SEC-03 + RUN-01)

```
조건: 미들웨어 미작동(SEC-01) + Path Traversal(SEC-03)
경로:
1. 공격자: /api/admin/photos/upload에 인증 없이 접근
2. productId=../../ + file.name=.env → 서버 환경변수 파일 덮어쓰기
3. 또는 productId=../../app/api + malicious route 설치
영향: 서버 완전 장악
```

### 시나리오 6: "SMS 블랙홀" (EXT-02 + RUN-06 + FIN-08)

```
조건: dev mode 가짜 성공(EXT-02) + SMS 미발송(RUN-06) + paidMessage 데드 코드(FIN-08)
경로:
1. 환경변수 미설정으로 SMS dev mode 활성화
2. 가격 조정 시 console.log만 (실제 SMS 미발송)
3. 정산 지급 시 paidMessage 데드 코드 (SMS 미트리거)
4. 시스템은 모든 SMS가 성공이라고 기록
영향: 판매자가 어떤 알림도 받지 못하지만 시스템 로그는 정상
```

### 시나리오 7: "PostgREST 인젝션 → 데이터 유출" (SEC-04 + SEC-01)

```
조건: PostgREST 필터 인젝션(SEC-04) + 미들웨어 미작동(SEC-01)
경로:
1. 공격자: /api/admin/products?search=test%25,seller_id.not.is.null
2. 인증 없이 접근 (미들웨어 미작동)
3. .or() 필터 주입으로 숨겨진 판매자 정보/가격 정보 노출
4. 정교한 쿼리로 settlement 데이터까지 접근 가능
영향: 전체 거래 데이터 유출
```

---

## 11. V3 방어 체크리스트

### 11-A: 보안 (즉시 — Day 1)

```
□ proxy.ts → middleware.ts 리네이밍 + 함수명 middleware()
□ 모든 /api/admin/* 라우트에 requireAdmin() 인라인 가드
□ ADMIN_ID/ADMIN_PASSWORD requireEnv() 필수화
□ 비밀번호 bcrypt/argon2 해싱
□ 모든 .or() 문자열 보간 → 파라미터화 메서드 전환 (4곳)
□ 모든 파일 경로에 path.basename() + startsWith() (3곳)
□ Public API에서 Service Role Key 제거 (2곳)
□ 환경변수 전수 requireEnv() 등록 (10건)
```

### 11-B: 금전적 정확성 (최우선 — Day 1-2)

```
□ settlement_queue.match_id UNIQUE 제약 추가
□ 정산 생성 Supabase RPC FOR UPDATE 잠금
□ 두 파이프라인 → 1개 통합
□ 커미션 레이트 단일 소스 (5곳 → 1곳)
□ 타임존 KST 일관 사용
□ sale_price Zod 검증 (> 0, not null, not NaN)
□ commission_rate 범위 (0 < rate < 1)
□ 부동소수점 → Math.round() 적용
□ product-matcher 0.3 → 0.85 임계값 수정
```

### 11-C: 데이터 무결성 (우선 — Day 2-3)

```
□ 5개 UNIQUE 제약 추가 (sellers.phone, sellers.seller_code, settlement_queue.match_id, return_shipments.consignment_id, st_products.product_number)
□ 기존 중복 행 정리 마이그레이션
□ 3개 비원자적 작업 → RPC 트랜잭션
□ 모든 상태 UPDATE에 .eq('status', expected) 조건
□ Promise.all 결과 검사 (3곳)
□ Supabase 에러 확인 (9곳)
□ 1000행 절삭 → 페이지네이션 강제
□ .in() 100개 청크 분할
□ toStr() || → ?? 변경
```

### 11-D: 런타임 안정성 (기반 — Day 3-4)

```
□ Zod 스키마로 모든 API 입력 검증 (req.json 크래시 12건 해결)
□ Non-null assertion ! 전면 제거 (3곳)
□ 모든 parseInt/Number에 isNaN 검증 (7곳)
□ 모든 외부 서비스 호출에 try/catch
□ 모든 fetch에 AbortController + 30초 타임아웃
□ fs 작업 비동기화
□ HEIC 변환 플랫폼 체크
□ Claude API content 배열 길이 검증
□ 네이버 쇼핑 res.json() try/catch
```

### 11-E: 코드 품질 (점진적)

```
□ 브랜드 정규화 4곳 → 1곳 통합
□ 카테고리 추론 3곳 → 1곳 통합
□ 전화번호 정규화 2곳 → 1곳 통합
□ 주문번호 생성 2곳 → 1곳 통합
□ 모달/StatusBadge/에러응답 중복 제거
□ 100줄 제한 적용 (35+파일)
□ WHY/HOW/WHERE 헤더 (40+파일)
□ 교리 에러 응답 형태 통일 (44라우트)
□ 교리 로깅 규칙 적용 (23라우트)
□ any/unknown 타입 제거
```

### 11-F: 프론트엔드 (점진적)

```
□ inline style → Tailwind 전환 (1,061회)
□ alert()/confirm() → Toast/Dialog
□ use client → Server Component 분리
□ next/dynamic 코드 분할
□ AbortController 표준화
□ 에러 바운더리 추가
□ 테이블 가상화
□ Base64 → Storage URL
□ 관리자 간 실시간 동기화
```

### 11-G: DB 마이그레이션 SQL

```sql
-- 1. UNIQUE 제약
ALTER TABLE settlement_queue ADD CONSTRAINT uq_queue_match UNIQUE (match_id);
ALTER TABLE sellers ADD CONSTRAINT uq_sellers_phone UNIQUE (phone);
ALTER TABLE sellers ADD CONSTRAINT uq_sellers_code UNIQUE (seller_code);
ALTER TABLE return_shipments ADD CONSTRAINT uq_return_consignment UNIQUE (consignment_id);
ALTER TABLE st_products ADD CONSTRAINT uq_st_products_number UNIQUE (product_number);

-- 2. 정산 RPC (원자적 트랜잭션)
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
    WHERE id = ANY(p_sold_item_ids) AND settlement_status = 'pending';
  RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql;

-- 3. 주문 생성 RPC
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_order_data jsonb, p_items jsonb[]
) RETURNS uuid AS $$
DECLARE v_order_id uuid;
BEGIN
  INSERT INTO orders (...) VALUES (...) RETURNING id INTO v_order_id;
  INSERT INTO order_items (order_id, ...)
    SELECT v_order_id, ... FROM unnest(p_items);
  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;

-- 4. 위탁 완료 RPC
CREATE OR REPLACE FUNCTION complete_consignment(
  p_consignment_id uuid, p_product_data jsonb, p_order_data jsonb
) RETURNS void AS $$
BEGIN
  INSERT INTO st_products (...) VALUES (...);
  INSERT INTO orders (...) VALUES (...);
  INSERT INTO order_items (...) VALUES (...);
  UPDATE consignment_requests SET status = 'completed' WHERE id = p_consignment_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 12. 교차 참조 맵

각 이슈가 어떤 원본 리서치에서 발견되었는지 추적.

### CRITICAL (11건)

| ID | 이슈 | R1 | R2 | R3 | R4 | 딥 |
|----|------|:--:|:--:|:--:|:--:|:--:|
| SEC-01 | 미들웨어 미작동 | #1 | CRIT-01 | **§1** | — | — |
| SEC-02 | ADMIN_ID 인증 우회 | — | — | — | **§4.1** | — |
| SEC-03 | Path Traversal | — | **CRIT-03** | — | §4.4 | — |
| SEC-04 | PostgREST 인젝션 | — | — | — | **§4.3** | — |
| SEC-05 | Public Service Role Key | **#2** | — | — | §4.8 | — |
| FIN-01 | 정산 이중 생성 | — | **CRIT-02** | — | §2.1 | — |
| FIN-02 | 두 정산 파이프라인 | — | **CRIT-04** | §4-F | §2.7 | — |
| FIN-03 | match_id UNIQUE 없음 | — | — | — | **§2.7** | — |
| DAT-01 | 1000행 절삭 | — | — | RISK-06 | **§4.8** | — |
| DAT-02 | ConsignmentStatus 3v7 | — | **CRIT-05** | RISK-01 | — | — |
| RUN-01 | req.json PUBLIC 크래시 | — | — | — | **§1.1** | — |

### HIGH (55건) — 원본 참조만 표기

| 카테고리 | ID 범위 | 건수 | 주요 원본 |
|---------|---------|------|----------|
| 보안 | SEC-06~08 | 3 | R3, R4 |
| 정산 | FIN-04~11 | 8 | R2, R3 |
| 데이터 | DAT-03~09, 13, 16 | 9 | R2, R3, R4 |
| 런타임 | RUN-02~09 | 8 | R1, R2, R4 |
| 외부서비스 | EXT-01~02, 04~05, 07~08 | 6 | R3, R4, 딥 |
| 프론트엔드 | FE-01~03, 09~10 | 5 | R1, R4, 딥 |
| 아키텍처 | ARC-01~03 | 3 | R2, R3 |
| 딥 분석 신규 | NEW-02,04,06,07,09,11,13~15 | 9 | 딥 분석 전용 |
| **소계** | | **51** | |

### MEDIUM (41건) / LOW (11건) — 도메인별 집계

| 도메인 | MEDIUM | LOW |
|--------|--------|-----|
| 정산 | 2 (FIN-09,12) | 0 |
| 데이터 | 5 (DAT-10~12,14~15) | 0 |
| 외부서비스 | 2 (EXT-03,06) | 0 |
| 프론트엔드 | 7 (FE-04~08,11~13) | 0 |
| 아키텍처 | 5 (ARC-04~06,08~09,13) | 3 (ARC-07,11,12) |
| 코드 중복 | 1 (ARC-10) | 0 |
| 딥 분석 신규 | 6 (NEW-01,05,08,10,12,16~18) | 1 (NEW-03) |
| **소계** | **28+** | **4+** |

---

## 13. 전체 통계

### 고유 이슈 심각도별 분포

| 심각도 | 건수 | 대표 이슈 |
|--------|-----|---------|
| **CRITICAL** | 11 | 미들웨어 미작동, 이중 정산, Path Traversal, PostgREST 인젝션, 인증 우회, 1000행 절삭 |
| **HIGH** | 55 | 타임존 혼용, 커미션 분산, UNIQUE 누락, Stuck-consignment, 파일시스템 소실, req.json 크래시 |
| **MEDIUM** | 41 | 주문 상태 머신 없음, inline style, 코드 길이 위반, 카테고리 불일치, SSE 버퍼 |
| **LOW** | 11 | 로깅 누락, 접근성, 메타데이터, 부동소수점 |
| **합계** | **~118 고유** | (4개 보고서 원본 합산 237건에서 중복 제거) |

### 도메인별 분포

| 도메인 | CRIT | HIGH | MED | LOW | 합계 |
|--------|------|------|-----|-----|------|
| 보안/인증 (SEC) | 5 | 3 | 0 | 0 | 8 |
| 정산/금전 (FIN) | 3 | 8 | 2 | 0 | 13 |
| 데이터 무결성 (DAT) | 2 | 9 | 5 | 0 | 16 |
| 런타임 안정성 (RUN) | 1 | 8 | 0 | 0 | 9 |
| 외부 서비스 (EXT) | 0 | 6 | 2 | 0 | 8 |
| 프론트엔드/UI (FE) | 0 | 5 | 7 | 0 | 12 |
| 코드 품질 (ARC) | 0 | 3 | 6 | 3 | 12 |
| 딥 분석 신규 (NEW) | 0 | 9 | 6 | 1 | 16 |
| 복합 시나리오 | — | — | — | — | 7 |
| **합계** | **11** | **51+** | **28+** | **4+** | **~101+** |

### V3 구현 우선순위 (시간순)

| 순위 | 범위 | 건수 | 핵심 작업 |
|------|------|------|----------|
| 1 | 보안 복원 | 8건 | middleware.ts, requireAdmin(), 환경변수, Path Traversal, PostgREST |
| 2 | 금전적 정확성 | 13건 | RPC 트랜잭션, UNIQUE 제약, 커미션 통합, 타임존, Zod 검증 |
| 3 | 데이터 안전성 | 16건 | Stuck-consignment, 상태 머신, Promise.all, Supabase 에러 확인 |
| 4 | 런타임 방어 | 9건 | Zod 입력 검증, NaN 검증, try/catch, AbortController |
| 5 | 외부 서비스 | 8건 | 타임아웃, dev mode 제거, HEIC 크로스플랫폼, JSON 파싱 보호 |
| 6 | 스토리지 전환 | 3건 | 파일시스템 → Supabase Storage, URL 마이그레이션 |
| 7 | 코드 품질 | 12건 | 중복 통합, 100줄 제한, 타입 안전성, 교리 준수 |
| 8 | 프론트엔드 | 12건 | Tailwind, Server Component, alert→Toast, 코드 분할 |

---

*이 합본 보고서는 4개 리서치 보고서(v2reserch1~v4reserch4)와 3개 딥 분석 에이전트 결과를 3라운드에 걸쳐 교차검증하고, 중복을 제거하며, 복합 실패 시나리오를 시뮬레이션하여 작성되었습니다.*

*원본 보고서의 상세 내용(82개 핸들러 에러 테이블, 개선안별 3중 리스크 검증, 5레이어 아키텍처 블루프린트, 12개 구현 후 리스크)은 해당 원본을 참조하십시오.*
