/**
 * 알림 목록 필터 컴포넌트
 * WHY: 상태/트리거/검색 기반 필터링
 * HOW: SearchInput + select + text input -> onChange 콜백
 * WHERE: NotificationClient
 */
'use client'

import SearchInput from '@/components/SearchInput'
import type { SmsStatus } from '@/lib/types/domain/notification'

export interface NotificationFilterValues {
  search: string
  status: SmsStatus | ''
  triggerEvent: string
}

interface Props {
  values: NotificationFilterValues
  onChange: (next: NotificationFilterValues) => void
}

const STATUS_OPTIONS: { value: SmsStatus | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'pending', label: 'pending' },
  { value: 'sent', label: 'sent' },
  { value: 'failed', label: 'failed' },
]

export default function NotificationFilters({ values, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-60">
        <SearchInput
          value={values.search}
          onChange={(v) => onChange({ ...values, search: v })}
          placeholder="전화번호/메시지 검색"
        />
      </div>

      <select
        value={values.status}
        onChange={(e) => onChange({ ...values, status: e.target.value as SmsStatus | '' })}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <input
        type="text"
        value={values.triggerEvent}
        onChange={(e) => onChange({ ...values, triggerEvent: e.target.value })}
        placeholder="트리거 이벤트"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
    </div>
  )
}
