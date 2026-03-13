/**
 * 주문 상태별 액션 버튼
 * WHY: V2 동일 — 상태에 따라 다른 액션
 * HOW: status → 버튼 매핑
 * WHERE: OrderTable.tsx
 */
'use client'

import Button from '@/components/Button'
import type { OrderStatus } from '@/lib/types/domain/order'

interface OrderActionCellProps {
  id: string
  status: OrderStatus
  onStatusChange: (id: string, status: OrderStatus) => void
  onInspect: (id: string) => void
  onHold: (id: string) => void
}

const ACTION_MAP: Record<string, { label: string; action: 'next' | 'inspect' | 'hold'; next?: OrderStatus }[]> = {
  APPLIED: [{ label: '배송시작', action: 'next', next: 'SHIPPING' }],
  SHIPPING: [{ label: '수거완료', action: 'next', next: 'COLLECTED' }],
  COLLECTED: [{ label: '검수', action: 'inspect' }],
  INSPECTED: [{ label: '보류', action: 'hold' }],
  IMAGE_PREPARING: [{ label: '이미지완료', action: 'next', next: 'IMAGE_COMPLETE' }],
  IMAGE_COMPLETE: [{ label: '확정', action: 'next', next: 'CONFIRMED' }],
}

export default function OrderActionCell({ id, status, onStatusChange, onInspect, onHold }: OrderActionCellProps) {
  const actions = ACTION_MAP[status]
  if (!actions) return <span className="text-sm text-gray-400">—</span>

  return (
    <div className="flex gap-1">
      {actions.map((a) => (
        <Button
          key={a.label}
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation()
            if (a.action === 'inspect') onInspect(id)
            else if (a.action === 'hold') onHold(id)
            else if (a.next) onStatusChange(id, a.next)
          }}
        >
          {a.label}
        </Button>
      ))}
    </div>
  )
}
