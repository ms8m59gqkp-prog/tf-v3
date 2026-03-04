/**
 * 주문 리포지토리 — orders + order_items 테이블 CRUD
 * WHY: 주문 정보 조회/상태변경 데이터 접근
 * HOW: createAdminClient + mapRow/mapItemRow
 * WHERE: order 서비스에서 참조
 */

import { createAdminClient } from '@/lib/db/client'
import type { Order, OrderItem, OrderStatus } from '@/lib/types/domain/order'

const ORDER_COLUMNS = 'id, order_number, customer_name, phone, address, postal_code, status, hold_token, box_qty, total_estimated, commission, final_payout, seller_type, purchase_source, created_at, updated_at'

const ITEM_COLUMNS = 'id, order_id, product_number, brand, model, category, condition, size, measurements, inspection_status, customer_agreed, created_at'

export function mapRow(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    orderNumber: row.order_number as string,
    customerName: row.customer_name as string,
    phone: row.phone as string,
    address: (row.address as string) || undefined,
    postalCode: (row.postal_code as string) || undefined,
    status: row.status as OrderStatus,
    holdToken: (row.hold_token as string) || undefined,
    boxQty: row.box_qty != null ? Number(row.box_qty) : undefined,
    totalEstimated: row.total_estimated != null ? Number(row.total_estimated) : undefined,
    commission: row.commission != null ? Number(row.commission) : undefined,
    finalPayout: row.final_payout != null ? Number(row.final_payout) : undefined,
    sellerType: (row.seller_type as string) || undefined,
    purchaseSource: (row.purchase_source as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export function mapItemRow(row: Record<string, unknown>): OrderItem {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    productNumber: row.product_number as string,
    brand: (row.brand as string) || '',
    model: (row.model as string) || '',
    category: (row.category as string) || undefined,
    condition: (row.condition as string) || undefined,
    size: (row.size as string) || undefined,
    measurements: row.measurements as Record<string, number> | undefined,
    inspectionStatus: (row.inspection_status as string) || 'pending',
    customerAgreed: row.customer_agreed === true,
  }
}

export async function getById(id: string): Promise<Order> {
  const sb = createAdminClient()
  const { data, error } = await sb.from('orders').select(ORDER_COLUMNS).eq('id', id).single()
  if (error) throw new Error(`[orders.getById] ${error.message}`)
  return mapRow(data)
}

export async function getByOrderNumber(orderNumber: string): Promise<Order> {
  const sb = createAdminClient()
  const { data, error } = await sb.from('orders').select(ORDER_COLUMNS).eq('order_number', orderNumber).single()
  if (error) throw new Error(`[orders.getByOrderNumber] ${error.message}`)
  return mapRow(data)
}

export async function listByPage({ page, pageSize }: { page: number; pageSize: number }): Promise<Order[]> {
  const from = page * pageSize
  const to = from + pageSize - 1
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('orders')
    .select(ORDER_COLUMNS)
    .range(from, to)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`[orders.listByPage] ${error.message}`)
  return data.map(mapRow)
}

export async function updateStatus(id: string, expectedStatus: OrderStatus, newStatus: OrderStatus): Promise<Order> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', expectedStatus)
    .select(ORDER_COLUMNS)
    .single()
  if (error) throw new Error(`[orders.updateStatus] ${error.message}`)
  return mapRow(data)
}

export async function getByHoldToken(holdToken: string): Promise<Order> {
  const sb = createAdminClient()
  const { data, error } = await sb.from('orders').select(ORDER_COLUMNS).eq('hold_token', holdToken).single()
  if (error) throw new Error(`[orders.getByHoldToken] ${error.message}`)
  return mapRow(data)
}

export async function listItemsByOrderId(orderId: string): Promise<OrderItem[]> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('order_items')
    .select(ITEM_COLUMNS)
    .eq('order_id', orderId)
    .order('created_at')
  if (error) throw new Error(`[orders.listItemsByOrderId] ${error.message}`)
  return data.map(mapItemRow)
}
