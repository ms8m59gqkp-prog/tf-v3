/**
 * POST /api/admin/notifications/send — 커스텀 알림 발송 스키마
 * WHY: CustomNotifyParams 기반 입력값 검증
 * HOW: phone + message 필수, sellerId/consignmentId 선택
 * WHERE: send/route.ts에서 import
 */
import { z } from 'zod'

export const SendNotificationSchema = z.object({
  phone: z.string().regex(/^01[016789]\d{7,8}$/, '유효한 휴대폰 번호가 아닙니다'),
  message: z.string().min(1, '메시지 내용은 필수입니다').max(2000),
  sellerId: z.string().uuid().optional(),
  consignmentId: z.string().uuid().optional(),
})
