/**
 * 알림(SMS) 도메인 타입
 * WHY: SMS 발송 결과 추적 + 알림 로그 관리
 * HOW: SmsResult + NotificationLog 인터페이스
 * WHERE: notification 서비스에서 참조
 */

export type SmsStatus = 'pending' | 'sent' | 'failed'

export interface SmsResult {
  success: boolean
  messageId?: string
  errorCode?: string
  errorMessage?: string
}

export interface NotificationLog {
  id: string
  sellerId?: string
  recipientPhone: string
  message: string
  status: SmsStatus
  sentAt?: string
  createdAt: string
}
