/**
 * 위탁 12컬럼 테이블
 * WHY: V2 동일 컬럼 구조 유지
 * HOW: TableShell<ConsignmentRow> + ActionCell
 * WHERE: ConsignmentClient.tsx
 */
'use client'

import TableShell, { type Column } from '@/components/TableShell'
import StatusBadge from '@/components/StatusBadge'
import ActionCell from './ActionCell'
import type { ConsignmentStatus } from '@/lib/types/domain/consignment'

export interface ConsignmentRow {
  id: string
  createdAt: string | null
  productNumber: string | null
  customerName: string
  phone: string
  brand: string
  category: string
  productName: string
  status: ConsignmentStatus
  inspector: string | null
  desiredPrice: number
  adjustmentPrice: number | null
}

interface ConsignmentTableProps {
  rows: ConsignmentRow[]
  loading: boolean
  onStatusChange: (id: string, status: ConsignmentStatus) => void
  onInspect: (id: string) => void
}

export default function ConsignmentTable({
  rows,
  loading,
  onStatusChange,
  onInspect,
}: ConsignmentTableProps) {
  const columns: Column<ConsignmentRow>[] = [
    { key: 'createdAt', header: '접수일', render: (r) => r.createdAt?.slice(0, 10) ?? '' },
    { key: 'productNumber', header: '접수번호', render: (r) => r.productNumber ?? '—' },
    { key: 'customerName', header: '고객명', render: (r) => r.customerName ?? '—' },
    { key: 'phone', header: '연락처', render: (r) => r.phone ?? '—' },
    { key: 'brand', header: '브랜드', render: (r) => r.brand ?? '—' },
    { key: 'category', header: '카테고리', render: (r) => r.category ?? '—' },
    { key: 'productName', header: '상품명', render: (r) => r.productName ?? '—' },
    {
      key: 'status',
      header: '상태',
      render: (r) => <StatusBadge status={r.status} size="sm" />,
    },
    { key: 'inspector', header: '검수자', render: (r) => r.inspector ?? '—' },
    {
      key: 'desiredPrice',
      header: '예상가격',
      render: (r) => r.desiredPrice?.toLocaleString() ?? '—',
    },
    {
      key: 'adjustmentPrice',
      header: '확정가격',
      render: (r) => r.adjustmentPrice?.toLocaleString() ?? '—',
    },
    {
      key: 'action',
      header: '액션',
      render: (r) => (
        <ActionCell
          id={r.id}
          status={r.status}
          onStatusChange={onStatusChange}
          onInspect={onInspect}
        />
      ),
    },
  ]

  return (
    <TableShell<ConsignmentRow>
      columns={columns}
      rows={rows}
      keyField="id"
      loading={loading}
      emptyMessage="위탁 내역이 없습니다"
    />
  )
}
