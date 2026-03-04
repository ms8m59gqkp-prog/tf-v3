/**
 * 위탁 리포지토리 — consignment_requests 테이블 CRUD
 * WHY: 위탁 요청 조회/상태변경 데이터 접근
 * HOW: createAdminClient + mapRow
 * WHERE: consignment 서비스에서 참조
 */

import { createAdminClient } from '@/lib/db/client'
import type { ConsignmentRequest, ConsignmentStatus } from '@/lib/types/domain/consignment'

const COLUMNS = 'id, seller_id, product_name, brand, category, status, created_at'

export function mapRow(row: Record<string, unknown>): ConsignmentRequest {
  return {
    id: row.id as string,
    sellerId: row.seller_id as string,
    sellerName: '',
    status: row.status as ConsignmentStatus,
    productName: (row.product_name as string) || undefined,
    brand: (row.brand as string) || undefined,
    category: (row.category as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.created_at as string,
  }
}

export async function getById(id: string): Promise<ConsignmentRequest> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('consignment_requests')
    .select(COLUMNS)
    .eq('id', id)
    .single()
  if (error) throw new Error(`[consignments.getById] ${error.message}`)
  return mapRow(data)
}

export async function listByPage({ page, pageSize }: { page: number; pageSize: number }): Promise<ConsignmentRequest[]> {
  const from = page * pageSize
  const to = from + pageSize - 1
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('consignment_requests')
    .select(COLUMNS)
    .range(from, to)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`[consignments.listByPage] ${error.message}`)
  return data.map(mapRow)
}

export async function listBySellerId(
  sellerId: string,
  { page, pageSize }: { page: number; pageSize: number },
): Promise<ConsignmentRequest[]> {
  const from = page * pageSize
  const to = from + pageSize - 1
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('consignment_requests')
    .select(COLUMNS)
    .eq('seller_id', sellerId)
    .range(from, to)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`[consignments.listBySellerId] ${error.message}`)
  return data.map(mapRow)
}

export async function updateStatus(
  id: string,
  expectedStatus: ConsignmentStatus,
  newStatus: ConsignmentStatus,
): Promise<ConsignmentRequest> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('consignment_requests')
    .update({ status: newStatus })
    .eq('id', id)
    .eq('status', expectedStatus)
    .select(COLUMNS)
    .single()
  if (error) throw new Error(`[consignments.updateStatus] ${error.message}`)
  return mapRow(data)
}

interface CreateConsignmentInput {
  sellerId: string
  productName?: string
  brand?: string
  category?: string
}

export async function create(input: CreateConsignmentInput): Promise<ConsignmentRequest> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('consignment_requests')
    .insert({
      seller_id: input.sellerId,
      product_name: input.productName ?? null,
      brand: input.brand ?? null,
      category: input.category ?? null,
      status: 'pending',
    })
    .select(COLUMNS)
    .single()
  if (error) throw new Error(`[consignments.create] ${error.message}`)
  return mapRow(data)
}
