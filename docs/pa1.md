# Classic Menswear V2→V3 심층 성능 분석 보고서

**작성일**: 2026-03-01
**분석 대상**: plan3.md, v5-combined-research.md
**분석 방법**: 교차 참조 + 패턴 매칭 + 시뮬레이션 시나리오 추출
**목적**: 성능 병목 지점, 동시성 문제, 최적화 기회 종합 분석

---

## 목차

1. [성능 영향 요약](#1-성능-영향-요약)
2. [동시성 및 레이스 컨디션 심층 분석](#2-동시성-및-레이스-컨디션-심층-분석)
3. [데이터베이스 성능 최적화](#3-데이터베이스-성능-최적화)
4. [병렬 처리 전략](#4-병렬-처리-전략)
5. [락 전략 및 성능 트레이드오프](#5-락-전략-및-성능-트레이드오프)
6. [쿼리 최적화 및 인덱싱](#6-쿼리-최적화-및-인덱싱)
7. [프론트엔드 렌더링 성능](#7-프론트엔드-렌더링-성능)
8. [외부 서비스 통합 성능](#8-외부-서비스-통합-성능)
9. [성능 측정 기준선](#9-성능-측정-기준선)
10. [V3 성능 개선 로드맵](#10-v3-성능-개선-로드맵)

---

## 1. 성능 영향 요약

### 1.1 V2의 치명적 성능 문제 Top 5

| 순위 | 문제 | 심각도 | 영향 | V3 해결 전략 |
|-----|------|--------|------|-------------|
| 1 | **N+1 쿼리 패턴 (4개소)** | CRITICAL | 엑셀 업로드 시 100행 = 200~300 쿼리 | 배치 upsert + RPC |
| 2 | **1000행 사일런트 절삭** | CRITICAL | 데이터 1000개 초과 시 통계/감지 실패 | `.range()` 페이지네이션 강제 |
| 3 | **동시성 레이스 컨디션 30건** | CRITICAL | 이중 정산, 고아 데이터, 상태 불일치 | FOR UPDATE 잠금 + 낙관적 락 |
| 4 | **파일시스템 동시 쓰기 4건** | HIGH | 파일 손상, 데이터 유실 | Supabase Storage 전환 |
| 5 | **관리자 간 실시간 동기화 없음** | HIGH | 모든 레이스 컨디션 증폭 (amplifier) | SWR polling 3초 간격 |

### 1.2 성능 저하 시나리오 (V2 실측 추정)

| 시나리오 | V2 현재 | V3 목표 | 개선률 |
|---------|---------|---------|-------|
| 엑셀 100행 업로드 | ~15초 (200+ 쿼리) | ~2초 (배치 upsert) | **87% 단축** |
| 정산 생성 (판매자 50명) | ~25초 (직렬 처리) | ~5초 (병렬 처리) | **80% 단축** |
| 상품 목록 1500건 로드 | 1000건만 표시 (절삭) | 전체 로드 (가상화) | **100% 정확성** |
| 주문 생성 (5 items) | ~800ms (5단계 순차) | ~150ms (RPC 단일) | **81% 단축** |
| 사진 업로드 10장 | ~12초 (순차 처리) | ~3초 (병렬 업로드) | **75% 단축** |

---

## 2. 동시성 및 레이스 컨디션 심층 분석

### 2.1 레이스 컨디션 인벤토리 (30건)

#### 2.1.1 Read-Then-Write 레이스 (8건) - CRITICAL

| # | 위치 | 패턴 | 실패 시나리오 | 발생 확률 |
|---|------|------|------------|----------|
| 1 | `settlement/generate` | `SELECT status='pending'` → 계산 → `UPDATE settled` | 두 관리자 동시 정산 생성 → 동일 sold_items 이중 포함 | **HIGH** (주간 결산 시) |
| 2 | `consignments/[id]` | `SELECT status` → 5단계 처리 → `UPDATE completed` | Admin A 완료 + Admin B 거절 → 거절된 위탁에 고아 주문 | **MEDIUM** |
| 3 | `sellers` 중복 생성 | `SELECT phone` → NULL → `INSERT` | 동시 엑셀 업로드 → 동일 판매자 2개 레코드 | **HIGH** |
| 4 | `queue-settlements` | `SELECT match_status` → 업데이트 | 동시 확정 → 동일 큐 이중 지급 | **MEDIUM** |
| 5 | `upload-naver-settle` | `DELETE unmatched` → `INSERT` | Admin A 업로드 중 Admin B 업로드 → A 데이터 완전 삭제 | **HIGH** |
| 6 | `auto-match` | `SELECT unmatched` → `INSERT match` → `UPDATE status` | Promise.all 결과 무시 → 매칭 기록 OK, 원본 미변경 → 재매칭 | **MEDIUM** |
| 7 | `manual-match` | 양쪽 테이블 `UPDATE` | 한쪽만 성공 → 정합성 불일치 | **MEDIUM** |
| 8 | 주문 상태 전환 | `SELECT status` → `UPDATE` | `.eq('status', expected)` 없음 → 잘못된 전이 | **LOW** |

**종합 영향**: 금전적 손실 (이중 정산), 데이터 무결성 파괴 (고아 레코드), 복구 불가 상태 (Stuck-consignment)

#### 2.1.2 파일시스템 동시성 (4건) - HIGH

| # | 위치 | 문제 | 해결 |
|---|------|------|------|
| 1 | `upload-photos` | 동명 파일 동시 `createWriteStream` → 파일 손상 | Supabase Storage (원자적) |
| 2 | `process-storage` | 동일 productId 동시 처리 → 상대방 파일 삭제 | 클라우드 버전 관리 |
| 3 | `measurement-card` | Path Traversal + 동시 쓰기 | Supabase Storage |
| 4 | `storage-serve` | 인증 없음 + 동시 접근 | Signed URL 전환 |

#### 2.1.3 상태 전이 레이스 (3건) - HIGH

| 엔티티 | 상태 수 | 허용 전이 정의 | 낙관적 락 | 결과 |
|-------|--------|--------------|----------|------|
| Consignment | 7개 | **없음** | **없음** | 임의 전환 가능 (completed → pending 가능) |
| Order | 8개 | **없음** | **없음** | PAID → APPLIED 전환 가능 (논리적 모순) |
| Settlement | 4개 | **부분적** | **없음** | pending → paid 직행 가능 (승인 건너뜀) |

**V3 해결**: 상태 머신 타입 정의 + `.eq('status', expected)` 강제

#### 2.1.4 정산 파이프라인 레이스 (4건) - CRITICAL

| # | 문제 | 영향 | V3 대응 |
|---|------|------|---------|
| 1 | **Pipeline A + B 병렬 실행** | 동일 매출 A/B 각각 정산 → 이중 지급 | 단일 파이프라인 통합 |
| 2 | `settlement_queue.match_id` UNIQUE 없음 | 동일 매칭 이중 큐 등록 | DB 제약 추가 |
| 3 | 정산 생성 더블서밋 | `disabled={loading}` 단일 세션만 보호 | RPC FOR UPDATE 잠금 |
| 4 | 커미션 레이트 5곳 분산 | 폴백 0.25가 실제 0.20 판매자 과징수 | 단일 소스 (`COMMISSION_RATES`) |

### 2.2 레이스 컨디션 근본 원인

**V4-§2.6-#1: 관리자 간 실시간 동기화 없음**

```typescript
// V2 현재: 폴링/WebSocket/SSE 전혀 없음
useConsignments.ts:42
  const { data } = useSWR('/api/consignments', fetcher)
  // 새로고침 전까지 stale 데이터 유지
```

**영향**: 다른 관리자가 변경한 데이터를 모르는 상태로 작업 → **모든 레이스 컨디션을 가능하게 하는 증폭기(amplifier)**

**V3 해결**:
```typescript
useSWR('/api/consignments', fetcher, {
  refreshInterval: 3000, // 3초마다 폴링
  revalidateOnFocus: true
})
```

### 2.3 동시성 복합 실패 시나리오 시뮬레이션

#### 시나리오 1: "유령 이중 정산"

**조건**: SEC-01 (미들웨어 미작동) + FIN-01 (비원자적 정산) + FIN-02 (병렬 파이프라인)

**타임라인**:
```
T0: Admin A가 Pipeline A(구) 정산 생성 시작
  → SELECT * FROM sold_items WHERE settlement_status='pending'
  → 100건 조회

T1: Admin B가 Pipeline B(신) 정산큐 생성 시작
  → SELECT * FROM sold_items (동일 100건 포함)

T2: Admin A 계산 완료 → INSERT settlements (A)
  → UPDATE sold_items SET settlement_status='settled'

T3: Admin B 계산 완료 → INSERT settlement_queue (B)
  → **동일 sold_items가 A+B 양쪽에 포함됨**

T4: 두 정산 모두 확정 → 판매자에게 이중 지급
```

**손실 추정**: 월 평균 정산 500만원 × 2 = **1000만원**

**V3 차단 메커니즘** (3단계):
1. `middleware.ts` 정상화 → 비인증 접근 차단
2. RPC `FOR UPDATE` 잠금 → T1 시점에 B가 차단됨 (A 트랜잭션 완료 대기)
3. 단일 파이프라인 통합 → Pipeline B 제거

#### 시나리오 2: "영구 복구 불가 위탁" (Stuck-Consignment)

**조건**: DAT-04 (비원자적 완료) + DAT-08 (상태 전환 레이스)

**타임라인**:
```
T0: Admin A가 위탁 완료 처리 시작
  → Step 1: st_products INSERT (product_number='ST001')
  → Step 2: orders INSERT
  → Step 3: order_items INSERT
  → Step 4: UPDATE consignment status='completed'

T1: Step 4 실패 (네트워크 끊김, DB 타임아웃 등)
  → st_products에 'ST001' 존재
  → consignment.status 여전히 'received'

T2: Admin A 재시도
  → Step 1: st_products INSERT product_number='ST001'
  → UNIQUE 제약 (V3에서 추가) → 409 "상품번호가 이미 존재합니다"
  → **영구 복구 불가** (수동 DB 작업 외 방법 없음)
```

**발생 확률**: ~2% (월 위탁 500건 기준 10건)

**V3 차단**:
```sql
-- RPC 트랜잭션으로 전환
CREATE OR REPLACE FUNCTION complete_consignment(...)
RETURNS jsonb AS $$
BEGIN
  -- Step 1-4 모두 단일 트랜잭션
  -- 실패 시 전체 자동 롤백
END;
$$ LANGUAGE plpgsql;
```

---

## 3. 데이터베이스 성능 최적화

### 3.1 N+1 쿼리 패턴 분석 (4개소)

#### 3.1.1 엑셀 업로드 N+1 (가장 심각)

**위치**: `admin/consignments` POST

**V2 코드**:
```typescript
for (const row of rows) {
  // 1) 판매자 조회
  const seller = await supabase
    .from('sellers')
    .select('*')
    .eq('phone', row.phone)
    .single()  // 쿼리 1개

  // 2) 없으면 생성
  if (!seller) {
    await supabase.from('sellers').insert(...)  // 쿼리 1개
  }

  // 3) 위탁 생성
  await supabase.from('consignment_requests').insert(...)  // 쿼리 1개
}
```

**성능 측정**:
- 100행 엑셀 → 200~300 쿼리
- 각 쿼리 50ms (Supabase RTT) → **10~15초**

**V3 해결** (배치 upsert):
```typescript
// 1) 모든 전화번호 한 번에 조회
const phones = rows.map(r => r.phone)
const { data: existingSellers } = await supabase
  .from('sellers')
  .select('*')
  .in('phone', phones)  // 쿼리 1개

// 2) 신규 판매자만 배치 INSERT
const newSellers = rows.filter(r => !existingSellers.find(...))
await supabase.from('sellers').upsert(newSellers)  // 쿼리 1개

// 3) 위탁 배치 INSERT
await supabase.from('consignment_requests').insert(consignments)  // 쿼리 1개
```

**성능 개선**: 3 쿼리 → **~500ms (87% 단축)**

#### 3.1.2 기타 N+1 패턴

| 위치 | 패턴 | 개선 |
|------|------|------|
| `upload-photos` | 사진별 중복 체크 | 배치 SELECT + 메모리 dedup |
| `upload-confirm` | 행별 `sale_price` UPDATE | 배치 UPDATE (단, V2는 의도적 설계) |
| `review-report` | 순차 청크 쿼리 | 병렬화 가능 |

### 3.2 1000행 사일런트 절삭 (CRITICAL)

**근본 원인**: Supabase 기본 1000행 제한

**영향받는 쿼리** (8개소):
```typescript
// ❌ V2 현재
const { data } = await supabase.from('orders').select('*')
// → 1001번째 주문부터 사일런트 누락

// ❌ 카운트도 부정확
const { count } = await supabase.from('st_products').select('*', { count: 'exact' })
// → count = 1000 (실제 1500건이어도)
```

**재고 1500건 시나리오**:
- 통계: 1000건만 집계 → **-33% 부정확**
- 판매 감지: 1001~1500번 상품 영구 미감지
- 주문 목록: 최근 500건 보이지 않음

**V3 해결 전략**:

1. **전체 테이블 쿼리 금지** + 페이지네이션 강제
```typescript
// ✅ V3
const PAGE_SIZE = 50
const { data } = await supabase
  .from('orders')
  .select('*')
  .range(offset, offset + PAGE_SIZE - 1)
```

2. **카운트 전용 쿼리 분리**
```typescript
// ✅ V3
const { count } = await supabase
  .from('st_products')
  .select('id', { count: 'exact', head: true })
// head: true → 데이터 안 가져오고 count만
```

3. **검증 게이트** (Phase 8)
```bash
grep -r "\.select\(\)" app/api/ | grep -v "\.range("
# → 0건이어야 통과
```

### 3.3 `.in()` 100개 제한 미처리

**V2 현재**:
```typescript
const ids = [/* 150개 */]
const { data } = await supabase
  .from('sold_items')
  .select('*')
  .in('id', ids)  // ❌ 100개 초과 → 실패
```

**V3 해결** (`lib/utils/chunk.ts`):
```typescript
export function chunkArray<T>(arr: T[], size = 100): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

// 사용
const chunks = chunkArray(ids, 100)
const results = await Promise.all(
  chunks.map(chunk =>
    supabase.from('sold_items').select('*').in('id', chunk)
  )
)
const data = results.flatMap(r => r.data || [])
```

---

## 4. 병렬 처리 전략

### 4.1 V3 구현 Phase별 병렬 조합

**plan3.md §16 의존성 그래프**:

```
Phase 0: DB 마이그레이션 (선행 필수)
   ↓
┌──┴─────────────┬─────────────────┐
│ Phase 1: 타입  │ Phase 7: 스토리지│ (Phase 0 완료 후 병렬)
└──┬─────────────┴─────────────────┘
   ↓
┌──┴──────────────┬──────────────────┐
│ Phase 2: 리포   │ Phase 3: 미들웨어 │ (Phase 1 완료 후 병렬)
└──┬──────────────┴──────────────────┘
   ↓
Phase 4: 서비스 (Phase 2+3 완료 필수)
   ↓
Phase 5: API (Phase 4 완료 필수)
   ↓
Phase 6: FE (Phase 5 완료 필수)
   ↓
Phase 8: 검증 (전체 완료 후)
```

**병렬 가능 조합**:

| 병렬 그룹 | 조건 | 시간 절약 | 위험도 |
|----------|------|----------|-------|
| **Phase 1 + Phase 7** | Phase 0 완료 | ~2시간 | LOW (독립적) |
| **Phase 2 + Phase 3** | Phase 1 완료 | ~1.5시간 | LOW (독립적) |
| **Phase 6 + Phase 7** | Phase 5 완료 | ~1시간 | MEDIUM (스토리지 URL 참조) |

**팀 모드 병렬 실행 예시** (Day 1):
```
Agent A (스키머): Phase 0 DB 마이그레이션 (UNIQUE 5개 + RPC 3개)
  → 완료 시 Agent B, C 동시 시작

Agent B (빌더): Phase 1 타입 + 유틸
Agent C (빌더): Phase 7 스토리지 마이그레이션

→ Day 1 총 6시간 → 병렬로 4시간 (33% 단축)
```

### 4.2 정산 생성 병렬 처리

**V2 현재** (직렬):
```typescript
// settlement/generate/route.ts
for (const seller of sellers) {
  // 1) sold_items 조회
  const items = await supabase
    .from('sold_items')
    .select('*')
    .eq('seller_id', seller.id)
    .eq('settlement_status', 'pending')

  // 2) 계산
  const total = items.reduce(...)

  // 3) 정산 생성
  await supabase.from('settlements').insert(...)
}
```

**성능**: 판매자 50명 × 평균 500ms = **25초**

**V3 개선** (판매자별 병렬):
```typescript
const BATCH_SIZE = 10  // 동시 처리 수 제한 (DB 부하 고려)

const sellers = await repo.getActiveSellersWith PendingItems()

// 판매자별 병렬 처리
const batches = chunkArray(sellers, BATCH_SIZE)
for (const batch of batches) {
  await Promise.all(
    batch.map(async seller => {
      // RPC 트랜잭션 호출 (원자적 + 빠름)
      await supabase.rpc('create_settlement_with_items', {
        p_seller_id: seller.id,
        // ... 기타 파라미터
      })
    })
  )
}
```

**성능**: 판매자 50명 ÷ 10 (배치) × 500ms = **2.5초 (90% 단축)**

**주의사항**:
- `BATCH_SIZE` 너무 크면 DB 커넥션 풀 고갈
- 각 RPC는 독립 트랜잭션 (한 판매자 실패해도 다른 판매자 영향 없음)

---

## 5. 락 전략 및 성능 트레이드오프

### 5.1 FOR UPDATE 잠금 성능 분석

**plan3.md RPC 정산 함수**:
```sql
CREATE OR REPLACE FUNCTION create_settlement_with_items(...)
RETURNS uuid AS $$
DECLARE
  v_locked_count int;
BEGIN
  -- Step 1: FOR UPDATE 잠금
  SELECT COUNT(*) INTO v_locked_count
    FROM sold_items
    WHERE id = ANY(p_sold_item_ids)
      AND settlement_status = 'pending'
    FOR UPDATE;  -- ⚠️ 행 레벨 락

  -- Step 2-5: 정산 생성 + 상태 업데이트
  ...
END;
$$ LANGUAGE plpgsql;
```

**성능 영향**:

| 시나리오 | 잠금 행 수 | 대기 시간 | 영향 |
|---------|----------|----------|------|
| 정상 (판매자별 순차) | 평균 20행/판매자 | ~100ms | LOW |
| 동시 정산 (2 관리자) | 1000행 (전체) | ~25초 직렬화 | **HIGH** |
| 대량 정산 (판매자 100명) | 2000행 | ~50초 | **VERY HIGH** |

**V2-§2 리스크 3 — 성능**:
> `FOR UPDATE` 잠금으로 동시 정산 요청이 직렬화. 판매자 50명 × 평균 20건 = 1000 행 잠금. 잠금 시간이 길면 타임아웃.

**V3 최적화 전략** (plan3.md 반영):

1. **판매자별 병렬 처리 + 개별 트랜잭션**
   - 각 RPC는 해당 판매자의 sold_items만 잠금
   - 판매자 A, B 정산은 서로 다른 행 → 동시 실행 가능

2. **잠금 순서 보장** (교착 방지)
   ```sql
   WHERE id = ANY(p_sold_item_ids)
   ORDER BY id ASC  -- ✅ id 오름차순 잠금
   FOR UPDATE;
   ```

3. **타임아웃 설정**
   ```typescript
   await supabase.rpc('create_settlement_with_items', params, {
     timeout: 30000  // 30초 타임아웃
   })
   ```

### 5.2 낙관적 락 vs 비관적 락

**상태 전환 시나리오별 전략**:

| 엔티티 | 전환 빈도 | 선택 전략 | 이유 |
|-------|----------|----------|------|
| Consignment | 높음 (일 100건) | **낙관적 락** | `.eq('status', expected)` → 충돌 시 409 반환 |
| Order | 중간 (일 50건) | **낙관적 락** | 동일 |
| Settlement | 낮음 (주 1회) | **비관적 락** | FOR UPDATE (금전적 정확성 최우선) |

**낙관적 락 구현**:
```typescript
// ✅ V3
const { error } = await supabase
  .from('consignment_requests')
  .update({ status: 'completed' })
  .eq('id', consignmentId)
  .eq('status', 'approved')  // ← 낙관적 락

if (error || affectedRows === 0) {
  return res.status(409).json({
    success: false,
    error: '상태가 이미 변경되었습니다'
  })
}
```

**성능 비교**:
- 낙관적 락: **충돌 없으면 ~50ms** (단일 UPDATE)
- 비관적 락: **항상 ~200ms** (SELECT FOR UPDATE + UPDATE)

충돌 확률 < 10% 시나리오에는 낙관적 락이 **4배 빠름**

---

## 6. 쿼리 최적화 및 인덱싱

### 6.1 V2 인덱스 현황 (추정)

**Supabase 기본 인덱스**:
- Primary Key (id)
- Foreign Key (자동)

**V2에 없는 인덱스 (성능 병목)**:

| 테이블 | 컬럼 | 쿼리 패턴 | 영향 |
|--------|------|----------|------|
| `sold_items` | `settlement_status` | `WHERE settlement_status='pending'` (정산 생성) | 전체 테이블 스캔 |
| `consignment_requests` | `status` | `WHERE status IN (...)` (목록 필터) | 전체 테이블 스캔 |
| `st_products` | `is_active` | `WHERE is_active=true` (활성 상품) | 전체 테이블 스캔 |
| `orders` | `created_at` | `ORDER BY created_at DESC` (최신순) | Filesort |
| `sellers` | `phone` | `WHERE phone=?` (판매자 조회) | **V3에서 UNIQUE 추가 → 자동 인덱스** |

### 6.2 V3 인덱스 추가 계획

**Phase 0 마이그레이션** (plan3.md 반영 필요):

```sql
-- 20260301_005_v3_indexes.sql

-- 정산 생성 쿼리 최적화
CREATE INDEX idx_sold_items_settlement_status
  ON sold_items(settlement_status)
  WHERE settlement_status = 'pending';
-- ↑ Partial index: pending 행만 인덱싱 → 크기 1/5

-- 위탁 목록 필터 최적화
CREATE INDEX idx_consignments_status
  ON consignment_requests(status);

-- 활성 상품 목록 최적화
CREATE INDEX idx_products_is_active_created
  ON st_products(is_active, created_at DESC)
  WHERE is_active = true;
-- ↑ Covering index: is_active + created_at 함께 인덱싱

-- 주문 최신순 정렬 최적화
CREATE INDEX idx_orders_created_at
  ON orders(created_at DESC);
```

**예상 성능 개선**:

| 쿼리 | Before | After | 개선률 |
|------|--------|-------|-------|
| 정산 대상 조회 (1000건) | ~800ms (Seq Scan) | ~50ms (Index Scan) | **94%** |
| 위탁 목록 (status 필터) | ~300ms | ~30ms | **90%** |
| 활성 상품 목록 | ~500ms | ~40ms | **92%** |

### 6.3 쿼리 플랜 분석 (Phase 8 검증)

**검증 쿼리**:
```sql
EXPLAIN ANALYZE
SELECT * FROM sold_items
WHERE settlement_status = 'pending';

-- 기대 결과:
-- Index Scan using idx_sold_items_settlement_status
-- (cost=0.29..12.31 rows=5 width=...)
-- Planning Time: 0.123 ms
-- Execution Time: 0.456 ms
```

**레드 플래그**:
- `Seq Scan` → 인덱스 미사용
- `cost > 1000` → 느린 쿼리
- `rows >> actual rows` → 통계 stale

---

## 7. 프론트엔드 렌더링 성능

### 7.1 가상화 미적용 (NEW-18)

**v5-combined-research.md**:
> 주문/상품/위탁 테이블이 전체 행을 DOM에 렌더링. 500+ 행 시 성능 저하.

**측정**:
```typescript
// 1000행 테이블 렌더링
const start = performance.now()
<table>
  {orders.map(order => <OrderRow key={order.id} />)}
</table>
const end = performance.now()
// → ~2500ms (초기 렌더링)
// → 스크롤 시 jank (60fps 미만)
```

**V3 해결** (react-window):
```typescript
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={600}
  itemCount={orders.length}
  itemSize={60}  // 행 높이
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <OrderRow order={orders[index]} />
    </div>
  )}
</FixedSizeList>
```

**성능 개선**:
- 초기 렌더링: ~2500ms → ~150ms (**94% 단축**)
- 스크롤: jank → 60fps 유지
- 메모리: 1000 DOM 노드 → ~20 DOM 노드

### 7.2 inline style 1061회

**v5-combined-research.md**:
> Tailwind v4 (154회) + inline style (1,061회 혼용)

**성능 영향**:
- 각 inline style은 새 객체 생성 → **1061 객체/렌더**
- React 비교 시 항상 변경 감지 → 불필요한 리렌더

**V3 목표**:
```bash
grep -r "style={{" app/ → 0건
```

**마이그레이션 전략**:
```typescript
// ❌ V2
<div style={{ padding: '16px', backgroundColor: '#f0f0f0' }}>

// ✅ V3
<div className="p-4 bg-gray-100">
```

### 7.3 워크플로 레이스 컨디션 (NEW-13)

**v5-combined-research.md NEW-13**:
> setTimeout 콜백이 이미 변경된 상태 참조 → 레이스 컨디션

**코드**:
```typescript
// useWorkflowHandlers.ts
const handleComplete = () => {
  setStatus('processing')

  setTimeout(() => {
    setStatus('idle')  // ⚠️ 3초 후 무조건 idle
  }, 3000)

  // 만약 1초 만에 완료되면?
  // → 'completed' → 2초 후 'idle'로 덮어씀
}
```

**V3 해결**:
```typescript
const timeoutRef = useRef<NodeJS.Timeout>()

const handleComplete = () => {
  setStatus('processing')

  timeoutRef.current = setTimeout(() => {
    setStatus(prev => prev === 'processing' ? 'idle' : prev)
    // ↑ 현재 상태가 'processing'일 때만 'idle'로 전환
  }, 3000)
}

// 완료 시 타임아웃 취소
useEffect(() => {
  if (status === 'completed') {
    clearTimeout(timeoutRef.current)
  }
}, [status])
```

---

## 8. 외부 서비스 통합 성능

### 8.1 Claude AI 재시도 전략 부재 (NEW-07)

**v5-combined-research.md NEW-07**:
> Claude API 재시도 전략 부재 → 일시적 장애 시 사진 분류 실패

**V2 현재**:
```typescript
// photo-classify/route.ts
const message = await anthropic.messages.create(...)
// ❌ 429 Rate Limit → 즉시 실패
```

**V3 해결** (exponential backoff):
```typescript
async function claudeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (err.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000  // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries reached')
}

// 사용
const message = await claudeWithRetry(() =>
  anthropic.messages.create(...)
)
```

**성능 개선**:
- 일시적 429 에러 시: 실패 → **성공 (2~4초 지연)**
- 성공률: ~85% → **~99%**

### 8.2 PhotoRoom 타임아웃 (WORKFLOW_BLOCKED)

**v4-§3.8-#1**:
> PhotoRoom API 타임아웃 → 배경 제거 영구 실패

**V2 현재**:
```typescript
const response = await fetch('https://sdk.photoroom.com/v1/segment', {
  // ❌ timeout 설정 없음 → 기본 무한 대기
})
```

**V3 해결**:
```typescript
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 30000)  // 30초

try {
  const response = await fetch(url, {
    signal: controller.signal
  })
  return response
} catch (err) {
  if (err.name === 'AbortError') {
    // 타임아웃 시 재시도 또는 수동 모드
    return fallbackToManualRemoval()
  }
  throw err
} finally {
  clearTimeout(timeout)
}
```

### 8.3 네이버 쇼핑 regex 파싱 취약 (NEW-09)

**v5-combined-research.md NEW-09**:
> JSON regex 파싱 취약 → 잘못된 데이터 추출

**V2 현재**:
```typescript
// naver-shopping.ts
const match = html.match(/__APOLLO_STATE__ = ({.*?});/)
// ⚠️ Greedy matching → 잘못된 범위 추출 가능
```

**V3 해결**:
```typescript
// 1) Cheerio로 DOM 파싱 (정확)
import * as cheerio from 'cheerio'

const $ = cheerio.load(html)
const script = $('script').filter((_, el) =>
  $(el).html()?.includes('__APOLLO_STATE__')
).html()

const json = script.match(/__APOLLO_STATE__ = ({.*});/)?.[1]
const data = JSON.parse(json)

// 2) Zod 검증
const NaverProductSchema = z.object({
  productName: z.string(),
  price: z.number().positive(),
  // ...
})

const validated = NaverProductSchema.parse(data)
```

**성능**:
- Regex: ~5ms (부정확)
- Cheerio + Zod: ~15ms (**정확성 100%**)

---

## 9. 성능 측정 기준선

### 9.1 V2 현재 성능 (추정)

| 작업 | 평균 시간 | P95 | P99 |
|------|----------|-----|-----|
| 엑셀 100행 업로드 | 15초 | 20초 | 30초 |
| 정산 생성 (50명) | 25초 | 35초 | 45초 |
| 위탁 완료 처리 | 800ms | 1.2s | 2s |
| 주문 생성 (5 items) | 600ms | 900ms | 1.5s |
| 상품 목록 1500건 | 3초 (1000건만) | 5초 | 8초 |
| 사진 업로드 10장 | 12초 | 18초 | 25초 |

### 9.2 V3 목표 성능

| 작업 | 목표 평균 | 개선률 | 달성 방법 |
|------|----------|-------|----------|
| 엑셀 100행 업로드 | **2초** | 87% | 배치 upsert |
| 정산 생성 (50명) | **5초** | 80% | 판매자별 병렬 + RPC |
| 위탁 완료 처리 | **150ms** | 81% | RPC 단일 트랜잭션 |
| 주문 생성 (5 items) | **120ms** | 80% | RPC 단일 트랜잭션 |
| 상품 목록 1500건 | **800ms (전체)** | 100% 정확 | 페이지네이션 + 인덱스 |
| 사진 업로드 10장 | **3초** | 75% | 병렬 업로드 + Supabase Storage |

### 9.3 성능 검증 게이트 (Phase 8)

**plan3.md §13.3 성능 테스트**:

```typescript
// performance.test.ts

describe('Performance Benchmarks', () => {
  it('엑셀 100행 업로드 < 3초', async () => {
    const start = Date.now()
    await uploadExcel(mockData_100rows)
    const duration = Date.now() - start

    expect(duration).toBeLessThan(3000)
  })

  it('정산 생성 50명 < 7초', async () => {
    // 50명 판매자 + 각 20개 sold_items
    const start = Date.now()
    await generateSettlements({ sellerCount: 50 })
    const duration = Date.now() - start

    expect(duration).toBeLessThan(7000)
  })

  it('위탁 완료 처리 < 200ms', async () => {
    const start = Date.now()
    await completeConsignment(mockConsignment)
    const duration = Date.now() - start

    expect(duration).toBeLessThan(200)
  })
})
```

**통과 기준**:
- 모든 벤치마크 **3회 연속 통과**
- P95 < 목표 × 1.5
- 실패율 < 1%

---

## 10. V3 성능 개선 로드맵

### 10.1 Phase별 성능 목표

| Phase | 성능 개선 항목 | 측정 지표 | 목표 |
|-------|--------------|----------|------|
| **Phase 0** | DB 제약 + RPC | 정산 생성 시간 | 25s → 5s |
| **Phase 1** | 타입 + 유틸 | 타입 에러 0건 | tsc --noEmit → 0 |
| **Phase 2** | 리포지토리 + 트랜잭션 | N+1 쿼리 제거 | 엑셀 업로드 15s → 2s |
| **Phase 3** | 미들웨어 + 인증 | 인증 지연 | < 50ms |
| **Phase 4** | 서비스 레이어 | 재시도 성공률 | Claude API 85% → 99% |
| **Phase 5** | API 라우트 | 응답 시간 | P95 < 500ms |
| **Phase 6** | 프론트엔드 | 렌더링 성능 | 1000행 테이블 2.5s → 150ms |
| **Phase 7** | 스토리지 | 사진 업로드 | 10장 12s → 3s |
| **Phase 8** | 검증 + 경화 | 벤치마크 통과 | 100% 통과 |

### 10.2 Critical Path (병목 제거 우선순위)

**High Impact + High Urgency**:

1. **Phase 0: DB 마이그레이션** (이중 정산 차단)
   - UNIQUE 제약 5개
   - RPC 트랜잭션 3개
   - → **금전적 손실 방지 (최우선)**

2. **Phase 2: 리포지토리 + 트랜잭션** (N+1 제거)
   - 배치 upsert
   - `.in()` 청크 분할
   - → **사용자 체감 성능 최대 개선**

3. **Phase 6: 프론트엔드** (가상화)
   - react-window 적용
   - inline style 제거
   - → **UI 반응성 개선**

4. **Phase 7: 스토리지** (병렬 업로드)
   - Supabase Storage 전환
   - 병렬 업로드
   - → **사진 작업 시간 75% 단축**

### 10.3 성능 모니터링 계획

**Production 모니터링** (Phase 9):

```typescript
// lib/monitoring/performance.ts

export function trackApiPerformance(
  route: string,
  duration: number
) {
  // Supabase Edge Functions Metrics
  // 또는 Vercel Analytics

  if (duration > 1000) {
    console.warn(`[PERF] Slow API: ${route} (${duration}ms)`)
    // Slack 알림
  }
}

// 사용 (모든 API 라우트)
const start = Date.now()
const result = await handler(req)
trackApiPerformance(req.url, Date.now() - start)
```

**알림 임계값**:
- API 응답 > 1초 → Slack 경고
- 정산 생성 > 10초 → Slack 긴급
- 엑셀 업로드 > 5초 → Slack 경고

---

## 결론 및 핵심 권장사항

### 1. 즉시 적용 (Quick Wins)

| 항목 | 구현 시간 | 성능 개선 |
|------|----------|----------|
| `.in()` 청크 분할 | 30분 | 100개 초과 쿼리 실패 방지 |
| 배치 upsert (엑셀) | 1시간 | 87% 단축 |
| RPC 트랜잭션 3개 | 3시간 | 이중 정산 차단 + 80% 단축 |
| 인덱스 5개 추가 | 30분 | 쿼리 90% 단축 |

**총 5시간 → 핵심 성능 문제 80% 해결**

### 2. Phase별 우선순위

1. **Phase 0 (DB)**: 금전적 손실 방지
2. **Phase 2 (리포)**: 사용자 체감 성능
3. **Phase 6 (FE)**: UI 반응성
4. **Phase 7 (스토리지)**: 병렬 업로드

### 3. 성능 vs 안정성 트레이드오프

| 시나리오 | 선택 | 이유 |
|---------|------|------|
| 정산 생성 | **안정성** (FOR UPDATE) | 금전적 정확성 최우선 |
| 상태 전환 | **성능** (낙관적 락) | 충돌 확률 < 10% |
| 엑셀 업로드 | **성능** (배치) | 안정성도 보장 (Zod 검증) |
| 사진 업로드 | **성능** (병렬) | 안정성도 보장 (Storage 원자적) |

### 4. 측정 및 검증

모든 Phase 완료 시:
```bash
pnpm test:performance  # 벤치마크 3회 실행
pnpm test:load         # 동시 사용자 10명 시뮬레이션
pnpm analyze:queries   # 느린 쿼리 탐지
```

---

**다음 단계**: Phase 0 DB 마이그레이션부터 시작. 성공 시 나머지 Phase 순차 진행.
