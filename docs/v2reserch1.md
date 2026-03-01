# Classic Menswear V2 - 코드 리서치 종합 보고서 (1차)

## 프로젝트 개요

Next.js 16 + React 19 + TypeScript + Supabase 기반의 **명품 남성복 위탁판매 관리 시스템**. 위탁 접수, 검수, AI 사진 분류, 정산, SMS 알림, 네이버 스마트스토어 연동 등을 포함한 어드민 시스템.

---

## 치명적 문제 (Critical)

### 1. API 라우트 인증 부재
`proxy.ts` 미들웨어가 `/admin/*` **페이지**만 세션 검증하고, `/api/admin/*` **API 라우트는 인증 없이 통과**시킴. URL만 알면 누구나 주문/정산/SMS/파일삭제 등 모든 admin API에 접근 가능.

```
/admin/* 페이지 → 세션 체크 O
/api/admin/* API → 세션 체크 X ← 여기가 구멍
```

### 2. Public API에서 Service Role Key 사용
- `api/consignment/adjust/[token]/route.ts` — 공개 엔드포인트가 RLS 우회하는 admin 클라이언트 사용
- `api/orders/[productId]/hold/route.ts` — productId 브루트포스로 customer_agreed 변경 가능

### 3. 프론트엔드 fetch 호출 에러 처리 누락
- `useOrderHandlers.ts` — PATCH 실패해도 다음 로직 실행, `res.ok` 체크 없음
- `useOrders.ts:64-71` — `updateOrderStatus` 에러 핸들링 전무
- `OriginalsTab.tsx:43-52` — catch 블록 없음, unhandled rejection

### 4. SMS 미발송 버그
`useOrderHandlers.ts` 가격 조정/재발송 시나리오에서 실제 SMS API 호출 없이 `console.log`만 실행. 판매자에게 알림이 안 감.

---

## 고위험 문제 (High)

### 5. DB 트랜잭션 부재
- `api/admin/orders/route.ts:111-152` — orders insert 후 order_items 실패 시 수동 delete (서버 크래시하면 고아 레코드)
- 위탁완료 플로우에서 st_products → orders → order_items → consignment_requests 4단계 중 중간 실패 시 롤백 불가

### 6. N+1 쿼리 및 전체 테이블 스캔
- `api/admin/products/route.ts:63-77` — 페이지 로드마다 st_products **전체 테이블** 풀 스캔 (요약 카운트용)
- `api/admin/consignments/route.ts:237-262` — 엑셀 업로드 시 행마다 2-3회 DB 호출 (200행 = 600 라운드트립)
- `api/settlement/generate/route.ts:105-149` — 판매자별 3회 DB 호출 (50명 = 150 쿼리)

### 7. 미구현/스텁 기능
| 파일 | 문제 |
|------|------|
| `export/mismatch-report/route.ts` | 미스매치 보고서 — 항상 빈 데이터 반환 |
| `cj-logistics.ts` | CJ 택배 픽업 API — 항상 실패 반환하는 스텁 |
| `settlement-calculator.ts:32` | 이벤트 할인 — 로직은 있으나 활성화 안 됨 |

### 8. Base64 이미지를 DB에 직접 저장
`useOrderHandlers.ts:83-90` — 가격조정 이미지를 `FileReader.readAsDataURL()`로 Base64 변환 후 DB에 저장. 스케일링 시 DB 용량 급증.

---

## 중위험 문제 (Medium)

### 9. 스타일링 불일치
- inline `style={}`: **1,061회** (78개 파일)
- Tailwind `className=`: **154회** (24개 파일)
- `onMouseEnter`/`onMouseLeave`로 hover 효과 구현 (CSS 대신 JS) — 5개+ 파일에서 반복
- 다크모드, 테마, 반응형 디자인 불가능한 구조

### 10. 모든 어드민 페이지가 `'use client'`
Server Component 활용 기회 전면 상실. `ConsignmentStats`, `OrderStats`, `TableShell` 등 정적 컴포넌트까지 클라이언트 사이드 렌더링.

### 11. 코드 분할 미적용
- `ClassifyMatchModal.tsx` — SSE 스트리밍+상태머신 포함, 모달 안 열어도 번들에 포함
- InspectionModal, ConsignmentInspectionModal도 마찬가지
- `next/dynamic`으로 지연 로딩 필요

### 12. 타입 안전성 갭
- `queue-settlements/route.ts` — `as unknown` 15회+, `as string` 12회+ (Supabase 타입 불일치)
- API 응답 타입이 각 fetch 호출마다 인라인으로 정의 (`json as { ... }`) — 공유 타입 없음
- `ReviewReportData` 타입이 2곳에서 중복 정의

### 13. `alert()`/`confirm()` 남용
25+ `alert()`, 6+ `confirm()` 사용. 메인 스레드 블로킹, 스타일링 불가, 팝업 차단기에 의해 차단 가능.

### 14. 에러 바운더리 부족
`error.tsx` 하나만 존재. 정산 워크플로, 사진 분류, 검수 모달 등 기능별 에러 바운더리 없음.

---

## 저위험 문제 (Low)

### 15. 설정/메타 미비
- `layout.tsx` — `lang="en"` (한국어 앱), metadata가 "Create Next App" 기본값
- ESLint/Prettier 설정 파일 없음
- `xlsx: "^0.18.5"` — 2022년 버전

### 16. 접근성(A11Y)
- ARIA 라벨 전무
- 모달에 `aria-modal`, `role="dialog"`, 포커스 트랩 없음
- `<img>` 태그에 `loading="lazy"` 없음, `next/image` 미사용

### 17. `lib/api` 유틸 미사용
- `lib/api/client.ts` — 타임아웃, Sentry, 타입 응답 처리 포함하나 프론트엔드에서 한 번도 사용 안 됨
- `lib/api/response.ts` — 표준 에러 응답 헬퍼 존재하나 대부분 라우트에서 수동 복붙

---

## V3 개선 방향 제안

### 방향 1: 보안 아키텍처 재설계
- `/api/admin/*` 미들웨어 레벨 인증 적용
- Public API에서 Service Role Key 제거, RLS 기반으로 전환
- 비밀번호 bcrypt/argon2 해싱
- 입력 검증 레이어 (Zod 스키마) 도입
- RBAC(역할 기반 접근 제어) 시스템

### 방향 2: 데이터 레이어 최적화
- Supabase RPC 함수로 배치 처리 (N+1 제거)
- DB 트랜잭션으로 다단계 작업 원자성 보장
- 이미지 저장 → Supabase Storage (Base64 DB 저장 제거)
- 파일시스템 의존 제거 → 클라우드 스토리지
- 누락 인덱스 추가 (`adjustment_token`, `product_number`, `phone`)

### 방향 3: 프론트엔드 현대화
- Server Component 적극 활용 (SSR/Streaming)
- 일관된 Tailwind CSS 스타일링 (inline style 1,061개 제거)
- `next/dynamic`으로 무거운 모달 코드 분할
- `next/image`로 이미지 최적화
- Toast/Dialog 컴포넌트로 `alert()`/`confirm()` 대체
- 기능별 Error Boundary 추가
- `lib/api/client.ts` 활용 + 공유 API 응답 타입

### 방향 4: 코드 품질 인프라
- ESLint + Prettier 설정 도입
- 공유 API 응답 타입 (`lib/api-types.ts`)
- Supabase 타입 자동생성 (`supabase gen types`)으로 `as unknown` 제거
- 중복 코드 통합 (`errorResponse`, `apiClient` 등)
- 미구현 스텁 정리 (CJ 택배, 미스매치 리포트)

### 방향 5: 운영 안정성
- 기능별 Error Boundary (정산/사진/검수)
- SMS 발송 누락 수정 + 발송 실패 재시도 큐
- 로딩 스켈레톤 + Suspense Boundary
- 접근성(A11Y) 기본 준수 (`lang="ko"`, ARIA, 포커스 관리)
- 통합/E2E 테스트 커버리지
