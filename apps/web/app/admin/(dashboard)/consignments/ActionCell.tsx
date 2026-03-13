/**
 * 위탁 상태별 액션 버튼
 * WHY: V2 동일 — 상태에 따라 다른 액션 표시
 * HOW: status → 버튼 텍스트/동작 매핑
 * WHERE: ConsignmentTable.tsx
 */
'use client'

import Button from '@/components/Button'
import type { ConsignmentStatus } from '@/lib/types/domain/consignment'

interface ActionCellProps {
  id: string
  status: ConsignmentStatus
  onStatusChange: (id: string, status: ConsignmentStatus) => void
  onInspect: (id: string) => void
}

const ACTION_MAP: Record<string, { label: string; action: 'status' | 'inspect'; nextStatus?: ConsignmentStatus }> = {
  pending: { label: '수령확인', action: 'status', nextStatus: 'inspecting' },
  inspecting: { label: '검수시작', action: 'inspect' },
  on_hold: { label: '재검수', action: 'inspect' },
  approved: { label: '완료처리', action: 'status', nextStatus: 'completed' },
}

export default function ActionCell({ id, status, onStatusChange, onInspect }: ActionCellProps) {
  const config = ACTION_MAP[status]
  if (!config) return <span className="text-sm text-gray-400">—</span>

  return (
    <Button
      variant="secondary"
      onClick={(e) => {
        e.stopPropagation()
        if (config.action === 'inspect') {
          onInspect(id)
        } else if (config.nextStatus) {
          onStatusChange(id, config.nextStatus)
        }
      }}
    >
      {config.label}
    </Button>
  )
}
