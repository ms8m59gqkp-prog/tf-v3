/**
 * 정산 상태 전이 (confirm/pay/updateStatus)
 * WHY: settlement.repo.ts 120줄 제한 준수 (§10.1)
 * HOW: read-validate-write 패턴, SETTLEMENT_COLUMNS/mapRow 재사용
 * WHERE: 정산 확정/지급 처리
 */
import { createAdminClient } from '../../supabase/admin'
import type { Settlement, SettlementStatus } from '../../types/domain/settlement'
import type { DbResult } from '../types'
import { SETTLEMENT_COLUMNS, mapRow } from './settlement.repo'

/** optimistic lock: draft → confirmed + confirmed_at */
export async function confirm(id: string): Promise<DbResult<Settlement>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('settlements')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'draft')
    .select(SETTLEMENT_COLUMNS).single()
  if (error) {
    // optimistic lock 실패 시 현재 상태 조회로 상세 에러
    const { data: current } = await client.from('settlements').select('status').eq('id', id).single()
    const currentStatus = current ? (current as Record<string, unknown>).status : '알 수 없음'
    return { data: null, error: `확정 불가: 현재 상태가 '${currentStatus}'입니다 (draft만 가능)` }
  }
  return { data: mapRow(data as Record<string, unknown>), error: null }
}

/** optimistic lock: confirmed → paid + paid_at + paid_by */
export async function pay(
  id: string, paidBy: string, transferReference?: string,
): Promise<DbResult<Settlement>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('settlements')
    .update({
      status: 'paid', paid_at: new Date().toISOString(),
      paid_by: paidBy, transfer_reference: transferReference ?? null,
    })
    .eq('id', id).eq('status', 'confirmed')
    .select(SETTLEMENT_COLUMNS).single()
  if (error) {
    const { data: current } = await client.from('settlements').select('status').eq('id', id).single()
    const currentStatus = current ? (current as Record<string, unknown>).status : '알 수 없음'
    return { data: null, error: `지급 불가: 현재 상태가 '${currentStatus}'입니다 (confirmed만 가능)` }
  }
  return { data: mapRow(data as Record<string, unknown>), error: null }
}

/** 범용 상태 갱신 (관리자용, optimistic lock) */
export async function updateStatus(
  id: string, status: SettlementStatus, expectedCurrent: SettlementStatus,
): Promise<DbResult<Settlement>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('settlements').update({ status })
    .eq('id', id).eq('status', expectedCurrent)
    .select(SETTLEMENT_COLUMNS).single()
  if (error) {
    const { data: current } = await client.from('settlements').select('status').eq('id', id).single()
    const cur = current ? (current as Record<string, unknown>).status : '알 수 없음'
    return { data: null, error: `상태 변경 불가: 현재 '${cur}' (expected: ${expectedCurrent})` }
  }
  return { data: mapRow(data as Record<string, unknown>), error: null }
}

/** 정산 생성 (RPC 래퍼 — settlements + settlement_items 원자적 생성) */
export async function createWithItems(params: {
  sellerId: string; periodStart: string; periodEnd: string
  totalSales: number; commissionRate: number; commissionAmount: number
  returnDeduction: number; settlementAmount: number
  soldItemIds: string[]
}): Promise<DbResult<Settlement>> {
  const client = createAdminClient()
  const { data, error } = await client.rpc(
    'create_settlement_with_items' as never,
    {
      p_seller_id: params.sellerId, p_period_start: params.periodStart,
      p_period_end: params.periodEnd, p_total_sales: params.totalSales,
      p_commission_rate: params.commissionRate, p_commission_amount: params.commissionAmount,
      p_settlement_amount: params.settlementAmount, p_sold_item_ids: params.soldItemIds,
      p_return_deduction: params.returnDeduction,
    } as never,
  )
  if (error) return { data: null, error: error.message }
  const rows = data as unknown as Record<string, unknown>[]
  if (!Array.isArray(rows) || rows.length === 0) {
    return { data: null, error: '정산 생성 실패: RPC 반환값 없음' }
  }
  return { data: mapRow(rows[0]), error: null }
}

/** 정산 실패 처리 (RPC 래퍼 — 원자적 상태 전이 + 사유 기록) */
export async function fail(
  id: string, reason: string, expectedCurrent: SettlementStatus,
): Promise<DbResult<Settlement>> {
  const client = createAdminClient()
  const { data, error } = await client.rpc(
    'fail_settlement' as never,
    { p_id: id, p_reason: reason, p_expected_status: expectedCurrent } as never,
  )
  if (error) return { data: null, error: error.message }
  // RETURNS SETOF → Supabase는 배열 반환
  const rows = data as unknown as Record<string, unknown>[]
  if (!Array.isArray(rows) || rows.length === 0) {
    return { data: null, error: `실패 처리 불가: 정산을 찾을 수 없거나 상태가 일치하지 않습니다` }
  }
  return { data: mapRow(rows[0]), error: null }
}
