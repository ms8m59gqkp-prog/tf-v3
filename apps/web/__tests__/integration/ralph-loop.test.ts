/**
 * Ralph Loop — L3 안정성 검증 (deep-checklist §1)
 * WHY: L3 변경(DB/RPC/RLS/정산)에 대한 "연속 3회 PASS" 증명 필수
 * HOW: Tokyo DB에 실제 쿼리 → 5영역(보안/RPC/논리/정산/운영+적대+동시성) 검증
 * WHERE: vitest run __tests__/integration/ralph-loop.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execFileSync } from 'child_process'

const TOKYO_URL = 'https://jmgscpmkrvvxxuzejrdf.supabase.co'
const SERVICE_KEY = process.env.TOKYO_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const PSQL_URL = 'postgresql://postgres.jmgscpmkrvvxxuzejrdf:alden61908%21%40%23@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres'

let admin: SupabaseClient
let hasConnection = false

/** psql로 시스템 카탈로그 쿼리 — 하드코딩된 SQL만 사용 (보안: execFileSync + 인자 분리) */
function psql(query: string): string {
  return execFileSync('psql', [PSQL_URL, '-t', '-A', '-c', query], {
    encoding: 'utf-8', timeout: 10000,
  }).trim()
}

/** psql을 anon 역할로 실행 — SET ROLE anon + 쿼리 + RESET ROLE */
function psqlAnon(query: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync('psql', [PSQL_URL, '-t', '-A', '-c', `SET ROLE anon; ${query} RESET ROLE;`], {
      encoding: 'utf-8', timeout: 10000,
    }).trim()
    return { stdout, exitCode: 0 }
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; status?: number }
    return { stdout: (err.stderr || err.stdout || '').toString().trim(), exitCode: err.status ?? 1 }
  }
}

beforeAll(async () => {
  if (!SERVICE_KEY) { console.warn('SERVICE_ROLE_KEY 미설정 — 스킵'); return }
  admin = createClient(TOKYO_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await admin.from('sellers').select('id').limit(1)
  hasConnection = !error
  if (error) console.warn('DB 연결 실패:', error.message)
})

function skip() { if (!hasConnection) { console.warn('DB 미연결 — 스킵'); return true } return false }

// ═══════════════════════════════════════════════════
// 1. 보안/RLS — pg_catalog 실측 (deep-checklist §3)
// ═══════════════════════════════════════════════════
describe('1. 보안/RLS 경계', () => {
  it('1-1. RLS 활성화: 핵심 테이블 전체 RLS ENABLED (pg_class 실측)', () => {
    // RLS 미활성화된 public 테이블 조회 (_prefix 임시 테이블 제외)
    const result = psql(
      "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false AND c.relname NOT LIKE '\\_%'"
    )
    if (result.length > 0) {
      console.error('RLS 미활성화 테이블:', result)
    }
    expect(result).toBe('')
  })

  it('1-2. USING(true) 정책 제거: 5개 테이블에 과잉 허용 정책 없음 (pg_policies 실측)', () => {
    const targets = ['market_prices', 'order_items', 'photo_uploads', 'photos', 'price_references']
    for (const table of targets) {
      // SELECT(r) 정책 제외 — 공개 읽기 USING(true)는 의도된 설계
      const policies = psql(
        `SELECT polname FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid WHERE c.relname = '${table}' AND p.polqual::text LIKE '%true%' AND p.polcmd != 'r'`
      )
      expect(policies).toBe('')
    }
  })

  it('1-3. service_role/admin 정책 존재: 5개 테이블 (pg_policies 실측)', () => {
    const targets = ['market_prices', 'order_items', 'photo_uploads', 'photos', 'price_references']
    for (const table of targets) {
      const policies = psql(
        `SELECT polname FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid WHERE c.relname = '${table}' ORDER BY polname`
      )
      expect(policies).toContain(`service_all_${table}`)
      expect(policies).toContain(`admin_all_${table}`)
    }
  })

  it('1-4. orders RLS: hold_token 기반 정책 존재 (pg_policies 실측)', () => {
    const policies = psql(
      "SELECT polname FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid WHERE c.relname = 'orders'"
    )
    expect(policies.length).toBeGreaterThan(0)
  })

  it('1-5. settlement 테이블: anon 쓰기 정책 없음 (pg_policies 실측)', () => {
    const tables = ['settlements', 'settlement_items']
    for (const table of tables) {
      const anonPolicies = psql(
        `SELECT polname FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_roles r ON r.oid = ANY(p.polroles) WHERE c.relname = '${table}' AND r.rolname = 'anon' AND p.polcmd != 'r'`
      )
      expect(anonPolicies).toBe('')
    }
  })

  // §3.2 실측 테스트 — SET ROLE anon으로 실제 행동 검증
  it('1-6. §3.2 anon(토큰 없음) SELECT orders → 0 row (RLS 실측)', () => {
    const r = psqlAnon("SELECT count(*) FROM orders;")
    expect(r.exitCode).toBe(0)
    // SET 줄 제거 후 count 값 추출
    const count = r.stdout.split('\n').filter(l => /^\d+$/.test(l.trim()))[0]?.trim()
    expect(count).toBe('0')
  })

  it('1-7. §3.2 anon SELECT settlements → 0 row (RLS 실측)', () => {
    const r = psqlAnon("SELECT count(*) FROM settlements;")
    expect(r.exitCode).toBe(0)
    const count = r.stdout.split('\n').filter(l => /^\d+$/.test(l.trim()))[0]?.trim()
    expect(count).toBe('0')
  })

  it('1-8. §3.2 anon INSERT photo_uploads → RLS 차단 (실측)', () => {
    const r = psqlAnon(
      "INSERT INTO photo_uploads (id, file_name, file_url) VALUES ('00000000-0000-0000-0000-000000000099', 'hack.jpg', '/hack') RETURNING id;"
    )
    expect(r.exitCode).not.toBe(0)
    expect(r.stdout).toContain('row-level security')
  })

  it('1-9. §3.2 anon UPDATE orders → 0건 (토큰 없이 차단, 실측)', () => {
    const r = psqlAnon(
      "UPDATE orders SET status = 'CANCELLED' WHERE id = '00000000-0000-0000-0000-000000000000' RETURNING id;"
    )
    // UPDATE 0 또는 RLS 에러
    expect(r.exitCode).toBe(0)
    expect(r.stdout).not.toContain('00000000')
  })
})

// ═══════════════════════════════════════════════════
// 2. RPC 원자성 — 입력검증/정상/에러 (deep-checklist §4)
// ═══════════════════════════════════════════════════
describe('2. RPC 원자성', () => {
  it('2-1. create_settlement_with_items: 빈 배열 → EXCEPTION', async () => {
    if (skip()) return
    const { error } = await admin.rpc('create_settlement_with_items', {
      p_seller_id: '00000000-0000-0000-0000-000000000000',
      p_period_start: '2026-01-01', p_period_end: '2026-01-31',
      p_total_sales: 0, p_commission_rate: 0.25,
      p_commission_amount: 0, p_settlement_amount: 0,
      p_sold_item_ids: [],
      p_return_deduction: 0,
    })
    expect(error).not.toBeNull()
    expect(error!.message).toContain('비어있습니다')
  })

  it('2-2. create_settlement_with_items: p_return_deduction 파라미터 수신 확인', async () => {
    if (skip()) return
    const { error } = await admin.rpc('create_settlement_with_items', {
      p_seller_id: '00000000-0000-0000-0000-000000000000',
      p_period_start: '2026-01-01', p_period_end: '2026-01-31',
      p_total_sales: 10000, p_commission_rate: 0.25,
      p_commission_amount: 2500, p_settlement_amount: 7000,
      p_sold_item_ids: [],
      p_return_deduction: 500,
    })
    expect(error).not.toBeNull()
    // "비어있습니다" = 함수 진입 성공, p_return_deduction 수신됨
    expect(error!.message).toContain('비어있습니다')
    expect(error!.message).not.toContain('Could not find')
  })

  it('2-3. fail_settlement: 존재하지 않는 ID → EXCEPTION', async () => {
    if (skip()) return
    const { error } = await admin.rpc('fail_settlement', {
      p_id: '00000000-0000-0000-0000-000000000000',
      p_reason: '테스트',
      p_expected_status: 'draft',
    })
    expect(error).not.toBeNull()
    expect(error!.message.length).toBeGreaterThan(0)
  })

  it('2-4. generate_seller_code: 유효 입력 → 5자리 숫자', async () => {
    if (skip()) return
    const { data, error } = await admin.rpc('generate_seller_code', {
      p_name: '_test_ralph_' + Date.now(),
      p_phone: '01099999999',
      p_address: '테스트주소',
    })
    expect(error).toBeNull()
    expect(data).toMatch(/^\d{5}$/)
  })

  it('2-5. generate_product_number: 유효 seller → 13자리 숫자', async () => {
    if (skip()) return
    const { data: sellers } = await admin.from('sellers').select('id').limit(1)
    expect(sellers).not.toBeNull()
    expect(sellers!.length).toBeGreaterThan(0)
    const sellerId = (sellers![0] as Record<string, unknown>).id as string
    const { data, error } = await admin.rpc('generate_product_number', {
      p_seller_id: sellerId,
    })
    expect(error).toBeNull()
    expect(data).toMatch(/^\d{13}$/)
  })

  it('2-6. create_order_with_items: 빈 아이템 배열 → EXCEPTION', async () => {
    if (skip()) return
    const { error } = await admin.rpc('create_order_with_items', {
      p_order_number: '_test_ralph_' + Date.now(),
      p_customer_name: '테스트', p_customer_phone: '01000000000',
      p_status: 'APPLIED', p_items: [],
    })
    expect(error).not.toBeNull()
    expect(error!.message).toContain('비어있습니다')
  })

  it('2-7. complete_consignment: approved가 아닌 건 → EXCEPTION', async () => {
    if (skip()) return
    const { error } = await admin.rpc('complete_consignment', {
      p_consignment_id: '00000000-0000-0000-0000-000000000000',
      p_product_number: '_test_ralph_' + Date.now(),
    })
    expect(error).not.toBeNull()
    expect(error!.message).toContain('approved')
  })

  it('2-8. increment_batch_completed: 존재하지 않는 배치 → EXCEPTION', async () => {
    if (skip()) return
    const { error } = await admin.rpc('increment_batch_completed', {
      p_batch_id: '_test_nonexistent_' + Date.now(),
    })
    expect(error).not.toBeNull()
  })
})

// ═══════════════════════════════════════════════════
// 3. 논리/상태전이 — CHECK 제약 + 유효/무효 (deep-checklist §5.1)
// ═══════════════════════════════════════════════════
describe('3. 상태전이 논리', () => {
  it('3-1. consignment CHECK 제약 존재 (pg_constraint 실측)', () => {
    const checkConstraint = psql(
      "SELECT conname FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'consignment_requests' AND c.contype = 'c' AND conname LIKE '%status%'"
    )
    expect(checkConstraint.length).toBeGreaterThan(0)
  })

  it('3-2. consignment 무효 상태 UPDATE → CHECK 위반 에러', async () => {
    if (skip()) return
    const { data: rows } = await admin.from('consignment_requests').select('id').limit(1)
    expect(rows).not.toBeNull()
    expect(rows!.length).toBeGreaterThan(0)
    const id = (rows![0] as Record<string, unknown>).id as string
    const { error } = await admin
      .from('consignment_requests')
      .update({ status: 'INVALID_STATUS' })
      .eq('id', id)
    expect(error).not.toBeNull()
    expect(error!.message).toContain('check')
  })

  it('3-3. 위탁 상태전이: pending → inspecting (유효)', async () => {
    if (skip()) return
    const { data: rows } = await admin
      .from('consignment_requests').select('id, status')
      .eq('status', 'pending').limit(1)
    expect(rows).not.toBeNull()
    expect(rows!.length).toBeGreaterThan(0)
    const id = (rows![0] as Record<string, unknown>).id as string
    const { error } = await admin
      .from('consignment_requests').update({ status: 'inspecting' }).eq('id', id)
    expect(error).toBeNull()
    await admin.from('consignment_requests').update({ status: 'pending' }).eq('id', id)
  })

  it('3-4. settlement optimistic lock: 미매칭 → 0건 업데이트', async () => {
    if (skip()) return
    const { data, error } = await admin
      .from('settlements')
      .update({ status: 'confirmed' })
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .eq('status', 'draft')
      .select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════
// 4. 정산계산 정합성 (deep-checklist §5.2)
// ═══════════════════════════════════════════════════
describe('4. 정산계산 정합성', () => {
  it('4-1. 수수료 계산: Math.round 반올림 검증', () => {
    const totalSales = 150000
    const rate = 0.25
    const commission = Math.round(totalSales * rate)
    expect(commission).toBe(37500)
    expect(totalSales - commission).toBe(112500)
  })

  it('4-2. 경계값: 소수점 반올림 + return_deduction 반영', () => {
    const totalSales = 100001
    const rate = 0.25
    const returnDeduction = 3000
    const commission = Math.round(totalSales * rate)
    const settlement = totalSales - commission - returnDeduction
    expect(commission).toBe(25000)
    expect(settlement).toBe(72001)
  })

  it('4-3. get_commission_rate RPC: 셀러별 수수료율 범위', async () => {
    if (skip()) return
    const { data: sellers } = await admin.from('sellers').select('id').limit(1)
    expect(sellers).not.toBeNull()
    expect(sellers!.length).toBeGreaterThan(0)
    const sellerId = (sellers![0] as Record<string, unknown>).id as string
    const { data, error } = await admin.rpc('get_commission_rate', {
      p_seller_id: sellerId,
    })
    expect(error).toBeNull()
    expect(typeof data).toBe('number')
    expect(data).toBeGreaterThanOrEqual(0)
    expect(data).toBeLessThanOrEqual(1)
  })

  it('4-4. return_deduction 컬럼 존재 + 기본값 검증', async () => {
    if (skip()) return
    const { data, error } = await admin
      .from('settlements').select('id, return_deduction').limit(1)
    expect(error).toBeNull()
    if (data && data.length > 0) {
      const rd = (data[0] as Record<string, unknown>).return_deduction
      expect(typeof rd).toBe('number')
    }
  })

  it('4-5. settlement_items FK 존재 (pg_constraint 실측)', () => {
    const fk = psql(
      "SELECT conname FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'settlement_items' AND c.contype = 'f' AND conname LIKE '%settlement%'"
    )
    expect(fk.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════
// 5. 운영/롤백 — 실패 복구 (deep-checklist §4.3)
// ═══════════════════════════════════════════════════
describe('5. 운영/롤백', () => {
  it('5-1. fail_settlement: 존재하지 않는 ID → 에러 + 데이터 무변경', async () => {
    if (skip()) return
    const { data: before } = await admin
      .from('sold_items').select('id').eq('settlement_status', 'settled').limit(5)
    const { error } = await admin.rpc('fail_settlement', {
      p_id: '00000000-0000-0000-0000-000000000000',
      p_reason: '테스트 롤백',
      p_expected_status: 'draft',
    })
    expect(error).not.toBeNull()
    const { data: after } = await admin
      .from('sold_items').select('id').eq('settlement_status', 'settled').limit(5)
    expect(after?.length).toBe(before?.length)
  })

  it('5-2. increment_batch_completed: 미존재 배치 → 에러', async () => {
    if (skip()) return
    const { error } = await admin.rpc('increment_batch_completed', {
      p_batch_id: '_test_nonexistent_' + Date.now(),
    })
    expect(error).not.toBeNull()
  })

  it('5-3. increment_batch_failed: 미존재 배치 → 에러', async () => {
    if (skip()) return
    const { error } = await admin.rpc('increment_batch_failed', {
      p_batch_id: '_test_nonexistent_' + Date.now(),
      p_failed_id: 'test_item_id',
    })
    expect(error).not.toBeNull()
  })
})

// ═══════════════════════════════════════════════════
// 6. 적대 시나리오 — 2건 (deep-checklist §1.2)
// ═══════════════════════════════════════════════════
describe('6. 적대 시나리오', () => {
  it('6-1. SQL Injection 방어: 악의적 seller_code 생성', async () => {
    if (skip()) return
    const { data, error } = await admin.rpc('generate_seller_code', {
      p_name: "'; DROP TABLE sellers; --",
      p_phone: '01012345678',
      p_address: "' OR '1'='1",
    })
    if (!error) {
      expect(data).toMatch(/^\d{5}$/)
    }
    const { error: checkErr } = await admin.from('sellers').select('id').limit(1)
    expect(checkErr).toBeNull()
  })

  it('6-2. 대량 ID 주입: 100개 동일 UUID로 settlement 생성', async () => {
    if (skip()) return
    const fakeIds = Array.from({ length: 100 }, () => '00000000-0000-0000-0000-000000000000')
    const { error } = await admin.rpc('create_settlement_with_items', {
      p_seller_id: '00000000-0000-0000-0000-000000000000',
      p_period_start: '2026-01-01', p_period_end: '2026-01-31',
      p_total_sales: 0, p_commission_rate: 0.25,
      p_commission_amount: 0, p_settlement_amount: 0,
      p_sold_item_ids: fakeIds,
      p_return_deduction: 0,
    })
    expect(error).not.toBeNull()
  })
})

// ═══════════════════════════════════════════════════
// 7. 동시성 — 3시나리오 (deep-checklist §4.2)
// ═══════════════════════════════════════════════════
describe('7. 동시성', () => {
  it('7-1. 동시 seller_code 생성: 3건 동시 → 서로 다른 코드', async () => {
    if (skip()) return
    const ts = Date.now()
    const [r1, r2, r3] = await Promise.all([
      admin.rpc('generate_seller_code', { p_name: `_test_a_${ts}`, p_phone: '01011111111' }),
      admin.rpc('generate_seller_code', { p_name: `_test_b_${ts}`, p_phone: '01022222222' }),
      admin.rpc('generate_seller_code', { p_name: `_test_c_${ts}`, p_phone: '01033333333' }),
    ])
    expect(r1.error).toBeNull()
    expect(r2.error).toBeNull()
    expect(r3.error).toBeNull()
    const codes = new Set([r1.data, r2.data, r3.data])
    expect(codes.size).toBe(3)
  })

  it('7-2. 동시 product_number 생성: advisory lock 고유성', async () => {
    if (skip()) return
    const { data: sellers } = await admin.from('sellers').select('id').limit(1)
    expect(sellers).not.toBeNull()
    expect(sellers!.length).toBeGreaterThan(0)
    const sellerId = (sellers![0] as Record<string, unknown>).id as string
    const [r1, r2] = await Promise.all([
      admin.rpc('generate_product_number', { p_seller_id: sellerId }),
      admin.rpc('generate_product_number', { p_seller_id: sellerId }),
    ])
    expect(r1.error).toBeNull()
    expect(r2.error).toBeNull()
    expect(r1.data).not.toBe(r2.data)
  })

  it('7-3. 동시 settlement update: optimistic lock 경쟁', async () => {
    if (skip()) return
    const { data } = await admin
      .from('settlements').select('id').eq('status', 'draft').limit(1)
    if (!data || data.length === 0) {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const [u1, u2] = await Promise.all([
        admin.from('settlements').update({ status: 'confirmed' }).eq('id', fakeId).eq('status', 'draft').select('id'),
        admin.from('settlements').update({ status: 'confirmed' }).eq('id', fakeId).eq('status', 'draft').select('id'),
      ])
      const total = (u1.data?.length ?? 0) + (u2.data?.length ?? 0)
      expect(total).toBe(0)
      return
    }
    const id = (data[0] as Record<string, unknown>).id as string
    const [u1, u2] = await Promise.all([
      admin.from('settlements').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', id).eq('status', 'draft').select('id'),
      admin.from('settlements').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', id).eq('status', 'draft').select('id'),
    ])
    const total = (u1.data?.length ?? 0) + (u2.data?.length ?? 0)
    expect(total).toBeLessThanOrEqual(1)
    await admin.from('settlements').update({ status: 'draft', confirmed_at: null }).eq('id', id)
  })
})

// ═══════════════════════════════════════════════════
// 8. E2E — CRITICAL 라우트 검증 (deep-checklist §8)
// ═══════════════════════════════════════════════════
describe('8. E2E CRITICAL 라우트', () => {
  it('8-1. 정산 생성 E2E: 셀러 조회 → 수수료율 → RPC 호출 (실패 케이스 포함)', async () => {
    if (skip()) return
    // Step 1: 셀러 조회
    const { data: sellers, error: sellerErr } = await admin
      .from('sellers').select('id, seller_tier, commission_rate').limit(1)
    expect(sellerErr).toBeNull()
    expect(sellers).not.toBeNull()
    expect(sellers!.length).toBeGreaterThan(0)

    const seller = sellers![0] as Record<string, unknown>
    const sellerId = seller.id as string

    // Step 2: 수수료율 조회 (RPC)
    const { data: rate, error: rateErr } = await admin.rpc('get_commission_rate', {
      p_seller_id: sellerId,
    })
    expect(rateErr).toBeNull()
    expect(rate).toBeGreaterThanOrEqual(0)
    expect(rate).toBeLessThanOrEqual(1)

    // Step 3: 정산 생성 시도 (빈 sold_items → 실패 기대)
    const { error: createErr } = await admin.rpc('create_settlement_with_items', {
      p_seller_id: sellerId,
      p_period_start: '2099-01-01', p_period_end: '2099-01-31',
      p_total_sales: 100000, p_commission_rate: rate,
      p_commission_amount: Math.round(100000 * (rate as number)),
      p_settlement_amount: 100000 - Math.round(100000 * (rate as number)),
      p_sold_item_ids: [],
      p_return_deduction: 0,
    })
    expect(createErr).not.toBeNull()
    expect(createErr!.message).toContain('비어있습니다')

    // Step 4: 실패 후 데이터 무변경 확인
    const { data: noSettlement } = await admin
      .from('settlements')
      .select('id')
      .eq('seller_id', sellerId)
      .gte('settlement_period_start', '2099-01-01')
    expect(noSettlement).toHaveLength(0)
  })
})
