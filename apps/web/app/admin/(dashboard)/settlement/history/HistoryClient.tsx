/**
 * 정산 이력 클라이언트
 * WHY: 확정/지급/실패된 정산만 조회 (draft 제외)
 * HOW: useApi + 필터 + 상세 모달
 * WHERE: history/page.tsx
 */
'use client'

import { useState } from 'react'
import { useApi } from '@/hooks/useApi'
import TableShell, { type Column } from '@/components/TableShell'
import StatusBadge from '@/components/StatusBadge'
import Pagination from '@/components/Pagination'
import Modal from '@/components/Modal'
import HistoryFilters from './HistoryFilters'
import type { Settlement, SettlementStatus } from '@/lib/types/domain/settlement'

interface ListResponse { items: Settlement[]; total: number }

const COLUMNS: Column<Settlement>[] = [
  { key: 'settlementPeriodStart', header: '기간', render: (r) => `${r.settlementPeriodStart} ~ ${r.settlementPeriodEnd}` },
  { key: 'itemCount', header: '건수' },
  { key: 'totalSales', header: '총매출', render: (r) => r.totalSales.toLocaleString() },
  { key: 'settlementAmount', header: '정산액', render: (r) => r.settlementAmount.toLocaleString() },
  { key: 'status', header: '상태', render: (r) => <StatusBadge status={r.status ?? ''} size="sm" /> },
  { key: 'createdAt', header: '생성일', render: (r) => r.createdAt?.slice(0, 10) ?? '' },
]

export default function HistoryClient() {
  const [filters, setFilters] = useState({ status: '', periodFrom: '', periodTo: '', sellerId: '' })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)

  const params = new URLSearchParams({ page: String(page), limit: '20' })
  const statusVal = filters.status || 'confirmed,paid,failed'
  params.set('status', statusVal)
  if (filters.periodFrom) params.set('periodFrom', filters.periodFrom)
  if (filters.periodTo) params.set('periodTo', filters.periodTo)
  if (filters.sellerId) params.set('sellerId', filters.sellerId)

  const { data, isLoading } = useApi<ListResponse>(`/api/admin/settlements?${params}`)
  const { data: detail } = useApi<Settlement>(selected ? `/api/admin/settlements/${selected}` : null)

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <HistoryFilters {...filters} onChange={handleFilterChange} />

      <TableShell<Settlement>
        columns={COLUMNS}
        rows={data?.items ?? []}
        keyField="id"
        loading={isLoading}
        emptyMessage="정산 이력이 없습니다"
        onRowClick={(r) => setSelected(r.id)}
      />

      <Pagination page={page} pageSize={20} total={data?.total ?? 0} onChange={setPage} />

      <Modal open={!!selected} onClose={() => setSelected(null)} title="정산 상세" size="lg">
        {detail ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Dt label="기간" value={`${detail.settlementPeriodStart} ~ ${detail.settlementPeriodEnd}`} />
            <Dt label="상태" value={detail.status as SettlementStatus} />
            <Dt label="총매출" value={detail.totalSales.toLocaleString()} />
            <Dt label="수수료" value={detail.commissionAmount.toLocaleString()} />
            <Dt label="정산액" value={detail.settlementAmount.toLocaleString()} />
            <Dt label="건수" value={String(detail.itemCount)} />
            <Dt label="확정일" value={detail.confirmedAt?.slice(0, 10) ?? '-'} />
            <Dt label="지급일" value={detail.paidAt?.slice(0, 10) ?? '-'} />
          </dl>
        ) : (
          <p className="text-sm text-gray-500">로딩 중...</p>
        )}
      </Modal>
    </div>
  )
}

function Dt({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-medium text-gray-600">{label}</dt>
      <dd className="text-gray-900">{value}</dd>
    </>
  )
}
