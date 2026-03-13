/**
 * 위탁 상태별 통계
 * WHY: 현재 상태 분포 한눈에
 * HOW: useApi × 4 → StatCard
 * WHERE: ConsignmentClient.tsx
 */
'use client'

import StatCard from '@/components/StatCard'
import { useApi } from '@/hooks/useApi'

interface ListResponse { items: unknown[]; total: number }

export default function ConsignmentStats() {
  const pending = useApi<ListResponse>('/api/admin/consignments?status=pending&page=1&limit=1')
  const inspecting = useApi<ListResponse>('/api/admin/consignments?status=inspecting&page=1&limit=1')
  const onHold = useApi<ListResponse>('/api/admin/consignments?status=on_hold&page=1&limit=1')
  const approved = useApi<ListResponse>('/api/admin/consignments?status=approved&page=1&limit=1')

  const stats = [
    { title: '신청', data: pending.data },
    { title: '검수중', data: inspecting.data },
    { title: '보류', data: onHold.data },
    { title: '승인', data: approved.data },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <StatCard key={s.title} title={s.title} value={s.data?.total?.toLocaleString() ?? '—'} />
      ))}
    </div>
  )
}
