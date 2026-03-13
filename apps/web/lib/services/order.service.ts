/**
 * 주문 서비스 (L1 Business Layer)
 * WHY: 주문 CRUD + 상태 전이 비즈니스 로직 캡슐화 — repo 직접 노출 방지
 * HOW: ORDER_TRANSITIONS 기반 상태 전이 검증 + DbResult 에러 → AppError throw
 * WHERE: 주문 목록/상세/상태변경/아이템수정 API route에서 호출
 */
import { AppError } from '../errors'
import * as ordersRepo from '../db/repositories/orders.repo'
import * as ordersMutationRepo from '../db/repositories/orders-mutation.repo'
import type { OrderWithItems } from '../db/repositories/orders.repo'
import type { Order, OrderItem, OrderStatus } from '../types/domain/order'
import { ORDER_TRANSITIONS } from '../types/domain/order'
import type { PageOptions } from '../db/types'

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`)
}

function camelToSnakeFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[toSnake(k)] = v
  }
  return result
}

export async function list(
  filters?: { status?: string; search?: string },
  pageOptions?: PageOptions,
): Promise<{ items: OrderWithItems[]; total: number }> {
  const result = await ordersRepo.list(filters, pageOptions)
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return { items: result.data, total: result.total }
}

export async function getById(id: string): Promise<OrderWithItems> {
  const result = await ordersRepo.findById(id)
  if (result.error !== null) throw new AppError('NOT_FOUND', `주문을 찾을 수 없습니다: ${id}`)
  return result.data
}

export async function updateStatus(id: string, newStatus: OrderStatus): Promise<Order> {
  const existing = await ordersRepo.findById(id)
  if (existing.error !== null) {
    throw new AppError('NOT_FOUND', `주문을 찾을 수 없습니다: ${id}`)
  }

  const current = existing.data.status as OrderStatus
  const allowed = ORDER_TRANSITIONS[current]
  if (!allowed || !allowed.includes(newStatus)) {
    throw new AppError('CONFLICT', `상태 전이 불가: ${current} → ${newStatus}`)
  }

  const result = await ordersMutationRepo.updateStatus(id, newStatus, current)
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return result.data
}

export async function updateItem(
  itemId: string,
  fields: Partial<OrderItem>,
): Promise<OrderItem> {
  const snakeFields = camelToSnakeFields(fields as unknown as Record<string, unknown>)
  const result = await ordersMutationRepo.updateItem(itemId, snakeFields)
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return result.data
}

const INSPECTION_FIELDS = new Set([
  'inspectionStatus', 'holdAdjustedPrice', 'holdReason', 'holdPhotoUrl', 'holdDate',
])

export async function updateInspection(
  itemId: string, fields: Partial<Pick<OrderItem, 'inspectionStatus' | 'holdAdjustedPrice' | 'holdReason' | 'holdPhotoUrl' | 'holdDate'>>,
): Promise<OrderItem> {
  const filtered: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (INSPECTION_FIELDS.has(k) && v !== undefined) filtered[k] = v
  }
  if (Object.keys(filtered).length === 0) {
    throw new AppError('VALIDATION', '수정할 검수 필드가 없습니다')
  }
  const snakeFields = camelToSnakeFields(filtered)
  const result = await ordersMutationRepo.updateItem(itemId, snakeFields)
  if (result.error !== null) throw new AppError('NOT_FOUND', result.error)
  return result.data
}

const MEASUREMENT_FIELDS = new Set(['measurements', 'size'])

export async function updateMeasurement(
  itemId: string, fields: Partial<Pick<OrderItem, 'measurements' | 'size'>>,
): Promise<OrderItem> {
  const filtered: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (MEASUREMENT_FIELDS.has(k) && v !== undefined) filtered[k] = v
  }
  if (Object.keys(filtered).length === 0) {
    throw new AppError('VALIDATION', '수정할 치수 필드가 없습니다')
  }
  const snakeFields = camelToSnakeFields(filtered)
  const result = await ordersMutationRepo.updateItem(itemId, snakeFields)
  if (result.error !== null) throw new AppError('NOT_FOUND', result.error)
  return result.data
}

export async function getItems(orderId: string): Promise<OrderItem[]> {
  const result = await ordersMutationRepo.getItemsByOrderId(orderId)
  if (result.error !== null) throw new AppError('NOT_FOUND', `주문 아이템을 찾을 수 없습니다: ${orderId}`)
  return result.data
}
