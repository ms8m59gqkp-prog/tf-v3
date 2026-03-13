/**
 * 페이지네이션 컴포넌트
 * WHY: 목록 페이지 탐색
 * HOW: page/total 기반 버튼 그룹
 * WHERE: 모든 목록 페이지
 */
'use client'

import clsx from 'clsx'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}

function getVisiblePages(current: number, last: number): (number | 'ellipsis')[] {
  if (last <= 5) return Array.from({ length: last }, (_, i) => i + 1)

  const pages: (number | 'ellipsis')[] = [1]

  if (current > 3) pages.push('ellipsis')

  const start = Math.max(2, current - 1)
  const end = Math.min(last - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  if (current < last - 2) pages.push('ellipsis')

  pages.push(last)
  return pages
}

const BTN_BASE = 'flex h-8 min-w-8 items-center justify-center rounded text-sm font-medium transition-colors'

export default function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  if (pageSize <= 0 || !Number.isFinite(total) || total < 0) return null
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  const visible = getVisiblePages(page, lastPage)

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-500">전체 {total.toLocaleString()}건</span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className={clsx(BTN_BASE, 'px-2', page <= 1 ? 'cursor-not-allowed text-gray-300' : 'text-gray-600 hover:bg-gray-100')}
        >
          &lt;
        </button>

        {visible.map((item, idx) =>
          item === 'ellipsis' ? (
            <span key={`e-${idx}`} className="px-1 text-sm text-gray-400">...</span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              className={clsx(
                BTN_BASE, 'px-2',
                item === page
                  ? 'bg-amber-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100',
              )}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          disabled={page >= lastPage}
          onClick={() => onChange(page + 1)}
          className={clsx(BTN_BASE, 'px-2', page >= lastPage ? 'cursor-not-allowed text-gray-300' : 'text-gray-600 hover:bg-gray-100')}
        >
          &gt;
        </button>
      </div>
    </div>
  )
}
