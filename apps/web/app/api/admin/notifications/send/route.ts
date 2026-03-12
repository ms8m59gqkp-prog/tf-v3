/**
 * POST /api/admin/notifications/send — 커스텀 알림 발송
 * WHY: 관리자 수동 SMS 발송
 * HOW: withAdmin → Zod → notification.sendCustom → ok
 * WHERE: admin/notifications 페이지 (발송 모달)
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { SendNotificationSchema } from './schema'
import * as notificationService from '@/lib/services/notification.service'

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = SendNotificationSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const result = await notificationService.sendCustom(parsed.data)
    return ok(result)
  } catch (e) { return errFrom(e) }
})
