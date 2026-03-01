# Plan3 Rev.3 감사 보고서 (Audit 1)

**작성일**: 2026-03-01
**대상**: plan3 rev3.md (1554줄) vs pa1-report.md (1026줄)
**방법론**: pa1-report 수정권고 → plan3 rev3 반영 여부 3회 교차 검증
**검증자**: Claude Opus 4.6

---

## 검증 구조

| 검증 | 내용 | 반복 |
|------|------|------|
| **1차** | PA1 IMP-01~13 (개선안 13건) 반영 여부 매핑 | 완료 |
| **2차** | PA1 CHECK-01~12 (지적사항 12건) 반영 여부 확인 | 완료 |
| **3차** | audit2 FIX-01~18 반영 + WHY-01~11 대응 + 누락 종합 | 완료 |

---

# Part 1: PA1 IMP-01~13 반영 검증 (1차)

## IMP-01: 테스트 전략 추가 [CRITICAL]

| PA1 권고 | Rev.3 반영 | 위치 | 판정 |
|----------|-----------|------|------|
| vitest 프레임워크 | vitest.config.ts + §12.1 | line 100, 990-995 | ✅ |
| Phase 1: Zod 단위 테스트 38+개 | ~50개로 확대 | line 1001 | ✅ |
| Phase 2: RPC 통합 테스트 (3 RPC x 정상/실패/엣지) | ~15개 | line 1002 | ✅ |
| Phase 5: CRITICAL 라우트 E2E | ~10개 | line 1003 | ✅ |
| Phase 8: 회귀 테스트 스위트 | ~75개 | line 1004 | ✅ |
| CRITICAL 테스트 케이스 예시 | settlement-rpc.test.ts 4개 | line 1008-1029 | ✅ |

**판정**: ✅ **완전 반영**. PA1 기준 이상으로 테스트 수 확대.

---

## IMP-02: Phase 0 성능 인덱스 추가 [CRITICAL]

| PA1 권고 인덱스 | Rev.3 반영 | 위치 | 판정 |
|----------------|-----------|------|------|
| idx_sold_items_seller_settlement | 동일 | line 248-252 | ✅ |
| idx_orders_status | 동일 | line 254-256 | ✅ |
| idx_st_products_number | UNIQUE 제약이 암묵적 인덱스 역할 (PA1 line 504에서도 인정) | line 238 | ✅ |
| idx_sales_records_match | 동일 | line 258-260 | ✅ |
| idx_settlement_queue_seller | 동일 | line 262-264 | ✅ |
| (추가) idx_consignment_requests_seller | PA1 범위 밖 추가 | line 266-268 | ✅+ |
| CONCURRENTLY 무중단 생성 | 모든 인덱스에 적용 | line 248-268 | ✅ |
| WHY 주석 (pa1 WHY-02 근거) | 존재 | line 244-245 | ✅ |

**판정**: ✅ **완전 반영 + 추가 인덱스 1개**.

---

## IMP-03: RLS 정책 설계 [CRITICAL]

| PA1 권고 | Rev.3 반영 | 위치 | 판정 |
|----------|-----------|------|------|
| consignment_requests ENABLE RLS | 동일 | line 280 | ✅ |
| adjustment_token 기반 SELECT | 동일 (current_setting 방식) | line 281-284 | ✅ |
| orders ENABLE RLS | 동일 | line 288 | ✅ |
| orders anon read (true) | 동일 | line 289-291 | ✅ |
| orders anon update (IMAGE_COMPLETE만) | 동일 | line 292-295 | ✅ |
| admin service_role → RLS 우회 | 명시 | line 297 | ✅ |
| TO anon 명시적 역할 지정 | 모든 POLICY에 TO anon 적용 | 전체 | ✅ |

**판정**: ✅ **완전 반영**.

---

## IMP-04: V2→V3 전환 런북 [CRITICAL]

| PA1 권고 | Rev.3 반영 | 위치 | 판정 |
|----------|-----------|------|------|
| T-60분 ~ T+20분 분 단위 | T-24시간 ~ T+20분 (더 상세) | line 1125-1168 | ✅+ |
| maintenance mode | MAINTENANCE=true 환경변수 | line 1132-1135 | ✅ |
| 확인 쿼리 5개 | 동일 5개 쿼리 | line 1137-1148 | ✅ |
| 스모크 테스트 5건 | 동일 5건 (로그인/대시보드/위탁/주문/정산) | line 1153-1158 | ✅ |
| 롤백 조건 + 롤백 시간 2분 | 동일 + Vercel 이전 배포 전환 | line 1165-1168 | ✅ |
| (추가) T-24시간 사전 공지 | PA1 범위 밖 추가 | line 1125 | ✅+ |
| (추가) T-60분 사전 확인 3건 | PA1 범위 밖 추가 | line 1127-1130 | ✅+ |

**판정**: ✅ **완전 반영 + PA1보다 더 상세한 사전 절차 추가**.

---

## IMP-05: CI/CD 최소 파이프라인 [HIGH]

| PA1 권고 | Rev.3 반영 | 위치 | 판정 |
|----------|-----------|------|------|
| GitHub Actions on push/PR | 동일 | line 921 | ✅ |
| pnpm install --frozen-lockfile | 동일 | line 931 | ✅ |
| tsc --noEmit | 동일 | line 932 | ✅ |
| vitest run | 동일 | line 934 | ✅ |
| next build | 동일 | line 935 | ✅ |
| (추가) eslint --max-warnings 0 | PA1에 없던 항목 추가 | line 933 | ✅+ |
| (추가) pnpm/action-setup + setup-node | 구체적 Actions 버전 명시 | line 927-930 | ✅+ |

**판정**: ✅ **완전 반영 + ESLint 단계 추가**.

---

## IMP-06: 프로덕션 모니터링 [HIGH]

| PA1 권고 | Rev.3 반영 | 위치 | 판정 |
|----------|-----------|------|------|
| Sentry 무료 티어 | Sentry init | line 944-948 | ✅ |
| captureException 패턴 | 표준 핸들러에 포함 | line 774 | ✅ |
| DSN env 관리 | process.env.SENTRY_DSN | line 945 | ✅ |
| tracesSampleRate | 0.1 (10%) 설정 | line 946 | ✅ |

**판정**: ✅ **완전 반영**.

---

## IMP-07: Zod 스키마 co-location 전략 [HIGH]

| PA1 권고 | Rev.3 반영 | 위치 | 판정 |
|----------|-----------|------|------|
| Phase 1: 공용 5개만 (Phone, UUID, Date, Amount, Pagination) | 동일 5개 | line 474-482 | ✅ |
| Phase 5: route.ts 옆 schema.ts | 디렉토리 구조 + 예시 | line 486-493, 780-793 | ✅ |
| WHY 근거 (SIM-02 방지) | 명시 | line 497-499 | ✅ |

**판정**: ✅ **완전 반영**.

---

## IMP-08: 검증 게이트 ESLint 보강 [HIGH]

| PA1 권고 | Rev.3 반영 | 위치 | 판정 |
|----------|-----------|------|------|
| requireAdmin 반환값 사용 강제 ESLint 규칙 | must-check-auth.js 코드 포함 | line 951-969 | ✅ |
| style={{}} 정밀 탐지 → ESLint | no-static-inline-styles 규칙 | line 833-841 | ✅ |
| any/unknown 캐스팅 탐지 | @typescript-eslint/no-explicit-any | line 530 | ✅ |

**판정**: ✅ **완전 반영**.

---

## IMP-09: 스토리지 마이그레이션 멱등성 [HIGH]

| PA1 권고 | Rev.3 반영 | 위치 | 판정 |
|----------|-----------|------|------|
| 체크포인트 테이블 | _migration_checkpoint CREATE TABLE | line 851-859 | ✅ |
| 3단계 상태 머신 (pending→uploaded→url_updated) | 동일 | line 855 | ✅ |
| 재실행 시 미완료 건만 처리 | WHERE status != 'url_updated' | line 870-871 | ✅ |
| 진행률 출력 | completed/total 퍼센트 | line 904-908 | ✅ |
| (추가) error_message 기록 | PA1에 없던 에러 추적 컬럼 | line 857-858, 896-900 | ✅+ |

**판정**: ✅ **완전 반영 + 에러 추적 컬럼 추가**.

---

## IMP-10: 배치 작업 부분 성공 처리 [HIGH]

| PA1 권고 | Rev.3 반영 | 위치 | 판정 |
|----------|-----------|------|------|
| BatchResult 인터페이스 (batchId, total, completed, failed, failedIds, status) | 동일 | line 663-670 | ✅ |
| 429 Too Many Requests → partial + 중단 | 동일 | line 688-693 | ✅ |
| failedIds로 재시도 가능 | 동일 | line 701 | ✅ |
| **_batch_progress DB 테이블 스키마** | **notifications.repo.logBatch()로 대체** | line 701 | ⚠️ |

**판정**: ⚠️ **실질 반영, 형식 차이**.
- PA1은 `_batch_progress` 전용 DB 테이블(7개 컬럼)을 제안
- Rev3은 `notifications.repo.logBatch(result)` 로 추상화
- DB 테이블 스키마가 마이그레이션 파일(Phase 0)에 미포함
- **영향**: 재시도 시 DB에서 failedIds 조회 가능 여부가 logBatch 구현에 의존 → 구현 단계에서 해결 가능하나 명시적이지 않음

---

## IMP-11: 서비스 레이어 줄수 제한 완화 [HIGH]

| PA1 권고 | Rev.3 반영 | 위치 | 판정 |
|----------|-----------|------|------|
| 함수 단위: 100줄 유지 | 80줄 (더 엄격) | line 185 | ✅+ |
| 서비스 파일: 150줄 | 동일 | line 187 | ✅ |
| 컴포넌트 파일: 150줄 | 동일 | line 188 | ✅ |
| 타입/설정: 200줄 유지 | 동일 | line 190 | ✅ |
| (추가) API 라우트: 100줄 | PA1에 없던 명시 | line 186 | ✅+ |
| (추가) 리포지토리: 120줄 | PA1에 없던 명시 | line 189 | ✅+ |
| (추가) 테스트: 제한 없음 | PA1에 없던 명시 | line 191 | ✅+ |

**판정**: ✅ **완전 반영 + 추가 역할별 세분화**.

---

## IMP-12: 5레이어 → 3+1레이어 단순화 [MEDIUM]

| PA1 권고 | Rev.3 반영 | 위치 | 판정 |
|----------|-----------|------|------|
| L0: 인프라 | 동일 | line 62-63 | ✅ |
| L1: 비즈니스 (기존 L1~L3 통합) | types+utils+db+services+calculators | line 65-70 | ✅ |
| L2: UI | components + hooks | line 72-74 | ✅ |
| L3: 라우트 | 엔트리포인트 (api + pages) | line 76-78 | ✅ |
| +1: 필요 시 점진적 분리 | "서비스 200줄 초과 시 리포지토리 분리 허용" | line 84 | ✅ |
| 매퍼 파일 3개 제거 | "매핑 내장 (매퍼 파일 없음)" | line 134, 590-609 | ✅ |
| YAGNI 원칙 적용 | 명시 | line 82-83 | ✅ |

**판정**: ✅ **완전 반영**.

---

## IMP-13 (추가): SWR/React Query 구체 전략

| PA1 권고 | Rev.3 반영 | 위치 | 판정 |
|----------|-----------|------|------|
| 폴링 간격: 30초 | 동일 | line 722 | ✅ |
| 무효화 키: ['orders', sellerId] 등 | 동일 | line 723 | ✅ |
| 낙관적 업데이트 | 동일 | line 724 | ✅ |
| 에러 재시도: 3회, 지수 백오프 | "1초, 2초, 4초" | line 725 | ✅ |
| SIM-R3-14에서 동시 관리자 검증 | 추가 시뮬레이션 | line 1358-1368 | ✅ |

**판정**: ✅ **완전 반영**.

---

### 1차 검증 종합

| IMP | 등급 | 판정 | 비고 |
|-----|------|------|------|
| IMP-01 | CRITICAL | ✅ 완전 | 테스트 수 확대 |
| IMP-02 | CRITICAL | ✅ 완전 | 인덱스 1개 추가 |
| IMP-03 | CRITICAL | ✅ 완전 | — |
| IMP-04 | CRITICAL | ✅ 완전+ | 사전 절차 추가 |
| IMP-05 | HIGH | ✅ 완전+ | ESLint 단계 추가 |
| IMP-06 | HIGH | ✅ 완전 | — |
| IMP-07 | HIGH | ✅ 완전 | — |
| IMP-08 | HIGH | ✅ 완전 | — |
| IMP-09 | HIGH | ✅ 완전+ | 에러 추적 컬럼 추가 |
| IMP-10 | HIGH | ⚠️ 실질 반영 | _batch_progress 테이블 스키마 미포함 |
| IMP-11 | HIGH | ✅ 완전+ | 역할별 추가 세분화 |
| IMP-12 | MEDIUM | ✅ 완전 | — |
| IMP-13 | 추가 | ✅ 완전 | — |

**13건 중: 완전 반영 12건, 실질 반영(형식 차이) 1건**

---

# Part 2: PA1 CHECK 지적사항 반영 검증 (2차)

## CHECK-01: 문제 인벤토리 완전성 — HIGH 누락 5건

PA1이 지적한 "plan3에서 누락된 HIGH 이슈 5건":

| 이슈 | PA1 지적 | Rev.3 대응 | 판정 |
|------|---------|-----------|------|
| NEW-08 | Base64 이중복사 (photo-editor.ts) — 직접 해결 코드 없음 | **Rev.3에 명시적 대응 없음** | ❌ 누락 |
| NEW-10 | Puppeteer 좀비 프로세스 — 좀비 방지 미설계 | **Rev.3에 명시적 대응 없음** | ❌ 누락 |
| NEW-14 | setTimeout 언마운트 누수 — NEW-13과 별개 이슈 | SIM-R3-10에서 useEffect cleanup 언급하나, 별도 이슈로 분리 안됨 | ⚠️ 부분 |
| FE-08 | SSE 메모리 누수 — EventSource 정리 코드 없음 | **Rev.3에 명시적 대응 없음** | ❌ 누락 |
| FE-10 | 가상화 미적용 — 대량 리스트 | **Rev.3에 명시적 대응 없음** | ❌ 누락 |

**판정**: ❌ **5건 중 4건 미반영, 1건 부분 반영**.
- 이 5건은 PA1이 "plan3에서 누락된 HIGH 이슈"로 지적했으나, Rev.3에서도 여전히 누락
- 근거: Rev.3 변경 요약(R3-01~R3-18)에 이 5건 관련 항목 없음

---

## CHECK-02: 아키텍처 일관성

| PA1 지적 | Rev.3 대응 | 판정 |
|---------|-----------|------|
| L5→L3 직접 참조 명확한 정의 필요 | 3+1레이어 전환으로 문제 해소 (route.ts = L3) | ✅ 해결 |

**판정**: ✅ **해결됨** — 아키텍처 단순화로 근본적 해결.

---

## CHECK-03: 라우트 수 불일치 (56 vs 62)

| PA1 지적 | Rev.3 대응 | 판정 |
|---------|-----------|------|
| 56개 → 실제 합산 62+ 불일치 | §8.1 "Rev.2 '56' → Rev.3 '62'" 정정 | ✅ 해결 |
| Tier별 합산 검증 | 10+20+6+4+22=62 | ✅ 일치 |

**판정**: ✅ **해결됨**.

---

## CHECK-04: 검증 게이트 실효성 (grep 한계)

| PA1 지적 | Rev.3 대응 | 판정 |
|---------|-----------|------|
| requireAdmin 반환값 무시 미탐지 | ESLint must-check-auth 규칙 | ✅ |
| style={{}} 공백 포함 미탐지 | ESLint no-static-inline-styles | ✅ |
| as unknown as X 미탐지 | @typescript-eslint/no-explicit-any | ✅ |
| 평균 실효성 70.6% → 개선 필요 | ESLint 기반으로 전환 | ✅ |

**판정**: ✅ **해결됨**.

---

## CHECK-05: 타임라인 현실성

| PA1 지적 | Rev.3 대응 | 판정 |
|---------|-----------|------|
| Plan A 6일 비현실적 | 제거 | ✅ |
| Plan B 10일도 Phase 5에 3일 필요 (총 11일) | §13 세션맵 11일 (Phase 5 = Session 5~7, 3일) | ✅ |
| Day 4에 62+ 라우트 비현실적 | 3일 분배 (10+26+26) | ✅ |

**판정**: ✅ **해결됨**.

---

## CHECK-06: RPC SQL 정합성 — 엣지 케이스

| PA1 지적 | Rev.3 대응 | 판정 |
|---------|-----------|------|
| create_settlement: 빈 배열 예외 누락 | COALESCE + RAISE EXCEPTION 추가 | line 318-322 | ✅ |
| create_order: 빈 아이템 체크 없음 | jsonb_array_length 0 → RAISE | line 377-380 | ✅ |
| create_order: product_number NULL 체크 없음 | v_item->>'product_number' IS NULL 체크 | line 388-390 | ✅ |
| complete_consignment: 에러 메시지 불명확 | "명확한 에러 메시지" 언급 | line 415 | ⚠️ 코드 미포함 |

**판정**: ⚠️ **대부분 반영. complete_consignment 에러 메시지 개선은 코드 수준 미포함 (주석만)**.

---

## CHECK-07: 보안 커버리지

| PA1 지적 | Rev.3 대응 | 위치 | 판정 |
|---------|-----------|------|------|
| SEC-02: bcrypt 비용 인자 미지정 | BCRYPT_COST = 12 명시 | line 632 | ✅ |
| SEC-03: symlink 대응 미반영 | fs.realpathSync 추가 | line 501-521 | ✅ |
| SEC-05: RLS 미설계 | §3.1.4 RLS 정책 전체 | line 271-298 | ✅ |
| SEC-08: CORS 미설정 | §6.2 CORS 설정 | line 638-647 | ✅ |

**판정**: ✅ **완전 해결** — PA1 지적 4건 모두 대응.

---

## CHECK-08: 금전적 정확성 — 부분 대응 3건

| PA1 지적 | Rev.3 대응 | 판정 |
|---------|-----------|------|
| FIN-07: 파일 소실 시 DB 우선 업데이트 구체 구현 없음 | **Rev.3에 명시적 코드 없음** | ❌ 누락 |
| FIN-10: upload-confirm 상세 없음 | **Rev.3에 상세 없음** | ❌ 누락 |
| FIN-12: 정산금 음수 차단 Zod 없음 | PositiveAmountSchema 존재(line 477)하나, RPC 파라미터(p_settlement_amount)에 음수 검증 없음 | ⚠️ 부분 |

**판정**: ❌ **3건 중 2건 미반영, 1건 부분**.
- FIN-07: 파일 업로드 실패 시 DB 롤백/우선 업데이트 패턴 없음
- FIN-10: upload-confirm 라우트의 가격 변경 방지 상세 로직 없음
- FIN-12: settlement RPC에 `p_settlement_amount > 0` CHECK 없음

---

## CHECK-09: 데이터 무결성 — DAT-09

| PA1 지적 | Rev.3 대응 | 판정 |
|---------|-----------|------|
| DAT-09: 세션 기반 삭제 구체 설계 필요 | **Rev.3에 명시적 설계 없음** | ❌ 누락 |

**판정**: ❌ **미반영**.

---

## CHECK-10: Rev.2 정정사항 #16

| PA1 지적 | Rev.3 대응 | 판정 |
|---------|-----------|------|
| 라우트 수 56→62 불일치 미해결 | §8.1 "62개" 정정 | ✅ 해결 |

**판정**: ✅ **해결됨**.

---

## CHECK-12: 시뮬레이션 확증 편향

| PA1 지적 | Rev.3 대응 | 판정 |
|---------|-----------|------|
| 3회 자기검증 100% PASS → 확증 편향 | §15 적대적 시뮬레이션 15회 (PASS 13, PARTIAL 2) | ✅ |
| 동시성 시뮬레이션 0건 | SIM-R3-14 동시 관리자 | ✅ |
| 외부 서비스 장애 0건 | SIM-R3-06, SIM-R3-13 | ✅ |
| 검증 한계 테스트 0건 | SIM-R3-11 ESLint 한계 | ✅ |

**판정**: ✅ **완전 해결** — 편향 극복 확인.

---

### 2차 검증 종합

| CHECK | 판정 | 비고 |
|-------|------|------|
| CHECK-01 | ❌ HIGH 4건 누락 | NEW-08, NEW-10, FE-08, FE-10 |
| CHECK-02 | ✅ 해결 | 3+1레이어로 해소 |
| CHECK-03 | ✅ 해결 | 62개 정정 |
| CHECK-04 | ✅ 해결 | ESLint 보강 |
| CHECK-05 | ✅ 해결 | 11일 세션맵 |
| CHECK-06 | ⚠️ 대부분 | complete_consignment 코드 미포함 |
| CHECK-07 | ✅ 해결 | SEC 4건 모두 대응 |
| CHECK-08 | ❌ 2건 누락 | FIN-07, FIN-10 |
| CHECK-09 | ❌ 누락 | DAT-09 |
| CHECK-10 | ✅ 해결 | — |
| CHECK-12 | ✅ 해결 | 15회 적대적 시뮬레이션 |

---

# Part 3: audit2 FIX-01~18 + WHY 대응 종합 검증 (3차)

## audit2 FIX-01~18 반영 여부

| FIX | 내용 | Rev.3 반영 | 위치 | 판정 |
|-----|------|-----------|------|------|
| FIX-01 | 테스트 전략 | §12 테스트 전략 | line 988-1031 | ✅ |
| FIX-02 | 성능 인덱스 | §3.1.3 인덱스 | line 241-269 | ✅ |
| FIX-03 | RLS 정책 | §3.1.4 RLS | line 271-298 | ✅ |
| FIX-04 | 전환 절차 분 단위 | §14 런북 | line 1120-1169 | ✅ |
| FIX-05 | CI/CD | §11.1 CI/CD | line 917-936 | ✅ |
| FIX-06 | 모니터링 | §11.2 Sentry | line 938-949 | ✅ |
| FIX-07 | Zod co-location | §4.2 co-location | line 463-499 | ✅ |
| FIX-08 | 라우트 수 정정 | §8.1 "62개" | line 730-741 | ✅ |
| FIX-09 | style 검증 수정 | §9.2 ESLint | line 833-841 | ✅ |
| FIX-10 | 마이그레이션 멱등성 | §10.1 체크포인트 | line 847-911 | ✅ |
| FIX-11 | 배치 부분 성공 | §7.2 BatchResult | line 657-703 | ✅ |
| FIX-12 | 서비스 150줄 | §2 줄수 세분화 | line 179-197 | ✅ |
| FIX-13 | (MEDIUM) | **audit2 미참조로 확인 불가** | — | ❓ |
| FIX-14 | 매퍼 파일 제거 | R3-15 매퍼 통합 | line 134, 590-609 | ✅ |
| FIX-15 | SWR 전략 | R3-12 SWR | line 706-726 | ✅ |
| FIX-16 | (MEDIUM) | **audit2 미참조로 확인 불가** | — | ❓ |
| FIX-17 | (MEDIUM) | **audit2 미참조로 확인 불가** | — | ❓ |
| FIX-18 | (MEDIUM) | **audit2 미참조로 확인 불가** | — | ❓ |

**확인 가능 14건 중: 반영 14건. 미확인 4건(FIX-13, 16, 17, 18)은 audit2.md 미참조로 검증 불가.**

---

## PA1 WHY-01~11 대응 여부

| WHY | 근본 원인 | Rev.3 대응 | 판정 |
|-----|----------|-----------|------|
| WHY-01 | 리서치 스코프 맹점 (테스트/CI/CD 누락) | §12 테스트 + §11 CI/CD + Sentry | ✅ |
| WHY-02 | 인덱스 = 최적화 오분류 | §3.1.3 "기능 요구사항으로 재분류" | ✅ |
| WHY-03 | anon = 안전 오해 | §3.1.4 RLS | ✅ |
| WHY-04 | plan3 정체성 혼돈 (코드 vs 운영) | §14 독립 런북 | ✅ |
| WHY-05 | CI/CD 부재 (WHY-01과 동일) | §11.1 CI/CD | ✅ |
| WHY-06 | 확증 편향 | §15 적대적 시뮬레이션 15회 | ✅ |
| WHY-07 | Zod 사전 정의 연쇄 변경 | §4.2 co-location | ✅ |
| WHY-08 | 멱등성 없는 스토리지 마이그레이션 | §10.1 체크포인트 | ✅ |
| WHY-09 | 100줄 일률 적용 문제 | §2 역할별 세분화 | ✅ |
| WHY-10 | 5레이어 과잉 (YAGNI 미적용) | §1 3+1레이어 | ✅ |
| WHY-11 | 외부 감사 지연 | §15 시뮬레이션 15회 + §16 실패 분석 10회 | ✅ |

**판정**: ✅ **11건 전부 대응됨**.

---

# 최종 종합

## 반영률 요약

| 카테고리 | 전체 | 반영 | 부분 | 누락 | 미확인 | 반영률 |
|----------|------|------|------|------|--------|--------|
| PA1 IMP (13건) | 13 | 12 | 1 | 0 | 0 | **96%** |
| PA1 CHECK 지적 (12건) | 12 | 7 | 1 | 3 | 0* | **67%** |
| audit2 FIX (18건) | 18 | 14 | 0 | 0 | 4 | **100%** (확인 가능 범위) |
| PA1 WHY (11건) | 11 | 11 | 0 | 0 | 0 | **100%** |

*CHECK-11은 audit2 반영 여부 자체가 항목이므로 위 audit2 FIX로 흡수

---

## 미반영 사항 목록 (총 8건)

### 심각도 HIGH (4건)

| # | 미반영 항목 | 근거 | 영향 |
|---|-----------|------|------|
| GAP-01 | **NEW-08: Base64 이중복사** (photo-editor.ts) | PA1 CHECK-01 | 사진 편집 성능 저하 |
| GAP-02 | **NEW-10: Puppeteer 좀비 프로세스** | PA1 CHECK-01 | 서버 메모리 누수 |
| GAP-03 | **FE-08: SSE 메모리 누수** (EventSource 미정리) | PA1 CHECK-01 | 브라우저 메모리 누수 |
| GAP-04 | **FE-10: 가상화 미적용** (대량 리스트) | PA1 CHECK-01 | 대량 데이터 시 UI 프리징 |

### 심각도 MEDIUM (3건)

| # | 미반영 항목 | 근거 | 영향 |
|---|-----------|------|------|
| GAP-05 | **FIN-07: 파일 소실 시 DB 우선 업데이트** 구체 구현 없음 | PA1 CHECK-08 | 파일 업로드 실패 시 데이터 불일치 |
| GAP-06 | **FIN-10: upload-confirm 가격 변경 방지** 상세 없음 | PA1 CHECK-08 | 정산 후 가격 변경 가능성 |
| GAP-07 | **DAT-09: 세션 기반 삭제** 구체 설계 없음 | PA1 CHECK-09 | 기존 데이터 의도치 않은 삭제 |

### 심각도 LOW (1건)

| # | 미반영 항목 | 근거 | 영향 |
|---|-----------|------|------|
| GAP-08 | **FIN-12: 정산금 음수 차단** RPC 레벨 검증 없음 | PA1 CHECK-08 | 음수 정산금 생성 가능성 (확률 극히 낮음) |

### 형식 차이 (1건, 실질 무해)

| # | 항목 | 설명 |
|---|------|------|
| GAP-09 | IMP-10 _batch_progress 테이블 | PA1: 전용 테이블 → Rev3: logBatch() 추상화. 구현 단계에서 해결 가능 |

### 미확인 (4건)

| # | 항목 | 사유 |
|---|------|------|
| GAP-10~13 | audit2 FIX-13, 16, 17, 18 | audit2.md 미참조로 내용 확인 불가 |

---

## Rev.3 자체 평가 점수 vs 감사 평가

| 기준 | Rev.3 자체 | 감사 보정 | 차이 | 근거 |
|------|-----------|----------|------|------|
| 완결성 | 85/100 | **81/100** | -4 | HIGH 누락 4건 (CHECK-01) |
| 효과성 | 90/100 | **87/100** | -3 | FIN-07, FIN-10, FIN-12 미반영 |
| 효율성 | 78/100 | **78/100** | 0 | 효율성 관련 누락 없음 |
| **종합** | **84/100** | **82/100** | **-2** | — |

**종합 보정**: Rev.3 자체 평가 84점 → 감사 보정 82점 (-2점).
- PA1의 IMP 13건은 거의 완벽 반영 (96%)
- PA1의 CHECK 지적사항 중 CHECK-01 HIGH 누락 5건이 가장 큰 갭
- WHY 11건, FIX 14건(확인 가능)은 100% 대응

---

## 권고사항

### 즉시 반영 필요 (Rev.3.1 수정 시)

1. **GAP-01~04**: CHECK-01 HIGH 누락 4건에 대해 최소 "인지 + 해당 Phase 검증 게이트에 추가" 수준 반영
   - NEW-08: Phase 6 photo-editor 리팩토링 시 Base64 최적화 포함
   - NEW-10: Phase 4 photo.service에 AbortController + process.kill 패턴 추가
   - FE-08: Phase 6 SSE 사용 컴포넌트에 EventSource.close() cleanup 추가
   - FE-10: Phase 6 대량 목록 페이지에 react-window 검토

2. **GAP-08**: settlement RPC에 `IF p_settlement_amount <= 0 THEN RAISE EXCEPTION` 한 줄 추가

### 구현 단계에서 해결 가능

3. **GAP-05, 06, 07**: FIN-07, FIN-10, DAT-09는 구현 시 서비스 레이어에서 자연스럽게 해결 가능하나, 각 Phase 검증 게이트에 명시적 체크 항목 추가 권고
4. **GAP-09**: logBatch 구현 시 DB 테이블 스키마 확정
5. **GAP-10~13**: audit2.md 참조하여 FIX-13, 16, 17, 18 내용 확인 후 반영 여부 판단

---

*본 감사는 pa1-report.md의 수정권고 전건을 plan3 rev3.md에서 3회 교차 검증하여 작성되었습니다.*
*1차: IMP 13건 매핑, 2차: CHECK 12건 + WHY 11건 매핑, 3차: FIX 18건 + 누락 종합.*
*총 반영 항목: IMP 12/13 + CHECK 7/12 + FIX 14/14(확인 가능) + WHY 11/11 = 44/50 (88%).*
*미반영 핵심 갭: 8건 (HIGH 4, MEDIUM 3, LOW 1).*
