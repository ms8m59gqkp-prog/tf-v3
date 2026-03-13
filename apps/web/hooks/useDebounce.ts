/**
 * 디바운스 훅
 * WHY: 검색 입력 등 연속 이벤트 지연
 * HOW: setTimeout + cleanup
 * WHERE: SearchInput, 필터
 */
import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
