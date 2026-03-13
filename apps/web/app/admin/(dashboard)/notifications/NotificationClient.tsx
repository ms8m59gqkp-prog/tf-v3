/**
 * 알림 관리 메인 클라이언트
 * WHY: 알림 발송 이력 조회 + 수동 발송 + 재발송/삭제
 * HOW: useApi + NotificationFilters + NotificationTable + SendModal
 * WHERE: notifications/page.tsx
 */
'use client'

import { useState, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { useApi } from '@/hooks/useApi'
import { useToast } from '@/components/Toast'
import { api, APIError } from '@/lib/api/client'
import Button from '@/components/Button'
import Pagination from '@/components/Pagination'
import NotificationFilters, { type NotificationFilterValues } from './NotificationFilters'
import NotificationTable from './NotificationTable'
import SendModal from './SendModal'
import type { NotificationLog } from '@/lib/types/domain/notification'

interface ListResponse { items: NotificationLog[]; total: number }

const PAGE_SIZE = 20
const INIT_FILTERS: NotificationFilterValues = { search: '', status: '', triggerEvent: '' }

export default function NotificationClient() {
  const [filters, setFilters] = useState<NotificationFilterValues>(INIT_FILTERS)
  const [page, setPage] = useState(1)
  const [sendOpen, setSendOpen] = useState(false)
  const [acting, setActing] = useState(false)
  const { toast } = useToast()

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
  if (filters.search) params.set('search', filters.search)
  if (filters.status) params.set('status', filters.status)
  if (filters.triggerEvent) params.set('triggerEvent', filters.triggerEvent)

  const { data, isLoading, mutate } = useApi<ListResponse>(
    `/api/admin/notifications?${params}`,
  )

  const handleFilterChange = useCallback((next: NotificationFilterValues) => {
    setFilters(next)
    setPage(1)
  }, [])

  async function handleResend(id: string) {
    if (acting) return
    setActing(true)
    try {
      await api.post(`/api/admin/notifications/${id}/resend`, {})
      toast('재발송 완료', 'success')
      await mutate()
    } catch (err) {
      toast(err instanceof APIError ? err.message : '재발송 실패', 'error')
    } finally { setActing(false) }
  }

  async function handleDelete(id: string) {
    if (acting) return
    setActing(true)
    try {
      await api.delete(`/api/admin/notifications/${id}`)
      toast('삭제 완료', 'success')
      await mutate()
    } catch (err) {
      toast(err instanceof APIError ? err.message : '삭제 실패', 'error')
    } finally { setActing(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">알림 관리</h2>
        <Button onClick={() => setSendOpen(true)}>
          <Bell className="mr-1.5 h-4 w-4" /> 알림 발송
        </Button>
      </div>

      <NotificationFilters values={filters} onChange={handleFilterChange} />

      <NotificationTable
        rows={data?.items ?? []}
        loading={isLoading}
        onResend={handleResend}
        onDelete={handleDelete}
      />

      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onChange={setPage} />
      <SendModal open={sendOpen} onClose={() => setSendOpen(false)} onSent={() => mutate()} />
    </div>
  )
}
