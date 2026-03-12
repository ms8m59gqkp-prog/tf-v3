# V2 검증 기준서 #8: 공통 인프라

## Supabase 클라이언트

| 파일 | 용도 | 키 |
|------|------|-----|
| `lib/supabase/client.ts` (24줄) | 브라우저 클라이언트 (RLS 적용) | ANON_KEY |
| `lib/supabase/admin.ts` (28줄) | 서버 관리자 클라이언트 (RLS 우회) | SERVICE_ROLE_KEY |

---

## 환경변수 관리 (lib/env.ts, 33줄)

```typescript
env = {
  supabase: { url, anonKey, serviceRoleKey },
  anthropic: { apiKey },
  photoroom: { apiKey },
  admin: { id, password, sessionSecret }
}
```

`requireEnv(key)` — 미설정 시 throw

---

## 외부 서비스 통합

| 서비스 | 파일 | 용도 | 키 |
|--------|------|------|-----|
| PhotoRoom | `lib/photoroom.ts` (74줄) | 배경 제거 | PHOTOROOM_API_KEY |
| Naver Shopping | `lib/naver-shopping.ts` (83줄) | 가격 검색 | NAVER_CLIENT_ID, NAVER_CLIENT_SECRET |
| Claude Vision | `lib/photo-classify/claude-api.ts` (187줄) | 사진 분류 | ANTHROPIC_API_KEY |
| Solapi SMS | `lib/notification/sms.ts` (68줄) | 문자 발송 | COOLSMS_API_KEY, COOLSMS_API_SECRET |
| Upstash Redis | `lib/ratelimit.ts` (69줄) | 레이트 리밋 | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN |

---

## 브랜드 별칭 시스템

- **`lib/brand-search.ts`** (445줄): 59개 브랜드 별칭 + 초성 검색
- **`lib/brand-aliases.ts`** (70줄): 50개 브랜드 한영 매핑
- **주요 브랜드**: Drake's, Alden, Zegna, Ring Jacket, Liverano, Brooks Brothers 등
- **검색 방식**: 직접 조회 → 부분 매칭 → 초성(자음) 매칭

---

## 택배 시스템 (lib/courier/)

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `lib/courier/index.ts` | 29 | 진입점: getCourierProvider() + getWarehouseInfo() |
| `lib/courier/types.ts` | 34 | ShipmentRequest, ShipmentResult, CourierProvider |
| `lib/courier/cj-logistics.ts` | 60 | CJ대한통운 (미구현 — TODO) |
| `lib/courier/manual-provider.ts` | 29 | 수동 배송 폴백 |

- **프로바이더 패턴**: CJ_API_KEY 있으면 CJ, 없으면 Manual
- **창고 정보**: 트레이딩 플로어, 010-6644-6190
- **CJ 추적 URL**: `cjlogistics.com/ko/tool/parcel/tracking#parcel/detail/{trackingNumber}`

---

## 공통 UI 컴포넌트

| 컴포넌트 | 파일 | 줄 수 | Props |
|----------|------|-------|-------|
| StatCard | `app/admin/components/StatCard.tsx` | 59 | title, value, subtitle?, trend? |
| StatusBadge | `app/admin/components/StatusBadge.tsx` | 91 | status → 15개 색상 매핑 |
| TableShell\<T\> | `app/admin/components/TableShell.tsx` | 114 | columns[], rows, keyField, onRowClick? |

---

## API 클라이언트 (lib/api/)

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `lib/api/client.ts` | 109 | fetch 래퍼 (타임아웃 30초, APIError, api.get/post/patch/delete) |
| `lib/api/response.ts` | 27 | successResponse, errorResponse, validationError, unauthorized |

---

## 헬스체크 엔드포인트

| 엔드포인트 | 용도 | 확인 항목 |
|-----------|------|----------|
| `GET /api/health` | Liveness | status + uptime |
| `GET /api/ready` | Readiness | Supabase(orders SELECT) + Redis(ping) |

---

## 시세 조회 (Database 페이지)

- **경로**: `/admin/database`
- **테이블**: `market_prices`
- **기능**: 브랜드 자동완성, 16개 카테고리, 카드형 결과 표시
- **용도**: 가격 추정 시 참고용 시장 가격 DB

---

## 전체 환경변수 목록

| 변수 | 용도 |
|------|------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase 공개 키 |
| SUPABASE_SERVICE_ROLE_KEY | Supabase 서비스 롤 키 |
| SESSION_SECRET | 세션 HMAC 시크릿 (≥32자) |
| ADMIN_ID | 관리자 아이디 |
| ADMIN_PASSWORD | 관리자 비밀번호 |
| COOLSMS_API_KEY | Solapi API 키 |
| COOLSMS_API_SECRET | Solapi 시크릿 |
| SENDER_PHONE | 발신 전화번호 |
| PHOTOROOM_API_KEY | PhotoRoom 키 |
| ANTHROPIC_API_KEY | Anthropic/Claude 키 |
| NAVER_CLIENT_ID | 네이버 검색 클라이언트 ID |
| NAVER_CLIENT_SECRET | 네이버 검색 시크릿 |
| UPSTASH_REDIS_REST_URL | Upstash Redis URL |
| UPSTASH_REDIS_REST_TOKEN | Upstash Redis 토큰 |
