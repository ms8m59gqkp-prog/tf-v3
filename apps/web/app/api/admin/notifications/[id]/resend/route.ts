/**
 * POST /api/admin/notifications/[id]/resend — 알림 재발송
 * WHY: 실패/기존 알림을 동일 내용으로 재발송
 * HOW: withAdmin → UUID → notification.resend → ok
 * WHERE: admin/notifications 상세 재발송 버튼
 */
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import * as notificationService from '@/lib/services/notification.service'

export const POST = withAdmin<{ id: string }>(async (_req, { params }) => {
  try {
    const { id } = await params
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    const result = await notificationService.resend(id)
    return ok(result)
  } catch (e) { return errFrom(e) }
})
