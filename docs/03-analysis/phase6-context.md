# Phase 6: 컨텍스트

**최종 업데이트**: 2026-03-13

---

## 핵심 파일 경로

### 참조 문서
| 문서 | 경로 |
|------|------|
| plan5.md Phase 6 | `docs/Strategic/plan5.md` L1246-1282 |
| architecture-spec | `docs/Control Layer/architecture-spec.md` |
| phase-checklists | `archieves/phase-checklists.md` L154-166 |
| process-checklist | `docs/Control Layer/process-checklist.md` |
| analysis-techniques | `docs/Control Layer/analysis-techniques.md` L416-451 (등급 2) |
| V2 위탁 | `docs/v2-reference/v2-ref-consignment.md` |
| V2 주문 | `docs/v2-reference/v2-ref-orders.md` |
| V2 사진 | `docs/v2-reference/v2-ref-photos.md` |
| V2 상품매출 | `docs/v2-reference/v2-ref-products-sales.md` |
| V2 정산 | `docs/v2-reference/v2-ref-settlement.md` |
| V2 알림인증 | `docs/v2-reference/v2-ref-notification-auth.md` |

### 기존 코드 (Phase 6이 의존하는 것)
| 파일 | 역할 |
|------|------|
| `app/api/**/route.ts` | API 엔드포인트 52개 |
| `lib/services/*.service.ts` | 비즈니스 로직 20개 |
| `lib/api/middleware.ts` | withAdmin 미들웨어 |
| `lib/api/response.ts` | ok/err/errFrom 응답 헬퍼 |
| `lib/utils/validation.ts` | Zod 스키마 (phone, uuid, token, page 등) |
| `lib/utils/privacy.ts` | 개인정보 마스킹 |
| `lib/auth.ts` | bcryptjs + 인메모리 Map 세션 (Edge Runtime 불가) |
| `proxy.ts` | Next.js 16 proxy (middleware.ts 대체, /api/* Rate Limit + 세션 검증) |

### 생성할 경로 (Phase 6)
| 경로 | 역할 |
|------|------|
| `lib/api/client.ts` | 브라우저용 fetch 래퍼 |
| `components/` | 공유 UI 컴포넌트 |
| `hooks/` | 커스텀 훅 |
| `app/admin/layout.tsx` | 어드민 레이아웃 (사이드바+헤더) |
| `app/admin/*/page.tsx` | 어드민 페이지 15개 |
| `app/consignment/adjust/[token]/page.tsx` | Public 가격조정 |
| `app/orders/[productId]/hold/page.tsx` | Public 주문보류 |

---

## 결정 사항

| # | 결정 | 근거 | 날짜 |
|---|------|------|------|
| D1 | UI 라이브러리: 순수 Tailwind | Tailwind v4 네이티브, shadcn v4 미지원, 의존성 0 | 2026-03-13 |
| D2 | 상태관리: useState + AuthContext | 글로벌 상태 세션 1개뿐, 라이브러리 불필요 | 2026-03-13 |
| D3 | 데이터 페칭: SWR | Next.js 궁합, GET 중심 CRUD 최적, ~4KB | 2026-03-13 |
| D4 | 인증 리다이렉트: proxy.ts(API, 기존) + Server Component redirect(페이지) | auth.ts가 bcryptjs+인메모리 Map → Edge Runtime 불가, middleware.ts 별도 생성 시 이중 구조 | 2026-03-13 |
| D5 | 다크모드: 미지원 | 내부 어드민 1~3명, 작업량 1.3~1.5배 증가 방지 | 2026-03-13 |

---

## 검증 이력

| 라운드 | 발견 | 수정 |
|--------|------|------|
| 1차 | route.ts 34→52, service 13→20 | phase6-plan.md §0 수정 |
| 2차 (리뷰어) | 트랜잭션 2→3, 공유 컴포넌트 12 vs plan5 8 혼동, Server Component 표현 부정확 | §0 트랜잭션 3개, §3 "8개 컴포넌트+4개 유틸/훅=12개" 명확화, §1 L3→L1 원문 반영 |
| 결정 검증 | middleware.ts 추천 → proxy.ts 이미 존재 + bcryptjs Edge 불가 발견 | D4 수정: proxy.ts + Server redirect |

---

## 구조 결정

- `app/admin/layout.tsx` — 루트 (메타데이터만, 인증 없음)
- `app/admin/(dashboard)/layout.tsx` — 인증 체크 + 사이드바 + 헤더 (route group)
- `app/admin/login/page.tsx` — route group 밖, 인증 불필요

## 다음 단계

1. ~~Session A 착수~~ ✅ 완료 (16파일, tsc 0건)
2. ~~Session B 상세 계획~~ ✅ (`docs/03-analysis/phase6-session-b-plan.md`, 41파일)
3. ~~Session B 구현~~ ✅ 완료 (37파일 생성, tsc 0건)
4. Session B 검증 대기 (등급 2, 10회)
5. Session C 착수 (Tier 2+3 나머지 9개 페이지)
