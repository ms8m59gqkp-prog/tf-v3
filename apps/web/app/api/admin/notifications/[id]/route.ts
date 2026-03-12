/**
 * DELETE /api/admin/notifications/[id] — 알림 삭제
 * WHY: 불필요한 알림 로그 제거
 * HOW: withAdmin → UUID → notification.remove → ok
 * WHERE: admin/notifications 목록 삭제 버튼
 */
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import * as notificationService from '@/lib/services/notification.service'

export const DELETE = withAdmin<{ id: string }>(async (_req, { params }) => {
  try {
    const { id } = await params
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    const deleted = await notificationService.remove(id)
    return ok({ deleted })
  } catch (e) { return errFrom(e) }
})
