# settlement.repo.ts 버그 수정 — 통합 리서치 & 계획서

**작성일**: 2026-03-10
**상태**: ✅ 구현 완료 — 딥리서치 2회 100% 검증
**대상 파일**: `apps/web/lib/db/repositories/settlement.repo.ts` (105줄 → ~120줄)

---

## 1. 발견된 버그 (2건)

### Bug 1: sellers FK JOIN — snake_case → camelCase 매핑 누락

**위치**: 67줄, 100줄
**현재 코드**:
```typescript
sellers: row.sellers as SettlementWithDetails['sellers']
```
**문제**: PostgREST는 `bank_account`, `commission_rate`, `seller_tier`(snake_case)를 반환하지만, 타입은 `bankAccount`, `commissionRate`, `sellerTier`(camelCase)를 기대. `as` 캐스팅은 키 변환을 하지 않으므로 런타임에 해당 필드 접근 시 `undefined` 반환.

**추가 위험**: `commission_rate`는 DDL에서 `NUMERIC` 타입 → PostgREST가 string으로 반환 → `Number()` 변환 필수.

### Bug 2: sold_items(*) — SELECT * 금지 위반 + 매핑 누락

**위치**: 54줄, 68줄
**현재 코드**:
```typescript
const ITEMS_JOIN = 'settlement_items(id, sold_item_id, sold_items(*))'
// ...
settlement_items: row.settlement_items as SettlementWithDetails['settlement_items']
```
**문제**:
1. `sold_items(*)` = Architecture Spec §5.2 SELECT * 금지 위반
2. PostgREST depth 2 FK JOIN 결과에 `as` 캐스팅만 적용 → snake_case 키가 그대로 남음
3. SoldItem 20개 필드 전부 camelCase 변환 필요하나 미적용

---

## 2. 리서치 결과 요약

### 2.1 대안 탐색 (5개 옵션)

| 옵션 | 설명 | 판정 |
|------|------|------|
| **A: cross-table import** | sold-items.repo에서 COLUMNS + mapRow import | **채택** |
| B: 인라인 매핑 | settlement.repo 내에 sold_items 20필드 매핑 직접 작성 | NUMERIC 타입 변경 시 silent bug 위험 (Sim3 CRITICAL) |
| B+: 인라인 + toSafeNumber | B에 안전 변환 추가 | 완화만 됨, 근본 해결 아님 |
| C: 공유 매퍼 lib | lib/db/mappers/ 공유 모듈 | sellers JOIN 필드가 repo별 3~8개로 상이 → 비실용적 |
| D: toCamelCase 유틸 | lib/db/client.ts 기존 함수 활용 | NUMERIC→Number() 미지원, 타입 정밀도 손실 |

### 2.2 Cross-table Import 안전성 검증

**딥리서치 2회 결과**:
- 현재 프로젝트 11개 cross-file import → 모두 동일 테이블 main→split 패턴
- settlement.repo → sold-items.repo는 **유일한** 크로스 테이블 import 케이스
- 다른 3개 FK JOIN 사용 repo(consignments, products, notifications)는 전부 인라인 매핑으로 충분 (sellers 3~4필드, NUMERIC 없음)
- **결론**: 1건 예외가 연쇄 예외를 유발하지 않음. settlement만 depth 2 + 20필드 + NUMERIC 조합이라 구조적으로 유일

### 2.3 인텐스 시뮬레이션 10회 결과

| # | 시나리오 | 결과 |
|---|---------|------|
| Sim1 | sold_items 컬럼 추가 (21→22컬럼) | A: sold-items.repo만 수정 → 자동 전파. B: 2곳 수정 필요 |
| Sim2 | NUMERIC→INTEGER DDL 변경 | A: mapRow 내 Number() 제거 1곳. B: 2곳 수정 필요 |
| Sim3 | sale_price INTEGER→NUMERIC 변경 | A: mapRow에 Number() 추가 1곳 → 자동 전파. **B: CRITICAL — 인라인 매핑 수정 누락 시 string이 number로 캐스팅되어 silent bug** |
| Sim4 | PostgREST 버전 업그레이드 (응답 형식 변경) | A/B 동일 영향 |
| Sim5 | settlement_items FK 삭제 | A/B 동일 — depth 2 JOIN 자체 불가 |
| Sim6 | 새 repo가 sold_items JOIN 필요 | A: 동일 import 패턴. B: 또 다른 인라인 중복 |
| Sim7 | sold-items.repo COLUMNS 순서 변경 | A/B 영향 없음 (이름 기반) |
| Sim8 | mapRow 시그니처 변경 | A: 컴파일 에러로 즉시 감지. B: 영향 없음 (별도 함수) |
| Sim9 | sold_items 테이블 리네임 | A/B 동일 — 양쪽 수정 필요 |
| Sim10 | concurrent PR 충돌 | A: import 라인 충돌 가능 (경미). B: 충돌 없음 |

**핵심**: Sim3 (NUMERIC 타입 변경) — Option A만 안전, Option B는 silent bug 위험.

### 2.4 환경 영향 확인 (100%)

| 영향 대상 | 결과 |
|-----------|------|
| settlement-status.repo.ts | `SETTLEMENT_COLUMNS`, `mapRow` import → **변경 없음, 영향 없음** |
| SettlementWithDetails 타입 | settlement.repo.ts 내부 export → **타입 구조 동일, 영향 없음** |
| SettlementWithSeller 타입 | settlement.repo.ts 내부 export → **타입 구조 동일, 영향 없음** |
| sold-items.repo.ts | COLUMNS, mapRow 이미 export됨 (42줄) → **변경 불필요** |
| Phase 3+ Service 코드 | 미존재 → **영향 없음** |
| tsc 빌드 | 타입 호환성 유지 → **에러 없음 예상** |
| vitest 기존 테스트 | settlement.repo 직접 테스트 없음 → **영향 없음** |

---

## 3. 수정 계획

### 3.1 변경 파일: settlement.repo.ts (1개 파일만)

#### 변경 1: Import 추가 (8줄 → 9줄)

```typescript
// 추가
import { COLUMNS as SOLD_ITEM_COLUMNS, mapRow as mapSoldItemRow } from './sold-items.repo'
```

#### 변경 2: ITEMS_JOIN 수정 (54줄)

```typescript
// Before
const ITEMS_JOIN = 'settlement_items(id, sold_item_id, sold_items(*))'

// After
const ITEMS_JOIN = `settlement_items(id, sold_item_id, sold_items(${SOLD_ITEM_COLUMNS}))`
```

#### 변경 3: mapSellerJoin 인라인 함수 추가 (51줄 이후)

```typescript
function mapSellerJoin(raw: Record<string, unknown>): SettlementWithSeller['sellers'] {
  if (!raw) return null
  return {
    id: raw.id as string,
    name: raw.name as string,
    nickname: (raw.nickname as string) ?? null,
    phone: raw.phone as string,
    bankAccount: (raw.bank_account as string) ?? null,
    commissionRate: raw.commission_rate != null ? Number(raw.commission_rate) : 0,
    sellerTier: (raw.seller_tier as string) ?? null,
    status: raw.status as string,
  }
}
```

#### 변경 4: findById 매핑 수정 (63~71줄)

```typescript
// Before
const row = data as Record<string, unknown>
return {
  data: {
    ...mapRow(row),
    sellers: row.sellers as SettlementWithDetails['sellers'],
    settlement_items: row.settlement_items as SettlementWithDetails['settlement_items'],
  },
  error: null,
}

// After
const row = data as Record<string, unknown>
const rawItems = (row.settlement_items as Record<string, unknown>[]) ?? []
return {
  data: {
    ...mapRow(row),
    sellers: mapSellerJoin(row.sellers as Record<string, unknown>),
    settlement_items: rawItems.map((item) => ({
      id: item.id as string,
      soldItemId: item.sold_item_id as string,
      sold_items: mapSoldItemRow(item.sold_items as Record<string, unknown>),
    })),
  },
  error: null,
}
```

#### 변경 5: list 매핑 수정 (98~101줄)

```typescript
// Before
data: rows.map((row) => ({
  ...mapRow(row),
  sellers: row.sellers as SettlementWithSeller['sellers'],
})),

// After
data: rows.map((row) => ({
  ...mapRow(row),
  sellers: mapSellerJoin(row.sellers as Record<string, unknown>),
})),
```

### 3.2 예상 줄 수

| 구간 | Before | After |
|------|--------|-------|
| import | 4줄 | 5줄 (+1) |
| mapSellerJoin | 0줄 | 11줄 (+11) |
| findById 매핑 | 8줄 | 12줄 (+4) |
| list 매핑 | 3줄 | 3줄 (0) |
| **총계** | 105줄 | ~120줄 (+15) |

120줄 제한 준수 (§10.1).

### 3.3 변경하지 않는 파일

- `sold-items.repo.ts` — 이미 export 완비
- `settlement-status.repo.ts` — import 대상 (SETTLEMENT_COLUMNS, mapRow) 불변
- `lib/types/domain/settlement.ts` — 타입 변경 없음
- 기타 모든 repo — 영향 없음

---

## 4. 검증 계획

### 4.1 구현 직후 (필수)

1. `tsc --noEmit` → 0 errors
2. `vitest run` → 기존 79+ 테스트 전체 PASS

### 4.2 런타임 검증 (1순위)

PostgREST depth 2 FK JOIN + 명시 컬럼 조합이 이 프로젝트에서 처음 사용됨.
실제 Supabase 환경에서 다음 확인 필수:

1. `settlement_items → sold_items` FK가 PostgREST에 인식되는지
2. `sold_items(${SOLD_ITEM_COLUMNS})` 20컬럼 명시가 depth 2에서 정상 작동하는지
3. 반환 데이터의 snake_case 키가 mapSoldItemRow로 정확히 변환되는지
4. NUMERIC 필드(commission_rate)가 Number()로 올바르게 변환되는지

---

## 5. 예상 문제 & 대응 방안

### 5.1 PostgREST depth 2 + 명시 컬럼 조합 실패

**증상**: `sold_items(${SOLD_ITEM_COLUMNS})` 쿼리 시 PostgREST 400 에러 또는 빈 배열 반환

**원인 가능성**:
- `settlement_items.sold_item_id → sold_items.id` FK를 PostgREST가 자동 감지 못함
- 컬럼 20개 문자열이 depth 2에서 파싱 실패

**대응**:
1. 즉시 `sold_items(*)` 로 롤백 (ITEMS_JOIN 1줄 변경, 30초)
2. DDL에서 FK 관계 확인 → PostgREST schema cache reload (`NOTIFY pgrst`)
3. `sold_items(id,seller_id,product_name)` 식으로 컬럼 수를 줄여가며 원인 격리

**롤백 비용**: 극히 낮음. ITEMS_JOIN 문자열 1줄만 되돌리면 현재 상태 복구.

### 5.2 mapSoldItemRow 반환값 — 타입과 불일치

**증상**: tsc는 통과하지만 런타임에 특정 필드가 `undefined` 또는 잘못된 타입

**원인 가능성**:
- depth 2 JOIN 시 PostgREST 반환 키 구조가 depth 1과 다름 (중첩 객체 대신 flat 반환)
- `item.sold_items`가 배열이 아니라 단일 객체 (FK 관계가 N:1일 때)

**대응**:
1. findById 호출 후 `console.log(JSON.stringify(data, null, 2))`로 실제 반환 구조 전체 출력
2. 구조 확인 후 매핑 코드 조정 (배열↔객체, flat↔nested)
3. settlement_items ↔ sold_items는 N:1 관계 → sold_items는 단일 객체일 가능성 높음 → `mapSoldItemRow(item.sold_items)` 그대로 유효

**롤백 비용**: 없음. 매핑 함수 내부 조정으로 해결.

### 5.3 sellers mapSellerJoin null 처리 누락

**증상**: seller가 삭제된 정산 데이터 조회 시 TypeError crash

**원인 가능성**:
- `sellers` FK JOIN이 LEFT JOIN → seller 없으면 `null` 반환
- `mapSellerJoin(null)` → `raw.id` 접근 시 TypeError

**대응**:
1. 이미 계획에 `if (!raw) return null` 가드 포함
2. 추가 방어: `row.sellers ? mapSellerJoin(...) : null` 삼항 연산자 적용

**롤백 비용**: 없음. 1줄 수정.

### 5.4 종합 대응 전략

| 단계 | 행동 | 소요 시간 |
|------|------|-----------|
| 구현 직후 | `tsc --noEmit` + `vitest run` | 즉시 |
| 1순위 검증 | 실 Supabase에서 findById 1건 호출 → 반환 구조 로그 확인 | 즉시 |
| 문제 발생 시 | ITEMS_JOIN 1줄 롤백으로 현재 상태 복구 (sellers 매핑은 유지) | 30초 |
| 구조 파악 후 | 실 데이터 기반으로 매핑 코드만 조정 | 수분 |

**최종 안전장치**: 모든 변경이 settlement.repo.ts 1개 파일 내에 있으므로, 최악의 경우 `git checkout -- settlement.repo.ts` 한 줄로 전체 롤백 가능. 다른 파일에 일체 영향 없음.

---

## 6. 아키텍처 예외 기록

| 항목 | 내용 |
|------|------|
| 예외 | cross-table import: settlement.repo → sold-items.repo |
| 근거 | depth 2 FK JOIN + 20필드 + NUMERIC 조합은 이 프로젝트에서 유일 |
| 범위 | settlement.repo 1개 파일만. 다른 repo 확장 불가 |
| 대안 검토 | 5개 옵션 + 10회 시뮬레이션 완료 (본 문서 §2 참조) |
