/**
 * GET /api/admin/notifications — 알림 목록 조회
 * WHY: 알림 발송 이력 관리
 * HOW: withAdmin → 쿼리파라미터 → notification.list → ok
 * WHERE: admin/notifications 페이지
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom } from '@/lib/api/response'
import { safePage } from '@/lib/utils/validation'
import * as notificationService from '@/lib/services/notification.service'

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const url = req.nextUrl
    const { page, pageSize } = safePage(url)
    const status = url.searchParams.get('status') ?? undefined
    const triggerEvent = url.searchParams.get('triggerEvent') ?? undefined
    const search = url.searchParams.get('search') ?? undefined

    const result = await notificationService.list({ status, triggerEvent, search }, { page, pageSize })
    return ok(result)
  } catch (e) { return errFrom(e) }
})
