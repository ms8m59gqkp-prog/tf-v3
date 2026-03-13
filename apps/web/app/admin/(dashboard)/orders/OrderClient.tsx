/**
 * 주문 관리 클라이언트
 * WHY: 검색+테이블+검수모달+보류모달 통합
 * HOW: useApi + useOrderHandlers + 하위 컴포넌트
 * WHERE: orders/page.tsx
 */
'use client'

import { useState, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { useOrderHandlers } from '@/hooks/useOrderHandlers'
import { useToast } from '@/components/Toast'
import { api, APIError } from '@/lib/api/client'
import SearchInput from '@/components/SearchInput'
import Pagination from '@/components/Pagination'
import OrderTable, { type OrderRow } from './OrderTable'
import OrderInspectionModal from './OrderInspectionModal'
import HoldModal from './HoldModal'
import type { OrderStatus } from '@/lib/types/domain/order'

interface ListResponse { items: OrderRow[]; total: number }
interface OrderItemRow { id: string; estimatedPrice: number | null }

export default function OrderClient() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [inspectTarget, setInspectTarget] = useState<{ id: string; itemId: string; price: number } | null>(null)
  const [holdTarget, setHoldTarget] = useState<{ id: string; itemId: string } | null>(null)
  const [changing, setChanging] = useState(false)
  const { toast } = useToast()

  const params = new URLSearchParams({ page: String(page), limit: '20' })
  if (search) params.set('search', search)

  const { data, isLoading, mutate } = useApi<ListResponse>(`/api/admin/orders?${params}`)
  const handlers = useOrderHandlers(mutate)

  async function handleStatusChange(id: string, status: OrderStatus) {
    if (changing) return
    setChanging(true)
    try {
      await handlers.statusChange(id, status)
      toast('상태 변경 완료', 'success')
    } catch (err) {
      toast(err instanceof APIError ? err.message : '상태 변경 실패', 'error')
    } finally { setChanging(false) }
  }

  const openModal = useCallback(async (orderId: string, mode: 'inspect' | 'hold') => {
    try {
      const items = await api.get<OrderItemRow[]>(`/api/admin/orders/${orderId}/items`)
      const first = items[0]
      if (!first) { toast('아이템이 없습니다', 'error'); return }
      if (mode === 'inspect') setInspectTarget({ id: orderId, itemId: first.id, price: first.estimatedPrice ?? 0 })
      else setHoldTarget({ id: orderId, itemId: first.id })
    } catch { toast('아이템 조회 실패', 'error') }
  }, [toast])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">주문 목록</h2>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="고객명/주문번호 검색" />
      </div>

      <OrderTable rows={data?.items ?? []} loading={isLoading} onStatusChange={handleStatusChange}
        onInspect={(id) => openModal(id, 'inspect')} onHold={(id) => openModal(id, 'hold')} />

      <Pagination page={page} pageSize={20} total={data?.total ?? 0} onChange={setPage} />

      {inspectTarget && (
        <OrderInspectionModal orderId={inspectTarget.id} itemId={inspectTarget.itemId} originalPrice={inspectTarget.price} open onClose={() => setInspectTarget(null)}
          onInspectionComplete={async (itemId, condition, memo) => { await handlers.inspectionComplete(inspectTarget.id, itemId, { inspectionStatus: 'completed', condition, memo }) }}
          onMeasurementSave={async (itemId, m, s) => { await handlers.measurementSave(inspectTarget.id, itemId, m, s) }}
        />
      )}
      {holdTarget && (
        <HoldModal orderId={holdTarget.id} itemId={holdTarget.itemId} open onClose={() => setHoldTarget(null)} onHold={handlers.hold} />
      )}
    </div>
  )
}
