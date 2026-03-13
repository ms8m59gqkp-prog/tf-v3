/**
 * 제네릭 테이블 컴포넌트
 * WHY: 위탁/주문/정산/상품 목록 UI 통일
 * HOW: 제네릭 columns/rows 패턴
 * WHERE: 모든 목록 페이지
 */
'use client'

import { type ReactNode } from 'react'
import clsx from 'clsx'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  width?: string
}

interface TableShellProps<T> {
  columns: Column<T>[]
  rows: T[]
  keyField: keyof T
  onRowClick?: (row: T) => void
  loading?: boolean
  emptyMessage?: string
}

export default function TableShell<T>({
  columns,
  rows,
  keyField,
  onRowClick,
  loading = false,
  emptyMessage = '데이터가 없습니다',
}: TableShellProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx('whitespace-nowrap px-4 py-3 font-medium text-gray-600', col.width && `w-[${col.width}]`)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            Array.from({ length: 3 }, (_, rowIdx) => (
              <tr key={rowIdx}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 animate-pulse rounded bg-gray-200" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={row[keyField] != null ? String(row[keyField]) : `row-${idx}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-amber-50',
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className="whitespace-nowrap px-4 py-3 text-gray-800">
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
