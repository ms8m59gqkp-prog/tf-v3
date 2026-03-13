/**
 * 디바운스 검색 입력
 * WHY: API 과호출 방지
 * HOW: useDebounce 300ms + onChange
 * WHERE: 위탁, 주문, 상품 검색
 */
'use client'

import { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function SearchInput({ value, onChange, placeholder = '검색...' }: SearchInputProps) {
  const [local, setLocal] = useState(value)
  const debounced = useDebounce(local, 300)

  useEffect(() => { setLocal(value) }, [value])
  useEffect(() => {
    if (debounced !== value) onChange(debounced)
  }, [debounced, value, onChange])

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-9 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
      {local && (
        <button
          type="button"
          onClick={() => setLocal('')}
          className="absolute right-2 rounded p-0.5 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
