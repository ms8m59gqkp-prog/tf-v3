/**
 * 주문 상태 변경 + 아이템 업데이트
 * WHY: orders.repo.ts 120줄 제한 준수 (§10.1)
 * HOW: ORDER_COLUMNS/mapOrderRow/mapOrderItemRow 재사용
 * WHERE: 주문 상태 변경, 아이템 검수/가격 갱신
 */
import { createAdminClient } from '../../supabase/admin'
import type { Order, OrderItem, ORDER_STATUSES } from '../../types/domain/order'
import type { DbResult } from '../types'
import { ORDER_COLUMNS, ORDER_ITEM_COLUMNS, mapOrderRow, mapOrderItemRow } from './orders.repo'

export async function updateStatus(
  id: string, status: (typeof ORDER_STATUSES)[number],
): Promise<DbResult<Order>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('orders').update({ status }).eq('id', id)
    .select(ORDER_COLUMNS).single()
  if (error) return { data: null, error: error.message }
  return { data: mapOrderRow(data as unknown as Record<string, unknown>), error: null }
}

export async function updateItem(
  itemId: string, fields: Partial<Record<string, unknown>>,
): Promise<DbResult<OrderItem>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('order_items').update(fields).eq('id', itemId)
    .select(ORDER_ITEM_COLUMNS).single()
  if (error) return { data: null, error: error.message }
  return { data: mapOrderItemRow(data as unknown as Record<string, unknown>), error: null }
}

export async function getItemsByOrderId(orderId: string): Promise<DbResult<OrderItem[]>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('order_items').select(ORDER_ITEM_COLUMNS).eq('order_id', orderId)
    .range(0, 4999)
  if (error) return { data: null, error: error.message }
  return {
    data: (data as unknown as Record<string, unknown>[]).map(mapOrderItemRow),
    error: null,
  }
}
