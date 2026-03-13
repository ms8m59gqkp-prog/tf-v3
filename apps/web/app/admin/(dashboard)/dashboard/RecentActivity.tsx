/**
 * 최근 활동 목록
 * WHY: 대시보드에서 최근 주문/위탁 빠르게 확인
 * HOW: useApi로 최근 5건 조회 → TableShell 렌더
 * WHERE: DashboardClient.tsx
 */
'use client'

import TableShell, { type Column } from '@/components/TableShell'
import StatusBadge from '@/components/StatusBadge'
import { useApi } from '@/hooks/useApi'

interface RecentOrder {
  id: string
  orderNumber: string
  customerName: string
  status: string
  createdAt: string
}

interface OrderListResponse {
  items: RecentOrder[]
  total: number
}

const COLUMNS: Column<RecentOrder>[] = [
  { key: 'orderNumber', header: '주문번호' },
  { key: 'customerName', header: '고객명' },
  {
    key: 'status',
    header: '상태',
    render: (row) => <StatusBadge status={row.status ?? ''} size="sm" />,
  },
  {
    key: 'createdAt',
    header: '일시',
    render: (row) => row.createdAt?.slice(0, 10) ?? '',
  },
]

export default function RecentActivity() {
  const { data, isLoading } = useApi<OrderListResponse>(
    '/api/admin/orders?page=1&limit=5',
  )

  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <h2 className="mb-4 text-base font-semibold text-gray-900">최근 주문</h2>
      <TableShell<RecentOrder>
        columns={COLUMNS}
        rows={data?.items ?? []}
        keyField="id"
        loading={isLoading}
        emptyMessage="최근 주문이 없습니다"
      />
    </div>
  )
}
