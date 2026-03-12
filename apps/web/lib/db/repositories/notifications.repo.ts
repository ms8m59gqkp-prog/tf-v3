/**
 * 알림 공유 인프라 + 생성
 * WHY: notification_logs 테이블 쿼리 일원화 (SELECT * 금지, AV1)
 * HOW: COLUMNS 10컬럼 명시 + mapRow + PostgREST FK JOIN sellers/consignment_requests
 * WHERE: SMS 발송, 알림 이력 전역
 */
import { createAdminClient } from '../../supabase/admin'
import type { NotificationLog } from '../../types/domain/notification'
import type { Seller } from '../../types/domain/seller'
import type { ConsignmentRequest } from '../../types/domain/consignment'
import type { DbResult } from '../types'

const COLUMNS = `id, consignment_id, seller_id, phone, message,
  trigger_event, channel, status, api_response, created_at` as const

export interface NotificationLogWithRelations extends NotificationLog {
  sellers: Pick<Seller, 'name' | 'phone' | 'sellerCode'> | null
  consignment_requests: Pick<ConsignmentRequest, 'productNumber' | 'productName'> | null
}

const JOIN_SELECT = `${COLUMNS}, sellers(name, phone, seller_code), consignment_requests(product_number, product_name)`

function mapRow(row: Record<string, unknown>): NotificationLog {
  return {
    id: row.id as string,
    consignmentId: (row.consignment_id as string) ?? null,
    sellerId: (row.seller_id as string) ?? null,
    phone: row.phone as string,
    message: row.message as string,
    triggerEvent: row.trigger_event as string,
    channel: row.channel as string,
    status: row.status as NotificationLog['status'],
    apiResponse: (row.api_response as unknown as Record<string, unknown>) ?? null,
    createdAt: row.created_at as string,
  }
}

function mapSellerJoin(row: Record<string, unknown>): Pick<Seller, 'name' | 'phone' | 'sellerCode'> | null {
  const seller = row.sellers as unknown as Record<string, unknown> | null
  if (!seller) return null
  return { name: seller.name as string, phone: seller.phone as string, sellerCode: seller.seller_code as string }
}

function mapConsignmentJoin(row: Record<string, unknown>): Pick<ConsignmentRequest, 'productNumber' | 'productName'> | null {
  const cr = row.consignment_requests as unknown as Record<string, unknown> | null
  if (!cr) return null
  return { productNumber: (cr.product_number as string) ?? null, productName: cr.product_name as string }
}

function mapWithRelations(row: Record<string, unknown>): NotificationLogWithRelations {
  return { ...mapRow(row), sellers: mapSellerJoin(row), consignment_requests: mapConsignmentJoin(row) }
}

export { mapRow, mapWithRelations, COLUMNS, JOIN_SELECT }

export async function create(
  input: { consignment_id?: string; seller_id?: string; phone: string; message: string; trigger_event: string; channel?: string; status?: string; api_response?: Record<string, unknown> },
): Promise<DbResult<NotificationLog>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('notification_logs').insert(input).select(COLUMNS).single()
  if (error) return { data: null, error: error.message }
  return { data: mapRow(data as unknown as Record<string, unknown>), error: null }
}

export async function findById(id: string): Promise<DbResult<NotificationLog>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('notification_logs').select(COLUMNS).eq('id', id).single()
  if (error) return { data: null, error: error.message }
  return { data: mapRow(data as unknown as Record<string, unknown>), error: null }
}

export async function deleteById(id: string): Promise<DbResult<number>> {
  const client = createAdminClient()
  const { error, count } = await client
    .from('notification_logs').delete({ count: 'exact' }).eq('id', id)
  if (error) return { data: null, error: error.message }
  return { data: count ?? 0, error: null }
}

export async function findByConsignmentId(consignmentId: string): Promise<DbResult<NotificationLog[]>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('notification_logs').select(COLUMNS)
    .eq('consignment_id', consignmentId).order('created_at', { ascending: false })
    .range(0, 999)
  if (error) return { data: null, error: error.message }
  return { data: (data as unknown as Record<string, unknown>[]).map(mapRow), error: null }
}
