/**
 * 상태 뱃지 컴포넌트
 * WHY: 15개 도메인 상태를 색상 뱃지로 표시
 * HOW: status → color 매핑
 * WHERE: 위탁, 주문, 정산 테이블
 */

import clsx from 'clsx'

type BadgeSize = 'sm' | 'md'

interface StatusBadgeProps {
  status: string
  size?: BadgeSize
}

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-amber-100 text-amber-800',
  pending: 'bg-amber-100 text-amber-800',
  inspecting: 'bg-blue-100 text-blue-800',
  processing: 'bg-blue-100 text-blue-800',
  listed: 'bg-green-100 text-green-800',
  confirmed: 'bg-green-100 text-green-800',
  sold: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-emerald-100 text-emerald-800',
  paid: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
  hold: 'bg-orange-100 text-orange-800',
  waiting: 'bg-orange-100 text-orange-800',
  returned: 'bg-gray-100 text-gray-800',
}

const DEFAULT_COLOR = 'bg-gray-100 text-gray-800'

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[(status ?? '').toLowerCase()] ?? DEFAULT_COLOR

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium',
        colorClass,
        SIZE_CLASSES[size],
      )}
    >
      {status}
    </span>
  )
}
