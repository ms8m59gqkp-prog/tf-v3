/**
 * 알림 리포지토리 — notification_logs 테이블 CRUD
 * WHY: SMS 발송 로그 기록/조회 데이터 접근
 * HOW: createAdminClient + mapRow
 * WHERE: notification 서비스에서 참조
 */

import { createAdminClient } from '@/lib/db/client'
import type { NotificationLog, SmsStatus } from '@/lib/types/domain/notification'

const COLUMNS = 'id, seller_id, phone, message, status, created_at'

export function mapRow(row: Record<string, unknown>): NotificationLog {
  return {
    id: row.id as string,
    sellerId: (row.seller_id as string) || undefined,
    recipientPhone: row.phone as string,
    message: row.message as string,
    status: row.status as SmsStatus,
    createdAt: row.created_at as string,
  }
}

interface CreateNotificationInput {
  sellerId?: string
  phone: string
  message: string
  triggerEvent?: string
  channel?: string
}

export async function create(input: CreateNotificationInput): Promise<NotificationLog> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('notification_logs')
    .insert({
      seller_id: input.sellerId ?? null,
      phone: input.phone,
      message: input.message,
      status: 'pending',
      trigger_event: input.triggerEvent ?? null,
      channel: input.channel || 'sms',
    })
    .select(COLUMNS)
    .single()
  if (error) throw new Error(`[notifications.create] ${error.message}`)
  return mapRow(data)
}

export async function listBySellerId(
  sellerId: string,
  { page, pageSize }: { page: number; pageSize: number },
): Promise<NotificationLog[]> {
  const from = page * pageSize
  const to = from + pageSize - 1
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('notification_logs')
    .select(COLUMNS)
    .eq('seller_id', sellerId)
    .range(from, to)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`[notifications.listBySellerId] ${error.message}`)
  return data.map(mapRow)
}

export async function updateStatus(id: string, newStatus: SmsStatus): Promise<NotificationLog> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('notification_logs')
    .update({ status: newStatus })
    .eq('id', id)
    .select(COLUMNS)
    .single()
  if (error) throw new Error(`[notifications.updateStatus] ${error.message}`)
  return mapRow(data)
}
