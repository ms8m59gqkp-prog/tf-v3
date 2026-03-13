/**
 * 셀러별 정산 클라이언트
 * WHY: 셀러 목록 + 클릭 시 상세 모달
 * HOW: useApi + SearchInput + TableShell + SellerDetailModal
 * WHERE: sellers/page.tsx
 */
'use client'

import { useState } from 'react'
import { useApi } from '@/hooks/useApi'
import SearchInput from '@/components/SearchInput'
import TableShell, { type Column } from '@/components/TableShell'
import StatusBadge from '@/components/StatusBadge'
import Pagination from '@/components/Pagination'
import SellerDetailModal from './SellerDetailModal'
import type { Seller } from '@/lib/types/domain/seller'

interface ListResponse { items: Seller[]; total: number }

const COLUMNS: Column<Seller>[] = [
  { key: 'sellerCode', header: '셀러코드' },
  { key: 'name', header: '이름' },
  { key: 'phone', header: '전화번호' },
  { key: 'sellerTier', header: '등급', render: (r) => r.sellerTier ?? '-' },
  { key: 'status', header: '상태', render: (r) => <StatusBadge status={r.status ?? ''} size="sm" /> },
  {
    key: 'commissionRate',
    header: '수수료율',
    render: (r) => r.commissionRate != null ? `${(r.commissionRate * 100).toFixed(0)}%` : '-',
  },
]

export default function SellerSettlementClient() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const params = new URLSearchParams({ page: String(page), limit: '20' })
  if (search) params.set('search', search)

  const { data, isLoading, mutate } = useApi<ListResponse>(`/api/admin/sellers?${params}`)

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleClose = () => {
    setSelectedId(null)
    void mutate()
  }

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <SearchInput value={search} onChange={handleSearch} placeholder="이름 또는 전화번호 검색" />
      </div>

      <TableShell<Seller>
        columns={COLUMNS}
        rows={data?.items ?? []}
        keyField="id"
        loading={isLoading}
        emptyMessage="셀러가 없습니다"
        onRowClick={(r) => setSelectedId(r.id)}
      />

      <Pagination page={page} pageSize={20} total={data?.total ?? 0} onChange={setPage} />

      {selectedId && (
        <SellerDetailModal sellerId={selectedId} onClose={handleClose} />
      )}
    </div>
  )
}
