/**
 * 주문 10컬럼 테이블
 * WHY: V2 동일 컬럼 구조
 * HOW: TableShell<OrderRow> + OrderActionCell
 * WHERE: OrderClient.tsx
 */
'use client'

import TableShell, { type Column } from '@/components/TableShell'
import StatusBadge from '@/components/StatusBadge'
import OrderActionCell from './OrderActionCell'
import type { OrderStatus } from '@/lib/types/domain/order'

export interface OrderRow {
  id: string
  orderNumber: string
  customerName: string
  phone: string
  status: OrderStatus
  totalEstimated: number | null
  boxQty: number | null
  visitDate: string | null
  arrivalDate: string | null
  createdAt: string | null
}

interface OrderTableProps {
  rows: OrderRow[]
  loading: boolean
  onStatusChange: (id: string, status: OrderStatus) => void
  onInspect: (id: string) => void
  onHold: (id: string) => void
}

export default function OrderTable({ rows, loading, onStatusChange, onInspect, onHold }: OrderTableProps) {
  const columns: Column<OrderRow>[] = [
    { key: 'createdAt', header: '접수일', render: (r) => r.createdAt?.slice(0, 10) ?? '' },
    { key: 'orderNumber', header: '주문번호' },
    { key: 'customerName', header: '고객명' },
    { key: 'phone', header: '연락처' },
    { key: 'status', header: '상태', render: (r) => <StatusBadge status={r.status} size="sm" /> },
    { key: 'totalEstimated', header: '예상금액', render: (r) => r.totalEstimated?.toLocaleString() ?? '—' },
    { key: 'boxQty', header: '박스수', render: (r) => r.boxQty ?? '—' },
    { key: 'visitDate', header: '방문일', render: (r) => r.visitDate?.slice(0, 10) ?? '—' },
    { key: 'arrivalDate', header: '도착일', render: (r) => r.arrivalDate?.slice(0, 10) ?? '—' },
    {
      key: 'action',
      header: '액션',
      render: (r) => (
        <OrderActionCell
          id={r.id}
          status={r.status}
          onStatusChange={onStatusChange}
          onInspect={onInspect}
          onHold={onHold}
        />
      ),
    },
  ]

  return (
    <TableShell<OrderRow>
      columns={columns}
      rows={rows}
      keyField="id"
      loading={loading}
      emptyMessage="주문 내역이 없습니다"
    />
  )
}
