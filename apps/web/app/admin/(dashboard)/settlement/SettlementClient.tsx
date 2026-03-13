/**
 * 정산 목록 클라이언트
 * WHY: 정산 상태 필터 + 목록 + 워크플로우 진입
 * HOW: useApi + 상태 필터 + 페이지네이션
 * WHERE: settlement/page.tsx
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/useApi'
import StatCard from '@/components/StatCard'
import TableShell, { type Column } from '@/components/TableShell'
import StatusBadge from '@/components/StatusBadge'
import Pagination from '@/components/Pagination'
import Button from '@/components/Button'
import type { SettlementStatus } from '@/lib/types/domain/settlement'

interface SettlementRow {
  id: string
  sellerId: string
  settlementPeriodStart: string
  settlementPeriodEnd: string
  totalSales: number
  settlementAmount: number
  itemCount: number
  status: SettlementStatus
  createdAt: string | null
}

interface ListResponse {
  items: SettlementRow[]
  total: number
}

const STATUS_OPTIONS = ['', 'draft', 'confirmed', 'paid', 'failed'] as const

const COLUMNS: Column<SettlementRow>[] = [
  { key: 'settlementPeriodStart', header: '기간', render: (r) => `${r.settlementPeriodStart} ~ ${r.settlementPeriodEnd}` },
  { key: 'itemCount', header: '건수' },
  { key: 'totalSales', header: '총매출', render: (r) => r.totalSales.toLocaleString() },
  { key: 'settlementAmount', header: '정산액', render: (r) => r.settlementAmount.toLocaleString() },
  { key: 'status', header: '상태', render: (r) => <StatusBadge status={r.status ?? ''} size="sm" /> },
  { key: 'createdAt', header: '생성일', render: (r) => r.createdAt?.slice(0, 10) ?? '' },
]

export default function SettlementClient() {
  const router = useRouter()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const params = new URLSearchParams({ page: String(page), limit: '20' })
  if (status) params.set('status', status)

  const { data, isLoading } = useApi<ListResponse>(`/api/admin/settlements?${params}`)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="draft" value="—" subtitle="미확정" />
        <StatCard title="confirmed" value="—" subtitle="확정" />
        <StatCard title="paid" value="—" subtitle="지급 완료" />
      </div>

      <div className="flex items-center justify-between">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s || '전체'}</option>
          ))}
        </select>
        <Button onClick={() => router.push('/admin/settlement/workflow')}>
          새 정산 시작
        </Button>
      </div>

      <TableShell<SettlementRow>
        columns={COLUMNS}
        rows={data?.items ?? []}
        keyField="id"
        loading={isLoading}
        emptyMessage="정산 내역이 없습니다"
      />

      <Pagination page={page} pageSize={20} total={data?.total ?? 0} onChange={setPage} />
    </div>
  )
}
