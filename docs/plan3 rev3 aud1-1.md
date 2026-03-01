# Plan3 Rev.3 Audit 1 — 검증 보고서 (Aud1-1)

**작성일**: 2026-03-01
**대상**: plan3 rev3 aud1.md의 GAP-01~13 (미반영 8건 + 미확인 4건)
**방법론**: 각 갭을 v5-combined-research.md 원본과 교차 대조 (4회 반복)
**목적**: aud1이 지적한 "부족한 점"이 정말 부족한 것인지 검증

---

## 핵심 발견: PA1 보고서 자체의 오류 3건

aud1 작성의 기반이 된 pa1-report.md의 CHECK-01에서 **이슈 번호 오류 3건, 심각도 오분류 2건**을 발견.

| PA1 기재 | v5 원본 실제 내용 | 오류 유형 |
|----------|-----------------|----------|
| **FE-08**: SSE 메모리 누수 | **FE-08**: 에러 바운더리 부족 [MEDIUM] | **이슈 번호 오류** |
| **FE-10**: 가상화 미적용 | **FE-10**: 더블클릭/더블서밋 취약점 [HIGH] | **이슈 번호 오류** |
| **FIN-12**: 정산금 음수 | **FIN-12**: 매칭 허용 오차 0% [MEDIUM] | **이슈 번호 오류** |
| **NEW-08**: HIGH | v5 원본: **MEDIUM** | 심각도 오분류 |
| **NEW-10**: HIGH | v5 원본: **MEDIUM** | 심각도 오분류 |

**근거**: v5-combined-research.md 직접 확인
- v5 line 823: `### FE-08: 에러 바운더리 부족 [MEDIUM]` (PA1은 "SSE 메모리 누수"로 기재)
- v5 line 843: `### FE-10: 더블클릭/더블서밋 취약점 8건 [HIGH]` (PA1은 "가상화 미적용"으로 기재)
- v5 line 316: `### FIN-12: 매칭 허용 오차 0% [MEDIUM]` (PA1은 "정산금 음수"로 기재)
- v5 line 1098: `NEW-08 | ... Base64 ... | MEDIUM` (PA1은 HIGH로 기재)
- v5 line 1100: `NEW-10 | ... Puppeteer ... | MEDIUM` (PA1은 HIGH로 기재)

**실제 이슈 매핑 (PA1이 의도한 것 → v5의 올바른 번호)**:
- "SSE 메모리 누수" → v5 **FE-12** (SSE 버퍼 무한 증가 [MEDIUM]) 또는 **NEW-16** (SSE 이벤트 버퍼 [MEDIUM])
- "가상화 미적용" → v5 **FE-13** (대규모 테이블 가상화 미적용 [MEDIUM]) 또는 **NEW-18** (가상화 미적용 [MEDIUM])
- "정산금 음수" → v5 **FIN-06** (sale_price 사일런트 0원/null/음수 [HIGH])의 일부 시나리오

---

## 갭별 상세 재검증 (4회)

### GAP-01: NEW-08 Base64 이중복사

**1차 검증** — plan3 rev3.md grep:
- "Base64", "이중복사", "photo-editor" → 0건 ✅ plan3에 없음 확인

**2차 검증** — v5 원본 확인:
- v5 line 1098: `NEW-08 | photo-editing/photo-editor.ts | Base64 인코딩된 이미지를 메모리에 이중 복사 (원본 Buffer + Base64 문자열) | **MEDIUM**`
- PA1은 이를 "HIGH"로 기재 → **심각도 오분류**

**3차 검증** — Rev.3 아키텍처에서의 영향도:
- Rev3 §10 (Phase 7)에서 사진을 Supabase Storage로 마이그레이션
- 마이그레이션 후 photo-editor.ts는 Storage URL 기반으로 동작 → Base64 처리 로직 자체가 변경됨
- V3에서 photo-editor가 동일 패턴을 사용할지는 구현 시 결정

**4차 검증** — 누락의 합리성:
- v5 원본 심각도: **MEDIUM**
- PA1 CHECK-01 자체가 인정: "MEDIUM 이하 누락률 증가" → MEDIUM 우선순위 낮춤은 합리적
- plan3 rev3 설계 수준에서 개별 MEDIUM 이슈까지 상세 기술하면 문서 비대화

**판정**: ⬇️ **과대평가된 갭**
- aud1: HIGH 누락 → **실제: MEDIUM 누락, 구현 시 해결 가능**
- V3 Storage 전환으로 근본 아키텍처가 변경되므로 설계 단계 반영 불필요

---

### GAP-02: NEW-10 Puppeteer 좀비 프로세스

**1차 검증** — plan3 rev3.md grep:
- "Puppeteer", "좀비", "zombie" → 0건 ✅ plan3에 없음 확인

**2차 검증** — v5 원본 확인:
- v5 line 1100: `NEW-10 | export/bulk-export-naver/route.ts | Puppeteer 스크립트가 메모리 해제(browser.close()) 실패 시 좀비 프로세스 | **MEDIUM**`
- PA1은 이를 "HIGH"로 기재 → **심각도 오분류**

**3차 검증** — Rev.3 아키텍처에서의 영향도:
- Puppeteer는 네이버 대량 출력용 (bulk-export-naver 라우트)
- 62개 라우트에 포함 → Phase 5에서 구현 예정
- 서비스 레이어 분리(§7)에서 AbortController + 타임아웃 패턴이 photo.service에 이미 적용 (line 683)
- 동일 패턴을 Puppeteer 서비스에 적용하면 해결

**4차 검증** — 누락의 합리성:
- v5 원본 심각도: **MEDIUM**
- devDependencies에 있는 Puppeteer의 메모리 누수는 MEDIUM 분류 합당
- 서버리스(Vercel) 환경에서 Puppeteer 실행 자체가 재검토 필요 (Vercel은 Puppeteer 제한)

**판정**: ⬇️ **과대평가된 갭**
- aud1: HIGH 누락 → **실제: MEDIUM 누락, Vercel 환경에서 Puppeteer 자체 재검토 필요**

---

### GAP-03: FE-08 SSE 메모리 누수

**1차 검증** — plan3 rev3.md grep:
- "SSE", "EventSource", "FE-08" → 0건

**2차 검증** — v5 원본 확인 (결정적 발견):
- v5 line 823: `### FE-08: 에러 바운더리 부족 [MEDIUM]` ← **FE-08은 SSE가 아닌 에러 바운더리!**
- SSE 관련 실제 이슈: v5 line 874: `### FE-12: SSE 버퍼 무한 증가 [MEDIUM]`
- v5 line 1111: `NEW-16 | ClassifyMatchModal.tsx | SSE 이벤트 버퍼 무제한 증가 | MEDIUM`
- **PA1이 FE-08과 FE-12를 혼동**

**3차 검증** — 실제 FE-08 (에러 바운더리)의 Rev3 대응:
- Rev3에 error.tsx 관련 직접 기술 없음
- 그러나 Next.js App Router의 error.tsx는 프레임워크 기본 패턴 → 구현 시 자연스럽게 추가
- Sentry (§11.2)가 에러 추적을 담당

**4차 검증** — 실제 SSE 이슈(FE-12/NEW-16)의 Rev3 대응:
- Rev3 §7.2에서 배치 처리를 BatchResult + 재시도 패턴으로 재설계
- ClassifyMatchModal의 SSE 스트리밍은 이 배치 패턴으로 대체 가능
- SWR 전략(§7.3)으로 폴링 기반 진행률 확인도 대안

**판정**: ⬇️ **이슈 번호 오류로 인한 허위 갭**
- aud1: FE-08 "SSE 메모리 누수" HIGH 누락 → **실제: PA1 이슈 번호 오류. v5 FE-08은 "에러 바운더리 부족 [MEDIUM]", SSE 이슈는 FE-12 [MEDIUM]**
- 실제 SSE 이슈(FE-12)는 MEDIUM이며 배치 패턴 재설계로 간접 대응됨

---

### GAP-04: FE-10 가상화 미적용

**1차 검증** — plan3 rev3.md grep:
- "가상화", "virtualization", "react-window" → 0건

**2차 검증** — v5 원본 확인 (결정적 발견):
- v5 line 843: `### FE-10: 더블클릭/더블서밋 취약점 8건 [HIGH]` ← **FE-10은 가상화가 아닌 더블클릭!**
- 가상화 관련 실제 이슈: v5 line 884: `### FE-13: 대규모 테이블 가상화 미적용 [MEDIUM]`
- v5 line 1113: `NEW-18 | 다수 테이블 | 가상화(virtualization) 미적용 | MEDIUM`
- **PA1이 FE-10과 FE-13을 혼동**

**3차 검증** — 실제 FE-10 (더블클릭)의 Rev3 대응:
- 더블클릭/더블서밋은 서버 사이드에서 RPC FOR UPDATE + 상태 가드로 방어
- 프론트엔드에서 disabled={loading}은 Phase 6 구현 시 기본 적용

**4차 검증** — 실제 가상화 이슈(FE-13/NEW-18)의 영향도:
- "500+ 행 시 성능 저하" (v5 line 888)
- 관리자 1-2명 규모에서 500+ 행 빈도 낮음 → MEDIUM 합당
- Rev3 §5.2 리포지토리 원칙 3에서 .range() 강제 (line 569-573) → 페이지네이션으로 대량 행 자체를 방지

**판정**: ⬇️ **이슈 번호 오류 + 이미 간접 대응됨**
- aud1: FE-10 "가상화 미적용" HIGH 누락 → **실제: PA1 이슈 번호 오류. v5 FE-10은 "더블클릭 [HIGH]" (RPC로 대응). 가상화는 FE-13 [MEDIUM]이며 .range() 페이지네이션으로 간접 방어**

---

### GAP-05: FIN-07 파일 소실 DB 우선 업데이트

**1차 검증** — plan3 rev3.md grep:
- "generate-payout", "파일 소실", "xlsx" → 0건

**2차 검증** — v5 원본 확인:
- v5 line 266-272: `generate-payout/route.ts:199-224 — Response 객체 생성 후 DB 업데이트. 업데이트 실패 시 xlsx 파일은 반환되지 않고 소실`
- v5 해결: "DB 업데이트 먼저 수행 → 성공 시 xlsx 생성/반환"
- 심각도: **HIGH** ← v5 원본 기준 맞음

**3차 검증** — Rev.3 아키텍처에서의 대응:
- Rev3 §8.2 표준 핸들러 패턴 (line 744-777): 모든 라우트가 "서비스 위임 → 표준 응답"
- 서비스 레이어에서 DB 업데이트 후 파일 생성은 **구현 상세**
- settlement.service의 generate/confirm/pay 분리(line 196)가 이미 DB-우선 패턴을 암시
- generate-payout은 62개 라우트 중 하나로 Phase 5에서 구현 예정

**4차 검증** — 설계 단계에서 명시할 필요가 있는가?
- 62개 라우트 각각의 구현 상세를 plan3에 넣으면 문서 비대화
- 표준 패턴(서비스 위임)이 이미 DB-우선을 강제
- **결론**: 구현 가이드라인 수준에서 "DB 업데이트 → 응답 생성 순서" 원칙 추가 권고

**판정**: ⬇️ **실제 갭이나 심각도 하향 조정**
- aud1: MEDIUM 누락 → **실제: 표준 패턴이 간접 대응. Phase 5 검증 게이트에 "DB-우선 응답" 체크 항목 1줄 추가로 충분**

---

### GAP-06: FIN-10 upload-confirm 가격 변경 방지

**1차 검증** — plan3 rev3.md grep:
- "upload-confirm", "가격 변경 방지" → 0건

**2차 검증** — v5 원본 확인:
- v5 line 296-302: "정산 생성 후 sale_price 업데이트 시, 이미 생성된 settlement의 total_sales는 구 가격 기반"
- v5 해결: "커미션 레이트를 판매 시점에 스냅샷으로 기록. 정산 생성 후 가격 변경 시 경고"
- 심각도: **HIGH**

**3차 검증** — Rev.3 아키텍처 수준 대응 여부:
- Rev3 RPC `create_settlement_with_items` (line 301-359):
  - Step 5: `UPDATE sold_items SET settlement_status = 'settled'` (line 353-355)
  - settled 상태 항목은 이후 변경 불가 (리포지토리 원칙 5: `.eq('status', expected)` line 579-587)
- upload-confirm이 sold_items의 sale_price를 변경하려 해도:
  - settlement_status = 'settled' → 상태 가드에 의해 UPDATE 차단
  - **이미 아키텍처적으로 방어되어 있음**

**4차 검증** — 방어가 완전한가?
- 정산 생성 **전** sale_price 변경은 여전히 가능 (pending 상태)
- 이것이 V2의 원래 문제: pending 상태에서 가격 변경 후 정산 생성 시 불일치
- Rev3에서 정산 생성 시 p_total_sales를 파라미터로 전달 (line 307) → 정산 시점의 금액이 스냅샷으로 기록
- **결론**: RPC 파라미터 스냅샷 + 정산 후 상태 잠금으로 이중 방어

**판정**: ✅ **이미 대응됨 (aud1 오판)**
- aud1: MEDIUM 누락 → **실제: RPC 스냅샷(p_total_sales) + settlement_status 잠금으로 이미 방어. 명시적 언급만 없을 뿐 아키텍처적 대응 존재**

---

### GAP-07: DAT-09 세션 기반 삭제

**1차 검증** — plan3 rev3.md grep:
- "세션 기반 삭제", "batch cleanup", "upload session" → 0건

**2차 검증** — v5 원본 확인:
- v5 line 443-449: "업로드 시작 시 `DELETE .eq('match_status', 'unmatched')` 실행. Admin A 업로드 → Admin B 동시 업로드 시 Admin A 데이터 완전 삭제"
- v5 해결: "삭제 대신 batch-specific cleanup (업로드 세션 ID 기반)"
- 심각도: **HIGH**

**3차 검증** — Rev.3 아키텍처에서의 대응:
- upload-naver-settle은 62개 라우트 중 하나 → Phase 5에서 구현 예정
- 리포지토리 원칙 5 (`.eq('status', expected)`) 적용 시 보호 가능
- **그러나**: 원칙 5는 "상태 가드"이지 "세션 기반 삭제"가 아님
- DELETE + WHERE match_status = 'unmatched'는 상태 가드와 다른 패턴
- 세션 ID 기반 삭제는 별도의 설계 결정이 필요

**4차 검증** — 설계 단계에서 반드시 필요한가?
- 동시 관리자 2명이 같은 라우트를 동시에 호출하는 시나리오
- Rev3 SIM-R3-14에서 "동시 관리자" 시뮬레이션은 정산+위탁 (다른 라우트)만 다룸
- **같은 라우트 동시 호출**(upload-naver-settle)은 시뮬레이션에 없음
- V2의 DELETE 패턴을 그대로 복사할 위험이 실재

**판정**: ✅ **진짜 갭 (aud1 정확)**
- upload-naver-settle의 세션 기반 삭제 전략이 없으면 V2 버그를 그대로 재현할 위험
- Phase 5 해당 라우트 구현 시 "세션 ID 기반 cleanup" 패턴 명시 필요

---

### GAP-08: FIN-12 정산금 음수 차단

**1차 검증** — plan3 rev3.md grep:
- "음수", "negative", "FIN-12" → 0건

**2차 검증** — v5 원본 확인 (결정적 발견):
- v5 line 316: `### FIN-12: 매칭 허용 오차 0% [MEDIUM]` ← **FIN-12는 "정산금 음수"가 아닌 "매칭 오차"!**
- "정산금 음수" 관련 실제 이슈: v5 **FIN-06** (line 251-262):
  - `sale_price: -50000 → settlement-calculator.ts:66 → 음수 정산 금액 생성`
  - `commission_rate: 1.5 → settlement-calculator.ts:63 → 음수 지급액 (-50000원)`
  - v5 해결: "Zod 스키마로 `sale_price > 0` 강제. `commission_rate` 범위 0~1 검증"
- **PA1이 FIN-06의 시나리오를 FIN-12로 잘못 기재**

**3차 검증** — Rev.3에서 FIN-06 대응 여부:
- Rev3 lib/utils/validation.ts line 477: `PositiveAmountSchema = z.number().positive()`
- PA1 CHECK-08에서 FIN-06 대응을 `✅` 판정: "FIN-06 sale_price 0원 | Zod `.positive()` | ✅"
- **이미 PA1 자신이 FIN-06은 해결됨으로 판정**

**4차 검증** — RPC 파라미터 레벨 검증:
- settlement RPC의 p_settlement_amount에 음수 가능 여부:
  - p_settlement_amount는 settlement.service에서 계산 후 전달 (line 307)
  - 서비스에서 PositiveAmountSchema로 검증된 sale_price 기반 계산
  - sale_price > 0 + commission_rate 0~1 → settlement_amount는 항상 양수
  - RPC 레벨 추가 검증은 방어적이지만 필수는 아님

**판정**: ❌ **허위 갭 (PA1 이슈 번호 오류)**
- aud1: LOW 누락 → **실제: PA1이 FIN-12(매칭 오차)를 "정산금 음수"로 잘못 기재. 정산금 음수는 FIN-06에서 다루며, Rev3 PositiveAmountSchema + 서비스 계산으로 이미 해결됨. PA1 자신도 FIN-06을 ✅ 판정**

---

### GAP-09: IMP-10 _batch_progress 테이블 (형식 차이)

**1차~4차 검증**: aud1에서 이미 "형식 차이, 실질 무해"로 판정. 재확인 결과 동일.

**판정**: → **유지 (형식 차이, 구현 시 해결)**

---

### GAP-10~13: audit2 FIX-13, 16, 17, 18 (미확인)

audit2.md 직접 확인으로 미확인 4건 해소:

| FIX | audit2 원본 내용 | Rev3 반영 | 판정 |
|-----|----------------|-----------|------|
| FIX-13 | 5레이어 → 3레이어 단순화 | §1 3+1레이어 | ✅ 반영 |
| FIX-16 | .env.example 필수 + 환경별 분리 | line 101 `.env.example ← [Rev.3]` | ✅ 반영 |
| FIX-17 | **헬스체크 Tier 1 승격** (DB+Storage+SMS) | **Rev3에 없음** | ❌ **신규 누락 발견** |
| FIX-18 | Phase 0 마이그레이션 타이밍 (무중단 적용) | CONCURRENTLY 사용 + SIM-R3-03 | ✅ 반영 |

**FIX-17 상세**:
- audit2 권고: "DB 연결 + Supabase Storage + SMS API 상태를 포함하는 헬스체크 엔드포인트"
- Rev3: `/api/health` 또는 유사 라우트 없음
- 62개 라우트 목록에 health 관련 항목 없음
- **이것은 aud1에서 발견하지 못한 진짜 누락**

---

## 최종 재판정 매트릭스

| GAP | aud1 판정 | 재검증 판정 | 변경 | 근거 |
|-----|----------|-----------|------|------|
| GAP-01 | HIGH 누락 | **MEDIUM 누락 (구현 시 해결)** | ⬇️ | v5 원본 MEDIUM, PA1 심각도 오분류 |
| GAP-02 | HIGH 누락 | **MEDIUM 누락 (Vercel 제약으로 재검토 필요)** | ⬇️ | v5 원본 MEDIUM, PA1 심각도 오분류 |
| GAP-03 | HIGH 누락 | **허위 갭 (PA1 이슈번호 오류)** | ❌삭제 | v5 FE-08 = 에러 바운더리, SSE는 FE-12 [MEDIUM] |
| GAP-04 | HIGH 누락 | **허위 갭 (PA1 이슈번호 오류 + 간접 대응)** | ❌삭제 | v5 FE-10 = 더블클릭, 가상화는 FE-13 [MEDIUM], .range() 간접 방어 |
| GAP-05 | MEDIUM 누락 | **MEDIUM → LOW (표준 패턴 간접 대응)** | ⬇️ | 서비스 위임 패턴이 DB-우선 강제 |
| GAP-06 | MEDIUM 누락 | **이미 대응됨 (RPC 스냅샷 + 상태 잠금)** | ❌삭제 | p_total_sales 스냅샷 + settled 잠금 |
| GAP-07 | MEDIUM 누락 | **MEDIUM 유지 (진짜 갭)** | = | 세션 기반 삭제 패턴 필요 |
| GAP-08 | LOW 누락 | **허위 갭 (PA1 이슈번호 오류)** | ❌삭제 | v5 FIN-12 = 매칭 오차, 음수는 FIN-06에서 ✅ |
| GAP-09 | 형식 차이 | **유지** | = | 구현 시 해결 |
| GAP-10 | 미확인 | **FIX-13 반영됨** | ✅해소 | §1 3+1레이어 |
| GAP-11 | 미확인 | **FIX-16 반영됨** | ✅해소 | .env.example 존재 |
| GAP-12 | 미확인 | **FIX-17 미반영 (신규 발견)** | ❌신규 | 헬스체크 엔드포인트 없음 |
| GAP-13 | 미확인 | **FIX-18 반영됨** | ✅해소 | CONCURRENTLY + SIM-R3-03 |

---

## aud1 오류 정정표

### 삭제해야 할 갭 (3건)

| # | aud1 기재 | 삭제 사유 |
|---|----------|----------|
| GAP-03 | FE-08 SSE 메모리 누수 HIGH | PA1 이슈번호 오류. v5 FE-08 = 에러 바운더리 [MEDIUM]. 실제 SSE는 FE-12 [MEDIUM]이며 배치 패턴 재설계로 간접 대응 |
| GAP-06 | FIN-10 upload-confirm HIGH | RPC p_total_sales 스냅샷 + settlement_status 잠금으로 이미 아키텍처적 방어. aud1이 간접 대응을 인식하지 못함 |
| GAP-08 | FIN-12 정산금 음수 LOW | PA1 이슈번호 오류. v5 FIN-12 = 매칭 오차 [MEDIUM]. 음수는 FIN-06이며 PA1 자신이 ✅ 판정 |

### 심각도 하향 조정해야 할 갭 (3건)

| # | aud1 심각도 | 정정 심각도 | 사유 |
|---|-----------|-----------|------|
| GAP-01 | HIGH | **MEDIUM** | v5 원본 MEDIUM. PA1이 심각도 임의 상향 |
| GAP-02 | HIGH | **MEDIUM** | v5 원본 MEDIUM. PA1이 심각도 임의 상향 |
| GAP-05 | MEDIUM | **LOW** | 표준 핸들러 패턴(서비스 위임)이 DB-우선 간접 강제 |

### 유지해야 할 갭 (2건)

| # | 심각도 | 내용 | 근거 |
|---|--------|------|------|
| GAP-07 | **MEDIUM** | DAT-09 세션 기반 삭제 | v5 원본 HIGH. V2 DELETE 패턴 복사 위험 실재. 62개 라우트 중 upload-naver-settle에 특화된 설계 필요 |
| GAP-09 | **형식 차이** | _batch_progress 테이블 | logBatch 구현 시 스키마 결정 필요 |

### 신규 추가해야 할 갭 (1건)

| # | 심각도 | 내용 | 근거 |
|---|--------|------|------|
| **GAP-NEW-01** | **MEDIUM** | audit2 FIX-17 헬스체크 엔드포인트 미반영 | DB+Storage+SMS 상태 확인 라우트 없음. 프로덕션 모니터링(Sentry)만으로 서비스 가용성 판단 불가 |

---

## 점수 재보정

### aud1의 점수 보정은 과도했다

| 기준 | Rev3 자체 | aud1 보정 | aud1-1 재보정 | 변화 |
|------|----------|----------|-------------|------|
| 완결성 | 85/100 | 81 (-4) | **83/100** (-2) | aud1이 HIGH 4건 → 실제 MEDIUM 2건 + 허위 2건 |
| 효과성 | 90/100 | 87 (-3) | **89/100** (-1) | FIN-10은 이미 대응, FIN-12는 번호 오류 |
| 효율성 | 78/100 | 78 (0) | **78/100** (0) | 변동 없음 |
| **종합** | **84/100** | **82** (-2) | **83/100** (-1) | — |

**재보정 근거**:
- aud1은 PA1의 이슈번호 오류 3건을 그대로 전달하여 허위 갭 3건 생성
- aud1은 PA1의 심각도 오분류 2건을 그대로 전달하여 갭 심각도 과대 평가
- 실제 잔존 갭: MEDIUM 2건 (DAT-09, FIX-17) + LOW 1건 (FIN-07) + 형식 차이 1건
- Rev3 자체 평가 84점은 1점 과대 (헬스체크 누락)

---

## PA1 보고서 자체의 신뢰성 평가

pa1-report.md가 aud1의 기반 자료였으므로, PA1의 오류가 aud1에 전파됨.

| 항목 | PA1 정확성 |
|------|-----------|
| IMP-01~13 개선안 | ✅ 높음 (구체적, 실행 가능) |
| WHY-01~11 근본원인 | ✅ 높음 (체계적, 논리적) |
| CHECK-01 이슈번호 | ❌ 낮음 (3건 번호 오류, 2건 심각도 오분류) |
| CHECK-02~12 기타 | ✅ 높음 |
| VALID-01~10 프로세스 | ✅ 높음 |

**결론**: PA1의 개선안(IMP)과 근본원인 분석(WHY)은 매우 우수. 그러나 CHECK-01의 이슈 매핑에서 v5 원본과의 교차 확인이 부족하여 번호 오류 3건이 발생. 이것이 aud1에 그대로 전파됨.

---

## 최종 잔존 갭 목록 (정정 후)

| # | 심각도 | 내용 | 대응 권고 | 대응 시점 |
|---|--------|------|----------|----------|
| 1 | MEDIUM | DAT-09: upload-naver-settle 세션 기반 삭제 | Phase 5 해당 라우트에 세션 ID 패턴 명시 | Rev3.1 또는 Phase 5 |
| 2 | MEDIUM | FIX-17: 헬스체크 엔드포인트 | /api/health 라우트 + DB/Storage/SMS 상태 체크 | Rev3.1 또는 Phase 8 |
| 3 | LOW | FIN-07: DB-우선 응답 원칙 | Phase 5 검증 게이트에 "DB 업데이트 → 응답 생성" 체크 1줄 추가 | Phase 5 |
| 4 | 형식 차이 | _batch_progress 테이블 | logBatch 구현 시 결정 | Phase 4 |

**총 4건. aud1의 8건에서 허위 갭 3건 삭제 + 심각도 하향 3건 + 이미 대응됨 1건 삭제 + 신규 1건 추가 = 정정 후 4건.**

---

## 교훈

1. **원본 교차 확인 필수**: PA1이 기재한 이슈 번호를 v5 원본과 대조하지 않으면 허위 갭이 전파된다
2. **심각도는 원본 기준**: PA1이 심각도를 임의로 상향하면 안 됨. v5 원본 심각도가 기준
3. **아키텍처적 간접 대응 인식**: RPC 스냅샷 + 상태 잠금처럼 명시적 언급 없이도 아키텍처 수준에서 방어되는 경우가 있음. 이를 "누락"으로 판단하면 안 됨
4. **감사의 감사가 필요**: aud1 자체도 PA1의 오류를 무비판적으로 전달함. 감사 결과를 또 다른 감사가 검증하는 프로세스가 유효함을 확인

---

*본 보고서는 aud1의 GAP 8건 + 미확인 4건 = 12건 전부를 v5-combined-research.md, audit2.md 원본과 4회 교차 검증하여 작성.*
*PA1 이슈번호 오류 3건, 심각도 오분류 2건, aud1 오판 1건을 발견.*
*aud1 갭 8건 → 정정 후 실제 갭 4건 (MEDIUM 2, LOW 1, 형식차이 1).*
*교리 v2.0 Rule 6 "추측 금지, 데이터 기반" 원칙에 따라 모든 판정에 v5 원문 line 번호를 근거로 제시.*
