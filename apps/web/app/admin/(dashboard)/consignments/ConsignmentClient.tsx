/**
 * 위탁 관리 클라이언트
 * WHY: 탭+검색+테이블+모달 통합
 * HOW: useApi + useState 필터 + 하위 컴포넌트 조합
 * WHERE: consignments/page.tsx
 */
'use client'

import { useState, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { api, APIError } from '@/lib/api/client'
import { useToast } from '@/components/Toast'
import SearchInput from '@/components/SearchInput'
import Pagination from '@/components/Pagination'
import TabSelector from './TabSelector'
import ConsignmentStats from './ConsignmentStats'
import ConsignmentTable, { type ConsignmentRow } from './ConsignmentTable'
import InspectionModal from './InspectionModal'
import ExcelUploadButton from './ExcelUploadButton'
import type { ConsignmentStatus } from '@/lib/types/domain/consignment'

interface ListResponse {
  items: ConsignmentRow[]
  total: number
  page: number
  pageSize: number
}

export default function ConsignmentClient() {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [inspectId, setInspectId] = useState<string | null>(null)
  const [changing, setChanging] = useState(false)
  const { toast } = useToast()

  const params = new URLSearchParams({ page: String(page), limit: '20' })
  if (status) params.set('status', status)
  if (search) params.set('search', search)

  const { data, isLoading, mutate } = useApi<ListResponse>(
    `/api/admin/consignments?${params}`,
  )

  const handleStatusChange = useCallback(async (id: string, next: ConsignmentStatus) => {
    if (changing) return
    setChanging(true)
    try {
      await api.patch(`/api/admin/consignments/${id}`, { status: next })
      toast('상태 변경 완료', 'success')
      await mutate()
    } catch (err) {
      toast(err instanceof APIError ? err.message : '상태 변경 실패', 'error')
    } finally {
      setChanging(false)
    }
  }, [mutate, toast, changing])

  return (
    <div className="space-y-4">
      <ConsignmentStats />

      <div className="flex items-center justify-between gap-4">
        <TabSelector value={status} onChange={(v) => { setStatus(v); setPage(1) }} />
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="고객명/상품명 검색" />
          <ExcelUploadButton onSuccess={() => mutate()} />
        </div>
      </div>

      <ConsignmentTable
        rows={data?.items ?? []}
        loading={isLoading}
        onStatusChange={handleStatusChange}
        onInspect={(id) => setInspectId(id)}
      />

      <Pagination
        page={page}
        pageSize={20}
        total={data?.total ?? 0}
        onChange={setPage}
      />

      {inspectId && (
        <InspectionModal
          consignmentId={inspectId}
          open
          onClose={() => setInspectId(null)}
          onComplete={() => { setInspectId(null); mutate() }}
        />
      )}
    </div>
  )
}
