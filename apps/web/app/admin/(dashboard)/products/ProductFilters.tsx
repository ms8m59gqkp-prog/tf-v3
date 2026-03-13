/**
 * 상품 필터 바
 * WHY: 검색/브랜드/활성 상태 필터링
 * HOW: SearchInput + select 조합 → onChange 콜백
 * WHERE: ProductClient.tsx
 */
'use client'

import SearchInput from '@/components/SearchInput'

export interface ProductFilterValues {
  search: string
  brand: string
  isActive: string
}

interface ProductFiltersProps {
  filters: ProductFilterValues
  onChange: (filters: ProductFilterValues) => void
}

export default function ProductFilters({ filters, onChange }: ProductFiltersProps) {
  const selectClass =
    'rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-64">
        <SearchInput
          value={filters.search}
          onChange={(v) => onChange({ ...filters, search: v })}
          placeholder="상품명/코드 검색"
        />
      </div>

      <input
        type="text"
        value={filters.brand}
        onChange={(e) => onChange({ ...filters, brand: e.target.value })}
        placeholder="브랜드"
        className={selectClass + ' w-40'}
      />

      <select
        value={filters.isActive}
        onChange={(e) => onChange({ ...filters, isActive: e.target.value })}
        className={selectClass + ' w-32'}
      >
        <option value="">전체</option>
        <option value="true">활성</option>
        <option value="false">비활성</option>
      </select>
    </div>
  )
}
