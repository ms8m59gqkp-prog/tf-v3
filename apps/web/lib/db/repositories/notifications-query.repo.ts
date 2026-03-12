/**
 * 알림 복합 검색 (목록 조회)
 * WHY: notifications.repo.ts 120줄 제한 준수 (§10.1)
 * HOW: [AV3] .or() 금지 대응 — 조건별 분기 (phone/seller_id/message)
 * WHERE: 알림 이력 목록 화면
 */
import { createAdminClient } from '../../supabase/admin'
import type { DbListResult, PageOptions } from '../types'
import { JOIN_SELECT, mapWithRelations, type NotificationLogWithRelations } from './notifications.repo'

interface NotificationFilters {
  status?: string
  triggerEvent?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

/**
 * 알림 목록 조회 (복합 검색 V2 계승)
 * [AV3] .or() 금지: search 조건별 분기
 *   - 숫자 3자리+ → phone LIKE
 *   - 텍스트 → seller_id IN (셀러명 서브쿼리) 또는 message ILIKE
 */
export async function list(
  filters?: NotificationFilters, pageOptions?: PageOptions,
): Promise<DbListResult<NotificationLogWithRelations>> {
  const client = createAdminClient()

  let sellerIds: string[] | null = null
  if (filters?.search && !/^\d{3,}$/.test(filters.search)) {
    const { data: sellers } = await client
      .from('sellers').select('id').ilike('name', `%${filters.search}%`)
    sellerIds = sellers ? (sellers as unknown as Record<string, unknown>[]).map(s => s.id as string) : []
  }

  let query = client.from('notification_logs').select(JOIN_SELECT, { count: 'exact' })
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.triggerEvent) query = query.eq('trigger_event', filters.triggerEvent)
  if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom)
  if (filters?.dateTo) query = query.lte('created_at', filters.dateTo)

  if (filters?.search) {
    if (/^\d{3,}$/.test(filters.search)) {
      query = query.like('phone', `%${filters.search}%`)
    } else if (sellerIds && sellerIds.length > 0) {
      query = query.in('seller_id', sellerIds)
    } else {
      query = query.ilike('message', `%${filters.search}%`)
    }
  }

  query = query.order('created_at', { ascending: false })
  if (pageOptions) {
    const from = (pageOptions.page - 1) * pageOptions.pageSize
    const to = from + pageOptions.pageSize - 1
    query = query.range(from, to)
  }

  const { data, error, count } = await query
  if (error) return { data: [], total: 0, error: error.message }
  return {
    data: (data as unknown as Record<string, unknown>[]).map(mapWithRelations),
    total: count ?? 0, error: null,
  }
}
