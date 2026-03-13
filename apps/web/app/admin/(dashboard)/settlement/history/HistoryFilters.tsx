/**
 * 정산 이력 필터
 * WHY: 상태/기간/셀러 기준 이력 검색
 * HOW: select + date + text 입력 → onChange 콜백
 * WHERE: history/HistoryClient.tsx
 */
'use client'

interface HistoryFiltersProps {
  status: string
  periodFrom: string
  periodTo: string
  sellerId: string
  onChange: (key: string, value: string) => void
}

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'confirmed', label: 'confirmed' },
  { value: 'paid', label: 'paid' },
  { value: 'failed', label: 'failed' },
] as const

export default function HistoryFilters({
  status,
  periodFrom,
  periodTo,
  sellerId,
  onChange,
}: HistoryFiltersProps) {
  const inputClass = 'rounded-md border border-gray-300 px-3 py-2 text-sm'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={status}
        onChange={(e) => onChange('status', e.target.value)}
        className={inputClass}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <input
        type="date"
        value={periodFrom}
        onChange={(e) => onChange('periodFrom', e.target.value)}
        className={inputClass}
        placeholder="시작일"
      />
      <input
        type="date"
        value={periodTo}
        onChange={(e) => onChange('periodTo', e.target.value)}
        className={inputClass}
        placeholder="종료일"
      />
      <input
        type="text"
        value={sellerId}
        onChange={(e) => onChange('sellerId', e.target.value)}
        className={inputClass}
        placeholder="셀러 ID"
      />
    </div>
  )
}
