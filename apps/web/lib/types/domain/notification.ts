/**
 * 알림/배치 도메인 타입
 * WHY: V2 notification_logs + _batch_progress 테이블과 1:1 대응
 * HOW: 인터페이스 + CHECK 상수
 * WHERE: SMS 발송, 배치 처리에서 import
 */

export const SMS_STATUSES = ['pending', 'sent', 'failed'] as const satisfies readonly string[]
export type SmsStatus = (typeof SMS_STATUSES)[number]

export const BATCH_STATUSES = ['running', 'completed', 'partial', 'failed'] as const satisfies readonly string[]
export type BatchStatus = (typeof BATCH_STATUSES)[number]

export interface NotificationLog {
  id: string
  consignmentId?: string | null
  sellerId?: string | null
  phone: string
  message: string
  triggerEvent: string
  channel: string
  status: SmsStatus
  apiResponse?: Record<string, unknown> | null
  createdAt: string
}

export interface BatchProgress {
  id: string
  batchId: string
  total: number
  completed: number
  failed: number
  failedIds?: unknown[] | null
  status: BatchStatus
  createdAt?: string | null
  updatedAt?: string | null
}
