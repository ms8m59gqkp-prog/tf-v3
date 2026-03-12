/**
 * POST /api/admin/notifications/bulk-send — 대량 SMS 발송
 * WHY: 다수 셀러에게 커스텀 메시지 일괄 발송
 * HOW: withAdmin → Zod(max 50) → notification.bulkSend → ok
 * WHERE: admin/notifications 대량발송 모달
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { BulkSendSchema } from './schema'
import * as notificationService from '@/lib/services/notification.service'

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = BulkSendSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const result = await notificationService.bulkSend(parsed.data)
    return ok(result)
  } catch (e) { return errFrom(e) }
})
