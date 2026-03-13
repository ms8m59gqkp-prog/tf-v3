/**
 * 6탭 셀렉터
 * WHY: 위탁 상태별 필터 탭 (V2 동일)
 * HOW: 탭 클릭 → onChange 콜백
 * WHERE: ConsignmentClient.tsx
 */
'use client'

import clsx from 'clsx'

interface Tab {
  label: string
  value: string
}

const TABS: Tab[] = [
  { label: '전체', value: '' },
  { label: '신청', value: 'pending' },
  { label: '검수', value: 'inspecting' },
  { label: '보류', value: 'on_hold' },
  { label: '반려', value: 'rejected' },
  { label: '승인', value: 'approved' },
]

interface TabSelectorProps {
  value: string
  onChange: (value: string) => void
}

export default function TabSelector({ value, onChange }: TabSelectorProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={clsx(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === tab.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
