/**
 * 정산 공유 인프라 + 조회
 * WHY: 정산 테이블 쿼리 일원화 (SELECT * 금지, AV1)
 * HOW: COLUMNS 명시 + mapRow snake→camelCase + PostgREST FK JOIN
 * WHERE: 정산 목록/상세 전역
 */
import { createAdminClient } from '../../supabase/admin'
import type { Settlement, SettlementStatus, SoldItem } from '../../types/domain/settlement'
import type { Seller } from '../../types/domain/seller'
import type { DbResult, DbListResult, PageOptions } from '../types'
import { COLUMNS as SOLD_ITEM_COLUMNS, mapRow as mapSoldItemRow } from './sold-items.repo'

const SETTLEMENT_COLUMNS = `id, seller_id, settlement_period_start, settlement_period_end,
  total_sales, commission_rate, commission_amount, return_deduction,
  settlement_amount, item_count, status, paid_at, paid_by,
  transfer_reference, created_at, confirmed_at, fail_reason` as const

export type SettlementWithSeller = Settlement & {
  sellers: Pick<Seller, 'id' | 'name' | 'nickname' | 'phone' | 'bankAccount' |
    'commissionRate' | 'sellerTier' | 'status'> | null
}

export type SettlementWithDetails = SettlementWithSeller & {
  settlement_items: Array<{
    id: string
    soldItemId: string
    sold_items: SoldItem
  }>
}

function mapRow(row: Record<string, unknown>): Settlement {
  return {
    id: row.id as string,
    sellerId: row.seller_id as string,
    settlementPeriodStart: row.settlement_period_start as string,
    settlementPeriodEnd: row.settlement_period_end as string,
    totalSales: row.total_sales as number,
    commissionRate: row.commission_rate != null ? Number(row.commission_rate) : 0,
    commissionAmount: row.commission_amount as number,
    returnDeduction: row.return_deduction as number,
    settlementAmount: row.settlement_amount as number,
    itemCount: row.item_count as number,
    status: (row.status as SettlementStatus) ?? null,
    paidAt: (row.paid_at as string) ?? null,
    paidBy: (row.paid_by as string) ?? null,
    transferReference: (row.transfer_reference as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
    confirmedAt: (row.confirmed_at as string) ?? null,
    failReason: (row.fail_reason as string) ?? null,
  }
}

export { mapRow, SETTLEMENT_COLUMNS }

function mapSellerJoin(raw: Record<string, unknown>): SettlementWithSeller['sellers'] {
  if (!raw) return null
  return {
    id: raw.id as string,
    name: raw.name as string,
    nickname: (raw.nickname as string) ?? null,
    phone: raw.phone as string,
    bankAccount: (raw.bank_account as string) ?? null,
    commissionRate: raw.commission_rate != null ? Number(raw.commission_rate) : 0,
    sellerTier: (raw.seller_tier as Seller['sellerTier']) ?? null,
    status: (raw.status as Seller['status']) ?? null,
  }
}

const SELLER_JOIN = 'sellers(id, name, nickname, phone, bank_account, commission_rate, seller_tier, status)'
const ITEMS_JOIN = `settlement_items(id, sold_item_id, sold_items(${SOLD_ITEM_COLUMNS}))`

export async function findById(id: string): Promise<DbResult<SettlementWithDetails>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('settlements')
    .select(`${SETTLEMENT_COLUMNS}, ${SELLER_JOIN}, ${ITEMS_JOIN}`)
    .eq('id', id).single()
  if (error) return { data: null, error: error.message }
  const row = data as unknown as Record<string, unknown>
  const rawItems = (row.settlement_items as Record<string, unknown>[]) ?? []
  return {
    data: {
      ...mapRow(row),
      sellers: row.sellers ? mapSellerJoin(row.sellers as Record<string, unknown>) : null,
      settlement_items: rawItems.map((item) => ({
        id: item.id as string,
        soldItemId: item.sold_item_id as string,
        sold_items: mapSoldItemRow(item.sold_items as Record<string, unknown>),
      })),
    },
    error: null,
  }
}

interface SettlementFilters {
  status?: SettlementStatus
  periodFrom?: string
  periodTo?: string
  sellerId?: string
}

export async function list(
  filters: SettlementFilters, options: PageOptions,
): Promise<DbListResult<SettlementWithSeller>> {
  const { page, pageSize, sortBy = 'created_at', ascending = false } = options
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const client = createAdminClient()
  let query = client.from('settlements')
    .select(`${SETTLEMENT_COLUMNS}, ${SELLER_JOIN}`, { count: 'exact' })
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.sellerId) query = query.eq('seller_id', filters.sellerId)
  if (filters.periodFrom) query = query.gte('settlement_period_start', filters.periodFrom)
  if (filters.periodTo) query = query.lte('settlement_period_end', filters.periodTo)
  const { data, error, count } = await query.order(sortBy, { ascending }).range(from, to)
  if (error) return { data: [], total: 0, error: error.message }
  const rows = data as Record<string, unknown>[]
  return {
    data: rows.map((row) => ({
      ...mapRow(row),
      sellers: row.sellers ? mapSellerJoin(row.sellers as Record<string, unknown>) : null,
    })),
    total: count ?? 0,
    error: null,
  }
}
