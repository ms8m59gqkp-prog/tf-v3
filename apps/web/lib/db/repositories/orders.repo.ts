/**
 * 주문 공유 인프라 + 조회
 * WHY: orders + order_items 테이블 쿼리 일원화 (SELECT * 금지, AV1)
 * HOW: COLUMNS 명시 + mapRow snake→camelCase + PostgREST FK JOIN
 * WHERE: 주문 조회 전역
 */
import { createAdminClient } from '../../supabase/admin'
import type { Order, OrderItem } from '../../types/domain/order'
import type { DbResult, DbListResult, PageOptions } from '../types'

/** DDL orders 19컬럼 전체 — SELECT * 금지 (AV1) */
const ORDER_COLUMNS = `id, order_number, customer_name, phone, address, postal_code,
  visit_date, arrival_date, box_qty, total_estimated, commission, final_payout,
  status, created_at, updated_at, seller_type, purchase_source,
  custom_commission_rate, hold_token, hold_token_expires_at` as const

/** DDL order_items 23컬럼 전체 */
const ORDER_ITEM_COLUMNS = `id, order_id, product_number, brand, model, category,
  condition, estimated_price, final_price, status, image_url, created_at,
  customer_price, size, inspection_status, item_type, measurements,
  hold_adjusted_price, hold_reason, hold_photo_url, hold_date,
  customer_agreed, customer_agreed_at` as const

export interface OrderWithItems extends Order {
  order_items: OrderItem[]
}

function mapOrderRow(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    orderNumber: row.order_number as string,
    customerName: row.customer_name as string,
    phone: row.phone as string,
    address: (row.address as string) ?? null,
    postalCode: (row.postal_code as string) ?? null,
    visitDate: (row.visit_date as string) ?? null,
    arrivalDate: (row.arrival_date as string) ?? null,
    boxQty: (row.box_qty as number) ?? null,
    totalEstimated: (row.total_estimated as number) ?? null,
    commission: (row.commission as number) ?? null,
    finalPayout: (row.final_payout as number) ?? null,
    status: (row.status as Order['status']) ?? null,
    createdAt: (row.created_at as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
    sellerType: row.seller_type as string,
    purchaseSource: (row.purchase_source as string) ?? null,
    customCommissionRate: row.custom_commission_rate != null
      ? Number(row.custom_commission_rate) : null,
    holdToken: (row.hold_token as string) ?? null,
    holdTokenExpiresAt: (row.hold_token_expires_at as string) ?? null,
  }
}

function mapOrderItemRow(row: Record<string, unknown>): OrderItem {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    productNumber: row.product_number as string,
    brand: row.brand as string,
    model: row.model as string,
    category: (row.category as string) ?? null,
    condition: (row.condition as string) ?? null,
    estimatedPrice: (row.estimated_price as number) ?? null,
    finalPrice: (row.final_price as number) ?? null,
    status: (row.status as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
    customerPrice: (row.customer_price as number) ?? null,
    size: (row.size as string) ?? null,
    inspectionStatus: row.inspection_status as OrderItem['inspectionStatus'],
    itemType: (row.item_type as string) ?? null,
    measurements: (row.measurements as unknown as Record<string, unknown>) ?? null,
    holdAdjustedPrice: (row.hold_adjusted_price as number) ?? null,
    holdReason: (row.hold_reason as string) ?? null,
    holdPhotoUrl: (row.hold_photo_url as string) ?? null,
    holdDate: (row.hold_date as string) ?? null,
    customerAgreed: row.customer_agreed as boolean,
    customerAgreedAt: (row.customer_agreed_at as string) ?? null,
  }
}

export { mapOrderRow, mapOrderItemRow, ORDER_COLUMNS, ORDER_ITEM_COLUMNS }

const JOIN_SELECT = `${ORDER_COLUMNS}, order_items(${ORDER_ITEM_COLUMNS})`

function mapOrderWithItems(row: Record<string, unknown>): OrderWithItems {
  const items = (row.order_items as unknown as Record<string, unknown>[]) ?? []
  return { ...mapOrderRow(row), order_items: items.map(mapOrderItemRow) }
}

export { JOIN_SELECT, mapOrderWithItems }
export async function findById(id: string): Promise<DbResult<OrderWithItems>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('orders').select(JOIN_SELECT).eq('id', id).maybeSingle()
  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: 'NOT_FOUND: 주문을 찾을 수 없습니다' }
  return { data: mapOrderWithItems(data as unknown as Record<string, unknown>), error: null }
}
interface OrderFilters { status?: string; search?: string }
export async function list(
  filters?: OrderFilters, pageOptions?: PageOptions,
): Promise<DbListResult<OrderWithItems>> {
  const client = createAdminClient()
  let query = client.from('orders').select(JOIN_SELECT, { count: 'exact' })
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.search) query = query.ilike('order_number', `%${filters.search}%`)
  query = query.order('created_at', { ascending: false })
  if (pageOptions) {
    const from = (pageOptions.page - 1) * pageOptions.pageSize
    const to = from + pageOptions.pageSize - 1
    query = query.range(from, to)
  }
  const { data, error, count } = await query
  if (error) return { data: [], total: 0, error: error.message }
  return {
    data: (data as unknown as Record<string, unknown>[]).map(mapOrderWithItems),
    total: count ?? 0, error: null,
  }
}
