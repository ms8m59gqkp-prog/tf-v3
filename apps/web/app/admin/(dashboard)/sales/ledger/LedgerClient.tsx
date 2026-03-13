/**
 * 매출 장부 조회 클라이언트 (읽기 전용)
 * WHY: 매출 기록을 테이블로 조회
 * HOW: useApi GET + TableShell + Pagination
 * WHERE: sales/ledger/page.tsx
 */
'use client'

import { useState } from 'react'
import { useApi } from '@/hooks/useApi'
import TableShell, { type Column } from '@/components/TableShell'
import Pagination from '@/components/Pagination'

interface SalesRecord {
  id: string
  productName: string
  brand: string
  salePrice: number
  soldAt: string
  channel: string
}

interface LedgerResponse { items: SalesRecord[]; total: number }

const PAGE_SIZE = 20

const COLUMNS: Column<SalesRecord>[] = [
  { key: 'productName', header: '상품명' },
  { key: 'brand', header: '브랜드' },
  { key: 'salePrice', header: '판매가', render: (r) => r.salePrice.toLocaleString() },
  { key: 'channel', header: '채널' },
  { key: 'soldAt', header: '판매일', render: (r) => r.soldAt?.slice(0, 10) ?? '' },
]

export default function LedgerClient() {
  const [page, setPage] = useState(1)

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })

  const { data, isLoading } = useApi<LedgerResponse>(
    `/api/admin/sales/ledger?${params}`,
  )

  return (
    <div className="space-y-4">
      <TableShell<SalesRecord>
        columns={COLUMNS}
        rows={data?.items ?? []}
        keyField="id"
        loading={isLoading}
        emptyMessage="매출 장부가 비어있습니다"
      />

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.total ?? 0}
        onChange={setPage}
      />
    </div>
  )
}
