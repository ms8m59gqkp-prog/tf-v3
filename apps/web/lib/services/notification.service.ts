/**
 * 알림 서비스 (L1 Business Layer)
 * WHY: SMS 발송 + 알림 로그를 하나의 비즈니스 흐름으로 통합
 * HOW: D-11 soft-fail 패턴 — SMS 실패 시 throw 대신 { sent: false, error } 반환
 * WHERE: 위탁 상태 변경, 정산 완료, 커스텀 알림 발송 시
 */
import { AppError } from '../errors'
import { sendSMS } from '../aligo/sms'
import * as notificationRepo from '../db/repositories/notifications.repo'
import * as notificationQueryRepo from '../db/repositories/notifications-query.repo'
import type { NotificationLogWithRelations } from '../db/repositories/notifications.repo'
import type { PageOptions } from '../db/types'
import { consignmentReceivedTemplate, consignmentApprovedTemplate, consignmentCompletedTemplate, consignmentRejectedTemplate, settlementPaidTemplate } from '../utils/sms-templates'

export type TriggerEvent = 'received' | 'approved' | 'completed' | 'rejected' | 'paid'
export interface NotifyResult { sent: boolean; error?: string }
export interface CustomNotifyParams { phone: string; message: string; sellerId?: string; consignmentId?: string }

interface StatusChangeParams {
  sellerId: string; sellerName: string; sellerPhone: string; productName: string
  event: TriggerEvent; consignmentId?: string; price?: number
  productNumber?: string; amount?: number; reason?: string
}

function buildMessage(p: StatusChangeParams): string {
  switch (p.event) {
    case 'received': return consignmentReceivedTemplate({ sellerName: p.sellerName, productName: p.productName })
    case 'approved': return consignmentApprovedTemplate({ sellerName: p.sellerName, productName: p.productName, price: p.price ?? 0 })
    case 'completed': return consignmentCompletedTemplate({ sellerName: p.sellerName, productName: p.productName, productNumber: p.productNumber ?? '' })
    case 'rejected': return consignmentRejectedTemplate({ sellerName: p.sellerName, productName: p.productName, reason: p.reason })
    case 'paid': return settlementPaidTemplate({ sellerName: p.sellerName, amount: p.amount ?? 0 })
  }
}

export async function notifyStatusChange(params: StatusChangeParams): Promise<NotifyResult> {
  const message = buildMessage(params)
  try {
    await sendSMS({ phone: params.sellerPhone, message })
    await notificationRepo.create({
      seller_id: params.sellerId, phone: params.sellerPhone, message,
      trigger_event: params.event, channel: 'sms', status: 'sent',
      consignment_id: params.consignmentId,
    })
    return { sent: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[notification] SMS 실패:', msg)
    await notificationRepo.create({
      seller_id: params.sellerId, phone: params.sellerPhone, message,
      trigger_event: params.event, channel: 'sms', status: 'failed',
      consignment_id: params.consignmentId,
    }).catch(() => { /* 로그 기록 실패는 무시 */ })
    return { sent: false, error: msg }
  }
}

export async function sendCustom(params: CustomNotifyParams): Promise<NotifyResult> {
  try {
    await sendSMS({ phone: params.phone, message: params.message })
    await notificationRepo.create({
      seller_id: params.sellerId, phone: params.phone, message: params.message,
      trigger_event: 'custom', channel: 'sms', status: 'sent',
      consignment_id: params.consignmentId,
    })
    return { sent: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[notification] SMS 실패:', msg)
    return { sent: false, error: msg }
  }
}

export interface BulkSendParams { phones: string[]; message: string; sellerId?: string }
export interface BulkSendResult { total: number; sent: number; failed: number; details: Array<{ phone: string; error: string }> }

const MAX_BULK_SEND = 50

export async function bulkSend(params: BulkSendParams): Promise<BulkSendResult> {
  if (params.phones.length === 0) throw new AppError('VALIDATION', '발송 대상이 없습니다')
  if (params.phones.length > MAX_BULK_SEND) {
    throw new AppError('VALIDATION', `한 번에 최대 ${MAX_BULK_SEND}건까지 발송 가능합니다`)
  }

  const details: Array<{ phone: string; error: string }> = []
  let sent = 0

  for (const phone of params.phones) {
    try {
      await sendSMS({ phone, message: params.message })
      await notificationRepo.create({
        seller_id: params.sellerId, phone, message: params.message,
        trigger_event: 'custom', channel: 'sms', status: 'sent',
      })
      sent++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[notification] bulk SMS 실패:', phone, msg)
      details.push({ phone, error: msg })
      await notificationRepo.create({
        seller_id: params.sellerId, phone, message: params.message,
        trigger_event: 'custom', channel: 'sms', status: 'failed',
      }).catch(() => { /* 로그 기록 실패는 무시 */ })
    }
  }

  return { total: params.phones.length, sent, failed: details.length, details }
}

export async function resend(id: string): Promise<NotifyResult> {
  const existing = await notificationRepo.findById(id)
  if (existing.error !== null) throw new AppError('NOT_FOUND', `알림을 찾을 수 없습니다: ${id}`)

  const { phone, message, sellerId, consignmentId } = existing.data
  return sendCustom({ phone, message, sellerId: sellerId ?? undefined, consignmentId: consignmentId ?? undefined })
}

export async function remove(id: string): Promise<number> {
  const existing = await notificationRepo.findById(id)
  if (existing.error !== null) throw new AppError('NOT_FOUND', `알림을 찾을 수 없습니다: ${id}`)

  const result = await notificationRepo.deleteById(id)
  if (result.error !== null) throw new AppError('INTERNAL', result.error)
  return result.data
}

export async function list(
  filters?: Parameters<typeof notificationQueryRepo.list>[0],
  pageOptions?: PageOptions,
): Promise<{ items: NotificationLogWithRelations[]; total: number }> {
  const result = await notificationQueryRepo.list(filters, pageOptions)
  if (result.error) return { items: [], total: 0 }
  return { items: result.data, total: result.total }
}
