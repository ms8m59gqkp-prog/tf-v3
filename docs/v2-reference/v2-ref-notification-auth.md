# V2 참조: 알림·인증 도메인 (구현용)

> V3 구현 시 실시간 참조용 — V2 파일 경로, 코드 스니펫, V3 매핑

## V2 파일 인벤토리

### SMS/알림 라이브러리
| V2 파일 | 줄 수 | 역할 |
|---------|-------|------|
| `lib/notification/sms.ts` | 68 | Solapi SMS 래퍼 |
| `lib/notification/templates.ts` | 133 | 6개 SMS 템플릿 |
| `lib/notification/index.ts` | 129 | 자동 알림 + 수동 발송 + DB 로깅 |

### 알림 API 라우트
| V2 파일 | 줄 수 | 역할 |
|---------|-------|------|
| `api/admin/notifications/send-sms/route.ts` | 46 | SMS 발송 API |
| `api/admin/notifications/route.ts` | 84 | GET 이력 조회 (필터+페이지네이션+검색) |
| `api/admin/notifications/bulk-send/route.ts` | 66 | POST 대량 발송 (sellerIds[]) |
| `api/admin/notifications/resend/route.ts` | 41 | POST 재발송 (logId) |

### 알림 UI 컴포넌트
| V2 파일 | 줄 수 | 역할 |
|---------|-------|------|
| `app/admin/notifications/page.tsx` | 56 | 2탭 메인 페이지 (SendTab + HistoryTab) |
| `app/admin/notifications/types.ts` | 34 | NotificationLog, Tab, SendStep, TargetMode 타입 |
| `app/admin/notifications/constants.ts` | 25 | EVENT_OPTIONS, STATUS_OPTIONS 필터 옵션 |
| `components/SendTab.tsx` | 276 | 프로모션 발송 3단계 (target→compose→confirm) |
| `components/HistoryTab.tsx` | 243 | 발송 이력 테이블 + 필터 |
| `components/ManualSendModal.tsx` | 383 | 수동 발송 3단계 모달 |
| `components/LogDetailModal.tsx` | 127 | 상세 로그 + 재발송 버튼 |
| `components/shared.tsx` | 117 | WorkflowIndicator, EventBadge, StatusBadge |
| `hooks/useNotificationHistory.ts` | 100 | 이력 조회 훅 (디바운스 300ms) |
| `hooks/usePromotionSend.ts` | 85 | 프로모션 발송 로직 훅 |

### 인증/보안
| V2 파일 | 줄 수 | 역할 |
|---------|-------|------|
| `lib/auth.ts` | 109 | HMAC-SHA256 세션 서명/검증 |
| `proxy.ts` | 75 | Edge 미들웨어 (인증 + 레이트리밋) |
| `lib/ratelimit.ts` | 69 | Upstash Redis 슬라이딩 윈도우 |
| `api/admin/auth/login/route.ts` | 48 | 로그인 API |
| `api/admin/auth/logout/route.ts` | 24 | 로그아웃 API |

### 공통 유틸
| V2 파일 | 줄 수 | 역할 |
|---------|-------|------|
| `lib/supabase/client.ts` | 24 | 브라우저 Supabase (RLS) |
| `lib/supabase/admin.ts` | 28 | 서버 Supabase (RLS 우회) |
| `lib/env.ts` | 33 | 환경변수 검증 |
| `lib/api/client.ts` | 109 | fetch 래퍼 (api.get/post/patch/delete + APIError + 30초 타임아웃) |
| `lib/api/response.ts` | 27 | successResponse, errorResponse, validationError, unauthorized 헬퍼 |
| `lib/photoroom.ts` | 74 | PhotoRoom API |
| `lib/naver-shopping.ts` | 83 | 네이버 쇼핑 API |

### 택배 시스템
| V2 파일 | 줄 수 | 역할 |
|---------|-------|------|
| `lib/courier/index.ts` | 29 | 진입점 (getCourierProvider, getWarehouseInfo) |
| `lib/courier/types.ts` | 34 | ShipmentRequest, ShipmentResult, CourierProvider 인터페이스 |
| `lib/courier/cj-logistics.ts` | 60 | CJ대한통운 (미구현 — TODO) |
| `lib/courier/manual-provider.ts` | 29 | 수동 배송 처리 (폴백) |

### 공통 UI 컴포넌트
| V2 파일 | 줄 수 | 역할 |
|---------|-------|------|
| `app/admin/components/StatCard.tsx` | 59 | 통계 카드 (title, value, subtitle, trend) |
| `app/admin/components/StatusBadge.tsx` | 91 | 15개 상태 색상 매핑 뱃지 |
| `app/admin/components/TableShell.tsx` | 114 | 제네릭 테이블 (Column<T>[], rows, keyField) |

### 헬스체크
| V2 파일 | 줄 수 | 역할 |
|---------|-------|------|
| `api/health/route.ts` | 21 | Liveness probe (status, timestamp, uptime) |
| `api/ready/route.ts` | 50 | Readiness probe (Supabase + Redis 확인) |

### 로그인 UI
| V2 파일 | 줄 수 | 역할 |
|---------|-------|------|
| `app/admin/login/page.tsx` | 286 | 로그인 페이지 (금색 테마, blur 카드) |

---

## 알림 UI 워크플로우

### 알림 관리 페이지 (2탭 구조)

**Tab 1: SendTab — 프로모션 발송 3단계**

| 단계 | 이름 | UI 요소 |
|------|------|---------|
| 1 | target | 모드 선택 ("all" 전체 / "marketing" 광고 동의자), 대상 수 표시 |
| 2 | compose | textarea + 바이트 카운트 (>90 → LMS), 미리보기 |
| 3 | confirm | 요약 + confirm() 재확인 → 발송 → "성공 N건 / 실패 M건" → 3초 후 HistoryTab |

**Tab 2: HistoryTab — 발송 이력**

필터 바:
- Status 드롭다운: 전체 | 발송완료 | 실패
- Event 드롭다운: 전체 | 수령확인 | 검수완료 | 보류 | 반려 | 판매 | 정산 | 수동 | 프로모션
- 검색 (디바운스 300ms): 셀러명, 연락처, 상품번호, 메시지 내용

테이블 7열: 일시 | 발송단계(EventBadge) | 상품번호 | 셀러 | 전화번호 | 메시지(50자 생략) | 상태(StatusBadge)

행 클릭 → LogDetailModal (상세 + 재발송 버튼[실패건만])

**ManualSendModal — 수동 발송 3단계**

| 단계 | 이름 | UI 요소 |
|------|------|---------|
| 1 | select | 셀러 검색 + 체크박스 목록 + 전체 선택 + 광고동의 태그 |
| 2 | compose | textarea (6줄) + 바이트/자 카운트 |
| 3 | confirm | 요약 + 미리보기(150px) → 발송 → "성공/실패" → 2초 후 자동 종료 |

### 대량 발송 API (bulk-send)

```
POST /api/admin/notifications/bulk-send
Body: { sellerIds: string[], message: string, triggerEvent: TriggerEvent }
Response: { sent: 10, failed: 2, skipped: 0, errors: ["셀러명(010-...): 사유"] }
```
- 셀러 조회 → 전화번호 필터 → 순차 발송 (Solapi 속도 제한 대응)

### 이력 조회 API

```
GET /api/admin/notifications?status=sent&trigger_event=received&search=...&page=1&per_page=30
```
- 검색 로직: 전화번호(숫자3자리+) OR 메시지(ilike) OR 셀러명(sellers→ilike) OR 상품번호(consignment_requests→ilike)
- 응답: { logs[], total, page, per_page }

### 재발송 API

```
POST /api/admin/notifications/resend
Body: { logId: string }
```
- 원본 로그 조회 → 동일 파라미터로 재발송 (trigger_event 유지)

---

## SMS 알림 시스템

### Solapi SMS 래퍼 (sms.ts)

```typescript
// API: Solapi (CoolSMS)
// 환경변수: COOLSMS_API_KEY, COOLSMS_API_SECRET, SENDER_PHONE
// 자동 LMS 변환: 90바이트 초과 시
// 개발 모드: API 키 없으면 콘솔 로깅만

interface SmsSendResult {
  success: boolean
  messageId?: string
  statusCode?: string
  error?: string
}

function isSmsAvailable(): boolean  // API 키 설정 여부
function sendSms(to: string, message: string): Promise<SmsSendResult>
```

### SMS 템플릿 6종 (templates.ts)

| 이벤트 | 함수명 | 파라미터 |
|--------|--------|----------|
| 수령 확인 | `receivedMessage` | (productName) |
| 검수 완료 | `completedMessage` | (productName) |
| 보류(가격조정) | `holdMessage` | (productName, reasonMsg, adjustmentUrl) |
| 판매 완료 | `soldMessage` | (productName, saleDate, saleAmount) |
| 대금 지급 | `paidMessage` | ({sellerName, items[], totalPayout, payoutDate}) |
| 반려 | `rejectedMessage` | (productName, reasonMsg, trackingNumber?) |

**업체 전화번호**: `010-6644-6190` (하드코딩)

### 알림 트리거 (index.ts)

```typescript
type TriggerEvent = 'received' | 'completed' | 'on_hold' | 'rejected' |
                    'sold' | 'paid' | 'custom' | 'promotion'

// 자동 트리거: 상태 변경 시 자동 SMS
function notifyStatusChange(consignmentId, event: 'received'|'completed'): Promise<NotifyResult>

// 수동 발송: 관리자가 직접 SMS
function sendAndLog(params): Promise<NotifyResult>

// DB 로깅: notification_logs 테이블에 기록
function logNotification(...)
```

---

## 인증 시스템

### HMAC-SHA256 세션 (auth.ts)

```typescript
// 세션 TTL: 7일
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000

interface SessionPayload {
  userId: string    // 'admin'
  email: string     // ADMIN_ID
  createdAt: number
  expiresAt: number
}

// 서명: payload → base64 → HMAC-SHA256 → token = base64.signature
function signSession(userId: string, email: string): string

// 검증: timingSafeEqual + 만료 확인
function verifySession(token: string): SessionPayload | null

// TTL 조회
function getSessionTTL(payload: SessionPayload): number
```

### 쿠키 설정 (proxy.ts)

```typescript
cookie = {
  name: 'admin_session',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 604800  // 7일 (초)
}
```

### 레이트 리밋 (ratelimit.ts)

```typescript
// 알고리즘: 슬라이딩 윈도우 (Upstash Redis)
loginRateLimiter:     5회 / 1분  (IP 기반,  prefix: 'ratelimit:login')
adminApiRateLimiter: 100회 / 1분 (세션 기반, prefix: 'ratelimit:admin-api')
publicApiRateLimiter: 10회 / 1분 (IP 기반,  prefix: 'ratelimit:public-api')

// Redis 미설정 시 null 반환 (개발 모드 리밋 비활성)
```

### 로그인 프로세스

```
1. Rate limit check (5/min, IP)
2. req.body: { id, password }
3. ADMIN_ID/ADMIN_PASSWORD 환경변수와 비교 (평문)
4. signSession('admin', id)
5. Set-Cookie: admin_session (httpOnly, strict, 7일)
6. 응답: { success: true }
```

**V2 한계**:
- 단일 관리자 계정 (환경변수 기반)
- 평문 비밀번호 비교 (해싱 없음)
- 서버사이드 세션 무효화 불가 (HMAC 기반)

---

## 택배 시스템 (courier/)

### 프로바이더 패턴

```typescript
// lib/courier/index.ts
getCourierProvider(): CourierProvider
// CJ_API_KEY 환경변수 있으면 → CjLogisticsProvider
// 없으면 → ManualCourierProvider (폴백)

getWarehouseInfo(): { name: '트레이딩 플로어', phone: '010-6644-6190', zipcode: '', address: '' }
```

### CJ대한통운 (cj-logistics.ts) — 미구현
- `isAvailable()`: CJ_API_KEY, CJ_API_SECRET, CJ_CUSTOMER_CODE 확인
- `requestPickup()`: 항상 `{ success: false, error: 'CJ API 구현 대기 중...' }`
- 추적 URL: `https://www.cjlogistics.com/ko/tool/parcel/tracking#parcel/detail/{trackingNumber}`

### 수동 배송 (manual-provider.ts) — 현재 사용
- `isAvailable()`: 항상 true
- `requestPickup()`: `{ success: true, apiRequestId: 'MANUAL_' + timestamp }`
- trackingNumber: undefined (추적 불가)

### ShipmentRequest 타입
```typescript
{
  senderName, senderPhone, senderZipcode, senderAddress,
  recipientName, recipientPhone, recipientZipcode?, recipientAddress,
  paymentType: 'prepaid' | 'cod',
  parcelInfo?, memo?
}
```

---

## API 클라이언트 (lib/api/client.ts)

```typescript
// 제네릭 fetch 래퍼
apiClient<T>(url, options): Promise<T>
// - 타임아웃: 30초 (AbortController)
// - 에러: APIError { message, status, data }

// 헬퍼
api.get<T>(url, options)
api.post<T>(url, body, options)
api.patch<T>(url, body, options)
api.delete<T>(url, options)
```

### API 응답 헬퍼 (lib/api/response.ts)
```typescript
successResponse<T>(data, status = 200)  // { success: true, data }
errorResponse(error, status = 500)       // { success: false, error }
validationError(msg)                     // status 400
unauthorized(msg = '인증이 필요합니다')  // status 401
```

---

## 공통 UI 컴포넌트

### StatCard
```typescript
Props: { title: string, value: string|number, subtitle?: string, trend?: { value: number, label: string } }
// trend.value >= 0 → 초록 ↑ | < 0 → 빨강 ↓
```

### StatusBadge
15개 상태-색상 매핑:
- NEW(파랑), INSPECTING(노랑), PRICED(보라), APPROVED(초록), SHIPPED(인디고), DELIVERED(청록)
- COMPLETED(회색), SETTLED(에메랄드), HOLD(빨강), pending(노랑), confirmed(파랑)
- paid(초록), waiting(회색), approved(초록), rejected(빨강)

### TableShell<T> (제네릭)
```typescript
Props: {
  columns: { key: keyof T | string, header: string, render?: (row: T) => ReactNode, className? }[]
  rows: T[], keyField: keyof T, emptyMessage?: string, onRowClick?: (row: T) => void
}
```

---

## 헬스체크 엔드포인트

### GET /api/health (Liveness)
```json
{ "status": "ok", "timestamp": "...", "uptime": 3600.5 }
```

### GET /api/ready (Readiness)
- 확인: Supabase (orders SELECT) + Redis (ping)
```json
{ "status": "ready|not_ready", "checks": { "supabase": true, "redis": true }, "timestamp": "..." }
```
- 200 OK (모두 정상) / 503 (하나라도 실패)

---

## V3 매핑 현황

### 이미 구현됨 (Phase 3)
| V2 기능 | V3 파일 | 비고 |
|---------|---------|------|
| HMAC 세션 | `lib/auth.ts` | 동일 패턴 |
| Supabase 클라이언트 | `lib/supabase/client.ts` | 동일 |
| Supabase 어드민 | `lib/supabase/admin.ts` | 동일 |

### 미구현
| V2 기능 | V3 필요 작업 |
|---------|-------------|
| SMS 래퍼 | `lib/notification/sms.ts` |
| SMS 템플릿 6종 | `lib/notification/templates.ts` |
| 자동 알림 트리거 | `lib/notification/index.ts` |
| notification_logs 로깅 | notification.repo.ts |
| 레이트 리밋 | `lib/ratelimit.ts` (Upstash) |
| Edge 미들웨어 | `middleware.ts` |
| 대량 발송 | bulk-send API + SendTab 3단계 |
| 재발송 | resend API + LogDetailModal |
| 이력 조회/검색 | GET notifications + HistoryTab |
| 택배 시스템 | courier/ (CJ 미구현, 수동만) |
| API 클라이언트 | lib/api/client.ts (fetch 래퍼) |
| API 응답 헬퍼 | lib/api/response.ts |
| 공통 UI (StatCard, StatusBadge, TableShell) | 재사용 컴포넌트 |
| 헬스체크 | /api/health + /api/ready |

---

## V3 구현 체크리스트

### Phase 4 (서비스 레이어)
- [ ] `notification.service.ts` — SMS 발송 + 템플릿 + 자동 트리거
- [ ] SMS 템플릿 6종 (V2 텍스트 그대로 이식)

### Phase 5 (API 라우트)
- [ ] `POST /api/admin/notifications/send-sms` — 수동 SMS
- [ ] `GET /api/admin/notifications` — 이력 조회 (필터+검색+페이지네이션)
- [ ] `POST /api/admin/notifications/bulk-send` — 대량 발송
- [ ] `POST /api/admin/notifications/resend` — 재발송
- [ ] 레이트 리밋 미들웨어 적용
- [ ] 인증 미들웨어 강화 (다중 사용자?)
- [ ] `GET /api/health` — Liveness probe
- [ ] `GET /api/ready` — Readiness probe (Supabase + Redis)

### Phase 6 (UI)
- [ ] 알림 관리 2탭 페이지 (SendTab + HistoryTab)
- [ ] SendTab: 프로모션 발송 3단계 (target→compose→confirm)
- [ ] HistoryTab: 이력 테이블 + 필터(상태/이벤트/검색)
- [ ] ManualSendModal: 수동 발송 3단계 모달
- [ ] LogDetailModal: 상세 로그 + 재발송 버튼
- [ ] WorkflowIndicator, EventBadge, StatusBadge 공통 컴포넌트
- [ ] 공통 UI: StatCard, StatusBadge (15상태), TableShell (제네릭)
- [ ] 로그인 페이지 (금색 테마, blur 카드)

### V2 핵심 UX 유지 사항
1. **자동 SMS 트리거**: 상태 변경 시 셀러에게 자동 문자
2. **6종 템플릿**: 수령/검수/보류/판매/지급/반려 각각 다른 문구
3. **업체 전화번호 표시**: 템플릿에 문의처 포함
4. **90바이트 자동 LMS 변환**: 긴 문자 자동 처리
5. **발송 내역 DB 로깅**: notification_logs 테이블
6. **프로모션 발송 3단계**: target→compose→confirm 워크플로우
7. **대량 발송 순차 처리**: Solapi 속도 제한 대응
8. **이력 검색 4가지 경로**: 셀러명/전화번호/상품번호/메시지
9. **재발송 기능**: 실패건 원본 파라미터로 재시도
10. **택배 프로바이더 패턴**: CJ + Manual 폴백
