/**
 * 대시보드 클라이언트
 * WHY: StatCard 4개 + 최근 활동 표시
 * HOW: useApi로 각 도메인 요약 조회
 * WHERE: dashboard/page.tsx
 */
'use client'

import StatCard from '@/components/StatCard'
import RecentActivity from './RecentActivity'
import { useApi } from '@/hooks/useApi'

interface ListResponse {
  items: unknown[]
  total: number
}

export default function DashboardClient() {
  const { data: orders } = useApi<ListResponse>('/api/admin/orders?page=1&limit=1')
  const { data: consignments } = useApi<ListResponse>('/api/admin/consignments?page=1&limit=1')
  const { data: settlements } = useApi<ListResponse>('/api/admin/settlements?status=draft&page=1&limit=1')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="주문"
          value={orders?.total?.toLocaleString() ?? '—'}
          subtitle="전체 주문 수"
        />
        <StatCard
          title="위탁"
          value={consignments?.total?.toLocaleString() ?? '—'}
          subtitle="전체 위탁 수"
        />
        <StatCard
          title="미정산"
          value={settlements?.total?.toLocaleString() ?? '—'}
          subtitle="draft 상태"
        />
        <StatCard
          title="매출"
          value="—"
          subtitle="최근 월 합계"
        />
      </div>

      <RecentActivity />
    </div>
  )
}
